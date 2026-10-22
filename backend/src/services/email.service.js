const nodemailer = require('nodemailer');

function requireSmtpConfig() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  const missing = [];
  if (!SMTP_HOST) missing.push('SMTP_HOST');
  if (!SMTP_PORT) missing.push('SMTP_PORT');
  if (!SMTP_USER) missing.push('SMTP_USER');
  if (!SMTP_PASS) missing.push('SMTP_PASS');
  if (!SMTP_FROM) missing.push('SMTP_FROM');

  if (missing.length) {
    const error = new Error(`Thiếu cấu hình SMTP để gửi OTP thật: ${missing.join(', ')}`);
    error.statusCode = 500;
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  return {
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    from: SMTP_FROM
  };
}

let transporterInstance = null;

function getTransporter() {
  if (!transporterInstance) {
    const config = requireSmtpConfig();
    transporterInstance = nodemailer.createTransport({
      // Disable pooling on Render to avoid delayed email sending
      pool: false,
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.auth,
      tls: { rejectUnauthorized: false }
    });
  }
  return transporterInstance;
}

async function assertMailDomainCanReceive(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase();
  if (!domain) {
    const error = new Error('Email không hợp lệ.');
    error.statusCode = 400;
    error.code = 'EMAIL_INVALID';
    throw error;
  }

  const typoDomains = new Set([
    'gmai.com',
    'gmail.co',
    'gmail.con',
    'gmial.com',
    'gmal.com',
    'gmil.com',
    'gmill.com',
    'gnail.com',
    'hotmial.com',
    'outlok.com',
    'yaho.com'
  ]);

  if (typoDomains.has(domain)) {
    const error = new Error(`Có vẻ bạn nhập sai tên miền email "${domain}". Vui lòng kiểm tra lại địa chỉ email.`);
    error.statusCode = 400;
    error.code = 'EMAIL_DOMAIN_TYPO';
    throw error;
  }
}

function throwDeliveryError() {
  const error = new Error('Không gửi được OTP đến email này. Vui lòng kiểm tra lại địa chỉ email.');
  error.statusCode = 400;
  error.code = 'EMAIL_DELIVERY_FAILED';
  throw error;
}

