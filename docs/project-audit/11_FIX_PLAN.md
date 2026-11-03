# 11. Kế hoạch sửa chi tiết

Tài liệu này mở rộng giai đoạn P0 và P1 trong [10_IMPROVEMENT_ROADMAP.md](10_IMPROVEMENT_ROADMAP.md) thành từng merge request (MR). Đây là kế hoạch, chưa có thay đổi nào được thực hiện.

Cỡ công việc: **S** dưới 1 ngày, **M** 1–3 ngày, **L** 1–2 tuần cho một lập trình viên. Đây là ước lượng thô.

## Nguyên tắc

1. Sửa theo thứ tự: có lưới an toàn, rồi cho hệ thống chạy được, rồi mới bịt quyền.
2. Mỗi MR một mục đích, kèm test chứng minh lỗi trước khi sửa.
3. Mọi test backend chạy trên PostgreSQL. Không dùng SQLite làm kết quả.
4. Không sửa test để qua. Mỗi test đổi phải ghi rõ test sai hay nghiệp vụ sai.
5. Không thêm công nghệ mới trong P0, gồm cả thư viện giả lập thời gian.
6. Sửa code có sẵn, không viết lại module.

## Thứ tự thực hiện

| Bước | MR | Nội dung | Cỡ | Phụ thuộc |
|---:|---|---|---:|---|
| 0 | — | Việc làm ngay, không cần code | S | Không |
| 1 | MR-1 | CI chạy test PostgreSQL, chưa chặn merge | S | Không |
| 2 | MR-2 | Sửa `FOR UPDATE` | S–M | MR-1 |
| 3 | MR-3 | Sửa 10 route 500 | S | MR-1 |
| 4 | MR-4 | Lớp phân quyền báo cáo dùng chung | L | MR-1 |
| 5 | MR-5 | Xóa quyền từ header và fallback công ty | M | MR-4 |
| 6 | MR-6 | Sửa B02 | M | Kế toán trưởng chốt quy tắc |
| 7 | MR-7 | Xử lý test còn lại, bật chặn merge | M | MR-2 đến MR-6 |
| 8 | MR-8 | Token, cấu hình, secret | M | Không |
| 9 | MR-9 | Sao lưu và khôi phục | M | Không |
| 10 | P1 | Dữ liệu vàng, báo cáo, tích hợp | L, nhiều đợt | Xong P0 |

MR-2, MR-3, MR-8 và MR-9 làm song song được. MR-4 nên do một người đảm nhận vì chạm tới cả 7 ViewSet báo cáo.

## Bước 0. Việc làm ngay

- [ ] Nếu máy test có thể truy cập từ Internet và có dữ liệu thật: giới hạn truy cập cho đến khi xong MR-5.
- [ ] Commit 7 file frontend sửa lỗi TS, cập nhật `tanh` theo `main`.
- [ ] Commit `docs/project-audit/` để cả nhóm dùng chung.
- [ ] Thống nhất người ký nghiệm thu nghiệp vụ, thường là kế toán trưởng.
- [ ] Hỏi đội hạ tầng: đã có sao lưu, reverse proxy, TLS ngoài repo chưa.

## MR-1. Đưa test backend vào CI

**Lý do:** lỗi `FOR UPDATE` tồn tại vì không có gì chạy test trên PostgreSQL. Hàm `_lock` trong `accounts_receivable/receipt_voucher.py:23` bỏ qua khóa khi chạy SQLite, nên lỗi chỉ lộ trên PostgreSQL.

**Cách làm:**

1. Thêm job `backend:test` vào stage `test` của `.gitlab-ci.yml`, dùng service `postgres:16`.
2. Chạy `python manage.py test --noinput`, tuần tự.
3. Đặt `allow_failure: true` trong lúc đang sửa, nếu không mọi MR sẽ bị chặn bởi 61 test cũ.

**Nghiệm thu:** pipeline hiển thị đúng 61 test không đạt.

## MR-2. Sửa `FOR UPDATE`

**Lý do:** chặn phiếu thu, phiếu chi, phân bổ, điều chỉnh, cơ cấu tổ chức.

**Cách làm:** chỉ khóa bảng chính.

```python
# accounts_receivable/receipt_voucher.py:23
def _lock(qs):
    if connection.vendor == "sqlite":
        return qs
    return qs.select_for_update(of=("self",))

# organization/structure_services.py:99
unit = OrganizationUnit.objects.select_for_update(of=("self",)).select_related("company", "pending_parent").get(pk=unit.pk)
```

