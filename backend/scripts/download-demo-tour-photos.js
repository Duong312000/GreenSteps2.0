const fs = require('node:fs/promises');
const path = require('node:path');
const photoManifest = require('../../docs/plans/greensteps-tour-photo-enrichment/photo-manifest.json');

const workspaceRoot = path.resolve(__dirname, '../..');
const publicRoot = path.join(workspaceRoot, 'my-app', 'public');
const shouldDownload = process.argv.includes('--download');

function targetPathFor(assetPath) {
  const targetPath = path.resolve(publicRoot, assetPath);
  if (!targetPath.startsWith(`${publicRoot}${path.sep}`)) throw new Error(`Unsafe asset path: ${assetPath}`);
  return targetPath;
}

function getThumbnailUrl(photo) {
  if (!photo.sourceFileUrl?.startsWith('https://upload.wikimedia.org/')) {
    throw new Error(`Missing verified Commons original URL for ${photo.assetPath}`);
  }
  if (!/^[a-f0-9]{40}$/i.test(photo.sourceSha1 || '')) {
    throw new Error(`Missing verified Commons SHA-1 for ${photo.assetPath}`);
  }
  if (!photo.author || !photo.licenseId || !photo.licenseUrl) {
    throw new Error(`Missing attribution or license metadata for ${photo.assetPath}`);
  }
  let url;
  try {
    url = new URL(photo.sourceThumbnailUrl);
  } catch {
    throw new Error(`Missing verified thumbnail URL for ${photo.assetPath}`);
  }
  if (url.protocol !== 'https:' || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname)) {
    throw new Error(`Unexpected Commons thumbnail host for ${photo.assetPath}: ${url.hostname}`);
  }
  if (!photo.sourceMime?.startsWith('image/')) throw new Error(`Missing source MIME metadata for ${photo.assetPath}`);
  return url.toString();
}

function validateDownloadedJpeg(bytes, contentType) {
  const mimeType = (contentType || '').split(';')[0].trim().toLowerCase();
  if (mimeType !== 'image/jpeg') throw new Error(`Expected image/jpeg, received ${mimeType || 'no content type'}`);
  if (!Buffer.isBuffer(bytes) || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error('Invalid JPEG signature');
  }
  if (bytes.length < 10_000 || bytes.length > 5_000_000) {
    throw new Error(`Unexpected JPEG size: ${bytes?.length || 0} bytes`);
  }
  return true;
}

async function fetchPhoto(photo, retries = 3) {
  const thumbnailUrl = getThumbnailUrl(photo);
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(thumbnailUrl, {
        headers: { 'user-agent': 'GreenSteps-Demo-Catalog/1.0 (photo attribution in repository manifest)' },
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          const retryAfter = Number(response.headers.get('retry-after'));
          await new Promise(resolve => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 1500));
          continue;
        }
        throw new Error(`Wikimedia thumbnail returned HTTP ${response.status} for ${photo.sourcePage}`);
      }
      const mimeType = response.headers.get('content-type');
      const bytes = Buffer.from(await response.arrayBuffer());
      validateDownloadedJpeg(bytes, mimeType);
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < retries && (error.cause || /fetch failed|socket|network|HTTP 429|HTTP 5\d\d/i.test(error.message))) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1500));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error(`Unable to download ${photo.sourcePage}`);
}

async function downloadPhoto(photo) {
  const targetPath = targetPathFor(photo.assetPath);
  try {
    const existing = await fs.stat(targetPath);
    if (existing.size >= 10_000 && existing.size <= 5_000_000) return { path: photo.assetPath, bytes: existing.size, skipped: true };
    throw new Error(`Existing file has an unexpected size: ${photo.assetPath} (${existing.size} bytes)`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const bytes = await fetchPhoto(photo);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, bytes, { flag: 'wx' });
  return { path: photo.assetPath, bytes: bytes.length };
}

async function main() {
  if (!shouldDownload) {
    process.stdout.write(`Dry run: ${photoManifest.length} Commons thumbnails are listed. Pass --download to fetch and save them.\n`);
    return;
  }
  const results = [];
  for (const photo of photoManifest) {
    const result = await downloadPhoto(photo);
    results.push(result);
    process.stdout.write(`${result.skipped ? 'Already present' : 'Downloaded'}: ${result.path} (${result.bytes} bytes)\n`);
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  const downloaded = results.filter(item => !item.skipped);
  process.stdout.write(`Downloaded ${downloaded.length} reviewed images; ${results.length - downloaded.length} were already present. Total bytes: ${results.reduce((sum, item) => sum + item.bytes, 0)}\n`);
}

if (require.main === module) main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

module.exports = { getThumbnailUrl, targetPathFor, validateDownloadedJpeg, fetchPhoto, downloadPhoto };
