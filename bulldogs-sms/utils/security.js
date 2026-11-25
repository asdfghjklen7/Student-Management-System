const crypto = require('crypto');

/* ---------- Password hashing (scrypt, no external dependency) ---------- */
exports.hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

exports.verifyPassword = (password, stored) => {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(String(password), salt, 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

/* ---------- Signed session tokens (HMAC-SHA256) ---------- */
// If SESSION_SECRET is not set, a random one is generated: everyone is signed out on restart.
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

exports.signToken = (userId) => {
  const body = b64(JSON.stringify({ id: String(userId), exp: Date.now() + TTL_MS }));
  return `${body}.${sign(body)}`;
};

exports.verifyToken = (token) => {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const good = Buffer.from(sign(body));
  const given = Buffer.from(sig || '');
  if (good.length !== given.length || !crypto.timingSafeEqual(good, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
};
