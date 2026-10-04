var express = require("express");
var fs = require("fs");
var path = require("path");
var cors = require("cors");

var app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

var DB_FILE = path.join(__dirname, "db.json");

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      var init = { keys: {}, devices: {}, sensitivities: {}, functions: {}, logs: [] };
      fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2));
      return init;
    }
    var data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    if (!data.keys) data.keys = {};
    if (!data.devices) data.devices = {};
    if (!data.sensitivities) data.sensitivities = {};
    if (!data.functions) data.functions = {};
    if (!data.logs) data.logs = [];
    return data;
  } catch (e) {
    console.error("DB error:", e.message);
    return { keys: {}, devices: {}, sensitivities: {}, functions: {}, logs: [] };
  }
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("Save error:", e.message);
  }
}

var DB = loadDB();
console.log("DB loaded. Keys:", Object.keys(DB.keys).length);

app.get("/api/ping", function (req, res) {
  res.json({ ok: true, time: Date.now(), server: "SERENITY LOCK", version: "2.0" });
});

app.get("/health", function (req, res) {
  res.json({
    ok: true,
    status: "healthy",
    uptime: process.uptime(),
    keys: Object.keys(DB.keys).length,
    time: new Date().toISOString()
  });
});

app.get("/api", function (req, res) {
  res.json({ ok: true, name: "SERENITY LOCK API", version: "2.0" });
});

app.post("/api/activate", function (req, res) {
  var body = req.body || {};
  var key = body.key;
  var deviceId = body.deviceId;
  var deviceName = body.deviceName;

  if (!key || !deviceId) {
    return res.json({ ok: false, error: "Thiếu thông tin" });
  }

  var k = DB.keys[key];
  if (!k) return res.json({ ok: false, error: "Key không tồn tại" });
  if (k.used) return res.json({ ok: false, error: "Key đã được sử dụng" });

  var now = Date.now();
  k.used = true;
  k.deviceId = deviceId;
  k.deviceName = deviceName || "iOS Device";
  k.activatedAt = now;
  k.expiresAt = now + k.durationDays * 86400000;
  DB.keys[key] = k;

  DB.devices[deviceId] = {
    key: key,
    deviceName: k.deviceName,
    user: k.user,
    activatedAt: now,
    lastSeen: now
  };

  if (!DB.functions[key]) {
    DB.functions[key] = { nhetam: false, bamtam: false, khoatam: false, khoavung: false };
  }

  saveDB(DB);

  res.json({
    ok: true,
    type: k.type,
    user: k.user,
    expiresAt: k.expiresAt,
    deviceName: k.deviceName
  });
});

app.post("/api/verify", function (req, res) {
  var body = req.body || {};
  var key = body.key;
  var deviceId = body.deviceId;

  var k = DB.keys[key];
  if (!k) return res.json({ ok: false, error: "Key không tồn tại" });
  if (k.deviceId !== deviceId) return res.json({ ok: false, error: "Key thuộc thiết bị khác" });
  if (k.expiresAt <= Date.now()) return res.json({ ok: false, error: "Key hết hạn" });

  res.json({ ok: true, type: k.type, user: k.user, expiresAt: k.expiresAt });
});

app.get("/api/functions", function (req, res) {
  var key = req.query.key;
  var deviceId = req.query.deviceId;

  if (!key) return res.json({ ok: false, error: "Thiếu key" });

  var k = DB.keys[key];
  if (!k) return res.json({ ok: false, error: "Key không tồn tại" });
  if (deviceId && k.deviceId && k.deviceId !== deviceId) {
    return res.json({ ok: false, error: "Key thuộc thiết bị khác" });
  }

  var funcs = DB.functions[key] || { nhetam: false, bamtam: false, khoatam: false, khoavung: false };
  res.json({ ok: true, functions: funcs, key: key, user: k.user });
});

app.post("/api/functions", function (req, res) {
  var body = req.body || {};
  var key = body.key;
  var deviceId = body.deviceId;
  var functions = body.functions;

  if (!key || !deviceId || !functions) {
    return res.json({ ok: false, error: "Thiếu thông tin" });
  }

  var k = DB.keys[key];
  if (!k) return res.json({ ok: false, error: "Key không tồn tại" });
  if (k.deviceId !== deviceId) return res.json({ ok: false, error: "Key thuộc thiết bị khác" });

  var cleaned = {
    nhetam: !!functions.nhetam,
    bamtam: !!functions.bamtam,
    khoatam: !!functions.khoatam,
    khoavung: !!functions.khoavung,
    updatedAt: Date.now()
  };

  DB.functions[key] = cleaned;

  if (DB.devices[deviceId]) {
    DB.devices[deviceId].functions = cleaned;
    DB.devices[deviceId].lastSeen = Date.now();
  }

  saveDB(DB);
  res.json({ ok: true, functions: cleaned });
});

