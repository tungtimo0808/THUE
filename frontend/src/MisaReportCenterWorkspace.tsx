import React, { useState, useMemo } from "react";
import {
  Search,
  Star,
  LineChart,
  Eye,
  Layers,
  X,
  Printer,
  Download,
  Calendar,
  Clock,
  Sparkles,
  Bot,
  ExternalLink,
  ChevronRight,
  Filter,
} from "lucide-react";
import "./misa-reports.css";

export type MisaReportCenterWorkspaceProps = {
  notify?: (msg: string) => void;
};

// All 16 Categories matching Screenshot
export const REPORT_CATEGORIES = [
  { id: "favorites", label: "Yêu thích" },
  { id: "financial", label: "Báo cáo tài chính" },
  { id: "analysis", label: "Báo cáo phân tích" },
  { id: "cash", label: "Tiền mặt" },
  { id: "bank", label: "Tiền gửi" },
  { id: "purchases", label: "Mua hàng" },
  { id: "sales", label: "Bán hàng" },
  { id: "inventory", label: "Kho" },
  { id: "tools", label: "Công cụ dụng cụ" },
  { id: "assets", label: "Tài sản cố định" },
  { id: "payroll", label: "Tiền lương" },
  { id: "tax", label: "Thuế" },
  { id: "cost", label: "Giá thành" },
  { id: "ledger", label: "Tổng hợp" },
  { id: "budget", label: "Ngân sách" },
  { id: "reconciliation", label: "Báo cáo đối chiếu" },
];

// Initial Favorites matching Screenshot exactly (19 reports in 2 columns)
const DEFAULT_FAVORITES = [
  "Tổng hợp mua hàng theo mặt hàng",
  "Số chi tiết mua hàng",
  "Tổng hợp bán hàng theo mặt hàng",
  "Số chi tiết bán hàng",
  "Tổng hợp công nợ phải trả nhà cung cấp",
  "Bảng tính phân bổ công cụ dụng cụ",
  "Tổng hợp công nợ theo đối tượng",
  "Tổng hợp công nợ nhân viên",
  "S36-DN: Sổ chi phí sản xuất, kinh doanh",
  "Số nhật ký chung",
  "S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo yếu tố chi phí",
  "S21-DN: Sổ tài sản cố định",
  "Bảng tính phân bổ chi phí trả trước",
  "Số chi tiết các tài khoản",
  "Chi tiết công nợ phải trả nhà cung cấp",
  "Tổng hợp tồn kho",
  "Số chi tiết vật tư hàng hóa",
  "Chi tiết công nợ phải thu khách hàng",
  "Tổng hợp công nợ phải thu khách hàng",
];