**Rà soát:**

1. Duyệt 48 dòng kết hợp `select_related` và `select_for_update`, cộng các hàm khóa dạng `_lock`, vì mẫu tìm kiếm không bắt được chúng.
2. Với mỗi chỗ, kiểm tra code có đang dựa vào việc khóa dòng liên quan không. `of=("self",)` không khóa bảng được join. Nếu cần, khóa riêng dòng đó.

**Nghiệm thu:** 35 test nhóm này đạt trên PostgreSQL, trong đó có 12 test phiếu thu.

## MR-3. Sửa 10 route 500

Route thứ 11, `organization/structure/units`, được xử lý trong MR-2.

| Route | Sửa | Vị trí |
|---|---|---|
| `general-vouchers/opening-profit-loss` | Thêm `from django.utils import timezone` | `general_ledger/views.py` |
| `balance-aggregations` | `ordering` và `ordering_fields` dùng `created_at` nhưng model không có. Đổi sang trường thời gian thật của model | `general_ledger/views.py:787-788` |
| 8 route `fixed-assets` | Đổi `company_memberships` thành `memberships` (related name đúng ở `iam/models.py:65`) | 5 chỗ, `fixed_assets/services.py:1124, 1565, 1566, 12856, 12857` |

Sau khi sửa, kiểm tra thêm kết quả của 8 route vì trước đây chúng chưa từng chạy qua đoạn này.

**Nghiệm thu:** có test cho từng route. Chạy lại lượt quét API, không route nào trả 500.

## MR-4. Lớp phân quyền báo cáo dùng chung

**Lý do:** đây là lỗi nặng nhất. 7 ViewSet `Tax`, `Purchase`, `Sales`, `Debt`, `Money`, `Inventory`, `Asset` ở `reporting/views.py` kế thừa `ViewSet` trần, không qua `CompanyMemberMixin`. Mỗi nhóm tự viết hàm quyền riêng, và các hàm này không dùng IAM.

**Thiết kế:** kiểm tra ở tầng view, trước khi vào service. Dùng lại hàm sẵn có `has_effective_permission` và `CompanyMemberMixin._resolve_company` của `iam/permissions.py`.

```python
# reporting/report_access.py (file mới)
class ReportAccessMixin(CompanyMemberMixin):
    report_permission: str  # mỗi ViewSet khai báo một mã

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.company = self._resolve_company(request)
        if request.user.is_superuser:
            return
        if not has_effective_permission(request.user.iam_account, self.company, self.report_permission):
            raise PermissionDenied("Bạn không có quyền xem báo cáo này.")
```

**Các bước:**

1. Chốt ánh xạ quyền. Mã có sẵn: `RPT.COMMERCE.VIEW`, `RPT.DEBT.VIEW`, `RPT.MONEY.VIEW`, `RPT.INVENTORY.VIEW`, `RPT.TAX.VIEW`. Tài sản chưa thấy mã chuẩn tương ứng, `RPT_ASSET_VIEW` và `RPT_CCDC_VIEW` là mã riêng, nên cần quyết định và seed quyền mới qua migration.
2. Áp mixin cho 7 ViewSet, kiểm tra cả route `catalogue`, `as-of`, `runs`, `run_detail`, `run_rows`.
3. **Chặn đọc lần chạy báo cáo của công ty khác.** 18 route `run_detail`, `run_rows` lấy dữ liệu theo id. Ví dụ `get_sales_run_header_payload` chỉ lọc `id=run_id`, mà `id` là số tăng dần. Đọc code cho thấy có thể dò id để lấy báo cáo công ty khác. Phải thêm `company=self.company` vào truy vấn.
4. Xử lý cả `debt/confirmation-document` và mọi route khác trong `reporting/urls.py` chưa có lớp bảo vệ.
5. Thêm quyền cho `tt99-financial-statements` (SEC-07).
6. Chú ý frontend: một số màn hình có thể không gửi `company_id` qua query hoặc body. `MisaFinancialBundleWorkspace.tsx:168` đang dùng header `X-Company-Id`. Rà trước để tránh báo cáo đang chạy bị lỗi 400.

**Test bắt buộc:** một test duyệt mọi route báo cáo với ma trận trong [05_SECURITY_AUDIT.md](05_SECURITY_AUDIT.md).

| Vai trò | Kỳ vọng |
|---|---|
| Người ngoài, có hoặc không header | 403 |
| Thành viên không vai trò | 403 |
| Vai trò có đúng quyền | 200 |
| `COMPANY_ADMIN` | 200 |

