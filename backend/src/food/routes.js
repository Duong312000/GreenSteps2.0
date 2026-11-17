const router = require("express").Router();
const { authMiddleware, checkRole } = require("../middlewares/auth.middleware");
const { cacheMiddleware, clearCache } = require("../middlewares/cache");
const m = require("./model");
const wrap = (fn) => async (req, res, next) => {
  try {
    await m.init();
    res.set("Cache-Control", "no-store");
    await fn(req, res);
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ message: e.message });
    next(e);
  }
};
const admin = [authMiddleware, checkRole(["admin"])];
router.get(
  "/places",
  cacheMiddleware(60),
  wrap(async (req, res) => {
    const rows = await m
      .places()
      // Public catalog pages can be read from an Atlas secondary. This keeps
      // the list available while the primary is electing or briefly unreachable.
      // Food records contain large base64 photos; keep them out of list reads
      // and return the source URL or a bundled fallback instead.
      .find({ status: "published" }, {
        readPreference: "primaryPreferred",
        projection: { image: 0 },
      })
      .sort({ createdAt: 1, id: 1 })
      .toArray();
    res.json(rows.map(row => m.publicRow({
      ...row,
      image: row.imageSource?.url || "/image/services/food_organic_vietnamese.png",
    })));
  }),
);
router.get(
  "/places/:id",
  wrap(async (req, res) => {
    let row = await m.places().findOne({ id: req.params.id, status: "published" });
    if (!row) {
      const legacy = await m.places().findOne({ id: req.params.id, status: "hidden", replacementId: { $exists: true } });
      if (legacy) row = await m.places().findOne({ id: legacy.replacementId, status: "published" });
    }
    if (!row) return res.status(404).json({ message: "Không tìm thấy địa điểm ẩm thực." });
    res.json(m.publicRow(row));
  }),
);
router.get(
  "/admin/places",
  ...admin,
  wrap(async (req, res) => {
    res.json(
      (
        await m
          .places()
          .find({ status: { $ne: "deleted" } }, { projection: { image: 0 } })
          .sort({ createdAt: 1 })
          .toArray()
      ).map(row => m.publicRow({
        ...row,
        image: row.imageSource?.url || "/image/services/food_organic_vietnamese.png",
      })),
    );
  }),
);
router.post(
  "/admin/places",
  ...admin,
  wrap(async (req, res) => {
    const row = {
      ...m.validate(req.body),
      id: m.randomUUID(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await m.places().insertOne(row);
    clearCache("/api/food/places");
    res.status(201).json(m.publicRow(row));
  }),
);
router.put(
  "/admin/places/:id",
  ...admin,
  wrap(async (req, res) => {
    const changes = m.validate(req.body);
    if (!Number.isInteger(req.body.version))
      return res.status(400).json({ message: "Thiếu phiên bản dữ liệu." });
    const row = await m
      .places()
      .findOneAndUpdate(
        {
          id: req.params.id,
          status: { $ne: "deleted" },
          version: req.body.version,
        },
        { $set: { ...changes, updatedAt: new Date() }, $inc: { version: 1 } },
        { returnDocument: "after" },
      );
    if (!row)
      return res
        .status(409)
        .json({
          message: "Địa điểm đã thay đổi. Tải lại danh sách trước khi sửa.",
        });
    clearCache("/api/food/places");
    res.json(m.publicRow(row));
  }),
);
router.delete(
  "/admin/places/:id",
  ...admin,
  wrap(async (req, res) => {
    const version = req.body?.version;
    if (!Number.isInteger(version))
      return res.status(400).json({ message: "Thiếu phiên bản dữ liệu." });
    const result = await m
      .places()
      .updateOne(
        { id: req.params.id, status: { $ne: "deleted" }, version },
        {
          $set: { status: "deleted", updatedAt: new Date() },
          $inc: { version: 1 },
        },
      );
    if (!result.matchedCount)
      return res
        .status(409)
        .json({ message: "Địa điểm đã thay đổi. Tải lại trước khi xóa." });
    clearCache("/api/food/places");
    res.json({ success: true });
  }),
);
router.post(
  "/places/:id/reservations",
  authMiddleware,
  wrap(async (req, res) => {
    const place = await m
      .places()
      .findOne({ id: req.params.id, status: "published" }, { projection: { image: 0 } });
    if (!place)
      return res
        .status(404)
        .json({ message: "Địa điểm không còn nhận yêu cầu." });
    const data = m.validateReservation(req.body, place);
    const row = {
      ...data,
      id: m.randomUUID(),
      placeId: place.id,
      placeName: place.name,
      userId: req.user.id,
      status: "pending",
      createdAt: new Date(),
    };
    await m.reservations().insertOne(row);
    res.status(201).json(m.publicRow(row));
  }),
);
router.get(
  "/admin/reservations",
  ...admin,
  wrap(async (req, res) => {
    res.json(
      (
        await m
          .reservations()
          .find({})
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray()
      ).map(m.publicRow),
    );
  }),
);
router.patch(
  "/admin/reservations/:id",
  ...admin,
  wrap(async (req, res) => {
    if (!["confirmed", "cancelled"].includes(req.body.status))
      return res.status(400).json({ message: "Trạng thái không hợp lệ." });
    const result = await m
      .reservations()
      .updateOne(
        { id: req.params.id, status: "pending" },
        {
          $set: {
            status: req.body.status,
            updatedAt: new Date(),
            updatedBy: req.user.id,
          },
        },
      );
    if (!result.matchedCount)
      return res
        .status(409)
        .json({ message: "Yêu cầu đã được xử lý. Vui lòng tải lại." });
    res.json({ success: true });
  }),
);
module.exports = router;
