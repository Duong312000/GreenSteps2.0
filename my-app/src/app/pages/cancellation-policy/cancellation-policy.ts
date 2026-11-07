import { Component, OnInit, HostListener } from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

export interface PolicyArticle {
  articleNum: string;
  title: string;
  lead?: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  callout?: {
    type: 'info' | 'warning' | 'tip';
    title: string;
    text: string;
  };
  illustration?: {
    img: string;
    tag: string;
    caption: string;
  };
}

export interface ComprehensivePolicy {
  id: string;
  navTitle: string;
  fullTitle: string;
  subTitle: string;
  effectiveDate: string;
  heroPhoto: string;
  photoCaption: string;
  gallery: {
    img: string;
    title: string;
    location: string;
    desc: string;
  }[];
  quickMetrics: { label: string; value: string; desc: string }[];
  articles: PolicyArticle[];
}

@Component({
  selector: 'app-cancellation-policy',
  standalone: false,
  templateUrl: './cancellation-policy.html',
  styleUrl: './cancellation-policy.css'
})
export class CancellationPolicyComponent implements OnInit {
  public activePolicyId: string = 'deposit';

  public policies: ComprehensivePolicy[] = [
    // 1. ĐẶT CỌC & HOÀN HỦY
    {
      id: 'deposit',
      navTitle: 'Đặt cọc & Hoàn hủy',
      fullTitle: 'QUY CHẾ ĐẶT CỌC, GIỮ CHỖ VÀ HOÀN TIỀN MINH BẠCH',
      subTitle: 'Quy chuẩn tài chính bảo chứng, hạn mức đặt cọc 30% và cơ chế hoàn tiền tự động qua VietQR bảo vệ toàn diện quyền lợi người tiêu dùng.',
      effectiveDate: 'Văn bản số 01/2026/QC-GS • Hiệu lực thi hành từ 01/01/2026',
      heroPhoto: 'image/phu-yen/phu-yen-bai-xep-checkin-01.jpg',
      photoCaption: 'Bãi Xép Phú Yên — Cam kết tài chính công khai, hoàn cọc 100% trước 7 ngày khởi hành.',
      gallery: [
        {
          img: 'image/places/ggp_py_ganhdadia.jpg',
          title: 'Bảo lưu 100% khi thời tiết xấu',
          location: 'Gành Đá Đĩa • Phú Yên',
          desc: 'Khi có bão hoặc sóng lớn cấm biển, toàn bộ tiền cọc được bảo lưu hoặc hoàn trả 100% ngay trong ngày.'
        },
        {
          img: 'image/places/ggp_dl_tuyenlam.jpg',
          title: 'Hoàn tiền tự động qua VietQR',
          location: 'Hồ Tuyền Lâm • Đà Lạt',
          desc: 'Đối soát điện tử và hoàn tiền trực tiếp vào tài khoản ngân hàng trong vòng 24 giờ làm việc.'
        },
        {
          img: 'image/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg',
          title: 'Giữ chỗ 24h không rủi ro',
          location: 'Mũi Điện • Phú Yên',
          desc: 'Du khách thoải mái giữ chỗ 24 giờ đầu tiên để thảo luận cùng gia đình mà không mất bất kỳ khoản phí nào.'
        }
      ],
      quickMetrics: [
        { label: 'Tỷ lệ cọc tiêu chuẩn', value: '30%', desc: 'Chỉ cọc 30% giữ chỗ thực tế' },
        { label: 'Hoàn trước ≥ 7 ngày', value: '100%', desc: 'Không thu phí quản trị' },
        { label: 'Thời gian đối soát', value: '24h', desc: 'Hoàn tiền tự động qua VietQR' }
      ],
      articles: [
        {
          articleNum: 'Điều 1',
          title: 'Phạm vi điều chỉnh và nguyên tắc đặt cọc giữ chỗ',
          lead: 'Quy chế này quy định chi tiết về việc xác lập giao dịch đặt giữ chỗ, tỷ lệ đặt cọc ban đầu và quy trình thanh toán phần chi phí còn lại đối với toàn bộ các tour sinh thái, dịch vụ xe điện và homestay trên nền tảng GreenSteps.',
          paragraphs: [
            '1.1. Khách hàng khi đăng ký tour hoặc dịch vụ trải nghiệm sinh thái trên hệ thống GreenSteps chỉ phải thực hiện nghĩa vụ đặt cọc 30% trên tổng giá trị đơn hàng để xác lập việc giữ chỗ chính thức với hợp tác xã hoặc nhà cung cấp bản địa.',
            '1.2. Đối với các đơn đặt dịch vụ vào mùa cao điểm du lịch (các dịp Lễ, Tết theo quy định của Nhà nước) hoặc các dịch vụ biệt lập có số lượng giới hạn (như thuê xe điện riêng trọn ngày, phòng độc bản giữa rừng), tỷ lệ đặt cọc tối đa không vượt quá 50% tổng giá trị hợp đồng.',
            '1.3. Cơ chế giữ chỗ không rủi ro trong 24 giờ (Zero-Risk Hold): Hệ thống cho phép du khách tạo yêu cầu giữ chỗ tạm thời trong vòng 24 giờ kể từ thời điểm khởi tạo đơn hàng mà không phải thanh toán bất kỳ khoản phí nào, tạo điều kiện thuận lợi nhất để khách hàng bàn bạc và thống nhất kế hoạch cùng người thân.',
            '1.4. Thời hạn hoàn tất thanh toán phần còn lại (70%): Du khách có thể lựa chọn thanh toán khoản tiền còn lại trong vòng 24 giờ trước giờ khởi hành thông qua cổng thanh toán trực tuyến hoặc thanh toán trực tiếp tại điểm đón/quầy lễ tân cơ sở lưu trú khi bắt đầu chuyến đi.'
          ],
          callout: {
            type: 'info',
            title: 'Quy định giữ chỗ 24h',
            text: 'Đơn giữ chỗ tạm thời sẽ tự động giải phóng chỗ sau 24 giờ nếu khách hàng chưa hoàn tất chuyển cọc, không phát sinh bất kỳ khoản nợ hay lịch sử phạt nào.'
          },
          illustration: {
            img: 'image/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg',
            tag: 'Phú Yên',
            caption: 'Mũi Điện Đại Lãnh — Nơi đón bình minh đầu tiên, cam kết giữ chỗ linh hoạt cho chuyến đi an tâm.'
          }
        },
        {
          articleNum: 'Điều 2',
          title: 'Biểu phí và tỷ lệ hoàn cọc theo thời điểm thông báo hủy',
          lead: 'Nhằm đảm bảo sự công bằng tuyệt đối giữa quyền lợi của du khách và sinh kế của các hộ nông dân, ngư dân, lái xe điện bản địa, GreenSteps áp dụng biểu phí hoàn cọc chi tiết theo các mốc thời gian rõ ràng.',
          table: {
            headers: ['Thời điểm thông báo hủy dịch vụ', 'Tỷ lệ hoàn tiền cọc', 'Trách nhiệm đối tác bản địa', 'Phương thức & Thời hạn chi trả'],
            rows: [
              ['Trước ≥ 7 ngày làm việc so với ngày khởi hành', '100% tiền cọc', 'Hủy lệnh giữ chỗ, hoàn trả toàn bộ cọc không trừ bất kỳ chi phí nào', 'Tự động qua VietQR trong vòng 24 giờ làm việc'],
              ['Từ 3 đến 6 ngày làm việc trước khởi hành', '50% tiền cọc', 'Giữ lại 50% để bù đắp chi phí chuẩn bị nguyên liệu và bảo lưu vị trí xe điện', 'Chuyển khoản ngân hàng trong 24–48 giờ làm việc'],
              ['Dưới 3 ngày làm việc hoặc Không xuất hiện (No-Show)', '0% tiền cọc', 'Đối tác đã xuất xe điện và thu hoạch nông sản tươi sống phục vụ đoàn', 'Cung cấp hóa đơn chứng từ chi phí thực tế minh bạch'],
              ['Thời tiết cực đoan, Bão lũ có văn bản chính quyền', '100% tiền cọc', 'Bảo lưu 100% giá trị hoặc hoàn trả toàn bộ, dời ngày khởi hành miễn phí', 'Xử lý ưu tiên hoàn tiền trong ngày (dưới 12 giờ)']
            ]
          },
          paragraphs: [
            '2.1. Thời điểm xác nhận thông báo hủy được căn cứ dựa trên dấu thời gian điện tử (timestamp) khi khách hàng gửi yêu cầu hủy thành công trên trang Tra cứu vé điện tử (/booking-lookup) hoặc thời điểm hệ thống tổng đài ghi nhận yêu cầu hủy bằng văn bản qua email.',
            '2.2. Trường hợp khách hàng đơn phương rời đoàn hoặc tự ý cắt giảm các chặng trong hành trình đang diễn ra vì lý do chủ quan cá nhân, các chi phí dịch vụ chưa sử dụng sẽ không được hoàn lại do các đối tác dịch vụ đã được thanh toán cố định theo kế hoạch ban đầu.'
          ]
        },
        {
          articleNum: 'Điều 3',
          title: 'Quy định đặc biệt về Sự kiện Bất khả kháng (Force Majeure)',
          lead: 'An toàn tính mạng và sức khỏe của du khách là nguyên tắc cao nhất, luôn được đặt lên trên mọi yếu tố thương mại và doanh thu.',
          paragraphs: [
            '3.1. Sự kiện bất khả kháng được công nhận bao gồm: Bão, áp thấp nhiệt đới từ cấp 6 trở lên theo thông báo chính thức của Trung tâm Dự báo Khí tượng Thủy văn Quốc gia; lũ quét, ngập lụt, sạt lở đèo gây phong tỏa giao thông; dịch bệnh bùng phát theo công bố của Bộ Y tế; hoặc các trường hợp thiên tai khác có văn bản cấm tàu, cấm biển, cấm đường của cơ quan quản lý nhà nước có thẩm quyền.',
            '3.2. Khi phát sinh sự kiện bất khả kháng, du khách được toàn quyền lựa chọn một trong hai phương án sau:',
            'a) Nhận lại 100% số tiền đã đặt cọc hoặc thanh toán. GreenSteps cam kết không thu bất kỳ khoản phí xử lý hồ sơ nào.',
            'b) Bảo lưu toàn bộ 100% giá trị chuyến đi để đổi sang thời điểm khởi hành khác trong vòng 12 tháng kể từ ngày thông báo hủy, được giữ nguyên mức giá cũ không áp dụng trượt giá mùa cao điểm.',
            '3.3. Thời gian kích hoạt quy trình ứng phó bất khả kháng: Trong vòng tối đa 02 giờ kể từ thời điểm có thông cáo của chính quyền, đội ngũ chăm sóc khách hàng của GreenSteps sẽ chủ động liên hệ từng hành khách để thông báo tình hình và hướng dẫn phương án xử lý tối ưu.'
          ],
          illustration: {
            img: 'image/places/ggp_dl_tuyenlam.jpg',
            tag: 'Hồ Tuyền Lâm',
            caption: 'Cảnh quan hồ sinh thái được giám sát chặt chẽ về mực nước và thời tiết để đảm bảo an toàn tuyệt đối.'
          }
        },
        {
          articleNum: 'Điều 4',
          title: 'Quy trình và thời hạn hoàn tiền tự động qua VietQR',
          lead: 'GreenSteps xây dựng quy trình hoàn tiền khép kín và tự động hóa qua hệ sinh thái ngân hàng số VietQR, loại bỏ hoàn toàn các rào cản hành chính rườm rà.',
          bullets: [
            'Bước 1 — Tiếp nhận yêu cầu: Khách hàng truy cập Cổng tra cứu dịch vụ, nhập Mã đặt chỗ (Booking Code) và Số điện thoại đã đăng ký, chọn "Yêu cầu hủy và hoàn cọc".',
            'Bước 2 — Đối soát tự động: Hệ thống đối chiếu thời gian gửi yêu cầu với khung giờ khởi hành trên hợp đồng để tính toán chính xác tỷ lệ hoàn tiền theo quy định tại Điều 2.',
            'Bước 3 — Xác thực tài khoản: Khách hàng xác nhận số tài khoản ngân hàng thụ hưởng hoặc quét mã VietQR nhận tiền chính chủ.',
            'Bước 4 — Chuyển tiền & Xuất biên nhận: Tiền được chuyển khoản tự động vào tài khoản khách hàng trong vòng tối đa 24 giờ làm việc. Biên nhận hoàn tiền điện tử được gửi tự động về email đăng ký.'
          ]
        },
        {
          articleNum: 'Điều 5',
          title: 'Quy chế dời ngày khởi hành và chuyển nhượng vé',
          lead: 'Chính sách hỗ trợ linh hoạt nhằm đồng hành cùng du khách khi có thay đổi đột xuất về lịch trình cá nhân hoặc công việc.',
          paragraphs: [
            '5.1. Dời ngày khởi hành: Khách hàng được quyền yêu cầu dời ngày khởi hành miễn phí 01 lần duy nhất nếu gửi thông báo trước tối thiểu 48 giờ so với giờ khởi hành ban đầu, với điều kiện ngày khởi hành mới còn chỗ trống tương đương trên hệ thống.',
            '5.2. Chuyển nhượng quyền sử dụng dịch vụ: Khách hàng có quyền chuyển nhượng toàn bộ vé tour hoặc đơn đặt phòng cho người khác hoàn toàn miễn phí. Người chuyển nhượng có trách nhiệm cập nhật lại họ tên, số CCCD và số điện thoại của hành khách mới trước giờ khởi hành tối thiểu 12 giờ để làm thủ tục bảo hiểm du lịch.'
          ]
        }
      ]
    },

    // 2. DỊCH VỤ & TIỆN ÍCH
    {
      id: 'amenities',
      navTitle: 'Dịch vụ & Tiện ích',
      fullTitle: 'QUY CHUẨN DỊCH VỤ BAO GỒM, TIỆN ÍCH SINH THÁI & ĐIỂM LOẠI TRỪ',
      subTitle: 'Đặc tả chi tiết các danh mục tiêu chuẩn cam kết cung cấp trong mọi hành trình và danh mục các khoản chi phí không bao gồm.',
      effectiveDate: 'Văn bản số 02/2026/QC-GS • Hiệu lực thi hành từ 01/01/2026',
      heroPhoto: 'image/places/ggp_dl_busxanh.jpg',
      photoCaption: 'Xe buýt điện sinh thái Đà Lạt — Tiêu chuẩn di chuyển 100% không tiếng ồn, không phát thải.',
      gallery: [
        {
          img: 'image/places/ggp_ha_xedaptre.jpg',
          title: 'Xe đạp tre thủ công bản địa',
          location: 'Cẩm Thanh • Hội An',
          desc: 'Khung tre tự nhiên 100%, bảo dưỡng định kỳ 15 ngày/lần, mang lại trải nghiệm êm ái trên các ngõ phố cổ.'
        },
        {
          img: 'image/da-nang-hoi-an/hoi-an-lang-rau-tra-que-01.jpg',
          title: 'Ẩm thực hữu cơ Farm-to-Table',
          location: 'Làng rau Trà Quế • Quảng Nam',
          desc: 'Rau củ tươi sạch thu hoạch trong ngày tại vườn, chế biến theo công thức thực dưỡng truyền thống lành mạnh.'
        },
        {
          img: 'image/places/ggp_dl_pineretreat.jpg',
          title: 'Eco Homestay không đồ nhựa',
          location: 'Pine Retreat • Đà Lạt',
          desc: 'Vật liệu gỗ thông tái sinh, bình thủy tinh tiệt trùng, trạm tiếp nước sạch tinh khiết không rác thải nhựa.'
        }
      ],
      quickMetrics: [
        { label: 'Phương tiện xanh', value: '100%', desc: 'Xe điện & xe đạp tre thủ công' },
        { label: 'Ẩm thực hữu cơ', value: 'Farm-to-Table', desc: 'Nông sản sạch theo mùa tại vườn' },
        { label: 'Nói không đồ nhựa', value: 'Zero-Waste', desc: 'Bình thủy tinh & đồ gỗ tre' }
      ],
      articles: [
        {
          articleNum: 'Điều 1',
          title: 'Danh mục các dịch vụ luôn bao gồm trong gói tour tiêu chuẩn',
          lead: 'Mọi gói tour và trải nghiệm sinh thái trên GreenSteps đều được thiết kế theo tiêu chí trọn gói minh bạch, tuyệt đối không có phụ phí ẩn hay chiêu trò thương mại.',
          bullets: [
            'Phương tiện vận chuyển sinh thái: 100% xe buýt điện, xe ô tô điện ngắm cảnh hoặc xe đạp tre thủ công phục vụ toàn bộ các chặng di chuyển trong chương trình đã công bố.',
            'Cơ sở lưu trú sinh thái: Phòng nghỉ tiện nghi tại các Homestay đạt chứng nhận xanh, Eco Cottage hoặc Resort thân thiện môi trường, tiêu chuẩn 02 khách/phòng (hoặc phòng gia đình theo thỏa thuận).',
            'Chế độ dinh dưỡng hữu cơ: Các bữa ăn chính được chế biến từ 100% nông sản sạch, tươi thu hoạch trong ngày tại các hợp tác xã nông nghiệp hữu cơ bản địa; có thực đơn chay thực dưỡng riêng theo yêu cầu.',
            'Vé tham quan & Phí bảo tồn: Toàn bộ vé vào cổng các khu bảo tồn thiên nhiên, danh lam thắng cảnh, di sản văn hóa và phí đóng góp duy tu làng nghề truyền thống.',
            'Hướng dẫn viên bản địa am hiểu sinh thái: Mỗi đoàn đều có 01 hướng dẫn viên người địa phương dẫn đường, được đào tạo bài bản về kiến thức đa dạng sinh học và kỹ năng sơ cấp cứu quốc tế.',
            'Trang thiết bị bảo hộ & Nước uống tinh khiết: Trang bị áo phao đạt chuẩn khi đi thuyền, mũ bảo hiểm xe đạp và bình nước cá nhân giữ nhiệt tái sử dụng nhiều lần, cấp nước sạch miễn phí tại các trạm tiếp nước.'
          ],
          illustration: {
            img: 'image/places/ggp_ha_xedaptre.jpg',
            tag: 'Hội An',
            caption: 'Xe đạp tre thủ công trang bị cho du khách dạo quanh cánh đồng di sản.'
          }
        },
        {
          articleNum: 'Điều 2',
          title: 'Tiêu chuẩn kỹ thuật phương tiện di chuyển phát thải thấp',
          lead: 'Cam kết giảm thiểu tối đa lượng phát thải khí nhà kính và tiếng ồn trong quá trình đưa đón hành khách tham quan cảnh quan thiên nhiên.',
          paragraphs: [
            '2.1. Đội xe ô tô và xe buýt điện: Toàn bộ phương tiện vận chuyển hành khách đều là xe thuần điện đời mới, vận hành êm ái, định mức phát thải khí xả trực tiếp bằng 0 (Zero Direct Tailpipe Emissions), không gây ô nhiễm không khí tại các vùng đồi thông và khu phố cổ.',
            '2.2. Xe đạp tre thủ công (Bamboo Bikes): Sử dụng khung tre tự nhiên được xử lý chống ẩm mốc theo phương pháp truyền thống, tải trọng thiết kế chịu lực lên đến 120kg, được kiểm định an toàn phanh và săm lốp định kỳ 15 ngày/lần.',
            '2.3. Thuyền chèo tay và Kayak/SUP thân thiện môi trường: Các hoạt động khám phá mặt nước tại Hồ Tuyền Lâm (Đà Lạt) hay Rừng dừa Bảy Mẫu (Hội An) ưu tiên 100% thuyền chèo thủ công hoặc thuyền lắp động cơ điện nhỏ, tuyệt đối cấm dùng động cơ đốt trong xả váng dầu nhờn ra môi trường thủy sinh.'
          ]
        },
        {
          articleNum: 'Điều 3',
          title: 'Quy chuẩn cơ sở lưu trú xanh (Green Stay Standards)',
          lead: 'Các cơ sở lưu trú liên kết với GreenSteps bắt buộc phải đáp ứng Bộ quy chuẩn 5 sao về trách nhiệm môi trường.',
          bullets: [
            'Loại bỏ 100% đồ nhựa dùng một lần: Không sử dụng chai nước nhựa suối, bàn chải nhựa, lược nhựa, dao cạo nhựa trong phòng; toàn bộ được thay thế bằng vật liệu gỗ tre, xơ mướp và bình sứ/thủy tinh tiệt trùng.',
            'Năng lượng tái tạo & Tiết kiệm nước: 100% hệ thống cung cấp nước nóng sử dụng năng lượng mặt trời kết hợp bơm nhiệt tiết kiệm điện; vòi sen và bồn rửa trang bị van giảm áp bọt khí.',
            'Phân loại và xử lý rác thải hữu cơ tại nguồn: Trang bị thùng rác phân loại 3 ngăn trong phòng khách; toàn bộ rác thải hữu cơ nhà bếp được ủ vi sinh làm phân bón hữu cơ cho vườn rau nội khu.'
          ],
          illustration: {
            img: 'image/places/ggp_dl_pineretreat.jpg',
            tag: 'Pine Forest Cottage',
            caption: 'Không gian phòng nghỉ 100% gỗ mộc và vật liệu tự nhiên, không có rác thải nhựa.'
          }
        },
        {
          articleNum: 'Điều 4',
          title: 'Danh mục các khoản chi phí không bao gồm (Exclusions)',
          lead: 'Nhằm tránh mọi hiểu lầm phát sinh trong hành trình, du khách lưu ý các khoản chi phí nằm ngoài phạm vi bao gồm của gói dịch vụ:',
          paragraphs: [
            '4.1. Vé phương tiện giao thông liên tỉnh (Vé máy bay, vé tàu hỏa, vé xe khách giường nằm) từ nơi cư trú của hành khách đến điểm tập kết xuất phát đầu tiên của tour.',
            '4.2. Chi phí tiêu dùng cá nhân phát sinh ngoài chương trình như: Giặt là, dịch vụ phòng, cuộc gọi điện thoại cá nhân, đồ uống có cồn (bia, rượu mạnh), đồ uống đóng lon ngoài thực đơn tiêu chuẩn.',
            '4.3. Tiền thưởng (Tips/Gratuity) cho tài xế và hướng dẫn viên bản địa: Chính sách của GreenSteps là chi trả mức thù lao công bằng và xứng đáng cho người lao động bản địa; do đó tiền tip hoàn toàn phụ thuộc vào sự tự nguyện và hài lòng của khách hàng, tuyệt đối không có tình trạng vòi vĩnh.',
            '4.4. Thuế giá trị gia tăng (VAT): Giá niêm yết trên website là giá thanh toán dịch vụ trải nghiệm. Trong trường hợp cơ quan, doanh nghiệp có nhu cầu xuất hóa đơn tài chính VAT hợp pháp, mức thuế suất sẽ được áp dụng theo quy định hiện hành của Bộ Tài chính.'
          ]
        }
      ]
    },

    // 3. TRẺ EM & PHỤ THU
    {
      id: 'children',
      navTitle: 'Trẻ em & Phụ thu',
      fullTitle: 'CHÍNH SÁCH ĐỐI TƯỢNG ƯU TIÊN, TRẺ EM VÀ PHỤ THU PHÒNG ĐƠN',
      subTitle: 'Quy chuẩn phân định độ tuổi, chế độ miễn giảm minh bạch cho trẻ em, người cao tuổi và khung phụ thu phòng riêng biệt.',
      effectiveDate: 'Văn bản số 03/2026/QC-GS • Hiệu lực thi hành từ 01/01/2026',
      heroPhoto: 'image/places/ggp_ha_baymau.jpg',
      photoCaption: 'Rừng dừa Bảy Mẫu Hội An — Trải nghiệm chèo thuyền thúng an toàn tuyệt đối cho cả gia đình và trẻ nhỏ.',
      gallery: [
        {
          img: 'image/da-nang-hoi-an/hoi-an-lang-rau-tra-que-01.jpg',
          title: 'Giáo dục sinh thái cho trẻ em',
          location: 'Trà Quế • Hội An',
          desc: 'Các bé được trực tiếp tưới rau, thu hoạch củ quả và tìm hiểu về hệ sinh thái tự nhiên dưới sự dẫn dắt của nghệ nhân.'
        },
        {
          img: 'image/da-lat/da-lat-ho-xuan-huong-01.jpg',
          title: 'Không gian nghỉ dưỡng người cao tuổi',
          location: 'Hồ Xuân Hương • Đà Lạt',
          desc: 'Các tuyến đường dạo bộ bằng phẳng, không khí trong lành giúp người cao tuổi thư giãn tái tạo năng lượng.'
        },
        {
          img: 'image/places/ggp_py_homestay.jpg',
          title: 'Không gian phòng gia đình ấm cúng',
          location: 'Eco Homestay • Phú Yên',
          desc: 'Bố trí đệm phụ sinh thái êm ái, đầy đủ chăn ga gối đệm riêng biệt cho các bé ngủ cùng bố mẹ.'
        }
      ],
      quickMetrics: [
        { label: 'Trẻ dưới 5 tuổi', value: 'Miễn phí 100%', desc: 'Ngủ chung cùng bố mẹ' },
        { label: 'Trẻ 5 – 10 tuổi', value: '50% – 70%', desc: 'Có ghế ngồi & suất ăn riêng' },
        { label: 'Người cao tuổi (≥65)', value: 'Giảm 10%', desc: 'Ưu tiên vị trí ngồi và phòng' }
      ],
      articles: [
        {
          articleNum: 'Điều 1',
          title: 'Quy định áp dụng đối với trẻ nhỏ dưới 5 tuổi',
          lead: 'Chính sách khuyến khích các gia đình gắn kết và giáo dục tình yêu thiên nhiên cho con trẻ từ lứa tuổi mầm non.',
          paragraphs: [
            '1.1. Khung giá áp dụng: Miễn phí 100% giá tour đối với trẻ em dưới 5 tuổi (tính đến ngày khởi hành căn cứ theo Giấy khai sinh hoặc Hộ chiếu của trẻ).',
            '1.2. Tiêu chuẩn dịch vụ được hưởng: Trẻ ngồi chung ghế trên xe với bố mẹ; ngủ chung giường với người lớn tại cơ sở lưu trú; các bữa ăn dùng chung khẩu phần của gia đình. Vé tham quan tại các điểm di tích miễn phí theo quy định của nhà nước.',
            '1.3. Định mức số lượng trong đoàn: Mỗi cặp bố mẹ chỉ được áp dụng tiêu chuẩn miễn phí cho tối đa 01 trẻ em dưới 5 tuổi. Từ trẻ thứ hai trở đi trong cùng một gia đình, áp dụng mức giá 50% vé người lớn để đảm bảo bố trí đủ ghế ngồi riêng biệt an toàn có dây đai an toàn trên xe buýt điện.',
            '1.4. Quyền lợi bảo hiểm: Mặc dù được miễn phí hoàn toàn, GreenSteps vẫn tiến hành mua gói bảo hiểm du lịch bắt buộc cho trẻ em với đầy đủ hạn mức bảo vệ quyền lợi y tế như người lớn.'
          ],
          illustration: {
            img: 'image/da-nang-hoi-an/hoi-an-lang-rau-tra-que-01.jpg',
            tag: 'Trà Quế',
            caption: 'Bé trải nghiệm thu hoạch nông sản tươi sống cùng bà con nông dân.'
          }
        },
        {
          articleNum: 'Điều 2',
          title: 'Khung giá và tiêu chuẩn dịch vụ cho trẻ em từ 5 đến 10 tuổi',
          lead: 'Đảm bảo sự phát triển thể chất và trải nghiệm giáo dục sinh thái toàn diện cho lứa tuổi thiếu nhi.',
          table: {
            headers: ['Loại hình trải nghiệm', 'Tỷ lệ thu phí', 'Tiêu chuẩn phục vụ', 'Chế độ chỗ ngủ'],
            rows: [
              ['Tour trong ngày (Day Tour)', '50% giá người lớn', 'Có ghế ngồi riêng, suất ăn dinh dưỡng riêng, vé tham quan đầy đủ', 'Không áp dụng lưu trú'],
              ['Tour lưu trú qua đêm (Multi-day)', '70% giá người lớn', 'Ghế riêng, suất ăn đầy đủ 3 bữa/ngày, quà tặng sinh thái học tập', 'Ngủ chung giường cùng bố mẹ (hoặc hỗ trợ đệm phụ)'],
              ['Yêu cầu Giường phụ riêng (Extra Bed)', 'Phụ thu 150.000đ – 250.000đ/đêm', 'Bố trí giường phụ hoặc đệm sinh thái riêng trong cùng phòng gia đình', 'Có bộ chăn ga gối đệm mới riêng biệt']
            ]
          },
          paragraphs: [
            '2.1. Độ tuổi được tính căn cứ theo năm sinh trên Giấy khai sinh hoặc Hộ chiếu tính đến thời điểm diễn ra chuyến đi.',
            '2.2. Trẻ em từ 11 tuổi trở lên được tính như người lớn, áp dụng 100% giá tour và hưởng trọn vẹn toàn bộ tiêu chuẩn giường ngủ riêng, chế độ ăn uống và quyền lợi dịch vụ của người trưởng thành.'
          ]
        },
        {
          articleNum: 'Điều 3',
          title: 'Chính sách hỗ trợ và ưu đãi dành cho Người cao tuổi',
          lead: 'Tôn vinh và tạo điều kiện tối đa cho người lớn tuổi tham gia các chuyến nghỉ dưỡng an lành giữa thiên nhiên.',
          bullets: [
            'Ưu đãi giá vé: Giảm trực tiếp 10% trên tổng giá tour cho du khách từ đủ 65 tuổi trở lên (vui lòng xuất trình CCCD khi đăng ký).',
            'Sắp xếp chỗ ngồi ưu tiên: Bố trí các vị trí ghế ngồi khoang trước trên xe điện để hạn chế rung lắc, lên xuống thuận tiện và thoáng mát.',
            'Tiêu chuẩn phòng nghỉ: Ưu tiên bố trí các phòng tại tầng trệt (tầng trệt hoặc tầng 1 có đường dốc thoải) để tránh phải leo cầu thang cao.',
            'Nhịp độ lịch trình phù hợp: Hướng dẫn viên thiết kế tốc độ di chuyển vừa phải, dành nhiều thời gian nghỉ ngơi thư giãn, tránh các cung đường dốc trơn trượt.'
          ]
        },
        {
          articleNum: 'Điều 4',
          title: 'Quy chế Phụ thu Phòng đơn (Single Supplement)',
          lead: 'Minh bạch quy định chi phí dành cho hành khách đi một mình có nhu cầu sở hữu không gian riêng tư.',
          paragraphs: [
            '4.1. Cơ sở tính giá: Mọi mức giá tour niêm yết được tính toán dựa trên định mức 02 người lớn chia sẻ 01 phòng đôi (Double bed hoặc Twin beds).',
            '4.2. Khách hàng đi du lịch một mình: Trong trường hợp khách hàng muốn ở riêng 01 phòng đơn để đảm bảo không gian cá nhân riêng tư, mức phụ thu phòng đơn dao động từ 350.000đ đến 650.000đ/đêm tùy theo loại hình Homestay sinh thái hoặc Eco Cottage.',
            '4.3. Cam kết tôn trọng khách hàng: GreenSteps tuyệt đối không tự ý ghép khách lạ vào chung phòng khi chưa có sự trao đổi và đồng thuận bằng văn bản của cả hai khách hàng.'
          ]
        }
      ]
    },

    // 4. QUY CHUẨN XANH & NET-ZERO
    {
      id: 'green-standards',
      navTitle: 'Quy chuẩn Xanh',
      fullTitle: 'QUY CHUẨN ĐẠO ĐỨC DU LỊCH SINH THÁI VÀ CAM KẾT NET-ZERO',
      subTitle: 'Bộ nguyên tắc ứng xử bảo vệ thiên nhiên, tiêu chuẩn không rác thải nhựa và cơ chế bù đắp phát thải carbon.',
      effectiveDate: 'Văn bản số 04/2026/QC-GS • Hiệu lực thi hành từ 01/01/2026',
      heroPhoto: 'image/da-lat/da-lat-rung-thong-san-may-01.jpg',
      photoCaption: 'Rừng thông Cầu Đất Đà Lạt — Cam kết bảo tồn nguyên vẹn hệ sinh thái tự nhiên và trung hòa phát thải carbon.',
      gallery: [
        {
          img: 'image/places/ggp_ha_anlacchay.jpg',
          title: 'Ẩm thực chay thực dưỡng',
          location: 'An Lạc Chay • Hội An',
          desc: '100% nguyên liệu thực vật tự nhiên theo mùa, giảm thiểu tối đa dấu chân carbon thực phẩm.'
        },
        {
          img: 'image/places/ggp_dl_langchay.jpg',
          title: 'Bảo tồn làng nghề truyền thống',
          location: 'Làng Chài • Lâm Đồng',
          desc: 'Hỗ trợ sinh kế bền vững cho các nghệ nhân và người lao động bản địa gìn giữ văn hóa gốc.'
        },
        {
          img: 'image/places/ggp_dl_tuyenlam.jpg',
          title: 'Bảo vệ nguồn nước ngọt',
          location: 'Hồ Tuyền Lâm • Đà Lạt',
          desc: 'Tuyệt đối không xả thải, cấm sử dụng cano xăng gây váng dầu và ô nhiễm tiếng ồn.'
        }
      ],
      quickMetrics: [
        { label: 'Giảm phát thải', value: '2.4 kg CO₂', desc: 'Trung bình trên mỗi khách/ngày' },
        { label: 'Quỹ trồng rừng', value: '20.000 đ', desc: 'Trích từ mỗi vé tour bán ra' },
        { label: 'Rác thải nhựa', value: '0%', desc: 'Cấm mang chai nhựa 1 lần vào rừng' }
      ],
      articles: [
        {
          articleNum: 'Điều 1',
          title: 'Bộ nguyên tắc 7 Không bảo vệ thiên nhiên (Leave No Trace)',
          lead: 'Toàn bộ hành khách và đội ngũ phục vụ của GreenSteps có nghĩa vụ tuân thủ nghiêm ngặt nguyên tắc 7 Không được quốc tế công nhận:',
          bullets: [
            '(1) Lên kế hoạch và chuẩn bị kỹ lưỡng: Luôn tìm hiểu trước về thời tiết, quy chế của khu bảo tồn thiên nhiên và trang bị đúng vật dụng thân thiện môi trường.',
            '(2) Đi lại và cắm trại trên bề mặt bền vững: Đi đúng theo các lối mòn đã được quy hoạch, tuyệt đối không dẫm đạp phá hỏng thảm rêu, cây bụi bản địa.',
            '(3) Xử lý rác thải đúng cách: Toàn bộ rác phát sinh trong hành trình bắt buộc phải được thu gom và mang ngược trở ra điểm tập kết rác đô thị. Không để lại bất kỳ vật thể nhân tạo nào trong rừng suối.',
            '(4) Giữ nguyên vẹn những gì bạn tìm thấy: Không bẻ hoa lan rừng, không nhặt đá cổ, hóa thạch hay vỏ sò san hô mang về làm đồ lưu niệm.',
            '(5) Giảm thiểu nguy cơ hỏa hoạn: Tuyệt đối không đốt lửa bừa bãi tại các vùng rừng thông, bìa rừng trong mùa khô hanh; chỉ sử dụng bếp cắm trại chuyên dụng tại các bãi quy định.',
            '(6) Tôn trọng đời sống hoang dã: Quan sát các loài chim, động vật từ khoảng cách an toàn; không cho thú hoang ăn thức ăn công nghiệp của con người.',
            '(7) Giữ gìn sự thanh tịnh cho thiên nhiên: Hạn chế mở loa kéo, không gây ồn ào; trân trọng không gian yên tĩnh để bản thân và du khách khác lắng nghe thanh âm của núi rừng.'
          ],
          illustration: {
            img: 'image/da-lat/da-lat-rung-thong-01.jpg',
            tag: 'Cầu Đất',
            caption: 'Rừng thông nguyên sinh được bảo vệ tuyệt đối theo quy tắc Leave No Trace.'
          }
        },
        {
          articleNum: 'Điều 2',
          title: 'Quy chuẩn cấm triệt để rác thải nhựa dùng một lần',
          lead: 'Cam kết hành động cụ thể để bảo vệ đất mẹ và các dòng sông quê hương khỏi hiểm họa ô nhiễm trắng.',
          paragraphs: [
            '2.1. Cấm mang rác thải nhựa dùng 1 lần: Du khách không mang theo chai nước suối nhựa dùng một lần, túi ni-lông mỏng, hộp xốp đựng thức ăn vào các khu bảo tồn sinh thái và các tuyến đường trekking.',
            '2.2. Giải pháp thay thế do GreenSteps cung cấp: Trước khi xuất phát, mỗi hành khách được phát 01 bình giữ nhiệt inox cá nhân tiệt trùng để tiếp nước miễn phí tại các trạm lọc nước sinh thái dọc đường; thức ăn dã ngoại được đóng gói bằng lá chuối, giấy dầu hoặc hộp bã mía tự phân hủy sinh học.',
            '2.3. Chế tài vi phạm: Du khách cố tình xả rác bừa bãi hoặc từ chối thu gom rác cá nhân sẽ bị từ chối tiếp tục tham gia hành trình mà không được hoàn trả chi phí tour.'
          ]
        },
        {
          articleNum: 'Điều 3',
          title: 'Cơ chế đo lường và bù đắp phát thải Carbon (Carbon Offset Fund)',
          lead: 'Minh bạch hóa chỉ số xanh và hành động thiết thực vì một tương lai trung hòa carbon (Net-Zero).',
          paragraphs: [
            '3.1. Đo lường lượng phát thải cắt giảm: Nhờ việc chuẩn hóa đội xe buýt điện, xe đạp tre và sử dụng thực phẩm nuôi trồng tại chỗ, mỗi lượt khách tham gia tour GreenSteps giúp cắt giảm trung bình 2.4kg khí CO₂ so với các tour sử dụng phương tiện động cơ đốt trong truyền thống.',
            '3.2. Quỹ Xanh Việt Nam: Với mỗi vé tour đặt thành công, GreenSteps tự động trích 20.000 VNĐ vào Quỹ Trồng rừng Bản địa để phối hợp cùng Ban Quản lý Rừng phòng hộ trồng thêm các loài cây bản địa (thông ba lá, giổi, lim xanh) tại Lâm Đồng, Quảng Nam và Phú Yên.',
            '3.3. Chứng nhận du lịch xanh điện tử: Kết thúc chuyến đi, khách hàng nhận được Giấy chứng nhận Đóng góp Xanh điện tử (Green Impact Certificate) thể hiện chính xác lượng CO₂ đã cắt giảm và mã định danh cây xanh đã trồng thay mặt mình.'
          ],
          illustration: {
            img: 'image/places/ggp_ha_anlacchay.jpg',
            tag: 'An Lạc Chay',
            caption: 'Bữa ăn chay thực dưỡng giúp giảm thiểu 40% phát thải so với bữa ăn công nghiệp.'
          }
        },
        {
          articleNum: 'Điều 4',
          title: 'Quy tắc ứng xử và bảo tồn bản sắc văn hóa địa phương',
          lead: 'Du lịch có trách nhiệm là du lịch mang lại sinh kế và niềm tự hào cho cộng đồng cư dân bản địa.',
          bullets: [
            'Trang phục lịch sự và tôn kính: Hướng dẫn viên sẽ nhắc nhở du khách mặc trang phục kín đáo, trang nghiêm khi ghé thăm các di tích tâm linh, chùa chiền, nhà rông truyền thống.',
            'Tôn trọng phong tục tập quán: Tuyệt đối không có các hành vi châm chọc, kỳ thị hoặc phán xét những tín ngưỡng, lễ nghi cổ truyền của đồng bào các dân tộc thiểu số.',
            'Thương mại công bằng (Fair Trade): Toàn bộ chi phí trải nghiệm làm nông, dệt vải, làm gốm và ăn uống được chi trả trực tiếp cho nghệ nhân và bà con nông dân với mức giá thỏa đáng, đảm bảo không có sự ép giá hay chèn ép trung gian.'
          ]
        }
      ]
    },

    // 5. BẢO HIỂM DU LỊCH & AN TOÀN
    {
      id: 'safety-insurance',
      navTitle: 'Bảo hiểm & An toàn',
      fullTitle: 'QUY ĐỊNH AN TOÀN, CHĂM SÓC Y TẾ VÀ HỢP ĐỒNG BẢO HIỂM TOÀN DIỆN',
      subTitle: 'Hạn mức bảo hiểm trách nhiệm du lịch 100.000.000 VNĐ, quy chuẩn trang thiết bị cứu hộ và mạng lưới y tế khẩn cấp 24/7.',
      effectiveDate: 'Văn bản số 05/2026/QC-GS • Hiệu lực thi hành từ 01/01/2026',
      heroPhoto: 'image/places/ggp_dl_tuyenlam.jpg',
      photoCaption: 'Hồ Tuyền Lâm Đà Lạt — An toàn tuyệt đối với đội ngũ cứu hộ thường trực và bảo hiểm du lịch trọn gói.',
      gallery: [
        {
          img: 'image/da-lat/da-lat-rung-thong-san-may-01.jpg',
          title: 'Đội ngũ cứu hộ đèo dốc',
          location: 'Cầu Đất • Đà Lạt',
          desc: 'Kiểm soát chặt chẽ các khúc cua đèo dốc, trang bị nẹp chấn thương và máy đo oxy SpO2 cơ động.'
        },
        {
          img: 'image/places/ggp_ha_baymau.jpg',
          title: 'Phao cứu sinh chuẩn quốc tế',
          location: 'Bảy Mẫu • Hội An',
          desc: '100% du khách và trẻ em bắt buộc mặc áo phao cứu sinh đạt chuẩn khi trải nghiệm trên sông nước.'
        },
        {
          img: 'image/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg',
          title: 'Liên kết y tế khẩn cấp < 30 phút',
          location: 'Đại Lãnh • Phú Yên',
          desc: 'Đường dây nóng liên kết trực tiếp với Bệnh viện Đa khoa và Trung tâm Y tế huyện sở tại.'
        }
      ],
      quickMetrics: [
        { label: 'Hạn mức bảo hiểm', value: '100.000.000 đ', desc: 'Trên mỗi khách / mỗi vụ việc' },
        { label: 'Chứng chỉ sơ cứu', value: '100% HDV', desc: 'Đạt chuẩn CPR Hội Chữ thập đỏ' },
        { label: 'Ứng cứu y tế', value: '< 30 phút', desc: 'Kết nối bệnh viện tuyến huyện' }
      ],
      articles: [
        {
          articleNum: 'Điều 1',
          title: 'Hợp đồng bảo hiểm du lịch bắt buộc và phạm vi bồi thường',
          lead: '100% hành khách tham gia hành trình cùng GreenSteps đều được mua bảo hiểm du lịch theo đúng quy định của Luật Du lịch Việt Nam.',
          paragraphs: [
            '1.1. Đơn vị bảo hiểm đối tác: Tổng Công ty Bảo hiểm Bảo Việt / Bảo hiểm PVI — đơn vị bảo hiểm hàng đầu Việt Nam có uy tín và năng lực tài chính vững mạnh.',
            '1.2. Hạn mức trách nhiệm bồi thường tối đa: 100.000.000 VNĐ (Một trăm triệu đồng) / người / vụ đối với các tổn thất về tính mạng và thương tật thân thể do tai nạn phát sinh trong suốt hành trình.',
            '1.3. Chi phí y tế cấp cứu: Hạn mức chi trả lên đến 20.000.000 VNĐ / người đối với các trường hợp cấp cứu y tế, điều trị chấn thương ngoại khoa hoặc ngộ độc thực phẩm phát sinh trong thời gian tham gia chương trình.',
            '1.4. Thời hạn hiệu lực của bảo hiểm: Bắt đầu tính từ thời điểm hướng dẫn viên đón du khách tại điểm tập kết khởi hành ban đầu cho đến thời điểm trả khách an toàn tại điểm kết thúc chuyến đi.'
          ],
          illustration: {
            img: 'image/places/ggp_dl_tuyenlam.jpg',
            tag: 'Hồ Tuyền Lâm',
            caption: 'Khu vực hoạt động mặt nước luôn có phao cứu sinh và giám sát viên y tế túc trực.'
          }
        },
        {
          articleNum: 'Điều 2',
          title: 'Trang thiết bị y tế và tiêu chuẩn cứu hộ chuyên nghiệp',
          lead: 'Đảm bảo khả năng xử lý tại chỗ kịp thời mọi tình huống y tế phát sinh trên cung đường.',
          bullets: [
            'Túi sơ cấp cứu đạt chuẩn: Mọi xe điện, thuyền chèo và hướng dẫn viên dẫn đoàn đều mang theo túi cứu thương đạt chuẩn y tế bao gồm: Băng gạc vô trùng, cồn sát khuẩn, băng cuộn co giãn, nẹp cố định chấn thương, thuốc hạ sốt, men tiêu hóa, thuốc chống dị ứng côn trùng cắn, kéo y tế và máy đo nồng độ oxy SpO2.',
            '100% Hướng dẫn viên có chứng chỉ sơ cứu CPR: Tất cả hướng dẫn viên và điều hành tour đều bắt buộc phải vượt qua kỳ sát hạch kỹ năng hồi sinh tim phổi (CPR), cố định xương gãy và xử lý đuối nước do Hội Chữ thập đỏ cấp chứng chỉ định kỳ hàng năm.',
            'Mạng lưới bệnh viện liên kết: Thiết lập sẵn danh bạ nóng và kênh liên lạc ưu tiên với các Trung tâm Y tế huyện, Trạm cứu hộ đường đèo và Bệnh viện đa khoa khu vực sở tại, đảm bảo thời gian tiếp cận phương tiện cấp cứu chuyên dụng trong vòng dưới 30 phút.'
          ]
        },
        {
          articleNum: 'Điều 3',
          title: 'Nghĩa vụ khai báo y tế và cam kết thể lực của du khách',
          lead: 'Sự phối hợp trung thực của khách hàng là yếu tố tiên quyết để đảm bảo một chuyến đi trọn vẹn và an toàn.',
          paragraphs: [
            '3.1. Trách nhiệm khai báo: Du khách có nghĩa vụ thông báo trung thực cho ban tổ chức về các tình trạng bệnh lý đặc biệt như: Tiền sử tim mạch, huyết áp cao, hen suyễn phế quản, dị ứng thức ăn nghiêm trọng, động kinh, các chấn thương cột sống chưa hồi phục hoàn toàn hoặc tình trạng mang thai.',
            '3.2. Quyền hạn của Trưởng đoàn: Trong các tour có tính chất mạo hiểm như trekking rừng sâu, leo núi dốc hoặc vượt thác, hướng dẫn viên trưởng có toàn quyền từ chối cho khách tham gia chặng vận động mạnh nếu nhận thấy tình trạng thể lực của khách không đảm bảo an toàn, đồng thời bố trí phương án nghỉ ngơi an toàn tại trạm dừng chân.'
          ]
        }
      ]
    },

    // 6. KÝ QUỸ ESCROW & PHÁP LÝ
    {
      id: 'escrow-legal',
      navTitle: 'Ký quỹ & Pháp lý',
      fullTitle: 'CƠ CHẾ KÝ QUỸ BẢO CHỨNG ESCROW, HỢP ĐỒNG ĐIỆN TỬ & KHIẾU NẠI',
      subTitle: 'Mô hình tài khoản ký quỹ độc lập bảo vệ dòng tiền du khách, tính pháp lý của vé điện tử và cam kết SLA giải quyết khiếu nại trong 24 giờ.',
      effectiveDate: 'Văn bản số 06/2026/QC-GS • Hiệu lực thi hành từ 01/01/2026',
      heroPhoto: 'image/phu-yen/phu-yen-mui-dien-bai-mon-01.jpg',
      photoCaption: 'Hải đăng Mũi Điện Đại Lãnh — Biểu tượng của sự vững chãi, độc lập và minh bạch tài chính.',
      gallery: [
        {
          img: 'image/places/ggp_dl_pineretreat.jpg',
          title: 'Hợp đồng đối tác bảo chứng',
          location: 'Pine Retreat • Đà Lạt',
          desc: '100% đối tác homestay ký quỹ cam kết chất lượng, bảo vệ khách hàng khỏi tình trạng hủy phòng đơn phương.'
        },
        {
          img: 'image/da-nang-hoi-an/hoi-an-pho-co-xe-dap-01.jpg',
          title: 'Giá trị pháp lý vé điện tử',
          location: 'Phố Cổ • Hội An',
          desc: 'Mã QR bảo mật SHA-256 có giá trị pháp lý đầy đủ như hợp đồng kinh tế theo Luật GDĐT 2023.'
        },
        {
          img: 'image/phu-yen/phu-yen-bai-xep-checkin-01.jpg',
          title: 'Cam kết SLA xử lý 24 giờ',
          location: 'Bãi Xép • Phú Yên',
          desc: 'Quy trình 3 bước giải quyết dứt điểm mọi khiếu nại chất lượng trong vòng 24 giờ làm việc.'
        }
      ],
      quickMetrics: [
        { label: 'Cơ chế Ký quỹ', value: '100% Escrow', desc: 'Bảo lưu dòng tiền tại ngân hàng' },
        { label: 'Cam kết SLA xử lý', value: '24 giờ', desc: 'Giải quyết dứt điểm khiếu nại' },
        { label: 'Tính pháp lý', value: 'Luật GDĐT 2023', desc: 'Vé điện tử có giá trị như hợp đồng' }
      ],
      articles: [
        {
          articleNum: 'Điều 1',
          title: 'Cơ chế Tài khoản Ký quỹ Độc lập (Escrow Protection Guarantee)',
          lead: 'GreenSteps tiên phong áp dụng mô hình bảo chứng thanh toán ký quỹ theo chuẩn quốc tế nhằm bảo vệ quyền lợi tuyệt đối cho khách hàng.',
          paragraphs: [
            '1.1. Nguyên lý vận hành: Toàn bộ số tiền đặt cọc và thanh toán tour của khách hàng không chuyển thẳng vào tài khoản của nhà cung cấp dịch vụ bản địa, mà được lưu trữ an toàn tại Tài khoản Ký quỹ Trung gian (Escrow Account) thuộc Ngân hàng TMCP Quân đội (MBBank).',
            '1.2. Điều kiện giải ngân: Dòng tiền chỉ được giải ngân cho đối tác vận chuyển, homestay và nhà hàng sau khi du khách đã hoàn tất trọn vẹn hành trình và không có bất kỳ phản ánh khiếu nại nghiêm trọng nào về chất lượng dịch vụ trong vòng 24 giờ kể từ thời điểm kết thúc tour.',
            '1.3. Bảo vệ chống gian lận & Phá vỡ cam kết: Nếu đối tác bản địa đơn phương hủy dịch vụ hoặc cung cấp chất lượng sai lệch nghiêm trọng so với hợp đồng đã cam kết, hệ thống ký quỹ Escrow của GreenSteps sẽ tự động kích hoạt lệnh hoàn tiền 100% lại cho khách hàng ngay lập tức.'
          ],
          callout: {
            type: 'tip',
            title: 'Bảo hiểm Ký quỹ 100%',
            text: 'Tiền của bạn luôn được ngân hàng bảo lãnh độc lập cho đến khi bạn trải nghiệm xong dịch vụ thực tế.'
          },
          illustration: {
            img: 'image/places/ggp_dl_pineretreat.jpg',
            tag: 'Escrow Partners',
            caption: 'Đối tác homestay liên kết cam kết giải ngân qua tài khoản ký quỹ độc lập MBBank.'
          }
        },
        {
          articleNum: 'Điều 2',
          title: 'Giá trị pháp lý của Mã vé Điện tử và Hợp đồng Lữ hành',
          lead: 'Ứng dụng chuyển đổi số và công nghệ mã hóa đảm bảo tính xác thực pháp lý cao nhất.',
          paragraphs: [
            '2.1. Giá trị tương đương hợp đồng kinh tế: Căn cứ Luật Giao dịch Điện tử năm 2023, Mã đặt chỗ điện tử (E-Ticket) cùng thông tin xác nhận giao dịch được hệ thống GreenSteps gửi qua email và tin nhắn có giá trị pháp lý đầy đủ như một Hợp đồng dịch vụ lữ hành ký kết trực tiếp bằng văn bản.',
            '2.2. Mã QR chống làm giả: Mỗi vé điện tử đều tích hợp mã QR động được mã hóa bảo mật SHA-256, chứa đầy đủ thông tin: Biển số xe điện đón, họ tên tài xế, mã số đăng ký homestay, số điện thoại hướng dẫn viên và hạn mức bảo hiểm.',
            '2.3. Hóa đơn điện tử hợp pháp: Hệ thống tự động xuất Hóa đơn điện tử có mã của Cơ quan Thuế cho mọi giao dịch thanh toán thành công, gửi thẳng về hòm thư điện tử của cá nhân hoặc cơ quan đăng ký.'
          ]
        },
        {
          articleNum: 'Điều 3',
          title: 'Quy trình và Cam kết SLA tiếp nhận xử lý khiếu nại',
          lead: 'Xây dựng tiêu chuẩn phản hồi nhanh chóng, minh bạch và đặt sự hài lòng của du khách làm trọng tâm.',
          bullets: [
            'Kênh tiếp nhận 24/7: Du khách có thể gửi phản ánh chất lượng qua 3 cổng chính thống: (1) Cổng tra cứu dịch vụ trực tuyến /booking-lookup; (2) Đường dây nóng hỗ trợ khẩn cấp 1900 6868; (3) Hòm thư tiếp nhận pháp chế support@greensteps.vn.',
            'Cam kết SLA bước 1 — Tiếp nhận & Phân loại: Bộ phận Kiểm soát chất lượng phản hồi tiếp nhận sự vụ trong vòng 02 giờ làm việc.',
            'Cam kết SLA bước 2 — Trích xuất nhật ký dữ liệu: Trích xuất lịch trình GPS của xe điện, camera hành trình và đối soát biên bản bàn giao dịch vụ trong vòng 12 giờ.',
            'Cam kết SLA bước 3 — Phương án giải quyết dứt điểm: Đưa ra kết luận chính thức và thực hiện chi trả tiền đền bù thỏa đáng (nếu phát hiện sai sót từ phía đối tác) trong vòng tối đa 24 giờ làm việc.'
          ]
        },
        {
          articleNum: 'Điều 4',
          title: 'Cơ quan tài phán và giải quyết tranh chấp',
          lead: 'Đảm bảo tuân thủ đầy đủ khuôn khổ pháp lý hiện hành của Nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.',
          paragraphs: [
            '4.1. Mọi tranh chấp phát sinh giữa du khách và GreenSteps hoặc giữa du khách và đối tác liên kết trước hết sẽ được ưu tiên giải quyết thông qua con đường thương lượng thiện chí, hòa giải trên tinh thần tôn trọng quyền lợi của người tiêu dùng.',
            '4.2. Trong trường hợp các bên không đạt được thỏa thuận hòa giải trong vòng 30 ngày kể từ ngày phát sinh tranh chấp, một trong các bên có quyền đưa vụ việc ra Tòa án Nhân dân có thẩm quyền tại Thành phố Hồ Chí Minh hoặc Trung tâm Trọng tài Quốc tế Việt Nam (VIAC) để phân xử theo quy định của pháp luật Việt Nam.'
          ]
        }
      ]
    }
  ];

  constructor(
    private location: Location,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const tab = params['tab'] || params['section'];
      if (tab) {
        const found = this.policies.find(p => p.id === tab || p.id.startsWith(tab));
        if (found) {
          this.activePolicyId = found.id;
        }
      }
    });
  }

  @HostListener('window:keydown.escape')
  handleEscape() {
    this.goBack();
  }

  public selectPolicy(id: string) {
    this.activePolicyId = id;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id },
      queryParamsHandling: 'merge'
    });
    window.scrollTo({ top: 460, behavior: 'smooth' });
  }

  public goBack() {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/home']);
    }
  }

  public get currentPolicy(): ComprehensivePolicy {
    return this.policies.find(p => p.id === this.activePolicyId) || this.policies[0];
  }
}
