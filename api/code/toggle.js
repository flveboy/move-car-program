const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { token, code } = req.body;
  if (!token || !code) return res.status(400).json({ error: '缺少参数' });

  const codeData = await redis.hgetall(`code:${code}`);
  if (!codeData) return res.status(404).json({ error: '码不存在' });

  const owner = await redis.hgetall(`owner:${codeData.owner_id}`);
  if (owner.token !== token) return res.status(401).json({ error: '无权限' });

  const newStatus = codeData.status === 'enable' ? 'disable' : 'enable';
  await redis.hset(`code:${code}`, 'status', newStatus);
  return res.json({ success: true, status: newStatus });
};