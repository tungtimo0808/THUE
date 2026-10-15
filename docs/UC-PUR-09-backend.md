# Tài liệu Kỹ thuật Backend: UC-PUR-09 Phê duyệt chứng từ mua hàng

## 1. Mô tả tổng quan

| Thuộc tính | Chi tiết |
| :--- | :--- |
| **Mã Use Case** | `UC-PUR-09` |
| **Tên Use Case** | Phê duyệt chứng từ mua hàng (Purchase Document Approval) |
| **Module** | Mua hàng (`purchases`) & Luồng phê duyệt (`approval_workflows`) |
| **Mô tả** | Cung cấp API tập trung cho hộp thư phê duyệt (inbox), xem chi tiết chứng từ và xử lý quyết định phê duyệt (`APPROVE`), yêu cầu chỉnh sửa (`REQUEST_REVISION`) hoặc từ chối (`REJECT`) cho tất cả 6 loại chứng từ thuộc phân hệ Mua hàng. |
| **Base URL** | `/api/v1/purchases/approvals/` |

---

## 2. Phạm vi chứng từ áp dụng (`1.1. Phạm vi chứng từ`)

| Mã Use Case | Mã loại chứng từ (`document_type`) | Model tương ứng | Tên chứng từ tiếng Việt |
| :--- | :--- | :--- | :--- |
| `UC-PUR-01` | `REQUEST` | `PurchaseRequest` | Yêu cầu mua hàng |
| `UC-PUR-02` | `ORDER` | `PurchaseOrder` | Đơn mua hàng |
| `UC-PUR-03` | `GOODS` | `GoodsPurchase` (`purchase_type != 'SERVICE'`) | Chứng từ mua hàng hóa |
| `UC-PUR-04` | `SERVICE` | `GoodsPurchase` (`purchase_type == 'SERVICE'`) | Chứng từ mua dịch vụ |
| `UC-PUR-05` | `RETURN` | `PurchaseReturn` | Chứng từ hàng mua trả lại |
| `UC-PUR-06` | `DISCOUNT` | `PurchaseDiscount` | Chứng từ giảm giá hàng mua |

---

## 3. Phân quyền IAM & Kiểm tra quyền hạn

### 3.1. Quyền IAM tập trung (`PUR.APPROVAL`)
- **`PUR.APPROVAL.VIEW`**: Quyền xem danh sách chứng từ chờ phê duyệt và thông tin chi tiết phê duyệt (`EF-01`).
- **`PUR.APPROVAL.APPROVE`**: Quyền đưa ra quyết định phê duyệt chứng từ (`APPROVE`).
- **`PUR.APPROVAL.REQUEST_REVISION`**: Quyền yêu cầu chỉnh sửa chứng từ (`REQUEST_REVISION`).
- **`PUR.APPROVAL.REJECT`**: Quyền từ chối phê duyệt chứng từ (`REJECT`).

### 3.2. Cơ chế Fallback phân quyền theo loại chứng từ
Nếu User không có quyền cụ thể `PUR.APPROVAL.APPROVE`, hệ thống tự động kiểm tra quyền tương ứng theo chứng từ nghiệp vụ:
- `REQUEST` -> `PUR.REQUEST.APPROVE`
- `ORDER` -> `PUR.ORDER.APPROVE`
- `GOODS` -> `PUR.GOODS.APPROVE`
- `SERVICE` -> `PUR.SERVICE.APPROVE`
- `RETURN` -> `PUR.RETURN.APPROVE`
- `DISCOUNT` -> `PUR.DISCOUNT.APPROVE`

---

## 4. Đặc tả API Endpoints

