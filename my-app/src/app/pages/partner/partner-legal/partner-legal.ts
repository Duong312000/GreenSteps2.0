import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { LegalSection } from '../../../components/legal-page-layout/legal-page-layout';

@Component({
  selector: 'app-partner-legal',
  templateUrl: './partner-legal.html',
  standalone: false,
})
export class PartnerLegalComponent implements OnInit {
  public pageTitle = '';
  public pageDescription = '';
  public updatedAt = '11/11/2026';
  public sections: LegalSection[] = [];
  public finalCta?: { heading: string; description: string; label: string; route: string };

  constructor(private route: ActivatedRoute, private title: Title, private meta: Meta) {}

  ngOnInit(): void {
    const page = this.route.snapshot.data['partnerPolicy'] as 'terms' | 'payment';
    const isTerms = page === 'terms';
    this.pageTitle = isTerms ? 'Điều khoản dành cho nhà cung cấp' : 'Chính sách thanh toán';
    this.pageDescription = isTerms
      ? 'Bản dự thảo quy định hợp tác, quyền lợi và trách nhiệm của nhà cung cấp trên GreenSteps.'
      : 'Thông tin về phương thức thanh toán, đối soát và xử lý giao dịch dành cho nhà cung cấp GreenSteps.';
    this.sections = isTerms ? this.termsSections() : this.paymentSections();
    this.finalCta = isTerms ? {
      heading: 'Bạn đã sẵn sàng hợp tác?',
      description: 'Tạo hồ sơ nhà cung cấp để bắt đầu giới thiệu dịch vụ trên GreenSteps.',
      label: 'Đăng ký trở thành đối tác',
      route: '/become-a-partner',
    } : undefined;
    this.title.setTitle(`${this.pageTitle} | GreenSteps Travel`);
    this.meta.updateTag({ name: 'description', content: this.pageDescription });
  }

