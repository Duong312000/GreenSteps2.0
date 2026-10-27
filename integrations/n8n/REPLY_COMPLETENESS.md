# Câu trả lời dừng giữa chừng

Kiểm tra thật ngày 24/10/2026 bằng câu “Lập lịch trình Đà Lạt 3 ngày 2 đêm.”:
n8n trả HTTP 200 sau khoảng 12294.54 ms. Văn bản 1478 ký tự, có ngày 3 nhưng
kết thúc giữa cụm “kg CO2”. Lần này chưa chạm deadline backend 35 giây hoặc
giới hạn cắt 12000 ký tự trước đây. Aura dùng JSON hoàn chỉnh, không stream;
văn bản đã dừng giữa chừng ngay ở response từ n8n.

Chưa có finishReason thực tế từ Gemini để kết luận chắc chắn hết token. Giới hạn
model 2048 token là một nguyên nhân cần kiểm tra. Nếu node Gemini cho thấy
`finishReason: MAX_TOKENS`, đó là xác nhận model dừng do giới hạn token.
[Tài liệu Google FinishReason](https://ai.google.dev/api/generate-content#FinishReason).

## Bản sửa đã chuẩn bị

Workflow V3 JSON và script sinh workflow được cập nhật, V2 không đổi:

- Google Gemini Chat Model: maxOutputTokens **4096**, giữ temperature 0.2.
- AI Agent system prompt: 250–300 từ; hoàn tất các ngày trước, mỗi ngày 2–3 ý;
  kết thúc trọn câu rồi mới bổ sung giải thích nếu cần.
- Format Reply: bỏ `.slice(0,12000)` để không âm thầm cắt output.
- Nếu Agent thực sự chuyển `finishReason: MAX_TOKENS` hoặc
  `response_metadata.finishReason`, thêm thông báo đã chạm giới hạn. Agent có
  thể không chuyển metadata này, nên không tự suy luận từ dấu câu cuối.
- Giữ maxIterations=3, timeout backend 35 giây, frontend 50 giây, không tự retry
  hoặc tự nối tiếp bằng nhiều lần gọi Gemini.

## Áp dụng trên n8n đang chạy

Chỉnh workflow V3 hiện tại để giữ credentials đã chọn:

1. Node **Google Gemini Chat Model** → Options → Maximum Number of Tokens:
   đổi **2048 → 4096**.
2. Node **AI Agent** → System Message: thay dòng đầu bằng:

   ```text
   Bạn là GreenSteps AI, trợ lý du lịch xanh. Trả lời tiếng Việt, ngắn gọn (khoảng 250–300 từ).
   Hoàn tất câu trả lời trong một lượt. Với lịch trình nhiều ngày, viết đủ tất cả các ngày được yêu cầu trước, mỗi ngày 2–3 ý ngắn. Sau đó chỉ thêm lưu ý thật cần thiết. Không mở thêm mục dài khi đã đủ câu trả lời; kết thúc bằng một câu hoàn chỉnh, không dừng giữa câu hoặc giữa danh sách.
   ```

   Giữ các quy tắc nguồn dữ liệu, bảo mật và booking phía sau.
3. Node **Format Reply**: lấy jsCode từ file JSON V3 cập nhật; tối thiểu bỏ
   `.slice(0,12000)` sau `ai.output.trim()`.
4. **Publish** lại workflow. Hoặc import lại JSON V3, chọn credentials rồi bảo
   đảm chỉ một workflow publish sở hữu POST path `greensteps-web2-agent-v3-fast`.

File local không tự thay đổi workflow đã publish trên server. Chưa xác minh live
sau chỉnh giới hạn 4096 vì cần publish bản cập nhật trên n8n trước.

## Agent stopped due to max iterations

Đây là thông báo dừng nội bộ LangChain khi Agent dùng hết số vòng mà chưa có
final answer. V3 giữ maxIterations=3 theo cấu hình thử nghiệm tối ưu tốc độ.
Đây là giới hạn vòng model/tool, tách biệt với giới hạn output token.

Backend đã nhận diện chuỗi dừng này (và code CHAT_ITERATION_LIMIT), trả lỗi 502
tiếng Việt cho Aura thay vì lưu thông báo nội bộ thành câu trả lời thành công.
Không retry tự động. Workflow JSON mới trả success=false/code tương ứng và prompt
ưu tiên dùng catalog có sẵn; nếu cần tool, chỉ một lượt rồi kết luận, báo rõ dữ
liệu thiếu thay vì gọi lặp. Prompt là hướng dẫn, không phải bảo đảm cưỡng chế được
số lượt gọi tool. Giới hạn vòng và timeout vẫn là chặn cuối.

Để áp dụng trên n8n, cập nhật System Message và Format Reply từ JSON V3 mới rồi
Publish lại. Backend guard có hiệu lực local sau restart, không phụ thuộc Publish.
Chưa xác minh live prompt mới; không khẳng định đã hết mọi trường hợp chạm giới hạn.
