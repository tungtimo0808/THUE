---
paths:
  - "backend/**/*.py"
---

# Quy tắc nghiệp vụ kế toán khi viết hoặc sửa code backend

1. Mọi bút toán hoàn chỉnh phải cân Nợ = Có, theo từng loại tiền nguyên tệ và theo quy đổi VND.
2. Chứng từ đã ghi sổ không được sửa/xóa trực tiếp. Điều chỉnh đi qua `general_ledger.services.adjust`, `reverse` hoặc `create_replacement_entry` và giữ liên kết với bút toán gốc.
3. Không ghi vào kỳ đã khóa. Kiểm tra kỳ ở tầng service, không chỉ ở serializer hay frontend.
4. Thao tác ghi sổ phải idempotent: gọi lại cùng thao tác không được sinh thêm bút toán hay chứng từ.
5. Số tiền dùng `Decimal`, không dùng `float`. Làm tròn theo quy tắc của loại tiền.
6. Thao tác sinh nhiều bản ghi kế toán (chứng từ + bút toán + sổ chi tiết) nằm trong một `transaction.atomic()`.
7. Số dư sổ chi tiết (công nợ, kho, quỹ, ngân hàng) phải khớp với số dư tài khoản tổng hợp tương ứng.
8. Tài khoản tổng hợp (có tài khoản con) không được hạch toán trực tiếp.
9. Hệ thống tài khoản và mẫu báo cáo phụ thuộc `AccountingPolicy.accounting_regime` và năm tài chính; không hardcode theo một thông tư.
10. Quy tắc thuế tách riêng quy tắc kế toán tài chính.
