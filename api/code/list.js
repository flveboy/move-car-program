const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });

  const owners = await redis.keys('owner:*');
  let owner = null;
  for (const key of owners) {
    const o = await redis.hgetall(key);
    if (o.token === token) { owner = o; break; }
  }
  if (!owner) return res.status(401).json({ error: '未登录' });

  const codes = await redis.keys('code:*');
  const list = [];
  for (const key of codes) {
    const code = await redis.hgetall(key);
    if (code.owner_id === owner.id) {
      const car = await redis.hgetall(`car:${code.car_id}`);
      list.push({ code: key.replace('code:', ''), car, ...code });
    }
  }
  return res.json({ success: true, list });
};