### 4.1. Lấy danh sách việc cần xử lý / Chờ phê duyệt (`GET /pending/`)
- **URL**: `GET /api/v1/purchases/approvals/pending/`
- **Mục đích**: Đáp ứng Activity Flow bước 1-3. Hiển thị các chứng từ đang ở `PENDING_APPROVAL` được phân công cho User tại cấp phê duyệt hiện tại và không vượt hạn mức.
- **Query Parameters**:
  - `company_id` (*bắt buộc*, UUID): Mã doanh nghiệp.
  - `document_type` (*tùy chọn*, String): Lọc theo loại chứng từ (`REQUEST`, `ORDER`, `GOODS`, `SERVICE`, `RETURN`, `DISCOUNT`).

#### Response Success (200 OK):
```json
[
  {
    "document_type": "ORDER",
    "document_type_name": "Đơn mua hàng",
    "document_id": "9087c569-fa36-4ddf-ba78-ea5bf01ea2b5",
    "number": "PO-2026-0001",
    "document_date": "2026-10-06",
    "creator_id": "763ce142-b7e1-45ce-844f-c020f92b77ff",
    "creator_name": "Nguyễn Văn Lập",
    "supplier_id": "d05eb41d-cb56-4279-9134-8c01ba47cf1c",
    "supplier_name": "Công ty TNHH Cung Cấp A",
    "branch_id": "a910ea76-13ea-44fb-811c-c2b61ff6fe60",
    "branch_name": "Chi nhánh Hà Nội",
    "total_amount": "100000000.0000",
    "current_level": 1,
    "total_levels": 2,
    "submitted_at": "2026-10-06T08:00:00Z",
    "version": 1,
    "notes": "Đơn mua thiết bị văn phòng"
  }
]
```

---

### 4.2. Xem chi tiết thông tin chứng từ khi phê duyệt (`GET /detail/`)
- **URL**: `GET /api/v1/purchases/approvals/detail/`
- **Mục đích**: Đáp ứng Activity Flow bước 7-10. Hiển thị thông tin chứng từ, người lập, nhà cung cấp, chi tiết hàng hóa/dịch vụ, workflow các cấp và lịch sử phê duyệt trước đó.
- **Query Parameters**:
  - `company_id` (*bắt buộc*, UUID): Mã doanh nghiệp.
  - `document_type` (*bắt buộc*, String): Mã loại chứng từ.
  - `document_id` (*bắt buộc*, UUID): ID chứng từ.

#### Response Success (200 OK):
```json
{
  "document_type": "ORDER",
  "document_type_name": "Đơn mua hàng",
  "document_id": "9087c569-fa36-4ddf-ba78-ea5bf01ea2b5",
  "number": "PO-2026-0001",
  "document_date": "2026-10-06",
  "posting_date": "2026-10-06",
  "status": "PENDING_APPROVAL",
  "version": 1,
  "total_amount": "100000000.0000",
  "notes": "Đơn mua thiết bị văn phòng",
  "creator": {
    "id": "763ce142-b7e1-45ce-844f-c020f92b77ff",
    "name": "Nguyễn Văn Lập",
    "submitted_at": "2026-10-06T08:00:00Z"
  },
  "supplier": {
    "id": "d05eb41d-cb56-4279-9134-8c01ba47cf1c",
    "code": "NCC01",
    "name": "Công ty TNHH Cung Cấp A"
  },
  "branch": {
    "id": "a910ea76-13ea-44fb-811c-c2b61ff6fe60",
    "code": "CN01",
    "name": "Chi nhánh Hà Nội"
  },
  "lines": [
    {
      "id": "40b15b31-3aa2-4c2f-b44c-20fe1bc277c0",
      "line_no": 1,
      "item_id": "c1f73656-78ff-4530-9b40-9fe5cdafbba9",
      "item_code": "HH01",
      "item_name": "Máy tính xách tay Dell XPS",
      "uom_id": "91a82fce-862d-4598-bb02-e221375d0458",
      "uom_name": "Chiếc",
      "quantity": "5.000000",
      "unit_price": "20000000.0000",
      "total_amount": "100000000.0000"
    }
  ],
  "workflow": {
    "current_level": 1,
    "total_levels": 2,
    "is_final_level": false,
    "allow_self_approval": false
  },
  "history": []
}
```

---

