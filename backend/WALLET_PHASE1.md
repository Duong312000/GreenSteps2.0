# Ví GreenSteps — Giai đoạn 1 (mô phỏng)

**Cập nhật sandbox cho tất cả tài khoản:** đặt `NODE_ENV=development`, `WALLET_DEMO_ENABLED=true`, `WALLET_DEMO_ALL_USERS=true`, `WALLET_DEMO_SELF_SETTLE=true`. Mọi tài khoản đăng nhập được sử dụng số dư sandbox riêng, không cần danh sách ID. Sau khi tạo yêu cầu nạp, chủ giao dịch bấm **Giả lập đã chuyển khoản / nạp tiền** để chuyển từ PENDING sang SUCCESS; có thể giả lập thất bại hoặc rút tiền thành công tương tự. Không cộng tiền ở bước tạo yêu cầu.

API mới `POST /api/wallet/demo/transactions/:id/simulate`, body `{status: "SUCCESS" hoặc "FAILED"}`, yêu cầu đăng nhập, chỉ xử lý giao dịch demo của chính chủ và chỉ khi cờ SELF_SETTLE được bật. Cả hai cờ vẫn bị vô hiệu trên production. Các API admin vẫn giữ nguyên quyền admin. Tắt ALL_USERS để dùng lại chế độ danh sách tài khoản bên dưới; tắt SELF_SETTLE để chỉ admin xử lý. Không khởi tạo tiền hàng loạt cho tài khoản hiện có.

Triển khai trong backend Express/MongoDB và trang `/profile?section=wallet` hiện có. Tái sử dụng JWT/cookie, `Wallet`, `WalletTransaction`, MongoStore và `ApiService.walletRequest`. Không gọi ngân hàng, không tạo QR chuyển khoản tiền thật, không dùng localStorage để lưu tiền/giao dịch.

## Bật trên môi trường thử nghiệm

Mặc định **tắt**. Không thay đổi `.env` hiện có hoặc tạo dữ liệu vào tài khoản production khi triển khai source này.

1. Dùng database phát triển/thử nghiệm và MongoDB replica set. Có thể chạy `npm run db:local` trong `backend` để khởi động replica set riêng trên cổng 27018. Không dùng dữ liệu khách hàng thật.
2. Dùng luồng đăng ký/đăng nhập hiện có để chuẩn bị hai tài khoản thử nghiệm A/B. Ghi lại `user.id` trả về khi đăng nhập. Đăng nhập bằng một tài khoản admin trên môi trường thử nghiệm để duyệt demo.
3. Tham khảo `wallet-demo.env.example`: đặt `WALLET_DEMO_ENABLED=true`, `WALLET_DEMO_USER_IDS=<id-A>,<id-B>` và `NODE_ENV=development`. Giữ cấu hình JWT/MongoDB hiện có của môi trường thử nghiệm. Backend chỉ cho phép `NODE_ENV=development` hoặc `test`; production, môi trường khác hoặc thiếu NODE_ENV đều bị từ chối dù cờ bật.
4. Khởi động lại backend bằng `npm run dev`. Mở `/profile?section=wallet`. Chỉ các tài khoản trong danh sách được nạp/rút/chuyển và tìm nhau; người nhận ngoài danh sách bị từ chối. Không thêm tài khoản thật vào danh sách.

Không có seed tiền hay seed tài khoản demo tự động. Số dư ban đầu bằng 0. Tiền demo chỉ tăng sau khi admin xử lý một yêu cầu nạp. Admin không cần nằm trong allowlist để duyệt, nhưng cần nằm trong allowlist nếu muốn tự giao dịch demo.

## Luồng kiểm thử thủ công

**Nạp:** A bấm Nạp tiền → chọn mức hoặc nhập số tiền khác → chọn chuyển khoản/thẻ giả lập → kiểm tra → xác nhận. Kết quả `PENDING`, số dư không tăng. Admin vào cùng trang ví → **Quản lý giao dịch demo** → Hoàn tất demo. A bấm tải lại hoặc chờ chu kỳ đồng bộ tối đa 15 giây: trạng thái `SUCCESS`, số dư thử nghiệm tăng. Thử Từ chối demo (`FAILED`) hoặc A hủy yêu cầu (`CANCELLED`): không cộng tiền.

