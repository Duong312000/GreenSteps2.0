# Mở rộng AI Planner

## Hướng đi

Giữ intent routing và catalog retrieval nội bộ hiện có; mở rộng retrieval theo ID điểm đến/vùng và ràng buộc ngày/chi phí. AI là lớp lập kế hoạch có trích dẫn dữ liệu, không là nguồn sự thật cho inventory, giá, quy định, giờ mở cửa hoặc chất lượng bền vững.

## Quy tắc nguồn dữ liệu

- **Có thể khẳng định:** field từ tour/service/departure đã xác minh, còn hiệu lực, có `source`, `verifiedAt`, `validUntil` khi thích hợp.
- **Chỉ là gợi ý:** thứ tự ngày, tuyến tham khảo, thời lượng ước tính hoặc điểm đến chưa có nhà cung cấp. Gắn nhãn rõ và không gán giá/availability.
- **Không suy đoán:** giá, ngày chạy, ghế còn, dịch vụ hoạt động, giờ mở cửa, an toàn, giấy phép, review/đánh giá hoặc tác động carbon cụ thể nếu thiếu nguồn tin cậy.
- Google results có thể giúp tìm POI theo policy; không dùng nó như catalog đã cấp phép hoặc như xác nhận doanh nghiệp hợp tác.

## Luồng đề xuất

1. Chuẩn hóa yêu cầu: nơi đi, ngày, số khách, budget, sở thích, ràng buộc khả năng tiếp cận; báo thiếu trường quan trọng.
2. Resolve destination/alias sang ID ổn định; nếu mơ hồ thì hỏi lựa chọn ngắn hoặc đưa các kết quả phù hợp.
3. Lấy candidate từ API nội bộ có pagination/filter, giới hạn số kết quả và status; mỗi kết quả có ID, source, checkedAt, status, price range có nguồn.
4. Lập lịch trình dựa trên candidates và khoảng cách/route chỉ khi dữ liệu dịch vụ cho phép; nêu rõ thời gian ước lượng và nguồn.
5. Trả cấu trúc JSON schema đã validate: ngày, hoạt động, entity IDs, evidence refs, confidence/status, warnings và missing data.
6. UI render citations/status labels; người dùng xem lại, lưu draft hoặc mở chi tiết. Checkout chạy bằng booking API hiện tại, không bằng văn bản AI.

## Guardrails kỹ thuật

- Tool allowlist chỉ đọc catalog và Maps wrapper policy-approved; không cho AI tự dựng URL/query tùy ý hoặc ghi DB trực tiếp.
- Validate output theo schema; loại entity ID không có trong retrieval, giá không có evidence, date không hợp lệ và tổng giá vượt nguồn.
- Prompt injection từ review/mô tả là untrusted content; không chuyển quyền tool hay secret. Không gửi token/key tới model.
- Giới hạn lượt gọi, token, candidate count, timeout, retry và chi phí theo user; log prompt/output đã loại PII theo retention được duyệt.
- Thiếu dữ liệu thì nói không biết và đề xuất chỉnh yêu cầu. Không bịa nội dung để lấp đủ số ngày.
- Tách feedback người dùng khỏi verified facts; chỉ nội dung được editor/provider xác nhận mới vào catalog.

## Đánh giá chất lượng

Tạo bộ test fixture offline với yêu cầu phổ biến, alias tỉnh cũ/mới, vùng không có tour, budget bất khả thi, ngày thiếu inventory, prompt injection trong mô tả, lỗi Maps, dữ liệu stale và kết quả rỗng. Chấm entity grounding, độ chính xác số liệu, cảnh báo inventory, tính an toàn, schema validity và latency. Không gọi model/provider có tính phí trong audit hiện tại.

## Tiêu chí chấp nhận

- Mọi tour/service được đề xuất có ID thật và status rõ.
- Không xuất hiện CTA đặt hàng nếu không có departure/giá/availability verified.
- Giá và ngày chạy khớp nguồn ở thời điểm yêu cầu; nếu stale thì bị loại hoặc gắn cảnh báo.
- Kết quả ngoài catalog luôn được đánh dấu gợi ý, không trộn vào inventory.
- Có trace nội bộ evidence IDs để đội support tái hiện câu trả lời mà không lưu dữ liệu nhạy cảm thừa.
