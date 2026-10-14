const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// === ĐƯỜNG DẪN FILE DỮ LIỆU ===
const KEYS_FILE = path.join(__dirname, 'keys.json');
const DEVICES_FILE = path.join(__dirname, 'devices.json');

// === KHỞI TẠO DỮ LIỆU NẾU CHƯA CÓ ===
function initFiles() {
    if (!fs.existsSync(KEYS_FILE)) {
        const initialKeys = {
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
        fs.writeFileSync(KEYS_FILE, JSON.stringify(initialKeys, null, 2));
        console.log('✅ Tạo file keys.json thành công');
    }

    if (!fs.existsSync(DEVICES_FILE)) {
        const initialDevices = {
            version: '1.0',
            updated_at: new Date().toISOString(),
            devices: {}
        };
        fs.writeFileSync(DEVICES_FILE, JSON.stringify(initialDevices, null, 2));
        console.log('✅ Tạo file devices.json thành công');
    }
}

// === ĐỌC/LƯU DỮ LIỆU ===
function loadJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (err) { return {}; }
}

function saveJSON(file, data) {
    data.updated_at = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// === API KIỂM TRA TRẠNG THÁI SERVER ===
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        message: '✅ DERA LOCKS Server đang hoạt động',
        time: new Date().toISOString(),
        version: '1.1.0'
    });
});