**Rút:** A bấm Rút tiền → Thêm tài khoản giả lập → nhập tên hiển thị (không nhập số tài khoản thật). Backend tạo mã `DEMO-…` và lưu MongoDB. Chọn tài khoản, số tiền → kiểm tra → xác nhận. Khoản rút được giữ, số dư khả dụng giảm, trạng thái `PENDING`. Admin hoàn tất: trừ tổng số dư và giải phóng khoản giữ. Admin từ chối hoặc A hủy: chỉ giải phóng khoản giữ, không trừ số dư. Thử số tiền vượt khả dụng và rút đồng thời ở hai cửa sổ.

**Chuyển:** A bấm Chuyển tiền → nhập chính xác số điện thoại hoặc ID của B → Tìm người nhận → kiểm tra tên/ID → nhập tiền và nội dung → xác nhận. Giao dịch thành công ngay, A giảm và B tăng trong cùng transaction. Thử tự chuyển, người nhận ngoài allowlist, thiếu tiền, chuyển đồng thời. Chuyển điểm xanh vẫn là nút độc lập trong thẻ Điểm xanh; QR điểm xanh vẫn giữ nguyên.

**Lịch sử:** bấm một giao dịch có nhãn Mô phỏng để xem trạng thái, mã, thời gian, đối tác, nội dung và bút toán. Nút Lịch sử tiền thử nghiệm mở danh sách phân trang. Tải lại trang/đăng nhập lại để kiểm tra dữ liệu vẫn còn. Số dư booking hiện có và Điểm xanh phải giữ nguyên sau các thao tác demo.

## API

Tất cả dưới `/api/wallet` (và prefix `/api/v1/wallet` hiện có), dùng Bearer JWT hoặc cookie hiện tại. Backend lấy người gửi từ phiên đăng nhập; không nhận số dư/userId của frontend.

| Method / đường dẫn | Payload / query | Quyền / kết quả |
| --- | --- | --- |
| GET `/overview` | — | Trả thêm `demo`: enabled, account_enabled, can_settle, balance, held, available_balance, banks. Dữ liệu ví/điểm/hạng cũ giữ nguyên. |
| POST `/demo/deposits` | `{amount, method: "demo_bank" hoặc "demo_card"}` | Tài khoản test; tạo `PENDING`, không cộng tiền. |
| POST `/demo/withdrawals` | `{amount, bankId}` | Tài khoản test; giữ tiền và tạo `PENDING`. |
| GET `/demo/recipient?q=…` | Số điện thoại hoặc ID chính xác | Tài khoản test; chỉ trả `{id,name}` người nhận test hợp lệ. |
| POST `/demo/transfers` | `{amount, recipientId, note?}` | Tài khoản test; hai ví/hai giao dịch/hai bút toán cùng commit. |
| POST `/demo/banks` | `{label}` | Tài khoản test; tạo tài khoản giả lập với ID/mã do backend sinh. |
| GET `/demo/transactions?page=0` | Trang bắt đầu từ 0, 20 bản ghi/trang | Chỉ lịch sử demo của chính mình. |
| GET `/demo/transactions/:id` | — | Chủ ví; chi tiết và ledger, không đọc được giao dịch của người khác. |
| POST `/demo/transactions/:id/cancel` | `{}` | Chủ ví, chỉ hủy yêu cầu nạp/rút đang chờ. Không thể dùng body để xác nhận thành công. |
| GET `/demo/admin/pending` | — | Admin; tối đa 100 yêu cầu demo chờ xử lý. |
| POST `/demo/admin/transactions/:id/settle` | `{status: "SUCCESS", "FAILED" hoặc "CANCELLED"}` | Chỉ admin (kiểm tra cả JWT và role trong MongoDB), chế độ demo phải đang bật. |

Các API nạp/rút/chuyển bắt buộc header `Idempotency-Key` dài 8–100 ký tự. Cùng key/cùng payload trả lại giao dịch cũ; cùng key/khác payload trả 409. UI giữ key khi thử lại sau mất kết nối. API settle/cancel idempotent theo ID/trạng thái: gửi lại cùng trạng thái không cộng/trừ lại; đổi trạng thái sau kết thúc trả 409. Mọi thay đổi tiền/giữ tiền và ledger nằm trong MongoDB transaction; xung đột đồng thời trả 409 và có thể thử lại cùng key.