async function sendOtpEmail({ to, otp, purpose }) {
  await assertMailDomainCanReceive(to);

  const isRegister = purpose === 'REGISTER';
  const subject = isRegister
    ? 'Mã xác thực tài khoản GreenSteps'
    : 'Mã xác thực đặt lại mật khẩu GreenSteps';
  const title = isRegister ? 'Xác thực tài khoản GreenSteps' : 'Đặt lại mật khẩu GreenSteps';
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#12372d">
      <h2>${title}</h2>
      <p>Mã OTP của bạn là:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#0E9F6E">${otp}</p>
      <p>Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.</p>
    </div>
  `;

  // 1. If Google Apps Script Web App URL is configured, send email via HTTPS API to bypass SMTP block
  if (process.env.GMAIL_API_URL) {
    try {
      const response = await fetch(process.env.GMAIL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html })
      });
      const resData = await response.json();
      if (resData && resData.success) {
        return { accepted: [to] };
      }
      throw new Error(resData.error || 'Google Apps Script Web App execution failed');
    } catch (error) {
      console.error('Google Apps Script email API error:', error);
      throwDeliveryError();
    }
  }

  // 2. Fallback to standard SMTP Nodemailer
  const config = requireSmtpConfig();
  const transporter = getTransporter();

  try {
    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject,
      text: `${title}\n\nMã OTP của bạn là: ${otp}\nMã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.`,
      html
    });

    const accepted = info.accepted || [];
    const rejected = info.rejected || [];
    if (!accepted.length || rejected.includes(to)) throwDeliveryError();
    return info;
  } catch (error) {
    console.error('Nodemailer sendMail error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      stack: error.stack
    });
    if (error.statusCode) throw error;
    throwDeliveryError();
  }
}

async function sendItineraryInviteEmail({ to, itineraryName, inviteUrl }) {
  const subject = `Lời mời tham gia hành trình du lịch: ${itineraryName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#12372d">
      <h2>Đồng hành du lịch cùng GreenSteps!</h2>
      <p>Bạn đã được mời cùng tham gia lên lịch trình cho chuyến đi <strong>"${itineraryName}"</strong>.</p>
      <p>Hãy bấm vào liên kết dưới đây để chấp nhận lời mời và cùng lên kế hoạch:</p>
      <p style="margin: 20px 0;">
        <a href="${inviteUrl}" style="background-color:#0E9F6E;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;display:inline-block;">Chấp nhận Lời mời</a>
      </p>
      <p>Nếu nút trên không hoạt động, bạn có thể sao chép liên kết này dán vào trình duyệt: <br>${inviteUrl}</p>
    </div>
  `;

  if (process.env.GMAIL_API_URL) {
    try {
      const response = await fetch(process.env.GMAIL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html })
      });
      const resData = await response.json();
      if (resData && resData.success) {
        return true;
      }
    } catch (error) {
      console.error('Google Apps Script sendItineraryInviteEmail API error:', error);
    }
  }

  // Fallback to standard Nodemailer SMTP
  try {
    const config = requireSmtpConfig();
    const transporter = getTransporter();
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      text: `Bạn đã được mời tham gia chuyến đi "${itineraryName}". Bấm vào đây để tham gia: ${inviteUrl}`,
      html
    });
    return true;
  } catch (error) {
    console.error('Nodemailer sendItineraryInviteEmail error:', error);
    return false;
  }
}

async function sendBookingConfirmationEmail({ to, bookingId, tourName, bookingDate, guests, depositAmount, paymentMethod, lookupUrl, credentials }) {
  const subject = `Xác nhận thông tin giữ chỗ GreenSteps - ${bookingId}`;
  
  const paymentMethodLabel = 
    paymentMethod === 'bank_transfer' ? 'Chuyển khoản VietQR' :
    paymentMethod === 'counter' ? 'Thanh toán tại quầy' :
    paymentMethod === 'wallet' ? 'Ví điện tử GreenSteps' :
    paymentMethod === 'card' ? 'Thẻ tín dụng' : paymentMethod;

  let credentialsText = '';
  if (credentials) {
    credentialsText = `
      <div style="margin-top:20px;padding:16px;background-color:#ebf8ff;border:1px solid #bee3f8;border-radius:8px;color:#2b6cb0;text-align:left;">
        <p style="margin:0 0 8px;"><strong>🔑 Thông tin tài khoản được cấp sẵn:</strong></p>
        <p style="margin:0 0 8px;font-size:13px;">Để tiện theo dõi chuyến đi, hệ thống đã cấp sẵn một tài khoản cho bạn với thông tin sau:</p>
        <p style="margin:0 0 4px;font-size:13px;"><strong>Tên đăng nhập:</strong> ${credentials.username}</p>
        <p style="margin:0;font-size:13px;"><strong>Mật khẩu mặc định:</strong> ${credentials.password}</p>
      </div>
    `;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#12372d;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="color:#0E9F6E;margin-bottom:4px;">Đặt Chỗ Thành Công!</h2>
        <p style="color:#718096;font-size:14px;margin:0;">GreenSteps đã tiếp nhận yêu cầu đặt chỗ của bạn</p>
      </div>
      
      <div style="background-color:#f7fafc;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 8px;"><strong>Mã đặt chỗ:</strong> <span style="font-family:monospace;font-size:16px;color:#0E9F6E;font-weight:bold;">${bookingId}</span></p>
        <p style="margin:0 0 8px;"><strong>Tên Tour / Dịch vụ:</strong> ${tourName}</p>
        <p style="margin:0 0 8px;"><strong>Ngày khởi hành:</strong> ${bookingDate}</p>
        <p style="margin:0 0 8px;"><strong>Số khách:</strong> ${guests} người</p>
        <p style="margin:0 0 8px;"><strong>Tiền đặt cọc:</strong> ${Number(depositAmount).toLocaleString('vi-VN')}đ</p>
        <p style="margin:0;"><strong>Phương thức:</strong> ${paymentMethodLabel}</p>
      </div>

      ${credentialsText}

      <div style="text-align:center;margin-top:20px;margin-bottom:20px;">
        <p style="font-size:14px;color:#4a5568;margin-bottom:12px;">Bạn có thể theo dõi và tra cứu trạng thái đơn hàng của mình bất kỳ lúc nào:</p>
        <a href="${lookupUrl}" style="background-color:#0E9F6E;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:bold;display:inline-block;">Tra Cứu Đơn Hàng</a>
      </div>

      <p style="font-size:12px;color:#a0aec0;text-align:center;margin:0;border-top:1px solid #edf2f7;padding-top:16px;">
        Cảm ơn bạn đã lựa chọn du lịch xanh cùng GreenSteps!<br>Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ hotline hỗ trợ.
      </p>
    </div>
  `;

  if (process.env.GMAIL_API_URL) {
    try {
      const response = await fetch(process.env.GMAIL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html })
      });
      const resData = await response.json();
      if (resData && resData.success) {
        return true;
      }
    } catch (error) {
      console.error('Google Apps Script sendBookingConfirmationEmail API error:', error);
    }
  }

  // Fallback to standard Nodemailer SMTP
  try {
    const config = requireSmtpConfig();
    const transporter = getTransporter();
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      text: `Xác nhận giữ chỗ thành công cho đơn ${bookingId}. Trạng thái đang được xử lý.`,
      html
    });
    return true;
  } catch (error) {
    console.error('Nodemailer sendBookingConfirmationEmail error:', error);
    return false;
  }
}

module.exports = { assertMailDomainCanReceive, sendOtpEmail, sendItineraryInviteEmail, sendBookingConfirmationEmail };
