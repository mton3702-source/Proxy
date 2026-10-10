const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'keys.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'UNLOCK_ADMIN_2026';
const KEY_PREFIX = 'PTROT';
const KEY_LENGTH = 12;

// === CẤU HÌNH AIM & DNS MẶC ĐỊNH ===
const DEFAULT_AIM = {
  enabled: true,
  version: "2.0",
  aim_strength: 85,
  aim_smooth: 15,
  aim_distance: 100,
  aim_part: "head",
  aim_auto_fire: false,
  aim_delay_ms: 50,
  fov: 60,
  max_distance: 150,
  bone_head: true,
  bone_chest: false,
  bone_hips: false,
  visible_check: true,
  smooth_mode: "exponential",
  sensitivity_x: 1.2,
  sensitivity_y: 1.1,
  aim_lock_on_shoot: true,
  aim_release_on_enemy_lost: false,
  prediction_factor: 0.25,
  fps_mode: "120",
  auto_update: true
};

const DEFAULT_DNS = {
  name: "UN LOCK — Garena FF",
  primary_dns: "185.228.168.168",
  secondary_dns: "1.1.1.1",
  garena_api_url: "https://ms.garena.com",
  custom_url: "",
  encryption: "AES-256",
  auto_connect: false
};

let db = { 
  version: '1.1', 
  updated_at: new Date().toISOString(), 
  keys: [],
  global_settings: {
    aim: DEFAULT_AIM,
    dns: DEFAULT_DNS
  }
};

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (!db.global_settings) {
        db.global_settings = { aim: DEFAULT_AIM, dns: DEFAULT_DNS };
      }
      console.log('✅ Loaded ' + db.keys.length + ' keys');
    } else {
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
  } catch (e) { console.error('❌ Load DB error:', e.message); }
}

function saveDB() {
  try {
    db.updated_at = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (e) { console.error('❌ Save DB error:', e.message); }
}

function createKey(key, days, maxDev) {
  return {
    key: key.toUpperCase(),
    device_id: null, device_name: null,
    activated_at: null, expire_at: null,
    duration_days: days, status: 'unused',
    max_devices: maxDev || 1,
    devices: [], note: '',
    created_at: new Date().toISOString(),
    aim_override: null,
    dns_override: null
  };
}

function genKey() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 7; i++) s += c[Math.floor(Math.random() * c.length)];
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
  return db.keys.find(function(i){ return i.key === u; });
}

// === API HEALTH ===
app.get('/api/health', function(req, res){
  res.json({
    ok: true, service: 'UN LOCK API',
    version: db.version, total_keys: db.keys.length,
    uptime: process.uptime(), timestamp: new Date().toISOString()
  });
});

// === API LẤY CẤU HÌNH AIM & DNS ===
app.get('/api/config', function(req, res){
  res.json({
    ok: true,
    global_aim: db.global_settings.aim,
    global_dns: db.global_settings.dns
  });
});

// === API XÁC MINH KEY ===
app.post('/api/verify', function(req, res){
  const b = req.body || {};
  if (!b.key || !b.device_id) return res.status(400).json({ ok:false, code:'MISSING_PARAMS', message:'Thiếu key hoặc device_id' });
  if (!validFmt(b.key)) return res.status(400).json({ ok:false, code:'INVALID_FORMAT', message:'Key sai định dạng' });

  const r = findKey(b.key);
  if (!r) return res.status(404).json({ ok:false, code:'KEY_NOT_FOUND', message:'Key không tồn tại' });
  if (r.status === 'banned') return res.status(403).json({ ok:false, code:'KEY_BANNED', message:'Key đã bị khóa' });
  if (r.status === 'expired' || (r.expire_at && new Date(r.expire_at) < new Date())) {
    r.status = 'expired'; saveDB();
    return res.status(403).json({ ok:false, code:'KEY_EXPIRED', message:'Key đã hết hạn' });
  }

  let existDev = null;
  for (let i = 0; i < r.devices.length; i++) {
    if (r.devices[i].device_id === b.device_id) { existDev = r.devices[i]; break; }
  }

  if (r.devices.length > 0 && !existDev && r.devices.length >= r.max_devices) {
    return res.status(403).json({ ok:false, code:'DEVICE_LIMIT', message:'Key đã đạt giới hạn thiết bị' });
  }

  let isNew = false;
  if (!existDev) {
    const now = new Date();
    let expAt;
    if (r.expire_at) { expAt = new Date(r.expire_at); }
    else {
      expAt = new Date(now.getTime() + r.duration_days * 86400000);
      r.activated_at = now.toISOString();
      r.expire_at = expAt.toISOString();
      r.device_id = b.device_id;
      r.device_name = b.device_name || 'Thiết bị';
      isNew = true;
    }
    r.devices.push({ device_id: b.device_id, device_name: b.device_name || 'Thiết bị', activated_at: now.toISOString() });
    r.status = 'active';
    saveDB();
    console.log('🔓 Activated: ' + r.key);
  }

  const expTime = new Date(r.expire_at).getTime();
  const daysLeft = Math.max(0, Math.ceil((expTime - Date.now()) / 86400000));

  // Kết hợp cấu hình AIM/DNS
  const finalAim = r.aim_override ? { ...DEFAULT_AIM, ...r.aim_override } : db.global_settings.aim;
  const finalDns = r.dns_override ? { ...DEFAULT_DNS, ...r.dns_override } : db.global_settings.dns;

  res.json({
    ok: true, code: isNew ? 'ACTIVATED' : 'ALREADY_ACTIVE',
    message: isNew ? 'Kích hoạt thành công' : 'Key đang hoạt động',
    data: {
      key: r.key, status: r.status, duration_days: r.duration_days,
      activated_at: r.activated_at, expire_at: r.expire_at,
      days_left: daysLeft, max_devices: r.max_devices, device_count: r.devices.length,
      aim_settings: finalAim,
      dns_config: finalDns
    }
  });
});