Số tiền là số nguyên VND thử nghiệm trong khoảng 10.000–20.000.000. Backend kiểm tra `demo_balance >= demo_held >= 0` và giới hạn số nguyên an toàn.

## MongoDB

Giữ nguyên collections/ID hiện có, sử dụng prefix `MONGODB_COLLECTION_PREFIX` hiện tại (mặc định `app_`). `store.sync()` khi khởi động tạo indexes:

| Collection mặc định | Thay đổi |
| --- | --- |
| `app_wallets` | Thêm `demo_balance`, `demo_held`; khả dụng = balance − held. `balance`, `reserved_balance`, `green_points`, `tier_points` cũ không bị thao tác demo thay đổi. |
| `app_wallettransactions` | Mở rộng model hiện có: `mode: demo`, trạng thái uppercase `PENDING/SUCCESS/FAILED/CANCELLED`, sender/recipient ID + tên, method, bank snapshot, note, completed_at, operation_hash. Transfer có `transfer_out` âm / `transfer_in` dương, dùng chung reference_id. Legacy vẫn dùng trạng thái lowercase. |
| `app_wallet_ledger` | Mới: wallet_id, transaction_id, mode, phase (`hold/settle/transfer`), delta_balance, delta_held, balance_after, held_after, timestamps. ID xác định từ transaction/phase, unique. Cộng tổng delta theo ví phải khớp số dư demo. |
| `app_bank_accounts` | Mới: user_id, label, demo_reference, is_demo; không chứa tài khoản ngân hàng thật. |

Model ID có unique index; các trường `_id` tham chiếu được index theo MongoStore. Không đổi tên/di chuyển collections cũ. Tiền demo không đi vào thanh toán tour/escrow/booking, không phát sinh điểm hay xét hạng.

## Kiểm thử tự động

```powershell
# backend, dùng local replica set; test tự tạo và xóa database WalletDemoTest_<UUID>.
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27018/WalletTests?replicaSet=rs0'
node --test test/wallet-demo.integration.test.js

# Bộ regression có các test cùng đọc database, nên chạy tuần tự.
$env:MONGODB_URI='mongodb://127.0.0.1:27018/WalletRegression?replicaSet=rs0'
node --test --test-concurrency=1 test/*.test.js

# my-app
npm run build
npx vitest run src/app/pages/profile/green-wallet.spec.ts src/app/services/api.service.spec.ts src/app/pages/admin/admin.spec.ts
node e2e/wallet.e2e.cjs
```

Test MongoDB kiểm tra quyền/production guard, pending, success/failed/cancelled, giữ/giải phóng tiền, key trùng/khác payload, chủ sở hữu ngân hàng/giao dịch, chuyển tiền thiếu số dư/tự chuyển, yêu cầu đồng thời, ledger, dữ liệu booking/điểm không đổi và đọc bền vững qua MongoDB client riêng. Browser E2E dùng HTTP fixtures để kiểm tra popup/bố cục; không thay thế test MongoDB.

## Các file chính

- `src/models/index.js`: mở rộng 2 model và thêm ledger/bank demo.
- `src/services/wallet-demo.service.js`: quy tắc, giới hạn môi trường/quyền, transaction và ledger.
- `src/controllers/wallet-demo.controller.js`, `src/routes/wallet.routes.js`: API.
- `src/controllers/wallet-v2.controller.js`: dữ liệu demo trong overview hiện có.
- `../my-app/src/app/pages/profile/green-wallet.ts`, `.html`, `.css`: popup, xác nhận, đồng bộ, lịch sử/chi tiết, xử lý demo cho admin.
- `test/wallet-demo.integration.test.js`, `../my-app/src/app/pages/profile/green-wallet.spec.ts`, `../my-app/e2e/wallet.e2e.cjs`: kiểm thử.
- `wallet-demo.env.example`: cấu hình mẫu không chứa bí mật, không tự áp dụng.