app.post("/api/sensitivity", function (req, res) {
  var body = req.body || {};
  var key = body.key;
  var deviceId = body.deviceId;

  if (!key || !deviceId) return res.json({ ok: false, error: "Thiếu thông tin" });

  var k = DB.keys[key];
  if (!k) return res.json({ ok: false, error: "Key không tồn tại" });
  if (k.deviceId !== deviceId) return res.json({ ok: false, error: "Key thuộc thiết bị khác" });

  DB.sensitivities[key] = {
    device: body.device,
    style: body.style,
    values: body.values,
    updatedAt: Date.now()
  };
  saveDB(DB);
  res.json({ ok: true });
});

app.get("/api/admin/create-key", function (req, res) {
  var secret = req.query.secret;
  var key = req.query.key;
  var days = req.query.days;
  var user = req.query.user;

  if (secret !== "serenity2026") {
    return res.json({ ok: false, error: "Sai mật khẩu admin" });
  }

  if (!key) return res.json({ ok: false, error: "Thiếu key" });

  var keyUpper = String(key).toUpperCase();

  if (DB.keys[keyUpper]) {
    return res.json({ ok: false, error: "Key đã tồn tại" });
  }

  var daysNum = parseInt(days) || 7;
  var typeName = "Tuần";
  if (daysNum >= 36500) typeName = "Vĩnh viễn";
  else if (daysNum >= 30) typeName = "Tháng";

  DB.keys[keyUpper] = {
    type: typeName,
    user: user || "User",
    durationDays: daysNum,
    deviceId: null,
    deviceName: null,
    activatedAt: null,
    expiresAt: null,
    used: false
  };

  DB.functions[keyUpper] = { nhetam: false, bamtam: false, khoatam: false, khoavung: false };

  saveDB(DB);

  res.json({ ok: true, key: keyUpper, days: daysNum, user: user || "User" });
});

app.get("/api/admin/reset-key", function (req, res) {
  var secret = req.query.secret;
  var key = req.query.key;

  if (secret !== "serenity2026") return res.json({ ok: false, error: "Sai mật khẩu" });

  var k = DB.keys[key];
  if (!k) return res.json({ ok: false, error: "Key không tồn tại" });

  k.used = false;
  k.deviceId = null;
  k.deviceName = null;
  k.activatedAt = null;
  k.expiresAt = null;
  DB.keys[key] = k;
  DB.functions[key] = { nhetam: false, bamtam: false, khoatam: false, khoavung: false };

  saveDB(DB);
  res.json({ ok: true, message: "Đã reset" });
});

app.get("/api/admin/delete-key", function (req, res) {
  var secret = req.query.secret;
  var key = req.query.key;

  if (secret !== "serenity2026") return res.json({ ok: false, error: "Sai mật khẩu" });
  if (!DB.keys[key]) return res.json({ ok: false, error: "Key không tồn tại" });

  delete DB.keys[key];
  delete DB.functions[key];
  delete DB.sensitivities[key];

  saveDB(DB);
  res.json({ ok: true, message: "Đã xoá key" });
});

app.get("/api/admin/list-keys", function (req, res) {
  var secret = req.query.secret;

  if (secret !== "serenity2026") return res.json({ ok: false, error: "Sai mật khẩu" });

  var list = [];
  var keys = Object.keys(DB.keys);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var k = DB.keys[key];
    list.push({
      key: key,
      type: k.type,
      user: k.user,
      durationDays: k.durationDays,
      used: k.used,
      deviceId: k.deviceId,
      deviceName: k.deviceName,
      expiresAt: k.expiresAt,
      activatedAt: k.activatedAt
    });
  }

  res.json({ ok: true, total: list.length, keys: list });
});

app.get("/api/admin/list-devices", function (req, res) {
  var secret = req.query.secret;

  if (secret !== "serenity2026") return res.json({ ok: false, error: "Sai mật khẩu" });

  var list = [];
  var ids = Object.keys(DB.devices);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var d = DB.devices[id];
    list.push({
      deviceId: id,
      deviceName: d.deviceName,
      user: d.user,
      key: d.key,
      functions: DB.functions[d.key] || {},
      lastSeen: d.lastSeen
    });
  }

  res.json({ ok: true, total: list.length, devices: list });
});

app.use(function (err, req, res, next) {
  console.error("Server error:", err.message);
  res.status(500).json({ ok: false, error: err.message });
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log("🚀 SERENITY LOCK Server v2.0");
  console.log("   Port: " + PORT);
  console.log("   Admin secret: serenity2026");
  console.log("   Keys loaded: " + Object.keys(DB.keys).length);
});