// === API ĐĂNG XUẤT ===
app.post('/api/logout', function(req, res){
  const b = req.body || {};
  if (!b.key || !b.device_id) return res.status(400).json({ ok:false, message:'Thiếu tham số' });
  const r = findKey(b.key);
  if (!r) return res.status(404).json({ ok:false, message:'Key không tồn tại' });
  const before = r.devices.length;
  r.devices = r.devices.filter(function(d){ return d.device_id !== b.device_id; });
  if (r.devices.length === 0) {
    r.status = 'unused'; r.device_id = null; r.device_name = null;
    r.activated_at = null; r.expire_at = null;
  }
  saveDB();
  res.json({ ok: true, message: 'Đăng xuất thành công', removed: before - r.devices.length });
});

// === ADMIN MIDDLEWARE ===
function requireAdmin(req, res, next) {
  const t = req.headers['x-admin-token'] || req.query.token;
  if (t !== ADMIN_TOKEN) return res.status(401).json({ ok:false, message:'Token admin không hợp lệ' });
  next();
}

// === ADMIN: Lấy tất cả keys ===
app.get('/api/admin/keys', requireAdmin, function(req, res){
  const now = Date.now();
  db.keys.forEach(function(k){
    if (k.status === 'active' && k.expire_at && new Date(k.expire_at).getTime() < now) k.status = 'expired';
  });
  saveDB();
  res.json({ ok: true, total: db.keys.length, keys: db.keys });
});

// === ADMIN: Tạo key mới ===
app.post('/api/admin/keys', requireAdmin, function(req, res){
  const b = req.body || {};
  const duration = parseInt(b.duration_days) || 7;
  const maxDev = parseInt(b.max_devices) || 1;
  let newKey = b.key ? b.key.toUpperCase().trim() : genKey();
  if (!validFmt(newKey)) return res.status(400).json({ ok:false, message:'Key sai định dạng' });
  if (findKey(newKey)) return res.status(409).json({ ok:false, message:'Key đã tồn tại' });
  const rec = createKey(newKey, duration, maxDev);
  rec.note = b.note || '';
  db.keys.push(rec); saveDB();
  console.log('➕ Created: ' + newKey);
  res.json({ ok: true, message: 'Đã tạo key', key: rec });
});

// === ADMIN: Tạo nhiều key ===
app.post('/api/admin/keys/bulk', requireAdmin, function(req, res){
  const b = req.body || {};
  const count = parseInt(b.count) || 10;
  const duration = parseInt(b.duration_days) || 7;
  const maxDev = parseInt(b.max_devices) || 1;
  const created = [];
  for (let i = 0; i < count; i++) {
    let nk, a = 0;
    do { nk = genKey(); a++; } while (findKey(nk) && a < 100);
    if (findKey(nk)) continue;
    db.keys.push(createKey(nk, duration, maxDev));
    created.push(nk);
  }
  saveDB();
  res.json({ ok: true, message: 'Đã tạo ' + created.length + ' keys', keys: created });
});

// === ADMIN: Xóa key ===
app.delete('/api/admin/keys/:key', requireAdmin, function(req, res){
  const key = req.params.key.toUpperCase();
  const before = db.keys.length;
  db.keys = db.keys.filter(function(k){ return k.key !== key; });
  if (db.keys.length === before) return res.status(404).json({ ok:false, message:'Key không tồn tại' });
  saveDB();
  res.json({ ok: true, message: 'Đã xóa key' });
});

