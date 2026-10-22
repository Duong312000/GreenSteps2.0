require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const fileUpload = require('express-fileupload');

const { connectDB } = require('./config/db');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5055;

// 1. Kết nối cơ sở dữ liệu MongoDB
connectDB();

// 2. Cấu hình CORS (Cho phép Angular chạy ở port 4200 hoặc khác truyền cookie/session credentials)
const allowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:5055',
  'http://127.0.0.1:5055'
];

app.use(cors({
  origin: (origin, callback) => {
    // Cho phép requests không có origin (ví dụ Postman, mobile app hoặc curl)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Dev mode: cho phép tất cả các nguồn localhost
  },
  credentials: true, // Cho phép truyền cookie và header Authorization
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-user-role']
}));

// 3. Logger và Parsers (Theo bài học Chương VI & Chương VII)
app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 4. Quản lý Cookie & Session (Theo bài học Chương VIII - Cookie và Session)
app.use(cookieParser(process.env.COOKIE_SECRET || 'greensteps_cookie_secret_key_2025'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'greensteps_session_secret_2025_thanh_uel',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    httpOnly: true,
    secure: false, // Để false khi test trên localhost HTTP
    sameSite: 'lax'
  }
}));

// 5. Cấu hình upload file (Theo bài học Chương VII - express-fileupload)
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // Tối đa 5MB
  createParentPath: true,
  abortOnLimit: true
}));

// 6. Phục vụ tài nguyên tĩnh (static files: hình ảnh, tài liệu)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// API Upload hình ảnh chung (Chương VII)
app.post('/api/upload', (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ success: false, message: 'Không có file nào được tải lên' });
    }

    const uploadedFile = req.files.image || req.files.file;
    if (!uploadedFile) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn trường file hợp lệ (image hoặc file)' });
    }

    // Đặt tên file duy nhất
    const fileName = `${Date.now()}_${uploadedFile.name.replace(/\s+/g, '_')}`;
    const uploadPath = path.join(__dirname, 'public', 'images', fileName);

    uploadedFile.mv(uploadPath, (err) => {
      if (err) {
        console.error('Error moving file:', err);
        return res.status(500).json({ success: false, message: 'Lỗi khi lưu file lên máy chủ', error: err.message });
      }

      const fileUrl = `/images/${fileName}`;
      res.json({
        success: true,
        message: 'Tải file lên thành công',
        data: {
          filename: fileName,
          url: fileUrl,
          full_url: `http://localhost:${PORT}${fileUrl}`
        }
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi upload file', error: error.message });
  }
});

// 7. Gắn tất cả API routes vào tiền tố /api
app.use('/api', apiRoutes);

// Trang chủ API
app.get('/', (req, res) => {
  res.json({
    app: 'GreenSteps Travel Backend System',
    description: 'Hệ thống RESTful API & Cơ sở dữ liệu MongoDB phục vụ đồ án Web Nâng Cao',
    author: 'GreenSteps Dev Team (Kiên, Linh, Phú, Dương, Thùy Anh)',
    course: 'Phát triển Web Nâng Cao - TS. Trần Duy Thanh (UEL)',
    version: '1.0.0',
    documentation: `http://localhost:${PORT}/api/health`,
    api_endpoints: {
      auth: `http://localhost:${PORT}/api/auth`,
      services: `http://localhost:${PORT}/api/services`,
      tours: `http://localhost:${PORT}/api/tours`,
      itineraries: `http://localhost:${PORT}/api/itineraries`,
      bookings: `http://localhost:${PORT}/api/bookings`,
      wallet: `http://localhost:${PORT}/api/wallet`,
      community: `http://localhost:${PORT}/api/community`,
      partners: `http://localhost:${PORT}/api/partners`,
      reviews: `http://localhost:${PORT}/api/reviews`,
      vouchers: `http://localhost:${PORT}/api/vouchers`,
      notifications: `http://localhost:${PORT}/api/notifications`,
      support: `http://localhost:${PORT}/api/support`,
      ai: `http://localhost:${PORT}/api/ai`,
      admin: `http://localhost:${PORT}/api/admin`
    }
  });
});

// Middleware xử lý 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Không tìm thấy đường dẫn ${req.originalUrl}`
  });
});

// Middleware xử lý lỗi toàn cục
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Lỗi hệ thống máy chủ',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Khởi chạy server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 GreenSteps Travel Server đang chạy tại port ${PORT}`);
  console.log(`📡 URL API: http://localhost:${PORT}/api`);
  console.log(`📚 Public files: http://localhost:${PORT}/images`);
  console.log(`=======================================================`);
});
