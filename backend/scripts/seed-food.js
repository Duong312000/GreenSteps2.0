require("../src/config/env");
const m = require("../src/food/model");
const image = (name) =>
  `/image/food/${name}.${["home", "cafe"].includes(name) ? "png" : "jpg"}`;
const rows = [
  [
    "bep-chay-la-phong",
    "Bếp Chay Lá Phong",
    "Quán chay",
    100000,
    180000,
    4.8,
    36,
    "vegetarian",
    ["Thuần chay", "Chỗ đỗ xe", "Nguyên liệu địa phương"],
    "Bữa chay thanh đạm từ rau củ Đà Lạt, trong không gian gỗ ấm áp.",
    [
      { name: "Cơm chay rau củ theo mùa", price: 100000 },
      { name: "Lẩu nấm vườn", price: 180000 },
    ],
  ],
  [
    "nha-hang-vuon-rau",
    "Nhà hàng Vườn Rau",
    "Đặc sản địa phương",
    150000,
    250000,
    4.7,
    52,
    "local",
    ["Chỗ đỗ xe", "Không gian ngoài trời", "Nguyên liệu địa phương"],
    "Món Việt đậm vị với nguồn rau theo mùa từ những khu vườn địa phương.",
    [
      { name: "Bánh xèo rau vườn", price: 150000 },
      { name: "Mâm rau củ và món Việt", price: 250000 },
    ],
  ],
  [
    "tra-chieu-cau-dat",
    "Trà chiều Cầu Đất",
    "Set ăn & buffet",
    195000,
    195000,
    4.8,
    28,
    "tea",
    ["Không gian ngoài trời", "Nguyên liệu địa phương", "Hạn chế nhựa"],
    "Một ấm trà thơm, bánh ngọt và khoảng lặng nhìn ra đồi xanh.",
    [{ name: "Set trà chiều cho 2 người", price: 195000 }],
  ],
  [
    "an-nhien-vegan",
    "An Nhiên Vegan",
    "Quán chay",
    100000,
    200000,
    4.9,
    41,
    "vegan",
    ["Thuần chay", "Nguyên liệu địa phương", "Hạn chế nhựa"],
    "Bát rau củ tươi, đậu hũ và ngũ cốc cho một bữa ăn nhẹ nhàng.",
    [
      { name: "Bowl rau củ và đậu hũ", price: 100000 },
      { name: "Set thuần chay theo mùa", price: 200000 },
    ],
  ],
  [
    "bep-nha-da-lat",
    "Bếp Nhà Đà Lạt",
    "Đặc sản địa phương",
    120000,
    220000,
    4.7,
    39,
    "home",
    ["Chỗ đỗ xe", "Nguyên liệu địa phương"],
    "Cơm nhà, canh nóng và những hương vị mộc mạc của cao nguyên.",
    [
      { name: "Cơm nhà theo mùa", price: 120000 },
      { name: "Mâm cơm cao nguyên", price: 220000 },
    ],
  ],
  [
    "ca-phe-vuon-thong",
    "Cà phê Vườn Thông",
    "Cà phê & trà",
    50000,
    120000,
    4.8,
    60,
    "cafe",
    ["Chay có trứng sữa", "Không gian ngoài trời", "Hạn chế nhựa"],
    "Nhâm nhi cà phê giữa vườn thông, bên khung cửa ngập ánh nắng.",
    [
      { name: "Cà phê phin", price: 50000 },
      { name: "Trà và bánh nhà làm", price: 120000 },
    ],
  ],
];
async function seed() {
  await m.init();
  let inserted = 0;
  for (const [i, r] of rows.entries()) {
    const [
      id,
      name,
      category,
      priceMin,
      priceMax,
      rating,
      reviewCount,
      photo,
      features,
      description,
      menu,
    ] = r;
    const data = m.validate({
      name,
      category,
      destination: "Đà Lạt",
      address: `Địa chỉ minh họa ${i + 1}, Đà Lạt`,
      priceMin,
      priceMax,
      rating,
      reviewCount,
      image: image(photo),
      features,
      description,
      menu,
      hours: "08:00 – 21:00",
      priceUnit: photo === "tea" ? "set 2 người" : "người",
      capacity: 20,
      status: "published",
    });
    const result = await m
      .places()
      .updateOne(
        { id: `demo-food-${id}` },
        {
          $setOnInsert: {
            ...data,
            id: `demo-food-${id}`,
            isDemo: true,
            version: 1,
            createdAt: new Date(Date.now() + i),
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
    inserted += result.upsertedCount;
    // Repair only the original demo image paths; preserve all administrator edits.
    if (["home", "cafe"].includes(photo))
      await m
        .places()
        .updateOne(
          {
            id: `demo-food-${id}`,
            isDemo: true,
            image: `/image/food/${photo}.jpg`,
          },
          { $set: { image: image(photo) } },
        );
  }
  console.log(
    JSON.stringify({
      inserted,
      demoCount: await m.places().countDocuments({ isDemo: true }),
    }),
  );
}
if (require.main === module)
  seed()
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(() => m.store.close());
module.exports = { seed };
