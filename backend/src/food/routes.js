const router = require("express").Router();
const { authMiddleware, checkRole } = require("../middlewares/auth.middleware");
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
  wrap(async (req, res) => {
    const rows = await m
      .places()
      .find({ status: "published" })
      .sort({ createdAt: 1, id: 1 })
      .toArray();
    res.json(rows.map(m.publicRow));
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
          .find({ status: { $ne: "deleted" } })
          .sort({ createdAt: 1 })
          .toArray()
      ).map(m.publicRow),
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
    res.json({ success: true });
  }),
);
router.post(
  "/places/:id/reservations",
  authMiddleware,
  wrap(async (req, res) => {
    const place = await m
      .places()
      .findOne({ id: req.params.id, status: "published" });
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
