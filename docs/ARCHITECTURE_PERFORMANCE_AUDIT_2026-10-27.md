# Kiểm toán kiến trúc, hiệu năng và lựa chọn công nghệ

**Ngày:** 27/10/2026 · **Nhánh/commit tham chiếu:** `tanh` / `0a2241a` · **Phạm vi:** mã được Git theo dõi trong `backend/`, `frontend/`, cấu hình Docker, dependency và tài liệu triển khai. Working tree đang có nhiều thay đổi chưa commit; số đo phản ánh working tree tại thời điểm kiểm toán. `gitlab-fe/` là bản sao cục bộ bị Git bỏ qua, không được tính là một deployment độc lập.

## Kết luận điều hành

1. **Giữ monolith Django/DRF + React/Vite + PostgreSQL.** Với quy mô dữ liệu cục bộ hiện tại (5 doanh nghiệp, 207 dòng sổ cái), chưa có bằng chứng để tách microservice hay thêm Redis, RabbitMQ, Kafka, Elasticsearch, WebSocket hoặc load balancer.
2. **Sửa điểm nóng đã đo trước khi thêm hạ tầng:** danh sách 64 tài khoản chạy 65 SQL do `children.count` theo từng dòng; dashboard cache miss chạy 216 SQL. Cache dashboard hiện có đưa lần đọc sau xuống 17 SQL. Tối ưu truy vấn, phân trang, giới hạn cache phía trình duyệt và kiểm thử PostgreSQL sẽ có giá trị hơn cache phân tán lúc này.
3. **Có nhu cầu worker thật nhưng chưa cần Celery:** import từ 1.000 dòng và export trên 10.000 dòng được chuyển `QUEUED`; hai management command xử lý đã có, nhưng `compose.yaml` không chạy chúng. Trước mắt lên lịch worker hiện hữu có giám sát; chỉ chuyển sang Celery khi thông lượng, độ trễ hoặc độ tin cậy đo được vượt khả năng đó.
4. **Cấu hình Compose là môi trường phát triển, không phải cấu hình production:** Django `runserver`, Vite `dev`, `DEBUG=True`, `ALLOWED_HOSTS=*`, CORS mở và seed dữ liệu khi khởi động. Bản build chuẩn `npm run build` dừng ở 398 dòng lỗi TypeScript, trong khi gọi Vite trực tiếp vẫn tạo bundle. Chặn phát hành cho tới khi build chuẩn và cấu hình production đạt yêu cầu.
5. **Chưa thể khẳng định SLA, rò rỉ bộ nhớ, khả năng chịu tải hay lợi ích của hạ tầng mới.** Không có staging đang chạy, telemetry traffic production hoặc PostgreSQL `EXPLAIN ANALYZE`. Các lợi ích ngoài số đo cục bộ dưới đây đều là **dự đoán/giả thuyết**.

## 1. Kiến trúc và luồng dữ liệu hiện tại

```text
Browser React 19 / TypeScript / Vite
  ├─ REST + JWT → Django 6.1 / DRF → dịch vụ nghiệp vụ → ORM → PostgreSQL 16 (Compose)
  │                                                    └─ SQLite khi chạy cục bộ/test
  ├─ XLSX trong browser; biểu đồ Recharts; trang tải theo lazy route
  └─ cache Map trong bộ nhớ tab + khử trùng GET đang chạy

Django
  ├─ IAM/phân quyền theo doanh nghiệp; audit; kế toán, bán/mua, kho, thuế, báo cáo
  ├─ DashboardCacheEntry lưu cache trong DB; cache Django mặc định trong từng process cho rate limit
  ├─ import/export lớn → bản ghi QUEUED → management commands (chưa được Compose lên lịch)
  ├─ email SMTP/locmem và AI provider HTTP tùy cấu hình
  └─ PDF/Excel/DOCX tạo trong backend
```