### 4.3. Xác nhận quyết định phê duyệt (`POST /decide/`)
- **URL**: `POST /api/v1/purchases/approvals/decide/`
- **Mục đích**: Đáp ứng Activity Flow bước 16-32 và Alternative Flows AF-01 đến AF-06.
- **Request Body**:
```json
{
  "company_id": "e963bcbb-ba00-478a-a43b-fb5c88b776dc",
  "document_type": "ORDER",
  "document_id": "9087c569-fa36-4ddf-ba78-ea5bf01ea2b5",
  "action": "APPROVE",
  "comment": "Đồng ý phê duyệt",
  "version": 1
}
```

#### Các hành động hợp lệ (`action`):
1. **`APPROVE`**:
   - Nếu còn cấp tiếp theo (`AF-01`): Trạng thái giữ nguyên `PENDING_APPROVAL`, ghi nhận quyết định cấp hiện tại, mở nhiệm vụ cho cấp tiếp theo.
   - Nếu là cấp cuối (`BR-PUR-APR-28`): Trạng thái chuyển sang `APPROVED`, gán `approved_at`, tăng `version`.
   - `comment`: Không bắt buộc (`AF-06`), tối đa 500 ký tự.
   - Response message: `"Phê duyệt chứng từ thành công."`
2. **`REQUEST_REVISION`** (`AF-02`, `AF-03`):
   - Trạng thái chuyển sang `REVISION_REQUIRED`, dừng luồng phê duyệt hiện tại.
   - `comment`: Bắt buộc (`EF-05`), từ 1-500 ký tự.
   - Response message: `"Yêu cầu chỉnh sửa chứng từ thành công."`
3. **`REJECT`** (`AF-04`, `AF-05`):
   - Trạng thái chuyển sang `REJECTED`, dừng luồng phê duyệt và không cho ghi sổ.
   - `comment`: Bắt buộc (`EF-06`), từ 1-500 ký tự.
   - Response message: `"Từ chối chứng từ thành công."`

#### Response Success (200 OK):
```json
{
  "message": "Phê duyệt chứng từ thành công.",
  "status": "APPROVED",
  "document_id": "9087c569-fa36-4ddf-ba78-ea5bf01ea2b5",
  "document_type": "ORDER",
  "version": 2
}
```

---

## 5. Quy tắc nghiệp vụ (Business Rules Mapping)