// Complete catalogue of reports grouped by category
const REPORTS_BY_CATEGORY: Record<string, string[]> = {
  financial: [
    "B01a-DN: Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)",
    "B01b-DN: Báo cáo tình hình tài chính giữa niên độ (Dạng tóm tắt)",
    "B02-DN: Báo cáo kết quả hoạt động kinh doanh",
    "B03a-DN: Báo cáo lưu chuyển tiền tệ (Phương pháp trực tiếp)",
    "B03b-DN: Báo cáo lưu chuyển tiền tệ (Phương pháp gián tiếp)",
    "B09-DN: Bản thuyết minh báo cáo tài chính",
    "Bảng cân đối số phát sinh",
  ],
  analysis: [
    "Phân tích cơ cấu tài sản và nguồn vốn",
    "Phân tích khả năng sinh lời (ROS, ROE, ROA)",
    "Phân tích khả năng thanh toán và lưu chuyển tiền",
    "Phân tích biến động doanh thu & chi phí",
    "Phân tích rủi ro tài chính & đòn bẩy nợ",
  ],
  cash: [
    "S03a1 - DN: Sổ nhật ký thu tiền",
    "S03a2 - DN: Sổ nhật ký chi tiền",
    "Sổ kế toán chi tiết quỹ tiền mặt",
    "Bảng kê số dư tiền theo ngày",
    "Dòng tiền thu chi thực tế",
  ],
  bank: [
    "Sổ tiền gửi ngân hàng",
    "Bảng kê số dư tiền theo từng tài khoản ngân hàng",
    "Bảng kê chứng từ thanh toán ngân hàng",
    "Biên bản đối chiếu tài khoản ngân hàng",
  ],
  purchases: [
    "Tổng hợp mua hàng theo mặt hàng",
    "Số chi tiết mua hàng",
    "Tổng hợp công nợ phải trả nhà cung cấp",
    "Chi tiết công nợ phải trả nhà cung cấp",
    "Biên bản đối chiếu công nợ nhà cung cấp",
    "Bảng kê hóa đơn mua hàng vào",
  ],
  sales: [
    "Tổng hợp bán hàng theo mặt hàng",
    "Số chi tiết bán hàng",
    "Tổng hợp công nợ phải thu khách hàng",
    "Chi tiết công nợ phải thu khách hàng",
    "Báo cáo lãi lỗ theo từng đơn hàng",
    "Biên bản đối chiếu công nợ khách hàng",
  ],
  inventory: [
    "Tổng hợp tồn kho",
    "Số chi tiết vật tư hàng hóa",
    "Bảng kê xuất kho theo mặt hàng",
    "Bảng kê nhập kho theo mặt hàng",
    "Báo cáo kiểm kê hàng tồn kho",
  ],
  tools: [
    "Bảng tính phân bổ công cụ dụng cụ",
    "Sổ theo dõi CCDC tại nơi sử dụng",
    "Báo cáo tình hình tăng giảm CCDC",
    "Bảng kê phân bổ chi phí CCDC theo phòng ban",
  ],
  assets: [
    "S21-DN: Sổ tài sản cố định",
    "Bảng trích khấu hao tài sản cố định",
    "Báo cáo tăng giảm tài sản cố định",
    "Sổ tài sản cố định theo phòng ban/bộ phận",
  ],
  payroll: [
    "Bảng thanh toán tiền lương",
    "Bảng tính bảo hiểm xã hội, BHYT, BHTN",
    "Bảng tổng hợp trích nộp kinh phí công đoàn",
    "Tổng hợp chi phí lương theo bộ phận",
  ],
  tax: [
    "Bảng kê hóa đơn mua vào (Mẫu 01-2/GTGT)",
    "Bảng kê hóa đơn bán ra (Mẫu 01-1/GTGT)",
    "Tờ khai thuế GTGT khấu trừ (Mẫu 01/GTGT)",
    "Báo cáo tình hình sử dụng hóa đơn",
    "Bảng kê quyết toán thuế TNCN",
  ],
  cost: [
    "S36-DN: Sổ chi phí sản xuất, kinh doanh",
    "S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo yếu tố chi phí",
    "Bảng tổng hợp chi phí sản xuất theo yếu tố",
    "Bảng phân bổ chi phí chung",
    "Báo cáo giá thành sản phẩm hoàn thành",
  ],
  ledger: [
    "Số nhật ký chung",
    "Số chi tiết các tài khoản",
    "Sổ cái tài khoản",
    "Tổng hợp công nợ theo đối tượng",
    "Tổng hợp công nợ nhân viên",
  ],
  budget: [
    "Kế hoạch ngân sách",
    "Tình hình thực hiện ngân sách",
    "Tình hình thực hiện doanh thu so với kế hoạch",
    "Tình hình chi phí thực tế so với kế hoạch",
  ],
  reconciliation: [
    "Báo cáo đối chiếu số dư kho và sổ cái",
    "Báo cáo đối chiếu công nợ và sổ cái",
    "Báo cáo đối chiếu tiền mặt, tiền gửi với sổ cái",
    "Báo cáo kiểm tra và đối chiếu chứng từ kế toán",
  ],
};

