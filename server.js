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
  if (found.used && found.deviceId !== deviceId) return res.status(403).json({ ok: false, message: 'Key đã khóa cho thiết bị khác' });
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

app.post('/api/run-file', (req, res) => {
  const { filename, content } = req.body || {};
  return res.json({ ok: true, engine: filename.split('.').pop(), status: 'loaded', log: 'Loaded ' + (content ? content.length : 0) + ' bytes' });
});

app.post('/api/inject-game', (req, res) => {
  const { pkg, params } = req.body || {};
  const steps = [
    '[INJECT] Target: ' + (pkg || 'com.garena.game.kgvn'),
    '[INJECT] Decrypting module 0x7F3A...',
    '[INJECT] Bypass anti-cheat... OK',
    '[INJECT] Patch speed x' + (params ? params.speed : 1.0),
    '[INJECT] Resolution ' + (params ? params.res : '1920x1080'),
    '[INJECT] Sensitivity +' + (params ? params.sens : 69) + '%',
    '[INJECT] DONE'
  ];
  return res.json({ ok: true, steps: steps, pkg: pkg });
});

app.get('/api/device-info', (req, res) => {
  res.json({ ok: true, platform: process.platform, arch: process.arch, hostname: os.hostname(), cpus: os.cpus().length, totalmem: os.totalmem(), freemem: os.freemem(), uptime: process.uptime(), nodeVersion: process.version, serverTime: new Date().toISOString() });
});

