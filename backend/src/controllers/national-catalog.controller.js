const { AdminArea, Region, Destination } = require('../models');
const { listCatalog, getPublishedBySlug } = require('../services/national-catalog.service');

const handleList = (model, filterItem) => async (req, res, next) => {
  try {
    const result = await listCatalog({ model, query: req.query, filterItem });
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
};

exports.getRegions = handleList(Region);
exports.getProvinces = handleList(AdminArea, (row, query) => !query.type || row.type === query.type);
exports.getDestinations = handleList(Destination, (row, query) => {
  if (query.region && row.regionId !== `region:${query.region}`) return false;
  if (query.province && !(row.adminAreaIds || []).includes(`admin-area:${query.province}`)) return false;
  return true;
});

exports.getDestinationBySlug = async (req, res, next) => {
  try {
    const destination = await getPublishedBySlug(Destination, req.params.slug);
    if (!destination) return res.status(404).json({ success: false, message: 'Không tìm thấy điểm đến.' });
    res.json({ success: true, item: destination });
  } catch (error) { next(error); }
};
