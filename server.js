/* ============================================================
   DERA LOCKS SERVER — Quản lý key & kích hoạt
   Cài đặt: npm init -y && npm install express cors
   Chạy: node server.js
============================================================ */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const KEYS_FILE = path.join(__dirname, 'keys.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve index.html

/* ============================================================
   ĐỌC / GHI FILE KEYS.JSON
============================================================ */
function readKeys() {
  try {
    const raw = fs.readFileSync(KEYS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Lỗi đọc keys.json:', e.message);
    return { keys: [] };
  }
}

function writeKeys(data) {
  try {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Lỗi ghi keys.json:', e.message);
    return false;
  }
}

/* ============================================================
   API HEALTH
============================================================ */
app.get('/api/health', (req, res) => {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const serverTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  res.json({
    status: 'ok',
    serverTime: serverTime,
    uptime: Math.floor(process.uptime()) + 's',
    version: '1.0.0'
  });
});

/* ============================================================
   API XÁC THỰC KEY
============================================================ */
app.post('/api/verify-key', (req, res) => {
  const { key, deviceId } = req.body || {};
  if (!key) {
    return res.status(400).json({ success: false, error: 'Thiếu key' });
  }

  const data = readKeys();
  const keyData = data.keys.find(k => k.key === key.toUpperCase());

  if (!keyData) {
    return res.status(401).json({ success: false, error: 'Key không hợp lệ' });
  }

  const now = Date.now();
  const DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 ngày

  // Nếu key chưa từng kích hoạt → kích hoạt mới
  if (!keyData.activatedAt) {
    keyData.activatedAt = now;
    keyData.expiresAt = now + DURATION_MS;
    keyData.deviceId = deviceId || 'unknown';
    keyData.activations = [{
      deviceId: deviceId || 'unknown',
      activatedAt: now,
      expiresAt: keyData.expiresAt
    }];
    writeKeys(data);
    return res.json({
      success: true,
      activation: {
        key: keyData.key,
        activatedAt: keyData.activatedAt,
        expiresAt: keyData.expiresAt,
        deviceId: keyData.deviceId
      }
    });
  }

  // Key đã kích hoạt → kiểm tra hạn
  if (now >= keyData.expiresAt) {
    return res.status(403).json({ success: false, error: 'Key đã hết hạn' });
  }

  // Kiểm tra thiết bị (tùy chọn)
  if (deviceId && keyData.deviceId && keyData.deviceId !== deviceId) {
    return res.status(403).json({ success: false, error: 'Key đã dùng trên thiết bị khác' });
  }

  return res.json({
    success: true,
    activation: {
      key: keyData.key,
      activatedAt: keyData.activatedAt,
      expiresAt: keyData.expiresAt,
      deviceId: keyData.deviceId
    }
  });
});

/* ============================================================
   API DANH SÁCH KEY (admin — không public)
============================================================ */
app.get('/api/keys', (req, res) => {
  const data = readKeys();
  res.json({
    total: data.keys.length,
    keys: data.keys.map(k => ({
      key: k.key,
      activatedAt: k.activatedAt,
      expiresAt: k.expiresAt,
      deviceId: k.deviceId,
      status: !k.activatedAt ? 'chưa kích hoạt' : (Date.now() >= k.expiresAt ? 'hết hạn' : 'đang hoạt động')
    }))
  });
});

/* ============================================================
   START
============================================================ */
app.listen(PORT, () => {
  console.log('===========================================');
  console.log('🚀 DERA LOCKS SERVER đã khởi động');
  console.log('📍 http://localhost:' + PORT);
  console.log('📁 Keys file: ' + KEYS_FILE);
  console.log('===========================================');
});
