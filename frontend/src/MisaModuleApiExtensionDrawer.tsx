import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Plus, Search, X, CheckCircle2, Layers } from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { createApiWriter, errorText } from "./misa-api-writes";

export type ApiEndpointField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select";
  options?: { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
};

export type ApiEndpointConfig = {
  id: string;
  label: string;
  path: string;
  description: string;
  columns: { key: string; label: string }[];
  createFields?: ApiEndpointField[];
  readOnly?: boolean;
};

export const MODULE_EXTENDED_APIS: Record<string, ApiEndpointConfig[]> = {
  purchases: [
    {
      id: "purchase-requests",
      label: "Đề nghị mua hàng",
      path: "/api/v1/purchases/purchase-requests/",
      description: "Quản lý phiếu đề nghị mua vật tư, hàng hóa, dịch vụ từ các phòng ban.",
      columns: [
        { key: "number", label: "Số đề nghị" },
        { key: "request_date", label: "Ngày đề nghị" },
        { key: "requester_name", label: "Người đề nghị" },
        { key: "description", label: "Diễn giải" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "number", label: "Số đề nghị", defaultValue: "DNM0001", required: true },
        { key: "request_date", label: "Ngày đề nghị", type: "date", defaultValue: "2026-12-20", required: true },
        { key: "requester_name", label: "Người đề nghị", defaultValue: "Phòng Kỹ thuật" },
        { key: "description", label: "Nội dung đề nghị", defaultValue: "Đề nghị mua bổ sung thiết bị mạng" },
      ],
    },
    {
      id: "purchase-receipts",
      label: "Phiếu nhận hàng mua",
      path: "/api/v1/purchases/receipts/",
      description: "Tiếp nhận hàng hóa từ nhà cung cấp trước khi lập chứng từ mua hàng.",
      columns: [
        { key: "number", label: "Số phiếu nhận" },
        { key: "receipt_date", label: "Ngày nhận" },
        { key: "notes", label: "Ghi chú" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "number", label: "Số phiếu nhận", defaultValue: "PNH0001", required: true },
        { key: "receipt_date", label: "Ngày nhận", type: "date", defaultValue: "2026-12-20", required: true },
        { key: "notes", label: "Ghi chú nhận hàng", defaultValue: "Đã kiểm đếm đủ số lượng" },
      ],
    },
    {
      id: "purchase-tracking",
      label: "Theo dõi tiến độ đơn mua",
      path: "/api/v1/purchases/tracking/",
      description: "Theo dõi tình trạng giao hàng và hóa đơn của các đơn mua hàng.",
      columns: [
        { key: "number", label: "Số đơn hàng" },
        { key: "order_date", label: "Ngày đặt" },
        { key: "total_amount", label: "Tổng tiền" },
        { key: "status", label: "Tiến độ" },
      ],
      readOnly: true,
    },
    {
      id: "purchase-reconciliations",
      label: "Đối chiếu chứng từ mua hàng",
      path: "/api/v1/purchases/reconciliations/",
      description: "Đối chiếu ba bên giữa Đơn mua hàng - Phiếu nhập kho - Hóa đơn nhà cung cấp.",
      columns: [
        { key: "number", label: "Số đối chiếu" },
        { key: "reconciliation_date", label: "Ngày đối chiếu" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "number", label: "Số đối chiếu", defaultValue: "DCMH0001", required: true },
        { key: "reconciliation_date", label: "Ngày đối chiếu", type: "date", defaultValue: "2026-12-25", required: true },
        { key: "notes", label: "Ghi chú", defaultValue: "Đối chiếu khớp đơn mua và hóa đơn" },
      ],
    },
    {
      id: "purchase-approvals",
      label: "Phê duyệt mua hàng",
      path: "/api/v1/purchases/approvals/",
      description: "Lịch sử phê duyệt hạn mức đơn mua hàng và chứng từ mua.",
      columns: [
        { key: "id", label: "Mã duyệt" },
        { key: "decision", label: "Quyết định" },
        { key: "comments", label: "Ý kiến" },
        { key: "decided_at", label: "Thời gian" },
      ],
      readOnly: true,
    },
    {
      id: "ap-payment-allocations",
      label: "Phân bổ thanh toán NCC",
      path: "/api/v1/accounts-payable/payment-allocations/",
      description: "Phân bổ chứng từ chi tiền trả nợ cho từng hóa đơn mua hàng của nhà cung cấp.",
      columns: [
        { key: "number", label: "Số chứng từ" },
        { key: "allocation_date", label: "Ngày phân bổ" },
        { key: "total_allocated_amount", label: "Số tiền phân bổ" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ap-debt-offsets",
      label: "Chứng từ bù trừ công nợ NCC",
      path: "/api/v1/accounts-payable/debt-offsets/",
      description: "Bù trừ công nợ giữa các khoản trả trước và hóa đơn phải trả nhà cung cấp.",
      columns: [
        { key: "number", label: "Số chứng từ" },
        { key: "offset_date", label: "Ngày bù trừ" },
        { key: "total_offset_amount", label: "Số tiền bù trừ" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ap-adjustment-vouchers",
      label: "Chứng từ điều chỉnh công nợ phải trả",
      path: "/api/v1/accounts-payable/adjustment-vouchers/",
      description: "Điều chỉnh tăng/giảm số dư công nợ nhà cung cấp.",
      columns: [
        { key: "number", label: "Số chứng từ" },
        { key: "adjustment_date", label: "Ngày điều chỉnh" },
        { key: "adjustment_amount", label: "Giá trị điều chỉnh" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ap-nettings",
      label: "Bù trừ công nợ hai chiều (AP Netting)",
      path: "/api/v1/accounts-payable/nettings/",
      description: "Bù trừ công nợ đối tượng vừa là khách hàng vừa là nhà cung cấp.",
      columns: [
        { key: "number", label: "Số bù trừ" },
        { key: "netting_date", label: "Ngày thực hiện" },
        { key: "netted_amount", label: "Số tiền bù trừ" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ap-adjustments",
      label: "Bút toán điều chỉnh phải trả",
      path: "/api/v1/accounts-payable/adjustments/",
      description: "Danh sách các khoản điều chỉnh công nợ phải trả chi tiết.",
      columns: [
        { key: "number", label: "Số hiệu" },
        { key: "adjustment_date", label: "Ngày" },
        { key: "amount", label: "Số tiền" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ap-due-payables",
      label: "Công nợ phải trả đến hạn & quá hạn",
      path: "/api/v1/accounts-payable/due-payables/",
      description: "Theo dõi các hóa đơn nhà cung cấp sắp đến hạn thanh toán hoặc đã quá hạn.",
      columns: [
        { key: "number", label: "Số hóa đơn/chứng từ" },
        { key: "due_date", label: "Hạn thanh toán" },
        { key: "remaining_amount", label: "Còn phải trả" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
    {
      id: "ap-tracking",
      label: "Theo dõi tuổi nợ nhà cung cấp",
      path: "/api/v1/accounts-payable/tracking/",
      description: "Tổng hợp công nợ phải trả theo nhà cung cấp và kỳ hạn nợ.",
      columns: [
        { key: "supplier_name", label: "Nhà cung cấp" },
        { key: "total_payable", label: "Tổng phải trả" },
        { key: "overdue_amount", label: "Nợ quá hạn" },
        { key: "status", label: "Tình trạng" },
      ],
      readOnly: true,
    },
    {
      id: "ap-approvals",
      label: "Phê duyệt công nợ phải trả",
      path: "/api/v1/accounts-payable/approvals/",
      description: "Lịch sử phê duyệt đề nghị thanh toán và điều chỉnh công nợ NCC.",
      columns: [
        { key: "id", label: "Mã phê duyệt" },
        { key: "decision", label: "Kết quả" },
        { key: "comments", label: "Ghi chú" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
  ],
  sales: [
    {
      id: "sales-deliveries",
      label: "Phiếu giao hàng bán",
      path: "/api/v1/sales/deliveries/",
      description: "Quản lý phiếu giao hàng và vận chuyển hàng bán cho khách hàng.",
      columns: [
        { key: "number", label: "Số phiếu giao" },
        { key: "delivery_date", label: "Ngày giao" },
        { key: "shipping_address", label: "Địa chỉ giao" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "number", label: "Số phiếu giao", defaultValue: "PGH0001", required: true },
        { key: "delivery_date", label: "Ngày giao hàng", type: "date", defaultValue: "2026-12-20", required: true },
        { key: "shipping_address", label: "Địa chỉ nhận hàng", defaultValue: "Cầu Giấy, Hà Nội" },
      ],
    },
    {
      id: "sales-invoice-requests",
      label: "Đề nghị xuất hóa đơn GTGT",
      path: "/api/v1/sales/invoice-requests/",
      description: "Đề nghị bộ phận kế toán thuế phát hành hóa đơn điện tử cho đơn bán hàng.",
      columns: [
        { key: "number", label: "Số đề nghị" },
        { key: "request_date", label: "Ngày đề nghị" },
        { key: "total_amount", label: "Tổng tiền" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "sales-tracking",
      label: "Theo dõi tiến độ đơn bán hàng",
      path: "/api/v1/sales/tracking/",
      description: "Theo dõi tình trạng giao hàng, xuất hóa đơn và thu tiền theo từng đơn đặt hàng.",
      columns: [
        { key: "number", label: "Số đơn hàng" },
        { key: "order_date", label: "Ngày đơn hàng" },
        { key: "total_amount", label: "Giá trị đơn" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
    {
      id: "sales-cogs",
      label: "Bút toán giá vốn hàng bán (COGS)",
      path: "/api/v1/sales/cogs/",
      description: "Tra cứu giá vốn hàng xuất bán tự động kết chuyển từ phân hệ Kho.",
      columns: [
        { key: "number", label: "Số chứng từ" },
        { key: "posting_date", label: "Ngày hạch toán" },
        { key: "total_cost", label: "Tổng giá vốn" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
    {
      id: "sales-links",
      label: "Liên kết chứng từ bán hàng",
      path: "/api/v1/sales/links/",
      description: "Chuỗi liên kết Báo giá -> Đơn hàng -> Chứng từ bán -> Hóa đơn -> Phiếu thu.",
      columns: [
        { key: "source_type", label: "Chứng từ gốc" },
        { key: "target_type", label: "Chứng từ đích" },
        { key: "link_type", label: "Loại liên kết" },
      ],
      readOnly: true,
    },
    {
      id: "sales-approvals",
      label: "Phê duyệt bán hàng & chiết khấu",
      path: "/api/v1/sales/approvals/",
      description: "Phê duyệt đơn hàng vượt hạn mức tín dụng hoặc vượt khung chiết khấu.",
      columns: [
        { key: "id", label: "Mã duyệt" },
        { key: "decision", label: "Quyết định" },
        { key: "comments", label: "Ý kiến" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
    {
      id: "ar-credit-policies",
      label: "Chính sách tín dụng khách hàng",
      path: "/api/v1/accounts-receivable/credit-policies/",
      description: "Thiết lập hạn mức nợ tối đa và số ngày nợ cho phép theo từng nhóm khách hàng.",
      columns: [
        { key: "code", label: "Mã chính sách" },
        { key: "name", label: "Tên chính sách" },
        { key: "credit_limit", label: "Hạn mức nợ (VND)" },
        { key: "payment_term_days", label: "Số ngày nợ" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "code", label: "Mã chính sách", defaultValue: "CS-VIP", required: true },
        { key: "name", label: "Tên chính sách", defaultValue: "Khách hàng chiến lược VIP", required: true },
        { key: "credit_limit", label: "Hạn mức tín dụng", type: "number", defaultValue: "500000000" },
        { key: "payment_term_days", label: "Hạn nợ (ngày)", type: "number", defaultValue: "30" },
      ],
    },
    {
      id: "ar-collection-plans",
      label: "Kế hoạch thu hồi công nợ",
      path: "/api/v1/accounts-receivable/collection-plans/",
      description: "Lập kế hoạch thu nợ dự kiến theo từng kỳ và nhân viên kinh doanh phụ trách.",
      columns: [
        { key: "number", label: "Mã kế hoạch" },
        { key: "plan_date", label: "Ngày dự kiến" },
        { key: "expected_amount", label: "Số tiền dự kiến thu" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ar-receipts",
      label: "Chứng từ thu nợ khách hàng",
      path: "/api/v1/accounts-receivable/receipts/",
      description: "Danh sách chứng từ thu tiền công nợ khách hàng.",
      columns: [
        { key: "number", label: "Số phiếu" },
        { key: "receipt_date", label: "Ngày thu" },
        { key: "amount", label: "Số tiền thu" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ar-allocation-vouchers",
      label: "Phân bổ tiền thu khách hàng",
      path: "/api/v1/accounts-receivable/allocation-vouchers/",
      description: "Ghép và phân bổ các khoản thu tiền vào từng hóa đơn bán hàng còn nợ.",
      columns: [
        { key: "number", label: "Số phân bổ" },
        { key: "allocation_date", label: "Ngày phân bổ" },
        { key: "total_allocated_amount", label: "Tổng phân bổ" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ar-debt-netting-vouchers",
      label: "Chứng từ bù trừ công nợ phải thu",
      path: "/api/v1/accounts-receivable/debt-netting-vouchers/",
      description: "Bù trừ giữa khoản khách hàng ứng trước và phải thu hóa đơn.",
      columns: [
        { key: "number", label: "Số chứng từ" },
        { key: "netting_date", label: "Ngày bù trừ" },
        { key: "total_netted_amount", label: "Số tiền bù trừ" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ar-debt-adjustment-vouchers",
      label: "Chứng từ điều chỉnh công nợ phải thu",
      path: "/api/v1/accounts-receivable/debt-adjustment-vouchers/",
      description: "Điều chỉnh số dư công nợ khách hàng do sai lệch hoặc xử lý nợ.",
      columns: [
        { key: "number", label: "Số chứng từ" },
        { key: "adjustment_date", label: "Ngày điều chỉnh" },
        { key: "adjustment_amount", label: "Số tiền điều chỉnh" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ar-debt-reconciliations",
      label: "Biên bản đối chiếu công nợ KH",
      path: "/api/v1/accounts-receivable/debt-reconciliations/",
      description: "Biên bản đối chiếu và xác nhận số dư công nợ định kỳ với khách hàng.",
      columns: [
        { key: "number", label: "Số biên bản" },
        { key: "reconciliation_date", label: "Ngày đối chiếu" },
        { key: "closing_balance", label: "Số dư cuối kỳ" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ar-nettings",
      label: "Bù trừ công nợ AR",
      path: "/api/v1/accounts-receivable/nettings/",
      description: "Danh sách giao dịch bù trừ công nợ khách hàng.",
      columns: [
        { key: "number", label: "Số hiệu" },
        { key: "netting_date", label: "Ngày" },
        { key: "netted_amount", label: "Số tiền" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ar-confirmations",
      label: "Thư xác nhận công nợ khách hàng",
      path: "/api/v1/accounts-receivable/confirmations/",
      description: "Theo dõi phản hồi thư xác nhận số dư công nợ từ phía khách hàng.",
      columns: [
        { key: "number", label: "Số thư xác nhận" },
        { key: "confirmation_date", label: "Ngày gửi" },
        { key: "confirmed_balance", label: "Số dư xác nhận" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ar-adjustments",
      label: "Bút toán điều chỉnh phải thu",
      path: "/api/v1/accounts-receivable/adjustments/",
      description: "Các bút toán điều chỉnh công nợ phải thu.",
      columns: [
        { key: "number", label: "Số hiệu" },
        { key: "adjustment_date", label: "Ngày" },
        { key: "amount", label: "Số tiền" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ar-due-tracking",
      label: "Theo dõi công nợ sắp đến hạn",
      path: "/api/v1/accounts-receivable/due-tracking/",
      description: "Cảnh báo các khoản phải thu khách hàng sắp đến hạn hoặc quá hạn.",
      columns: [
        { key: "number", label: "Số chứng từ" },
        { key: "due_date", label: "Ngày đáo hạn" },
        { key: "remaining_amount", label: "Số còn phải thu" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
    {
      id: "ar-customer-due-debts",
      label: "Chi tiết tuổi nợ khách hàng",
      path: "/api/v1/accounts-receivable/customer-due-debts/",
      description: "Phân tích tuổi nợ khách hàng theo khung 1-30 ngày, 31-60 ngày, >90 ngày.",
      columns: [
        { key: "number", label: "Số hóa đơn" },
        { key: "due_date", label: "Hạn thanh toán" },
        { key: "remaining_amount", label: "Dư nợ" },
        { key: "status", label: "Tình trạng" },
      ],
      readOnly: true,
    },
    {
      id: "ar-payment-reminders",
      label: "Lịch nhắc nợ tự động",
      path: "/api/v1/accounts-receivable/payment-reminders/",
      description: "Quản lý lịch gửi thông báo nhắc nợ cho khách hàng.",
      columns: [
        { key: "number", label: "Mã nhắc nợ" },
        { key: "reminder_date", label: "Ngày gửi" },
        { key: "channel", label: "Kênh gửi" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ar-customer-payment-reminders",
      label: "Thư nhắc nợ khách hàng",
      path: "/api/v1/accounts-receivable/customer-payment-reminders/",
      description: "Danh sách thư nhắc nợ đã phát hành gửi khách hàng quá hạn.",
      columns: [
        { key: "number", label: "Số thông báo" },
        { key: "reminder_date", label: "Ngày phát hành" },
        { key: "overdue_amount", label: "Số nợ quá hạn" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "ar-approvals",
      label: "Phê duyệt công nợ phải thu",
      path: "/api/v1/accounts-receivable/approvals/",
      description: "Lịch sử phê duyệt xóa nợ, điều chỉnh nợ và hạn mức tín dụng.",
      columns: [
        { key: "id", label: "Mã phê duyệt" },
        { key: "decision", label: "Quyết định" },
        { key: "comments", label: "Nội dung" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
  ],
  cash: [
    {
      id: "cash-settlements",
      label: "Quyết toán tạm ứng tiền mặt",
      path: "/api/v1/cash/settlements/",
      description: "Theo dõi và quyết toán các khoản tạm ứng nhân viên bằng tiền mặt.",
      columns: [
        { key: "number", label: "Số quyết toán" },
        { key: "settlement_date", label: "Ngày quyết toán" },
        { key: "settled_amount", label: "Số tiền quyết toán" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "number", label: "Số chứng từ quyết toán", defaultValue: "QTTU0001", required: true },
        { key: "settlement_date", label: "Ngày quyết toán", type: "date", defaultValue: "2026-12-20", required: true },
        { key: "settled_amount", label: "Số tiền quyết toán", type: "number", defaultValue: "2300000" },
        { key: "notes", label: "Diễn giải", defaultValue: "Quyết toán tạm ứng công tác phí" },
      ],
    },
    {
      id: "cash-revaluations",
      label: "Đánh giá lại ngoại tệ tồn quỹ",
      path: "/api/v1/cash/revaluations/",
      description: "Đánh giá chênh lệch tỷ giá ngoại tệ tại quỹ tiền mặt cuối kỳ kế toán.",
      columns: [
        { key: "number", label: "Số chứng từ" },
        { key: "revaluation_date", label: "Ngày đánh giá" },
        { key: "difference_amount", label: "Chênh lệch tỷ giá" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "cash-approvals",
      label: "Phê duyệt chứng từ tiền mặt",
      path: "/api/v1/cash/approvals/",
      description: "Danh sách phê duyệt phiếu thu, phiếu chi và kiểm kê quỹ.",
      columns: [
        { key: "id", label: "Mã duyệt" },
        { key: "decision", label: "Quyết định" },
        { key: "comments", label: "Ghi chú" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
  ],
  bank: [
    {
      id: "bank-integrations",
      label: "Kết nối Ngân hàng điện tử (eBanking)",
      path: "/api/v1/bank/integrations/",
      description: "Quản lý kết nối API trực tiếp với ngân hàng để đồng bộ sao kê và lệnh chi.",
      columns: [
        { key: "provider_name", label: "Ngân hàng" },
        { key: "account_number", label: "Số tài khoản" },
        { key: "connection_status", label: "Trạng thái kết nối" },
        { key: "last_synced_at", label: "Đồng bộ gần nhất" },
      ],
      createFields: [
        { key: "provider_name", label: "Tên ngân hàng", defaultValue: "Techcombank", required: true },
        { key: "account_number", label: "Số tài khoản kết nối", defaultValue: "1903888999001", required: true },
        { key: "connection_status", label: "Trạng thái", defaultValue: "ACTIVE" },
      ],
    },
    {
      id: "bank-revaluations",
      label: "Đánh giá lại ngoại tệ ngân hàng",
      path: "/api/v1/bank/revaluations/",
      description: "Đánh giá lại số dư tiền gửi ngân hàng có gốc ngoại tệ cuối kỳ.",
      columns: [
        { key: "number", label: "Số chứng từ" },
        { key: "revaluation_date", label: "Ngày đánh giá" },
        { key: "difference_amount", label: "Chênh lệch tỷ giá" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "bank-approvals",
      label: "Phê duyệt lệnh chi ngân hàng",
      path: "/api/v1/bank/approvals/",
      description: "Phê duyệt ủy nhiệm chi và chuyển tiền nội bộ.",
      columns: [
        { key: "id", label: "Mã phê duyệt" },
        { key: "decision", label: "Quyết định" },
        { key: "comments", label: "Ý kiến" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
  ],
  inventory: [
    {
      id: "inventory-policies",
      label: "Chính sách & Phương pháp tính giá kho",
      path: "/api/v1/inventory/policies/",
      description: "Thiết lập phương pháp tính giá xuất kho (Bình quân cuối kỳ, Bình quân tức thời, FIFO, Thực tế đích danh).",
      columns: [
        { key: "costing_method", label: "Phương pháp tính giá" },
        { key: "allow_negative_stock", label: "Cho phép xuất quá tồn" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        {
          key: "costing_method",
          label: "Phương pháp tính giá",
          type: "select",
          defaultValue: "WEIGHTED_AVERAGE_PERIODIC",
          options: [
            { value: "WEIGHTED_AVERAGE_PERIODIC", label: "Bình quân cuối kỳ" },
            { value: "WEIGHTED_AVERAGE_PERPETUAL", label: "Bình quân tức thời" },
            { value: "FIFO", label: "Nhập trước xuất trước (FIFO)" },
            { value: "SPECIFIC_IDENTIFICATION", label: "Thực tế đích danh" },
          ],
        },
      ],
    },
    {
      id: "inventory-lot-serials",
      label: "Số lô, Hạn dùng & Serial hàng hóa",
      path: "/api/v1/inventory/lot-serials/",
      description: "Theo dõi tồn kho chi tiết theo Số lô (Lot), Hạn sử dụng (Expiry Date) và Số Serial/IMEI.",
      columns: [
        { key: "lot_number", label: "Số lô / Serial" },
        { key: "manufacture_date", label: "Ngày sản xuất" },
        { key: "expiry_date", label: "Hạn sử dụng" },
        { key: "quantity", label: "Số lượng tồn" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "lot_number", label: "Số lô / Serial", defaultValue: "LOT-202612-01", required: true },
        { key: "expiry_date", label: "Hạn sử dụng", type: "date", defaultValue: "2028-12-31" },
      ],
    },
    {
      id: "inventory-movements",
      label: "Sổ chi tiết biến động vật tư hàng hóa",
      path: "/api/v1/inventory/movements/",
      description: "Nhật ký từng dòng biến động nhập - xuất - chuyển kho phát sinh trong kỳ.",
      columns: [
        { key: "movement_date", label: "Ngày ghi sổ" },
        { key: "movement_type", label: "Loại biến động" },
        { key: "quantity", label: "Số lượng" },
        { key: "unit_cost", label: "Đơn giá vốn" },
        { key: "total_cost", label: "Thành tiền" },
      ],
      readOnly: true,
    },
    {
      id: "inventory-valuations",
      label: "Kỳ tính giá xuất kho",
      path: "/api/v1/inventory/valuations/",
      description: "Lịch sử các lần chạy tính giá xuất kho tự động theo kỳ kế toán.",
      columns: [
        { key: "number", label: "Mã lần tính" },
        { key: "valuation_date", label: "Ngày tính giá" },
        { key: "method", label: "Phương pháp" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "number", label: "Mã kỳ tính giá", defaultValue: "TGXK-202612", required: true },
        { key: "valuation_date", label: "Ngày tính giá", type: "date", defaultValue: "2026-12-31", required: true },
      ],
    },
    {
      id: "inventory-approvals",
      label: "Phê duyệt chứng từ kho",
      path: "/api/v1/inventory/approvals/",
      description: "Lịch sử phê duyệt phiếu nhập kho, xuất kho và biên bản kiểm kê kho.",
      columns: [
        { key: "id", label: "Mã phê duyệt" },
        { key: "decision", label: "Quyết định" },
        { key: "comments", label: "Ghi chú" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
  ],
  assets: [
    {
      id: "fixed-assets-approvals",
      label: "Phê duyệt nghiệp vụ Tài sản cố định",
      path: "/api/v1/fixed-assets/approvals/",
      description: "Phê duyệt ghi tăng, đánh giá lại, điều chuyển và thanh lý TSCĐ.",
      columns: [
        { key: "id", label: "Mã phê duyệt" },
        { key: "decision", label: "Quyết định" },
        { key: "comments", label: "Nội dung" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
  ],
  ledger: [
    {
      id: "gl-account-classes",
      label: "Loại tài khoản kế toán (TT99/TT200)",
      path: "/api/v1/general-ledger/account-classes/",
      description: "Phân loại nhóm tài khoản (Tài sản, Nợ phải trả, Vốn chủ sở hữu, Doanh thu, Chi phí).",
      columns: [
        { key: "code", label: "Mã loại" },
        { key: "name", label: "Tên loại tài khoản" },
        { key: "normal_balance", label: "Tính chất số dư" },
      ],
    },
    {
      id: "gl-charts-of-accounts",
      label: "Hệ thống tài khoản kế toán",
      path: "/api/v1/general-ledger/charts-of-accounts/",
      description: "Danh mục biểu đồ tài khoản áp dụng theo chế độ kế toán doanh nghiệp.",
      columns: [
        { key: "code", label: "Mã hệ thống TK" },
        { key: "name", label: "Tên hệ thống tài khoản" },
        { key: "accounting_regime", label: "Chế độ kế toán" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "gl-closing-rules",
      label: "Quy tắc kết chuyển lãi lỗ tự động",
      path: "/api/v1/general-ledger/closing-rules/",
      description: "Thiết lập thứ tự và cặp tài khoản kết chuyển doanh thu, chi phí sang TK 911, 421.",
      columns: [
        { key: "sequence", label: "Thứ tự" },
        { key: "name", label: "Tên bút toán kết chuyển" },
        { key: "source_account_code", label: "TK Kết chuyển đi" },
        { key: "target_account_code", label: "TK Kết chuyển đến" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "name", label: "Tên bút toán kết chuyển", defaultValue: "Kết chuyển doanh thu bán hàng sang 911", required: true },
        { key: "source_account_code", label: "TK nguồn", defaultValue: "511", required: true },
        { key: "target_account_code", label: "TK đích", defaultValue: "911", required: true },
        { key: "sequence", label: "Thứ tự thực hiện", type: "number", defaultValue: "1" },
      ],
    },
    {
      id: "gl-reconciliations",
      label: "Đối chiếu Sổ cái & Sổ chi tiết",
      path: "/api/v1/general-ledger/reconciliations/",
      description: "Kiểm tra và đối chiếu số liệu giữa Sổ cái tổng hợp và các phân hệ chi tiết (Tiền, Kho, Công nợ, TSCĐ).",
      columns: [
        { key: "number", label: "Mã lần đối chiếu" },
        { key: "reconciliation_date", label: "Ngày đối chiếu" },
        { key: "difference_amount", label: "Chênh lệch" },
        { key: "status", label: "Kết quả" },
      ],
    },
    {
      id: "gl-budgets",
      label: "Dự toán Ngân sách Tổng hợp",
      path: "/api/v1/general-ledger/budgets/",
      description: "Quản lý kế hoạch ngân sách doanh thu - chi phí theo kỳ kế toán.",
      columns: [
        { key: "code", label: "Mã ngân sách" },
        { key: "name", label: "Tên kỳ ngân sách" },
        { key: "fiscal_year", label: "Năm tài chính" },
        { key: "total_amount", label: "Tổng hạn mức" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "code", label: "Mã ngân sách", defaultValue: "NS-2026-Q4", required: true },
        { key: "name", label: "Tên dự toán ngân sách", defaultValue: "Dự toán chi phí hoạt động Quý 4/2026", required: true },
        { key: "fiscal_year", label: "Năm tài chính", type: "number", defaultValue: "2026" },
      ],
    },
    {
      id: "gl-approvals",
      label: "Phê duyệt chứng từ nghiệp vụ khác",
      path: "/api/v1/general-ledger/approvals/",
      description: "Phê duyệt chứng từ nghiệp vụ khác và bút toán kết chuyển cuối kỳ.",
      columns: [
        { key: "id", label: "Mã phê duyệt" },
        { key: "decision", label: "Quyết định" },
        { key: "comments", label: "Ý kiến" },
        { key: "status", label: "Trạng thái" },
      ],
      readOnly: true,
    },
  ],
  tax: [
    {
      id: "tax-summaries",
      label: "Bảng tổng hợp nghĩa vụ thuế",
      path: "/api/v1/tax/summaries/",
      description: "Tổng hợp số thuế GTGT đầu ra, đầu vào được khấu trừ và số thuế phải nộp trong kỳ.",
      columns: [
        { key: "period_code", label: "Kỳ tính thuế" },
        { key: "tax_type", label: "Sắc thuế" },
        { key: "output_tax", label: "Thuế đầu ra" },
        { key: "input_tax", label: "Thuế đầu vào" },
        { key: "payable_tax", label: "Thuế phải nộp" },
      ],
    },
    {
      id: "tax-reconciliations",
      label: "Đối chiếu Tờ khai thuế & Sổ cái",
      path: "/api/v1/tax/reconciliations/",
      description: "Kiểm tra chênh lệch giữa bảng kê hóa đơn trên tờ khai 01/GTGT và số dư TK 1331, 33311.",
      columns: [
        { key: "number", label: "Số đối chiếu" },
        { key: "reconciliation_date", label: "Ngày đối chiếu" },
        { key: "difference_amount", label: "Chênh lệch" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "tax-document-links",
      label: "Liên kết Chứng từ & Hóa đơn thuế",
      path: "/api/v1/tax/document-links/",
      description: "Tra cứu mối liên kết giữa chứng từ hạch toán và hóa đơn kê khai thuế.",
      columns: [
        { key: "document_number", label: "Số chứng từ" },
        { key: "invoice_number", label: "Số hóa đơn" },
        { key: "tax_amount", label: "Tiền thuế" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "tax-connectors",
      label: "Cổng kết nối Hóa đơn điện tử & Thuế",
      path: "/api/v1/tax/connectors/",
      description: "Cấu hình kết nối MISA meInvoice, Viettel SInvoice, VNPT Invoice và Cổng Thuế điện tử.",
      columns: [
        { key: "provider", label: "Nhà cung cấp" },
        { key: "tax_code", label: "Mã số thuế" },
        { key: "status", label: "Trạng thái kết nối" },
      ],
      createFields: [
        { key: "provider", label: "Nhà cung cấp HĐĐT", defaultValue: "MISA meInvoice", required: true },
        { key: "tax_code", label: "Mã số thuế DN", defaultValue: "109876543", required: true },
      ],
    },
    {
      id: "tax-integrations",
      label: "Đồng bộ dữ liệu Tổng cục Thuế",
      path: "/api/v1/tax/integrations/",
      description: "Lịch sử đồng bộ hóa đơn mua vào/bán ra từ hệ thống Hóa đơn điện tử Tổng cục Thuế.",
      columns: [
        { key: "provider_name", label: "Cổng kết nối" },
        { key: "last_sync_at", label: "Thời gian đồng bộ" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "tax-exports",
      label: "Lịch sử kết xuất XML HTKK / Excel",
      path: "/api/v1/tax/exports/",
      description: "Danh sách các tệp tờ khai thuế đã kết xuất định dạng XML chuẩn Tổng cục Thuế và Excel.",
      columns: [
        { key: "file_name", label: "Tên tệp kết xuất" },
        { key: "export_format", label: "Định dạng" },
        { key: "created_at", label: "Thời gian xuất" },
        { key: "status", label: "Trạng thái" },
      ],
    },
  ],
  reports: [
    {
      id: "report-definitions",
      label: "Danh mục biểu mẫu Báo cáo (TT99/TT200)",
      path: "/api/v1/reports/definitions/",
      description: "Cấu hình danh sách các biểu mẫu Báo cáo tài chính và Báo cáo quản trị trên hệ thống.",
      columns: [
        { key: "code", label: "Mã biểu mẫu" },
        { key: "name", label: "Tên báo cáo" },
        { key: "category", label: "Nhóm báo cáo" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "report-line-mappings",
      label: "Thiết lập công thức chỉ tiêu BCTC",
      path: "/api/v1/reports/line-mappings/",
      description: "Thiết lập công thức lấy số liệu từng mã chỉ tiêu trên Bảng cân đối kế toán, KQKD, Lưu chuyển tiền tệ.",
      columns: [
        { key: "line_code", label: "Mã số chỉ tiêu" },
        { key: "line_name", label: "Tên chỉ tiêu" },
        { key: "account_filter", label: "Tài khoản lấy số liệu" },
        { key: "formula", label: "Công thức" },
      ],
    },
    {
      id: "report-exports",
      label: "Lịch sử kết xuất Báo cáo tài chính",
      path: "/api/v1/reports/exports/",
      description: "Nhật ký kết xuất báo cáo tài chính ra PDF, Excel, XML.",
      columns: [
        { key: "report_code", label: "Mã báo cáo" },
        { key: "export_format", label: "Định dạng" },
        { key: "created_at", label: "Ngày xuất" },
        { key: "status", label: "Trạng thái" },
      ],
    },
  ],
  directory: [
    {
      id: "md-exchange-rate-types",
      label: "Loại tỷ giá ngoại tệ",
      path: "/api/v1/master-data/exchange-rate-types/",
      description: "Danh mục loại tỷ giá (Tỷ giá mua chuyển khoản, Tỷ giá bán, Tỷ giá hạch toán).",
      columns: [
        { key: "code", label: "Mã loại tỷ giá" },
        { key: "name", label: "Tên loại tỷ giá" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "code", label: "Mã loại tỷ giá", defaultValue: "TG-TCB", required: true },
        { key: "name", label: "Tên loại tỷ giá", defaultValue: "Tỷ giá giao dịch Techcombank", required: true },
      ],
    },
    {
      id: "md-exchange-rates",
      label: "Bảng tỷ giá ngoại tệ theo ngày",
      path: "/api/v1/master-data/exchange-rates/",
      description: "Cập nhật tỷ giá quy đổi giữa các ngoại tệ (USD, EUR, JPY) và đồng tiền hạch toán VND.",
      columns: [
        { key: "effective_date", label: "Ngày hiệu lực" },
        { key: "rate", label: "Tỷ giá quy đổi" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "md-customer-profiles",
      label: "Hồ sơ tín dụng & Phân hạng khách hàng",
      path: "/api/v1/master-data/customer-profiles/",
      description: "Thông tin mở rộng về xếp hạng tín dụng, hạn mức nợ và điều khoản thương mại của khách hàng.",
      columns: [
        { key: "customer_code", label: "Mã KH" },
        { key: "credit_rating", label: "Xếp hạng tín dụng" },
        { key: "credit_limit", label: "Hạn mức nợ" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "md-inventory-locations",
      label: "Vị trí lưu kho (Bin / Kệ / Dãy)",
      path: "/api/v1/master-data/inventory-locations/",
      description: "Danh mục vị trí ô kệ chi tiết bên trong từng kho hàng.",
      columns: [
        { key: "code", label: "Mã vị trí" },
        { key: "name", label: "Tên vị trí / Kệ" },
        { key: "aisle", label: "Dãy" },
        { key: "rack", label: "Kệ" },
        { key: "status", label: "Trạng thái" },
      ],
      createFields: [
        { key: "code", label: "Mã vị trí", defaultValue: "KE-A01", required: true },
        { key: "name", label: "Tên vị trí", defaultValue: "Kệ A01 - Tầng 1 Kho Hàng hóa", required: true },
      ],
    },
    {
      id: "md-document-numbering-rules",
      label: "Quy tắc đánh số chứng từ tự động",
      path: "/api/v1/master-data/document-numbering-rules/",
      description: "Thiết lập tiền tố (Prefix), độ dài phần số và hậu tố tự động cho từng loại chứng từ.",
      columns: [
        { key: "document_type_code", label: "Loại chứng từ" },
        { key: "prefix", label: "Tiền tố" },
        { key: "padding_length", label: "Độ dài số" },
        { key: "next_number", label: "Số tiếp theo" },
      ],
      createFields: [
        { key: "prefix", label: "Tiền tố chứng từ", defaultValue: "PT", required: true },
        { key: "padding_length", label: "Độ dài phần số", type: "number", defaultValue: "5" },
        { key: "next_number", label: "Số bắt đầu", type: "number", defaultValue: "1" },
      ],
    },
    {
      id: "md-catalog-imports",
      label: "Lịch sử nhập khẩu danh mục Excel",
      path: "/api/v1/master-data/catalog-imports/",
      description: "Theo dõi các phiên import hàng loạt danh mục Khách hàng, NCC, Vật tư hàng hóa từ tệp Excel.",
      columns: [
        { key: "catalog_type", label: "Loại danh mục" },
        { key: "file_name", label: "Tên tệp" },
        { key: "imported_rows", label: "Số dòng hợp lệ" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "md-catalog-exports",
      label: "Lịch sử kết xuất danh mục Excel",
      path: "/api/v1/master-data/catalog-exports/",
      description: "Theo dõi các phiên tải xuống danh mục hệ thống ra tệp Excel/CSV.",
      columns: [
        { key: "catalog_type", label: "Loại danh mục" },
        { key: "export_format", label: "Định dạng" },
        { key: "status", label: "Trạng thái" },
      ],
    },
  ],
  iam_system: [
    {
      id: "org-employee-assignments",
      label: "Phân công công việc & Bổ nhiệm nhân sự",
      path: "/api/v1/organization/employee-assignments/",
      description: "Quản lý lịch sử phân công phòng ban, chi nhánh và chức danh kiêm nhiệm của nhân sự.",
      columns: [
        { key: "employee_name", label: "Nhân viên" },
        { key: "department_name", label: "Phòng ban" },
        { key: "position_name", label: "Chức danh" },
        { key: "effective_from", label: "Ngày hiệu lực" },
        { key: "status", label: "Trạng thái" },
      ],
    },
    {
      id: "iam-permission-resources",
      label: "Tài nguyên phân quyền hệ thống",
      path: "/api/v1/iam/permission-resources/",
      description: "Danh mục các đối tượng tài nguyên (Chứng từ, Sổ sách, Danh mục, Báo cáo) chịu sự kiểm soát quyền.",
      columns: [
        { key: "code", label: "Mã tài nguyên" },
        { key: "name", label: "Tên tài nguyên" },
        { key: "module_code", label: "Phân hệ" },
      ],
      readOnly: true,
    },
    {
      id: "iam-permission-actions",
      label: "Hành động phân quyền (Actions)",
      path: "/api/v1/iam/permission-actions/",
      description: "Danh mục các thao tác nghiệp vụ (Xem, Thêm, Sửa, Xóa, Duyệt, Ghi sổ, Bỏ ghi, Kết xuất).",
      columns: [
        { key: "code", label: "Mã hành động" },
        { key: "name", label: "Tên hành động" },
        { key: "description", label: "Mô tả" },
      ],
      readOnly: true,
    },
    {
      id: "iam-permission-bundles",
      label: "Gói quyền mẫu (Permission Bundles)",
      path: "/api/v1/iam/permission-bundles/",
      description: "Các gói quyền nghiệp vụ đóng gói sẵn theo vị trí kế toán.",
      columns: [
        { key: "code", label: "Mã gói quyền" },
        { key: "name", label: "Tên gói quyền" },
        { key: "description", label: "Mô tả" },
      ],
    },
    {
      id: "iam-role-permissions",
      label: "Chi tiết quyền gán theo vai trò",
      path: "/api/v1/iam/role-permissions/",
      description: "Bảng ánh xạ trực tiếp giữa từng Vai trò (Role) và Quyền hạn (Permission).",
      columns: [
        { key: "role_code", label: "Vai trò" },
        { key: "permission_code", label: "Mã quyền" },
        { key: "effect", label: "Hiệu lực" },
      ],
      readOnly: true,
    },
    {
      id: "iam-role-permission-bundles",
      label: "Gán gói quyền cho vai trò",
      path: "/api/v1/iam/role-permission-bundles/",
      description: "Danh sách các gói quyền mẫu được đính kèm vào từng vai trò trong công ty.",
      columns: [
        { key: "role_code", label: "Vai trò" },
        { key: "bundle_code", label: "Gói quyền" },
      ],
      readOnly: true,
    },
    {
      id: "iam-effective-permissions",
      label: "Quyền hiệu lực thực tế (Effective Permissions)",
      path: "/api/v1/iam/effective-permissions/",
      description: "Tra cứu tập quyền hợp nhất cuối cùng của từng thành viên trong doanh nghiệp.",
      columns: [
        { key: "user_email", label: "Tài khoản" },
        { key: "permission_code", label: "Mã quyền" },
        { key: "source", label: "Nguồn cấp" },
      ],
      readOnly: true,
    },
  ],
};

function formatCellValue(val: any): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Có" : "Không";
  if (typeof val === "number") return val.toLocaleString("vi-VN");
  if (typeof val === "string" && /^\d+(\.\d+)?$/.test(val) && val.length > 3 && !val.startsWith("0")) {
    const num = Number(val);
    if (Number.isFinite(num) && num >= 1000) return num.toLocaleString("vi-VN");
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export function MisaModuleApiExtensionPanel({
  moduleKey,
  companyId,
  notify,
  initialEndpointId,
  onClose,
}: {
  moduleKey: keyof typeof MODULE_EXTENDED_APIS;
  companyId: string;
  notify: (msg: string) => void;
  initialEndpointId?: string;
  onClose?: () => void;
}) {
  const endpoints = MODULE_EXTENDED_APIS[moduleKey] || [];
  const [activeId, setActiveId] = useState(initialEndpointId || endpoints[0]?.id || "");
  const activeEndpoint = useMemo(
    () => endpoints.find((e) => e.id === activeId) || endpoints[0],
    [endpoints, activeId]
  );

  const { token } = useApiSession();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadEndpointData = async (ep: ApiEndpointConfig | undefined) => {
    if (!ep) return;
    if (!token || !companyId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const writer = createApiWriter(companyId, (path, init) => request(path, token, init));
      const data = await writer.get<any>(ep.path);
      const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : data ? [data] : [];
      setRows(list);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEndpointData(activeEndpoint);
    if (activeEndpoint?.createFields) {
      const defaults: Record<string, string> = {};
      for (const f of activeEndpoint.createFields) {
        defaults[f.key] = f.defaultValue || "";
      }
      setFormValues(defaults);
    }
  }, [activeEndpoint?.id, companyId, token]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [rows, searchQuery]);

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEndpoint) return;
    if (!token || !companyId) {
      notify(`Đã ghi nhận bản ghi mẫu cho "${activeEndpoint.label}" (chế độ xem trước).`);
      setRows((prev) => [{ id: `local-${Date.now()}`, ...formValues, status: "DRAFT" }, ...prev]);
      setShowCreateModal(false);
      return;
    }
    setSaving(true);
    try {
      const writer = createApiWriter(companyId, (path, init) => request(path, token, init));
      await writer.post(activeEndpoint.path, formValues);
      notify(`Đã lưu dữ liệu mới vào ${activeEndpoint.label} (${activeEndpoint.path})!`);
      setShowCreateModal(false);
      await loadEndpointData(activeEndpoint);
    } catch (err) {
      notify(`Lỗi khi lưu vào ${activeEndpoint.label}: ${errorText(err)}`);
    } finally {
      setSaving(false);
    }
  };

  if (!activeEndpoint) return null;

  return (
    <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", minHeight: 520, boxShadow: "0 4px 16px rgba(15, 23, 42, 0.06)" }}>
      {/* Header */}
      <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "#dcfce7", color: "#15803d", display: "grid", placeItems: "center" }}>
            <Layers size={17} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              <span>Nghiệp vụ & Dữ liệu API Chuyên sâu</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#15803d", background: "#dcfce7", padding: "2px 8px", borderRadius: 999 }}>
                {endpoints.length} API đã kết nối
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Đầu cuối hiện tại: <code style={{ color: "#0284c7", fontWeight: 600 }}>{activeEndpoint.path}</code>
            </div>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", display: "grid", placeItems: "center", color: "#475569" }}
            title="Đóng"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Body with Sidebar Tabs + Main Content */}
      <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", flex: 1, minHeight: 0 }}>
        {/* Left Navigation of APIs */}
        <div style={{ borderRight: "1px solid #e2e8f0", background: "#f8fafc", padding: "10px 8px", overflowY: "auto", maxHeight: 560 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", padding: "4px 10px 8px" }}>
            Danh sách nghiệp vụ ({endpoints.length})
          </div>
          {endpoints.map((ep) => {
            const isSelected = ep.id === activeEndpoint.id;
            return (
              <button
                key={ep.id}
                type="button"
                onClick={() => setActiveId(ep.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: isSelected ? "#e0f2fe" : "transparent",
                  color: isSelected ? "#0369a1" : "#334155",
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  marginBottom: 3,
                }}
              >
                <span>{ep.label}</span>
                <span style={{ fontSize: 10.5, color: isSelected ? "#0284c7" : "#94a3b8", fontFamily: "monospace" }}>
                  {ep.path.replace("/api/v1/", "/")}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right Table & Controls */}
        <div style={{ display: "flex", flexDirection: "column", padding: 16, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{activeEndpoint.label}</h3>
              <p style={{ margin: 0, fontSize: 12.5, color: "#64748b" }}>{activeEndpoint.description}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Tìm kiếm nhanh..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ height: 32, padding: "0 28px 0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, width: 190 }}
                />
                <Search size={14} style={{ position: "absolute", right: 8, top: 9, color: "#64748b" }} />
              </div>
              <button
                type="button"
                onClick={() => void loadEndpointData(activeEndpoint)}
                style={{ height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#334155" }}
                title="Làm mới dữ liệu từ API"
              >
                <RefreshCw size={14} />
                <span>Nạp lại</span>
              </button>
              {!activeEndpoint.readOnly && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  style={{ height: 32, padding: "0 12px", borderRadius: 4, border: "none", background: "#16a34a", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600 }}
                >
                  <Plus size={14} />
                  <span>Thêm mới</span>
                </button>
              )}
            </div>
          </div>

          {/* Data Grid */}
          <div style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "9px 10px", textAlign: "center", width: 44, fontWeight: 700, color: "#334155" }}>#</th>
                  {activeEndpoint.columns.map((col) => (
                    <th key={col.key} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#334155" }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={activeEndpoint.columns.length + 1} style={{ padding: 36, textAlign: "center", color: "#64748b" }}>
                      Đang tải dữ liệu từ <code>{activeEndpoint.path}</code>...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeEndpoint.columns.length + 1} style={{ padding: 36, textAlign: "center", color: "#64748b" }}>
                      Chưa có bản ghi nào trên <code>{activeEndpoint.path}</code>.
                      {!activeEndpoint.readOnly && " Nhấn nút 'Thêm mới' ở góc phải để tạo bản ghi đầu tiên."}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr key={row.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                      {activeEndpoint.columns.map((col) => (
                        <td key={col.key} style={{ padding: "8px 12px", color: "#1e293b" }}>
                          {formatCellValue(row[col.key] ?? row.name ?? row.code ?? row.number)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
            <span>Tổng số: <strong>{filteredRows.length}</strong> bản ghi</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#15803d", fontWeight: 600 }}>
              <CheckCircle2 size={13} /> Đã đồng bộ trực tiếp với Backend API
            </span>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 9999, display: "grid", placeItems: "center" }}
          onClick={() => setShowCreateModal(false)}
        >
          <form
            onSubmit={handleCreateRecord}
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#ffffff", width: 460, maxWidth: "92vw", borderRadius: 8, boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden" }}
          >
            <div style={{ padding: "14px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Thêm mới — {activeEndpoint.label}</h4>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              {(activeEndpoint.createFields || activeEndpoint.columns.filter((c) => c.key !== "status").map((c) => ({ key: c.key, label: c.label }))).map((field: any) => (
                <label key={field.key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 600, color: "#334155" }}>
                  <span>{field.label}</span>
                  {field.type === "select" && field.options ? (
                    <select
                      value={formValues[field.key] || ""}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      style={{ height: 34, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13 }}
                    >
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type || "text"}
                      required={field.required}
                      value={formValues[field.key] || ""}
                      onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      style={{ height: 34, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13 }}
                    />
                  )}
                </label>
              ))}
            </div>
            <div style={{ padding: "12px 18px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ height: 32, padding: "0 14px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", fontSize: 12.5 }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ height: 32, padding: "0 16px", borderRadius: 4, border: "none", background: "#16a34a", color: "#ffffff", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}
              >
                {saving ? "Đang lưu..." : "Lưu dữ liệu"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