// === ADMIN: Cập nhật trạng thái ===
app.patch('/api/admin/keys/:key/status', requireAdmin, function(req, res){
  const key = req.params.key.toUpperCase();
  const status = (req.body || {}).status;
  if (['unused','active','expired','banned'].indexOf(status) === -1)
    return res.status(400).json({ ok:false, message:'Status không hợp lệ' });
  const r = findKey(key);
  if (!r) return res.status(404).json({ ok:false, message:'Key không tồn tại' });
  r.status = status;
  if (status === 'unused') {
    r.devices = []; r.device_id = null; r.device_name = null;
    r.activated_at = null; r.expire_at = null;
  }
  saveDB();
  res.json({ ok: true, message: 'Đã cập nhật', key: r });
});

// === ADMIN: Gia hạn ===
app.patch('/api/admin/keys/:key/extend', requireAdmin, function(req, res){
  const key = req.params.key.toUpperCase();
  const days = parseInt((req.body || {}).days) || 7;
  const r = findKey(key);
  if (!r) return res.status(404).json({ ok:false, message:'Key không tồn tại' });
  const base = r.expire_at ? new Date(r.expire_at).getTime() : Date.now();
  r.expire_at = new Date(base + days * 86400000).toISOString();
  r.duration_days = (r.duration_days || 0) + days;
  r.status = 'active';
  saveDB();
  res.json({ ok: true, message: 'Đã gia hạn ' + days + ' ngày', key: r });
});

// === ADMIN: Reset key ===
app.patch('/api/admin/keys/:key/reset', requireAdmin, function(req, res){
  const key = req.params.key.toUpperCase();
  const r = findKey(key);
  if (!r) return res.status(404).json({ ok:false, message:'Key không tồn tại' });
  r.devices = []; r.device_id = null; r.device_name = null;
  r.activated_at = null; r.expire_at = null; r.status = 'unused';
  saveDB();
  res.json({ ok: true, message: 'Đã reset key', key: r });
});

// === ADMIN: Thống kê ===
app.get('/api/admin/stats', requireAdmin, function(req, res){
  const stats = { total: db.keys.length, unused: 0, active: 0, expired: 0, banned: 0, total_devices: 0 };
  const now = Date.now();
  db.keys.forEach(function(k){
    if (k.expire_at && k.status === 'active' && new Date(k.expire_at).getTime() < now) k.status = 'expired';
    if (stats[k.status] !== undefined) stats[k.status]++;
    stats.total_devices += (k.devices || []).length;
  });
  saveDB();
  res.json({ ok: true, stats: stats });
});

// === ADMIN: CẬP NHẬT CẤU HÌNH AIM/DNS TOÀN CỤ ===
app.patch('/api/admin/config/aim', requireAdmin, function(req, res){
  db.global_settings.aim = { ...DEFAULT_AIM, ...req.body };
  saveDB();
  res.json({ ok: true, message: 'Đã cập nhật AIM toàn hệ thống', aim: db.global_settings.aim });
});

app.patch('/api/admin/config/dns', requireAdmin, function(req, res){
  db.global_settings.dns = { ...DEFAULT_DNS, ...req.body };
  saveDB();
  res.json({ ok: true, message: 'Đã cập nhật DNS toàn hệ thống', dns: db.global_settings.dns });
});

// === ADMIN: Ghi đè AIM/DNS cho key riêng ===
app.patch('/api/admin/keys/:key/aim', requireAdmin, function(req, res){
  const r = findKey(req.params.key.toUpperCase());
  if (!r) return res.status(404).json({ ok:false, message:'Key không tồn tại' });
  r.aim_override = req.body;
  saveDB();
  res.json({ ok: true, message: 'Đã đặt AIM riêng cho key', key: r });
});

app.patch('/api/admin/keys/:key/dns', requireAdmin, function(req, res){
  const r = findKey(req.params.key.toUpperCase());
  if (!r) return res.status(404).json({ ok:false, message:'Key không tồn tại' });
  r.dns_override = req.body;
  saveDB();
  res.json({ ok: true, message: 'Đã đặt DNS riêng cho key', key: r });
});

// Tự động kiểm tra key hết hạn mỗi phút
setInterval(function(){
  let changed = 0;
  const now = Date.now();
  db.keys.forEach(function(k){
    if (k.status === 'active' && k.expire_at && new Date(k.expire_at).getTime() < now) {
      k.status = 'expired'; changed++;
    }
  });
  if (changed > 0) saveDB();
}, 60000);

loadDB();

app.listen(PORT, function(){
  console.log('');
  console.log('╔═══════════════════════════════════╗');
  console.log('║   🔓 UN LOCK SERVER ĐANG CHẠY    ║');
  console.log('╠═══════════════════════════════════╣');
  console.log('║  Port: ' + String(PORT).padEnd(26) + '║');
  console.log('║  Keys: ' + String(db.keys.length).padEnd(26) + '║');
  console.log('║  AIM & DNS: Đã kích hoạt         ║');
  console.log('╚═══════════════════════════════════╝');
  console.log('');
});
