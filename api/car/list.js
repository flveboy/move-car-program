// api/car/list.js
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  const auth = req.headers.authorization;
   console.log('[car/list] 收到 token:', req.headers.authorization);
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  const token = auth.replace('Bearer ', '');

  // 找到车主
  const owners = await redis.keys('owner:*');
  console.log('[car/list] 扫描到的 owner 数量:', owners.length);
  let owner = null;
  for (const key of owners) {
    const o = await redis.hgetall(key);
    console.log('[car/list] owner:', k, 'token:', o.token);
    if (o.token === token) { owner = o; break; }
  }
  if (!owner) return res.status(401).json({ error: '无效的 Token' });

  // 查找所有车辆
  const cars = await redis.keys('car:*');
  const list = [];
  for (const key of cars) {
    const car = await redis.hgetall(key);
    if (car.owner_id === owner.id) {
      list.push(car);
    }
  }

  return res.json({ success: true, cars: list });
};
