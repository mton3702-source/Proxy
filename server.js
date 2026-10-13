const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Đường dẫn file keys.json
const KEYS_FILE = path.join(__dirname, 'keys.json');

// Tạo file keys.json nếu chưa có
function initKeysFile() {
    if (!fs.existsSync(KEYS_FILE)) {
        const initialData = {
            version: '1.0',
            updated_at: new Date().toISOString(),
            keys: [
                { key: "DERA-42363C9E-EC589D4C", status: "unused", activated_at: null, expire_at: null, used_by: null, note: "Key 1 - 3 ngày" },
                { key: "DERA-7A9B2D4F-8E3C1D7F", status: "unused", activated_at: null, expire_at: null, used_by: null, note: "Key 2 - 3 ngày" },
                { key: "DERA-1F3E5D7C-9B2A4C6E", status: "unused", activated_at: null, expire_at: null, used_by: null, note: "Key 3 - 3 ngày" },
                { key: "DERA-8C2E6F4A-1D3B5E7C", status: "unused", activated_at: null, expire_at: null, used_by: null, note: "Key 4 - 3 ngày" },
                { key: "DERA-2B4D6F8A-3E5C7D9B", status: "unused", activated_at: null, expire_at: null, used_by: null, note: "Key 5 - 3 ngày" },
                { key: "DERA-9A3C5E7G-2F4D6B8H", status: "unused", activated_at: null, expire_at: null, used_by: null, note: "Key 6 - 3 ngày" },
                { key: "DERA-5E7C9A2D-4F6B8E3C", status: "unused", activated_at: null, expire_at: null, used_by: null, note: "Key 7 - 3 ngày" },
                { key: "DERA-3D5F7B9A-6C8E2D4F", status: "unused", activated_at: null, expire_at: null, used_by: null, note: "Key 8 - 3 ngày" },
                { key: "DERA-7F9D2B4C-5A3E8F6D", status: "unused", activated_at: null, expire_at: null, used_by: null, note: "Key 9 - 3 ngày" },
                { key: "DERA-4C6E8A2F-9B3D7E5A", status: "unused", activated_at: null, expire_at: null, used_by: null, note: "Key 10 - 3 ngày" }
            ]
        };
        fs.writeFileSync(KEYS_FILE, JSON.stringify(initialData, null, 2));
        console.log('✅ Tạo file keys.json thành công');
    }
}

// Đọc dữ liệu key
function loadKeys() {
    try {
        const data = fs.readFileSync(KEYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { keys: [] };
    }
}

// Lưu dữ liệu key
function saveKeys(data) {
    data.updated_at = new Date().toISOString();
    fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
}

// ===== API =====

// Kiểm tra trạng thái server
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        message: '✅ DERA LOCKS Server đang hoạt động',
        time: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Xác thực key
app.post('/verify-key', (req, res) => {
    try {
        const { key, deviceName, deviceId } = req.body;
        const data = loadKeys();
        const keyData = data.keys.find(k => k.key === key);

        if (!keyData) {
            return res.json({ valid: false, message: '❌ Key không hợp lệ' });
        }

        if (keyData.status === 'expired') {
            return res.json({ valid: false, message: '❌ Key đã hết hạn' });
        }

        // Kiểm tra key đang dùng trên thiết bị khác
        if (keyData.used_by && keyData.used_by.device_id !== deviceId) {
            return res.json({ valid: false, message: '⚠️ Key đang được sử dụng trên thiết bị khác' });
        }

        // Kích hoạt key nếu chưa dùng
        if (!keyData.activated_at) {
            keyData.activated_at = new Date().toISOString();
            keyData.used_by = {
                device_name: deviceName || 'Thiết bị không xác định',
                device_id: deviceId
            };
            const expireDate = new Date();
            expireDate.setDate(expireDate.getDate() + 3);
            keyData.expire_at = expireDate.toISOString();
            keyData.status = 'active';
            saveKeys(data);
        }

        // Kiểm tra hết hạn
        const now = new Date();
        const expireAt = new Date(keyData.expire_at);
        if (now > expireAt) {
            keyData.status = 'expired';
            saveKeys(data);
            return res.json({ valid: false, message: '❌ Key đã hết hạn' });
        }

        // Tính thời gian còn lại
        const remainingMs = expireAt - now;
        const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

        res.json({
            valid: true,
            message: '✅ Key hợp lệ',
            key_info: {
                key: keyData.key,
                activated_at: keyData.activated_at,
                expire_at: keyData.expire_at,
                remaining: { days, hours, minutes },
                device: keyData.used_by
            }
        });
    } catch (err) {
        res.json({ valid: false, message: '❌ Lỗi server: ' + err.message });
    }
});

// Khởi động server
app.listen(PORT, () => {
    initKeysFile();
    console.log(`✅ DERA LOCKS Server đang chạy tại cổng ${PORT}`);
    console.log(`📌 Link: https://sever-axua.onrender.com`);
    console.log(`📌 Trạng thái: https://sever-axua.onrender.com/status`);
});
