// api/notification.js
// 扫码挪车 - 通知接口（钉钉 / 企微 / 电话）
// 统一校验：UUID 存在 + 10min 过期 + 1min 限流（Redis）
// 支持 Vercel / Netlify / Cloudflare（CommonJS）

const { Redis } = require('@upstash/redis');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// 平台检测
const platform = (() => {
  if (process.env.DEPLOY_PLATFORM) return process.env.DEPLOY_PLATFORM;
  if (process.env.VERCEL === '1') return 'vercel';
  if (process.env.NETLIFY === 'true') return 'netlify';
  if (typeof addEventListener !== 'undefined') return 'cloudflare';
  return 'vercel';
})();

// 统一响应
function json(status, data) {
  const headers = { 'Content-Type': 'application/json' };
  if (platform === 'cloudflare') return new Response(JSON.stringify(data), { status, headers });
  return { statusCode: status, headers, body: JSON.stringify(data) };
}

/* ====== 核心业务：校验 + 通知 ====== */
async function handleNotification(body, ip) {
  const { uuid, message, type = 'dingtalk' } = body;
  if (!uuid || !message) return json(400, { error: '缺少 uuid 或 message' });

  /* 1. UUID 存在性 & 过期校验 */
  const key = `move:${uuid}`;
  if (!(await redis.exists(key))) return json(403, { error: '无效的请求 ID 或已过期' });

  /* 2. 1 分钟限流（每个 UUID）*/
  const rateKey = `rate:${uuid}`;
  if (await redis.exists(rateKey)) return json(429, { error: '请求过于频繁，请稍后重试' });
  await redis.set(rateKey, 1, { ex: 60 });

  /* 3. 用完即毁 */
  await redis.del(key);

  /* 4. 通知分支 */
  try {
    if (type === 'dingtalk') return await sendDingTalk(message);
    if (type === 'wecom') return await sendWeCom(message);
    if (type === 'call') return await getPhone();
    return json(400, { error: '未知通知类型' });
  } catch (e) {
    console.error('[notification] 异常:', e);
    return json(500, { error: '服务器内部错误', detail: e.message });
  }
}

/* ====== 钉钉 ====== */
async function sendDingTalk(msg) {
  const webhook = process.env.DINGTALK_WEBHOOK;
  if (!webhook) return json(500, { error: '钉钉 Webhook 未配置' });

  const secret = process.env.DINGTALK_SECRET;
  let url = webhook;
  if (secret) {
    const timestamp = Date.now();
    const sign = crypto.createHmac('sha256', secret).update(`${timestamp}\n${secret}`).digest('base64');
    url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
  }

  const content = `🚗 挪车通知\n\n${msg}\n\n时间：${new Date().toLocaleString('zh-CN')}`;
  const rsp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content } }),
  });
  const data = await rsp.json();
  if (data.errcode === 0) return json(200, { success: true, message: '钉钉通知已发送' });
  return json(500, { error: '钉钉发送失败', detail: data.errmsg });
}

/* ====== 企业微信 ====== */
async function sendWeCom(msg) {
  const webhook = process.env.WECOM_WEBHOOK;
  if (!webhook) return json(500, { error: '企业微信 Webhook 未配置' });

  const content = `🚗 挪车通知\n\n${msg}\n\n时间：${new Date().toLocaleString('zh-CN')}`;
  const rsp = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content } }),
  });
  const data = await rsp.json();
  if (data.errcode === 0) return json(200, { success: true, message: '企业微信通知已发送' });
  return json(500, { error: '企业微信发送失败', detail: data.errmsg });
}

/* ====== 电话 ====== */
async function getPhone() {
  const phone = process.env.OWNER_PHONE;
  if (!phone) return json(500, { error: '车主未预留电话' });
  return json(200, { phone });
}

/* ====== 平台入口 ====== */
if (platform === 'netlify') {
  exports.handler = async (event) => {
    const body = JSON.parse(event.body);
    const ip = event.headers['x-forwarded-for'] || event.headers['x-bb-ip'] || '0.0.0.0';
    return handleNotification(body, ip);
  };
} else if (platform === 'cloudflare') {
  addEventListener('fetch', event => {
    const ip = event.request.headers.get('cf-connecting-ip') || '0.0.0.0';
    event.respondWith(
      event.request.json().then(body => handleNotification(body, ip))
    );
  });
} else {
  // Vercel
  module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const result = await handleNotification(req.body, ip);
    res.status(result.statusCode).json(JSON.parse(result.body));
  };
}