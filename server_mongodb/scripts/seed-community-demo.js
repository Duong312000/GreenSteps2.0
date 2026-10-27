// Add demo posts without deleting or replacing existing community content.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { createHash, randomBytes } = require('node:crypto');
const { User, CommunityPost } = require('../models');
const id = key => new mongoose.Types.ObjectId(createHash('sha256').update('greensteps-community-demo:' + key).digest('hex').slice(0, 24));
const posts = [
  {
    key: 'dalat', name: 'Minh Anh · Demo', title: 'Đà Lạt 3 ngày: đi chậm giữa rừng thông', destination: 'Đà Lạt', days: 3,
    image_url: 'image/da-lat/da-lat-rung-thong-san-may-01.jpg',
    text: 'Một hành trình mẫu dành cho những ai muốn tận hưởng Đà Lạt thật chậm. 🌲\n\nNgày 1: dạo quanh trung tâm, ghé một quán cà phê nhỏ và thưởng thức món ăn địa phương. Ngày 2: đi bộ giữa rừng thông trên lối được phép, mang theo bình nước và túi đựng rác cá nhân. Ngày 3: thăm vườn hoa rồi mua vài món quà từ cửa hàng địa phương.\n\nĐiều mình thích nhất trong chuyến đi này là dành thời gian ngắm cảnh thay vì chạy theo quá nhiều điểm check-in. Nhớ xem thời tiết và tìm hiểu quy định tại điểm đến trước khi khởi hành nhé!\n\n#DaLat #DuLichXanh #BaiVietDemo'
  },
  {
    key: 'hoian', name: 'Hoàng Minh · Demo', title: 'Một ngày Hội An: đạp xe và khám phá phố cổ', destination: 'Hội An', days: 1,
    image_url: 'image/da-nang-hoi-an/hoi-an-song-hoai-ban-dem-01.jpg',
    text: 'Nếu có một ngày ở Hội An, mình sẽ dành buổi sáng đạp xe ở khu vực phù hợp, trưa thưởng thức món ăn địa phương và chiều đi bộ khám phá phố cổ. 🚲\n\nMang theo bình nước cá nhân, chọn túi vải khi mua quà và hỏi trước khi chụp ảnh người dân là những việc nhỏ khiến chuyến đi dễ chịu hơn. Buổi tối chỉ cần ngồi bên sông, ngắm phố lên đèn cũng đã rất đáng nhớ.\n\nBạn thích Hội An buổi sáng hay buổi tối hơn? Chia sẻ góc yêu thích của bạn nhé!\n\n#HoiAn #DiCham #BaiVietDemo'
  },
  {
    key: 'phuyen', name: 'An Nhiên · Demo', title: 'Phú Yên 2 ngày: mang về ảnh đẹp, để lại bãi biển sạch', destination: 'Phú Yên', days: 2,
    image_url: 'image/greensteps/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg',
    text: 'Một gợi ý hành trình mẫu cho cuối tuần bên biển Phú Yên. 🌊\n\nNgày đầu dành cho cảnh biển và các món ăn địa phương; ngày thứ hai dậy sớm ngắm bình minh rồi ghé làng chài ở khu vực cho phép tham quan. Lịch trình nên linh hoạt theo thời tiết và điều kiện thực tế.\n\nTrong túi mình luôn có bình nước, mũ, kem chống nắng và một túi nhỏ đựng rác. Không lấy san hô, không làm phiền sinh vật biển và không để lại đồ nhựa sau buổi picnic.\n\nMột bãi biển sạch là món quà dành cho cả người đến sau. 💚\n\n#PhuYen #BienXanh #BaiVietDemo'
  },
  {
    key: 'green-checklist', name: 'Cộng đồng GreenSteps · Demo', title: '5 món đồ nhỏ cho một chuyến đi xanh hơn', destination: 'Việt Nam', days: 1,
    image_url: 'image/Viet Nam.png',
    text: 'Checklist mẫu trước mỗi chuyến đi của cộng đồng GreenSteps: 🎒\n\n1. Bình nước cá nhân để hạn chế chai nhựa dùng một lần.\n2. Túi vải gấp gọn khi mua đồ hoặc mang quà về.\n3. Hộp đựng và bộ thìa đũa tái sử dụng nếu phù hợp.\n4. Túi nhỏ để giữ rác cho đến khi tìm được nơi bỏ đúng quy định.\n5. Một lịch trình vừa sức, có thời gian đi bộ và tìm hiểu văn hóa địa phương.\n\nKhông cần hoàn hảo ngay từ đầu. Chọn một thói quen nhỏ và duy trì trong từng chuyến đi là một khởi đầu tốt. Bạn muốn bổ sung món nào vào danh sách?\n\n#GreenSteps #SongXanh #BaiVietDemo'
  }
];
async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GreenStepsData';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  let inserted = 0;
  try {
    for (const [index, post] of posts.entries()) {
      const authorId = id('author:' + post.key);
      const existing = await User.findById(authorId);
      if (!existing) await User.create({ _id: authorId, username: 'demo_community_' + post.key, email: post.key + '@demo.greensteps.invalid', password_hash: await bcrypt.hash(randomBytes(48).toString('base64url'), 10), profile: { fullname: post.name }, roles: ['traveler'], status: 'pending', verified: false });
      const result = await CommunityPost.updateOne({ _id: id('post:' + post.key) }, { $setOnInsert: {
        author_id: authorId, title: post.title, destination: post.destination, days: post.days, text: post.text,
        image_url: post.image_url, status: 'published', likes_count: 0, comments_count: 0, comments: [],
        created_at: new Date(Date.now() - index * 3600000)
      } }, { upsert: true, runValidators: true, timestamps: false });
      inserted += result.upsertedCount;
    }
    console.log(JSON.stringify({ added: inserted, totalDemoPosts: await CommunityPost.countDocuments({ _id: { $in: posts.map(p => id('post:' + p.key)) } }) }));
  } finally { await mongoose.disconnect(); }
}
main().catch(error => { console.error(error.name + ': community demo seed failed'); process.exitCode = 1; });
