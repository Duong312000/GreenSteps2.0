const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

function hasImageSignature(bytes, mimeType) {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (mimeType === 'image/avif') return bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp' && /^(avif|avis)$/.test(bytes.toString('ascii', 8, 12));
  return false;
}

function decodeImageDataUri(dataUri, { maxBytes = MAX_IMAGE_BYTES } = {}) {
  if (typeof dataUri !== 'string' || dataUri.length > Math.ceil(maxBytes * 4 / 3) + 128) throw new Error('Image payload exceeds the allowed size.');
  const match = /^data:(image\/(?:jpeg|png|webp|avif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUri);
  if (!match) throw new Error('Unsupported image data URI.');
  const mimeType = match[1];
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > maxBytes) throw new Error('Image payload exceeds the allowed size.');
  if (!hasImageSignature(bytes, mimeType)) throw new Error('Image content signature does not match the declared MIME type.');
  return { bytes, mimeType, extension: MIME_EXTENSIONS[mimeType], checksum: crypto.createHash('sha256').update(bytes).digest('hex') };
}

function createLocalMediaAdapter({ rootDir, publicBaseUrl = '/uploads/catalog' }) {
  if (!rootDir || !path.isAbsolute(rootDir)) throw new Error('Local media storage requires an absolute root directory.');
  return {
    provider: 'local',
    async upload({ bytes, mimeType }) {
      const extension = MIME_EXTENSIONS[mimeType];
      if (!extension || !hasImageSignature(bytes, mimeType) || bytes.length > MAX_IMAGE_BYTES) throw new Error('Invalid image upload.');
      const key = `${crypto.randomUUID()}.${extension}`;
      await fs.mkdir(rootDir, { recursive: true });
      await fs.writeFile(path.join(rootDir, key), bytes, { flag: 'wx' });
      return {
        storageProvider: 'local', storageKey: key,
        url: `${publicBaseUrl.replace(/\/$/, '')}/${key}`,
        checksum: crypto.createHash('sha256').update(bytes).digest('hex'), byteSize: bytes.length, mimeType
      };
    },
    async delete(storageKey) {
      if (!storageKey || path.basename(storageKey) !== storageKey) throw new Error('Invalid media storage key.');
      await fs.unlink(path.join(rootDir, storageKey)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  };
}

function createCloudinaryMediaAdapter({ cloudName, uploader }) {
  if (!cloudName || typeof uploader !== 'function') throw new Error('Cloudinary media storage configuration is required.');
  return {
    provider: 'cloudinary',
    async upload({ bytes, mimeType, publicId }) {
      if (!MIME_EXTENSIONS[mimeType] || !hasImageSignature(bytes, mimeType) || bytes.length > MAX_IMAGE_BYTES) throw new Error('Invalid image upload.');
      const uploaded = await uploader({ cloudName, bytes, mimeType, publicId });
      if (!uploaded?.public_id || !uploaded?.secure_url) throw new Error('Media provider did not confirm the uploaded asset.');
      const variant = transform => uploaded.secure_url.replace('/upload/', `/upload/${transform}/`);
      return {
        storageProvider: 'cloudinary', storageKey: uploaded.public_id,
        url: uploaded.secure_url, checksum: crypto.createHash('sha256').update(bytes).digest('hex'),
        byteSize: Number(uploaded.bytes) || bytes.length, mimeType,
        variants: [
          { name: 'thumbnail', width: 320, format: 'auto', url: variant('f_auto,q_auto,w_320,c_limit') },
          { name: 'card', width: 640, format: 'auto', url: variant('f_auto,q_auto,w_640,c_limit') },
          { name: 'hero', width: 1600, format: 'auto', url: variant('f_auto,q_auto,w_1600,c_limit') }
        ]
      };
    },
    async delete() { throw new Error('Cloudinary deletion requires an approved provider workflow.'); }
  };
}

function createCloudinaryUploader({ apiKey, apiSecret, fetchImpl = fetch }) {
  if (!apiKey || !apiSecret) throw new Error('Cloudinary server credentials are required.');
  return async ({ cloudName, bytes, mimeType, publicId }) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { public_id: publicId || `catalog/${crypto.randomUUID()}`, timestamp };
    const toSign = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
    const signature = crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
    const form = new FormData();
    form.set('file', new Blob([bytes], { type: mimeType }), 'upload');
    form.set('api_key', apiKey);
    form.set('timestamp', String(timestamp));
    form.set('public_id', params.public_id);
    form.set('signature', signature);
    const response = await fetchImpl(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: 'POST', body: form });
    if (!response.ok) throw new Error('Media provider upload failed.');
    const body = await response.json();
    return { public_id: body.public_id, secure_url: body.secure_url, bytes: body.bytes };
  };
}

function createMediaAdapterFromEnv(env = process.env, options = {}) {
  if (env.MEDIA_STORAGE_PROVIDER === 'cloudinary') {
    const uploader = options.uploader || createCloudinaryUploader({ apiKey: env.CLOUDINARY_API_KEY, apiSecret: env.CLOUDINARY_API_SECRET, fetchImpl: options.fetchImpl });
    return createCloudinaryMediaAdapter({ cloudName: env.CLOUDINARY_CLOUD_NAME, uploader });
  }
  if (env.MEDIA_STORAGE_PROVIDER && env.MEDIA_STORAGE_PROVIDER !== 'local') throw new Error('Unsupported media storage provider.');
  return createLocalMediaAdapter({ rootDir: options.rootDir || path.resolve(__dirname, '../../uploads/catalog'), publicBaseUrl: '/uploads/catalog' });
}

module.exports = { MAX_IMAGE_BYTES, decodeImageDataUri, createLocalMediaAdapter, createCloudinaryMediaAdapter, createCloudinaryUploader, createMediaAdapterFromEnv };
