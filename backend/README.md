# GreenSteps — MongoDB

Backend hiện dùng MongoDB Native Driver. `backend/server.js` và
`server_mongodb/index.js` cùng khởi chạy API trong `backend/src`.
Frontend giữ nguyên URL `http://localhost:5055/api` và các mã ID cũ.
`/api/v1` cũng được hỗ trợ.

## Chạy local

Yêu cầu Node.js >= 20.19 và MongoDB Server. Trong PowerShell có thể dùng
`npm.cmd` nếu hệ thống chặn `npm.ps1`.

```powershell
cd D:\Web2\backend
npm.cmd ci
# Nếu chưa có .env: Copy-Item .env.example .env
npm.cmd run db:local
npm.cmd start
```

`db:local` khởi chạy replica set `rs0` riêng tại `127.0.0.1:27018`, không sửa
MongoDB service tại `27017`. Dữ liệu local lưu ở `D:\Web2\tmp\mongodb-rs`;
giữ thư mục này nếu muốn giữ dữ liệu sau khi khởi động lại. Sau khi khởi động
lại máy, chạy lại `db:local` trước khi chạy backend. Script tìm MongoDB tại
`C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe`; đặt `MONGOD_PATH` nếu
cài ở vị trí khác. Trên Linux/macOS, `mongod` phải có trong PATH.

Trong `backend/.env`:

```dotenv
PORT=5055
MONGODB_URI=mongodb://127.0.0.1:27018/GreenStepsDataMigrated?replicaSet=rs0
MONGODB_COLLECTION_PREFIX=app_
JWT_SECRET=replace-with-a-local-secret
```

`backend/.env` ưu tiên hơn `server_mongodb/.env`; cả hai đều bị Git bỏ qua.
SMTP và GEMINI_API_KEY vẫn dùng các biến cấu hình cũ. Gửi OTP thật cần cấu
hình SMTP. Nếu triển khai lên Render/server khác, cấu hình `MONGODB_URI` trỏ
tới MongoDB Atlas hoặc replica set có thể truy cập từ server đó.

Đăng nhập Google/Facebook dùng các biến `GOOGLE_CLIENT_ID`, `FACEBOOK_APP_ID`,
`FACEBOOK_APP_SECRET`, `FACEBOOK_GRAPH_VERSION` trong `.env`. Hướng dẫn cấu hình
nằm ở `GOOGLE_SIGN_IN.md` và `FACEBOOK_SIGN_IN.md` tại thư mục gốc.
Các endpoint cấu hình chỉ trả thông tin công khai; token được xác minh ở server.

Kiểm tra `GET /api/health`: `database` phải là `mongodb`, `transactions` phải
là `true`. MongoDB standalone vẫn đọc được dữ liệu nhưng API giao dịch trả
503; không giả lập commit/rollback. [MongoDB transactions](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/).

## Chuyển dữ liệu PostgreSQL

Chỉ công cụ migration dùng `pg` (dev dependency). API runtime không đọc
`DATABASE_URL` và không kết nối PostgreSQL.

1. Đặt `DATABASE_URL` trong `backend/.env`.
2. Với Supabase, tải CA certificate chính thức và đặt `PGSSL_CA_FILE` trỏ đến
   file `.crt`. TLS mặc định xác minh chứng chỉ. [Supabase SSL](https://supabase.com/docs/guides/platform/ssl-enforcement).
3. Tạm dừng ghi vào PostgreSQL trong lúc chuyển và đổi ứng dụng sang MongoDB.
4. Chạy kiểm kê rồi chuyển:

```powershell
npm.cmd run migrate:postgres
npm.cmd run migrate:postgres -- --apply
```

Migration dùng snapshot PostgreSQL `REPEATABLE READ READ ONLY`, đọc toàn bộ
bảng trong schema `public`, ghi theo lô 500 bản ghi và giữ ID, khóa liên kết,
password hash, JSON, số dư, timestamp và DATE. Các bảng phụ như `TourGalleries`
cũng được sao chép dù API chưa dùng trực tiếp. Collection có tên
`app_` + tên bảng viết thường, ví dụ `app_users`, `app_wallets`,
`app_servicebookings`. Các khóa chính ghép được ánh xạ thành `_id` ổn định.

Chạy lại chỉ thêm ID còn thiếu. Không ghi đè dữ liệu MongoDB đang có. Sau mỗi
lô, công cụ đối chiếu ID và nội dung mọi trường với snapshot; nếu dữ liệu hiện
có khác nguồn, công cụ báo lỗi và giữ dữ liệu hiện có. Nếu bị ngắt, có thể chạy
lại; chỉ chuyển frontend khi báo cáo hoàn tất và kiểm thử thành công.
Không xóa hoặc thay đổi dữ liệu PostgreSQL hay các collection demo/`postgres_*`.
Báo cáo kiểm kê nằm ở `tmp/migration-report.json`, không chứa thông tin đăng
nhập hoặc nội dung tài khoản.

Nếu chỉ có bản sao `postgres_*` local, có thể dùng:

```powershell
$env:SOURCE_MONGODB_URI='mongodb://127.0.0.1:27017/GreenStepsDataMigrated'
npm.cmd run migrate:postgres -- --source-mongo --apply
```

## Cấu trúc và kiểm thử

- `src/models/index.js`: định nghĩa trường, mặc định, ràng buộc và liên kết.
- `src/db/mongo-store.js`: truy vấn MongoDB, nạp liên kết theo lô, validation,
  unique indexes, chống ghi đè khi dữ liệu cũ, và ClientSession transactions.
- `src/controllers` / `src/routes`: giữ nghiệp vụ và response shape frontend.
- `scripts/sync_db.js`: tạo collection/index, không xóa dữ liệu.
- `scripts/seed_mongo.js`: dữ liệu mẫu cho database rỗng; từ chối database đã có dữ liệu.
- `migrations/`: lịch sử PostgreSQL, không được thực thi bởi API MongoDB.

```powershell
npm.cmd test
npm.cmd run verify:mongo
$env:TEST_MONGODB_URI='mongodb://127.0.0.1:27019/?replicaSet=rs0'
npm.cmd test
```

`TEST_MONGODB_URI` must point to a disposable local MongoDB replica set with a separate data directory. For example, run a test-only `mongod` on port 27019 with `D:\Web2\tmp\mongodb-test`, initialize it once using `mongosh "mongodb://127.0.0.1:27019" --eval "rs.initiate()"`, and then set the environment variable above. Do not point it at the application or production database.

Integration test tạo database tên ngẫu nhiên `GreenStepsMigrationTest_*` rồi
xóa đúng database đó khi kết thúc. Bao gồm đăng nhập, cả hai tiền tố API,
tour/dịch vụ, ví, lưu lịch trình, liên kết và trường ảo, review hooks,
commit/rollback và ngăn cập nhật số dư từ bản ghi cũ. Không gửi email thật.
`verify:mongo` gọi 21 API đọc trên dữ liệu đã chuyển qua listener tạm thời.

Các model/route Mongoose trong `server_mongodb/models` và
`server_mongodb/routes` là bản demo cũ, không được entrypoint mới nạp.
`server_mongodb/scripts/import_public_catalog_seed.js` chỉ phục vụ demo
ObjectId cũ, không dùng để nạp vào namespace `app_*`.
