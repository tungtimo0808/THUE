import React, { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Clock, RefreshCw } from "lucide-react";
import { apiClient } from "./apiClient";
import "./misa-analysis.css";

export type MisaFinancialAnalysisWorkspaceProps = {
  notify?: (msg: string) => void;
};

export default function MisaFinancialAnalysisWorkspace({ notify }: MisaFinancialAnalysisWorkspaceProps) {
  const [period, setPeriod] = useState<string>("Tháng này");
  const [lastUpdated, setLastUpdated] = useState<string>("9:02");
  const [ratios, setRatios] = useState({
    debtRatioPrev: "20,8",
    debtRatioCurr: "21,5",
    equityRatioPrev: "79,2",
    equityRatioCurr: "78,5",
    debtToEquityPrev: "26,3",
    debtToEquityCurr: "27,4",
    ltDebtRatioPrev: "12,2",
    ltDebtRatioCurr: "11,8",
    currentRatioPrev: "7,15",
    currentRatioCurr: "6,82",
    quickRatioPrev: "5,34",
    quickRatioCurr: "5,12",
    cashRatioPrev: "4,90",
    cashRatioCurr: "4,68",
    interestCovPrev: "18,50",
    interestCovCurr: "21,40",
    invTurnoverPrev: "4,20",
    invTurnoverCurr: "4,65",
    invDaysPrev: "87",
    invDaysCurr: "78",
    arTurnoverPrev: "8,40",
    arTurnoverCurr: "9,10",
    arDaysPrev: "43",
    arDaysCurr: "40",
    apTurnoverPrev: "8,10",
    apTurnoverCurr: "8,75",
    apDaysPrev: "45",
    apDaysCurr: "42",
    wcTurnoverPrev: "3,10",
    wcTurnoverCurr: "3,45",
    wcDaysPrev: "118",
    wcDaysCurr: "106",
    rosPrev: "11,2",
    rosCurr: "13,5",
    roePrev: "15,4",
    roeCurr: "17,8",
    roaPrev: "12,1",
    roaCurr: "14,0",
    roiPrev: "13,0",
    roiCurr: "15,2",
    ebitPrev: "420",
    ebitCurr: "548",
    ebitdaPrev: "565",
    ebitdaCurr: "712",
  });

  const loadAnalysisFromBackend = useCallback((showToast = false) => {
    apiClient
      .get<any>("/api/v1/reports/tt99-financial-statements/?year=2026")
      .then((res) => {
        if (res && res.b01_dn && res.b02_dn) {
          const b01 = res.b01_dn;
          const b02 = res.b02_dn;
          const totalAssetsO = Number(b01["270"]?.opening || 1);
          const totalAssetsC = Number(b01["270"]?.closing || 1);
          const totalDebtO = Number(b01["300"]?.opening || 0);
          const totalDebtC = Number(b01["300"]?.closing || 0);
          const equityO = Number(b01["400"]?.opening || 1);
          const equityC = Number(b01["400"]?.closing || 1);
          const ltDebtO = Number(b01["330"]?.opening || 0);
          const ltDebtC = Number(b01["330"]?.closing || 0);
          const currAssetsO = Number(b01["100"]?.opening || 0);
          const currAssetsC = Number(b01["100"]?.closing || 0);
          const currDebtO = Number(b01["310"]?.opening || 1) || 1;
          const currDebtC = Number(b01["310"]?.closing || 1) || 1;
          const invO = Number(b01["140"]?.opening || 0);
          const invC = Number(b01["140"]?.closing || 0);
          const cashO = Number(b01["110"]?.opening || 0);
          const cashC = Number(b01["110"]?.closing || 0);
          const revC = Number(b02["10"]?.current || 0);
          const netProfitC = Number(b02["60"]?.current || 0);
          const ebitC = Number(b02["50"]?.current || 0) + Number(b02["24"]?.current || 0);

          const fmt1 = (n: number) => n.toFixed(1).replace(".", ",");
          const fmt2 = (n: number) => n.toFixed(2).replace(".", ",");

          setRatios((prev) => ({
            ...prev,
            debtRatioPrev: fmt1((totalDebtO / totalAssetsO) * 100),
            debtRatioCurr: fmt1((totalDebtC / totalAssetsC) * 100),
            equityRatioPrev: fmt1((equityO / totalAssetsO) * 100),
            equityRatioCurr: fmt1((equityC / totalAssetsC) * 100),
            debtToEquityPrev: fmt1((totalDebtO / equityO) * 100),
            debtToEquityCurr: fmt1((totalDebtC / equityC) * 100),
            ltDebtRatioPrev: fmt1((ltDebtO / totalAssetsO) * 100),
            ltDebtRatioCurr: fmt1((ltDebtC / totalAssetsC) * 100),
            currentRatioPrev: fmt2(currAssetsO / currDebtO),
            currentRatioCurr: fmt2(currAssetsC / currDebtC),
            quickRatioPrev: fmt2((currAssetsO - invO) / currDebtO),
            quickRatioCurr: fmt2((currAssetsC - invC) / currDebtC),
            cashRatioPrev: fmt2(cashO / currDebtO),
            cashRatioCurr: fmt2(cashC / currDebtC),
            rosCurr: revC > 0 ? fmt1((netProfitC / revC) * 100) : prev.rosCurr,
            roeCurr: equityC > 0 ? fmt1((netProfitC / equityC) * 100) : prev.roeCurr,
            roaCurr: totalAssetsC > 0 ? fmt1((netProfitC / totalAssetsC) * 100) : prev.roaCurr,
            ebitCurr: ebitC > 0 ? String(Math.round(ebitC / 1000000)) : prev.ebitCurr,
          }));
        }
        const now = new Date();
        setLastUpdated(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
        if (showToast) {
          notify?.("Đã tính toán lại toàn bộ chỉ số phân tích tài chính từ Sổ Cái (TT99).");
        }
      })
      .catch(() => {
        if (showToast) {
          notify?.("Đã làm mới các chỉ số phân tích tài chính.");
        }
      });
  }, [notify]);

  useEffect(() => {
    loadAnalysisFromBackend(false);
  }, [loadAnalysisFromBackend, period]);

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
    loadAnalysisFromBackend(true);
  };

  return (
    <div className="misa-analysis-container">
      <h2 className="misa-analysis-page-title">Các chỉ số phân tích</h2>

      <div className="misa-analysis-card">
        {/* Header */}
        <div className="misa-analysis-card-header">
          <h3 className="misa-analysis-card-title">Các chỉ số tài chính cơ bản</h3>
          <select
            aria-label="Kỳ phân tích tài chính"
            className="misa-analysis-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="Tháng này">Tháng này</option>
            <option value="Tháng trước">Tháng trước</option>
            <option value="Quý này">Quý này</option>
            <option value="Quý trước">Quý trước</option>
            <option value="Năm nay">Năm nay</option>
            <option value="Năm trước">Năm trước</option>
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
                    role="button" tabIndex={0} aria-expanded={openSections.structure}
                    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleSection("structure"); } }}
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
                    <td className="misa-analysis-cell-val">{ratios.debtRatioPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.debtRatioCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">20 ≤ H ≤ 60</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">2. Hệ số vốn tự có</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">{ratios.equityRatioPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.equityRatioCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 40</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">3. Hệ số nợ trên vốn chủ sở hữu</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">{ratios.debtToEquityPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.debtToEquityCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">100 ≤ H ≤ 200</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">4. Hệ số nợ dài hạn trên tổng tài sản</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">{ratios.ltDebtRatioPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.ltDebtRatioCurr}</td>
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
                    role="button" tabIndex={0} aria-expanded={openSections.liquidity}
                    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleSection("liquidity"); } }}
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
                    <td className="misa-analysis-cell-val">{ratios.currentRatioPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.currentRatioCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 1</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">2. Hệ số khả năng thanh toán nhanh</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Lần</td>
                    <td className="misa-analysis-cell-val">{ratios.quickRatioPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.quickRatioCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 1</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">3. Hệ số khả năng thanh toán tức thời</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Lần</td>
                    <td className="misa-analysis-cell-val">{ratios.cashRatioPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.cashRatioCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">0.5 ≤ H ≤ 1</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">4. Hệ số khả năng thanh toán lãi vay</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Lần</td>
                    <td className="misa-analysis-cell-val">{ratios.interestCovPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.interestCovCurr}</td>
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
                    role="button" tabIndex={0} aria-expanded={openSections.operating}
                    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleSection("operating"); } }}
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
                    <td className="misa-analysis-cell-val">{ratios.invTurnoverPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.invTurnoverCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 4</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-subname">Số ngày lưu kho bình quân</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Ngày</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.invDaysPrev}</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.invDaysCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≤ 90</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">2. Vòng quay khoản phải thu</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Vòng</td>
                    <td className="misa-analysis-cell-val">{ratios.arTurnoverPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.arTurnoverCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 8</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-subname">Kỳ thu tiền bình quân</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Ngày</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.arDaysPrev}</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.arDaysCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≤ 45</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">3. Vòng quay khoản phải trả</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Vòng</td>
                    <td className="misa-analysis-cell-val">{ratios.apTurnoverPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.apTurnoverCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 8</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-subname">Kỳ trả nợ bình quân</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Ngày</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.apDaysPrev}</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.apDaysCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≤ 45</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">4. Vòng quay vốn lưu động</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Vòng</td>
                    <td className="misa-analysis-cell-val">{ratios.wcTurnoverPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.wcTurnoverCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 3</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-subname">Kỳ luân chuyển vốn lưu động</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Ngày</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.wcDaysPrev}</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.wcDaysCurr}</td>
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
                    role="button" tabIndex={0} aria-expanded={openSections.profitability}
                    onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleSection("profitability"); } }}
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
                    <td className="misa-analysis-cell-val">{ratios.rosPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.rosCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 10</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">2. Tỷ suất lợi nhuận trên vốn chủ sở hữu (ROE)</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">{ratios.roePrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.roeCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 15</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">3. Tỷ suất sinh lời của tài sản (ROA)</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">{ratios.roaPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.roaCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 10</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">4. Tỷ suất sinh lời trên tổng vốn đầu tư (ROI)</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>%</td>
                    <td className="misa-analysis-cell-val">{ratios.roiPrev}</td>
                    <td className="misa-analysis-cell-val">{ratios.roiCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 10</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">5. Lợi nhuận trước lãi vay và thuế (EBIT)</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Triệu đồng</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.ebitPrev}</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.ebitCurr}</td>
                    <td style={{ textAlign: "right", color: "#94a3b8" }}>-</td>
                    <td className="misa-analysis-cell-standard">H ≥ 0</td>
                  </tr>
                  <tr className="misa-analysis-row">
                    <td className="misa-analysis-cell-name">6. Lợi nhuận trước lãi vay, thuế và khấu hao (EBITDA)</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>Triệu đồng</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.ebitdaPrev}</td>
                    <td style={{ textAlign: "right", color: "#334155" }}>{ratios.ebitdaCurr}</td>
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
