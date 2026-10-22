// Only Google-verified profile data may be used to create an application session.
function googleError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}
async function verifyGoogleAccessToken(accessToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw googleError('Chưa cấu hình Google Client ID trên máy chủ.', 503);
  if (typeof accessToken !== 'string' || !accessToken || accessToken.length > 4096) {
    throw googleError('Thiếu token xác thực Google hợp lệ.', 400);
  }
  try {
    const infoResponse = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(accessToken), { signal: AbortSignal.timeout(10000) });
    const info = await infoResponse.json();
    if (!infoResponse.ok || info.aud !== clientId || !(Number(info.expires_in) > 0)) {
      throw googleError('Phiên Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.', 401);
    }
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(10000)
    });
    const profile = await response.json();
    if (!response.ok || !profile.sub || !profile.email || profile.email_verified !== true || info.sub !== profile.sub) {
      throw googleError('Google chưa xác minh địa chỉ email của tài khoản này.', 401);
    }
    // Google must be authoritative for the email before matching an existing account.
    if (!profile.email.toLowerCase().endsWith('@gmail.com') && !profile.hd) {
      throw googleError('Vui lòng dùng Gmail hoặc tài khoản Google Workspace để đăng nhập.', 401);
    }
    return { email: profile.email.toLowerCase(), fullname: profile.name || profile.email.split('@')[0], avatarUrl: profile.picture || '', sub: profile.sub };
  } catch (error) {
    if (error.statusCode) throw error;
    throw googleError('Không kết nối được Google. Vui lòng thử lại.', 503);
  }
}
module.exports = { verifyGoogleAccessToken };