// === API XÁC THỰC KEY ===
app.post('/verify-key', (req, res) => {
    try {
        const { key, deviceName, deviceId } = req.body;
        const data = loadJSON(KEYS_FILE);
        const keyData = data.keys.find(k => k.key === key);

        if (!keyData) return res.json({ valid: false, message: '❌ Key không hợp lệ' });
        if (keyData.status === 'expired') return res.json({ valid: false, message: '❌ Key đã hết hạn' });
        
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
            saveJSON(KEYS_FILE, data);
            
            // Tạo thiết bị trên server
            const devices = loadJSON(DEVICES_FILE);
            if (!devices.devices[deviceId]) {
                devices.devices[deviceId] = {
                    name: deviceName || 'Thiết bị không xác định',
                    key: key,
                    activated_at: keyData.activated_at,
                    expire_at: keyData.expire_at,
                    settings: {
                        touch: false,
                        aim: false,
                        lock_fire: false,
                        stickiness: 50,
                        fps: false,
                        mobileconfig: false
                    },
                    dns: null,
                    certificate: null,
                    last_online: new Date().toISOString()
                };
                saveJSON(DEVICES_FILE, devices);
            }
        }

        // Kiểm tra hết hạn
        const now = new Date();
        const expireAt = new Date(keyData.expire_at);
        if (now > expireAt) {
            keyData.status = 'expired';
            saveJSON(KEYS_FILE, data);
            return res.json({ valid: false, message: '❌ Key đã hết hạn' });
        }

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

// === API ĐỒNG BỘ TRẠNG THÁI CHỨC NĂNG MENU ===
app.post('/sync-settings', (req, res) => {
    try {
        const { deviceId, settings } = req.body;
        const devices = loadJSON(DEVICES_FILE);
        
        if (!devices.devices[deviceId]) {
            return res.json({ success: false, message: '❌ Thiết bị chưa được kích hoạt key' });
        }
        
        // Cập nhật cài đặt
        devices.devices[deviceId].settings = {
            ...devices.devices[deviceId].settings,
            ...settings,
            updated_at: new Date().toISOString()
        };
        devices.devices[deviceId].last_online = new Date().toISOString();
        
        saveJSON(DEVICES_FILE, devices);
        
        console.log(`[Đồng bộ] Thiết bị ${deviceId}:`, settings);
        
        res.json({ 
            success: true, 
            message: '✅ Đã đồng bộ cài đặt lên server',
            synced_settings: settings
        });
    } catch (err) {
        res.json({ success: false, message: '❌ Lỗi: ' + err.message });
    }
});

// === API LẤY CÀI ĐẶT TỪ SERVER ===
app.get('/get-settings/:deviceId', (req, res) => {
    try {
        const { deviceId } = req.params;
        const devices = loadJSON(DEVICES_FILE);
        
        if (!devices.devices[deviceId]) {
            return res.json({ 
                success: false, 
                message: '❌ Chưa có dữ liệu thiết bị',
                settings: {
                    touch: false,
                    aim: false,
                    lock_fire: false,
                    stickiness: 50,
                    fps: false,
                    mobileconfig: false
                }
            });
        }
        
        const device = devices.devices[deviceId];
        device.last_online = new Date().toISOString();
        saveJSON(DEVICES_FILE, devices);
        
        res.json({
            success: true,
            message: '✅ Đã lấy cài đặt',
            settings: device.settings,
            dns: device.dns || null,
            certificate: device.certificate || null
        });
    } catch (err) {
        res.json({ success: false, message: '❌ Lỗi: ' + err.message });
    }
});

// === API LƯU & LẤY CẤU HÌNH DNS ===
app.post('/save-dns', (req, res) => {
    try {
        const { deviceId, name, primary, secondary, mode } = req.body;
        const devices = loadJSON(DEVICES_FILE);
        
        if (!devices.devices[deviceId]) {
            return res.json({ success: false, message: '❌ Thiết bị chưa kích hoạt' });
        }
        
        devices.devices[deviceId].dns = { name, primary, secondary, mode, created_at: new Date().toISOString() };
        saveJSON(DEVICES_FILE, devices);
        
        res.json({ success: true, message: '✅ Đã lưu cấu hình DNS lên server' });
    } catch (err) {
        res.json({ success: false, message: '❌ Lỗi: ' + err.message });
    }
});

// === API LƯU & LẤY CHỨNG NHẬN ===
app.post('/save-certificate', (req, res) => {
    try {
        const { deviceId, domain, org, type, expires_at, pem_data } = req.body;
        const devices = loadJSON(DEVICES_FILE);
        
        if (!devices.devices[deviceId]) {
            return res.json({ success: false, message: '❌ Thiết bị chưa kích hoạt' });
        }
        
        devices.devices[deviceId].certificate = { domain, org, type, expires_at, pem_data, created_at: new Date().toISOString() };
        saveJSON(DEVICES_FILE, devices);
        
        res.json({ success: true, message: '✅ Đã lưu chứng nhận lên server' });
    } catch (err) {
        res.json({ success: false, message: '❌ Lỗi: ' + err.message });
    }
});

// === API TRẠNG THÁI TỔNG THỂ THIẾT BỊ ===
app.get('/device-status/:deviceId', (req, res) => {
    try {
        const { deviceId } = req.params;
        const devices = loadJSON(DEVICES_FILE);
        
        if (!devices.devices[deviceId]) {
            return res.json({ success: false, message: '❌ Thiết bị không tồn tại' });
        }
        
        const device = devices.devices[deviceId];
        res.json({
            success: true,
            device_name: device.name,
            key_active: true,
            key_expire_at: device.expire_at,
            settings_active: device.settings,
            dns_configured: !!device.dns,
            certificate_valid: !!device.certificate,
            last_online: device.last_online
        });
    } catch (err) {
        res.json({ success: false, message: '❌ Lỗi: ' + err.message });
    }
});

// === KHỞI ĐỘNG SERVER ===
app.listen(PORT, () => {
    initFiles();
    console.log(`=========================================`);
    console.log(`✅ DERA LOCKS Server v1.1.0`);
    console.log(`📌 Link: https://sever-axua.onrender.com`);
    console.log(`📌 Trạng thái: /status`);
    console.log(`📌 Xác thực Key: /verify-key`);
    console.log(`📌 Đồng bộ cài đặt: /sync-settings`);
    console.log(`📌 Lấy cài đặt: /get-settings/:deviceId`);
    console.log(`📌 Lưu DNS: /save-dns`);
    console.log(`📌 Lưu Cert: /save-certificate`);
    console.log(`=========================================`);
});
