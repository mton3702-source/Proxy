const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const os = require('os');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const KEY_TTL_MS = 14 * 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const KEYS_DB = {
  keys: [
    { key: "TITAN-A1B2-C3D4", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-E5F6-G7H8", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-I9J0-K1L2", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-M3N4-O5P6", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-Q7R8-S9T0", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-U1V2-W3X4", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-Y5Z6-A7B8", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-C9D0-E1F2", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-G3H4-I5J6", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-K7L8-M9N0", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-O1P2-Q3R4", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-S5T6-U7V8", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-W9X0-Y1Z2", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-A3B4-C5D6", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-E7F8-G9H0", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-I1J2-K3L4", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-M5N6-O7P8", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-Q9R0-S1T2", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-U3V4-W5X6", used: false, deviceId: null, expiresAt: null },
    { key: "TITAN-Y7Z8-A9B0", used: false, deviceId: null, expiresAt: null }
  ]
};

function fingerprint(req) {
  const raw = (req.headers['user-agent'] || '') + (req.ip || '') + (req.headers['accept-language'] || '');
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

app.post('/api/verify-key', (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ ok: false, message: 'Thiếu key' });
  const found = KEYS_DB.keys.find(k => k.key === key.trim().toUpperCase());
  if (!found) return res.status(404).json({ ok: false, message: 'Key không tồn tại' });
  const deviceId = fingerprint(req);
  if (found.used && found.deviceId !== deviceId) return res.status(403).json({ ok: false, message: 'Key đã khóa thiết bị khác' });
  if (found.expiresAt && Date.now() > new Date(found.expiresAt).getTime()) return res.status(403).json({ ok: false, message: 'Key đã hết hạn' });
  if (!found.used) {
    found.used = true;
    found.deviceId = deviceId;
    found.expiresAt = new Date(Date.now() + KEY_TTL_MS).toISOString();
  }
  return res.json({ ok: true, message: 'Xác thực thành công', deviceId, expiresAt: found.expiresAt, remainingMs: new Date(found.expiresAt).getTime() - Date.now(), daysLeft: 14 });
});

app.post('/api/session-check', (req, res) => {
  const { key } = req.body || {};
  const found = KEYS_DB.keys.find(k => k.key === key);
  if (!found || !found.used) return res.status(404).json({ ok: false });
  if (Date.now() > new Date(found.expiresAt).getTime()) return res.status(403).json({ ok: false, message: 'Hết hạn' });
  return res.json({ ok: true, remainingMs: new Date(found.expiresAt).getTime() - Date.now() });
});

app.get('/api/device-info', (req, res) => {
  res.json({ ok: true, platform: process.platform, arch: process.arch, hostname: os.hostname(), cpus: os.cpus().length, totalmem: os.totalmem(), freemem: os.freemem(), uptime: process.uptime(), nodeVersion: process.version, serverTime: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server TITAN chạy tại cổng ' + PORT);
});
