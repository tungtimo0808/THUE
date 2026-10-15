# TÀI LIỆU API & NGHIỆP VỤ HỆ THỐNG TÀI KHOẢN KẾ TOÁN (COA)
## Mã Use Case: UC-MD-09 (Module: UC-MD – Quản lý danh mục & General Ledger)

---

### 1. TỔNG QUAN

Tài liệu này quy định chi tiết kỹ thuật cho phân hệ Backend quản lý Hệ thống tài khoản kế toán (**Chart of Accounts - COA**). Phân hệ cho phép doanh nghiệp:
- Khởi tạo hệ thống tài khoản kế toán chuẩn mực theo chế độ kế toán (**Thông tư 200/2014/TT-BTC** và **Thông tư 133/2016/TT-BTC**) với phạm vi đầy đủ (**FULL**) hoặc rút gọn (**ESSENTIAL** cho doanh nghiệp nhỏ / 1 người).
- Thiết lập cây phân cấp tài khoản đa cấp cha - con (**Parent - Child Hierarchy**), tự động xác định cấp bậc và kiểm soát chu trình.
- Thiết lập tài khoản ghi sổ (**Posting Account**) và tài khoản tổng hợp (**Summary Account**).
- Cấu hình theo dõi ngoại tệ (**Multi-currency**) và các đối tượng theo dõi chi tiết (**Accounting Dimensions**) với các cấp độ bắt buộc (**REQUIRED, OPTIONAL, CONDITIONAL, NOT_USED**).
- Kiểm soát bảo vệ tài khoản hệ thống (**System Account**), khóa cứng mã và bản chất khi đã phát sinh bút toán / số dư.
- Kiểm soát đồng thời với cơ chế khóa lạc quan (**Optimistic Concurrency Control - Versioning**).
- Kiểm tra điều kiện ràng buộc khi ngừng sử dụng (**Deactivation Impact Check**) và chuyển đổi số dư / tài khoản thay thế.
- Xuất nhập khẩu danh mục qua file CSV chuẩn hóa và ghi vết kiểm toán toàn diện (**Audit Log**).

---

### 2. CÁC ĐỊNH NGHĨA & HẰNG SỐ DANH MỤC

#### 2.1. Bản chất tài khoản (`AccountNature` / `account_type`)
| Giá trị | Tên hiển thị | Nhóm tài khoản thông dụng |
| :--- | :--- | :--- |
| `ASSET` | Tài sản | Loại 1 (Tài sản ngắn hạn), Loại 2 (Tài sản dài hạn) |
| `LIABILITY` | Nợ phải trả | Loại 3 (Nợ phải trả) |
| `EQUITY` | Vốn chủ sở hữu | Loại 4 (Vốn chủ sở hữu), Loại 9 (Xác định KQKD) |
| `REVENUE` | Doanh thu, thu nhập | Loại 5 (Doanh thu bán hàng và tài chính) |
| `EXPENSE` | Chi phí | Loại 6 (Chi phí SXKD), Loại 8 (Chi phí khác) |
| `OTHER_INCOME`| Thu nhập khác | Loại 7 (Thu nhập khác) |
| `OTHER_EXPENSE`| Chi phí khác | Loại 8 (Chi phí khác) |
| `OFF_BALANCE` | Tài khoản ngoài bảng | Loại 0 (Tài sản thuê ngoài, ngoại tệ nhận ký cược...) |

#### 2.2. Tính chất số dư (`NormalBalance` / `normal_balance`)
| Giá trị | Tên hiển thị | Diễn giải |
| :--- | :--- | :--- |
| `DEBIT` | Dư Nợ | Thông thường có số dư bên Nợ (Tài sản, Chi phí) |
| `CREDIT` | Dư Có | Thông thường có số dư bên Có (Nợ phải trả, Vốn, Doanh thu) |
| `BOTH` | Lưỡng tính | Có thể có số dư Nợ hoặc Có (ví dụ: TK 131, TK 331, TK 421) |
| `NONE` | Không có số dư | Không có số dư cuối kỳ (ví dụ: TK 911, TK 511, TK 632) |

