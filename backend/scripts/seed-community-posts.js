const bcrypt = require('bcrypt');
const { randomBytes } = require('node:crypto');
const { store } = require('../src/config/db.config');
const { User, CommunityPost } = require('../src/models');

const authorId = 'greensteps_community_demo';
const posts = [
  {
    id: 'community_demo_dalat',
    rating: 5,
    text: 'Đà Lạt đẹp nhất khi mình đi chậm: buổi sáng dạo quanh hồ, ghé một quán cà phê địa phương rồi dành buổi chiều đi bộ ở những cung đường rừng được phép tham quan. Mình mang bình nước cá nhân và gom rác mang về, để chuyến đi nhẹ nhàng với cả mình lẫn thiên nhiên. 🌲',
    tour_name: 'Đà Lạt 3 ngày: đi chậm giữa rừng thông',
    destination: 'Đà Lạt',
    days: 3,
    image_url: 'image/greensteps/da-lat/da-lat-rung-thong-san-may-01.jpg',
    likes_count: 12,
    comments_count: 0
  },
  {
    id: 'community_demo_hoian',
    rating: 5,
    text: 'Một ngày ở Hội An: sáng đạp xe qua những con đường yên tĩnh, trưa thử món địa phương và chiều thong thả đi bộ phố cổ. Tụi mình mang theo bình nước, chọn quà thủ công và hỏi trước khi chụp ảnh người dân. Buổi tối ngồi bên sông ngắm đèn lồng là đủ thấy chuyến đi đáng nhớ. 🚲',
    tour_name: 'Hội An một ngày bằng xe đạp',
    destination: 'Hội An',
    days: 1,
    image_url: 'image/greensteps/da-nang-hoi-an/hoi-an-song-hoai-ban-dem-01.jpg',
    likes_count: 9,
    comments_count: 0
  },
  {
    id: 'community_demo_phuyen',
    rating: 5,
    text: 'Phú Yên có những buổi sáng bên biển rất trong lành. Nếu ghé Mũi Điện, nhớ xem thời tiết, đi theo lối được hướng dẫn và không lấy san hô hay để lại rác. Một chiếc túi vải, bình nước và kem chống nắng thân thiện với môi trường là những món mình luôn chuẩn bị. 🌊',
    tour_name: 'Phú Yên cuối tuần bên biển',
    destination: 'Phú Yên',
    days: 2,
    image_url: 'image/greensteps/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg',
    likes_count: 15,
    comments_count: 0
  },
  {
    id: 'community_demo_checklist',
    rating: 5,
    text: 'Checklist nhỏ trước mỗi chuyến đi xanh: bình nước cá nhân, túi vải gấp gọn, hộp đựng dùng lại được, túi nhỏ để gom rác và một lịch trình vừa sức. Mình thấy chỉ cần duy trì một thói quen tốt qua mỗi chuyến đi cũng đã tạo nên khác biệt. Bạn thường mang theo món nào?',
    tour_name: '5 món đồ cho chuyến đi xanh hơn',
    destination: 'Việt Nam',
    days: 1,
    image_url: 'image/Viet Nam.png',
    likes_count: 7,
    comments_count: 0
  }
];

async function main() {
  await store.authenticate();
  try {
    let author = await User.findByPk(authorId);
    if (!author) {
      author = await User.create({
        id: authorId,
        role: 'traveler',
        username: 'greensteps_community_demo',
        password_hash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
        fullname: 'Cộng đồng GreenSteps',
        email: 'community-demo@greensteps.invalid',
        is_verified: false
      });
    }

    let added = 0;
    for (const post of posts) {
      if (await CommunityPost.findByPk(post.id)) continue;
      await CommunityPost.create({ ...post, user_id: author.id });
      added += 1;
    }

    console.log(JSON.stringify({ added, total: await CommunityPost.count() }));
  } finally {
    await store.close();
  }
}

main().catch(error => {
  console.error(`Community seed failed: ${error.name}`);
  process.exitCode = 1;
});
