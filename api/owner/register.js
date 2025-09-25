const { Redis } = require('@upstash/redis');
const crypto = require('crypto');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { phone, name, pwd, smsCode } = req.body;
  if (!phone || !name || !pwd || !smsCode) return res.status(400).json({ error: '缺少参数' });

  // 简易验证码校验（demo 用，生产请接短信平台）
  if (smsCode !== '123456') return res.status(403).json({ error: '验证码错误' });

  const ownerKey = `owner:${phone}`;
  if (await redis.exists(ownerKey)) return res.status(409).json({ error: '手机号已注册' });

  const owner = { id: crypto.randomUUID(), name, pwd: crypto.createHash('sha256').update(pwd).digest('hex'), token: crypto.randomUUID() };
  await redis.hset(ownerKey, owner);
  return res.json({ success: true, token: owner.token });
};