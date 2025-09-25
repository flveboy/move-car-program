// 生成一次性挪车码
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 可扩展：校验来源、验证码等
  const uuid = require('crypto').randomUUID();
  const key = `move:${uuid}`;
  await redis.set(key, 1, { ex: 600 }); // 10 分钟过期

  console.log(`[gen-req] UUID=${uuid} generated`);
  return res.status(200).json({ uuid });
};