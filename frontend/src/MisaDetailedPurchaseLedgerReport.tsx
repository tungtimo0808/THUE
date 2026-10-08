import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Search,
  RefreshCw,
  Mail,
  ChevronDown,
  Filter,
  Columns,
  Calendar,
  MessageCircle,
  FileSpreadsheet,
} from "lucide-react";

export interface PurchaseLedgerRow {
  postDate: string;
  voucherDate: string;
  voucherNo: string;
  invoiceDate: string;
  invoiceNo: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  purchaseAmount: number;
  discountAmount: number;
  returnQuantity: number;
  returnAmount: number;
  priceReductionAmount: number;
}

export interface ItemOption {
  code: string;
  name: string;
}

export interface SupplierOption {
  code: string;
  name: string;
  address?: string;
  taxCode?: string;
}

const DEFAULT_ITEMS: ItemOption[] = [
  { code: "CPMH", name: "Chi phí mua hàng" },
  { code: "VT00001", name: "Màn hình 21 LG inch" },
];

const DEFAULT_SUPPLIERS: SupplierOption[] = [
  {
    code: "NCC00001",
    name: "Tran Thi Huong",
    address: "",
    taxCode: "030178006908",
  },
];

const DEFAULT_PURCHASE_DATA: PurchaseLedgerRow[] = [
  {
    postDate: "06/10/2026",
    voucherDate: "06/10/2026",
    voucherNo: "NK00001",
    invoiceDate: "06/10/2026",
    invoiceNo: "NM01",
    itemCode: "VT00001",
    itemName: "Màn hình 21 LG inch",
    unit: "chiếc",
    quantity: 10,
    unitPrice: 2500000,
    purchaseAmount: 25000000,
    discountAmount: 0,
    returnQuantity: 0,
    returnAmount: 0,
    priceReductionAmount: 0,
  },
];

export interface MisaDetailedPurchaseLedgerReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaDetailedPurchaseLedgerReport({
  onBack,
  notify,
}: MisaDetailedPurchaseLedgerReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [itemGroup, setItemGroup] = useState("");
  const [supplierGroup, setSupplierGroup] = useState("");
  const [buyerStaff, setBuyerStaff] = useState("");
  const [selectedItemName, setSelectedItemName] = useState("Chi phí mua hàng");
  const [selectedSupplierName, setSelectedSupplierName] = useState("Tran Thi Huong");

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftItemGroup, setDraftItemGroup] = useState("");
  const [draftSupplierGroup, setDraftSupplierGroup] = useState("");
  const [draftBuyerStaff, setDraftBuyerStaff] = useState("");
  const [draftItemCode, setDraftItemCode] = useState("CPMH");
  const [draftSupplierCode, setDraftSupplierCode] = useState("NCC00001");
  const [itemSearchText, setItemSearchText] = useState("");
  const [supplierSearchText, setSupplierSearchText] = useState("");

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  // Data: Initialized matching Screenshot 2 & 3
  const [purchaseData, setPurchaseData] = useState<PurchaseLedgerRow[]>(DEFAULT_PURCHASE_DATA);

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftItemGroup(itemGroup);
    setDraftSupplierGroup(supplierGroup);
    setDraftBuyerStaff(buyerStaff);
    const it = DEFAULT_ITEMS.find((i) => i.name === selectedItemName);
    setDraftItemCode(it ? it.code : "CPMH");
    const sup = DEFAULT_SUPPLIERS.find((s) => s.name === selectedSupplierName);
    setDraftSupplierCode(sup ? sup.code : "NCC00001");
    setItemSearchText("");
    setSupplierSearchText("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setItemGroup(draftItemGroup);
    setSupplierGroup(draftSupplierGroup);
    setBuyerStaff(draftBuyerStaff);
    const it = DEFAULT_ITEMS.find((i) => i.code === draftItemCode);
    if (it) setSelectedItemName(it.name);
    const sup = DEFAULT_SUPPLIERS.find((s) => s.code === draftSupplierCode);
    if (sup) setSelectedSupplierName(sup.name);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Sổ chi tiết mua hàng.");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftItemGroup("");
    setDraftSupplierGroup("");
    setDraftBuyerStaff("");
    setDraftItemCode("CPMH");
    setDraftSupplierCode("NCC00001");
  };

  const handlePresetChange = (preset: string) => {
    setDraftPeriodPreset(preset);
    if (preset === "Hôm nay") {
      setDraftFromDate("07/10/2026");
      setDraftToDate("07/10/2026");
    } else if (preset === "Tháng này") {
      setDraftFromDate("01/10/2026");
      setDraftToDate("31/10/2026");
    } else if (preset === "Tháng trước") {
      setDraftFromDate("01/09/2026");
      setDraftToDate("30/09/2026");
    } else if (preset === "Quý 4") {
      setDraftFromDate("01/10/2026");
      setDraftToDate("31/12/2026");
    } else if (preset === "Năm nay") {
      setDraftFromDate("01/01/2026");
      setDraftToDate("31/12/2026");
    }
  };

  // Subtitle matching Screenshot 2: "Nhà cung cấp: Tran Thi Huong, Tháng 10 năm 2026"
  const periodSubtitle = useMemo(() => {
    return `Nhà cung cấp: ${selectedSupplierName}, Tháng 10 năm 2026`;
  }, [selectedSupplierName]);

  // Filter items in drawer
  const filteredItems = useMemo(() => {
    if (!itemSearchText.trim()) return DEFAULT_ITEMS;
    const kw = itemSearchText.toLowerCase();
    return DEFAULT_ITEMS.filter(
      (i) => i.code.toLowerCase().includes(kw) || i.name.toLowerCase().includes(kw)
    );
  }, [itemSearchText]);

  // Filter suppliers in drawer
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchText.trim()) return DEFAULT_SUPPLIERS;
    const kw = supplierSearchText.toLowerCase();
    return DEFAULT_SUPPLIERS.filter(
      (s) => s.code.toLowerCase().includes(kw) || s.name.toLowerCase().includes(kw)
    );
  }, [supplierSearchText]);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return purchaseData;
    const kw = searchKeyword.toLowerCase();
    return purchaseData.filter(
      (r) =>
        r.itemCode.toLowerCase().includes(kw) ||
        r.itemName.toLowerCase().includes(kw) ||
        r.voucherNo.toLowerCase().includes(kw) ||
        r.invoiceNo.toLowerCase().includes(kw)
    );
  }, [purchaseData, searchKeyword]);

  const formatQuantity = (val?: number) => {
    if (val === undefined || val === null || val === 0) return "";
    return val.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatUnitPrice = (val?: number) => {
    if (val === undefined || val === null || val === 0) return "";
    return val.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null || val === 0) return "";
    return val.toLocaleString("vi-VN");
  };

  const totalQuantity = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + (r.quantity || 0), 0);
  }, [filteredRows]);

  const totalPurchaseAmount = useMemo(() => {
    return filteredRows.reduce((acc, r) => acc + (r.purchaseAmount || 0), 0);
  }, [filteredRows]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#ffffff",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* 1. Header Bar matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              borderRadius: 4,
            }}
            title="Quay lại danh mục báo cáo"
          >
            <ChevronLeft size={20} />
          </button>
          <h2
            style={{
              margin: 0,
              fontSize: 14.5,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Sổ chi tiết mua hàng
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => notify?.("Xem danh sách báo cáo đã lưu...")}
          >
            Danh sách báo cáo đã lưu
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => notify?.("Đã lưu mẫu báo cáo thành công.")}
          >
            Lưu báo cáo
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 18px",
              background: "#00a862",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
            onClick={handleOpenDrawer}
          >
            Chọn tham số
          </button>
        </div>
      </div>

      {/* 2. Action Toolbar matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              padding: "5px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#64748b",
            }}
            title="Lọc dữ liệu"
          >
            <Filter size={14} />
          </button>
          <button
            type="button"
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              padding: "5px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#64748b",
            }}
            title="Tùy chỉnh hiển thị"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm2 4.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1H4z" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Search box with purple search icon on the left matching Screenshot */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 9,
                color: "#8b5cf6",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: 220,
                height: 28,
                padding: "0 10px 0 30px",
                fontSize: 12,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                outline: "none",
                background: "#ffffff",
              }}
            />
          </div>

          {/* 1. Nạp lại */}
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
            title="Nạp lại dữ liệu"
            onClick={() => notify?.("Đã nạp lại dữ liệu báo cáo.")}
          >
            <RefreshCw size={15} />
          </button>

          {/* 2. Gửi email */}
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi email báo cáo...")}
          >
            <Mail size={15} />
          </button>

          {/* 3. Kênh chat / Trợ giúp trực tuyến MISA */}
          <button
            type="button"
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#0284c7",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            title="Hỗ trợ trực tuyến MISA"
            onClick={() => notify?.("Mở hỗ trợ trực tuyến.")}
          >
            <MessageCircle size={13} fill="#ffffff" />
          </button>

          {/* 4. In báo cáo kèm dropdown */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
              color: "#64748b",
              padding: "2px 4px",
            }}
            title="In báo cáo"
            onClick={() => window.print()}
          >
            <Printer size={15} />
            <ChevronDown size={12} />
          </div>

          {/* 5. Xuất khẩu Excel kèm dropdown */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
              color: "#64748b",
              padding: "2px 4px",
            }}
            title="Xuất khẩu báo cáo"
            onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
          >
            <Download size={15} />
            <ChevronDown size={12} />
          </div>

          {/* 6. Thiết lập */}
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
            title="Tùy chọn khác"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 3. Main Report Area */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Title Header matching Screenshot 2 */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1
            style={{
              margin: "0 0 6px 0",
              fontSize: 15.5,
              fontWeight: 700,
              color: "#0f172a",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            SỔ CHI TIẾT MUA HÀNG
          </h1>
          <div
            style={{
              fontSize: 12.5,
              color: "#475569",
              fontStyle: "italic",
            }}
          >
            {periodSubtitle}
          </div>
        </div>

        {/* Data Table with all columns matching Screenshot 2 & 3 */}
        <div
          style={{
            width: "100%",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            overflowX: "auto",
            overflowY: "auto",
            background: "#ffffff",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 1550,
              borderCollapse: "collapse",
              fontSize: 12.5,
              color: "#1e293b",
            }}
          >
            <thead>
              <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Ngày hạch toán
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Ngày chứng từ
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "left",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Số chứng từ
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Ngày hóa đơn
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "left",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Số hóa đơn
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "left",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 100,
                  }}
                >
                  Mã hàng
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "left",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 160,
                  }}
                >
                  Tên hàng
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 70,
                  }}
                >
                  ĐVT
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 100,
                  }}
                >
                  Số lượng mua
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Đơn giá
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 120,
                  }}
                >
                  Giá trị mua
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Chiết khấu
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 115,
                  }}
                >
                  Số lượng trả lại
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 115,
                  }}
                >
                  Giá trị trả lại
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    minWidth: 120,
                  }}
                >
                  Giá trị giảm giá
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                <>
                  {filteredRows.map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: idx % 2 === 1 ? "#fafafa" : "#ffffff",
                      }}
                    >
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "center",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        {row.postDate}
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "center",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        {row.voucherDate}
                      </td>
                      <td style={{ padding: "8px 12px", borderRight: "1px solid #e2e8f0" }}>
                        <span
                          style={{
                            color: "#0284c7",
                            cursor: "pointer",
                            fontWeight: 500,
                            textDecoration: "none",
                          }}
                          onClick={() => notify?.(`Mở chứng từ ${row.voucherNo}`)}
                        >
                          {row.voucherNo}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "center",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        {row.invoiceDate}
                      </td>
                      <td style={{ padding: "8px 12px", borderRight: "1px solid #e2e8f0" }}>
                        {row.invoiceNo}
                      </td>
                      <td style={{ padding: "8px 12px", borderRight: "1px solid #e2e8f0" }}>
                        {row.itemCode}
                      </td>
                      <td style={{ padding: "8px 12px", borderRight: "1px solid #e2e8f0" }}>
                        {row.itemName}
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "center",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        {row.unit}
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        {formatQuantity(row.quantity)}
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        {formatUnitPrice(row.unitPrice)}
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        {formatMoney(row.purchaseAmount)}
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        {row.discountAmount ? formatMoney(row.discountAmount) : ""}
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        {row.returnQuantity ? formatQuantity(row.returnQuantity) : ""}
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right",
                          borderRight: "1px solid #e2e8f0",
                        }}
                      >
                        {row.returnAmount ? formatMoney(row.returnAmount) : ""}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {row.priceReductionAmount ? formatMoney(row.priceReductionAmount) : ""}
                      </td>
                    </tr>
                  ))}

                  {/* Summary Row "Tổng cộng" matching Screenshot 2 */}
                  <tr
                    style={{
                      background: "#f8fafc",
                      fontWeight: 700,
                      borderBottom: "1px solid #cbd5e1",
                    }}
                  >
                    <td
                      colSpan={8}
                      style={{
                        padding: "8px 12px",
                        borderRight: "1px solid #e2e8f0",
                        textAlign: "left",
                        color: "#1e293b",
                      }}
                    >
                      Tổng cộng
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                        color: "#1e293b",
                      }}
                    >
                      {formatQuantity(totalQuantity)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    ></td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                        color: "#1e293b",
                      }}
                    >
                      {formatMoney(totalPurchaseAmount)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    ></td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    ></td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    ></td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}></td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={15} style={{ padding: "90px 20px", textAlign: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                      }}
                    >
                      <svg
                        width="88"
                        height="64"
                        viewBox="0 0 88 64"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect x="8" y="20" width="72" height="26" rx="13" fill="#f1f5f9" />
                        <rect
                          x="28"
                          y="10"
                          width="30"
                          height="40"
                          rx="3"
                          fill="#ffffff"
                          stroke="#e2e8f0"
                          strokeWidth="1.5"
                        />
                        <line x1="34" y1="19" x2="48" y2="19" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                        <line x1="34" y1="25" x2="52" y2="25" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                        <line x1="34" y1="31" x2="44" y2="31" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="50" cy="38" r="11" fill="#ffffff" stroke="#00a862" strokeWidth="2.5" />
                        <path d="M58 46L66 54" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="20" cy="34" r="2" fill="#00a862" opacity="0.6" />
                        <circle cx="68" cy="22" r="2" fill="#00a862" opacity="0.7" />
                        <polygon points="70,16 71.5,19 74.5,20 71.5,21 70,24 68.5,21 65.5,20 68.5,19" fill="#00a862" opacity="0.8" />
                      </svg>
                      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                        Không có dữ liệu
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Table pagination footer matching Screenshot 2 & 3 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "7px 12px",
              background: "#ffffff",
              borderTop: "1px solid #e2e8f0",
              fontSize: 12,
              color: "#64748b",
            }}
          >
            <div>
              Tổng số: <strong>{filteredRows.length}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span>Số dòng/trang</span>
              <select
                style={{
                  height: 24,
                  fontSize: 12,
                  borderRadius: 3,
                  border: "1px solid #cbd5e1",
                  padding: "0 4px",
                  background: "#fff",
                }}
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              <span>|&lt; &lt; 1 &gt; &gt;|</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Modal / Drawer "Chọn tham số" matching Screenshot 1 */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              width: 840,
              maxWidth: "92vw",
              height: "100%",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
              animation: "slideInRight 0.25s ease-out",
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                  title="Đóng"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Row 1: Kỳ báo cáo, Từ ngày, Đến ngày */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                  alignItems: "flex-end",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    Kỳ báo cáo <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftPeriodPreset}
                      onChange={(e) => handlePresetChange(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        background: "#ffffff",
                        outline: "none",
                        appearance: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Hôm nay">Hôm nay</option>
                      <option value="Tháng này">Tháng này</option>
                      <option value="Tháng trước">Tháng trước</option>
                      <option value="Quý 4">Quý 4</option>
                      <option value="Năm nay">Năm nay</option>
                    </select>
                    <ChevronDown
                      size={15}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftFromDate}
                      onChange={(e) => setDraftFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftToDate}
                      onChange={(e) => setDraftToDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Nhóm VTHH, Nhóm nhà cung cấp, NV mua hàng matching Screenshot 1 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                  alignItems: "flex-end",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    Nhóm VTHH
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftItemGroup}
                      onChange={(e) => setDraftItemGroup(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        background: "#ffffff",
                        outline: "none",
                        appearance: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">-- Tất cả nhóm VTHH --</option>
                      <option value="HH">Hàng hóa</option>
                      <option value="VT">Vật tư</option>
                      <option value="DV">Dịch vụ</option>
                    </select>
                    <ChevronDown
                      size={15}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    Nhóm nhà cung cấp
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftSupplierGroup}
                      onChange={(e) => setDraftSupplierGroup(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        background: "#ffffff",
                        outline: "none",
                        appearance: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">-- Tất cả nhóm NCC --</option>
                      <option value="NCC_TN">Nhà cung cấp trong nước</option>
                      <option value="NCC_NN">Nhà cung cấp nước ngoài</option>
                    </select>
                    <ChevronDown
                      size={15}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    NV mua hàng
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftBuyerStaff}
                      onChange={(e) => setDraftBuyerStaff(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        background: "#ffffff",
                        outline: "none",
                        appearance: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">-- Tất cả nhân viên --</option>
                      <option value="NV001">Nguyễn Văn An</option>
                      <option value="NV002">Trần Thị Bích</option>
                    </select>
                    <ChevronDown
                      size={15}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Table 1: Mặt hàng matching Screenshot 1 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={draftItemCode === "CPMH"}
                      onChange={(e) =>
                        setDraftItemCode(e.target.checked ? "CPMH" : "")
                      }
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Chọn tất cả</span>
                  </label>

                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={itemSearchText}
                      onChange={(e) => setItemSearchText(e.target.value)}
                      style={{
                        width: 200,
                        height: 26,
                        padding: "0 26px 0 8px",
                        fontSize: 11.5,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                      }}
                    />
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: 6,
                        color: "#94a3b8",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ width: 36, padding: "7px 10px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={draftItemCode === "CPMH"}
                            onChange={(e) =>
                              setDraftItemCode(e.target.checked ? "CPMH" : "")
                            }
                            style={{ accentColor: "#00a862" }}
                          />
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                            borderRight: "1px solid #cbd5e1",
                            width: 140,
                          }}
                        >
                          Mã hàng
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                          }}
                        >
                          Tên hàng
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => {
                        const isSelected = draftItemCode === item.code;
                        return (
                          <tr
                            key={item.code}
                            onClick={() =>
                              setDraftItemCode(isSelected ? "" : item.code)
                            }
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              cursor: "pointer",
                              background: isSelected ? "#f0fdf4" : "#ffffff",
                            }}
                          >
                            <td style={{ textAlign: "center", padding: "6px 10px" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ accentColor: "#00a862" }}
                              />
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                borderRight: "1px solid #f1f5f9",
                              }}
                            >
                              {item.code}
                            </td>
                            <td style={{ padding: "6px 10px" }}>{item.name}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 12px",
                      background: "#f8fafc",
                      borderTop: "1px solid #e2e8f0",
                      fontSize: 11.5,
                      color: "#64748b",
                    }}
                  >
                    <span>Tổng số: 2</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span>Số dòng/trang: 20</span>
                      <span>&lt; 1 &gt;</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table 2: Nhà cung cấp matching Screenshot 1 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={draftSupplierCode === "NCC00001"}
                      onChange={(e) =>
                        setDraftSupplierCode(e.target.checked ? "NCC00001" : "")
                      }
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Chọn tất cả</span>
                  </label>

                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={supplierSearchText}
                      onChange={(e) => setSupplierSearchText(e.target.value)}
                      style={{
                        width: 200,
                        height: 26,
                        padding: "0 26px 0 8px",
                        fontSize: 11.5,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                      }}
                    />
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: 6,
                        color: "#94a3b8",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ width: 36, padding: "7px 10px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={draftSupplierCode === "NCC00001"}
                            onChange={(e) =>
                              setDraftSupplierCode(e.target.checked ? "NCC00001" : "")
                            }
                            style={{ accentColor: "#00a862" }}
                          />
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                            borderRight: "1px solid #cbd5e1",
                            width: 120,
                          }}
                        >
                          Mã NCC
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                            borderRight: "1px solid #cbd5e1",
                            width: 140,
                          }}
                        >
                          Tên NCC
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                            borderRight: "1px solid #cbd5e1",
                          }}
                        >
                          Địa chỉ
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                            width: 130,
                          }}
                        >
                          Mã số thuế
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSuppliers.map((sup) => {
                        const isSelected = draftSupplierCode === sup.code;
                        return (
                          <tr
                            key={sup.code}
                            onClick={() =>
                              setDraftSupplierCode(isSelected ? "" : sup.code)
                            }
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              cursor: "pointer",
                              background: isSelected ? "#f0fdf4" : "#ffffff",
                            }}
                          >
                            <td style={{ textAlign: "center", padding: "6px 10px" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ accentColor: "#00a862" }}
                              />
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                borderRight: "1px solid #f1f5f9",
                              }}
                            >
                              {sup.code}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                borderRight: "1px solid #f1f5f9",
                              }}
                            >
                              {sup.name}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                borderRight: "1px solid #f1f5f9",
                              }}
                            >
                              {sup.address || ""}
                            </td>
                            <td style={{ padding: "6px 10px" }}>{sup.taxCode || ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 12px",
                      background: "#f8fafc",
                      borderTop: "1px solid #e2e8f0",
                      fontSize: 11.5,
                      color: "#64748b",
                    }}
                  >
                    <span>Tổng số: 1</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span>Số dòng/trang: 20</span>
                      <span>&lt; 1 &gt;</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer matching Screenshot 1 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={handleResetParams}
                style={{
                  height: 32,
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Xóa điều kiện
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    height: 32,
                    padding: "0 18px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#334155",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyParams}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Xem báo cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
