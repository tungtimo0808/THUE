import React, { useState } from "react";
import {
  ChevronLeft,
  Search,
  RotateCw,
  Mail,
  MessageCircle,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Calendar,
  ChevronDown,
  Sparkles,
  FileCheck,
  FileText,
  BookOpen,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export interface MisaFinancialNotesReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaFinancialNotesReport({
  onBack,
  notify,
}: MisaFinancialNotesReportProps) {
  // Parameter Drawer State matching Screenshot
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [period, setPeriod] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [fetchFromSaved, setFetchFromSaved] = useState(false);

  // Temporary drawer draft state
  const [draftPeriod, setDraftPeriod] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftFetchFromSaved, setDraftFetchFromSaved] = useState(false);

  // Search keyword
  const [searchKeyword, setSearchKeyword] = useState("");

  // AI highlights state
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);

  // Active section tab for quick jump
  const [activeSection, setActiveSection] = useState<string>("all");

  // Saved reports modal
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);

  // Format currency helper
  const formatMoney = (num: number) => {
    if (num === 0) return "0";
    if (num < 0) return `(${Math.abs(num).toLocaleString("vi-VN")})`;
    return num.toLocaleString("vi-VN");
  };

  const handleOpenDrawer = () => {
    setDraftPeriod(period);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftFetchFromSaved(fetchFromSaved);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriod(draftPeriod);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setFetchFromSaved(draftFetchFromSaved);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật tham số Thuyết minh báo cáo tài chính.");
  };

  const handleResetParams = () => {
    setDraftPeriod("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftFetchFromSaved(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#f1f5f9",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* 1. Top Header Bar matching MISA AMIS B09-DN */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          minHeight: 48,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "transparent",
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
              fontSize: 15,
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: "-0.2px",
            }}
          >
            B09 - DN: Thuyết minh báo cáo tài chính
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={{
              height: 32,
              padding: "0 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => setIsSavedReportsOpen(true)}
          >
            Danh sách báo cáo đã lưu
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => notify?.("Đã lưu bản thuyết minh BCTC B09-DN.")}
          >
            Lưu báo cáo
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 16px",
              background: "#00a862",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={handleOpenDrawer}
          >
            <span>Chọn tham số</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Toolbar: Kiểm tra, AI, Search, Tools */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#334155",
              cursor: "pointer",
              fontWeight: 500,
            }}
            onClick={() =>
              notify?.("Kiểm tra sự khớp nối giữa Thuyết minh và B01-DN, B02-DN...")
            }
          >
            <FileCheck size={15} color="#00a862" />
            <span>Kiểm tra đối chiếu BCTC</span>
          </button>

          {/* AI Analysis Sparkles Badge */}
          <button
            type="button"
            style={{
              background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
              border: "1px solid #c7d2fe",
              borderRadius: 14,
              padding: "3px 12px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "#6366f1",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => setShowAiAnalysis(!showAiAnalysis)}
          >
            <Sparkles size={14} color="#7c3aed" />
            <span>{showAiAnalysis ? "Đóng phân tích AVA" : "✨ Trợ lý rà soát Thuyết minh BCTC"}</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 220 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              type="text"
              placeholder="Tìm kiếm nội dung thuyết minh"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: "100%",
                height: 30,
                padding: "0 10px 0 32px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                outline: "none",
                background: "#ffffff",
              }}
            />
          </div>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Làm mới"
            onClick={() => notify?.("Đã làm mới dữ liệu thuyết minh.")}
          >
            <RotateCw size={14} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi báo cáo qua email.")}
          >
            <Mail size={14} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0284c7",
              cursor: "pointer",
            }}
            title="Trợ giúp"
            onClick={() => notify?.("Hệ thống trợ giúp AVA Kế toán.")}
          >
            <MessageCircle size={14} />
          </button>

          <button
            type="button"
            style={{
              height: 30,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#334155",
              fontSize: 12.5,
              cursor: "pointer",
            }}
            onClick={() => notify?.("Đang chuẩn bị lệnh in thuyết minh khổ A4 dọc...")}
          >
            <Printer size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{
              height: 30,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#334155",
              fontSize: 12.5,
              cursor: "pointer",
            }}
            onClick={() =>
              notify?.("Đã xuất khẩu Thuyết minh báo cáo tài chính ra Word (.docx) & Excel (.xlsx).")
            }
          >
            <Download size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Tùy chỉnh"
            onClick={() => notify?.("Mở thiết lập cấu hình Thuyết minh.")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 3. AI Analysis Banner if active */}
      {showAiAnalysis && (
        <div
          style={{
            margin: "12px 20px 0",
            padding: "14px 18px",
            background: "#faf5ff",
            border: "1px solid #e9d5ff",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(124, 58, 237, 0.08)",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <Sparkles size={20} color="#7c3aed" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, fontSize: 13, color: "#4c1d95", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13.5 }}>
              Kết quả rà soát tự động Thuyết minh BCTC (AVA Kế toán):
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 }}>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#00a862" }}>1. Khớp nối B01-DN & B02-DN: 100%</strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Mục V.1 (Tiền âm 20M), V.3 (Phải thu 30M), V.7 (Tồn kho 12.475M) và VI.1 (Doanh thu 20M) khớp hoàn toàn với số liệu báo cáo tài chính.
                </p>
              </div>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#d97706" }}>2. Lưu ý kiểm toán về tiền mặt</strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Số dư tiền cuối kỳ âm (20.000.000) đ cần bổ sung thuyết minh chi tiết về hợp đồng thấu chi hoặc điều chỉnh phân loại âm quỹ.
                </p>
              </div>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#2563eb" }}>3. Chính sách kế toán áp dụng</strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Đầy đủ điều khoản theo Thông tư 200/2014/TT-BTC: phương pháp tính giá HTK bình quân, thuế suất thuế TNDN 20%.
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            style={{ background: "transparent", border: "none", color: "#a855f7", cursor: "pointer", padding: 4 }}
            onClick={() => setShowAiAnalysis(false)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 4. Section Jump Navbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 20px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          overflowX: "auto",
          fontSize: 12.5,
        }}
      >
        <span style={{ color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
          <BookOpen size={14} /> Mục lục:
        </span>
        {[
          { id: "all", label: "Toàn văn" },
          { id: "sec1", label: "I. Đặc điểm hoạt động" },
          { id: "sec2", label: "II. Kỳ & Tiền tệ" },
          { id: "sec3", label: "III. Chuẩn mực & Chế độ" },
          { id: "sec4", label: "IV. Chính sách kế toán" },
          { id: "sec5", label: "V. Thuyết minh Tình hình tài chính" },
          { id: "sec6", label: "VI. Thuyết minh KQKD" },
          { id: "sec7", label: "VII. Thông tin khác" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: activeSection === item.id ? "1px solid #00a862" : "1px solid #e2e8f0",
              background: activeSection === item.id ? "#e6f7ef" : "#ffffff",
              color: activeSection === item.id ? "#00a862" : "#334155",
              fontWeight: activeSection === item.id ? 600 : 400,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            onClick={() => setActiveSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 5. Main Report Sheet Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 4,
            border: "1px solid #cbd5e1",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            padding: "30px 40px",
            minHeight: "100%",
            color: "#1e293b",
            fontSize: 13.5,
            lineHeight: 1.7,
          }}
        >
          {/* Header of Thuyết minh */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#0f172a",
                textTransform: "uppercase",
              }}
            >
              THUYẾT MINH BÁO CÁO TÀI CHÍNH
            </h1>
            <div style={{ fontSize: 13, fontStyle: "italic", color: "#475569", marginTop: 4 }}>
              Kỳ kế toán tháng 10 năm 2026 (Từ ngày {fromDate} đến ngày {toDate})
            </div>
            <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
              (Ban hành theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính)
            </div>
          </div>

          {/* I. ĐẶC ĐIỂM HOẠT ĐỘNG */}
          {(activeSection === "all" || activeSection === "sec1") && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#00a862", borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                I. ĐẶC ĐIỂM HOẠT ĐỘNG CỦA DOANH NGHIỆP
              </h3>
              <ul style={{ paddingLeft: 20, margin: "10px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                <li><strong>1. Hình thức sở hữu vốn:</strong> Công ty Cổ phần / Trách nhiệm hữu hạn.</li>
                <li><strong>2. Lĩnh vực kinh doanh:</strong> Thương mại, dịch vụ và sản xuất phần mềm công nghệ.</li>
                <li><strong>3. Ngành nghề kinh doanh chính:</strong> Bán buôn hàng hóa, dịch vụ kế toán tài chính và giải pháp số.</li>
                <li><strong>4. Chu kỳ sản xuất, kinh doanh thông thường:</strong> 12 tháng.</li>
                <li><strong>5. Cấu trúc doanh nghiệp:</strong> Doanh nghiệp hoạt động độc lập, không có công ty con hoặc đơn vị trực thuộc phụ thuộc.</li>
              </ul>
            </div>
          )}

          {/* II. KỲ KẾ TOÁN, ĐƠN VỊ TIỀN TỆ */}
          {(activeSection === "all" || activeSection === "sec2") && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#00a862", borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                II. KỲ KẾ TOÁN, ĐƠN VỊ TIỀN TỆ SỬ DỤNG TRONG KẾ TOÁN
              </h3>
              <ul style={{ paddingLeft: 20, margin: "10px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                <li><strong>1. Kỳ kế toán năm:</strong> Bắt đầu từ ngày 01/01 và kết thúc vào ngày 31/12 hàng năm.</li>
                <li><strong>2. Đơn vị tiền tệ sử dụng:</strong> Đồng Việt Nam (VND).</li>
              </ul>
            </div>
          )}

          {/* III. CHUẨN MỰC & CHẾ ĐỘ KẾ TOÁN */}
          {(activeSection === "all" || activeSection === "sec3") && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#00a862", borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                III. CHUẨN MỰC VÀ CHẾ ĐỘ KẾ TOÁN ÁP DỤNG
              </h3>
              <ul style={{ paddingLeft: 20, margin: "10px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                <li><strong>1. Chế độ kế toán áp dụng:</strong> Doanh nghiệp áp dụng Chế độ Kế toán Doanh nghiệp ban hành theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ Tài chính.</li>
                <li><strong>2. Tuyên bố tuân thủ:</strong> Báo cáo tài chính được lập và trình bày tuân thủ đầy đủ các Chuẩn mực Kế toán Việt Nam và các quy định hiện hành.</li>
              </ul>
            </div>
          )}

          {/* IV. CÁC CHÍNH SÁCH KẾ TOÁN ÁP DỤNG */}
          {(activeSection === "all" || activeSection === "sec4") && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#00a862", borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                IV. CÁC CHÍNH SÁCH KẾ TOÁN ÁP DỤNG CHỦ YẾU
              </h3>
              <ul style={{ paddingLeft: 20, margin: "10px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                <li><strong>1. Nguyên tắc ghi nhận tiền và các khoản tương đương tiền:</strong> Tiền gồm tiền mặt tại quỹ, tiền gửi ngân hàng không kỳ hạn. Các khoản tương đương tiền là các khoản đầu tư ngắn hạn có thời hạn thu hồi không quá 3 tháng.</li>
                <li><strong>2. Nguyên tắc ghi nhận hàng tồn kho:</strong> Hàng tồn kho được tính theo giá gốc. Phương pháp tính giá trị hàng tồn kho xuất kho: Phương pháp Bình quân gia quyền liên hoàn. Phương pháp hạch toán: Kê khai thường xuyên.</li>
                <li><strong>3. Nguyên tắc ghi nhận nợ phải thu và trích lập dự phòng khó đòi:</strong> Nợ phải thu được theo dõi chi tiết theo từng đối tượng khách hàng, kỳ hạn thu hồi và tính chất công nợ. Dự phòng nợ phải thu khó đòi được trích lập căn cứ vào tuổi nợ quá hạn.</li>
                <li><strong>4. Nguyên tắc ghi nhận doanh thu:</strong> Doanh thu bán hàng và cung cấp dịch vụ được ghi nhận khi đã chuyển giao phần lớn rủi ro và lợi ích gắn liền với quyền sở hữu sản phẩm/hàng hóa hoặc dịch vụ đã hoàn thành cho người mua.</li>
                <li><strong>5. Thuế thu nhập doanh nghiệp:</strong> Thuế suất thuế TNDN hiện hành là 20% áp dụng trên thu nhập chịu thuế.</li>
              </ul>
            </div>
          )}

          {/* V. THÔNG TIN BỔ SUNG BÁO CÁO TÌNH HÌNH TÀI CHÍNH */}
          {(activeSection === "all" || activeSection === "sec5") && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#00a862", borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                V. THÔNG TIN BỔ SUNG CHO CÁC KHOẢN MỤC TRÌNH BÀY TRONG BÁO CÁO TÌNH HÌNH TÀI CHÍNH
              </h3>

              {/* V.1 Tiền */}
              <div style={{ marginTop: 14 }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700 }}>
                  1. Tiền và các khoản tương đương tiền (Mã số 110 - Thuyết minh V.1)
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #cbd5e1", marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: "#e2f0d9", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderRight: "1px solid #c2d9b8" }}>Chỉ tiêu</th>
                      <th style={{ padding: "8px 14px", textAlign: "right", width: 180, borderRight: "1px solid #c2d9b8" }}>Số cuối năm (31/10/2026)</th>
                      <th style={{ padding: "8px 14px", textAlign: "right", width: 160 }}>Số đầu năm</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "7px 12px", borderRight: "1px solid #f1f5f9" }}>- Tiền mặt tại quỹ (TK 111)</td>
                      <td style={{ padding: "7px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9", color: "#dc2626", fontWeight: 700 }}>
                        (20.000.000)
                      </td>
                      <td style={{ padding: "7px 14px", textAlign: "right" }}>0</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#fafbfc" }}>
                      <td style={{ padding: "7px 12px", borderRight: "1px solid #f1f5f9" }}>- Tiền gửi ngân hàng (TK 112)</td>
                      <td style={{ padding: "7px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>0</td>
                      <td style={{ padding: "7px 14px", textAlign: "right" }}>0</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "7px 12px", borderRight: "1px solid #f1f5f9" }}>- Các khoản tương đương tiền</td>
                      <td style={{ padding: "7px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>0</td>
                      <td style={{ padding: "7px 14px", textAlign: "right" }}>0</td>
                    </tr>
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td style={{ padding: "8px 12px", borderRight: "1px solid #f1f5f9" }}>Cộng</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9", color: "#dc2626" }}>
                        (20.000.000)
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right" }}>0</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* V.3 Phải thu khách hàng */}
              <div style={{ marginTop: 14 }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700 }}>
                  2. Phải thu ngắn hạn của khách hàng (Mã số 131 - Thuyết minh V.3(a))
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #cbd5e1", marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: "#e2f0d9", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderRight: "1px solid #c2d9b8" }}>Đối tượng khách hàng</th>
                      <th style={{ padding: "8px 14px", textAlign: "right", width: 180, borderRight: "1px solid #c2d9b8" }}>Số cuối kỳ (31/10/2026)</th>
                      <th style={{ padding: "8px 14px", textAlign: "right", width: 160 }}>Số đầu kỳ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "7px 12px", borderRight: "1px solid #f1f5f9" }}>- Khách hàng thương mại dịch vụ (TK 131)</td>
                      <td style={{ padding: "7px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9", fontWeight: 700, color: "#00a862" }}>
                        20.000.000
                      </td>
                      <td style={{ padding: "7px 14px", textAlign: "right" }}>0</td>
                    </tr>
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td style={{ padding: "8px 12px", borderRight: "1px solid #f1f5f9" }}>Cộng</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9", color: "#00a862" }}>
                        20.000.000
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right" }}>0</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* V.7 Hàng tồn kho */}
              <div style={{ marginTop: 14 }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700 }}>
                  3. Hàng tồn kho (Mã số 140 - Thuyết minh V.7)
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #cbd5e1", marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: "#e2f0d9", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderRight: "1px solid #c2d9b8" }}>Kho / Mặt hàng</th>
                      <th style={{ padding: "8px 14px", textAlign: "right", width: 180, borderRight: "1px solid #c2d9b8" }}>Giá gốc cuối kỳ</th>
                      <th style={{ padding: "8px 14px", textAlign: "right", width: 160 }}>Dự phòng giảm giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "7px 12px", borderRight: "1px solid #f1f5f9" }}>- Hàng hóa kho chính (TK 156)</td>
                      <td style={{ padding: "7px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9", fontWeight: 700 }}>
                        12.475.000
                      </td>
                      <td style={{ padding: "7px 14px", textAlign: "right" }}>0</td>
                    </tr>
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td style={{ padding: "8px 12px", borderRight: "1px solid #f1f5f9" }}>Cộng</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                        12.475.000
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right" }}>0</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* V.17 Phải trả người bán */}
              <div style={{ marginTop: 14 }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700 }}>
                  4. Phải trả người bán ngắn hạn (Mã số 311 - Thuyết minh V.17(a))
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #cbd5e1", marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: "#e2f0d9", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderRight: "1px solid #c2d9b8" }}>Nhà cung cấp</th>
                      <th style={{ padding: "8px 14px", textAlign: "right", width: 180, borderRight: "1px solid #c2d9b8" }}>Số cuối kỳ</th>
                      <th style={{ padding: "8px 14px", textAlign: "right", width: 160 }}>Số đầu kỳ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "7px 12px", borderRight: "1px solid #f1f5f9" }}>- Phải trả nhà cung cấp hàng hóa/dịch vụ (TK 331)</td>
                      <td style={{ padding: "7px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9", fontWeight: 700 }}>
                        17.000.000
                      </td>
                      <td style={{ padding: "7px 14px", textAlign: "right" }}>0</td>
                    </tr>
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td style={{ padding: "8px 12px", borderRight: "1px solid #f1f5f9" }}>Cộng</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                        17.000.000
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right" }}>0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VI. THÔNG TIN BỔ SUNG BÁO CÁO KẾT QUẢ KINH DOANH */}
          {(activeSection === "all" || activeSection === "sec6") && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#00a862", borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                VI. THÔNG TIN BỔ SUNG CHO CÁC KHOẢN MỤC TRÌNH BÀY TRONG BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH
              </h3>

              <div style={{ marginTop: 14 }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700 }}>
                  1. Doanh thu bán hàng và cung cấp dịch vụ (Mã số 01 - Thuyết minh VI.1)
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #cbd5e1", marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: "#e2f0d9", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderRight: "1px solid #c2d9b8" }}>Chỉ tiêu</th>
                      <th style={{ padding: "8px 14px", textAlign: "right", width: 180, borderRight: "1px solid #c2d9b8" }}>Kỳ này (Tháng 10/2026)</th>
                      <th style={{ padding: "8px 14px", textAlign: "right", width: 160 }}>Kỳ trước</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "7px 12px", borderRight: "1px solid #f1f5f9" }}>- Doanh thu bán lẻ & dịch vụ theo hóa đơn GTGT (TK 511)</td>
                      <td style={{ padding: "7px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9", fontWeight: 700, color: "#00a862" }}>
                        20.000.000
                      </td>
                      <td style={{ padding: "7px 14px", textAlign: "right" }}>0</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#fafbfc" }}>
                      <td style={{ padding: "7px 12px", borderRight: "1px solid #f1f5f9" }}>- Các khoản giảm trừ doanh thu (TK 521)</td>
                      <td style={{ padding: "7px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>0</td>
                      <td style={{ padding: "7px 14px", textAlign: "right" }}>0</td>
                    </tr>
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td style={{ padding: "8px 12px", borderRight: "1px solid #f1f5f9" }}>Doanh thu thuần</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", borderRight: "1px solid #f1f5f9", color: "#00a862" }}>
                        20.000.000
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right" }}>0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VII. THÔNG TIN KHÁC */}
          {(activeSection === "all" || activeSection === "sec7") && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, color: "#00a862", borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>
                VII. THÔNG TIN KHÁC
              </h3>
              <ul style={{ paddingLeft: 20, margin: "10px 0", display: "flex", flexDirection: "column", gap: 6 }}>
                <li><strong>1. Các sự kiện phát sinh sau ngày kết thúc kỳ kế toán:</strong> Không có sự kiện trọng yếu nào xảy ra sau ngày 31/10/2026 đòi hỏi phải điều chỉnh hoặc công bố thêm.</li>
                <li><strong>2. Thông tin về các bên liên quan:</strong> Trong kỳ báo cáo không phát sinh giao dịch trọng yếu với các bên liên quan ngoài phạm vi hoạt động thông thường.</li>
              </ul>
            </div>
          )}

          {/* Signature Block */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              textAlign: "center",
              marginTop: 40,
              paddingTop: 20,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <div>
              <strong style={{ display: "block" }}>Người lập biểu</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>(Ký, họ tên)</span>
            </div>
            <div>
              <strong style={{ display: "block" }}>Kế toán trưởng</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>(Ký, họ tên)</span>
            </div>
            <div>
              <strong style={{ display: "block" }}>Người đại diện theo pháp luật</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>(Ký, họ tên, đóng dấu)</span>
              <div style={{ marginTop: 40, fontWeight: 700 }}>Trần Thị Hương</div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Parameter Drawer "Chọn tham số" matching User Screenshot */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(1px)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#ffffff",
              height: "100%",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              animation: "slideInRight 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Giúp (F1)"
                  onClick={() =>
                    notify?.(
                      "Xem hướng dẫn lập Thuyết minh báo cáo tài chính B09-DN theo TT 200."
                    )
                  }
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Đóng"
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body Form matching screenshot */}
            <div
              style={{
                padding: "20px 24px",
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                fontSize: 13,
              }}
            >
              {/* 1. Kỳ báo cáo * */}
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
                  Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  value={draftPeriod}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraftPeriod(val);
                    if (val === "Tháng này") {
                      setDraftFromDate("01/10/2026");
                      setDraftToDate("31/10/2026");
                    } else if (val === "Tháng trước") {
                      setDraftFromDate("01/09/2026");
                      setDraftToDate("30/09/2026");
                    } else if (val === "Quý này") {
                      setDraftFromDate("01/10/2026");
                      setDraftToDate("31/12/2026");
                    } else if (val === "Năm nay") {
                      setDraftFromDate("01/01/2026");
                      setDraftToDate("31/12/2026");
                    }
                  }}
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="Tháng này">Tháng này</option>
                  <option value="Tháng trước">Tháng trước</option>
                  <option value="Quý này">Quý này</option>
                  <option value="Quý trước">Quý trước</option>
                  <option value="6 tháng đầu năm">6 tháng đầu năm</option>
                  <option value="Năm nay">Năm nay</option>
                  <option value="Năm trước">Năm trước</option>
                  <option value="Tùy chọn">Tùy chọn</option>
                </select>
              </div>

              {/* 2. Từ ngày & Đến ngày */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftFromDate}
                      onChange={(e) => setDraftFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftToDate}
                      onChange={(e) => setDraftToDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 3. Checkbox: Lấy dữ liệu từ báo cáo tài chính đã lập */}
              <div style={{ marginTop: 6 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftFetchFromSaved}
                    onChange={(e) => setDraftFetchFromSaved(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Lấy dữ liệu từ báo cáo tài chính đã lập</span>
                </label>
              </div>
            </div>

            {/* Drawer Footer Buttons matching screenshot: Xóa điều kiện, Hủy, Xem báo cáo v */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#475569",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                onClick={handleResetParams}
              >
                Xóa điều kiện
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  style={{
                    height: 34,
                    padding: "0 16px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#334155",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  style={{
                    height: 34,
                    padding: "0 18px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  onClick={handleApplyParams}
                >
                  <span>Xem báo cáo</span>
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Danh sách báo cáo đã lưu */}
      {isSavedReportsOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setIsSavedReportsOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
              width: "100%",
              maxWidth: 620,
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Danh sách Thuyết minh B09-DN đã lưu
              </h3>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setIsSavedReportsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                border: "1px solid #e2e8f0",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left", color: "#475569" }}>
                  <th style={{ padding: "8px 12px" }}>Tên phiên bản</th>
                  <th style={{ padding: "8px 12px" }}>Kỳ áp dụng</th>
                  <th style={{ padding: "8px 12px" }}>Ngày lưu</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>Thuyết minh BCTC Tháng 10/2026</td>
                  <td style={{ padding: "8px 12px" }}>Tháng 10/2026</td>
                  <td style={{ padding: "8px 12px", color: "#64748b" }}>07/10/2026</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <button
                      type="button"
                      style={{
                        padding: "3px 10px",
                        background: "#f0fdf4",
                        color: "#166534",
                        border: "1px solid #bbf7d0",
                        borderRadius: 4,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setIsSavedReportsOpen(false);
                        notify?.("Đã tải bản lưu Thuyết minh BCTC Tháng 10/2026.");
                      }}
                    >
                      Mở lại
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                style={{
                  height: 32,
                  padding: "0 18px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setIsSavedReportsOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