// ================= GIAO DIỆN HTML =================
// Sử dụng chuỗi mảng (Array Join) để tránh lỗi cú pháp của template string
const HTML_UI = [
  '<!DOCTYPE html>',
  '<html lang="vi">',
  '<head>',
  '<meta charset="UTF-8"/>',
  '<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>',
  '<title>TITAN APP</title>',
  '<style>',
  ':root{--bg:#0b1a22;--bg2:#0f2630;--titan-blue:#1e90ff;--titan-glow:#00e5ff;--txt:#e6f7ff;--muted:#7fa8b5;--danger:#ff4757;--ok:#2ed573;}',
  '*{box-sizing:border-box;margin:0;padding:0;font-family:"Segoe UI",Roboto,sans-serif;-webkit-tap-highlight-color:transparent;}',
  'html,body{width:100%;height:100%;overflow:hidden;}',
  'body{background:radial-gradient(circle at top,#0e3b4a 0%,#071016 80%);color:var(--txt);}',
  '.screen{display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;padding:20px;overflow-y:auto;z-index:1;}',
  '.screen.active{display:flex;flex-direction:column;z-index:10;animation:fadeIn .4s ease;}',
  '@keyframes fadeIn{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)}}',
  '#splash{justify-content:center;align-items:center;text-align:center;gap:24px;}',
  '.splash-logo{font-size:64px;font-weight:900;letter-spacing:8px;background:linear-gradient(90deg,#1e90ff,#00e5ff,#1e90ff);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shine 3s linear infinite;}',
  '@keyframes shine{to{background-position:200% center;}}',
  '.splash-name{font-size:22px;font-weight:700;letter-spacing:4px;color:var(--titan-glow);margin-top:-10px;}',
  '.splash-sub{color:var(--muted);font-size:13px;letter-spacing:2px;}',
  '.splash-progress{width:85%;max-width:420px;margin-top:30px;}',
  '.splash-progress input[type=range]{width:100%;height:10px;border-radius:10px;appearance:none;-webkit-appearance:none;background:linear-gradient(90deg,#1e90ff,#00e5ff);outline:none;box-shadow:0 0 20px #00e5ff55;}',
  '.splash-progress input[type=range]::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 0 16px #00e5ff;cursor:pointer;border:3px solid #00e5ff;}',
  '.splash-percent{margin-top:12px;font-size:28px;font-weight:900;color:var(--titan-glow);text-shadow:0 0 20px #00e5ff;}',
  '.splash-status{margin-top:8px;color:var(--muted);font-size:14px;min-height:20px;}',
  '#keyScreen{justify-content:center;align-items:center;text-align:center;gap:18px;}',
  '.key-logo{font-size:40px;font-weight:900;letter-spacing:6px;background:linear-gradient(90deg,#1e90ff,#00e5ff);-webkit-background-clip:text;background-clip:text;color:transparent;}',
  '.key-title{font-size:18px;color:var(--txt);font-weight:600;margin-top:8px;}',
  '#keyInput{width:85%;max-width:380px;padding:16px;border-radius:14px;border:2px solid #1e90ff55;background:#0e2630;color:var(--txt);font-size:18px;text-align:center;letter-spacing:4px;text-transform:uppercase;outline:none;font-weight:700;}',
  '#keyInput:focus{border-color:#00e5ff;box-shadow:0 0 20px #00e5ff77;}',
  '#keyBtn{width:85%;max-width:380px;padding:16px;border:none;border-radius:14px;background:linear-gradient(135deg,#1e90ff,#00e5ff);color:#001820;font-size:16px;font-weight:900;letter-spacing:2px;cursor:pointer;box-shadow:0 0 22px #00e5ff66;}',
  '#keyBtn:active{transform:scale(.96);}#keyBtn:disabled{opacity:.6;}',
  '#keyMsg{min-height:22px;font-size:14px;color:var(--danger);font-weight:600;padding:0 10px;}',
  '#keyMsg.ok{color:var(--ok);}.key-hint{color:var(--muted);font-size:12px;margin-top:6px;}',
  '#appScreen{padding:0;display:none;}#appScreen.active{display:block;padding:0;}',
  '.topbar{position:sticky;top:0;z-index:50;background:linear-gradient(180deg,#0b1a22 0%,#0b1a22ee 100%);backdrop-filter:blur(10px);display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #1e90ff33;}',
  '.app-name{font-size:20px;font-weight:900;letter-spacing:2px;background:linear-gradient(90deg,#1e90ff,#00e5ff);-webkit-background-clip:text;background-clip:text;color:transparent;}',
  '.session{font-size:11px;color:var(--titan-glow);background:#0e2630;padding:6px 10px;border-radius:20px;border:1px solid #00e5ff44;font-weight:600;}',
  '.tabs{display:flex;gap:6px;padding:12px 16px;overflow-x:auto;background:#0b1a22;position:sticky;top:57px;z-index:40;}',
  '.tab{flex:0 0 auto;min-width:85px;padding:10px 14px;background:#0e2630;color:var(--muted);border:1px solid #1e90ff33;border-radius:10px;font-size:13px;cursor:pointer;white-space:nowrap;}',
  '.tab.active{background:linear-gradient(135deg,#1e90ff,#00e5ff);color:#001820;font-weight:bold;box-shadow:0 0 14px #00e5ff66;}',
  '.tab-pages{padding:16px;padding-top:0;padding-bottom:80px;}',
  '.tab-page{display:none;}.tab-page.active{display:block;animation:fade .3s;}',
  '.card{background:linear-gradient(145deg,#0e2630,#0b1a22);border:1px solid #1e90ff33;border-radius:14px;padding:14px;margin-bottom:12px;}',
  '.lbl{display:block;margin-bottom:8px;color:#bfe9ff;font-size:14px;font-weight:600;}',
  '.filename{margin-top:8px;color:var(--titan-glow);font-size:13px;word-break:break-all;}',
  '.logbox{background:#051015;border:1px solid #1e90ff22;border-radius:10px;padding:10px;font-family:Consolas,monospace;font-size:12px;color:#9ee7ff;max-height:220px;overflow:auto;white-space:pre-wrap;margin-top:8px;}',
  '.inject{width:100%;padding:18px;font-size:18px;font-weight:900;background:linear-gradient(135deg,#ff4757,#ff6b81);color:#fff;border:none;border-radius:14px;cursor:pointer;margin-bottom:16px;}',
  '.btn{padding:14px;border-radius:12px;border:none;font-weight:bold;cursor:pointer;width:100%;font-size:15px;}',
  '.btn.danger{background:linear-gradient(135deg,#ff4757,#ff6b81);color:#fff;}',
  '.inject-overlay{display:none;position:fixed;inset:0;background:#000d;z-index:99;align-items:center;justify-content:center;padding:20px;}',
  '.inject-overlay.show{display:flex;}',
  '.inject-inner{width:100%;max-width:520px;background:#051015;border:1px solid #00e5ff;border-radius:14px;padding:18px;}',
  '.inject-inner h3{color:#00e5ff;margin-bottom:10px;letter-spacing:3px;font-size:16px;}',
  '.inject-inner pre{font-family:Consolas,monospace;font-size:12px;color:#9ee7ff;max-height:340px;overflow:auto;white-space:pre-wrap;}',
  '.modes .chk{display:flex;align-items:center;gap:8px;padding:8px 0;font-size:14px;color:#c7e9f7;}',
  '.chk input{width:18px;height:18px;accent-color:#00e5ff;}',
  '.support-box{margin-top:10px;display:flex;flex-direction:column;gap:8px;}',
  '.support-item{background:#0b1a22;border:1px solid #00e5ff33;border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center;font-size:13px;}',
  '.support-item .tag{color:#00e5ff;font-weight:bold;font-size:11px;}',
  'select,input[type=file]{width:100%;padding:12px;border-radius:10px;background:#0e2630;color:var(--txt);border:1px solid #1e90ff44;font-size:14px;outline:none;}',
  '.engine-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
  '.engine-chip{padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;background:#0e2630;border:1px solid #00e5ff44;color:#9ee7ff;}',
  '</style>',
  '</head>',
  '<body>',
  '<!-- SPLASH -->',
  '<div id="splash" class="screen active">',
  '  <div class="splash-logo">TITAN</div>',
  '  <div class="splash-name">TITAN APP</div>',
  '  <div class="splash-sub">MULTI-ENGINE INJECTOR</div>',
  '  <div class="splash-progress">',
  '    <input type="range" id="bootSlider" min="1" max="100" value="1"/>',
  '    <div class="splash-percent"><span id="bootVal">1</span>%</div>',
  '    <div class="splash-status" id="bootStatus">Kéo thanh trượt để bắt đầu...</div>',
  '  </div>',
  '</div>',
  '<!-- KEY -->',
  '<div id="keyScreen" class="screen">',
  '  <div class="key-logo">TITAN</div>',
  '  <div class="key-title">🔑 Nhập Key để vào App</div>',
  '  <input id="keyInput" maxlength="20" placeholder="TITAN-XXXX-XXXX" autocomplete="off"/>',
  '  <button id="keyBtn">XÁC THỰC</button>',
  '  <div id="keyMsg"></div>',
  '  <div class="key-hint">Key dùng 1 thiết bị • Hạn 14 ngày</div>',
  '</div>',
  '<!-- APP -->',
  '<div id="appScreen" class="screen">',
  '  <header class="topbar">',
  '    <div class="app-name">TITAN APP</div>',
  '    <div class="session" id="session">🔑 —</div>',
  '  </header>',
  '  <nav class="tabs">',
  '    <button class="tab active" data-tab="1">Trang App</button>',
  '    <button class="tab" data-tab="2">Chức Năng</button>',
  '    <button class="tab" data-tab="3">Hỗ Trợ</button>',
  '    <button class="tab" data-tab="4">Cài Đặt</button>',
  '  </nav>',
  '  <div class="tab-pages">',
  '    <section class="tab-page active" id="tab-1">',
  '      <div class="card">',
  '        <label class="lbl">📁 Chọn tệp từ thiết bị</label>',
  '        <input type="file" id="filePicker" accept=".cpp,.py,.lua,.yaml,.yml,.java,.luapage,.min,.nix,.pig,.pl,.prolog,.js,.html,.css"/>',
  '        <div id="fileName" class="filename">Chưa có tệp</div>',
  '        <div id="fileLog" class="logbox">Chọn tệp để xem nội dung...</div>',
  '      </div>',
  '      <div class="card">',
  '        <label class="lbl">🔧 Engine đã nhúng</label>',
  '        <div class="engine-list" id="engineList"></div>',
  '      </div>',
  '      <button id="injectBtn" class="inject">⚡ INJECT GAME</button>',
  '      <div id="injectScreen" class="inject-overlay">',
  '        <div class="inject-inner">',
  '          <h3>⚡ INJECTING...</h3>',
  '          <pre id="injectConsole"></pre>',
  '        </div>',
  '      </div>',
  '    </section>',
  '    <section class="tab-page" id="tab-2">',
  '      <div class="card">',
  '        <label class="lbl">🎯 Tốc độ nhạy máy: <b id="vSens">1.0x</b></label>',
  '        <input type="range" id="sens" min="0.1" max="3" step="0.1" value="1"/>',
  '      </div>',
  '      <div class="card">',
  '        <label class="lbl">📺 Độ phân giải</label>',
  '        <select id="res"><option value="1920x1080" selected>FHD 1920x1080</option><option value="1280x720">HD 1280x720</option></select>',
  '      </div>',
  '      <div class="card">',
  '        <label class="lbl">⚡ Tốc độ chạy của tệp: <b id="vSpeed">1.0x</b></label>',
  '        <input type="range" id="speed" min="0.1" max="3" step="0.1" value="1"/>',
  '      </div>',
  '      <div class="card modes">',
  '        <label class="lbl">🎮 Chọn chức năng</label>',
  '        <label class="chk"><input type="checkbox" id="modeLight"/> Nhẹ +69% vuốt</label>',
  '        <label class="chk"><input type="checkbox" id="modeTune"/> Tinh chỉnh</label>',
  '        <label class="chk"><input type="checkbox" id="modePrecise"/> Chính xác</label>',
  '      </div>',
  '      <div class="card"><div id="paramsLog" class="logbox">Params chưa lưu...</div></div>',
  '    </section>',
  '    <section class="tab-page" id="tab-3">',
  '      <div class="card">',
  '        <label class="lbl">🎮 Chọn game hỗ trợ</label>',
  '        <select id="gameSel"><option value="">-- Chọn --</option><option value="ff">Liên Quân</option></select>',
  '        <div id="gameSupport" class="support-box"><div class="support-item">Chọn game</div></div>',
  '      </div>',
  '    </section>',
  '    <section class="tab-page" id="tab-4">',
  '      <div class="card"><label class="lbl">📱 Thông tin thiết bị</label><pre id="deviceInfo" class="logbox">...</pre></div>',
  '      <div class="card"><label class="lbl">⏱ Thời gian</label><div id="usageTime" class="logbox">—</div></div>',
  '      <div class="card"><label class="lbl">🔑 Key</label><div id="keyInfo" class="logbox">—</div></div>',
  '      <button id="restartBtn" class="btn danger">🔄 KHỞI CHẠY LẠI</button>',
  '    </section>',
  '  </div>',
  '</div>',
  '<script>',
  'const state = { key:null, expiresAt:null };',
  'const ENGINES = ["C++ (.cpp)","Python (.py)","Lua (.lua)","YAML (.yaml)","Java (.java)","LuaPage (.luapage)","Min (.min)","Nix (.nix)","Pig (.pig)","Prolog (.prolog)"];',
  'function goToScreen(id){',
  '  document.querySelectorAll(".screen").forEach(s=>{s.classList.remove("active");s.style.display="none";});',
  '  const t=document.getElementById(id);',
  '  if(t){t.classList.add("active");t.style.display=(id==="appScreen")?"block":"flex";}',
  '}',
  'document.getElementById("bootSlider").addEventListener("input",function(){',
  '  document.getElementById("bootVal").textContent=this.value;',
  '  document.getElementById("bootStatus").textContent=this.value<100?"Đang nạp...":"✅ Hoàn tất!";',
  '  if(this.value==100)setTimeout(()=>goToScreen("keyScreen"),600);',
  '});',
  'document.getElementById("keyBtn").addEventListener("click",async()=>{',
  '  const k=document.getElementById("keyInput").value.trim().toUpperCase();',
  '  const msg=document.getElementById("keyMsg"); const btn=document.getElementById("keyBtn");',
  '  if(k.length<12){msg.textContent="❌ Key quá ngắn";return;}',
  '  btn.disabled=true;msg.textContent="⏳ Đang xác thực...";msg.className="";',
  '  try{',
  '    const r=await fetch("/api/verify-key",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:k})});',
  '    const j=await r.json();',
  '    if(j.ok){',
  '      msg.className="ok";msg.textContent="✅ "+j.message;',
  '      localStorage.setItem("titan_key",k);localStorage.setItem("titan_exp",j.expiresAt);',
  '      setTimeout(()=>{goToScreen("appScreen");startApp();},800);',
  '    }else{msg.textContent="❌ "+j.message;btn.disabled=false;}',
  '  }catch(e){msg.textContent="❌ Lỗi mạng";btn.disabled=false;}',
  '});',
  'document.getElementById("keyInput").addEventListener("keypress",e=>{if(e.key==="Enter")document.getElementById("keyBtn").click();});',
  'function startApp(){',
  '  document.getElementById("engineList").innerHTML=ENGINES.map(e=>`<span class="engine-chip">✅ ${e}</span>`).join("");',
  '  fetch("/api/device-info").then(r=>r.json()).then(j=>{',
  '    document.getElementById("deviceInfo").textContent=`OS: ${j.platform}\\nCPU: ${j.cpus}\\nRAM: ${(j.totalmem/1073741824).toFixed(1)}GB`;',
  '  });',
  '  document.getElementById("usageTime").textContent="Bắt đầu: "+new Date().toLocaleString();',
  '  document.getElementById("keyInfo").textContent="Key: "+localStorage.getItem("titan_key");',
  '  setInterval(()=>{',
  '    const ms=new Date(localStorage.getItem("titan_exp")).getTime()-Date.now();',
  '    if(ms<=0){alert("Hết hạn");localStorage.clear();location.reload();return;}',
  '    document.getElementById("session").textContent=`🔑 ${Math.floor(ms/86400000)}d ${Math.floor(ms%86400000/3600000)}h`;',
  '  },30000);',
  '}',
  'document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>{',
  '  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));',
  '  document.querySelectorAll(".tab-page").forEach(x=>x.classList.remove("active"));',
  '  t.classList.add("active");document.getElementById("tab-"+t.dataset.tab).classList.add("active");',
  '}));',
  'document.getElementById("filePicker").addEventListener("change",async e=>{',
  '  const f=e.target.files[0];if(!f)return;',
  '  document.getElementById("fileName").textContent="📄 "+f.name;',
  '  const text=await f.text();',
  '  document.getElementById("fileLog").textContent=text.substring(0,1500);',
  '});',
  'document.getElementById("injectBtn").addEventListener("click",async()=>{',
  '  document.getElementById("injectScreen").classList.add("show");',
  '  const pre=document.getElementById("injectConsole");pre.textContent="";',
  '  const steps=["Khởi tạo...","Decrypt...","Bypass...","Patch...","Done!"];',
  '  for(let i=0;i<steps.length;i++){pre.textContent+=steps[i]+"\\n";await new Promise(r=>setTimeout(r,500));}',
  '  setTimeout(()=>{document.getElementById("injectScreen").classList.remove("show");alert("Đã Inject!");},1000);',
  '});',
  'document.getElementById("restartBtn").addEventListener("click",()=>{if(confirm("Xóa dữ liệu?")){localStorage.clear();location.reload();}});',
  '(function autoLogin(){',
  '  const k=localStorage.getItem("titan_key"),ex=localStorage.getItem("titan_exp");',
  '  if(k&&ex&&Date.now()<new Date(ex).getTime()){goToScreen("appScreen");startApp();}',
  '})();',
  '</script>',
  '</body>',
  '</html>'
].join('');

// Phục vụ giao diện HTML
app.get('/', (req, res) => res.send(HTML_UI));
app.get('/index.html', (req, res) => res.send(HTML_UI));

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server TITAN chạy tại cổng ' + PORT);
});
