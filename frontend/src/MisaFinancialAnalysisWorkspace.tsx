import React, { useState } from "react";
import { ChevronDown, ChevronRight, Clock, RefreshCw } from "lucide-react";
import "./misa-analysis.css";

export type MisaFinancialAnalysisWorkspaceProps = {
  notify?: (msg: string) => void;
};

export default function MisaFinancialAnalysisWorkspace({ notify }: MisaFinancialAnalysisWorkspaceProps) {
  const [period, setPeriod] = useState<string>("Tháng này");
  const [lastUpdated, setLastUpdated] = useState<string>("9:02");

  // Section collapse state
  const [openSections, setOpenSections] = useState<{
    structure: boolean;
    liquidity: boolean;
    operating: boolean;
    profitability: boolean;
  }>({
    structure: true,
    liquidity: true,
    operating: true,
    profitability: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRefresh = () => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setLastUpdated(timeStr);
    notify?.("Đã tính toán lại toàn bộ chỉ số tài chính.");
  };

  return (
    <div className="misa-analysis-container">
      <h2 className="misa-analysis-page-title">Các chỉ số phân tích</h2>

      <div className="misa-analysis-card">
        {/* Header */}
        <div className="misa-analysis-card-header">
          <h3 className="misa-analysis-card-title">Các chỉ số tài chính cơ bản</h3>
          <select
            className="misa-analysis-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="Tháng này">Tháng này</option>
            <option value="Tháng trước">Tháng trước</option>
            <option value="Quý này">Quý này</option>
            <option value="Năm nay">Năm nay</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table className="misa-analysis-table">
            <thead>
              <tr>
                <th style={{ width: "45%" }}>Tên</th>
                <th style={{ width: "10%" }}>ĐVT</th>
                <th style={{ width: "10%" }}>Kỳ trước</th>
                <th style={{ width: "10%" }}>Kỳ này</th>
                <th style={{ width: "10%" }}>+/-</th>
                <th style={{ width: "15%" }}>Tiêu chuẩn</th>
              </tr>
            </thead>
            <tbody>
              {/* Group 1: Cơ cấu tài chính và cơ cấu tài sản */}
              <tr>
                <td colSpan={6} style={{ padding: 0 }}>
                  <div
                    className="misa-analysis-group-header"
                    onClick={() => toggleSection("structure")}
                  >
                    {openSections.structure ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <span>Cơ cấu tài chính và cơ cấu tài sản</span>
                  </div>
                </td>
              </tr>
              {openSections.structure && (
                <>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">1. Hệ số nợ</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">0</td>
                    <td className="misa-analysis-cell-val">0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">20 ≤ H ≤ 60</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">2. Hệ số vốn tự có</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">0</td>
                    <td className="misa-analysis-cell-val">0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 40</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">3. Hệ số nợ trên vốn chủ sở hữu</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">0</td>
                    <td className="misa-analysis-cell-val">0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">100 ≤ H ≤ 200</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">4. Hệ số nợ dài hạn trên tổng tài sản</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">0</td>
                    <td className="misa-analysis-cell-val">0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≤ 50</td>
                  </tr>
                </>
              )}

              {/* Group 2: Hệ số thanh toán */}
              <tr>
                <td colSpan={6} style={{ padding: 0 }}>
                  <div
                    className="misa-analysis-group-header"
                    onClick={() => toggleSection("liquidity")}
                  >
                    {openSections.liquidity ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <span>Hệ số thanh toán</span>
                  </div>
                </td>
              </tr>
              {openSections.liquidity && (
                <>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">1. Hệ số khả năng thanh toán hiện hành</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Lần</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 1</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">2. Hệ số khả năng thanh toán nhanh</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Lần</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 1</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">3. Hệ số khả năng thanh toán tức thời</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Lần</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">0.5 ≤ H ≤ 1</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">4. Hệ số khả năng thanh toán lãi vay</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Lần</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 1</td>
                  </tr>
                </>
              )}

              {/* Group 3: Khả năng hoạt động */}
              <tr>
                <td colSpan={6} style={{ padding: 0 }}>
                  <div
                    className="misa-analysis-group-header"
                    onClick={() => toggleSection("operating")}
                  >
                    {openSections.operating ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <span>Khả năng hoạt động</span>
                  </div>
                </td>
              </tr>
              {openSections.operating && (
                <>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">1. Vòng quay hàng tồn kho</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Vòng</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 4</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-subname">Số ngày lưu kho bình quân</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Ngày</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≤ 90</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">2. Vòng quay khoản phải thu</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Vòng</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 8</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-subname">Kỳ thu tiền bình quân</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Ngày</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≤ 45</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">3. Vòng quay khoản phải trả</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Vòng</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 8</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-subname">Kỳ trả nợ bình quân</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Ngày</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≤ 45</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">4. Vòng quay vốn lưu động</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Vòng</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td className="misa-analysis-cell-val">0,00</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 3</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-subname">Kỳ luân chuyển vốn lưu động</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Ngày</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≤ 120</td>
                  </tr>
                </>
              )}

              {/* Group 4: Khả năng sinh lời */}
              <tr>
                <td colSpan={6} style={{ padding: 0 }}>
                  <div
                    className="misa-analysis-group-header"
                    onClick={() => toggleSection("profitability")}
                  >
                    {openSections.profitability ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <span>Khả năng sinh lời</span>
                  </div>
                </td>
              </tr>
              {openSections.profitability && (
                <>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">1. Tỷ suất lợi nhuận sau thuế trên doanh thu (ROS)</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">0,0</td>
                    <td className="misa-analysis-cell-val">0,0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 10</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">2. Tỷ suất lợi nhuận trên vốn chủ sở hữu (ROE)</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">0,0</td>
                    <td className="misa-analysis-cell-val">0,0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 15</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">3. Tỷ suất sinh lời của tài sản (ROA)</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">0,0</td>
                    <td className="misa-analysis-cell-val">0,0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 10</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">4. Tỷ suất sinh lời trên tổng vốn đầu tư (ROI)</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">0,0</td>
                    <td className="misa-analysis-cell-val">0,0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 10</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">5. Lợi nhuận trước lãi vay và thuế (EBIT)</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Triệu đồng</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 0</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">6. Lợi nhuận trước lãi vay, thuế và khấu hao (EBITDA)</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Triệu đồng</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>0</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 0</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="misa-analysis-footer">
          <Clock size={13} color="#64748b" />
          <span>Số liệu tính đến: {lastUpdated}</span>
          <button
            type="button"
            className="misa-analysis-refresh-link"
            onClick={handleRefresh}
          >
            Tải lại
          </button>
        </div>
      </div>
    </div>
  );
}