#### 2.3. Trạng thái tài khoản (`AccountStatus` / `status`)
| Giá trị | Tên hiển thị | Quyền hạn & Nghiệp vụ áp dụng |
| :--- | :--- | :--- |
| `DRAFT` | Dự thảo | Đang thiết lập cấu hình, chưa cho phép hạch toán |
| `ACTIVE` | Đang sử dụng | Được phép hạch toán, chọn trên chứng từ và bút toán mới |
| `INACTIVE` | Ngừng sử dụng | Không cho phép chọn cho chứng từ mới, bảo toàn số dư và lịch sử báo cáo |
| `ARCHIVED` | Lưu trữ | Chỉ lưu để đối chiếu lịch sử |

#### 2.4. Đối tượng theo dõi chi tiết (`AccountingDimension`) & Mức độ bắt buộc
**Danh mục Dimension hỗ trợ:**
- `CUSTOMER`: Công nợ khách hàng (gắn với `PartyRole = CUSTOMER`)
- `SUPPLIER`: Công nợ nhà cung cấp (gắn với `PartyRole = VENDOR`)
- `EMPLOYEE`: Tạm ứng / công nợ nhân viên
- `ITEM`: Theo dõi chi tiết theo vật tư, hàng hóa
- `WAREHOUSE`: Theo dõi chi tiết theo kho
- `BANK_ACCOUNT`: Theo dõi theo tài khoản ngân hàng của công ty
- `PROJECT`: Theo dõi theo dự án
- `COST_CENTER`: Theo dõi theo trung tâm chi phí
- `CONTRACT`: Theo dõi theo hợp đồng kinh tế
- `DEPARTMENT`: Theo dõi theo phòng ban
- `FIXED_ASSET`: Theo dõi theo mã tài sản cố định
- `CCDC`: Theo dõi theo công cụ dụng cụ

**Cấp độ bắt buộc (`DimensionRequirementLevel`):**
- `NOT_USED`: Không sử dụng
- `OPTIONAL`: Tùy chọn (cho phép nhập nếu có)
- `REQUIRED`: Bắt buộc nhập (Backend từ chối ghi sổ nếu thiếu)
- `CONDITIONAL`: Bắt buộc có điều kiện theo nghiệp vụ

---

### 3. QUY TẮC NGHIỆP VỤ CỐT LÕI (BUSINESS RULES SUMMARY)

1. **BR-COA-01 & 02**: Số hiệu tài khoản (`code`) là duy nhất trong phạm vi doanh nghiệp và hệ thống tài khoản (`ChartOfAccounts`).
2. **BR-COA-04 & 52**: Hỗ trợ khởi tạo tự động từ mẫu Thông tư 200 hoặc Thông tư 133; cung cấp phạm vi ESSENTIAL tối giản cho doanh nghiệp nhỏ / 1 người.
3. **BR-COA-06 & 07 (EF-15)**: Tài khoản khởi tạo từ mẫu được gắn cờ `is_system=True`. Các thuộc tính cốt lõi (`code`, `account_type`, `normal_balance`, `is_system`) được bảo vệ nghiêm ngặt, không cho phép sửa đổi hoặc xóa cứng.
4. **BR-COA-10 (EF-14)**: Ngăn chặn tuyệt đối quan hệ chu trình (vòng lặp cha - con).
5. **BR-COA-11**: Cấp tài khoản (`account_level`) được tự động tính toán từ cấu trúc cây (Gốc = 1, Con = Cấp cha + 1).
6. **BR-COA-12**: Số hiệu tài khoản con **bắt buộc** phải bắt đầu bằng số hiệu tài khoản cha (Ví dụ: con `1111` trực thuộc cha `111`).
7. **BR-COA-13 (EF-09)**: Bản chất tài khoản con (`account_type`) **bắt buộc** phải tương thích và kế thừa từ bản chất tài khoản cha.
8. **BR-COA-14 & 15 (EF-10)**: Tài khoản tổng hợp có tài khoản con ACTIVE thì không được phép là tài khoản ghi sổ (`is_postable = False`). Chỉ tài khoản Posting Account (`is_postable = True`) ở trạng thái ACTIVE mới được sử dụng trong bút toán.
9. **BR-COA-22, 25 & 45**: Backend kiểm tra nghiêm ngặt: Mọi bút toán ghi vào tài khoản có Dimension ở mức `REQUIRED` mà thiếu giá trị tương ứng thì lập tức bị từ chối ghi sổ.
10. **BR-COA-36, 37, 38 & 39 (EF-16, 17, 21)**:
    - Tài khoản đã phát sinh bút toán (`JournalLine` > 0) **không được sửa số hiệu trực tiếp** và **không được xóa cứng**.
    - Tài khoản đã có số dư (`AccountBalance` != 0) **không được sửa bản chất trực tiếp**.