**Nghiệm thu:** toàn bộ ma trận đạt. 95 báo cáo trước đây bị chặn nay mở được với `COMPANY_ADMIN`. Có test tự động phát hiện route báo cáo mới chưa được bảo vệ.

## MR-5. Xóa quyền từ header và fallback công ty

**Cần xóa:**

| Nội dung | Vị trí |
|---|---|
| `X-User-Permissions` | `debt_report_services.py:1129`, `inventory_report_services.py:509`, `money_report_services.py:491` |
| `X-Sales-Permissions`, `X-Purchase-Permissions`, `X-Tax-Permissions`, `mock_permissions` | `sales_report_services.py:874`, `purchase_report_services.py:390`, `tax_report_services.py:989` |
| `X-Allowed-Companies` | `resolve_sales_company_scope`, `resolve_tax_company_scope` |
| Cấp quyền xem mặc định | `sales_report_services.py:888` |
| Fallback theo `user.role` | `debt_report_services.py:1138` |
| `is_staff` tự có quyền | `asset_report_services.py:585` |
| `Company.objects.first()`, `DEFAULT-COMPANY` | Mọi hàm `resolve_*_company_scope` |
| Chuyển sang công ty đầu tiên khi id sai | `asset_report_services.py:2324` |

**Ảnh hưởng:** frontend không dùng các header quyền này nên giao diện không bị ảnh hưởng. `reporting/tests.py` có 18 chỗ dùng header để giả lập quyền, cần đổi sang gán vai trò thật. Đây là thay đổi hợp lệ vì chính cơ chế bị bỏ, không phải sửa test để che lỗi.

**Nghiệm thu:** tìm trong `backend/` không còn các chuỗi trên, ngoài test khẳng định header bị bỏ qua. Gửi header không đổi kết quả.

## MR-6. Sửa B02

**Vấn đề:** `general_ledger/services.py:18060` đoán chế độ kế toán từ tài khoản có phát sinh. Công ty TT99 dùng 6421 nhưng chưa có dòng 641 sẽ bị xếp nhầm 6421 vào chi phí bán hàng. Ở nhánh TT133, tài khoản lá `642` không rơi vào dòng nào.

**Cần kế toán trưởng chốt:**

| Câu hỏi | Ảnh hưởng |
|---|---|
| TT99: mã 25 và 26 lấy từ tài khoản nào? | Công thức nhánh TT99 |
| TT133: mã 24 hay 25, 26, và cách xếp 6421, 6422? | Công thức nhánh TT133 |
| Bút toán vào thẳng TK 642 không có tài khoản con xử lý ra sao? | Có chặn ghi sổ hay không |

**Cách làm:**

1. Chọn công thức chỉ theo `company.accounting_regime`, bỏ suy đoán từ dòng phát sinh.
2. So kỳ vọng của `test_uc_gl_13` với quy tắc đã chốt để biết test có đúng không.
3. So B02 của `general_ledger` và `reporting` trên cùng dữ liệu. Nếu lệch, ghi lại để xử lý ở P1-3.

**Nghiệm thu:** 3 test `test_uc_gl_13` đạt. Có bộ số tính tay được kế toán xác nhận cho cả TT99 và TT133.

## MR-7. Xử lý test còn lại và bật chặn merge

| Nhóm | Cách xử lý |
|---|---|
| Đối chiếu công nợ (10 test) | `test_customer_debt_reconciliation.py:108` lấy mùng 1 + 2 ngày, thành ngày tương lai khi chạy đầu tháng. Xác nhận lỗi rồi dùng ngày cố định, hoặc `unittest.mock.patch` cho thời gian |
| Đánh số đề nghị xuất hóa đơn | Bỏ `except` nuốt lỗi, sửa nguyên nhân thật |
| Từ chối yêu cầu tham gia | Tách `decide` thành quyền duyệt và từ chối, trả 403 đúng trường hợp |
| Module đã tắt | Kiểm tra trạng thái module ở lớp quyền |
| `DrilldownUcRpt14Tests` | Cập nhật test để đăng nhập đúng, vì endpoint đã bắt buộc thành viên |
| `debt_offset`, `supplier_debt_tracking`, bootstrap | Xem từng test và ghi kết luận |

**Cuối MR:** bỏ `allow_failure`, bật yêu cầu pipeline xanh ở `main`.

