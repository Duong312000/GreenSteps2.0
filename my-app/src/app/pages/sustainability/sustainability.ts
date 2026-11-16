import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({selector: 'app-sustainability', standalone: true, imports: [CommonModule, RouterLink], templateUrl: './sustainability.html', styleUrl: './sustainability.css'})
export class SustainabilityComponent {
  scrollTo(event: MouseEvent, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
  }
  readonly commitments = [
    {
      id: 'nature', icon: 'bi-tree', theme: 'Thiên nhiên', title: 'Để thiên nhiên được là chính mình.',
      copy: 'Một khu rừng nguyên vẹn, một dòng nước trong lành. Những điều làm nên vẻ đẹp của chuyến đi cũng là những điều cần được gìn giữ sau khi ta rời bước.',
      practices: ['Hạn chế nhựa dùng một lần, tiết kiệm nước và điện.', 'Đi đúng lối mòn, giữ khoảng cách với động vật hoang dã.', 'Mang rác ra khỏi điểm tham quan, giữ lại sự bình yên.'],
      images: [
        { file: 'vietnam-nature', alt: 'Voi đi trong khu rừng xanh tại Việt Nam', caption: 'Quan sát thiên nhiên, tôn trọng không gian sống' },
        { file: 'mai-chau-fields', alt: 'Đàn vịt bên ruộng lúa và hàng rào tre ở Mai Châu', caption: 'Một góc đồng quê Mai Châu' },
      ],
    },
    {
      id: 'community', icon: 'bi-people', theme: 'Cộng đồng', title: 'Đi xa để đến gần con người hơn.',
      copy: 'Chuyến đi có ý nghĩa hơn khi những người sống ở điểm đến cũng được hưởng lợi. GreenSteps hướng đến kết nối du khách với người dẫn đường, bữa ăn và dịch vụ do người địa phương tạo nên.',
      practices: ['Ưu tiên hướng dẫn viên và cơ sở lưu trú địa phương.', 'Thưởng thức món ăn bản địa, lựa chọn nông sản theo mùa.', 'Mua trực tiếp và trả mức giá công bằng cho người làm ra sản phẩm.'],
      images: [
        { file: 'local-host', alt: 'Người đàn ông trong trang phục truyền thống cầm khèn trước ngôi nhà mái lá', caption: 'Gặp gỡ những người gìn giữ văn hóa bản địa' },
        { file: 'mai-chau-food', alt: 'Món ăn với rau tươi được bày trên đĩa ở Mai Châu', caption: 'Hương vị từ những nguyên liệu gần gũi' },
      ],
    },
    {
      id: 'culture', icon: 'bi-flower1', theme: 'Văn hóa', title: 'Trân trọng những điều không thể thay thế.',
      copy: 'Phía sau một tấm thổ cẩm là đôi tay khéo léo và câu chuyện của nhiều thế hệ. Chúng tôi khuyến khích những cuộc gặp gỡ có sự lắng nghe, để văn hóa được tiếp nối bằng sự tôn trọng.',
      practices: ['Tìm hiểu phong tục và trang phục phù hợp trước khi ghé thăm.', 'Xin phép trước khi chụp ảnh người dân và không gian riêng.', 'Ủng hộ sản phẩm thủ công, tôn trọng công sức của nghệ nhân.'],
      images: [
        { file: 'mai-chau-weaving', alt: 'Người phụ nữ dệt vải trên khung cửi gỗ tại Mai Châu', caption: 'Nghề dệt thổ cẩm ở Mai Châu' },
        { file: 'local-culture', alt: 'Nghệ nhân chăm chú dệt vải trên khung cửi truyền thống', caption: 'Câu chuyện được nối dài qua từng sợi vải' },
      ],
    },
    {
      id: 'choices', icon: 'bi-house-heart', theme: 'Lựa chọn có trách nhiệm', title: 'Ở gần thiên nhiên. Nghĩ xa hơn một chuyến đi.',
      copy: 'Từ nơi nghỉ đến cách di chuyển, mỗi lựa chọn đều tạo nên dấu chân của hành trình. GreenSteps hướng đến những đối tác quan tâm đến môi trường, con người và thông tin dịch vụ minh bạch.',
      practices: ['Cân nhắc nơi lưu trú sử dụng tài nguyên có ý thức.', 'Đi bộ, đạp xe hoặc đi chung xe khi điều kiện phù hợp.', 'Tìm hiểu rõ dịch vụ và thực hành bền vững của đối tác.'],
      images: [
        { file: 'mai-chau-stay', alt: 'Nhà sàn giữa thung lũng xanh và núi ở Mai Châu', caption: 'Nhà sàn giữa cảnh quan Mai Châu' },
        { file: 'mai-chau-cycling', alt: 'Người dân đội nón đi trên lối nhỏ giữa vườn chuối và ruộng lúa Mai Châu', caption: 'Chậm lại cùng nhịp sống miền quê' },
      ],
    },
  ];
  readonly actions = [
    { icon: 'bi-droplet', title: 'Mang bình nước riêng', text: 'Thêm một lần tiếp nước, bớt một chai nhựa.' },
    { icon: 'bi-bag-heart', title: 'Dùng lại chiếc túi', text: 'Một chiếc túi nhỏ cho nhiều lần ghé chợ.' },
    { icon: 'bi-bicycle', title: 'Thử một nhịp đi chậm', text: 'Đi bộ hoặc đạp xe khi có thể.' },
    { icon: 'bi-heart', title: 'Hỏi trước khi chụp', text: 'Một lời xin phép thể hiện sự tôn trọng.' },
  ];
}