11. **BR-COA-41, 42 (EF-18, 19, 20)**: Trước khi ngừng sử dụng (`INACTIVE`):
    - Kiểm tra tài khoản con: nếu còn tài khoản con ACTIVE thì bắt buộc phải xử lý ngừng tài khoản con trước.
    - Kiểm tra chứng từ Draft: nếu còn chứng từ Draft đang tham chiếu thì bắt buộc phải hoàn tất xử lý trước.
    - Bắt buộc nhập ngày kết thúc (`end_date`) và lý do ngừng (`reason`).
12. **BR-COA-58 (EF-24)**: Kiểm soát đồng thời với khóa lạc quan: Client gửi kèm `version`; nếu phiên bản đã bị thay đổi thì hệ thống trả về mã lỗi `409 Conflict`.
13. **BR-COA-60 & 61**: Mọi thao tác thêm, sửa, đổi trạng thái, khởi tạo mẫu, import đều được ghi vết Audit Log với đầy đủ dữ liệu trước - sau (`before`, `after`), người thực hiện và lý do.

---

### 4. CHI TIẾT CÁC ENDPOINT API

Hệ thống hỗ trợ 2 đường dẫn truy cập song song (backward compatible):
- Phân hệ Sổ cái: `/api/v1/general-ledger/accounts/`
- Phân hệ Danh mục dùng chung (UC-MD): `/api/v1/master-data/accounts/`

#### 4.1. Khởi tạo hệ thống tài khoản từ mẫu
- **Phương thức**: `POST /api/v1/general-ledger/accounts/init-from-template/`
- **Quyền yêu cầu**: `MD.ACCOUNT.CREATE`
- **Request Body**:
```json
{
  "company_id": "90e29b19-c0da-4a11-a8cf-3c5861ea5586",
  "regime": "TT200",      // "TT200" hoặc "TT133"
  "scope": "FULL",        // "FULL" hoặc "ESSENTIAL" (rút gọn cho DN nhỏ)
  "chart_code": "COA-TT200",
  "chart_name": "Hệ thống tài khoản TT200"
}
```
- **Response** (`201 Created`):
```json
{
  "chart_of_accounts_id": "066ee146-5ec5-408d-8628-912b7f7ce180",
  "chart_code": "COA-TT200",
  "regime": "TT200",
  "scope": "FULL",
  "template_version": "TT200-FULL-V1",
  "created_count": 48,
  "skipped_count": 0,
  "total_accounts": 48
}
```

#### 4.2. Xem cây phân cấp tài khoản (Tree View)
- **Phương thức**: `GET /api/v1/general-ledger/accounts/tree/?company_id={company_id}`
- **Quyền yêu cầu**: `MD.ACCOUNT.VIEW`
- **Response** (`200 OK`):
```json
[
  {
    "id": "7817b3bf-5178-43d7-8495-d242fb591740",
    "code": "111",
    "name": "Tiền mặt",
    "name_en": "Cash on hand",
    "account_level": 1,
    "account_type": "ASSET",
    "normal_balance": "DEBIT",
    "is_postable": false,
    "is_system": true,
    "is_foreign_currency": false,
    "status": "ACTIVE",
    "parent_id": null,
    "children": [
      {
        "id": "b304c4ae-4b08-410c-b26a-9359339e7df1",
        "code": "1111",
        "name": "Tiền Việt Nam",
        "name_en": "Vietnamese Dong",
        "account_level": 2,
        "account_type": "ASSET",
        "normal_balance": "DEBIT",
        "is_postable": true,
        "is_system": true,
        "is_foreign_currency": false,
        "status": "ACTIVE",
        "parent_id": "7817b3bf-5178-43d7-8495-d242fb591740",
        "children": []
      }
    ]
  }
]
```

