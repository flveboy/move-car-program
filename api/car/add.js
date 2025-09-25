const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { token, plate, phone } = req.body;
  if (!token || !plate || !phone) return res.status(400).json({ error: '缺少参数' });

  // 校验 token
  const owners = await redis.keys('owner:*');
  let owner = null;
  for (const key of owners) {
    const o = await redis.hgetall(key);
    if (o.token === token) { owner = o; break; }
  }
  if (!owner) return res.status(401).json({ error: '未登录' });

  const carId = crypto.randomUUID();
  const car = { id: carId, owner_id: owner.id, plate, phone };
  await redis.hset(`car:${carId}`, car);
  return res.json({ success: true, car });
};