# Căn cứ triển khai cho mục 3.6

Tài liệu này ghi nhận mã nguồn được đối chiếu khi viết báo cáo. Không chứa biến môi trường, khóa API, thông tin đăng nhập hoặc dữ liệu cá nhân. Trạng thái “đề xuất” chỉ các quy tắc thiết kế được nêu trong báo cáo mà chưa xác minh thấy có luồng thực thi hoàn chỉnh.

| Nội dung | Căn cứ trong dự án | Trạng thái |
|---|---|---|
| Kiến trúc Angular, Express, MongoDB | `my-app/package.json`; `backend/package.json`; `backend/README.md` | Đã triển khai |
| Route trang AI Planner và trình biên tập | `my-app/src/app/app-routing-module.ts`; `my-app/src/app/pages/ai-planner/ai-planner.ts`; `my-app/src/app/pages/schedule-editor/schedule-editor.module.ts` | Đã triển khai |
| Biểu mẫu tạo lịch: điểm đến, tên, ngày đi/về, email đồng hành; kiểm tra thứ tự ngày | `my-app/src/app/pages/schedule-editor/schedule-editor.html` phần biểu mẫu tạo mới; `schedule-editor.ts` hàm `submitCreateNewTrip` | Đã triển khai |
| Bản nháp khách lưu trong trình duyệt; người đăng nhập gọi API | `schedule-editor.ts` hàm `submitCreateNewTrip`, `saveItineraryToDb` | Đã triển khai |
| Tải danh sách lịch trình và chỉnh sửa ngày/hoạt động | `schedule-editor.ts` các hàm `loadSavedItinerariesList`, `loadItineraryToEditor`, `addDayToItinerary`, `deleteDay`, `deleteActivity`, `moveActivity`, `onActivityTimeChanged` | Đã triển khai |
| Dịch vụ gợi ý theo điểm đến | `schedule-editor.ts` hàm `loadDynamicRecommendations`; `my-app/src/app/services/api.service.ts` hàm `getServicesByDestination` | Đã triển khai |
| Kiểm tra xung đột giờ liền kề và giãn giờ tự động | `schedule-editor.ts` các hàm `getDwellMinutesForType`, `getEstimatedTransitMinutes`, `checkTimeConflicts`, `autoAdjustIllogicalTimes`, `fixSingleActivityTime` | Đã triển khai |
| Tổng chi phí/carbon trong trình biên tập; chi phí theo người và dùng chung ở checkout | `schedule-editor.ts` hàm `recalculateMetrics` và các getter `itineraryPerPersonCost`, `itineraryFlatCost`, `itineraryTotalCost` | Đã triển khai |
| Tuyến OSRM, khoảng cách Haversine và thời gian dự phòng | `schedule-editor.ts` hàm `plotMapMarkers`, `getHaversineDistanceKm`, `getTravelGapText`; các hàm chỉ đường qua Google Maps | Đã triển khai, độ chính xác tùy nguồn |
| Lưu lịch trình vào MongoDB | `backend/src/routes/itinerary.routes.js`; `backend/src/controllers/tour.controller.js` hàm `persistCustomItinerary`; `backend/src/models/index.js` các model `Schedule`, `ScheduleCustom`, `ScheduleActivity`, `UserSchedule` | Đã triển khai |
| Trợ lý AI trong trình biên tập | `schedule-editor.ts` hàm `sendAiMessage`; `my-app/src/app/services/api.service.ts` hàm `sendAiMessage`; `backend/src/routes/ai.routes.js`; `backend/src/services/ai-router.service.js` | Đã triển khai; là luồng chat cũ |
| Trợ lý AI trang lập kế hoạch | `my-app/src/app/components/greensteps-chat/greensteps-chat.component.ts`, `greensteps-chat.service.ts`; `backend/src/routes/support.routes.js`; `backend/src/services/greensteps-chat.service.js` | Đã triển khai ở mức mã nguồn, phụ thuộc workflow ngoài khi chạy |
| Kiểm tra phản hồi AI, điểm đến, số ngày, mã dịch vụ và giá trị catalog | `backend/src/services/greensteps-chat-structured.service.js` các hàm `canonicalItinerary`, `normalizeStructuredResponse`; `backend/src/controllers/tour.controller.js` hàm `createAiItinerary` | Đã triển khai |
| Lưu bản nháp AI sau khi đăng nhập và tính lại từ dịch vụ đang hoạt động | `greensteps-chat.component.ts` hàm `createItineraryFromPlan`; `api.service.ts` hàm `createAiItinerary`; `tour.controller.js` hàm `createAiItinerary` | Đã triển khai |
| Ngưỡng ngân sách cá nhân bắt buộc, giới hạn hoạt động/ngày theo khả thi, kiểm tra giờ mở cửa toàn lịch | Không tìm thấy một quy trình kiểm tra thống nhất trong các hàm tạo, sửa và lưu lịch trình vừa nêu | Thiết kế đề xuất |
| Công thức phát thải thực theo cự ly và phương tiện | Mã nguồn cộng trường `carbon` sẵn có và có một số giá trị mặc định theo loại địa điểm; chưa có phương pháp/hệ số được kiểm chứng trong mô-đun | Dự kiến phát triển |

## Minh chứng giao diện

Các ảnh trong `figures/` được chụp bằng Playwright từ ứng dụng Angular đang chạy tại localhost, với backend MongoDB local. Ảnh Hình 3.6.3 đến Hình 3.6.6 dùng bản nháp khách chưa đăng nhập, lưu trong localStorage của phiên trình duyệt tự động. Không tạo booking, không thanh toán và không điền thông tin cá nhân. Hình 3.6.7 chỉ chứng minh giao diện AI Planner hiển thị; không chứng minh workflow n8n đã trả bản lịch trình thực tế.

| Hình | Tệp | Nội dung xác minh |
|---|---|---|
| 3.6.3 | `figures/Hinh_3.6.3_danh_sach_lich_trinh.png` | Danh sách lịch trình ở trạng thái chưa có bản nháp trên trình duyệt. |
| 3.6.4 | `figures/Hinh_3.6.4_bieu_mau_tao_lich.png` | Biểu mẫu tạo chuyến đi thủ công. |
| 3.6.5 | `figures/Hinh_3.6.5_trinh_bien_tap.png` | Trình biên tập, gợi ý dịch vụ và bản đồ. |
| 3.6.6 | `figures/Hinh_3.6.6_hoat_dong_chi_phi.png` | Hoạt động đã thêm, số người, chi phí và carbon hiển thị. |
| 3.6.7 | `figures/Hinh_3.6.7_giao_dien_ai_planner.png` | Trang AI Planner ở trạng thái đầu vào. |

## Giới hạn xác minh

Trong phiên khảo sát đã truy cập được frontend và API health. Chưa gửi yêu cầu thực tới n8n và chưa xác minh phản hồi AI sinh lịch qua trình duyệt, nên báo cáo mô tả luồng AI theo source code và không đưa ảnh “kết quả AI”. Chưa tạo tài khoản hoặc sử dụng dữ liệu người dùng thật để chụp ảnh. Không có ảnh cảnh báo xung đột, vì không tạo thủ công hai hoạt động trùng giờ trong bộ minh chứng này; cơ chế được xác minh trong mã nguồn.