| Mã BR | Quy tắc | Triển khai Backend |
| :--- | :--- | :--- |
| **BR-PUR-APR-01** | User phải có Permission phê duyệt chứng từ mua hàng. | Kiểm tra `PUR.APPROVAL.APPROVE` hoặc quyền module tương ứng tại `check_approval_permission`. |
| **BR-PUR-APR-02** | User chỉ được xử lý chứng từ khi được phân công tại cấp phê duyệt hiện tại. | `check_approver_assignment_and_limit` kiểm tra assignee trong snapshot/tasks của cấp hiện tại (`EF-03`). |
| **BR-PUR-APR-03** | Admin doanh nghiệp không mặc định có quyền phê duyệt nếu chưa được cấu hình. | Không dùng `is_company_admin` bypass; bắt buộc phải có quyền và phân công cụ thể. |
| **BR-PUR-APR-04** | Kiểm tra quyền, phân công và hạn mức tại thời điểm xác nhận quyết định. | Thực hiện kiểm tra trong transaction khóa bản ghi `select_for_update()`. |
| **BR-PUR-APR-05** | User không được tự phê duyệt chứng từ do chính mình lập. | Chặn nếu `doc.created_by_id == actor.id` và `allow_self_approval != True`. |
| **BR-PUR-APR-06** | Các cấp phê duyệt thực hiện đúng thứ tự trong Workflow. | Lấy `current_level = decisions.filter(APPROVED).count() + 1` kiểm tra theo step order. |
| **BR-PUR-APR-07** | Cấp sau chỉ được xử lý khi tất cả cấp trước đã phê duyệt. | Cấp hiện tại được tính dựa trên số lượng cấp đã duyệt thành công. |
| **BR-PUR-APR-08** | Luồng nhiều cấp giữ `PENDING_APPROVAL` cho đến cấp cuối. | Trạng thái chứng từ giữ `PENDING_APPROVAL` nếu `current_level < total_levels`. |
| **BR-PUR-APR-09** | Chứng từ chỉ sang `APPROVED` khi cấp bắt buộc cuối cùng đã duyệt. | `final_approval = current_level >= total_levels` trước khi gán `APPROVED`. |
| **BR-PUR-APR-12** | User chỉ được phê duyệt chứng từ trong hạn mức được cấp. | So sánh `get_document_total(doc)` với `step.limit` / `rule.limit` (`EF-08`). |
| **BR-PUR-APR-13** | Hạn mức kiểm tra theo Tổng giá trị thanh toán chứng từ. | Sử dụng `get_document_total` (bao gồm thuế, chiết khấu). |
| **BR-PUR-APR-16** | Quyết định hợp lệ: `APPROVE`, `REQUEST_REVISION`, `REJECT`. | Kiểm tra tại serializer và service layer. |
| **BR-PUR-APR-18** | Nội dung yêu cầu chỉnh sửa bắt buộc 1-500 ký tự. | Kiểm tra tại `ApprovalDecisionInputSerializer` và `execute_approval_decision` (`EF-05`). |
| **BR-PUR-APR-19** | Lý do từ chối bắt buộc 1-500 ký tự. | Kiểm tra tại `ApprovalDecisionInputSerializer` và `execute_approval_decision` (`EF-06`). |
| **BR-PUR-APR-20** | Một User chỉ được ghi nhận một quyết định tại cùng cấp và version. | Kiểm tra `ApprovalDecision.objects.filter(actor, level, document_version)`. |
| **BR-PUR-APR-21** | Quyết định đã hoàn thành không được sửa/xóa; lưu log bất biến. | `ApprovalDecision` là append-only, lưu vết thời điểm và phiên bản. |
| **BR-PUR-APR-22** | Chứng từ ở `PENDING_APPROVAL` không được sửa nội dung. | Kiểm tra trạng thái chứng từ tại các API cập nhật chứng từ gốc. |
| **BR-PUR-APR-27** | Khóa lạc quan (Optimistic Concurrency). | So sánh `version` của client gửi lên với `doc.version` trong DB (`EF-07`). |
| **BR-PUR-APR-31** | Phê duyệt không tự động ghi sổ chứng từ kho/kế toán. | Không gọi `post_document()` hoặc thay đổi số dư kho tự động khi duyệt. |
| **BR-PUR-APR-32** | Chứng từ sau khi `APPROVED` chỉ ghi sổ bởi User có quyền ghi sổ. | Tách rời quyền duyệt và quyền ghi sổ (`*.POST`). |
| **BR-PUR-APR-36** | Hệ thống ghi Audit Log cho mọi quyết định phê duyệt. | Gọi hàm `audit()` ghi nhận chi tiết trước/sau, người thực hiện, lý do. |

---

## 6. Xử lý ngoại lệ (Exception Flows Mapping)

