const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: '缺少 code' });

  const codeData = await redis.hgetall(`code:${code}`);
  if (!codeData) return res.status(404).json({ error: '码不存在' });

  const records = await redis.keys(`record:${code}:*`);
  const list = [];
  for (const key of records) {
    const rec = await redis.hgetall(key);
    list.push(rec);
  }
  list.sort((a, b) => b.created_at - a.created_at);
  return res.json({ success: true, list });
};