  private termsSections(): LegalSection[] {
    return [
      {
        id: 'gioi-thieu-chap-nhan', heading: 'Điều 1. Giới thiệu và chấp nhận điều khoản',
        paragraphs: ['Điều khoản này quy định nguyên tắc tham gia và hợp tác giữa GreenSteps với cá nhân, hộ kinh doanh hoặc tổ chức đăng ký cung cấp dịch vụ trên nền tảng. Khi gửi hồ sơ hoặc tiếp tục sử dụng khu vực nhà cung cấp, bạn xác nhận đã đọc và hiểu nội dung dự thảo này.', 'Các điều kiện thương mại cụ thể, nếu có, cần được ghi nhận trong thỏa thuận riêng được các bên xác nhận. Điều khoản này không thay thế giấy phép hoặc nghĩa vụ pháp lý của mỗi bên.'],
      },
      {
        id: 'dinh-nghia', heading: 'Điều 2. Định nghĩa',
        paragraphs: ['“Nền tảng” là website, ứng dụng và công cụ trực tuyến GreenSteps vận hành. “Nhà cung cấp” là cá nhân hoặc tổ chức được đăng ký để giới thiệu và cung cấp sản phẩm, dịch vụ trên nền tảng. “Khách hàng” là người tìm kiếm, đặt hoặc sử dụng dịch vụ.', '“Dịch vụ” bao gồm dịch vụ du lịch/lưu trú, “Tour” là chương trình tham quan hoặc trải nghiệm có lịch trình, và “Khuyến mãi” là ưu đãi do nhà cung cấp hoặc GreenSteps công bố theo điều kiện cụ thể.'],
      },
      {
        id: 'dang-ky-duyet-ho-so', heading: 'Điều 3. Điều kiện đăng ký và quy trình duyệt hồ sơ',
        paragraphs: ['Nhà cung cấp cần cung cấp thông tin liên hệ, thông tin kinh doanh và giấy tờ phù hợp với loại hình hoạt động. GreenSteps có thể yêu cầu bổ sung hoặc đối chiếu giấy tờ trước khi hiển thị dịch vụ.', 'Hồ sơ được tiếp nhận ở trạng thái “Chờ duyệt”. Sau khi xem xét, hồ sơ có thể chuyển sang “Đã duyệt” hoặc “Từ chối”. Nếu giấy tờ thiếu, chưa hợp lệ hoặc cần xác minh, nhà cung cấp cần bổ sung theo hướng dẫn và hồ sơ có thể tiếp tục chờ xem xét. Thời gian duyệt dự kiến: tối đa 2 ngày làm việc kể từ khi nhận đủ hồ sơ.'],
        callout: { label: 'Trạng thái hồ sơ', text: 'Trạng thái trong trang quản lý cho biết tiến trình xét duyệt, không phải xác nhận giấy phép hay bảo đảm doanh thu.' },
      },
      {
        id: 'quyen-loi-nha-cung-cap', heading: 'Điều 4. Quyền lợi của nhà cung cấp',
        paragraphs: ['Nhà cung cấp được tạo và quản lý nội dung dịch vụ trong phạm vi tính năng được cấp; tiếp nhận thông tin đặt chỗ; theo dõi trạng thái giao dịch, phản hồi khách hàng và dữ liệu hoạt động mà nền tảng cung cấp.', 'Nhà cung cấp có thể tiếp cận công cụ quảng bá, chương trình khuyến mãi và kênh hỗ trợ hiện có theo điều kiện áp dụng. Việc hiển thị hoặc tham gia chương trình không đồng nghĩa với cam kết về lượng truy cập, đặt chỗ hay doanh thu.'],
      },
      {
        id: 'trach-nhiem-nha-cung-cap', heading: 'Điều 5. Trách nhiệm của nhà cung cấp',
        paragraphs: ['Nhà cung cấp chịu trách nhiệm về tính chính xác, đầy đủ và cập nhật của hồ sơ, giấy phép, giá, tình trạng chỗ, lịch phục vụ và các thông tin đã đăng tải.', 'Nhà cung cấp phải cung cấp dịch vụ an toàn, đúng mô tả và xác nhận; xử lý yêu cầu của khách đúng hạn; lưu giữ chứng từ liên quan; tuân thủ quy định về kinh doanh, thuế, bảo vệ người tiêu dùng, an toàn và các quy định pháp luật áp dụng.'],
      },
      {
        id: 'noi-dung-gia-khuyen-mai', heading: 'Điều 6. Quy định đăng tải nội dung, giá và khuyến mãi',
        paragraphs: ['Nội dung, hình ảnh và thông tin dịch vụ phải có quyền sử dụng hợp pháp, không gây hiểu nhầm, không xâm phạm quyền của bên thứ ba và phản ánh đúng trải nghiệm khách sẽ nhận được.', 'Giá cần nêu rõ đơn vị tính, khoản bao gồm/không bao gồm, phụ thu và điều kiện áp dụng. Mã khuyến mãi cần có thời hạn, đối tượng, giới hạn sử dụng và quy tắc kết hợp ưu đãi. Nhà cung cấp phải cập nhật kịp thời khi thông tin thay đổi.'],
      },
      {
        id: 'hoa-hong-thanh-toan-doi-soat', heading: 'Điều 7. Hoa hồng, thanh toán và đối soát',
        paragraphs: ['Tỷ lệ hoa hồng, khoản phí, chu kỳ đối soát và thời hạn thanh toán cần được thông báo trước và ghi rõ trong thỏa thuận áp dụng cho nhà cung cấp. Các điều kiện cụ thể sẽ được xác nhận với nhà cung cấp trước khi áp dụng.', 'Việc xác nhận, hoàn tiền và rút số dư thực hiện theo quy trình giao dịch tương ứng. Nhà cung cấp cần kiểm tra lịch sử và gửi yêu cầu đối soát kèm mã giao dịch khi phát hiện sai lệch.'],
        links: [{ label: 'Xem Chính sách thanh toán', route: '/payment-policy' }],
      },
      {
        id: 'huy-hoan-tien-khieu-nai', heading: 'Điều 8. Hủy, hoàn tiền và xử lý khiếu nại',
        paragraphs: ['Nhà cung cấp cần công bố điều kiện đổi, hủy và hoàn tiền trước khi khách đặt dịch vụ; thực hiện đúng điều kiện đã xác nhận cho đơn, trừ trường hợp các bên thống nhất phương án khác hoặc pháp luật có quy định khác.', 'Khi có khiếu nại, nhà cung cấp phối hợp cung cấp lịch sử trao đổi, xác nhận đặt chỗ và chứng từ liên quan sớm nhất có thể, theo thời hạn nêu trong yêu cầu xử lý cụ thể. GreenSteps tiếp nhận và điều phối thông tin; trách nhiệm cung cấp dịch vụ vẫn thuộc nhà cung cấp theo phạm vi cam kết với khách.'],
      },
      {
        id: 'so-huu-tri-tue-bao-mat', heading: 'Điều 9. Quyền sở hữu trí tuệ và bảo mật dữ liệu',
        paragraphs: ['Nhà cung cấp giữ quyền đối với nội dung do mình sở hữu và cấp cho GreenSteps quyền sử dụng không độc quyền trong phạm vi cần thiết để hiển thị, quảng bá và vận hành dịch vụ trên nền tảng. Nhà cung cấp bảo đảm đã có quyền sử dụng hình ảnh, nhãn hiệu và tài liệu gửi lên.', 'Mỗi bên chỉ sử dụng dữ liệu khách hàng cho mục đích thực hiện đơn và hỗ trợ liên quan; không mua bán, tiết lộ hoặc sử dụng ngoài phạm vi được phép. Các bên áp dụng biện pháp bảo vệ thông tin và thông báo khi phát hiện sự cố dữ liệu.'],
      },
      {
        id: 'vi-pham-tam-ngung-cham-dut', heading: 'Điều 10. Vi phạm, tạm ngưng và chấm dứt hợp tác',
        paragraphs: ['GreenSteps có thể yêu cầu khắc phục, ẩn nội dung, tạm ngừng tính năng hoặc tạm ngưng hiển thị khi có dấu hiệu thông tin sai lệch, giấy tờ không hợp lệ, rủi ro an toàn, khiếu nại nghiêm trọng hoặc vi phạm điều khoản.', 'Khi phù hợp, nhà cung cấp được thông báo lý do và thời hạn phản hồi cụ thể trong thông báo xử lý. Hợp tác có thể chấm dứt theo thỏa thuận, khi vi phạm không được khắc phục hoặc theo yêu cầu của pháp luật. Việc xử lý các đơn đang thực hiện và khoản còn phải đối soát cần được hai bên phối hợp hoàn tất.'],
      },
      {
        id: 'gioi-han-trach-nhiem', heading: 'Điều 11. Giới hạn trách nhiệm',
        paragraphs: ['Trong phạm vi pháp luật cho phép, mỗi bên chịu trách nhiệm đối với nghĩa vụ và hành vi thuộc phạm vi kiểm soát của mình. GreenSteps cung cấp công cụ nền tảng theo trạng thái hiện có và không bảo đảm dịch vụ hoạt động liên tục, không lỗi hoặc đạt một mức doanh thu cụ thể.', 'Điều khoản này không loại trừ trách nhiệm mà pháp luật không cho phép miễn trừ. Phạm vi giới hạn, ngoại lệ và cơ chế bồi thường (nếu có) cần được quy định trong thỏa thuận chính thức và tuân thủ pháp luật áp dụng.'],
      },
      {
        id: 'luat-ap-dung-tranh-chap', heading: 'Điều 12. Luật áp dụng và giải quyết tranh chấp',
        paragraphs: ['Điều khoản chính thức dự kiến được điều chỉnh theo pháp luật Việt Nam. Các bên ưu tiên trao đổi thiện chí để giải quyết bất đồng trong thời hạn do hai bên thống nhất; nếu không đạt thỏa thuận, tranh chấp được xử lý tại cơ quan có thẩm quyền theo quy định pháp luật.', 'Cơ quan giải quyết, địa điểm và trình tự cụ thể cần được pháp chế xác nhận trước khi ban hành.'],
      },
      {
        id: 'hieu-luc-sua-doi', heading: 'Điều 13. Hiệu lực và sửa đổi điều khoản',
        paragraphs: ['Điều khoản chính thức có hiệu lực từ ngày được công bố hoặc ngày được các bên xác nhận trong thỏa thuận. Mọi sửa đổi cần nêu rõ nội dung và ngày bắt đầu áp dụng; thời gian thông báo trước sẽ được quy định trong thông báo cập nhật và thỏa thuận áp dụng.', 'Nếu một phần điều khoản không thể thực thi, các phần còn lại tiếp tục được xem xét áp dụng trong phạm vi pháp luật cho phép. Bản hiện tại là dự thảo, chưa tạo thành cam kết pháp lý hoàn chỉnh trước khi được phê duyệt.'],
      },
    ];
  }

