/**
 * UN LOCK - Server API
 * Deploy lên Render.com
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════ MIDDLEWARE ═══════════════
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════ CẤU HÌNH ═══════════════
const DB_FILE = path.join(__dirname, 'keys.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'UNLOCK_ADMIN_2026';
const KEY_PREFIX = 'PTROT';
const KEY_LENGTH = 12;

// ═══════════════ DATABASE ═══════════════
let db = {
  version: '1.0',
  updated_at: new Date().toISOString(),
  keys: []
};

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(raw);
      console.log('✅ Loaded ' + db.keys.length + ' keys');
    } else {
      // Tạo 5 key mẫu lần đầu
      db.keys = [
        createKey('PTROT1234567', 7),
        createKey('PTROTABCDEFG', 30),
        createKey('PTROTUNLOCK1', 1),
        createKey('PTROTVIP9999', 365, 3),
        createKey('PTROT8888888', 7)
      ];
      saveDB();
      console.log('📝 Created 5 sample keys');
    }
  } catch (e) {
    console.error('❌ Load DB error:', e.message);
  }
}

function saveDB() {
  try {
    db.updated_at = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) {
    console.error('❌ Save DB error:', e.message);
  }
}

function createKey(key, days, maxDev) {
  return {
    key: key.toUpperCase(),
    device_id: null,
    device_name: null,
    activated_at: null,
    expire_at: null,
    duration_days: days,
    status: 'unused',
    max_devices: maxDev || 1,
    devices: [],
    note: '',
    created_at: new Date().toISOString()
  };
}

function genKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 7; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return KEY_PREFIX + s;
}

function validFmt(k) {
  if (!k || typeof k !== 'string') return false;
  k = k.toUpperCase().trim();
  return k.length === KEY_LENGTH && k.startsWith(KEY_PREFIX);
}

function findKey(k) {
  if (!k) return null;
  const u = k.toUpperCase().trim();
  return db.keys.find(function(item){ return item.key === u; });
}

// ═══════════════ API: HEALTH ═══════════════
app.get('/api/health', function(req, res){
  res.json({
    ok: true,
    service: 'UN LOCK API',
    version: db.version,
    total_keys: db.keys.length,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ═══════════════ API: VERIFY KEY ═══════════════
app.post('/api/verify', function(req, res){
  const body = req.body || {};
  const key = body.key;
  const deviceId = body.device_id;
  const deviceName = body.device_name;

  if (!key || !deviceId) {
    return res.status(400).json({
      ok: false,
      code: 'MISSING_PARAMS',
      message: 'Thiếu key hoặc device_id'
    });
  }

  if (!validFmt(key)) {
    return res.status(400).json({
      ok: false,
      code: 'INVALID_FORMAT',
      message: 'Key sai định dạng (PTROT + 7 ký tự)'
    });
  }

  const rec = findKey(key);
  if (!rec) {
    return res.status(404).json({
      ok: false,
      code: 'KEY_NOT_FOUND',
      message: 'Key không tồn tại'
    });
  }

  if (rec.status === 'banned') {
    return res.status(403).json({
      ok: false,
      code: 'KEY_BANNED',
      message: 'Key đã bị khóa'
    });
  }

  if (rec.status === 'expired' || (rec.expire_at && new Date(rec.expire_at) < new Date())) {
    rec.status = 'expired';
    saveDB();
    return res.status(403).json({
      ok: false,
      code: 'KEY_EXPIRED',
      message: 'Key đã hết hạn'
    });
  }

  // Check existing device
  let existDev = null;
  for (let i = 0; i < rec.devices.length; i++) {
    if (rec.devices[i].device_id === deviceId) { existDev = rec.devices[i]; break; }
  }

  if (rec.devices.length > 0 && !existDev) {
    if (rec.devices.length >= rec.max_devices) {
      return res.status(403).json({
        ok: false,
        code: 'DEVICE_LIMIT',
        message: 'Key đã đạt giới hạn ' + rec.max_devices + ' thiết bị'
      });
    }
  }

  let isNew = false;

  if (!existDev) {
    const now = new Date();
    let expAt;

    if (rec.expire_at) {
      expAt = new Date(rec.expire_at);
    } else {
      expAt = new Date(now.getTime() + rec.duration_days * 24 * 60 * 60 * 1000);
      rec.activated_at = now.toISOString();
      rec.expire_at = expAt.toISOString();
      rec.device_id = deviceId;
      rec.device_name = deviceName || 'Thiết bị';
      isNew = true;
    }

    rec.devices.push({
      device_id: deviceId,
      device_name: deviceName || 'Thiết bị',
      activated_at: now.toISOString()
    });

    rec.status = 'active';
    saveDB();
    console.log('🔓 Activated: ' + rec.key + ' for ' + deviceName);
  }

  const expTime = new Date(rec.expire_at).getTime();
  const remain = expTime - Date.now();
  const daysLeft = Math.max(0, Math.ceil(remain / (24 * 60 * 60 * 1000)));

  return res.json({
    ok: true,
    code: isNew ? 'ACTIVATED' : 'ALREADY_ACTIVE',
    message: isNew ? 'Kích hoạt thành công' : 'Key đang hoạt động',
    data: {
      key: rec.key,
      status: rec.status,
      duration_days: rec.duration_days,
      activated_at: rec.activated_at,
      expire_at: rec.expire_at,
      days_left: daysLeft,
      max_devices: rec.max_devices,
      device_count: rec.devices.length
    }
  });
});

// ═══════════════ API: CHECK KEY ═══════════════
app.post('/api/check', function(req, res){
  const key = (req.body || {}).key;
  if (!validFmt(key)) {
    return res.status(400).json({ ok: false, message: 'Sai định dạng' });
  }
  const rec = findKey(key);
  if (!rec) return res.status(404).json({ ok: false, message: 'Không tồn tại' });

  res.json({
    ok: true,
    data: {
      status: rec.status,
      duration_days: rec.duration_days,
      max_devices: rec.max_devices
    }
  });
});

// ═══════════════ API: LOGOUT ═══════════════
app.post('/api/logout', function(req, res){
  const body = req.body || {};
  const key = body.key;
  const deviceId = body.device_id;

  if (!key || !deviceId) {
    return res.status(400).json({ ok: false, message: 'Thiếu tham số' });
  }

  const rec = findKey(key);
  if (!rec) return res.status(404).json({ ok: false, message: 'Key không tồn tại' });

  const before = rec.devices.length;
  rec.devices = rec.devices.filter(function(d){ return d.device_id !== deviceId; });

  if (rec.devices.length === 0) {
    rec.status = 'unused';
    rec.device_id = null;
    rec.device_name = null;
    rec.activated_at = null;
    rec.expire_at = null;
    console.log('🔄 Reset key: ' + rec.key);
  }

  saveDB();
  res.json({
    ok: true,
    message: 'Đăng xuất thành công',
    removed: before - rec.devices.length
  });
});

// ═══════════════ ADMIN MIDDLEWARE ═══════════════
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, message: 'Token admin không hợp lệ' });
  }
  next();
}

// ═══════════════ API ADMIN: LIST KEYS ═══════════════
app.get('/api/admin/keys', requireAdmin, function(req, res){
  const now = Date.now();
  db.keys.forEach(function(k){
    if (k.status === 'active' && k.expire_at && new Date(k.expire_at).getTime() < now) {
      k.status = 'expired';
    }
  });
  saveDB();

  res.json({
    ok: true,
    total: db.keys.length,
    keys: db.keys
  });
});

// ═══════════════ API ADMIN: CREATE KEY ═══════════════
app.post('/api/admin/keys', requireAdmin, function(req, res){
  const body = req.body || {};
  const duration = parseInt(body.duration_days) || 7;
  const maxDev = parseInt(body.max_devices) || 1;
  const note = body.note || '';

  let newKey = body.key ? body.key.toUpperCase().trim() : genKey();

  if (!validFmt(newKey)) {
    return res.status(400).json({ ok: false, message: 'Key sai định dạng' });
  }

  if (findKey(newKey)) {
    return res.status(409).json({ ok: false, message: 'Key đã tồn tại' });
  }

  const rec = createKey(newKey, duration, maxDev);
  rec.note = note;
  db.keys.push(rec);
  saveDB();

  console.log('➕ Created: ' + newKey + ' (' + duration + ' days)');
  res.json({ ok: true, message: 'Đã tạo key', key: rec });
});

// ═══════════════ API tồ ADMIN: BULK CREATE ═══════════════
app.post('/api/admin/keys/bulk', requireAdminn, function(req, res){
  const body = req.body || {};
  const count = parseInt(body.count) || 10;
  const duration = parseInt(body.duration_days) || 7;
  const maxDev = parseInt(body.max_devices) || 1;
  const note = body.note || '';

  const created tại = [];
  for (let i = 0; i < count; i++) {
    let nk;
    let attempts = 0;
    do {
      nk = gen'Key();
      attempts++;
    } while (findKey(nk) && attempts < 100);

    if (findKey(nk)) continue;

    const rec });
 = createKey(nk, duration, maxDev);
    rec.note = note;
    db.keys.push(rec);
    created.push(nk);
  }

  saveDB();
  console.log('➕ Bulk created ' + created.length + ' keys');
  res.json({ ok: true, message: 'Đã tạo ' + created.length + ' keys', keys: created });
});

// ═══════════════ API ADMIN: DELETE KEY ═══════════════
app.delete('/api/admin/keys/:key', requireAdmin, function(req, res){
  const key = req.params.key.toUpperCase();
  const before = db.keys.length;
  db.keys = db.keys.filter(function(k){ return k.key !== key; });

  if (db.keys.length === before) {
    return res.status(404).json({ ok: false, message: 'Key không  }

  saveDB();
  console.log('🗑️ Deleted: ' + key);
  res.json({ ok: true, message: 'Đã xóa key' });
});

// ═══════════════ API ADMIN: UPDATE STATUS ═══════════════
app.patch('/api/admin/keys/:key/status', requireAdmin, function(req, res){
  const key = req.params.key.toUpperCase();
  const status = (req.body || {}).status;

  if (['unused','active','expired','banned'].indexOf(status) === -1) {
    return res.status(400).json({ ok: false, message: 'Status không hợp lệ' });
  }

  const rec = findKey(key);
  if (!rec) return res.status(404).json({ ok: false, message: 'Key không tồn tại' });

  rec.status = status;
  if (status === 'unused') {
    rec.devices = [];
    rec.device _id = null;
    rec.device_name = null;
    rec.activated_at = null;
    rec.expire_at = null;
  }
  saveDB();
  console.log(' if✏️ Status: ' + key + ' → ' + status);
  res.json({ ok: true, message: 'Đã cập nhật', key: rec });
});

// (! ═══════════════ API ADMIN: EXTEND ═══════════════
app.patch('/api/admin/keys/:key/extend', requireAdmin,rec function(req, res){
  const key = req.params.key.toUpperCase();
  const days = parseInt((req.body || {}).)days) || 7;

  const rec = findKey(key);
 return res.status(404).json({ ok: false, message: 'Key không tồn tại' });

  const base = rec.expire_at ? new Date(rec.expire_at).getTime() : Date.now();
  const newExp = base + days * 24 * 60 * 60 * 1000;
  rec.expire_at = new Date(newExp).toISOString();
  rec.duration_days = (rec.duration_days || 0) + days;
  rec.status = 'active';
  saveDB();

  console.log('⏰ Extended: ' + key + ' +' + days + ' days');
  res.json({ ok: true, message: 'Đã gia hạn ' + days + ' ngày', key: rec });
});

// ═══════════════ API ADMIN: RESET ═══════════════
app.patch('/api/admin/keys/:key/reset', requireAdmin, function(req, res){
  const key = req.params.key.toUpperCase();
  const rec = findKey(key);
  if (!rec) return res.status(404).json({ ok: false, message: 'Key không tồn tại' });

  rec.devices = [];
  rec.device_id = null;
  rec.device_name = null;
  rec.activated_at = null;
  rec.expire_at = null;
  rec.status = 'unused';
  saveDB();

  console.log('🔄 Reset: ' + key);
  res.json({ ok: true, message: 'Đã reset key', key: rec });
});

// ═══════════════ API ADMIN: STATS ═══════════════
app.get('/api/admin/stats', requireAdmin, function(req, res){
  const now = Date.now();
  const stats = {
    total: db.keys.length,
    unused: 0,
    active: 0,
    expired: 0,
    banned: 0,
    total_devices: 0
  };

  db.keys.forEach(function(k){
    if (k.expire_at && k.status === 'active' && new Date(k.expire_at).getTime() < now) {
      k.status = 'expired';
    }
    if (stats[k.status] !== undefined) stats[k.status]++;
    stats.total_devices += (k.devices || []).length;
  });
  saveDB();

  res.json({ ok: true, stats: stats });
});

// ═══════════════ AUTO SCAN EXPIRED ═══════════════
setInterval(function(){
  let changed = 0;
  const now = Date.now();
  db.keys.forEach(function(k){
    if (k.status === 'active' && k.expire_at && new Date(k.expire_at).getTime() < now) {
      k.status = 'expired';
      changed++;
      console.log('⏰ Expired: ' + k.key);
    }
  });
  if (changed > 0) saveDB();
}, 60000);

// ═══════════════ START ═══════════════
loadDB();

app.listen(PORT, function(){
  console.log('');
  console.log('╔═══════════════════════════════════╗');
  console.log('║   🔓 UN LOCK SERVER ĐANG CHẠY    ║');
  console.log('╠═══════════════════════════════════╣');
  console.log('║  Port: ' + String(PORT).padEnd(26) + '║');
  console.log('║  Keys: ' + String(db.keys.length).padEnd(26) + '║');
  console.log('║  Token: ' + String(ADMIN_TOKEN).substring(0, 20).padEnd(25) + '║');
  console.log('╚═══════════════════════════════════╝');
  console.log('');
});