**Nghiệm thu:** 0 failure, 0 error trên PostgreSQL. MR đỏ không merge được.

## MR-8. Token, cấu hình, secret

1. `ACCESS_TOKEN_LIFETIME` còn 15 phút, `REFRESH_TOKEN_LIFETIME` theo chính sách đã chốt. Kiểm tra frontend tự làm mới token trước khi đổi.
2. Đổi mặc định sang an toàn: `CORS_ALLOW_ALL_ORIGINS=False`, `SEED_DEMO_DATA=False`, tắt `/api/docs` ở production.
3. Thêm throttle của DRF cho đăng nhập, đăng ký, quên mật khẩu. Tính năng này có sẵn trong DRF.
4. Thay mật khẩu trong `.env.example` bằng placeholder. Nếu giá trị từng dùng thật thì đổi mật khẩu, vì chúng vẫn nằm trong lịch sử git.
5. Thêm `LOGGING` cấu trúc và log các lần bị từ chối quyền.

Việc chuyển JWT khỏi `localStorage` lớn hơn và ảnh hưởng toàn bộ frontend, nên để P2.

**Nghiệm thu:** `check --deploy` với cấu hình production không còn cảnh báo chưa được chấp nhận.

## MR-9. Sao lưu và khôi phục

1. Chạy `pg_dump` hằng ngày, lưu ngoài máy chủ, đặt thời gian giữ bản sao.
2. Viết tài liệu khôi phục.
3. Diễn tập khôi phục trên máy khác và lưu biên bản. Bản sao lưu chưa khôi phục thử thì chưa được coi là có.

## P1. Làm số liệu đáng tin

Chỉ bắt đầu khi P0 xong.

| Đợt | Việc | Nghiệm thu |
|---:|---|---|
| 1 | Viết bộ dữ liệu vàng: một công ty, một quý, mọi nghiệp vụ tạo qua API thật, kế toán tính tay kết quả | Bảng cân đối, B02, B03, tờ khai GTGT khớp số tính tay |
| 2 | Kiểm tra giá vốn, thuế, khóa sổ, đảo bút toán, tỷ giá trên bộ này | Mỗi nghiệp vụ có kịch bản đạt, ghi vào kỳ khóa đều bị từ chối |
| 3 | Hợp nhất hai bộ tính BCTC về một nguồn | Chỉ còn một hàm tính |
| 4 | Kiểm tra lại 142 báo cáo và 15 báo cáo thuế, bắt đầu từ 30 báo cáo bán hàng cùng 328 dòng | Mỗi báo cáo có biên bản đối chiếu |
| 5 | Xử lý 47 màn hình chưa gọi API. Báo cáo đã có API thì nối vào, chưa có thì ẩn | Không còn số mẫu trên màn hình |
| 6 | Sửa thông báo thành công giả, hoàn thiện B09, email thật | Theo [10_IMPROVEMENT_ROADMAP.md](10_IMPROVEMENT_ROADMAP.md) |
| 7 | Kết nối hóa đơn điện tử với một nhà cung cấp | Phát hành và tra cứu được ở môi trường thử |

Với mỗi màn hình ở đợt 5, nên dùng thứ tự ưu tiên: sổ kế toán bắt buộc trước, báo cáo quản trị sau.

## Điểm dừng để ra quyết định

| Mốc | Điều kiện | Được làm gì |
|---|---|---|
| A | Xong MR-1 đến MR-7 | Test nội bộ trên PostgreSQL |
| B | Xong toàn bộ P0 | Thử nghiệm có kiểm soát với một đơn vị thân thiết, chạy song song phần mềm cũ |
| C | Xong P1, kế toán ký nghiệm thu | Triển khai chính thức |

## Rủi ro khi sửa

| Rủi ro | Phòng tránh |
|---|---|
| MR-4 làm hỏng màn hình đang chạy | Rà việc gửi `company_id` trước, kiểm thử tay từng nhóm báo cáo |
| Người dùng hiện tại mất quyền khi siết quyền | Liệt kê vai trò và quyền trước khi deploy, chạy migration gán quyền |
| `of=("self",)` làm mất khóa dòng liên quan | Rà từng chỗ theo MR-2 |
| Sửa 500 ở `fixed_assets` để lộ lỗi tiếp theo | Kiểm tra kết quả, không chỉ mã HTTP |
| Dữ liệu đã lưu theo công thức B02 sai | Kết quả báo cáo đã lưu không tự cập nhật, cần lập lại |
