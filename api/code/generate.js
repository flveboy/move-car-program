const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { token, car_id, limit_day = 3, limit_total = 100 } = req.body;
  if (!token || !car_id) return res.status(400).json({ error: '缺少参数' });

  // 校验 token
  const owners = await redis.keys('owner:*');
  let owner = null;
  for (const key of owners) {
    const o = await redis.hgetall(key);
    if (o.token === token) { owner = o; break; }
  }
  if (!owner) return res.status(401).json({ error: '未登录' });

  const car = await redis.hgetall(`car:${car_id}`);
  if (!car || car.owner_id !== owner.id) return res.status(403).json({ error: '车辆不属于您' });

  const code = crypto.randomBytes(5).toString('hex').toUpperCase(); // 8位
  const codeData = {
    car_id: car.id,
    owner_id: owner.id,
    status: 'enable',
    limit_day,
    limit_total,
    used_today: 0,
    used_total: 0,
    phone: car.phone
  };
  await redis.hset(`code:${code}`, codeData);
  return res.json({ success: true, code });
};