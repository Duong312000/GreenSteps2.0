import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-how-it-works',
  standalone: false,
  templateUrl: './how-it-works.html',
  styleUrl: './how-it-works.css'
})
export class HowItWorksComponent implements OnInit {
  public steps = [
    {
      num: '01',
      title: 'Tìm kiếm & Khám phá',
      desc: 'Lọc điểm đến sinh thái và trải nghiệm xanh theo mức độ giảm thiểu phát thải CO2.'
    },
    {
      num: '02',
      title: 'Khởi tạo bằng AI',
      desc: 'Cung cấp số ngày và ngân sách để trợ lý AI tạo khung lịch trình tự động tối ưu.'
    },
    {
      num: '03',
      title: 'Tùy chỉnh & Tối ưu chi phí',
      desc: 'Kéo thả, thay đổi hoạt động và sửa các mâu thuẫn thời gian di chuyển bằng 1 thao tác.'
    },
    {
      num: '04',
      title: 'Đặt chỗ & Nhận E-Voucher',
      desc: 'Thanh toán cọc bảo chứng qua VietQR động và nhận mã vé điện tử tức thì.'
    }
  ];

  ngOnInit(): void {
    // Optionally trigger the interactive tour
  }

  public launchTour(): void {
    window.dispatchEvent(new CustomEvent('open-onboarding-tour'));
  }
}

