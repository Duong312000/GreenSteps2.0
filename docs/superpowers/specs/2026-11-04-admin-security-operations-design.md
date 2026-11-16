# FR-ADM-14 — Bảo mật và vận hành

> Historical design only: on 2026-11-04, the Admin dashboard and its read-only monitoring endpoints were removed by request. Backend security protections, `/api/health`, operational event recording, and existing audit collections remain active. The `SystemEventLog` collection is retained and its data is not deleted.

## Intent

Hoàn thiện mục Admin → Bảo mật & Vận hành bằng cách gia cố cấu hình bảo mật backend, ghi nhận sự kiện vận hành có thể truy vết, cung cấp API quản trị có phân quyền và hiển thị dữ liệu thật trong dashboard. Public health check tiếp tục chỉ cung cấp thông tin tối thiểu.

## Goals

- JWT secret không có giá trị dự phòng cố định; môi trường chạy API phải cấu hình secret.
- CORS dùng allowlist origin chính xác, cho phép frontend local và các origin production được cấu hình.
- Cookie JWT giữ HttpOnly/Secure/SameSite phù hợp; request thay đổi dữ liệu xác thực bằng cookie có kiểm tra CSRF/origin.
- Login có rate limit theo IP, không khóa vĩnh viễn tài khoản hợp lệ.
- Admin security-operations APIs yêu cầu JWT hợp lệ và role admin.
- Tái sử dụng `AdminAuditLog` và `AdminConfigAuditLog`; thêm tối đa một collection vận hành có retention cho security events và lỗi.
- Metrics/cảnh báo chỉ dựa trên health checks, events và lỗi thực tế; ghi rõ chúng phản ánh một process instance.
- Angular tải dữ liệu theo tab, có loading/empty/error/retry và phân trang/lọc phía server.
- Logs và response không chứa credentials, secrets, token, cookie, stack nội bộ hoặc body nhạy cảm.

## Non-goals

- Thay JWT bằng Express Session.
- Giám sát nhiều instance, tracing phân tán, alert acknowledgment bền vững, sửa booking/payment/provider/tour nghiệp vụ.
- Hiển thị hoặc chỉnh sửa secret trong dashboard.

## Existing project constraints

- Runtime là Express + MongoDB Native Driver thông qua `mongo-store`; Mongoose trong `server_mongodb` là legacy.
- JWT được nhận qua Bearer header hoặc cookie `token`.
- Có `AdminAuditLog`, `AdminConfigAuditLog`, admin auth middleware, `/api/health`, và Angular admin design system.
- Production frontend có thể ở origin khác backend; CORS cần credentials và exact allowlist.
- Pasted user request is the full FR-ADM-14 source for this implementation. `server_mongodb/README.md` contains only an older summary and is not authoritative for runtime architecture.

## Approach

1. Keep JWT and cookie authentication; require explicit JWT secret, enforce an exact CORS allowlist, add cookie-auth CSRF origin validation, and apply bounded in-memory login throttling. This preserves current clients while addressing the observed deployment risks.
2. Reuse existing admin audit collections. Add one TTL-retained `SystemEventLog` collection for security events and sanitized backend errors. Compute alerts from observed health/errors rather than generating fixtures or persisting speculative state.
3. Add admin-only, paginated/filterable endpoints and a standalone Angular security-operations component that fetches only the active tab's data.

## Open implementation choices

- Use `CORS_ALLOWED_ORIGINS` as a comma-separated exact-origin allowlist; local defaults cover localhost/127.0.0.1:4200 only outside production, while production must list its frontend origin.
- Use an in-process login limiter with documented per-instance scope because no shared rate-limit store exists.
- Retain runtime system events for 90 days with a MongoDB TTL index; retain audit records under existing audit policy without TTL.
- Return generic 500 messages in every environment except development; never include stack in HTTP response.