#### 4.3. Báo cáo phân tích tác động (Impact Analysis)
- **Phương thức**: `GET /api/v1/general-ledger/accounts/{id}/impact/?company_id={company_id}`
- **Quyền yêu cầu**: `MD.ACCOUNT.VIEW`
- **Response** (`200 OK`):
```json
{
  "id": "b304c4ae-4b08-410c-b26a-9359339e7df1",
  "code": "1111",
  "name": "Tiền Việt Nam",
  "name_en": "Vietnamese Dong",
  "status": "ACTIVE",
  "is_system": true,
  "is_postable": true,
  "account_type": "ASSET",
  "normal_balance": "DEBIT",
  "children_count": 0,
  "active_children_count": 0,
  "journal_lines_count": 12,
  "draft_journal_entries_count": 0,
  "account_balances_count": 2,
  "has_nonzero_balance": true,
  "has_transactions": true,
  "budget_lines_count": 0,
  "allocation_rules_count": 0,
  "closing_rules_count": 0,
  "is_replacement_target": false,
  "can_delete": false,
  "can_deactivate": true
}
```

#### 4.4. Chuyển đổi trạng thái (Ngừng sử dụng / Kích hoạt lại)
- **Phương thức**: `POST /api/v1/general-ledger/accounts/{id}/change-status/?company_id={company_id}`
- **Quyền yêu cầu**: `MD.ACCOUNT.EDIT` hoặc `MD.ACCOUNT.DEACTIVATE`
- **Request Body (Ngừng sử dụng)**:
```json
{
  "new_status": "INACTIVE",
  "version": 1,
  "reason": "Tổ chức lại mô hình tài khoản chi tiết năm 2026",
  "end_date": "2026-10-05",
  "replacement_account_id": "7662c2f6-ee8e-4a6f-a886-0bf1f0629ec9"
}
```
- **Response** (`200 OK`): Trả về đối tượng tài khoản đã cập nhật trạng thái `INACTIVE`, `end_date`, `inactive_reason` và `version` tăng thêm 1.

#### 4.5. Tra cứu lịch sử & Audit Log (History)
- **Phương thức**: `GET /api/v1/general-ledger/accounts/{id}/history/?company_id={company_id}`
- **Quyền yêu cầu**: `MD.ACCOUNT.VIEW`
- **Response** (`200 OK`):
```json
[
  {
    "id": "e6f497dc-be59-450f-afc5-9271630c7e29",
    "action_code": "EDIT",
    "actor": "ke_toan_vien",
    "occurred_at": "2026-10-05T15:20:00+07:00",
    "before": {
      "name": "Tiền gửi ngân hàng cũ"
    },
    "after": {
      "name": "Tiền gửi ngân hàng VCB"
    },
    "reason": "Cập nhật tên giao dịch",
    "description": "Thao tác EDIT trên tài khoản 1121"
  }
]
```

#### 4.6. Xuất khẩu CSV (Export CSV)
- **Phương thức**: `GET /api/v1/general-ledger/accounts/export-csv/?company_id={company_id}`
- **Quyền yêu cầu**: `MD.ACCOUNT.EXPORT`
- **Response Header**: `Content-Type: text/csv; charset=utf-8` (kèm BOM UTF-8)

#### 4.7. Nhập khẩu CSV (Import CSV)
- **Phương thức**: `POST /api/v1/general-ledger/accounts/import-csv/?company_id={company_id}`
- **Quyền yêu cầu**: `MD.ACCOUNT.IMPORT`
- **Request**: Multipart Form với file `file` hoặc JSON với chuỗi `content`.
- **Cơ chế xử lý**: Toàn bộ thao tác chạy trong 1 Transaction nguyên tử (`transaction.atomic`). Nếu bất kỳ dòng nào bị lỗi mã cha không tồn tại, tạo chu trình vòng, hoặc sai bản chất, hệ thống từ chối toàn bộ và chỉ rõ số dòng lỗi.

---

### 5. KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST SUITE)

