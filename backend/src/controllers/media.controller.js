const { randomUUID } = require('node:crypto');
const { MediaAsset } = require('../models');
const { decodeImageDataUri, createMediaAdapterFromEnv } = require('../services/media-storage.service');

const validSourceTypes = new Set(['partner_upload', 'licensed_stock', 'official_open_data']);

exports.uploadImage = async (req, res, next) => {
  if (process.env.MEDIA_UPLOAD_ENABLED !== 'true') return res.status(503).json({ success: false, code: 'MEDIA_UPLOAD_DISABLED', message: 'Chức năng tải ảnh hiện chưa được bật.' });
  try {
    const parsed = decodeImageDataUri(req.body?.dataUri);
    const sourceType = validSourceTypes.has(req.body?.sourceType) ? req.body.sourceType : 'partner_upload';
    const sourceUrl = typeof req.body?.sourceUrl === 'string' ? req.body.sourceUrl.slice(0, 2048) : null;
    const adapter = createMediaAdapterFromEnv(process.env);
    const stored = await adapter.upload({ ...parsed, publicId: `greensteps/${randomUUID()}` });
    const asset = await MediaAsset.create({
      id: `media:${randomUUID()}`, ...stored, publicUrl: stored.url, sourceType, sourceUrl,
      photographer: typeof req.body?.photographer === 'string' ? req.body.photographer.slice(0, 200) : null,
      licenseId: typeof req.body?.licenseId === 'string' ? req.body.licenseId.slice(0, 200) : null,
      attributionText: typeof req.body?.attributionText === 'string' ? req.body.attributionText.slice(0, 500) : null,
      rightsEvidence: typeof req.body?.rightsEvidence === 'string' ? req.body.rightsEvidence.slice(0, 2048) : null,
      verificationStatus: 'pending_review', ownerId: req.user.id, entityRefs: []
    });
    res.status(201).json({ success: true, item: asset });
  } catch (error) { next(error); }
};

exports.deleteImage = async (req, res, next) => {
  try {
    const asset = await MediaAsset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh.' });
    if (req.user.role !== 'admin' && asset.ownerId !== req.user.id) return res.status(403).json({ success: false, message: 'Bạn không có quyền gỡ ảnh này.' });
    asset.deletedAt = new Date();
    await asset.save();
    res.json({ success: true });
  } catch (error) { next(error); }
};
