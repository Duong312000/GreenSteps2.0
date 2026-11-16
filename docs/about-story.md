# Hành trình GreenSteps

Triển khai theo nội dung chính thức do chủ dự án cung cấp ngày 13/11/2026. Giữ nguyên chính xác 5 ngày/tháng, tiêu đề và toàn bộ mô tả trong `ABOUT_MILESTONES`. Mốc cuối có độ chính xác tháng (`2026-11`), không tự thêm ngày.

Section dùng heading, lời dẫn và carousel editorial nền trắng, không khung card hoặc thư viện carousel. Theo yêu cầu mới nhất, dùng dropdown “Chọn năm” bên phải tiêu đề, bỏ toàn bộ tab tháng. Danh sách năm được lấy từ dữ liệu thực tế, hiện có 2026; chọn năm cuộn tới mốc đầu tiên của năm, giá trị cập nhật theo mốc đang xem. Desktop thấy khoảng 2,75 thẻ; tablet khoảng 1,8; mobile thấy một thẻ và phần thẻ kế tiếp. Ảnh 4:3 và lazy-load. Mô tả hiển thị trước 4 dòng, “Đọc tiếp” mở toàn bộ nguyên văn, có aria-expanded và aria-controls.

Tương tác: dropdown năm cuộn tới mốc tương ứng; nút trước/sau; vuốt native trên mobile và kéo bằng chuột trên desktop; Left/Right/Home/End khi focus vùng carousel. Không tự chạy. Scroll snap, scrollbar ẩn, reduced motion dùng cuộn tức thì và reveal được tắt theo cơ chế hiện có. Không gọi API hoặc sửa backend.

Ảnh sử dụng lại các ảnh Pexels đã ghi giấy phép; thêm hai screenshot thực tế trang chủ và AI Planner ở phiên ẩn danh, không gửi tin nhắn hay thao tác ghi dữ liệu. Đây là ảnh sản phẩm hiện tại, không giả làm ảnh chụp tại thời điểm lịch sử. Ảnh lập kế hoạch là minh họa chung, không giả làm ảnh hoạt động nội bộ. Xem [nguồn media](../my-app/public/media/about/SOURCES.md).

Các file liên quan:

- `my-app/src/app/pages/about/about-data.ts`: schema và 5 mốc chính thức.
- `my-app/src/app/pages/about/about.ts`: trạng thái/thao tác carousel, mở rộng nội dung, keyboard/pointer và ResizeObserver.
- `my-app/src/app/pages/about/about.html`, `about.css`: chỉ thay section story và style phụ thuộc trực tiếp.
- `my-app/src/app/pages/about/about.spec.ts`: kiểm thử dữ liệu chính thức và các tương tác.
- `my-app/e2e/about-story.e2e.cjs`: browser QA ở 375/768/1440/1920px.
- `my-app/e2e/about.e2e.cjs`: thay assertions dropdown rỗng bằng 5 mốc và 4 tháng.
- `my-app/public/media/about/story-home.jpg`, `story-planner.jpg`, `SOURCES.md`.

Lệnh kiểm tra từ `my-app`:

```sh
npm.cmd run build
npm.cmd exec -- ng test --watch=false --ts-config=tsconfig.about-spec.json --include="src/app/pages/about/about.spec.ts"
node e2e/about-story.e2e.cjs
```

Build production thành công, giữ nguyên các cảnh báo sẵn có về initial bundle và optional chaining trong schedule-editor. **8/8 unit tests PASS; toàn bộ Story E2E PASS ở 375/768/1440/1920px**, không có unhandled errors hoặc lỗi JavaScript runtime. Browser QA kiểm tra ảnh 4:3, chiều rộng card và phần thẻ kế tiếp, không overflow trang, tháng/arrow/keyboard, mở rộng nguyên văn, scroll-sync, kéo chuột và reduced motion. Ảnh QA tại `tmp/about-story-artifacts/`.

Navbar, hero video, giới thiệu, giá trị, founder, CTA và footer không thay đổi trong lần cập nhật timeline này. Không thêm dependency.