Tất cả 28 kịch bản kiểm thử tự động toàn diện được cài đặt trong `general_ledger/test_account_management.py`:
1. `test_view_without_permission_denied`: Kiểm tra chặn 403 khi thiếu quyền xem.
2. `test_view_with_permission_allowed`: Kiểm tra xem thành công khi có quyền.
3. `test_create_without_permission_denied`: Kiểm tra chặn 403 khi thiếu quyền tạo.
4. `test_create_with_permission_allowed`: Kiểm tra tạo thành công và tính toán `account_level`.
5. `test_init_from_template_tt200_full`: Khởi tạo Thông tư 200 đầy đủ, gán `is_system=True`, kiểm tra Dimension 131/331 và Audit Log.
6. `test_init_from_template_skips_existing_accounts`: Bổ sung tài khoản thiếu mà không làm đè tài khoản riêng (AF-01).
7. `test_init_from_template_essential_scope`: Khởi tạo mẫu rút gọn ESSENTIAL cho doanh nghiệp một người (AF-19, BR-COA-52).
8. `test_child_code_must_start_with_parent_code`: Bắt buộc số hiệu con phải bắt đầu bằng số hiệu cha (BR-COA-12).
9. `test_child_nature_must_match_parent_nature`: Bắt buộc bản chất con tương thích với cha (BR-COA-13, EF-09).
10. `test_child_under_inactive_parent_denied`: Không cho tạo con dưới tài khoản cha đã ngừng (EF-07).
11. `test_cycle_detection_denied`: Bắt lỗi khi tạo chu trình vòng trong cây tài khoản (BR-COA-10, EF-14).
12. `test_summary_account_with_active_children_cannot_be_postable`: Không cho phép tài khoản có con ACTIVE ghi sổ trực tiếp (BR-COA-14, EF-10).
13. `test_journal_entry_fails_when_required_dimension_missing`: Backend từ chối ghi sổ khi thiếu Dimension REQUIRED (BR-COA-22, 25, 45).
14. `test_journal_entry_succeeds_when_required_dimension_provided`: Ghi sổ thành công khi Dimension REQUIRED được cung cấp đầy đủ.
15. `test_system_account_core_attributes_protected`: Chặn sửa code, bản chất, số dư thông thường và xóa System Account (BR-COA-07, EF-15).
16. `test_account_with_transactions_cannot_change_code_or_delete`: Khóa mã và cấm xóa cứng khi đã có bút toán (BR-COA-36, 38, EF-16, 21).
17. `test_account_with_balances_cannot_change_nature`: Khóa bản chất tài khoản khi đã có số dư (EF-17).
18. `test_optimistic_locking_conflict`: Kiểm tra mã 409 Conflict khi sai version và tăng version tự động khi thành công (EF-24, BR-COA-58).
19. `test_deactivation_fails_if_active_children_exist`: Chặn ngừng sử dụng khi còn con ACTIVE (EF-18).
20. `test_deactivation_fails_if_draft_journals_exist`: Chặn ngừng sử dụng khi còn chứng từ Draft (EF-20).
21. `test_deactivation_and_reactivation_success`: Ngừng tài khoản hợp lệ và kích hoạt lại thành công (AF-16, Main Flow 2.4).
22. `test_tree_hierarchy_endpoint`: Trả về cây tài khoản lồng nhau chuẩn xác (Main Flow 2.2).
23. `test_impact_analysis_endpoint`: Trả về báo cáo tác động chi tiết (Main Flow 2.3).
24. `test_export_csv`: Xuất khẩu CSV có BOM UTF-8 đầy đủ cột dữ liệu (AF-18).
25. `test_import_csv_success`: Nhập khẩu CSV tạo tài khoản thành công theo thứ tự cha - con.
26. `test_import_csv_cycle_or_invalid_parent_fails_transactionally`: Nhập khẩu lỗi bị Rollback nguyên tử toàn bộ (BR-COA-50, EF-22, 23).
27. `test_history_endpoint_returns_audit_trail`: Kiểm tra lịch sử biến động có snapshot trước/sau từ `AuditChange`.
28. `test_master_data_accounts_alias_url`: Đường dẫn alias `/api/v1/master-data/accounts/` hoạt động hoàn hảo.
