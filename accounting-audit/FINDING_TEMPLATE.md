# Mẫu phát hiện audit

Mỗi phát hiện dùng đúng các mục sau. Mã theo agent: `ACC` kế toán, `BIZ` luồng nghiệp vụ, `DB` dữ liệu, `SEC` bảo mật, `CODE` chất lượng code, `QA` lộ ra từ test.

```markdown
### ACC-001 — <mô tả ngắn, một dòng>

| Trường | Giá trị |
|---|---|
| Phân hệ | sales |
| Mức độ | Critical / High / Medium / Low |
| Độ tin cậy | CONFIRMED / SUSPECTED / NEEDS_HUMAN_REVIEW |
| Trạng thái | OPEN / FIXED / VERIFIED / WONT_FIX |
| Vị trí | `backend/sales/goods_sale_services.py:123` (`post_goods_sale`) |
| Trùng với | BL-08 (nếu là phát hiện cũ) |

**Hiện trạng:** code đang làm gì (trích đoạn ngắn nếu cần).

**Mong đợi:** quy tắc đúng; nếu là quy định pháp lý, trích nguồn trong `accounting-audit/regulations/README.md`.

**Bằng chứng:** đường code `file:dòng → file:dòng`, lệnh đã chạy và kết quả, hoặc test.

**Tái hiện:** các bước (API, dữ liệu đầu vào) hoặc tên test trong `backend/audit_repro/`.

**Ảnh hưởng:** sai số liệu nào, ở báo cáo nào, ai bị ảnh hưởng.

**Đề xuất sửa:** hướng sửa, không viết patch.

**Tiêu chí xác minh:** điều kiện cụ thể để coi là đã sửa (vd. "test_acc_001 PASS và tổng 131 khớp sổ chi tiết công nợ").
```

## Mức độ
- **Critical** — sai số liệu sổ sách/báo cáo tài chính, lộ dữ liệu giữa các doanh nghiệp, mất dữ liệu kế toán.
- **High** — sai một nghiệp vụ chính, chặn luồng chính, ghi trùng, sửa được chứng từ đã ghi sổ.
- **Medium** — sai nhánh phụ, thiếu kiểm soát hoặc xử lý ngoại lệ.
- **Low** — nợ kiểm thử, tài liệu, khả năng bảo trì.
