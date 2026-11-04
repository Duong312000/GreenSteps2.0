export type HelpTopicId = 'booking' | 'payments' | 'cancellation' | 'planner' | 'account' | 'green-points';

export interface HelpTopic {
  id: HelpTopicId;
  title: string;
  description: string;
  icon: string;
}

export interface HelpArticle {
  slug: string;
  topicId: HelpTopicId;
  title: string;
  summary: string;
  icon: string;
  featured?: boolean;
  keywords: readonly string[];
  sections: readonly { heading: string; body: string; steps?: readonly string[] }[];
}

export const HELP_TOPICS: readonly HelpTopic[] = [
  { id: 'booking', title: 'Đặt tour', description: 'Tìm chuyến đi và theo dõi booking', icon: 'bi-ticket-perforated' },
  { id: 'payments', title: 'Thanh toán', description: 'Phương thức và trạng thái thanh toán', icon: 'bi-credit-card' },
  { id: 'cancellation', title: 'Hủy & Hoàn tiền', description: 'Kiểm tra điều kiện của booking', icon: 'bi-arrow-counterclockwise' },
  { id: 'planner', title: 'AI Planner', description: 'Tạo và chỉnh sửa lịch trình', icon: 'bi-stars' },
  { id: 'account', title: 'Tài khoản', description: 'Đăng nhập và thông tin cá nhân', icon: 'bi-person-circle' },
  { id: 'green-points', title: 'Điểm xanh', description: 'Theo dõi và đổi điểm trong Ví', icon: 'bi-tree' }
];

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'dat-tour-tren-greensteps', topicId: 'booking', title: 'Cách đặt tour trên GreenSteps',
    summary: 'Chọn chuyến đi, nhập thông tin khách và xem lại chi tiết trước khi xác nhận.',
    icon: 'bi-map', featured: true, keywords: ['đặt chỗ', 'booking', 'khách', 'ngày đi'],
    sections: [
      { heading: 'Tìm chuyến đi', body: 'Mở mục Chuyến đi trọn gói hoặc chọn tour từ trang dịch vụ để xem thông tin chi tiết.' },
      { heading: 'Hoàn tất thông tin', body: 'Chọn ngày và số khách theo biểu mẫu, sau đó kiểm tra thông tin liên hệ và nội dung đặt chỗ.' },
      { heading: 'Xác nhận booking', body: 'Ở bước thanh toán, xem lại giá, điều kiện hiển thị cho chuyến đi và trạng thái đặt chỗ. Sau khi gửi, bạn có thể xem booking trong hồ sơ hoặc tra cứu bằng mã booking.', steps: ['Mở Chuyến đi trọn gói.', 'Chọn tour và ngày khởi hành.', 'Điền thông tin, kiểm tra điều kiện và xác nhận.'] }
    ]
  },
  {
    slug: 'tra-cuu-booking', topicId: 'booking', title: 'Cách tra cứu booking',
    summary: 'Dùng trang tra cứu để kiểm tra thông tin một booking hiện có.',
    icon: 'bi-search', keywords: ['mã booking', 'đặt chỗ', 'tra cứu', 'trạng thái'],
    sections: [
      { heading: 'Mở trang tra cứu', body: 'Chọn liên kết tra cứu booking từ khu vực tài khoản hoặc truy cập trang Tra cứu booking.' },
      { heading: 'Nhập thông tin booking', body: 'Điền mã booking và thông tin được biểu mẫu yêu cầu để xem trạng thái cùng chi tiết booking. Nếu chưa tìm thấy, kiểm tra lại mã trên xác nhận đặt chỗ.' }
    ]
  },
  {
    slug: 'thanh-toan-booking', topicId: 'payments', title: 'Thanh toán booking như thế nào?',
    summary: 'Xem các phương thức hiện trên bước thanh toán và theo dõi trạng thái giao dịch.',
    icon: 'bi-qr-code', featured: true, keywords: ['mã QR', 'thẻ', 'ví GreenSteps', 'chuyển khoản', 'thanh toán'],
    sections: [
      { heading: 'Chọn phương thức', body: 'Các lựa chọn được hiển thị theo booking, có thể gồm Ví GreenSteps, chuyển khoản/QR, thẻ hoặc thanh toán tại quầy. Phương thức khả dụng được thể hiện trực tiếp ở bước thanh toán.' },
      { heading: 'Kiểm tra trạng thái', body: 'Làm theo hướng dẫn trên màn hình thanh toán. Với giao dịch đang chờ, trạng thái booking sẽ được cập nhật sau khi hệ thống nhận kết quả; hãy dùng trang tra cứu booking nếu cần xem lại.' },
      { heading: 'Mã ưu đãi từ điểm xanh', body: 'Nếu có mã ưu đãi đã đổi trong Ví GreenSteps, nhập mã ở ô ưu đãi trên bước thanh toán và kiểm tra phần tổng tiền trước khi xác nhận.' }
    ]
  },
  {
    slug: 'huy-booking-va-hoan-tien', topicId: 'cancellation', title: 'Làm thế nào để hủy booking?',
    summary: 'Điều kiện hủy và khoản tiền có thể hoàn phụ thuộc thông tin của từng booking.',
    icon: 'bi-calendar-x', featured: true, keywords: ['hủy', 'hoàn tiền', 'tiền cọc', 'điều kiện'],
    sections: [
      { heading: 'Kiểm tra điều kiện trước', body: 'Mở chi tiết booking và đọc điều kiện hủy hiển thị cho chính chuyến đi đó. Điều kiện và khoản có thể hoàn không giống nhau ở mọi booking.' },
      { heading: 'Yêu cầu hỗ trợ', body: 'Nếu không thấy thao tác hủy hoặc cần làm rõ trạng thái hoàn tiền, chuẩn bị mã booking và dùng chat hỗ trợ. Trung tâm hỗ trợ không thể xác nhận một thời hạn hoàn tiền chung.' }
    ]
  },
  {
    slug: 'tao-lich-trinh-ai-planner', topicId: 'planner', title: 'Cách sử dụng AI Planner',
    summary: 'Mở Lịch trình của tôi để trò chuyện, tạo bản nháp và tiếp tục chỉnh sửa lịch trình.',
    icon: 'bi-stars', featured: true, keywords: ['AI', 'lịch trình', 'trợ lý', 'điểm đến'],
    sections: [
      { heading: 'Bắt đầu từ Lịch trình của tôi', body: 'Mở Lịch trình của tôi từ menu hoặc truy cập trang Lịch trình. Bạn cũng có thể bắt đầu bằng chat GreenSteps trên trang khách hàng.' },
      { heading: 'Mô tả chuyến đi', body: 'Nhập điểm đến, số ngày hoặc sở thích để AI gợi ý. Nội dung gợi ý cần được bạn kiểm tra và điều chỉnh trước khi sử dụng.' },
      { heading: 'Lưu và chỉnh sửa', body: 'Khi tạo lịch trình, mở bản lịch trình trong trình chỉnh sửa để xem các ngày và tiếp tục thay đổi. Khả năng tạo gợi ý phụ thuộc dịch vụ AI hiện có.' }
    ]
  },
  {
    slug: 'chinh-sua-lich-trinh', topicId: 'planner', title: 'Mở lại và chỉnh sửa lịch trình',
    summary: 'Chọn lịch trình đã lưu để tiếp tục chỉnh sửa trong trang Lịch trình.',
    icon: 'bi-pencil-square', keywords: ['chỉnh sửa', 'lịch trình đã lưu', 'bản đồ', 'hoạt động'],
    sections: [
      { heading: 'Mở danh sách lịch trình', body: 'Truy cập trang Lịch trình để xem các lịch trình của bạn. Chọn một lịch trình để mở trong trình chỉnh sửa.' },
      { heading: 'Cập nhật kế hoạch', body: 'Trong trình chỉnh sửa, bạn có thể xem lịch theo ngày và sử dụng các công cụ hiển thị để điều chỉnh nội dung. Các thay đổi được lưu theo chức năng hiện có của trang.' }
    ]
  },
  {
    slug: 'cap-nhat-thong-tin-tai-khoan', topicId: 'account', title: 'Cập nhật thông tin tài khoản',
    summary: 'Quản lý hồ sơ cá nhân và thông tin liên hệ trong khu vực tài khoản.',
    icon: 'bi-person-gear', keywords: ['hồ sơ', 'đăng nhập', 'email', 'thông tin cá nhân'],
    sections: [
      { heading: 'Mở hồ sơ', body: 'Đăng nhập và mở mục Tài khoản/Hồ sơ từ menu người dùng.' },
      { heading: 'Kiểm tra thông tin', body: 'Cập nhật những trường được cho phép trong hồ sơ và lưu thay đổi. Nếu không thể đăng nhập hoặc cần xác minh tài khoản, dùng chat hỗ trợ để được hướng dẫn.' }
    ]
  },
  {
    slug: 'kiem-tra-diem-xanh', topicId: 'green-points', title: 'Kiểm tra điểm xanh trong Ví GreenSteps',
    summary: 'Xem số dư, cấp thành viên và lịch sử giao dịch ở khu vực Ví trong hồ sơ.',
    icon: 'bi-wallet2', keywords: ['điểm xanh', 'ví', 'số dư', 'lịch sử', 'cấp thành viên'],
    sections: [
      { heading: 'Mở Ví GreenSteps', body: 'Vào Hồ sơ, chọn khu vực Ví GreenSteps để xem số dư, điểm, cấp thành viên và giao dịch được tài khoản ghi nhận.' },
      { heading: 'Kiểm tra giao dịch', body: 'Lịch sử Ví hiển thị các giao dịch liên quan. Nếu số dư hoặc giao dịch bạn thấy chưa đúng, mở chat hỗ trợ và cung cấp thông tin giao dịch cần kiểm tra.' }
    ]
  },
  {
    slug: 'doi-diem-xanh-lay-uu-dai', topicId: 'green-points', title: 'Đổi điểm xanh lấy mã ưu đãi',
    summary: 'Đổi điểm trong Ví và nhập mã ưu đãi ở bước thanh toán booking.',
    icon: 'bi-gift', keywords: ['đổi điểm', 'voucher', 'mã ưu đãi', 'GreenSteps'],
    sections: [
      { heading: 'Đổi điểm trong Ví', body: 'Trong Ví GreenSteps, chọn đổi điểm, nhập số điểm theo yêu cầu trên giao diện và xác nhận. Màn hình sẽ báo kết quả cùng mã ưu đãi nếu đổi thành công.' },
      { heading: 'Sử dụng mã', body: 'Nhập mã tại ô mã ưu đãi trên trang thanh toán booking. Kiểm tra lại giá trị được áp dụng trước khi xác nhận. Số điểm tối thiểu và giá trị ưu đãi được hiển thị trong Ví.' }
    ]
  }
];

export function normalizeHelpText(value: string): string {
  return value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/\s+/g, ' ').trim();
}

export function searchHelpArticles(query: string, articles: readonly HelpArticle[] = HELP_ARTICLES): HelpArticle[] {
  const normalizedQuery = normalizeHelpText(query);
  if (!normalizedQuery) return [...articles];
  const terms = normalizedQuery.split(' ');
  return articles.filter(article => {
    const searchable = normalizeHelpText([
      article.title,
      article.summary,
      ...article.keywords,
      ...article.sections.flatMap(section => [section.heading, section.body, ...(section.steps ?? [])])
    ].join(' '));
    return terms.every(term => searchable.includes(term));
  });
}
