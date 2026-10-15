# UC-SYS-10 — Quản lý Workflow phê duyệt

API gốc: `/api/v1/approval-workflows/`. Actor cần Membership ACTIVE và Permission `SYS.WORKFLOW.CONFIGURE` trong doanh nghiệp. Mọi thao tác ghi cấu hình và phiên bản đều nằm trong transaction cùng Audit Log.

| Tác vụ | API |
| --- | --- |
| Đặt chính sách cho loại chứng từ | `POST policies/` với `company`, `document_type`, `policy` |
| Danh sách chính sách | `GET policies/?company_id=<uuid>` |
| Tạo Workflow DRAFT | `POST workflows/` |
| Danh sách, chi tiết | `GET workflows/?company_id=<uuid>`, `GET workflows/<id>/?company_id=<uuid>` |
| Sao chép | `POST workflows/<id>/clone/?company_id=<uuid>` với `code`, `name` |
| Tạo phiên bản mới | `POST workflows/<id>/new-version/?company_id=<uuid>` |
| Lịch sử phiên bản | `GET workflows/<id>/history/?company_id=<uuid>` |
| Sửa DRAFT | `PATCH versions/<id>/?company_id=<uuid>` với `version` từ response và trường cần sửa |
| Kiểm tra, mô phỏng | `POST versions/<id>/validate/?company_id=<uuid>` với `samples` tùy chọn |
| Kích hoạt, ngừng, lưu trữ | `POST versions/<id>/activate/`, `stop/` hoặc `archive/` với `version` |

`DocumentType.code` của catalog phải khớp mã nghiệp vụ mà backend dùng khi gửi chứng từ: `PUR.REQUEST`, `PUR.ORDER`, `PUR.CONTRACT`, `AP.INVOICE`, `AP.PAYMENT_REQUEST`, `SAL.QUOTATION`, `SAL.ORDER`, `SAL.CONTRACT`, `AR.<document_type>`, `CASH.<transaction_type>`, `BANK.<transaction_type>`, `INV.<transaction_type>`, `FA.<transaction_type>`, `GL.JOURNAL_ENTRY`. `supports_workflow=True` và `status=ACTIVE` là bắt buộc.

Điều kiện là object rỗng `{}` để áp dụng mặc định, một điều kiện đơn `{ "field": "total_amount", "operator": "gte", "value": "100000000" }`, hoặc nhóm `{ "op": "AND", "rules": [ ... ] }`. `OR` và nhóm lồng nhau được hỗ trợ. Các trường có thể dùng: `total_amount`, `amount`, `branch_id`, `department_id`, `transaction_type`, `payment_method`, `party_id`, `supplier_id`, `customer_id`, `project_id`, `cost_center_id`, `currency_id`. Hệ thống từ chối trường, toán tử và giá trị sai kiểu.

Ví dụ một bước:

```json
{
  "order": 1,
  "name": "Trưởng phòng duyệt",
  "mode": "ANY_ONE",
  "approvers": [{"type": "USER", "id": "<user-account-uuid>"}],
  "on_approve": "COMPLETE",
  "on_reject": "REJECT"
}
```

`steps` là mảng bước có `order` liên tiếp từ 1. `mode` có thể là `ANY_ONE`, `ALL`, `MINIMUM` (kèm `minimum`), `SEQUENTIAL`, `PARALLEL`. Quy tắc Approver hỗ trợ `USER`, `ROLE`, `POSITION`, `UNIT_MANAGER`, `DOCUMENT_FIELD`, `PREVIOUS_STEP_RESULT` và `DYNAMIC_RULE` với strategy `UNIT_MANAGER`; có thể đặt `fallback` cùng cấu trúc. `on_approve` nhận `NEXT`, số thứ tự bước phía sau hoặc `COMPLETE`. Khi phê duyệt, backend kiểm tra Membership, Permission, Data Scope và danh sách Approver từ snapshot đã lưu trên chứng từ.

`on_reject` nhận `REJECT`, `RETURN_CREATOR` hoặc `PREVIOUS`; `on_changes` nhận `RETURN_CREATOR` hoặc `PREVIOUS`. Thao tác Request Changes trên chứng từ thuộc UC-SYS-11; UC-SYS-10 lưu và kiểm tra cấu hình nhánh này.

Fallback cần `valid_from`, `valid_to` ở dạng `YYYY-MM-DD`; có thể giới hạn thêm bằng `scope` chứa `branch_id` hoặc `department_id` thuộc doanh nghiệp. Ví dụ: `{"type":"USER","id":"<uuid>","valid_from":"2026-10-01","valid_to":"2026-10-31","scope":{"branch_id":"<uuid>"}}`.

Khi gửi chứng từ, nếu đã cấu hình chính sách, backend tự chọn Workflow ACTIVE theo Priority rồi đến số điều kiện cụ thể. `REQUIRED` không có Workflow phù hợp sẽ chặn gửi; `NOT_REQUIRED` cho phép đi tiếp; `OPTIONAL` không có Workflow phù hợp không tạo yêu cầu. Snapshot phiên bản được lưu trên chứng từ, nên kích hoạt phiên bản mới không đổi yêu cầu đang chạy. Trường `workflow_snapshot` do client gửi không quyết định Workflow khi chính sách đã được cấu hình.

Workflow đang sử dụng `UNIT_MANAGER` với đơn vị cố định tạo dependency trên đơn vị đó. Admin cần ngừng hoặc thay thế Workflow trước khi ngừng sử dụng đơn vị.

Lập lịch chạy `python manage.py sync_approval_workflows` hằng ngày để kích hoạt phiên bản SCHEDULED và kết thúc bản hết hạn ngay khi sang ngày mới. Việc chọn Workflow khi gửi chứng từ cũng tự đồng bộ trước khi chọn.
