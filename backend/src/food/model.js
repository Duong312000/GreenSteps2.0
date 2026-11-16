const { store } = require("../config/db.config");
const { randomUUID } = require("node:crypto");
const categories = [
  "Quán chay",
  "Đặc sản địa phương",
  "Cà phê & trà",
  "Set ăn & buffet",
];
const features = [
  "Thuần chay",
  "Chay có trứng sữa",
  "Chỗ đỗ xe",
  "Không gian ngoài trời",
  "Nguyên liệu địa phương",
  "Hạn chế nhựa",
];
const fail = (message) => Object.assign(new Error(message), { status: 400 });
const places = () => store.db.collection("local_food_places");
const reservations = () => store.db.collection("local_food_reservations");
let ready;
async function init() {
  if (!ready)
    ready = (async () => {
      await store.authenticate();
      await places().createIndex({ id: 1 }, { unique: true });
      await places().createIndex({ status: 1, destination: 1, category: 1 });
      await reservations().createIndex({ id: 1 }, { unique: true });
      await reservations().createIndex({ userId: 1, createdAt: -1 });
    })().catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}
function validate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw fail("Dữ liệu địa điểm không hợp lệ.");
  const out = {};
  for (const key of [
    "name",
    "destination",
    "address",
    "description",
    "image",
    "hours",
    "priceUnit",
  ]) {
    const value = input[key];
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > (key === "description" ? 3000 : key === "image" ? 2000000 : 500)
    )
      throw fail(`Vui lòng kiểm tra trường ${key}.`);
    out[key] = value.trim();
  }
  if (
    !/^https:\/\/[^\s]+$/.test(out.image) &&
    !/^\/image\/[\w./-]+$/.test(out.image) &&
    !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(out.image)
  )
    throw fail("Ảnh phải là URL HTTPS, đường dẫn /image/ hoặc ảnh base64.");
  if (!categories.includes(input.category))
    throw fail("Loại quán không hợp lệ.");
  if (!["published", "hidden"].includes(input.status))
    throw fail("Trạng thái không hợp lệ.");
  out.category = input.category;
  out.status = input.status;
  for (const [key, max] of [
    ["priceMin", 100000000],
    ["priceMax", 100000000],
    ["rating", 5],
    ["reviewCount", 1000000],
    ["capacity", 1000],
  ]) {
    const value = input[key];
    if (value === null) { out[key] = null; continue; }
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > max ||
      (key !== "rating" && !Number.isInteger(value))
    )
      throw fail(`Giá trị ${key} không hợp lệ.`);
    out[key] = value;
  }
  if ((out.capacity !== null && out.capacity < 1) ||
    (out.priceMax !== null && out.priceMin !== null && out.priceMax < out.priceMin) ||
    ((out.priceMin === null) !== (out.priceMax === null)))
    throw fail("Sức chứa hoặc khoảng giá không hợp lệ.");
  if (
    !Array.isArray(input.features) ||
    input.features.some((x) => !features.includes(x))
  )
    throw fail("Tiện ích không hợp lệ.");
  out.features = [...new Set(input.features)];
  if (
    !Array.isArray(input.menu) ||
    input.menu.length > 30
  )
    throw fail("Thực đơn không được vượt quá 30 món.");
  out.menu = input.menu.map((item) => {
    if (
      !item ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      item.name.length > 120 ||
      (item.price !== null && (!Number.isInteger(item.price) || item.price < 0 || item.price > 100000000))
    )
      throw fail("Món ăn hoặc giá món không hợp lệ.");
    return { name: item.name.trim(), price: item.price };
  });
  return out;
}
function validateReservation(input, place, now = new Date()) {
  if (place.bookingEnabled === false) throw fail("Vui lòng liên hệ trực tiếp với quán để đặt bàn.");
  const date = input?.date,
    time = input?.time;
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    typeof time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw fail("Vui lòng chọn ngày và giờ đến hợp lệ.");
  const arrival = new Date(`${date}T${time}:00+07:00`);
  if (!Number.isFinite(+arrival)) throw fail("Ngày đến không hợp lệ.");
  const localDay = new Date(+arrival + 7 * 3600000).toISOString().slice(0, 10);
  if (localDay !== date || arrival <= now || +arrival > +now + 365 * 86400000)
    throw fail("Chọn thời gian trong tương lai, tối đa 1 năm.");
  if (
    !Number.isInteger(input.guests) ||
    input.guests < 1 ||
    input.guests > (place.capacity ?? 1000)
  )
    throw fail(`Số khách từ 1 đến ${place.capacity}.`);
  if (
    typeof input.phone !== "string" ||
    !/^(\+84|0)[0-9]{9,10}$/.test(input.phone)
  )
    throw fail("Số điện thoại không hợp lệ.");
  if (
    typeof input.fullname !== "string" ||
    !input.fullname.trim() ||
    input.fullname.length > 100
  )
    throw fail("Vui lòng nhập tên liên hệ.");
  return {
    date,
    time,
    guests: input.guests,
    phone: input.phone,
    fullname: input.fullname.trim(),
  };
}
function publicRow({ _id, ...row }) {
  return row;
}
module.exports = {
  store,
  init,
  places,
  reservations,
  categories,
  features,
  validate,
  validateReservation,
  publicRow,
  randomUUID,
};
