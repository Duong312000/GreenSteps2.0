import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { LegalSection } from '../../components/legal-page-layout/legal-page-layout';

@Component({ selector: 'app-public-legal', templateUrl: './public-legal.html', standalone: false })
export class PublicLegalComponent implements OnInit {
  title = '';
  readonly audience = 'khách hàng';
  readonly audienceRoute = '/home';
  description = '';
  sections: LegalSection[] = [];
  readonly updatedAt = '19/11/2026';

  constructor(private route: ActivatedRoute, private pageTitle: Title, private meta: Meta) {}

  ngOnInit(): void {
    const policy = this.route.snapshot.data['publicPolicy'];
    const privacy = policy === 'privacy';
    const deletion = policy === 'deletion';
    this.title = deletion ? 'Hướng dẫn xóa dữ liệu' : privacy ? 'Chính sách bảo mật' : 'Điều khoản sử dụng';
    this.description = deletion
      ? 'Cách yêu cầu GreenSteps xóa tài khoản và dữ liệu liên quan đến Facebook Login.'
      : privacy
        ? 'Thông tin về dữ liệu cá nhân và cách GreenSteps xử lý thông tin khi bạn sử dụng nền tảng.'
        : 'Các nguyên tắc sử dụng nền tảng GreenSteps Travel dành cho khách hàng và người truy cập.';
    this.sections = deletion ? this.deletionSections() : privacy ? this.privacySections() : this.termsSections();
    this.pageTitle.setTitle(`${this.title} | GreenSteps Travel`);
    this.meta.updateTag({ name: 'description', content: this.description });
  }

  private termsSections(): LegalSection[] {
    return [
      { id: 'pham-vi', heading: '1. Phạm vi áp dụng', paragraphs: ['Điều khoản này áp dụng khi bạn truy cập, tạo tài khoản, tìm kiếm hoặc đặt dịch vụ trên GreenSteps Travel. Một số dịch vụ có điều kiện riêng do nhà cung cấp công bố; các điều kiện đó cần được hiển thị trước khi bạn xác nhận đặt dịch vụ.'] },
      { id: 'tai-khoan', heading: '2. Tài khoản và thông tin', paragraphs: ['Bạn cần cung cấp thông tin chính xác, giữ an toàn thông tin đăng nhập và cập nhật thông tin liên hệ khi có thay đổi. Bạn chịu trách nhiệm với hoạt động thực hiện bằng tài khoản của mình, trừ trường hợp có dấu hiệu truy cập trái phép cần báo cho GreenSteps.'] },
      { id: 'dat-dich-vu', heading: '3. Tìm kiếm và đặt dịch vụ', paragraphs: ['Thông tin giá, lịch khởi hành, nội dung bao gồm và điều kiện đổi hoặc hủy được cung cấp theo từng dịch vụ và đơn đặt. Đơn chỉ được xem là xác nhận theo trạng thái hiển thị trong tài khoản hoặc thông báo giao dịch. Vui lòng kiểm tra kỹ thông tin trước khi thanh toán.'], links: [{ label: 'Xem chính sách hủy và hoàn tiền', route: '/cancellation-policy' }, { label: 'Xem chính sách thanh toán', route: '/payment-policy' }] },
      { id: 'hanh-vi', heading: '4. Quy tắc sử dụng', paragraphs: ['Không sử dụng nền tảng để gian lận, gây gián đoạn hệ thống, xâm phạm quyền của người khác hoặc đăng tải nội dung trái pháp luật. GreenSteps có thể rà soát và xử lý nội dung hoặc tài khoản có dấu hiệu vi phạm, đồng thời thông báo lý do trong phạm vi phù hợp.'] },
      { id: 'vai-tro', heading: '5. Vai trò của GreenSteps', paragraphs: ['GreenSteps cung cấp công cụ tìm kiếm, thông tin và hỗ trợ giao dịch. Phạm vi trách nhiệm cung cấp từng dịch vụ thuộc về nhà cung cấp tương ứng theo thông tin dịch vụ và xác nhận đặt chỗ. GreenSteps tiếp nhận yêu cầu hỗ trợ và phối hợp các bên xử lý theo quy trình được công bố.'] },
      { id: 'cap-nhat', heading: '6. Cập nhật điều khoản', paragraphs: ['Điều khoản có thể được cập nhật khi dịch vụ hoặc quy trình thay đổi. Bản cập nhật cần ghi ngày áp dụng và được công bố trên trang này; thay đổi ảnh hưởng đáng kể đến người dùng cần được thông báo phù hợp trước khi áp dụng.'] },
    ];
  }