  private paymentSections(): LegalSection[] {
    return [
      {
        id: 'pham-vi-dinh-nghia', heading: '1. Phạm vi áp dụng và định nghĩa',
        paragraphs: [
          'Chính sách này là bản dự thảo áp dụng cho các giao dịch đặt dịch vụ, thanh toán của khách và khoản thanh toán/đối soát cho nhà cung cấp phát sinh trên GreenSteps.',
          '“Giao dịch” là khoản tiền được tạo để thanh toán hoặc hoàn trả cho một đặt chỗ. “Ví GreenSteps” là số dư hiển thị trong tài khoản nền tảng; “đối soát” là việc kiểm tra giao dịch, phí, hoàn tiền và số tiền nhà cung cấp được nhận.',
        ],
      },
      {
        id: 'phuong-thuc-thanh-toan', heading: '2. Phương thức thanh toán được hỗ trợ',
        paragraphs: ['Phương thức khả dụng được hiển thị tại bước thanh toán của từng đơn. Giao dịch chỉ được xem là hoàn tất khi hệ thống hoặc đơn vị thanh toán xác nhận thành công.'],
        methods: [
          { name: 'Chuyển khoản ngân hàng', description: 'Thanh toán theo thông tin hoặc mã QR được tạo cho đơn.', note: 'Chỉ chuyển đúng số tiền và nội dung hướng dẫn.' },
          { name: 'Ví điện tử', description: 'Thanh toán qua ví điện tử được tích hợp tại thời điểm giao dịch.', note: 'Danh sách ví khả dụng hiển thị tại checkout.' },
          { name: 'Thẻ nội địa', description: 'Thẻ ngân hàng nội địa có hỗ trợ thanh toán trực tuyến.', note: 'Ngân hàng có thể yêu cầu xác thực bổ sung.' },
          { name: 'Thẻ quốc tế', description: 'Thẻ quốc tế thuộc mạng lưới được cổng thanh toán chấp nhận.', note: 'Phí chuyển đổi ngoại tệ (nếu có) do đơn vị phát hành áp dụng.' },
          { name: 'Ví GreenSteps', description: 'Sử dụng số dư ví đủ điều kiện trong tài khoản GreenSteps.', note: 'Số dư bị trừ được ghi nhận trong lịch sử ví.' },
        ],
        callout: { label: 'Lưu ý', text: 'Phương thức cụ thể có thể thay đổi theo nhà cung cấp thanh toán, loại dịch vụ và trạng thái hệ thống.' },
      },
      {
        id: 'quy-trinh-xac-nhan', heading: '3. Quy trình thanh toán và xác nhận giao dịch',
        paragraphs: [
          'Khách kiểm tra thông tin dịch vụ, ngày sử dụng, số lượng và tổng tiền trước khi xác nhận. GreenSteps chuyển yêu cầu tới phương thức đã chọn và cập nhật trạng thái theo phản hồi từ đơn vị thanh toán.',
          'Sau khi nhận xác nhận thành công, hệ thống ghi nhận giao dịch và gửi thông tin đơn qua kênh liên hệ đã đăng ký. Nếu trạng thái chưa cập nhật, khách không nên thanh toán lặp lại trước khi kiểm tra lịch sử giao dịch hoặc liên hệ hỗ trợ.',
        ],
        callout: { label: 'Thời gian xác nhận', text: 'Thời gian cập nhật phụ thuộc phương thức thanh toán và phản hồi của đơn vị xử lý giao dịch. Hãy kiểm tra trạng thái đơn trước khi thử thanh toán lại để tránh tạo giao dịch trùng.' },
      },
      {
        id: 'phi-va-thue', heading: '4. Phí và thuế',
        paragraphs: [
          'Các khoản phí áp dụng cho khách hoặc nhà cung cấp cần được hiển thị hoặc thông báo trước khi xác nhận giao dịch. Mức phí nền tảng (nếu áp dụng) được xác nhận trong thỏa thuận với nhà cung cấp; không có tỷ lệ chung được công bố tại bản dự thảo này.',
          'Mỗi bên tự thực hiện nghĩa vụ thuế theo quy định áp dụng cho hoạt động của mình. Hóa đơn, chứng từ và bên phát hành cần được xác định theo mô hình giao dịch và quy định pháp luật hiện hành.',
        ],
        callout: { label: 'Cần xác nhận', text: 'Biểu phí, cách tính thuế và trách nhiệm phát hành hóa đơn là nội dung dự thảo; chưa phải cam kết mức phí chính thức.' },
      },
      {
        id: 'doi-soat-thanh-toan-nha-cung-cap', heading: '5. Đối soát và thanh toán cho nhà cung cấp',
        paragraphs: [
          'GreenSteps tổng hợp các đơn hoàn thành, khoản điều chỉnh, phí và hoàn tiền để xác định số dư có thể thanh toán. Chu kỳ đối soát và lịch thanh toán được xác định trong thỏa thuận áp dụng cho từng nhà cung cấp.',
          'Nhà cung cấp có thể gửi yêu cầu rút số dư khả dụng từ Ví GreenSteps khi đã hoàn tất xác minh hồ sơ, cung cấp thông tin tài khoản nhận tiền hợp lệ và không có khoản giữ lại hoặc tranh chấp đang xử lý.',
          'Hạn mức rút và thời gian xử lý (nếu có) được thông báo trong quy định Ví GreenSteps hoặc tại thời điểm gửi yêu cầu rút tiền. Chỉ số dư khả dụng, đã hoàn tất đối soát và đáp ứng điều kiện xác minh mới có thể được rút.',
        ],
        callout: { label: 'Điều kiện rút tiền', text: 'Số dư đang chờ đối soát, bị hoàn tiền hoặc gắn với tranh chấp có thể chưa đủ điều kiện rút.' },
      },
      {
        id: 'hoan-tien-huy-giao-dich', heading: '6. Hoàn tiền và hủy giao dịch',
        paragraphs: [
          'Điều kiện hủy phụ thuộc chính sách của dịch vụ được đặt và thông tin hiển thị trước khi khách thanh toán. Khi yêu cầu hủy được chấp thuận, khoản hoàn được gửi về phương thức thanh toán ban đầu nếu phương thức đó hỗ trợ; trường hợp khác sẽ được hướng dẫn riêng.',
          'Thời gian hoàn tiền phụ thuộc quá trình xác nhận yêu cầu và đơn vị phát hành phương thức thanh toán. Thời gian tiền thực tế xuất hiện có thể khác nhau giữa ngân hàng, ví điện tử và đơn vị phát hành thẻ.',
        ],
        callout: { label: 'Mốc tính thời gian', text: 'Thời hạn hoàn tiền cần tính từ thời điểm GreenSteps xác nhận yêu cầu đủ điều kiện, không phải lúc khách bắt đầu gửi yêu cầu.' },
      },
      {
        id: 'loi-tranh-chap-khieu-nai', heading: '7. Giao dịch lỗi, tranh chấp và khiếu nại',
        paragraphs: [
          'Nếu bị trừ tiền nhưng đơn chưa được xác nhận, khách hoặc nhà cung cấp nên lưu mã giao dịch, thời điểm thanh toán và chứng từ liên quan. GreenSteps sẽ kiểm tra với đơn vị thanh toán và cập nhật kết quả qua kênh liên hệ đã cung cấp.',
          'Nếu phát hiện sai lệch, vui lòng gửi khiếu nại sớm nhất có thể kèm mã giao dịch và chứng từ. Thời hạn tiếp nhận cụ thể (nếu có) phụ thuộc điều kiện của phương thức thanh toán và sẽ được thông báo khi áp dụng. Tranh chấp được rà soát theo lịch sử đơn, xác nhận từ đơn vị thanh toán và thông tin do các bên cung cấp.',
          'Kênh hỗ trợ: Greensteps@gmail.com hoặc 0913382135. Không gửi mật khẩu, mã OTP hoặc toàn bộ số thẻ qua kênh hỗ trợ.',
        ],
      },
      {
        id: 'bao-mat-thanh-toan', heading: '8. Bảo mật thông tin thanh toán',
        paragraphs: [
          'Thông tin thanh toán được xử lý theo phạm vi cần thiết để xác nhận giao dịch, đối soát và phòng chống gian lận. Thông tin thẻ nhạy cảm được xử lý bởi đơn vị thanh toán tương ứng theo tiêu chuẩn áp dụng; GreenSteps không yêu cầu khách gửi mã OTP hoặc mật khẩu.',
          'Người dùng cần bảo vệ thông tin đăng nhập và thông báo ngay cho GreenSteps nếu phát hiện hoạt động bất thường. Việc lưu trữ, chia sẻ và thời hạn lưu dữ liệu cần tuân thủ chính sách bảo mật của nền tảng và quy định pháp luật.',
        ],
      },
      {
        id: 'thay-doi-chinh-sach', heading: '9. Thay đổi chính sách',
        paragraphs: ['GreenSteps có thể cập nhật chính sách khi phương thức thanh toán, quy trình hoặc quy định pháp luật thay đổi. Nội dung cập nhật cần nêu ngày hiệu lực và được thông báo trước trong thời gian phù hợp với nội dung thay đổi và quy định pháp luật; giao dịch đã xác nhận được xử lý theo điều kiện áp dụng tại thời điểm đặt, trừ trường hợp pháp luật yêu cầu khác.'],
      },
      {
        id: 'lien-he-ho-tro', heading: '10. Thông tin liên hệ hỗ trợ',
        paragraphs: [
          'Để được hỗ trợ về thanh toán, hoàn tiền hoặc đối soát, vui lòng cung cấp mã đơn/mã giao dịch và email tài khoản qua Greensteps@gmail.com, số điện thoại 0913382135 hoặc địa chỉ 106/3A - An Thạnh - Thuận An - Bình Dương.',
          'Thông tin phí, chu kỳ đối soát, hạn mức và thời hạn xử lý cần được xác nhận trước khi ban hành chính sách chính thức. Bản hiện tại là dự thảo và cần pháp chế xác nhận.',
        ],
      },
    ];
  }
}
