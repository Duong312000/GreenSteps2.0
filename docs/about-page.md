# Trang Về GreenSteps Travel

## Triển khai

- Route lazy-load `/about`; liên kết “Về chúng tôi” trong footer điều hướng tới đây.
- Giữ navbar, footer, chat và các luồng đăng nhập/đặt chỗ hiện có.
- Hero video full width, cao theo viewport trừ chiều cao navbar đo bằng ResizeObserver. Không có container, padding, shadow hoặc bo góc trên hero.
- Video HTML5 autoplay/muted/loop/playsinline/preload metadata, poster cục bộ, nút phát/dừng; tự dừng ngoài viewport và khi tab bị ẩn. Reduced motion không tải nguồn video, không autoplay, tắt reveal và smooth scroll.
- Giới thiệu hai cột trong container 1280px: tiêu đề bên trái rộng tối đa 360px, nội dung ngay bên phải cách 32px; tablet cách 24px, mobile xếp dọc cách 20px. Font Inter variable lưu cục bộ, chỉ áp dụng trong About; padding section 72px desktop / 48px mobile. Tiêu đề giới thiệu tối đa 38px, body 17px desktop / 16px mobile. Khoảng cách từ đoạn giới thiệu tới tiêu đề giá trị là 72px desktop / 56px mobile.
- Đã bỏ hoàn toàn “GreenSteps qua những con số”, gồm giao diện, CSS và request thống kê riêng của About. Giới thiệu nối trực tiếp với phần giá trị.
- Bốn giá trị với ảnh Pexels tải cục bộ, lazy loading, kích thước khai báo để hạn chế layout shift.
- Sáu thành viên do chủ dự án cung cấp; 3 cột desktop, 2 cột mobile, ảnh 4:5. Thanh Tran Duy được ghi đúng vai trò Cố vấn chuyên môn, không tự đặt chức danh C-level.
- Timeline gồm 5 mốc chính thức, dropdown “Chọn năm”, carousel scroll-snap, điều hướng bàn phím/kéo ngang và ảnh sản phẩm thật. Xem [báo cáo timeline](about-story.md).
- CTA “Khám phá hành trình” tới `/tours`.
- IntersectionObserver reveal 16px/550ms; không thư viện animation và không thêm dependency vào ứng dụng.

## Dữ liệu thật

Theo yêu cầu mới nhất, About không còn lấy hoặc hiển thị thống kê tour/điểm đến. Các API và cơ chế preload chung của dự án không thay đổi.

Tên/vai trò 6 thành viên được lấy từ yêu cầu và tin nhắn bổ sung. Không tạo người, thành tựu, năm thành lập hoặc lịch sử từ commit/seed/media metadata.

## Media và phần cần bổ sung

Nguồn từng file, tác giả, giấy phép và thông số nén: [`my-app/public/media/about/SOURCES.md`](../my-app/public/media/about/SOURCES.md).

1. **Chân dung đã tích hợp đủ 6 người**: chủ dự án đã bổ sung file gốc tại `backend/images/greensteps/founders`. Đã chuyển sang JPEG rộng tối đa 800px, tổng 342 KB và đưa vào `my-app/public/image/founders` theo đúng mapping tên. File PNG gốc được giữ nguyên, không chỉnh khuôn mặt; xem [mapping ảnh](../my-app/public/image/founders/README.md).
2. **Lịch sử đã bổ sung**: `ABOUT_MILESTONES` chứa đủ 5 cột mốc chính thức. Theo yêu cầu mới nhất, dùng dropdown “Chọn năm”, danh sách lấy từ dữ liệu thực tế (hiện có 2026). Mô tả đầy đủ có thể mở bằng “Đọc tiếp”.
3. Có thể thay ảnh minh họa công nghệ bằng ảnh thật AI Planner hoặc ảnh sở hữu của nhóm nếu có. Hiện ảnh điện thoại/bản đồ là minh họa chung, không giả làm screenshot sản phẩm.

## File thay đổi

- `my-app/src/app/pages/about/about.ts`, `about.html`, `about.css`: component standalone mới.
- `my-app/src/app/pages/about/about-data.ts`: dữ liệu team, giá trị, schema timeline.
- `my-app/src/app/pages/about/about.spec.ts`: kiểm thử logic/dữ liệu và tương tác.
- `my-app/src/app/app-routing-module.ts`: thêm một route lazy-load.
- `my-app/src/app/components/footer/footer.html`: sửa một liên kết.
- `my-app/public/media/about/`: video tối ưu, 4 ảnh và ghi nguồn.
- `my-app/public/image/founders/README.md`: hướng dẫn bổ sung ảnh gốc.
- `my-app/public/fonts/InterVariable.woff2`, `INTER-LICENSE.txt`: font Inter từ rsms.me, giấy phép SIL OFL 1.1 từ kho rsms/inter.
- `my-app/e2e/about.e2e.cjs`, `my-app/tsconfig.about-spec.json`: kiểm thử riêng About.
- `docs/about-page.md`: báo cáo này.

Không sửa backend/database/API, business logic, authentication, booking, package.json hoặc các thay đổi chưa commit sẵn có của chủ dự án.

## Kiểm thử

Chạy từ `my-app`:

```sh
npm.cmd run build
npm.cmd exec -- ng test --watch=false --ts-config=tsconfig.about-spec.json --include="src/app/pages/about/about.spec.ts"
node e2e/about.e2e.cjs
```

Production build thành công. Có cảnh báo sẵn có: initial bundle 3.65MB vượt ngưỡng warning 2MB (vẫn dưới error 4MB), và optional chaining trong template schedule-editor. About được tách lazy chunk, không thêm thư viện.

Lệnh Angular test với `tsconfig.spec.json` mặc định bị chặn bởi lỗi TypeScript ngoài phạm vi: private `cdr` trong admin-users.spec, export Community không tồn tại, jsdom thiếu declaration và index signature trong service-detail-seo.service.spec. Cấu hình `tsconfig.about-spec.json` chỉ giới hạn phạm vi compile test; không sửa hoặc bỏ qua test logic của module khác.

Test About hiện tại: 4/4 PASS, kiểm tra không có thống kê/không request danh mục, sáu thành viên/CTA/empty story, lọc năm/scroll và reduced motion. Production build sau khi bỏ thống kê thành công. Dữ liệu lịch sử trong test chỉ là fixture, không đi vào dữ liệu production.

Kết quả cuối: **6/6 unit tests PASS; toàn bộ E2E PASS**. E2E dùng production build và API mock trong browser context riêng, không ghi database; kiểm tra 1440/1024/768/390/320px, độ rộng/chiều cao hero, không tràn ngang, nội dung, footer và CTA, video decode, reduced motion, poster fallback, lỗi request thống kê và lỗi runtime. Không ghi nhận lỗi JavaScript runtime. Ảnh QA lưu tại `tmp/about-artifacts/`. Chưa kiểm tra trên thiết bị Safari/iOS thật.

Sau khi bổ sung chân dung: production build tiếp tục thành công; kiểm tra trình duyệt riêng ở 1440px và 390px xác nhận cả 6 ảnh tải/giải mã thành công, khung 4:5, không còn placeholder và không tràn ngang. Ảnh QA tại `tmp/about-assets/founders-1440.png` và `founders-390.png`.

Sau điều chỉnh typography/khoảng trắng theo phản hồi: production build thành công; kiểm tra trực tiếp dev server ở 1440/768/390px xác nhận font Inter tải thành công, heading 38/30/30px, body 17/16/16px, khoảng cách giới thiệu–giá trị 72/64/56px khi không có số liệu, không tràn ngang.
