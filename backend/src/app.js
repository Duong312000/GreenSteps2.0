const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const routes = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler');
const { sequelize } = require('./config/db.config');

const app = express();
let isDbConnected = false;

// Enable standard middlewares
app.use(cors({
  origin: true, // Allow frontend origin
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Database connection check middleware
app.use(async (req, res, next) => {
  try {
    if (!isDbConnected) {
      await sequelize.authenticate();
      isDbConnected = true;
    }
    next();
  } catch (err) {
    isDbConnected = false;
    return res.status(503).json({
      success: false,
      error: 'DatabaseUnavailable',
      message: 'Không thể kết nối đến cơ sở dữ liệu PostgreSQL. Vui lòng kiểm tra lại cấu hình!',
      details: err.message
    });
  }
});

// Mount upload-base64 endpoint directly on app to avoid routes nesting complexities
const fs = require('fs');
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.post('/api/upload-base64', (req, res) => {
  try {
    const { base64, type } = req.body;
    if (!base64) {
      return res.status(400).json({ success: false, message: 'No base64 data provided' });
    }

    // If it's already a URL, return it directly
    if (base64.startsWith('http') || base64.startsWith('/uploads')) {
      return res.json({ success: true, url: base64 });
    }

    // Parse base64
    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      // If it is not a valid data URI, return base64 string directly as fallback
      return res.json({ success: true, url: base64 });
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    
    // Deduce file extension
    let ext = 'png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('gif')) ext = 'gif';
    else if (mimeType.includes('webp')) ext = 'webp';

    // Determine subfolder based on type
    let subfolder = 'posts';
    if (type === 'avatar') subfolder = 'avatars';
    else if (type === 'service') subfolder = 'services';
    else if (type === 'post') subfolder = 'posts';
    
    const dirPath = path.join(__dirname, '../uploads', subfolder);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filename = `image_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filePath = path.join(dirPath, filename);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/${subfolder}/${filename}`;
    res.json({ success: true, url: relativeUrl });
  } catch (err) {
    console.error('Base64 upload failed:', err);
    res.status(500).json({ success: false, message: 'Upload failed: ' + err.message });
  }
});

// Mount all modular routes under both v1 and legacy prefixes for 100% compatibility
app.use('/api/v1', routes);
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
