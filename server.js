const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, "db.json");

/* ===================================================
   DATABASE
=================================================== */
function loadDB(){
  if (!fs.existsSync(DB_FILE)){
    const init = {
      keys: {},
      devices: {},
      sensitivities: {},
      functions: {},
      logs: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  try{
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    // Đảm bảo có đủ các trường
    if (!data.keys) data.keys = {};
    if (!data.devices) data.devices = {};
    if (!data.sensitivities) data.sensitivities = {};
    if (!data.functions) data.functions = {};
    if (!data.logs) data.logs = [];
    return data;
  }catch(e){
    console.error("Lỗi đọc DB, reset:", e.message);
    return { keys:{}, devices:{}, sensitivities:{}, functions:{}, logs:[] };
  }
}
function saveDB(db){
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
let DB = loadDB();

/* ===================================================
   SEED KEY MẪU — chỉ chạy lần đầu
=================================================== */
function seedKeys(){
  if (Object.keys(DB.keys).length > 0) return;
  const samples = [
    { key:"SERENITY-AAAA-BBBB-FF", type:"Tuần",     days:7,     user:"User A" },
    { key:"SERENITY-CCCC-DDDD-FF", type:"Tháng",    days:30,    user:"User B" },
    { key:"SERENITY-EEEE-FFFF-FF", type:"Vĩnh viễn", days:36500, user:"User C" },
    { key:"SERENITY-GGGG-HHHH-FF", type:"Tuần",     days:7,     user:"User D" },
    { key:"SERENITY-IIII-JJJJ-FF", type:"Tháng",    days:30,    user:"User E" },
    { key:"SERENITY-KKKK-LLLL-FF", type:"Vĩnh viễn", days:36500, user:"User F" },
    { key:"SERENITY-MMMM-NNNN-FF", type:"Tuần",     days:7,     user:"User G" },
    { key:"SERENITY-OOOO-PPPP-FF", type:"Tháng",    days:30,    user:"User H" },
    { key:"SERENITY-QQQQ-RRRR-FF", type:"Vĩnh viễn", days:36500, user:"User I" },
    { key:"SERENITY-SSSS-TTTT-FF", type:"Tuần",     days:7,     user:"User J" },
  ];
  samples.forEach(s=>{
    DB.keys[s.key] = {
      type: s.type,
      user: s.user,
      durationDays: s.days,
      deviceId: null,
      deviceName: null,
      activatedAt: null,
      expiresAt: null,
      used: false
    };
  });
  saveDB(DB);
  console.log("✅ Đã tạo 10 key mẫu:");
  samples.forEach(s=>console.log("   " + s.key + "  (" + s.type + ")"));
}
seedKeys();

/* ===================================================
   MIDDLEWARE: PHỤC VỤ FILE TĨNH (index.html)
=================================================== */
app.use(express.static(__dirname));

/* ===================================================
   HELPER: GHI LOG
=================================================== */
function addLog(type, data){
  DB.logs = DB.logs || [];
  DB.logs.push({
    time: Date.now(),
    type: type,
    data: data
  });
  // Giữ 500 log gần nhất
  if (DB.logs.length > 500) DB.logs = DB.logs.slice(-500);
}

/* ===================================================
   API: PING
=================================================== */
app.get("/api/ping", (req,res)=>{
  res.json({
    ok: true,
    time: Date.now(),
    server: "SERENITY LOCK",
    version: "2.0",
    uptime: process.uptime()
  });
});

/* ===================================================
   API: KÍCH HOẠT KEY
=================================================== */
app.post("/api/activate", (req,res)=>{
  const {key, deviceId, deviceName} = req.body || {};
  if (!key || !deviceId){
    return res.json({ok:false, error:"Thiếu thông tin"});
  }

  const k = DB.keys[key];
  if (!k) return res.json({ok:false, error:"Key không tồn tại"});
  if (k.used) return res.json({ok:false, error:"Key đã được sử dụng"});

  const now = Date.now();
  k.used = true;
  k.deviceId = deviceId;
  k.deviceName = deviceName || "iOS Device";
  k.activatedAt = now;
  k.expiresAt = now + k.durationDays * 86400000;
  DB.keys[key] = k;

  // Lưu thiết bị
  DB.devices[deviceId] = {
    key: key,
    deviceName: k.deviceName,
    user: k.user,
    activatedAt: now,
    lastSeen: now
  };

  // Khởi tạo functions cho key này
  if (!DB.functions[key]){
    DB.functions[key] = {
      nhetam: false,
      bamtam: false,
      khoatam: false,
      khoavung: false,
      updatedAt: now
    };
  }

  addLog("activate", {key: key, deviceId: deviceId, deviceName: deviceName});
  saveDB(DB);

  res.json({
    ok: true,
    type: k.type,
    user: k.user,
    expiresAt: k.expiresAt,
    deviceName: k.deviceName
  });
});

/* ===================================================
   API: XÁC THỰC LẠI
=================================================== */
app.post("/api/verify", (req,res)=>{
  const {key, deviceId} = req.body || {};
  const k = DB.keys[key];
  if (!k) return res.json({ok:false, error:"Key không tồn tại"});
  if (k.deviceId !== deviceId) return res.json({ok:false, error:"Key thuộc thiết bị khác"});
  if (k.expiresAt <= Date.now()) return res.json({ok:false, error:"Key hết hạn"});

  // Cập nhật lastSeen
  if (DB.devices[deviceId]){
    DB.devices[deviceId].lastSeen = Date.now();
    saveDB(DB);
  }

  res.json({
    ok: true,
    type: k.type,
    user: k.user,
    expiresAt: k.expiresAt
  });
});

/* ===================================================
   API: FUNCTIONS (4 CHỨC NĂNG)
=================================================== */

// LẤY trạng thái functions
app.get("/api/functions", (req,res)=>{
  const {key, deviceId} = req.query;
  if (!key){
    return res.json({ok:false, error:"Thiếu key"});
  }

  const k = DB.keys[key];
  if (!k) return res.json({ok:false, error:"Key không tồn tại"});
  if (deviceId && k.deviceId !== deviceId){
    return res.json({ok:false, error:"Key thuộc thiết bị khác"});
  }

  const funcs = DB.functions[key] || {
    nhetam: false, bamtam: false, khoatam: false, khoavung: false
  };

  res.json({
    ok: true,
    functions: funcs,
    key: key,
    user: k.user
  });
});

// LƯU trạng thái functions
app.post("/api/functions", (req,res)=>{
  const {key, deviceId, functions} = req.body || {};
  if (!key || !deviceId || !functions){
    return res.json({ok:false, error:"Thiếu thông tin"});
  }

  const k = DB.keys[key];
  if (!k) return res.json({ok:false, error:"Key không tồn tại"});
  if (k.deviceId !== deviceId){
    return res.json({ok:false, error:"Key thuộc thiết bị khác"});
  }

  // Chuẩn hoá functions
  const cleaned = {
    nhetam:  !!functions.nhetam,
    bamtam:  !!functions.bamtam,
    khoatam: !!functions.khoatam,
    khoavung: !!functions.khoavung,
    updatedAt: Date.now(),
    updatedBy: deviceId
  };

  DB.functions[key] = cleaned;

  // Lưu vào thiết bị
  if (DB.devices[deviceId]){
    DB.devices[deviceId].functions = cleaned;
    DB.devices[deviceId].lastSeen = Date.now();
  }

  addLog("update-functions", {key: key, deviceId: deviceId, functions: cleaned});
  saveDB(DB);

  res.json({ok: true, functions: cleaned});
});

/* ===================================================
   API: NHẬN LỆNH BẬT CHỨC NĂNG TỪ URL (?fn=)
=================================================== */
app.post("/api/apply-url-fn", (req,res)=>{
  const {key, deviceId, fnString} = req.body || {};
  if (!key || !deviceId || !fnString){
    return res.json({ok:false, error:"Thiếu thông tin"});
  }

  const k = DB.keys[key];
  if (!k) return res.json({ok:false, error:"Key không tồn tại"});
  if (k.deviceId !== deviceId){
    return res.json({ok:false, error:"Key thuộc thiết bị khác"});
  }

  // Parse "nhetam,bamtam,khoatam,khoavung"
  const arr = fnString.split(",").map(s=>s.trim()).filter(Boolean);
  const valid = ["nhetam","bamtam","khoatam","khoavung"];
  const funcs = DB.functions[key] || {nhetam:false,bamtam:false,khoatam:false,khoavung:false};

  arr.forEach(fn=>{
    if (valid.includes(fn)) funcs[fn] = true;
  });
  funcs.updatedAt = Date.now();
  funcs.updatedBy = "url-fn";

  DB.functions[key] = funcs;

  addLog("apply-url-fn", {key: key, deviceId: deviceId, applied: arr});
  saveDB(DB);

  res.json({ok: true, functions: funcs, applied: arr});
});

/* ===================================================
   API: SENSITIVITY (ĐỘ NHẠY FF OB55)
=================================================== */
app.post("/api/sensitivity", (req,res)=>{
  const {key, deviceId, device, style, values} = req.body || {};
  if (!key || !deviceId){
    return res.json({ok:false, error:"Thiếu thông tin"});
  }

  const k = DB.keys[key];
  if (!k) return res.json({ok:false, error:"Key không tồn tại"});
  if (k.deviceId !== deviceId){
    return res.json({ok:false, error:"Key thuộc thiết bị khác"});
  }

  DB.sensitivities[key] = {
    device: device,
    style: style,
    values: values,
    deviceId: deviceId,
    updatedAt: Date.now()
  };
  addLog("sensitivity", {key: key, device: device, style: style});
  saveDB(DB);

  res.json({ok: true});
});

// LẤY độ nhạy
app.get("/api/sensitivity", (req,res)=>{
  const {key} = req.query;
  if (!key) return res.json({ok:false, error:"Thiếu key"});
  const sens = DB.sensitivities[key];
  if (!sens) return res.json({ok:false, error:"Chưa có cấu hình"});
  res.json({ok: true, sensitivity: sens});
});

/* ===================================================
   API: ADMIN — TẠO KEY MỚI QUA URL
   Ví dụ: /api/admin/create-key?secret=ABC&key=SERENITY-XXXX-YYYY-FF&days=7&user=Name
=================================================== */
app.get("/api/admin/create-key", (req,res)=>{
  const {secret, key, days, user, type} = req.query;

  // Mật khẩu admin — đổi thành của bạn
  const ADMIN_SECRET = "serenity2026";

  if (secret !== ADMIN_SECRET){
    return res.json({ok:false, error:"Sai mật khẩu admin"});
  }
  if (!key || !/^SERENITY-[A-Z0-9]{4}-[A-Z0-9]{4}-FF$/i.test(key)){
    return res.json({ok:false, error:"Key sai định dạng SERENITY-XXXX-XXXX-FF"});
  }

  const keyUpper = key.toUpperCase();
  if (DB.keys[keyUpper]){
    return res.json({ok:false, error:"Key đã tồn tại"});
  }

  const daysNum = parseInt(days) || 7;
  DB.keys[keyUpper] = {
    type: type || (daysNum >= 36500 ? "Vĩnh viễn" : daysNum >= 30 ? "Tháng" : "Tuần"),
    user: user || "User",
    durationDays: daysNum,
    deviceId: null,
    deviceName: null,
    activatedAt: null,
    expiresAt: null,
    used: false,
    createdAt: Date.now()
  };
  saveDB(DB);
  addLog("create-key", {key: keyUpper, days: daysNum, user: user});

  res.json({
    ok: true,
    key: keyUpper,
    days: daysNum,
    user: user || "User",
    message: "Đã tạo key thành công"
  });
});

/* ===================================================
   API: ADMIN — XOÁ KEY
=================================================== */
app.get("/api/admin/delete-key", (req,res)=>{
  const {secret, key} = req.query;
  const ADMIN_SECRET = "serenity2026";

  if (secret !== ADMIN_SECRET){
    return res.json({ok:false, error:"Sai mật khẩu admin"});
  }
  if (!DB.keys[key]){
    return res.json({ok:false, error:"Key không tồn tại"});
  }

  delete DB.keys[key];
  delete DB.functions[key];
  delete DB.sensitivities[key];
  saveDB(DB);

  res.json({ok: true, message: "Đã xoá key " + key});
});

/* ===================================================
   API: ADMIN — RESET KEY (cho dùng lại)
=================================================== */
app.get("/api/admin/reset-key", (req,res)=>{
  const {secret, key} = req.query;
  const ADMIN_SECRET = "serenity2026";

  if (secret !== ADMIN_SECRET){
    return res.json({ok:false, error:"Sai mật khẩu admin"});
  }
  const k = DB.keys[key];
  if (!k) return res.json({ok:false, error:"Key không tồn tại"});

  k.used = false;
  k.deviceId = null;
  k.deviceName = null;
  k.activatedAt = null;
  k.expiresAt = null;
  DB.keys[key] = k;
  DB.functions[key] = {nhetam:false,bamtam:false,khoatam:false,khoavung:false};
  saveDB(DB);

  res.json({ok: true, message: "Đã reset key " + key});
});

/* ===================================================
   API: ADMIN — XEM TẤT CẢ KEY
=================================================== */
app.get("/api/admin/list-keys", (req,res)=>{
  const {secret} = req.query;
  const ADMIN_SECRET = "serenity2026";

  if (secret !== ADMIN_SECRET){
    return res.json({ok:false, error:"Sai mật khẩu admin"});
  }

  const list = Object.keys(DB.keys).map(key=>{
    const k = DB.keys[key];
    return {
      key: key,
      type: k.type,
      user: k.user,
      durationDays: k.durationDays,
      used: k.used,
      deviceId: k.deviceId,
      deviceName: k.deviceName,
      expiresAt: k.expiresAt,
      expiresIn: k.expiresAt ? Math.max(0, k.expiresAt - Date.now()) : null,
      activatedAt: k.activatedAt
    };
  });

  res.json({ok: true, total: list.length, keys: list});
});

/* ===================================================
   API: ADMIN — XEM TẤT CẢ THIẾT BỊ
=================================================== */
app.get("/api/admin/list-devices", (req,res)=>{
  const {secret} = req.query;
  const ADMIN_SECRET = "serenity2026";

  if (secret !== ADMIN_SECRET){
    return res.json({ok:false, error:"Sai mật khẩu admin"});
  }

  const list = Object.keys(DB.devices).map(id=>{
    const d = DB.devices[id];
    return {
      deviceId: id,
      deviceName: d.deviceName,
      user: d.user,
      key: d.key,
      functions: DB.functions[d.key] || {},
      lastSeen: d.lastSeen,
      activatedAt: d.activatedAt
    };
  });

  res.json({ok: true, total: list.length, devices: list});
});

/* ===================================================
   API: HEALTH CHECK
=================================================== */
app.get("/health", (req,res)=>{
  res.json({
    ok: true,
    status: "healthy",
    uptime: process.uptime(),
    time: new Date().toISOString()
  });
});

/* ===================================================
   API: HOME — hiển thị thông tin server
=================================================== */
app.get("/api", (req,res)=>{
  res.json({
    ok: true,
    name: "SERENITY LOCK API",
    version: "2.0",
    endpoints: [
      "GET  /api/ping",
      "POST /api/activate",
      "POST /api/verify",
      "GET  /api/functions?key=&deviceId=",
      "POST /api/functions",
      "POST /api/apply-url-fn",
      "GET  /api/sensitivity?key=",
      "POST /api/sensitivity",
      "GET  /api/admin/create-key?secret=&key=&days=&user=",
      "GET  /api/admin/delete-key?secret=&key=",
      "GET  /api/admin/reset-key?secret=&key=",
      "GET  /api/admin/list-keys?secret=",
      "GET  /api/admin/list-devices?secret=",
      "GET  /health"
    ]
  });
});

/* ===================================================
   XỬ LÝ LỖI
=================================================== */
app.use((err, req, res, next)=>{
  console.error("Lỗi server:", err);
  res.status(500).json({ok:false, error:"Lỗi server"});
});

/* ===================================================
   KHỞI ĐỘNG
=================================================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT |, ()=>{
  console.log("🚀 SERENITY LOCK Server v2.0");
  console.log("   Chạy tại: http://localhost:" + T PORT);
  console.log("   Admin secret: serenity2026");
  console.log("   Tổng số key: " + Object.keys(DB.keys).length);
});
