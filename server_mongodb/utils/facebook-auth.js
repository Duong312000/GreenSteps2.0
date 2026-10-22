const { createHmac } = require('node:crypto');
function facebookConfig() {
  const { FACEBOOK_APP_ID: appId, FACEBOOK_APP_SECRET: secret, FACEBOOK_GRAPH_VERSION: version } = process.env;
  return { appId: appId || '', version: version || '', enabled: !!(appId && secret && /^v[0-9]+\.0$/.test(version || '')) };
}
const failure = (message, statusCode) => Object.assign(new Error(message), { statusCode });
async function verifyFacebookAccessToken(accessToken) {
  const { appId, version, enabled } = facebookConfig();
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!enabled) throw failure('Facebook Login chưa được cấu hình trên máy chủ.', 503);
  if (typeof accessToken !== 'string' || !accessToken || accessToken.length > 4096) throw failure('Thiếu token Facebook hợp lệ.', 400);
  try {
    const base = 'https://graph.facebook.com/' + version;
    const response = await fetch(base + '/debug_token?input_token=' + encodeURIComponent(accessToken), {
      headers: { Authorization: 'Bearer ' + appId + '|' + secret }, signal: AbortSignal.timeout(10000)
    });
    const { data } = await response.json();
    const now = Date.now() / 1000;
    if (!response.ok || !data || !data.is_valid || data.type !== 'USER' || String(data.app_id) !== appId || !data.user_id || !(data.expires_at > now) || (data.data_access_expires_at && data.data_access_expires_at <= now)) {
      throw failure('Phiên Facebook không hợp lệ hoặc đã hết hạn.', 401);
    }
    const proof = createHmac('sha256', secret).update(accessToken).digest('hex');
    const profileResponse = await fetch(base + '/me?fields=id,name,email,picture&appsecret_proof=' + proof, {
      headers: { Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(10000)
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || profile.id !== data.user_id) throw failure('Không xác minh được tài khoản Facebook.', 401);
    if (!profile.email) throw failure('Facebook chưa cung cấp email. Hãy cấp quyền email hoặc đăng ký bằng email.', 400);
    return { facebookId: profile.id, email: profile.email.toLowerCase(), fullname: profile.name || 'Facebook user', avatarUrl: profile.picture?.data?.url || '' };
  } catch (error) {
    if (error.statusCode) throw error;
    throw failure('Không kết nối được Facebook. Vui lòng thử lại.', 503);
  }
}
module.exports = { facebookConfig, verifyFacebookAccessToken };
