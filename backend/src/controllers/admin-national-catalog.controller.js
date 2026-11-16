const { Op } = require('../db/mongo-store');
const { AdminArea, Region, Destination, Schedule, MediaAsset } = require('../models');
const { listCatalog } = require('../services/national-catalog.service');
const adminCatalog = require('../services/admin-national-catalog.service');

exports.getDestinations = async (req, res, next) => {
  try { res.json({ success: true, ...(await listCatalog({ model: Destination, query: req.query, allowedStatuses: ['draft', 'editorial', 'published', 'archived'] })) }); }
  catch (error) { next(error); }
};

exports.saveDestination = async (req, res) => {
  try {
    const item = await adminCatalog.saveDestination({ AdminArea, Region, Destination, MediaAsset }, req.params.id || null, req.body);
    if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy điểm đến.' });
    res.status(req.params.id ? 200 : 201).json({ success: true, item });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.verifyMedia = async (req, res) => {
  try {
    const asset = await MediaAsset.findByPk(req.params.id);
    if (!asset || asset.deletedAt) return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh.' });
    if (!asset.rightsEvidence || (!asset.licenseId && asset.sourceType !== 'partner_upload')) {
      return res.status(409).json({ success: false, message: 'Cần hồ sơ quyền sử dụng trước khi xác minh ảnh.' });
    }
    asset.verificationStatus = 'verified';
    await asset.save();
    res.json({ success: true, item: asset });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.createTour = async (req, res) => {
  try {
    const item = await adminCatalog.createEditorialTour({ Destination, Schedule, MediaAsset }, req.body);
    res.status(201).json({ success: true, item });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.updateTour = async (req, res) => {
  try {
    const item = await adminCatalog.saveEditorialTour({ Destination, Schedule, MediaAsset }, req.params.id, req.body);
    res.json({ success: true, item });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.getReviewQueue = async (_req, res, next) => {
  try {
    const [destinations, tours, regions, provinces, media] = await Promise.all([
      Destination.findAll({ where: { status: { [Op.in]: ['draft', 'editorial'] } }, order: [['updatedAt', 'DESC']], limit: 100 }),
      Schedule.findAll({ where: { catalog_status: { [Op.in]: ['draft', 'editorial', 'demo'] } }, order: [['updatedAt', 'DESC']], limit: 100 }),
      Region.findAll({ where: { status: 'draft' }, limit: 100 }),
      AdminArea.findAll({ where: { status: 'draft' }, limit: 100 }),
      MediaAsset.findAll({ where: { verificationStatus: 'pending_review' }, order: [['createdAt', 'DESC']], limit: 100 })
    ]);
    res.json({ success: true, destinations, tours, regions, provinces, media });
  } catch (error) { next(error); }
};
