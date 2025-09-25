const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { phone, pwd } = req.body;
  if (!phone || !pwd) return res.status(400).json({ error: '缺少参数' });

  const ownerKey = `owner:${phone}`;
  const owner = await redis.hgetall(ownerKey);
  if (!owner) return res.status(404).json({ error: '用户不存在' });

  const hash = crypto.createHash('sha256').update(pwd).digest('hex');
  if (hash !== owner.pwd) return res.status(403).json({ error: '密码错误' });

  const newToken = crypto.randomUUID();
  await redis.hset(ownerKey, 'token', newToken);
  return res.json({ success: true, token: newToken });
};