| Mã lỗi | Điều kiện phát sinh | HTTP Status | Thông báo lỗi trả về chuẩn |
| :--- | :--- | :--- | :--- |
| **EF-01** | Không có quyền phê duyệt chứng từ mua hàng | `403 Forbidden` | `"Bạn không có quyền phê duyệt chứng từ mua hàng."` |
| **EF-02** | Chứng từ không còn ở `PENDING_APPROVAL` | `400 Bad Request` | `"Chứng từ đã được xử lý hoặc thay đổi trạng thái."` |
| **EF-03** | User không được phân công tại cấp hiện tại | `403 Forbidden` | `"Bạn không được phân công phê duyệt chứng từ này."` |
| **EF-04** | User không có quyền xem chứng từ/tài liệu | `403 Forbidden` | `"Bạn không có quyền xem tài liệu này."` |
| **EF-05** | `REQUEST_REVISION` thiếu nội dung | `400 Bad Request` | `"Vui lòng nhập nội dung yêu cầu chỉnh sửa."` |
| **EF-06** | `REJECT` thiếu lý do | `400 Bad Request` | `"Vui lòng nhập lý do từ chối."` |
| **EF-07** | Phiên bản chứng từ đã thay đổi (xung đột đồng thời) | `400 Bad Request` | `"Nội dung chứng từ đã thay đổi. Vui lòng tải lại để kiểm tra."` |
| **EF-08** | Tổng giá trị chứng từ vượt hạn mức User | `400 Bad Request` | `"Giá trị chứng từ vượt hạn mức phê duyệt của bạn."` |
| **EF-09** | Quyền hạn/phân công đã thay đổi | `403 Forbidden` | `"Quyền phê duyệt của bạn đã thay đổi. Vui lòng tải lại dữ liệu."` |
| **EF-10** | Chứng từ đã được User khác xử lý đồng thời | `400 Bad Request` | `"User đã phê duyệt bước này."` hoặc `"Chứng từ đã được xử lý hoặc thay đổi trạng thái."` |
| **EF-11** | Phiên đăng nhập hết hạn | `401 Unauthorized` | `"Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."` |
| **EF-12** | Hệ thống bị gián đoạn giao dịch | `500 Server Error` | Giao dịch tự động rollback trong `@transaction.atomic`. |

---

## 7. Kiểm thử tự động (Automated Test Suite)

Toàn bộ các ca kiểm thử cho Use Case `UC-PUR-09` được đặt tại file [test_purchase_approval.py](file:///c:/Users/Admin/LapTrinh/Thue/purchases/test_purchase_approval.py):

| Test Method | Nội dung kiểm thử |
| :--- | :--- |
| `test_pending_list_and_detail` | Kiểm tra lấy danh sách chờ phê duyệt và xem chi tiết chứng từ (Activity Flow 1-10). |
| `test_approve_single_level_success` | Duyệt chứng từ 1 cấp: trạng thái chuyển sang `APPROVED`, ghi `ApprovalDecision`. |
| `test_multi_level_approval_flow` | Duyệt chứng từ 2 cấp: cấp 1 duyệt giữ `PENDING_APPROVAL`, cấp 2 duyệt hoàn tất `APPROVED`. |
| `test_request_revision_flow` | Yêu cầu chỉnh sửa: trạng thái sang `REVISION_REQUIRED`, lưu ý kiến phản hồi. |
| `test_reject_flow` | Từ chối: trạng thái sang `REJECTED`, lưu lý do từ chối. |
| `test_validation_empty_comments` | Kiểm tra bắt buộc nhập comment cho `REQUEST_REVISION` (`EF-05`) và `REJECT` (`EF-06`). |
| `test_self_approval_blocked` | Chặn User tự phê duyệt chứng từ do chính mình lập (`BR-PUR-APR-05`). |
| `test_approval_limit_exceeded` | Chặn User duyệt khi giá trị chứng từ vượt hạn mức (`BR-PUR-APR-12`, `EF-08`). |
| `test_concurrency_optimistic_locking` | Kiểm tra khóa lạc quan khi `version` gửi lên không khớp (`EF-07`). |
| `test_unassigned_approver_blocked` | Chặn User không được phân công tại cấp hiện tại (`EF-03`). |
| `test_no_permission_blocked` | Chặn User không có quyền phê duyệt (`EF-01`). |
| `test_all_document_types_approval` | Phê duyệt đầy đủ 6 loại chứng từ (`REQUEST`, `ORDER`, `GOODS`, `SERVICE`, `RETURN`, `DISCOUNT`) và đảm bảo không tự động ghi sổ (`BR-PUR-APR-31`). |

Toàn bộ 80 bài kiểm tra trong module `purchases` chạy đạt 100% không có lỗi.
