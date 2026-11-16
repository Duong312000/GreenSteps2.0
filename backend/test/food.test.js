const { test } = require("node:test");
const assert = require("node:assert/strict");
const m = require("../src/food/model");
const valid = () => ({
  name: "Quán kiểm thử",
  destination: "Đà Lạt",
  address: "Địa chỉ demo",
  description: "Món ăn địa phương",
  image: "/image/food/vegan.jpg",
  hours: "08:00 – 21:00",
  priceUnit: "người",
  category: "Quán chay",
  status: "published",
  priceMin: 100000,
  priceMax: 200000,
  rating: 4.8,
  reviewCount: 12,
  capacity: 20,
  features: ["Thuần chay"],
  menu: [{ name: "Cơm chay", price: 100000 }],
});
test("Food validation rejects unsafe images, invalid prices, categories and menus", () => {
  assert.equal(m.validate(valid()).name, "Quán kiểm thử");
  for (const patch of [
    { image: "javascript:alert(1)" },
    { image: "//evil.test/a.jpg" },
    { priceMax: 1 },
    { priceMin: "100" },
    { category: "unknown" },
    { capacity: 1.5 },
    { rating: NaN },
    { menu: Array.from({ length: 31 }, () => ({ name: 'Dish', price: 100 })) },
    { menu: [{ name: "", price: -1 }] },
    { features: ["fake"] },
    { status: "active" },
  ])
    assert.throws(() => m.validate({ ...valid(), ...patch }), { status: 400 });
});
test("Public-source places preserve unknown facts and reject unsupported bookings", () => {
  const place = { ...valid(), priceMin: null, priceMax: null, rating: null, reviewCount: null, capacity: null, menu: [], bookingEnabled: false };
  const checked = m.validate(place);
  assert.equal(checked.priceMin, null);
  assert.equal(checked.rating, null);
  assert.deepEqual(checked.menu, []);
  assert.equal(m.validate({ ...place, menu: [{ name: 'Dish', price: null }] }).menu[0].price, null);
  assert.throws(() => m.validate({ ...place, priceMin: 100 }), { status: 400 });
  assert.throws(() => m.validateReservation({}, place), { status: 400 });
  assert.ok(m.validate({ ...place, image: 'data:image/jpeg;base64,/9j/AA==' }).image.startsWith('data:image/'));
  assert.throws(() => m.validate({ ...place, image: 'data:image/svg+xml;base64,AAAA' }), { status: 400 });
});
test("Reservations validate real Vietnam dates, future times and party size", () => {
  const place = valid(),
    now = new Date("2026-11-13T00:00:00Z");
  const body = {
    date: "2026-11-14",
    time: "12:00",
    guests: 2,
    phone: "0901234567",
    fullname: "Khách demo",
  };
  assert.equal(m.validateReservation(body, place, now).guests, 2);
  for (const patch of [
    { date: "2026-11-12" },
    { date: "2027-02-30" },
    { date: "2026-99-99" },
    { time: "25:00" },
    { guests: 21 },
    { guests: 1.5 },
    { phone: "abc" },
    { fullname: "" },
  ])
    assert.throws(
      () => m.validateReservation({ ...body, ...patch }, place, now),
      { status: 400 },
    );
});
test(
  "Food API integration: role enforcement, CRUD synchronization, conflicts and reservation lifecycle",
  { skip: process.env.FOOD_INTEGRATION !== "1", timeout: 120000 },
  async (t) => {
    const jwt = require("jsonwebtoken");
    const { User } = require("../src/models");
    const { JWT_SECRET } = require("../src/middlewares/auth.middleware");
    const app = require("../src/app");
    await m.init();
    const tag = `food-check-${m.randomUUID()}`,
      users = [],
      placeIds = [],
      reservationIds = [];
    const server = app.listen(0),
      base = `http://127.0.0.1:${server.address().port}/api/food`;
    async function request(path, method = "GET", body, user) {
      const r = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, data: await r.json() };
    }
    try {
      for (const role of ["admin", "traveler"]) {
        const id = `${tag}-${role}`;
        await User.create({
          id,
          username: id,
          email: `${id}@greensteps.invalid`,
          role,
          password_hash: "disabled-test-account",
        });
        users.push({
          id,
          token: jwt.sign({ id, role }, JWT_SECRET, { expiresIn: "10m" }),
        });
      }
      const [admin, traveler] = users;
      assert.equal((await request("/admin/places")).status, 401);
      assert.equal(
        (await request("/admin/places", "GET", null, traveler)).status,
        403,
      );
      assert.equal(
        (await request("/admin/places", "POST", valid(), traveler)).status,
        403,
      );
      assert.equal(
        (
          await request(
            "/admin/places",
            "POST",
            { ...valid(), priceMin: -1 },
            admin,
          )
        ).status,
        400,
      );
      let r = await request(
        "/admin/places",
        "POST",
        { ...valid(), name: tag },
        admin,
      );
      assert.equal(r.status, 201);
      const id = r.data.id;
      placeIds.push(id);
      assert.ok((await request("/places")).data.some((p) => p.id === id));
      r = await request(
        `/admin/places/${id}`,
        "PUT",
        { ...r.data, name: `${tag}-updated` },
        admin,
      );
      assert.equal(r.status, 200);
      assert.equal(r.data.version, 2);
      assert.equal(
        (await request("/places")).data.find((p) => p.id === id).name,
        `${tag}-updated`,
      );
      assert.equal(
        (
          await request(
            `/admin/places/${id}`,
            "PUT",
            { ...r.data, version: 1 },
            admin,
          )
        ).status,
        409,
      );
      const body = {
        date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
        time: "12:00",
        guests: 2,
        phone: "0901234567",
        fullname: "Khách kiểm thử",
      };
      assert.equal(
        (await request(`/places/${id}/reservations`, "POST", body)).status,
        401,
      );
      assert.equal(
        (
          await request(
            `/places/${id}/reservations`,
            "POST",
            { ...body, guests: 21 },
            traveler,
          )
        ).status,
        400,
      );
      const reservation = await request(
        `/places/${id}/reservations`,
        "POST",
        { ...body, status: "confirmed", userId: admin.id },
        traveler,
      );
      assert.equal(reservation.status, 201);
      reservationIds.push(reservation.data.id);
      assert.equal(reservation.data.status, "pending");
      assert.equal(reservation.data.userId, traveler.id);
      assert.ok(
        (await request("/admin/reservations", "GET", null, admin)).data.some(
          (b) => b.id === reservation.data.id,
        ),
      );
      assert.equal(
        (
          await request(
            `/admin/reservations/${reservation.data.id}`,
            "PATCH",
            { status: "confirmed" },
            traveler,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            `/admin/reservations/${reservation.data.id}`,
            "PATCH",
            { status: "confirmed" },
            admin,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            `/admin/reservations/${reservation.data.id}`,
            "PATCH",
            { status: "cancelled" },
            admin,
          )
        ).status,
        409,
      );
      r = await request(
        `/admin/places/${id}`,
        "PUT",
        { ...r.data, status: "hidden" },
        admin,
      );
      assert.equal(r.status, 200);
      assert.ok(!(await request("/places")).data.some((p) => p.id === id));
      assert.equal(
        (await request(`/places/${id}/reservations`, "POST", body, traveler))
          .status,
        404,
      );
      assert.equal(
        (await request(`/admin/places/${id}`, "DELETE", { version: 1 }, admin))
          .status,
        409,
      );
      assert.equal(
        (
          await request(
            `/admin/places/${id}`,
            "DELETE",
            { version: r.data.version },
            admin,
          )
        ).status,
        200,
      );
      assert.ok(
        !(await request("/admin/places", "GET", null, admin)).data.some(
          (p) => p.id === id,
        ),
      );
      assert.equal(
        (await m.reservations().findOne({ id: reservation.data.id })).status,
        "confirmed",
      );
    } finally {
      await m.reservations().deleteMany({ id: { $in: reservationIds } });
      await m.places().deleteMany({ id: { $in: placeIds } });
      for (const u of users) await User.destroy({ where: { id: u.id } });
      await new Promise((resolve) => server.close(resolve));
      await m.store.close();
    }
  },
);
