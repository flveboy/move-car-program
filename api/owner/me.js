// api/owner/me.js
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });

  const token = auth.replace('Bearer ', '');

  // 遍历所有车主，找到 token 匹配的
  const owners = await redis.keys('owner:*');
  for (const key of owners) {
    const owner = await redis.hgetall(key);
    if (owner.token === token) {
      return res.json({ success: true, owner });
    }
  }

  return res.status(401).json({ error: '无效的 Token' });
};
