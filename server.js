const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, "db.json");

/* ---------- DB ---------- */
function loadDB(){
  if (!fs.existsSync(DB_FILE)){
    const init = { keys: {}, devices: {}, sensitivities: {}, functions: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
    return init;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function saveDB(db){
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
let DB = loadDB();

/* ---------- Tạo key mITYẫu (chạy 1 lần) ---------- */
function seedKeys(){
  if (Object.keys(DB.keys).length > 0) return;
  const now = Date.now();
  const samples = [
    { key:"SERENITY-AAAA-BBBB-FF", type:"Tuần",     days:7,   user:"User A" },
    { key:"SERENITY-CCCC-DDDD-FF", type:"Tháng",    days:30,  user:"User B" },
    { key:"SEREN-EEEE-FFFF-FF", type:"Vĩnh viễn", days:36500, user:"User C" },
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
  console.log("✅ Đã tạo 3 key mẫu:");
  samples.forEach(s=>console.log("   " + s.key + "  (" + s.type + ")"));
}
seedKeys();

/* ===================================================
   API
=================================================== */

/* Ping */
app.get("/api/ping", (req,res)=>{
  res.json({ok:true, time:Date.now(), server:"SERENITY LOCK"});
});

/* Kích hoạt key */
app.post("/api/activate", (req,res)=>{
  const {key, deviceId, deviceName} = req.body || {};
  if (!key || !deviceId) return res.json({ok:false, error:"Thiếu thông tin"});

  const k = DB.keys[key];
  if (!k) return res.json({ok:false, error:"Key không tồn tại"});
  if (k.used) return res.json({ok:false, error:"Key đã được sử dụng"});

  // Gán key cho thiết bị này
  const now = Date.now();
  k.used = true;
  k.deviceId = deviceId;
  k.deviceName = deviceName || "iOS Device";
  k.activatedAt = now;
  k.expiresAt = now + k.durationDays * 86400000;
  DB.keys[key] = k;
  DB.devices[deviceId] = {key, deviceName: k.deviceName, lastSeen: now};
  if (!DB.functions[key]) DB.functions[key] = {nhetam:false,bamtam:false,khoatam:false,khoavung:false};
  saveDB(DB);

  res.json({
    ok:true,
    type: k.type,
    user: k.user,
    expiresAt: k.expiresAt,
    deviceName: k.deviceName
  });
});

/* Xác thực lại (khi mở lại app) */
app.post("/api/verify", (req,res)=>{
  const {key, deviceId} = req.body || {};
  const k = DB.keys[key];
  if (!k) return res.json({ok:false, error:"Key không tồn tại"});
  if (k.deviceId !== deviceId) return res.json({ok:false, error:"Key thuộc thiết bị khác"});
  if (k.expiresAt <= Date.now()) return res.json({ok:false, error:"Key hết hạn"});
  res.json({ok:true, type:k.type, user:k.user, expiresAt:k.expiresAt});
});

/* Lấy / lưu functions */
app.get("/api/functions", (req,res)=>{
  const {key} = req.query;
  if (!DB.functions[key]) return res.json({ok:false, error:"Không có dữ liệu"});
  res.json({ok:true, functions: DB.functions[key]});
});
app.post("/api/functions", (req,res)=>{
  const {key, deviceId, functions} = req.body || {};
  const k = DB.keys[key];
  if (!k || k.deviceId !== deviceId) return res.json({ok:false, error:"Không hợp lệ"});
  DB.functions[key] = functions;
  saveDB(DB);
  res.json({ok:true});
});

/* Lưu độ nhạy */
app.post("/api/sensitivity", (req,res)=>{
  const {key, deviceId, device, style, values} = req.body || {};
  const k = DB.keys[key];
  if (!k || k.deviceId !== deviceId) return res.json({ok:false, error:"Không hợp lệ"});
  if (!DB.sensitivities[key]) DB.sensitivities[key] = {};
  DB.sensitivities[key] = {device, style, values, updatedAt: Date.now()};
  saveDB(DB);
  res.json({ok:true});
});

/* ---------- Khởi động ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
  console.log("🚀 SERENITY LOCK Server chạy tại http://localhost:" + PORT);
});