  private privacySections(): LegalSection[] {
    return [
      { id: 'du-lieu-thu-thap', heading: '1. Thông tin có thể được thu thập', paragraphs: ['GreenSteps có thể xử lý thông tin bạn chủ động cung cấp như tên, email, số điện thoại, thông tin đặt dịch vụ và nội dung trao đổi hỗ trợ. Khi bạn đăng nhập bằng Facebook, GreenSteps có thể nhận tên, email, ảnh đại diện và mã định danh Facebook do Meta cung cấp. Khi sử dụng website, một số dữ liệu kỹ thuật cần thiết để vận hành và bảo vệ nền tảng cũng có thể được ghi nhận.'] },
      { id: 'muc-dich', heading: '2. Mục đích sử dụng', paragraphs: ['Thông tin được sử dụng để tạo và bảo vệ tài khoản, xử lý yêu cầu đặt dịch vụ và thanh toán, hỗ trợ khách hàng, cải thiện tính năng, ngăn chặn gian lận và thực hiện nghĩa vụ pháp lý. Email chỉ được thêm vào danh sách bản tin khi bạn tự nguyện đăng ký.'] },
      { id: 'chia-se', heading: '3. Chia sẻ thông tin', paragraphs: ['Thông tin cần thiết cho đơn đặt có thể được chia sẻ với nhà cung cấp liên quan để thực hiện dịch vụ. GreenSteps không bán thông tin cá nhân; thông tin chỉ được cung cấp cho đơn vị xử lý hoặc cơ quan có thẩm quyền khi cần thiết cho các mục đích nêu trong chính sách này hoặc theo yêu cầu pháp luật.'] },
      { id: 'luu-tru-bao-ve', heading: '4. Lưu trữ và bảo vệ', paragraphs: ['GreenSteps áp dụng biện pháp kỹ thuật và tổ chức phù hợp để hạn chế truy cập trái phép, mất mát hoặc sử dụng sai mục đích. Thông tin được lưu trong thời gian cần thiết cho mục đích thu thập, xử lý giao dịch, giải quyết khiếu nại và tuân thủ nghĩa vụ pháp lý.'] },
      { id: 'quyen-nguoi-dung', heading: '5. Quyền và lựa chọn của bạn', paragraphs: ['Bạn có thể yêu cầu xem, cập nhật hoặc xóa thông tin cá nhân trong phạm vi pháp luật cho phép bằng cách liên hệ GreenSteps. Bạn cũng có thể liên hệ để yêu cầu ngừng nhận bản tin.'], links: [{ label: 'Xem hướng dẫn xóa dữ liệu', route: '/data-deletion' }] },
      { id: 'lien-he-cap-nhat', heading: '6. Cập nhật và liên hệ', paragraphs: ['Chính sách có thể thay đổi cùng với hoạt động của nền tảng. Bản cập nhật cần được công bố trên trang này kèm ngày áp dụng. Nếu có câu hỏi về dữ liệu cá nhân, vui lòng liên hệ GreenSteps qua trang hỗ trợ.'], links: [{ label: 'Liên hệ hỗ trợ', route: '/contact' }] },
    ];
  }

  private deletionSections(): LegalSection[] {
    return [
      { id: 'gui-yeu-cau', heading: '1. Gửi yêu cầu xóa dữ liệu', paragraphs: ['Gửi email đến Greensteps@gmail.com với tiêu đề “Yêu cầu xóa dữ liệu GreenSteps”. Trong email, ghi rõ địa chỉ email dùng cho tài khoản GreenSteps và yêu cầu xóa tài khoản hoặc dữ liệu Facebook. GreenSteps có thể yêu cầu bạn xác minh quyền sở hữu tài khoản trước khi xử lý.'] },
      { id: 'thoi-gian', heading: '2. Thời gian và phạm vi xử lý', paragraphs: ['GreenSteps sẽ phản hồi và xử lý yêu cầu hợp lệ trong vòng 30 ngày. Dữ liệu hồ sơ và liên kết Facebook sẽ bị xóa hoặc ẩn danh, trừ thông tin phải lưu để tuân thủ nghĩa vụ pháp lý hoặc giải quyết giao dịch đang diễn ra.'] },
      { id: 'go-quyen-facebook', heading: '3. Gỡ quyền trên Facebook', paragraphs: ['Bạn có thể vào Facebook, chọn Cài đặt và quyền riêng tư → Cài đặt → Ứng dụng và trang web, chọn GreenStep Login rồi nhấn Gỡ. Sau đó, hãy gửi email theo hướng dẫn trên nếu bạn muốn xóa cả dữ liệu đã lưu tại GreenSteps.'] },
      { id: 'lien-he', heading: '4. Liên hệ', paragraphs: ['Nếu cần hỗ trợ về yêu cầu xóa dữ liệu, vui lòng gửi email đến Greensteps@gmail.com.'], links: [{ label: 'Xem chính sách bảo mật', route: '/privacy-policy' }] },
    ];
  }
}
