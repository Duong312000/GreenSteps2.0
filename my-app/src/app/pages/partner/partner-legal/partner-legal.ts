import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  selector: 'app-partner-legal',
  templateUrl: './partner-legal.html',
  styleUrl: './partner-legal.css',
  standalone: false,
})
export class PartnerLegalComponent implements OnInit {
  public pageTitle = '';
  public pageDescription = '';
  public sections: { heading: string; body: string }[] = [];

  constructor(private route: ActivatedRoute, private title: Title, private meta: Meta) {}

  ngOnInit(): void {
    const page = this.route.snapshot.data['partnerPolicy'] as 'terms' | 'payment';
    const isTerms = page === 'terms';
    this.pageTitle = isTerms ? 'Điều khoản dành cho nhà cung cấp' : 'Chính sách thanh toán';
    this.pageDescription = isTerms
      ? 'Bản dự thảo các nguyên tắc hợp tác dành cho nhà cung cấp GreenSteps.'
      : 'Bản dự thảo thông tin thanh toán và đối soát dành cho đối tác GreenSteps.';
    this.sections = isTerms ? [
      { heading: '1. Phạm vi hợp tác', body: 'Điều khoản này mô tả các nguyên tắc cơ bản khi nhà cung cấp giới thiệu dịch vụ trên GreenSteps. Nội dung cụ thể sẽ được xác lập trong thỏa thuận hợp tác chính thức.' },
      { heading: '2. Trách nhiệm nhà cung cấp', body: 'Nhà cung cấp chịu trách nhiệm về tính chính xác của hồ sơ, giấy phép, giá, tình trạng chỗ và thông tin dịch vụ; đồng thời bảo đảm dịch vụ được cung cấp an toàn, đúng mô tả và tuân thủ pháp luật.' },
      { heading: '3. Trách nhiệm GreenSteps', body: 'GreenSteps hỗ trợ hiển thị dịch vụ, tiếp nhận thông tin đặt chỗ và cung cấp công cụ quản lý theo phạm vi sản phẩm hiện hành. Các chỉ tiêu vận hành và hỗ trợ cụ thể cần được hai bên xác nhận.' },
      { heading: '4. Nội dung và tiêu chuẩn', body: 'Thông tin đăng tải cần trung thực, tôn trọng khách hàng và phù hợp với nguyên tắc du lịch có trách nhiệm. GreenSteps có thể yêu cầu đối tác bổ sung hồ sơ để xác minh.' },
      { heading: '5. Tạm ngừng hoặc chấm dứt hợp tác', body: 'Các trường hợp tạm ngừng, chấm dứt và quy trình xử lý khiếu nại sẽ được quy định trong hợp đồng chính thức, sau khi được hai bên rà soát.' },
    ] : [
      { heading: '1. Phạm vi chính sách', body: 'Chính sách này là bản dự thảo thông tin về việc ghi nhận, đối soát và thanh toán giao dịch phát sinh từ dịch vụ của đối tác trên GreenSteps.' },
      { heading: '2. Đối soát giao dịch', body: 'Đối tác cần cung cấp thông tin tài khoản nhận thanh toán chính xác và kiểm tra lịch sử giao dịch. Thời điểm chốt, biểu phí và chứng từ đối soát sẽ được xác nhận trong thỏa thuận chính thức.' },
      { heading: '3. Thời gian thanh toán', body: 'Chu kỳ, thời hạn và phương thức thanh toán đang chờ xác nhận nội bộ. GreenSteps sẽ công bố rõ các mốc áp dụng trước khi chính sách có hiệu lực.' },
      { heading: '4. Điều chỉnh và hoàn trả', body: 'Giao dịch bị hủy, hoàn tiền hoặc có tranh chấp sẽ được xử lý theo chính sách đặt chỗ và thỏa thuận với nhà cung cấp. Trách nhiệm của mỗi bên cần được ghi rõ trong hợp đồng.' },
      { heading: '5. Hỗ trợ giao dịch', body: 'Khi cần tra soát, đối tác cung cấp mã giao dịch và thông tin liên quan qua kênh hỗ trợ chính thức để GreenSteps kiểm tra.' },
    ];
    this.title.setTitle(`${this.pageTitle} | GreenSteps Travel`);
    this.meta.updateTag({ name: 'description', content: this.pageDescription });
  }
}
