const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const KEY_TTL_MS = 14 * 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json());

// ================= DATABASE KEY =================
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

// ================= API =================
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

// ================= GIAO DIỆN HTML FULL =================
const HTML_UI = `
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
<title>TITAN APP PRO</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #050b10; --glass: rgba(14, 38, 48, 0.65); --glass-border: rgba(0, 229, 255, 0.2);
  --primary: #00e5ff; --secondary: #1e90ff; --text: #e6f7ff; --muted: #7fa8b5;
  --danger: #ff4757; --success: #2ed573;
}
* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; -webkit-tap-highlight-color: transparent; }
html, body { width: 100%; height: 100%; overflow: hidden; background: var(--bg); color: var(--text); }
.bg-anim { position: fixed; inset: 0; z-index: -1; background: radial-gradient(circle at 50% 0%, #0e3b4a 0%, #050b10 70%); }
.bg-anim::before, .bg-anim::after { content: ''; position: absolute; width: 300px; height: 300px; border-radius: 50%; background: var(--primary); filter: blur(100px); opacity: 0.15; animation: float 8s infinite alternate; }
.bg-anim::before { top: -10%; left: -10%; }
.bg-anim::after { bottom: -10%; right: -10%; background: var(--secondary); animation-delay: -4s; }
@keyframes float { 100% { transform: translate(50px, 50px); } }

.screen { display: none; position: fixed; inset: 0; padding: 20px; overflow-y: auto; z-index: 10; }
.screen.active { display: flex; flex-direction: column; animation: fade 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

.glass { background: var(--glass); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--glass-border); border-radius: 20px; padding: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }

/* SPLASH */
#splash { justify-content: center; align-items: center; text-align: center; }
.logo-text { font-size: 64px; font-weight: 900; letter-spacing: 8px; background: linear-gradient(135deg, #fff, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 15px rgba(0, 229, 255, 0.5)); }
.sub-text { font-size: 16px; font-weight: 600; letter-spacing: 6px; color: var(--primary); margin-bottom: 30px; }
.slider-box { width: 100%; max-width: 300px; }
input[type=range] { -webkit-appearance: none; width: 100%; height: 6px; border-radius: 6px; background: rgba(255,255,255,0.1); outline: none; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: #fff; border: 3px solid var(--primary); box-shadow: -300px 0 0 290px var(--primary); cursor: pointer; }
.percent { font-size: 28px; font-weight: 800; color: var(--primary); margin-top: 15px; }
.status { font-size: 12px; color: var(--muted); margin-top: 5px; }

/* KEY */
#keyScreen { justify-content: center; align-items: center; }
.key-wrap { width: 100%; max-width: 340px; text-align: center; }
.key-icon { font-size: 40px; margin-bottom: 10px; }
.key-title { font-size: 20px; font-weight: 800; margin-bottom: 20px; }
.input-key { width: 100%; padding: 16px; border-radius: 12px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.3); color: var(--text); font-size: 18px; text-align: center; letter-spacing: 3px; text-transform: uppercase; outline: none; margin-bottom: 15px; transition: 0.3s; }
.input-key:focus { border-color: var(--primary); box-shadow: 0 0 15px rgba(0,229,255,0.2); }
.btn-main { width: 100%; padding: 16px; border-radius: 12px; border: none; background: linear-gradient(135deg, var(--primary), var(--secondary)); color: #000; font-size: 16px; font-weight: 800; cursor: pointer; transition: 0.2s; }
.btn-main:active { transform: scale(0.96); }
.msg { font-size: 13px; font-weight: 600; margin-top: 12px; min-height: 20px; color: var(--danger); }
.msg.ok { color: var(--success); }

/* APP */
#appScreen { padding: 0; display: none; }
#appScreen.active { display: block; }
.topbar { position: sticky; top: 0; z-index: 50; background: rgba(5,11,16,0.8); backdrop-filter: blur(10px); display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid var(--glass-border); }
.brand { font-size: 18px; font-weight: 900; letter-spacing: 1px; background: linear-gradient(90deg, var(--primary), var(--secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.timer { font-size: 11px; font-weight: 600; color: var(--primary); background: rgba(0,229,255,0.1); padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(0,229,255,0.3); }
.tabs { display: flex; gap: 8px; padding: 15px 20px; overflow-x: auto; position: sticky; top: 61px; background: var(--bg); z-index: 40; }
.tab { flex: 0 0 auto; padding: 10px 16px; border-radius: 10px; background: rgba(255,255,255,0.05); color: var(--muted); font-size: 13px; font-weight: 600; border: 1px solid transparent; cursor: pointer; transition: 0.2s; }
.tab.active { background: rgba(0,229,255,0.15); color: var(--primary); border-color: var(--primary); }
.content { padding: 0 20px 80px 20px; }
.page { display: none; }
.page.active { display: block; animation: fade 0.3s; }
.card { background: var(--glass); border: 1px solid var(--glass-border); border-radius: 16px; padding: 18px; margin-bottom: 15px; }
.lbl { display: block; font-size: 13px; font-weight: 600; color: var(--primary); margin-bottom: 10px; }
.select-box, .file-box { width: 100%; padding: 14px; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: var(--text); font-size: 14px; outline: none; }
.log { background: #020507; border-radius: 10px; padding: 12px; font-family: monospace; font-size: 12px; color: var(--success); max-height: 150px; overflow-y: auto; white-space: pre-wrap; margin-top: 10px; border: 1px solid rgba(46,213,115,0.2); }
.btn-inject { width: 100%; padding: 18px; border-radius: 16px; border: none; background: linear-gradient(135deg, var(--danger), #ff6b81); color: #fff; font-size: 18px; font-weight: 900; cursor: pointer; box-shadow: 0 8px 20px rgba(255,71,87,0.3); margin-bottom: 20px; }
.btn-inject:active { transform: scale(0.97); }
.chk-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; font-size: 14px; color: var(--text); }
.chk-row input { width: 20px; height: 20px; accent-color: var(--primary); }
.overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 100; align-items: center; justify-content: center; padding: 20px; }
.overlay.show { display: flex; }
.term { width: 100%; max-width: 400px; background: #000; border: 1px solid var(--primary); border-radius: 16px; padding: 20px; box-shadow: 0 0 30px rgba(0,229,255,0.2); }
.term h3 { color: var(--primary); font-size: 14px; margin-bottom: 10px; letter-spacing: 2px; }
.term pre { font-family: monospace; font-size: 12px; color: var(--success); line-height: 1.5; }
</style>
</head>
<body>
<div class="bg-anim"></div>

<!-- SPLASH -->
<div id="splash" class="screen active">
  <div class="logo-text">TITAN</div>
  <div class="sub-text">PRO INJECTOR</div>
  <div class="slider-box">
    <input type="range" id="bootSlider" min="1" max="100" value="1"/>
    <div class="percent"><span id="bootVal">1</span>%</div>
    <div class="status" id="bootStatus">Đang khởi động...</div>
  </div>
</div>

<!-- KEY -->
<div id="keyScreen" class="screen">
  <div class="key-wrap glass">
    <div class="key-icon">🔑</div>
    <div class="key-title">NHẬP KEY KÍCH HOẠT</div>
    <input id="keyInput" class="input-key" maxlength="20" placeholder="TITAN-XXXX-XXXX" autocomplete="off"/>
    <button id="keyBtn" class="btn-main">XÁC THỰC NGAY</button>
    <div id="keyMsg" class="msg"></div>
    <div style="font-size:11px; color:var(--muted); margin-top:15px;">Hạn 14 ngày • Khóa cứng thiết bị</div>
  </div>
</div>

<!-- APP -->
<div id="appScreen" class="screen">
  <div class="topbar">
    <div class="brand">TITAN PRO</div>
    <div class="timer" id="timer">--d --h</div>
  </div>
  <div class="tabs">
    <button class="tab active" data-tab="1">Trang App</button>
    <button class="tab" data-tab="2">Chức Năng</button>
    <button class="tab" data-tab="3">Hỗ Trợ</button>
    <button class="tab" data-tab="4">Cài Đặt</button>
  </div>
  <div class="content">
    <!-- TAB 1 -->
    <div class="page active" id="page-1">
      <div class="card">
        <label class="lbl">📁 TẢI FILE TỪ THIẾT BỊ</label>
        <input type="file" id="filePicker" class="file-box" accept=".cpp,.py,.lua,.yaml,.yml,.java,.luapage,.min,.nix,.pig,.pl,.prolog,.js,.html,.css"/>
        <div id="fileName" style="font-size:12px; color:var(--primary); margin-top:8px;">Chưa chọn tệp</div>
        <div id="fileLog" class="log">Đang chờ file...</div>
      </div>
      <div class="card">
        <label class="lbl">⚙️ HỆ THỐNG ENGINE (11 Ngôn Ngữ)</label>
        <div id="engineList" style="display:flex; flex-wrap:wrap; gap:5px; font-size:11px;"></div>
      </div>
      <button id="injectBtn" class="btn-inject">⚡ INJECT GAME</button>
    </div>

    <!-- TAB 2 -->
    <div class="page" id="page-2">
      <div class="card">
        <label class="lbl">🎯 TỐC ĐỘ NHẠY MÁY: <span id="vSens">1.0x</span></label>
        <input type="range" id="sens" min="0.1" max="3" step="0.1" value="1"/>
      </div>
      <div class="card">
        <label class="lbl">📺 ĐỘ PHÂN GIẢI</label>
        <select id="res" class="select-box">
          <option value="1280x720">HD 1280x720</option>
          <option value="1920x1080" selected>FHD 1920x1080</option>
          <option value="2560x1440">QHD 2560x1440</option>
          <option value="3840x2160">4K 3840x2160</option>
        </select>
      </div>
      <div class="card">
        <label class="lbl">⚡ TỐC ĐỘ CHẠY FILE: <span id="vSpeed">1.0x</span></label>
        <input type="range" id="speed" min="0.1" max="3" step="0.1" value="1"/>
      </div>
      <div class="card">
        <label class="lbl">🛠 CHỌN MODE (1 Đơn Nhất)</label>
        <label class="chk-row"><input type="checkbox" id="modeLight"/> Nhẹ - Tăng nhạy +69% vuốt</label>
        <label class="chk-row"><input type="checkbox" id="modeTune"/> Tinh chỉnh - Đầm nhạy, bám cao</label>
        <label class="chk-row"><input type="checkbox" id="modePrecise"/> Chính xác - Tuyệt đối, không giảm</label>
      </div>
      <div class="card">
        <div id="paramsLog" class="log">Chưa lưu params...</div>
      </div>
    </div>

    <!-- TAB 3 -->
    <div class="page" id="page-3">
      <div class="card">
        <label class="lbl">🎮 CHỌN GAME HỖ TRỢ</label>
        <select id="gameSel" class="select-box">
          <option value="">-- Chọn game --</option>
          <option value="com.garena.game.kgvn">Liên Quân Mobile (FFVN)</option>
          <option value="com.vng.pubgmobile">PUBG Mobile VN</option>
          <option value="com.mobile.legends">Mobile Legends</option>
        </select>
        <div id="gameList" style="margin-top:15px; display:flex; flex-direction:column; gap:8px;"></div>
      </div>
    </div>

    <!-- TAB 4 -->
    <div class="page" id="page-4">
      <div class="card">
        <label class="lbl">📱 THÔNG TIN THIẾT BỊ</label>
        <pre id="devInfo" class="log" style="color:var(--text);">Đang tải...</pre>
      </div>
      <div class="card">
        <label class="lbl">⏱ THỜI GIAN SỬ DỤNG</label>
        <div id="usageTime" class="log" style="color:var(--text);">--</div>
      </div>
      <button id="restartBtn" class="btn-main" style="background:linear-gradient(135deg,#ff4757,#ff6b81); color:#fff;">🔄 KHỞI CHẠY LẠI APP</button>
    </div>
  </div>

  <!-- INJECT OVERLAY -->
  <div id="injectScreen" class="overlay">
    <div class="term">
      <h3>⚡ INJECTING...</h3>
      <pre id="injectConsole"></pre>
    </div>
  </div>
</div>

<script>
// ================= STATE & CORE =================
const state = { key: null, expiresAt: null, params: { sens: 1, res: '1920x1080', speed: 1 } };

function goToScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

// SPLASH
document.getElementById('bootSlider').addEventListener('input', function() {
  document.getElementById('bootVal').textContent = this.value;
  document.getElementById('bootStatus').textContent = this.value < 100 ? 'Đang nạp module...' : '✅ Sẵn sàng!';
  if (this.value == 100) setTimeout(() => goToScreen('keyScreen'), 600);
});

// KEY AUTH
document.getElementById('keyBtn').addEventListener('click', async () => {
  const k = document.getElementById('keyInput').value.trim().toUpperCase();
  const msg = document.getElementById('keyMsg');
  const btn = document.getElementById('keyBtn');
  if (k.length < 12) { msg.textContent = '❌ Key không hợp lệ'; return; }
  
  btn.disabled = true; btn.textContent = 'ĐANG XÁC THỰC...';
  msg.className = 'msg'; msg.textContent = '';

  try {
    const res = await fetch('/api/verify-key', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k })
    });
    const data = await res.json();
    
    if (data.ok) {
      msg.className = 'msg ok'; msg.textContent = '✅ ' + data.message;
      localStorage.setItem('titan_key', k);
      localStorage.setItem('titan_exp', data.expiresAt);
      state.key = k; state.expiresAt = data.expiresAt;
      setTimeout(() => { goToScreen('appScreen'); initApp(); }, 800);
    } else {
      msg.textContent = '❌ ' + data.message; btn.disabled = false; btn.textContent = 'XÁC THỰC NGAY';
    }
  } catch (e) {
    msg.textContent = '❌ Lỗi kết nối server'; btn.disabled = false; btn.textContent = 'XÁC THỰC NGAY';
  }
});

// INIT APP & TIMER
function initApp() {
  // Render Engines
  const engines = ['C++', 'Python', 'Lua', 'YAML', 'Java', 'LuaPage', 'Min', 'Nix', 'Pig', 'Prolog'];
  document.getElementById('engineList').innerHTML = engines.map(e => `<span style="background:rgba(0,229,255,0.1); padding:4px 8px; border-radius:6px; color:var(--primary); border:1px solid rgba(0,229,255,0.2);">✓ ${e}</span>`).join('');
  
  // Render Device Info
  fetch('/api/device-info').then(r => r.json()).then(d => {
    document.getElementById('devInfo').textContent = `Platform : ${d.platform}\nCPU Cores: ${d.cpus}\nRAM Total: ${(d.totalmem/1073741824).toFixed(1)} GB\nNode Ver : ${d.nodeVersion}\nServer   : ${new Date(d.serverTime).toLocaleString()}`;
  });
  
  // Usage Time
  const firstOpen = localStorage.getItem('titan_first') || Date.now().toString();
  localStorage.setItem('titan_first', firstOpen);
  const diff = Math.floor((Date.now() - firstOpen) / 60000);
  document.getElementById('usageTime').textContent = `Lần đầu mở: ${new Date(parseInt(firstOpen)).toLocaleString()}\nTổng thời gian: ${diff} phút`;

  // Timer Countdown
  setInterval(() => {
    if (!state.expiresAt) return;
    const ms = new Date(state.expiresAt).getTime() - Date.now();
    if (ms <= 0) { alert('Key hết hạn!'); localStorage.clear(); location.reload(); return; }
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    document.getElementById('timer').textContent = `${d}d ${h}h`;
  }, 1000);
}

// AUTO LOGIN
(function() {
  const k = localStorage.getItem('titan_key');
  const exp = localStorage.getItem('titan_exp');
  if (k && exp && Date.now() < new Date(exp).getTime()) {
    state.key = k; state.expiresAt = exp;
    goToScreen('appScreen'); initApp();
  }
})();

// TABS
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('page-' + t.dataset.tab).classList.add('active');
  });
});

// TAB 1: READ FILE
document.getElementById('filePicker').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  document.getElementById('fileName').textContent = '📄 ' + f.name;
  const text = await f.text();
  document.getElementById('fileLog').textContent = text.substring(0, 800) + '\n... (đã tải)';
});

// TAB 1: INJECT
document.getElementById('injectBtn').addEventListener('click', () => {
  const overlay = document.getElementById('injectScreen');
  const term = document.getElementById('injectConsole');
  overlay.classList.add('show'); term.textContent = '';
  
  const logs = [
    '[*] Đang khởi tạo module...',
    '[*] Decrypting libtitan.so...',
    '[*] Bypassing anti-cheat (Bypass OK)',
    '[*] Patching memory offsets...',
    '[*] Áp dụng Mode: ' + (state.params.mode || 'None'),
    '[*] Tối ưu hóa FPS & Touch...',
    '[+] Inject thành công vào FFVN!'
  ];
  
  let i = 0;
  const interval = setInterval(() => {
    if (i < logs.length) { term.textContent += logs[i] + '\n'; i++; }
    else {
      clearInterval(interval);
      setTimeout(() => { overlay.classList.remove('show'); alert('Đã tối ưu và khởi chạy FFVN!'); }, 800);
    }
  }, 400);
});

// TAB 2: PARAMS
function updateParam(id, val) {
  if (id === 'sens') { document.getElementById('vSens').textContent = val + 'x'; state.params.sens = val; }
  if (id === 'speed') { document.getElementById('vSpeed').textContent = val + 'x'; state.params.speed = val; }
  document.getElementById('paramsLog').textContent = `✅ Đã lưu: Sens(${state.params.sens}x) | Res(${state.params.res}) | Speed(${state.params.speed}x) | Mode(${state.params.mode || 'None'})`;
}
document.getElementById('sens').addEventListener('input', function() { updateParam('sens', this.value); });
document.getElementById('speed').addEventListener('input', function() { updateParam('speed', this.value); });
document.getElementById('res').addEventListener('change', function() { state.params.res = this.value; updateParam('res', this.value); });

['modeLight', 'modeTune', 'modePrecise'].forEach(id => {
  document.getElementById(id).addEventListener('change', function() {
    if (this.checked) {
      ['modeLight', 'modeTune', 'modePrecise'].forEach(x => { if (x !== id) document.getElementById(x).checked = false; });
      state.params.mode = id === 'modeLight' ? 'Nhẹ' : id === 'modeTune' ? 'Tinh chỉnh' : 'Chính xác';
    } else { state.params.mode = 'None'; }
    updateParam(id, null);
  });
});

// TAB 3: GAMES
const games = {
  'com.garena.game.kgvn': ['FPS Boost (+30%)', 'Touch Sensitivity (+69%)', 'Anti-Lag Buffer', 'Aim Assist Pro'],
  'com.vng.pubgmobile': ['Gyro Tuning', 'Recoil Control', 'Graphics Smooth', 'Memory Cleaner'],
  'com.mobile.legends': ['Skill Cast Speed', 'Map Awareness Pro', 'Ping Optimizer']
};
document.getElementById('gameSel').addEventListener('change', function() {
  const list = games[this.value] || [];
  document.getElementById('gameList').innerHTML = list.map(item => 
    `<label class="chk-row" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;"><input type="checkbox" checked/> ${item}</label>`
  ).join('');
});

// TAB 4: RESTART
document.getElementById('restartBtn').addEventListener('click', () => {
  if (confirm('Xóa toàn bộ dữ liệu và khởi chạy lại?')) { localStorage.clear(); location.reload(); }
});
</script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(HTML_UI));
app.get('/index.html', (req, res) => res.send(HTML_UI));

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server TITAN chạy tại cổng ' + PORT);
});