- `backend/config/urls.py` gom 18 nhóm API nghiệp vụ dưới `/api/v1/`; `backend/config/settings.py` cấu hình JWT, PostgreSQL hoặc SQLite, SMTP và provider AI tùy chọn. Dữ liệu phân tách bằng `company_id`/permission trong nhiều view và service.
- `frontend/src/ReferenceWorkspace.tsx` dùng React Router và `lazy()` cho nhiều workspace. `frontend/src/live-api.ts` khử trùng GET đồng thời theo URL và token, làm mới JWT một lần cho các request đang chờ. `frontend/src/misa-api-lists.ts` lấy tối đa 50 trang × 100 dòng mỗi resource và giữ bản sao trong `Map` theo doanh nghiệp/người dùng/path.
- Compose chỉ khai báo PostgreSQL, backend và frontend; `docker compose ps` trả về không container. Không thấy pipeline/manifest production trong phần repository được Git theo dõi. Không đọc/không xuất giá trị bí mật trong `.env`.
- Thư viện có vai trò rõ: DRF/JWT/OpenAPI, `psycopg`, `openpyxl` và `xlrd` cho Excel, `reportlab` cho PDF, `python-docx` cho DOCX, Pillow cho ảnh, React Router, Recharts, SheetJS `xlsx`, Lucide và font. `matplotlib` được dùng trong `scripts/build_erp_word_report.py` để tạo biểu đồ cho tài liệu Word ngoại tuyến; không tìm thấy import trong backend API. Có thể tách dependency công cụ tài liệu khỏi image backend sau khi kiểm tra CI và luồng chạy script.

## 2. Baseline đo thực tế

Đo bằng DRF `APIClient` đã xác thực, trên **bản sao** `backend/db.sqlite3`, `DEBUG=True`, cùng máy, mỗi endpoint gọi 2 lần tuần tự. `CaptureQueriesContext` đếm SQL; `perf_counter` đo wall time. Không có network, reverse proxy, browser rendering hoặc tải đồng thời. Baseline máy đọc file SQLite 18.620.416 byte, doanh nghiệp mẫu `ABC`: 18 mặt hàng, 3 nhóm hàng, 6 kho, 32 đối tượng, 33 bút toán đã ghi sổ và 105 dòng sổ cái. Toàn DB có 207 dòng sổ cái. Kết quả máy đọc được lưu riêng ở [perf_baseline_2026-10-27.json](perf_baseline_2026-10-27.json).

| API GET | Lần 1 | Lần 2 | SQL lần 1 → 2 | Payload | Nhận xét |
| --- | ---: | ---: | ---: | ---: | --- |
| Items | 1.249,7 ms | 7,1 ms | 1 → 1 | 21,0 KB | Lần đầu gồm chi phí import/khởi tạo Python; không dùng như latency API ổn định. |
| Item categories | 3,0 ms | 2,5 ms | 1 → 1 | 2,0 KB | Không thấy N+1 trên mẫu. |
| Warehouses | 8,2 ms | 5,6 ms | 4 → 4 | 4,0 KB | Truy vấn phụ cần phân tích nếu số kho tăng. |
| Accounts | 35,2 ms | 35,0 ms | 65 → 65 | 56,0 KB | **N+1 xác nhận:** 64 truy vấn `COUNT(children)` cho 64 tài khoản. |
| TT133 B01a | 16,0 ms | 6,1 ms | 5 → 5 | 5,5 KB | Trên 105 dòng sổ; chưa đại diện kỳ kế toán lớn. |
| Dashboard overview | 187,4 ms | 7,6 ms | 216 → 17 | 28,3 KB | Cache DB hiện hữu hiệu quả ở lần gọi sau; 216 SQL cache miss cần ưu tiên phân rã. |

**Thử phương án không sửa code:** một truy vấn ORM `annotate(Count('children'))` trả 64 dòng, đúng 64/64 giá trị `children.count`, mất 0,46–2,55 ms cho riêng truy vấn ứng viên. Đây **không** phải benchmark API sau sửa; dự đoán số SQL của API có thể giảm từ 65 xuống khoảng 1–2 nếu serializer đọc annotation. Kiểm thử nghiệp vụ và PostgreSQL phải xác nhận trước khi triển khai.