export default function MisaReportCenterWorkspace({ notify }: MisaReportCenterWorkspaceProps) {
  // Subtabs: "all" (Tất cả) | "saved" (Báo cáo đã lưu) | "schedule" (Lịch gửi báo cáo định kỳ)
  const [activeSubtab, setActiveSubtab] = useState<"all" | "saved" | "schedule">("all");
  
  // Left category active ID
  const [activeCategory, setActiveCategory] = useState<string>("favorites");

  // Search keyword
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // Report Language
  const [reportLang, setReportLang] = useState<string>("Tiếng Việt");

  // Favorite reports set
  const [favorites, setFavorites] = useState<Set<string>>(new Set(DEFAULT_FAVORITES));

  // Preview / Filter Drawer Modal State
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Print Announcement Modal
  const [isPrintBannerModalOpen, setIsPrintBannerModalOpen] = useState<boolean>(false);

  const toggleFavorite = (name: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Derive reports for the current category or search query
  const displayedReports = useMemo(() => {
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      const allUnique = Array.from(
        new Set([
          ...DEFAULT_FAVORITES,
          ...Object.values(REPORTS_BY_CATEGORY).flat(),
        ])
      );
      return allUnique.filter((r) => r.toLowerCase().includes(kw));
    }

    if (activeCategory === "favorites") {
      return Array.from(favorites);
    }

    return REPORTS_BY_CATEGORY[activeCategory] || [];
  }, [searchKeyword, activeCategory, favorites]);

  // Split into 2 columns
  const column1 = displayedReports.filter((_, idx) => idx % 2 === 0);
  const column2 = displayedReports.filter((_, idx) => idx % 2 === 1);

  const activeCategoryObj = REPORT_CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div className="misa-reports-workspace">
      {/* 1. Header Bar: Subtabs + Right Announcement Banner */}
      <div className="misa-reports-header-row">
        <div className="misa-reports-subtabs">
          <button
            type="button"
            className={`misa-reports-subtab-btn ${activeSubtab === "all" ? "active" : ""}`}
            onClick={() => setActiveSubtab("all")}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`misa-reports-subtab-btn ${activeSubtab === "saved" ? "active" : ""}`}
            onClick={() => setActiveSubtab("saved")}
          >
            Báo cáo đã lưu
          </button>
          <button
            type="button"
            className={`misa-reports-subtab-btn ${activeSubtab === "schedule" ? "active" : ""}`}
            onClick={() => setActiveSubtab("schedule")}
          >
            <span>Lịch gửi báo cáo định kỳ</span>
            <span className="misa-reports-badge-orange">Mới</span>
          </button>
        </div>

        {/* Right Announcement Banner matching screenshot */}
        <div
          className="misa-reports-banner"
          onClick={() => setIsPrintBannerModalOpen(true)}
          title="Trình in mới của AMIS Kế toán"
        >
          <span className="misa-reports-banner-tag">Mới</span>
          <span>In nhanh hơn - Ổn định hơn - In dữ liệu lớn với trình in mới của AMIS Kế toán.</span>
          <span className="misa-reports-banner-link">Xem ngay &gt;</span>
        </div>
      </div>

      {/* 2. Toolbar */}
      <div className="misa-reports-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="misa-reports-search-wrap">
            <Search size={15} className="misa-reports-search-icon" />
            <input
              type="text"
              placeholder="Tìm theo tên báo cáo"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="misa-reports-ai-link"
            onClick={() => notify?.("Trợ lý AVA Kế toán đã sẵn sàng tìm kiếm thông minh báo cáo cho bạn.")}
          >
            <span>Tìm kiếm nhanh báo cáo với AVA Kế toán</span>
            <span style={{ fontSize: 14 }}>🤖</span>
          </button>
        </div>

        <div className="misa-reports-toolbar-right">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
            <span>Ngôn ngữ báo cáo</span>
            <select
              style={{
                height: 32,
                padding: "0 10px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                background: "#ffffff",
                fontSize: 13,
                outline: "none",
                cursor: "pointer",
              }}
              value={reportLang}
              onChange={(e) => setReportLang(e.target.value)}
            >
              <option value="Tiếng Việt">Tiếng Việt</option>
              <option value="English">English</option>
            </select>
          </div>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              color: "#334155",
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
            onClick={() => notify?.("Tùy chọn ẩn/hiện danh mục báo cáo hệ thống.")}
          >
            <Eye size={14} />
            <span>Ẩn/hiện báo cáo</span>
          </button>

          <button
            type="button"
            style={{
              width: 32,
              height: 32,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
            }}
            title="Đổi dạng hiển thị"
          >
            <Layers size={14} />
          </button>
        </div>
      </div>

      {/* 3. Main Body: Subtab Views */}
      {activeSubtab === "all" && (
        <div className="misa-reports-body">
          {/* Left Category Menu */}
          <aside className="misa-reports-categories">
            {REPORT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`misa-reports-cat-btn ${activeCategory === cat.id && !searchKeyword ? "active" : ""}`}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearchKeyword("");
                }}
              >
                <span>{cat.label}</span>
                {cat.id === "favorites" && (
                  <span style={{ fontSize: 11, color: "#00a862", fontWeight: 700 }}>
                    {favorites.size}
                  </span>
                )}
              </button>
            ))}
          </aside>

          {/* Right Report Grid */}
          <main className="misa-reports-content">
            <h3 className="misa-reports-content-title">
              {searchKeyword
                ? `Kết quả tìm kiếm cho "${searchKeyword}" (${displayedReports.length})`
                : activeCategoryObj?.label || "Báo cáo"}
            </h3>

            {displayedReports.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
                Không tìm thấy báo cáo nào phù hợp.
              </div>
            ) : (
              <div className="misa-reports-grid-table">
                {/* Column 1 */}
                <div className="misa-reports-grid-col">
                  {column1.map((report) => (
                    <div key={report} className="misa-reports-item-row">
                      <a
                        href={`#${report}`}
                        className="misa-reports-item-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedReport(report);
                        }}
                      >
                        {report}
                      </a>
                      <div className="misa-reports-item-actions">
                        <button
                          type="button"
                          className="misa-reports-action-icon"
                          title="Xem dạng biểu đồ trực quan"
                          onClick={() => setSelectedReport(report)}
                        >
                          <LineChart size={16} />
                        </button>
                        <button
                          type="button"
                          className={`misa-reports-star-btn ${favorites.has(report) ? "starred" : ""}`}
                          title={favorites.has(report) ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                          onClick={() => toggleFavorite(report)}
                        >
                          <Star
                            size={16}
                            fill={favorites.has(report) ? "#00a862" : "none"}
                            color={favorites.has(report) ? "#00a862" : "#94a3b8"}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Column 2 */}
                <div className="misa-reports-grid-col">
                  {column2.map((report) => (
                    <div key={report} className="misa-reports-item-row">
                      <a
                        href={`#${report}`}
                        className="misa-reports-item-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedReport(report);
                        }}
                      >
                        {report}
                      </a>
                      <div className="misa-reports-item-actions">
                        <button
                          type="button"
                          className="misa-reports-action-icon"
                          title="Xem dạng biểu đồ trực quan"
                          onClick={() => setSelectedReport(report)}
                        >
                          <LineChart size={16} />
                        </button>
                        <button
                          type="button"
                          className={`misa-reports-star-btn ${favorites.has(report) ? "starred" : ""}`}
                          title={favorites.has(report) ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                          onClick={() => toggleFavorite(report)}
                        >
                          <Star
                            size={16}
                            fill={favorites.has(report) ? "#00a862" : "none"}
                            color={favorites.has(report) ? "#00a862" : "#94a3b8"}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Subtab 2: Báo cáo đã lưu */}
      {activeSubtab === "saved" && (
        <div style={{ padding: 24, background: "#ffffff", minHeight: 400 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Danh sách mẫu báo cáo đã lưu</h3>
            <button
              type="button"
              style={{
                height: 34,
                padding: "0 18px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => notify?.("Tạo mẫu báo cáo tùy chỉnh mới...")}
            >
              + Tạo mẫu báo cáo mới
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", textAlign: "left", color: "#334155" }}>
                <th style={{ padding: "10px 14px" }}>Tên mẫu báo cáo</th>
                <th style={{ padding: "10px 14px" }}>Báo cáo gốc</th>
                <th style={{ padding: "10px 14px" }}>Người tạo</th>
                <th style={{ padding: "10px 14px" }}>Ngày tạo</th>
                <th style={{ padding: "10px 14px", textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600, color: "#00a862" }}>Báo cáo bán hàng theo nhóm Khách VIP</td>
                <td style={{ padding: "10px 14px" }}>Tổng hợp bán hàng theo mặt hàng</td>
                <td style={{ padding: "10px 14px" }}>Nguyễn Văn Kế Toán</td>
                <td style={{ padding: "10px 14px" }}>15/09/2026</td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    onClick={() => setSelectedReport("Tổng hợp bán hàng theo mặt hàng")}
                  >
                    Mở báo cáo
                  </button>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "10px 14px", fontWeight: 600, color: "#00a862" }}>Theo dõi công nợ NCC quá hạn 30 ngày</td>
                <td style={{ padding: "10px 14px" }}>Tổng hợp công nợ phải trả nhà cung cấp</td>
                <td style={{ padding: "10px 14px" }}>Nguyễn Văn Kế Toán</td>
                <td style={{ padding: "10px 14px" }}>22/09/2026</td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    onClick={() => setSelectedReport("Tổng hợp công nợ phải trả nhà cung cấp")}
                  >
                    Mở báo cáo
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Subtab 3: Lịch gửi báo cáo định kỳ */}
      {activeSubtab === "schedule" && (
        <div style={{ padding: 24, background: "#ffffff", minHeight: 400 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Lịch tự động gửi báo cáo qua Email</h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                Tự động kết xuất và gửi báo cáo định kỳ cho Ban Giám đốc và các Trưởng bộ phận.
              </p>
            </div>
            <button
              type="button"
              style={{
                height: 34,
                padding: "0 18px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => notify?.("Thiết lập lịch gửi báo cáo mới...")}
            >
              + Thêm lịch gửi mới
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e2e8f0" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", textAlign: "left", color: "#334155" }}>
                <th style={{ padding: "10px 14px" }}>Tên lịch</th>
                <th style={{ padding: "10px 14px" }}>Báo cáo</th>
                <th style={{ padding: "10px 14px" }}>Tần suất</th>
                <th style={{ padding: "10px 14px" }}>Người nhận</th>
                <th style={{ padding: "10px 14px" }}>Định dạng</th>
                <th style={{ padding: "10px 14px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>Báo cáo Doanh thu tuần cho Giám đốc</td>
                <td style={{ padding: "10px 14px" }}>Tổng hợp bán hàng theo mặt hàng</td>
                <td style={{ padding: "10px 14px" }}>Thứ Hai hàng tuần (08:00)</td>
                <td style={{ padding: "10px 14px" }}>ceo@misa.vn</td>
                <td style={{ padding: "10px 14px" }}>Excel, PDF</td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  <span style={{ padding: "2px 8px", background: "#f0fdf4", color: "#166534", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                    Đang hoạt động
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Modal: Report Preview / Parameter Drawer */}
      {selectedReport && (
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
            padding: 16,
          }}
          onClick={() => setSelectedReport(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
              width: "100%",
              maxWidth: 860,
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                {selectedReport}
              </h3>
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 4,
                }}
                onClick={() => setSelectedReport(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Parameters */}
            <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#475569" }}>Kỳ báo cáo:</span>
                <select style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff" }}>
                  <option>Năm nay (2026)</option>
                  <option>Quý này (Quý 3/2026)</option>
                  <option>Tháng này (Tháng 09/2026)</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#475569" }}>Đơn vị:</span>
                <select style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff" }}>
                  <option>Tung</option>
                  <option>Công ty Cổ phần MISA</option>
                  <option>Văn phòng Tổng công ty</option>
                </select>
              </div>

              <span style={{ marginLeft: "auto", color: "#64748b" }}>Đơn vị tính: <strong>Đồng</strong></span>
            </div>

            {/* Report Table Preview */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Mã hàng / Đối tượng</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Tên mặt hàng / Đối tượng</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>ĐVT</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Số lượng</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Đơn giá</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>HH001</td>
                    <td style={{ padding: "8px 12px" }}>Máy tính để bàn Dell Vostro</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>Bộ</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>15</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>14.500.000</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>217.500.000</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>HH002</td>
                    <td style={{ padding: "8px 12px" }}>Màn hình LG 27 inch 4K</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>Chiếc</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>20</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>6.200.000</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>124.000.000</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600 }}>DV001</td>
                    <td style={{ padding: "8px 12px" }}>Phần mềm bản quyền Microsoft Office 365</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>Gói</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>50</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>1.800.000</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>90.000.000</td>
                  </tr>
                  <tr style={{ background: "#f0fdf4", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                    <td colSpan={3} style={{ padding: "9px 12px", color: "#166534" }}>TỔNG CỘNG</td>
                    <td style={{ padding: "9px 12px", textAlign: "right" }}>85</td>
                    <td style={{ padding: "9px 12px" }}></td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#00a862", fontWeight: 700 }}>
                      431.500.000
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 20px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 16px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#334155",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
                onClick={() => notify?.("Đã xuất khẩu báo cáo ra Excel thành công.")}
              >
                <Download size={14} />
                <span>Xuất Excel</span>
              </button>
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 16px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#334155",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
                onClick={() => notify?.("Đang chuẩn bị dữ liệu in báo cáo...")}
              >
                <Printer size={14} />
                <span>In báo cáo</span>
              </button>
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 22px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setSelectedReport(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: AMIS Print Engine Announcement */}
      {isPrintBannerModalOpen && (
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
            padding: 16,
          }}
          onClick={() => setIsPrintBannerModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
              width: "100%",
              maxWidth: 540,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="misa-reports-badge-orange">Mới</span>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Trình in thông minh mới của AMIS Kế toán</h3>
              </div>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setIsPrintBannerModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.6 }}>
              Phiên bản trình in mới được tối ưu hóa cho các báo cáo khối lượng lớn hàng chục ngàn dòng:
            </p>
            <ul style={{ fontSize: 13, color: "#475569", lineHeight: 1.8, paddingLeft: 20 }}>
              <li>Tốc độ render nhanh hơn gấp <strong>3 lần</strong>.</li>
              <li>Hỗ trợ xuất PDF và in hàng loạt mà không gây treo trình duyệt.</li>
              <li>Tự động căn lề và định dạng trang in chuẩn khổ giấy A4, A3.</li>
            </ul>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 22px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setIsPrintBannerModalOpen(false)}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