**EXPLAIN SQLite:** truy vấn `JournalLine` lọc doanh nghiệp/trạng thái/năm dùng index FK `JournalEntry.company_id`, `JournalLine.entry_id` và khóa chính `Account`; thứ tự mặc định `line_no` tạo `USE TEMP B-TREE FOR ORDER BY`. Phiên bản ORM bỏ thứ tự bằng `.order_by()` không còn bước sort. Đây chỉ là kế hoạch SQLite; chưa chứng minh tốc độ PostgreSQL hoặc nhu cầu index ghép. [Django khuyến nghị đo và dùng `QuerySet.explain()` trước khi thêm index](https://docs.djangoproject.com/en/6.0/topics/db/optimization/); [PostgreSQL giải thích cách đọc `EXPLAIN ANALYZE`](https://www.postgresql.org/docs/current/using-explain.html).

**Giới hạn đo:** SQL time của SQLite bị làm tròn về 0–15 ms; wall time đáng tin hơn trong thử nghiệm nhỏ này. Không đo RSS, heap, kết nối DB tối đa, p95/p99, throughput hoặc lỗi đồng thời. Không chạy load/stress test trên production. Không có staging để đo trước/sau trên PostgreSQL cùng điều kiện.
Đồng hồ CPU của tiến trình trên Windows cho khoảng 31 ms ở API tài khoản và 188 ms ở dashboard cache miss, gần wall time, nhưng độ phân giải theo bước ~16 ms và chi phí Python test client khiến phép đo này chỉ gợi ý có phần CPU đáng kể; chưa đủ để chọn thêm worker hoặc cache. Chưa phát hiện rò rỉ RAM bằng phép đo, vì chưa có phép đo heap/RSS theo phiên dài.

## 3. Điểm nóng, đúng đắn và vận hành

| Mức | Phát hiện và bằng chứng | Hành động ưu tiên kiểm chứng |
| --- | --- | --- |
| P0 | `npm run build` trả exit 2 và 398 dòng `error TS`; `npx vite build` vẫn thành công. | Phân nhóm lỗi TypeScript, sửa build chuẩn, bắt CI chạy `tsc -b` và smoke test bundle. |
| P0 khi triển khai production | `compose.yaml` chạy `runserver`, Vite dev, `DEBUG=True`, wildcard host/CORS, default DB password và seed dữ liệu. | Tạo cấu hình production riêng, WSGI server + reverse proxy/static/TLS, tắt seed/debug, kiểm tra secret/host; chạy smoke trên staging. |
| P1 | `AccountSerializer.children_count = children.count`; 64/64 truy vấn đếm phụ. | `annotate`/batch count, phân trang; so sánh response, permission và SQL trên PostgreSQL. |
| P1 | Dashboard cache miss 216 SQL, 187,4 ms; cache hit 17 SQL, 7,6 ms. Cache đang lưu DB, không cần Redis để đạt hit nhanh trên mẫu. | Phân rã top query/widget, `select_related`/`prefetch_related`, gom aggregation, theo dõi cache hit và invalidation. |
| P1 | Import ≥1.000 và export >10.000 vào `QUEUED`, có lệnh `process_catalog_imports`/`process_catalog_exports`, nhưng Compose không chạy worker. DB mẫu có 2 import + 3 export completed, không có queued tại lúc kiểm tra. | Lên lịch management command có giám sát, khóa/idempotency/retry và kiểm thử đồng thời; đo backlog trước khi chọn queue broker. |
| P2 | Query sổ cái có sort tạm trong SQLite; `JournalEntry` có index FK company, chưa thấy index ghép company/status/posting_date cho bản ghi sổ. | Bỏ sort không cần thiết trong các truy vấn tổng hợp; lấy `EXPLAIN (ANALYZE, BUFFERS)` từ staging PostgreSQL trước khi tạo index ghép. |
| P2 | `apiListCache` không có TTL/giới hạn dung lượng; mỗi resource có thể giữ tối đa 5.000 dòng và tái xác nhận khi mở tab. `cashDataCache`/`bankDataCache` cũng giữ theo company. | Đo heap/browser network trên phiên dài, giới hạn entry/TTL, phân trang hoặc chỉ nạp dữ liệu đang thấy. Hiện chỉ là rủi ro tăng RAM, **chưa xác nhận memory leak**. |
| P2 | Rate limit dùng `django.core.cache` nhưng không cấu hình `CACHES`; mặc định là cache riêng từng process. | Với 1 process có thể chấp nhận; trước khi nhiều replica, thử rate limit lưu DB/Redis theo shared store. [Django xác nhận LocMemCache là per-process](https://docs.djangoproject.com/en/6.0/topics/cache/). |
| P2 | AI provider gọi HTTP đồng bộ với timeout mặc định 20 s; email `send_mail` cũng đồng bộ ở một số flow. | Đo thời gian/volume; giới hạn timeout, retry có kiểm soát và chuyển tác vụ không cần phản hồi tức thì sang worker hiện hữu khi có số đo. |

## 4. Quyết định công nghệ

**Cách đọc:** A là phương án không thêm công nghệ mới; B là phương án bổ sung/thay thế khi có ngưỡng kiểm chứng. “Lợi ích” là **dự đoán** trừ khi ghi “đã đo”. P0/P1/P2 là ưu tiên xử lý, không phải lệnh cài đặt.

| Công nghệ | Hiện trạng / vấn đề / bằng chứng | Kết luận, ưu tiên | Hai phương án và lợi ích dự kiến | Chi phí, bảo trì, bảo mật, rủi ro |
| --- | --- | --- | --- | --- |
| Django + DRF | Monolith đang phục vụ các module kế toán, IAM, audit, REST; chưa có số liệu bão hòa CPU. | **NÊN TRIỂN KHAI** tiếp, P1 | A: giữ modular monolith, tối ưu API/SQL (ít đổi, dự đoán lợi ích cao). B: tách service sau khi có bottleneck độc lập và hợp đồng dữ liệu rõ. | B tăng deploy, auth xuyên service, transaction và observability; hiện chưa có căn cứ. |
| React + Vite | Lazy route đã có; chunk report 1.521.483 B, chunk `xlsx` 492.276 B; build chuẩn 398 lỗi TS. | **NÊN TRIỂN KHAI** tiếp, P0 build/P2 bundle | A: sửa TS, chia nhỏ report center, tải theo route và đo Web Vitals. B: thay frontend framework nếu có yêu cầu SSR/SEO mới. | B rewrite lớn và tăng rủi ro regression; lợi ích hiện chưa đo. |
| PostgreSQL 16 | Compose đã khai báo; local đo SQLite, PostgreSQL không chạy trong Compose tại lúc kiểm tra. | **NÊN TRIỂN KHAI** cho staging/production, P0 | A: giữ PG, index hiện có, đo `pg_stat_statements`/EXPLAIN. B: DB phân tán khi một PG không đáp ứng SLO đã đo. | B tăng đồng bộ, backup và tính đúng đắn sổ cái; không phù hợp hiện tại. |
| SQLite | Đang dùng local/test; file mẫu ~18,6 MB, 207 dòng GL. | **NÊN LOẠI BỎ** khỏi production, giữ test/dev, P0 | A: dùng PG hiện khai báo cho staging/prod. B: SQLite chỉ cho test/offline một người dùng. | SQLite ghi đồng thời hạn chế; chuyển cần migration/backup và đối chiếu nghiệp vụ. |
| Database indexing | Index FK hiện được dùng; sort tạm có thể bỏ; chưa đo PG slow query. | **CẦN KIỂM CHỨNG THÊM**, P1 | A: bỏ sort, gom query, kiểm tra index hiện có. B: thêm index ghép/partial theo `EXPLAIN ANALYZE` khi scan lớn. | Index B tốn lưu trữ và làm chậm ghi; không dự đoán % tăng tốc khi mẫu chỉ 207 GL rows. |
| Cache dashboard trong DB | Đã dùng `DashboardCacheEntry`; cache hit đo 216→17 SQL, 187,4→7,6 ms. | **NÊN TRIỂN KHAI** tiếp, P1 | A: giữ DB cache, sửa miss path/invalidation; **đã đo** cache hit nhanh trên mẫu. B: shared memory cache khi hit DB vẫn là bottleneck ở staging. | B cần TTL, consistency, permission-aware key, giám sát; không đồng nghĩa tự động nhanh hơn. |
| Redis | Không có service/package; Django rate limit mặc định cache theo process. | **CHƯA CẦN**, P2 | A: 1 process hoặc dùng DB-backed limiter, cache DB hiện có. B: Redis cho shared rate limit/cache nếu nhiều replica hoặc p95 cache DB vượt SLO. | B thêm node, memory, backup/ACL/TLS, invalidation; lợi ích chưa đo. |
| Background worker hiện hữu | Hai management command xử lý batch đã có nhưng chưa được Compose lên lịch. | **NÊN TRIỂN KHAI**, P1 | A: cron/systemd/Compose worker lặp với lease, idempotency, metric backlog. B: queue chuyên dụng khi A không đáp ứng SLA. | A có rủi ro job kẹt nếu không giám sát; B tăng vận hành và luồng lỗi. |
| Celery | Không cài; batch queue dùng DB. | **CHƯA CẦN** ngay, P2 | A: chạy worker hiện hữu và đo throughput/retry. B: Celery với broker khi hàng đợi lớn, nhiều loại job và SLA đòi hỏi. | B cần broker, result backend/monitoring; phải thiết kế retry/idempotency. [Celery yêu cầu broker và hỗ trợ Redis/RabbitMQ](https://docs.celeryq.dev/en/main/getting-started/first-steps-with-celery.html). |
| BullMQ | Không dùng; backend Python. | **NÊN LOẠI BỎ** khỏi danh sách chọn, P3 | A: worker Python/DB hiện hữu. B: BullMQ chỉ khi thực sự chuyển job sang Node. | B tạo runtime thứ hai và hợp đồng dữ liệu mới; không có lợi ích đã đo. |
| RabbitMQ | Không dùng, không có backlog đang chờ trong DB mẫu. | **CHƯA CẦN**, P3 | A: DB queue hiện hữu hoặc Celery+Redis nếu cần. B: RabbitMQ khi cần routing/durability phức tạp đã chứng minh. | B tăng cluster/ops, quyền truy cập và giám sát; không xử lý N+1. |
| Kafka | Không dùng; không có event stream/consumer độc lập. | **CHƯA CẦN**, P3 | A: transaction DB + outbox nếu cần tích hợp. B: Kafka khi nhiều consumer và lưu lượng sự kiện cao được đo. | B rất tốn vận hành, schema/replay/ordering; rủi ro double posting kế toán nếu thiết kế sai. |
| Elasticsearch / OpenSearch | Không dùng; search REST hiện nằm trong Django/DB. Chưa có latency search/khối lượng tài liệu chứng minh thiếu khả năng. | **CHƯA CẦN**, P3 | A: index/lookup hoặc full-text PostgreSQL rồi đo. B: search engine khi ranking/facets/đa ngôn ngữ ở quy mô lớn vượt PG. | B phải đồng bộ index, xử lý dữ liệu nhạy cảm và mất nhất quán; [PostgreSQL có full-text search/index](https://www.postgresql.org/docs/current/textsearch.html). |
| WebSocket | Không có consumer hoặc yêu cầu hai chiều thời gian thực. | **CHƯA CẦN**, P3 | A: request/response hiện có, polling có giới hạn cho job/notification. B: WebSocket khi cần cộng tác hai chiều/latency thấp đã đo. | B giữ kết nối lâu, auth/reconnect/backpressure; tăng RAM/ops. |
| SSE | Không dùng; trạng thái batch/notification có thể polling. | **CHƯA CẦN**, P3 | A: polling theo backoff/visibility. B: SSE khi cập nhật một chiều thường xuyên và polling gây tải đáng kể. | B giữ HTTP stream/proxy, auth/reconnect; SSE chỉ là một chiều theo [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events). |
| CDN | Chưa có cấu hình production/static; bundle report lớn nhưng chưa có Web Vitals. | **CẦN KIỂM CHỨNG THÊM**, P2 | A: static hashed assets + gzip/Brotli/cache headers từ reverse proxy. B: CDN khi người dùng địa lý phân tán và TTFB/egress đo được. | B tăng chi phí/invalidations; phải tránh cache dữ liệu kế toán/phiên. |
| Load balancer | Compose chỉ 1 backend/1 frontend; không có số liệu concurrency. | **CHƯA CẦN**, P3 | A: một app server production có health check/backup. B: LB + nhiều replica khi CPU/p95/availability vượt ngưỡng. | B cần shared limiter/session/cache, DB connections, rolling deploy; tăng bề mặt lỗi. |
| Connection pooling | PG settings mặc định `CONN_MAX_AGE=60`; Compose ép `0`; chưa đo số kết nối. | **CẦN KIỂM CHỨNG THÊM**, P2 | A: giới hạn số WSGI worker và đo `pg_stat_activity`; cân nhắc persistent connection hợp lý. B: PgBouncer/pool backend khi connection churn hoặc max_connections thành bottleneck. | B thêm proxy, sizing và transaction semantics; Django mô tả `CONN_MAX_AGE`/pooling trong [tài liệu DB](https://docs.djangoproject.com/en/6.0/ref/settings/#conn-max-age). |
| WSGI server + reverse proxy | Compose đang dùng Django `runserver` và Vite dev, không có cấu hình production. | **NÊN TRIỂN KHAI** trước production, P0 | A: tối thiểu WSGI app server + reverse proxy/static/TLS trong cùng deployment. B: managed application platform cung cấp các chức năng đó. | A/B cần cấu hình worker, timeouts, secret, health check; không lấy `runserver` làm kết quả benchmark production. |
| `matplotlib` | Có trong requirements và được `scripts/build_erp_word_report.py` dùng ngoại tuyến, không thấy dùng trong backend API. | **CẦN KIỂM CHỨNG THÊM**, P3 | A: giữ nguyên trong một requirements duy nhất. B: tách requirements công cụ tài liệu khỏi runtime API, vẫn giữ thư viện cho script. | B giảm image runtime (dự đoán, chưa đo) nhưng thêm bước cài dependency cho script/CI; tuyệt đối không xóa thư viện khỏi luồng tạo tài liệu. |

### Bảng quyết định theo các trường yêu cầu

Các phương án A/B cụ thể và điều kiện áp dụng nằm ở bảng chi tiết ngay trên. “Lợi ích” chưa có nhãn **đã đo** là dự đoán.

| Công nghệ | Hiện trạng sử dụng | Vấn đề phát hiện | Bằng chứng và số liệu | Có cần sử dụng không? | Phương án thay thế | Mức độ ưu tiên | Lợi ích dự kiến | Chi phí và rủi ro |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Django/DRF | API chính | Dashboard miss nhiều SQL | 216 SQL/187,4 ms cục bộ | NÊN TRIỂN KHAI tiếp | Tối ưu monolith; tách service sau | P1 | Giảm SQL/latency | Tách sớm tăng transaction/ops |
| React/Vite | UI chính | Build lỗi, chunk lớn | 398 TS errors; report chunk 1,52 MB | NÊN TRIỂN KHAI tiếp | Sửa/chia chunk; đổi framework chỉ khi có nhu cầu | P0 | Build tin cậy, tải nhanh hơn | Regression UI, công sửa |
| PostgreSQL | Có trong Compose | Chưa đo trên PG | Compose không chạy tại lúc kiểm tra | NÊN TRIỂN KHAI cho staging/prod | PG đơn; DB phân tán sau | P0 | Đồng thời/transaction tốt hơn SQLite | Vận hành, backup |
| SQLite | Local/test | Không phù hợp đích nhiều người dùng | DB mẫu 18,6 MB/207 GL lines | NÊN LOẠI BỎ khỏi prod | Dùng PG; giữ SQLite test | P0 | Tính đồng thời và parity staging | Migration/đối chiếu |
| Database indexing | FK index hiện có | Sort tạm, chưa có PG plan | EXPLAIN SQLite mất sort khi bỏ ordering | CẦN KIỂM CHỨNG THÊM | Sửa query; index theo PG plan | P1 | Ít sort/scan hơn | Index làm chậm ghi |
| Cache dashboard DB | Đã dùng | Miss còn nặng | 216→17 SQL, 187,4→7,6 ms | NÊN TRIỂN KHAI tiếp | Tối ưu miss; shared cache sau | P1 | Hit nhanh **đã đo** | Invalidation, dữ liệu cũ |
| Redis | Chưa dùng | Limiter cache riêng process khi scale | Không có `CACHES`; không có replica đo được | CHƯA CẦN | DB/shared limiter; Redis sau | P2 | Shared cache/limiter | Node, ACL, TTL, ops |
| Worker hiện hữu | Command có, chưa lên lịch Compose | Job lớn có thể nằm QUEUED | Ngưỡng 1.000/10.000; mẫu 0 queued | NÊN TRIỂN KHAI | Lịch worker; broker sau | P1 | Job hoàn thành đáng tin hơn | Retry, giám sát, idempotency |
| Celery | Chưa dùng | Chưa có backlog chứng minh | 2 command batch đã có | CHƯA CẦN | Worker DB; Celery sau | P2 | Retry/routing khi cần | Broker, monitoring |
| BullMQ | Chưa dùng | Lệch runtime Python | Backend Django | NÊN LOẠI BỎ khỏi lựa chọn | Worker Python/Celery | P3 | Tránh runtime thứ hai | Nếu dùng: tăng ops |
| RabbitMQ | Chưa dùng | Chưa cần routing phức tạp | 0 queued trong mẫu | CHƯA CẦN | DB queue; RabbitMQ sau | P3 | Routing/durability tiềm năng | Cluster, bảo mật, ops |
| Kafka | Chưa dùng | Không có event stream | Không thấy producer/consumer | CHƯA CẦN | DB transaction/outbox; Kafka sau | P3 | Fan-out lớn khi có nhu cầu | Ordering/replay/consistency |
| Elasticsearch/OpenSearch | Chưa dùng | Chưa có search SLA/volume | Search hiện qua Django/DB | CHƯA CẦN | PG search/index; engine sau | P3 | Ranking/facet ở quy mô lớn | Đồng bộ index, dữ liệu nhạy cảm |
| WebSocket | Chưa dùng | Chưa có nhu cầu realtime hai chiều | Không thấy consumer | CHƯA CẦN | Polling; WebSocket sau | P3 | Latency push thấp nếu cần | Kết nối/RAM/auth |
| SSE | Chưa dùng | Chưa cần push một chiều | Job/notification có REST | CHƯA CẦN | Polling; SSE sau | P3 | Ít request nếu tần suất cao | Proxy stream/reconnect |
| CDN | Chưa cấu hình | Chưa có Web Vitals/geo | Bundle report 1,52 MB | CẦN KIỂM CHỨNG THÊM | Cache static proxy; CDN sau | P2 | TTFB/egress nếu phân tán | Chi phí, cache nhầm dữ liệu |
| Load balancer | Một instance trong Compose | Chưa có concurrency/SLO | Compose không chạy | CHƯA CẦN | Một app server; LB khi scale | P3 | Availability/scale khi cần | Shared state, DB pressure |
| Connection pooling | `CONN_MAX_AGE` 60, Compose 0 | Chưa đo connections | Không có PG staging metrics | CẦN KIỂM CHỨNG THÊM | Bounded workers; pool sau | P2 | Giảm connect churn | Pool sizing/semantics |
| WSGI + reverse proxy | Compose chạy dev server | Thiếu đường production | `runserver`, Vite dev, DEBUG True | NÊN TRIỂN KHAI trước prod | Self-host hoặc managed runtime | P0 | Deploy ổn định/an toàn | Cấu hình, vận hành |
| `matplotlib` | Script Word ngoại tuyến | Chung requirements với API | 1 script import, API không import | CẦN KIỂM CHỨNG THÊM | Giữ chung; tách dependency | P3 | Image API gọn hơn nếu tách | Script/CI cần cài riêng |

## 5. Kiến trúc mục tiêu và lộ trình mở rộng

**Quy mô hiện tại:** một modular monolith Django/DRF, một PostgreSQL, một frontend React static, một reverse proxy và một tiến trình worker management command theo lịch. Giữ cache dashboard trong PostgreSQL và cache frontend có giới hạn. Cùng một nguồn dữ liệu kế toán, transaction và audit; không thêm distributed queue/cache/search cho tới khi có SLO và số liệu xác nhận. Đây là kiến trúc đề xuất, **chưa được triển khai trong đợt kiểm toán**.

1. **P0 – cổng phát hành:** sửa TypeScript build; dựng staging PostgreSQL từ cấu hình production an toàn; thay `runserver`/Vite dev; backup/restore rehearsal; test nghiệp vụ báo cáo, phân quyền và đối chiếu sổ. Không dùng dữ liệu production để stress test.
2. **P1 – tối ưu đã có bằng chứng:** xử lý N+1 tài khoản, đo dashboard từng widget và giảm truy vấn trùng; thử bỏ ordering trong tổng hợp GL; vận hành worker import/export với metrics backlog/retry và kiểm thử hai worker tranh cùng job. Mọi thay đổi phải so sánh response, query count, p50/p95 và lỗi trên cùng staging/data snapshot.
3. **P2 – quan sát rồi quyết định:** log request duration, SQL count/slow query, cache hit, export/import queue age, CPU/RSS/DB connections, Web Vitals. Xem lại cache browser, bundle report 1,52 MB, phân trang danh mục. Chỉ thêm index khi PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` chứng minh được lợi ích và kiểm tra write cost.
4. **Khi tăng người dùng:** tăng WSGI worker có giới hạn theo CPU/RAM, đo DB connections và p95. Nếu nhiều replica làm rate limit per-process sai, dùng shared store (DB/Redis). Nếu backlog kéo dài qua SLO hoặc job cần retry/routing phức tạp, thử Celery trên staging. Nếu search vượt khả năng PostgreSQL, mới so sánh OpenSearch. Nếu latency realtime thực sự là yêu cầu, so sánh polling với SSE/WebSocket.

### Kịch bản so sánh trên staging (chưa thực hiện vì chưa có staging)

- Snapshot dữ liệu PostgreSQL đã khử thông tin nhạy cảm, kích thước tối thiểu 10× và 100× mẫu hiện tại; cùng CPU/RAM, cấu hình worker, DB statistics và client location cho trước/sau.
- GET danh mục tài khoản, dashboard miss/hit, tìm kiếm, báo cáo năm; import/export 1.000/10.000 dòng trên staging. 1, 10 và 30 người dùng đồng thời với thời gian tăng tải ngắn, **không** bắn production. Ghi p50/p95/p99, error rate, throughput, RSS, CPU, DB connections, số SQL, lock wait và queue age.
- Gate đề xuất để quyết định (không phải số đo hiện tại): API thường p95 < 300 ms, dashboard cache miss p95 < 1 s, error < 0,1%; không tăng memory theo phiên dài; job hoàn thành trong SLO sản phẩm. Đối chiếu đúng số dư, audit, phân quyền và idempotency sau mọi tối ưu.
- Điều kiện thêm công nghệ: lợi ích đo lại cùng tải phải vượt chi phí vận hành và không làm sai tính nhất quán kế toán. Ghi rõ baseline/variant, confidence, rollback và chi phí hàng tháng trước khi phê duyệt.

## 6. Giới hạn kiểm toán

Đã lập bản đồ code/config/dependencies và rà soát các luồng trọng điểm, **không thể xác nhận đã đọc từng dòng của toàn bộ repository** trong một lượt. Không có staging, traffic production, hệ thống metrics, PostgreSQL đang chạy trong Compose hoặc thông số chi phí cloud; do đó chưa xác nhận được khả năng chịu tải, p95 production, memory leak hay tiết kiệm tài nguyên của Redis/Celery/CDN/LB. Kết luận phụ thuộc dữ liệu cục bộ rất nhỏ; cần lặp lại trên PostgreSQL staging trước khi thay đổi kiến trúc.

### Phụ lục: danh mục dependency và dịch vụ

| Nhóm | Thành phần khai báo | Vai trò/nhận xét |
| --- | --- | --- |
| Backend lõi | Django, djangorestframework, django-cors-headers, djangorestframework-simplejwt, drf-spectacular, python-dotenv | Web/API, CORS dev, JWT, OpenAPI, cấu hình môi trường. Giữ; đánh giá CORS theo origin production. |
| DB/định dạng | psycopg[binary], openpyxl, xlrd, pillow, reportlab, python-docx, matplotlib | PG và nhập/xuất Excel, ảnh, PDF, DOCX; matplotlib cho script tài liệu ngoại tuyến. Tách dependency runtime/offline là giả thuyết cần đo image và CI. |
| Python hỗ trợ được pin | asgiref, attrs, inflection, jsonschema, jsonschema-specifications, PyJWT, PyYAML, referencing, rpds-py, sqlparse, typing_extensions, tzdata, uritemplate | Phần lớn hỗ trợ Django/DRF/OpenAPI và các thư viện định dạng. Không gỡ riêng từng gói nếu chưa kiểm tra dependency tree; cập nhật/bảo mật theo lock/rebuild có kiểm thử. |
| Frontend runtime | React, React DOM, React Router, Recharts, SheetJS `xlsx`, Lucide React, Be Vietnam Pro | UI/route/biểu đồ/Excel/icon/font; xlsx được import động. Cần giảm chunk report, không có bằng chứng đổi framework. |
| Frontend dev | TypeScript, Vite, plugin React, Playwright, axe-core Playwright, oxlint, prettier, type definitions | Build/typecheck/E2E/accessibility/lint/format. Lỗi TS hiện chặn build chính thức. |
| Dịch vụ Compose | `postgres:16-alpine`, backend Python 3.12-slim, frontend Node 20-alpine | Chỉ là stack dev hiện khai báo; không có worker, Redis, broker, search, proxy hoặc CDN. |
| Tích hợp tùy chọn | SMTP/locmem email; AI provider URL/API key | Email và AI request đồng bộ ở một số flow; chỉ bật provider khi có cấu hình. Không có bằng chứng dùng trong production. |
