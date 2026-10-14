import type { CSSProperties } from "react";

const cell: CSSProperties = { border: "1px solid #94999e", padding: "8px", textAlign: "left" };
const historyHeaders = ["Số chứng từ", "Ngày chứng từ", "Diễn giải", "Nguyên giá", "Tăng/giảm giá trị tính KH", "Tổng giá trị tính KH", "Giá trị hao mòn", "Hao mòn lũy kế"];
const accessoryHeaders = ["Số TT", "Tên, quy cách dụng cụ, phụ tùng", "ĐVT", "Số lượng", "Giá trị"];

export default function FixedAssetCardPreview() {
  return <section aria-label="Mẫu Thẻ tài sản cố định" style={{ paddingBottom: 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Đơn vị: Công ty TNHH Minh An</span><strong>Mẫu số: S23-DN</strong></div>
    <h2 style={{ textAlign: "center", fontSize: 18 }}>THẺ TÀI SẢN CỐ ĐỊNH</h2>
    <p style={{ textAlign: "center" }}>Số: ……………………</p><p style={{ textAlign: "center" }}>Ngày … tháng … năm …</p>
    <p><strong>Chi nhánh: Trụ sở chính</strong></p>
    <p>Căn cứ vào biên bản giao nhận TSCĐ số …………………… ngày … tháng … năm …</p>
    <p>Tên, ký mã hiệu, quy cách (cấp hạng) TSCĐ: Máy gia công CNC</p>
    <p>Số hiệu TSCĐ: TS-MAY01</p>
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px 24px" }}>
      <span>Nước sản xuất (xây dựng): ……………………</span><span>Năm sản xuất: ……………………</span>
      <span>Bộ phận quản lý, sử dụng: ……………………</span><span>Năm đưa vào sử dụng: ……………………</span>
    </div>
    <p>Công suất (diện tích thiết kế): ……………………</p><p>Đình chỉ sử dụng TSCĐ ngày … tháng … năm …</p><p>Lý do đình chỉ: ……………………</p>
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr>{historyHeaders.map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead>
      <tbody><tr>{historyHeaders.map(label=><td key={label} style={{ ...cell, height: 32 }}></td>)}</tr></tbody>
    </table></div>
    <h3 style={{ textAlign: "center", marginTop: 24 }}>DỤNG CỤ PHỤ TÙNG KÈM THEO</h3>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr>{accessoryHeaders.map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead>
      <tbody><tr><td style={cell}>1</td>{accessoryHeaders.slice(1).map(label=><td key={label} style={cell}></td>)}</tr></tbody>
    </table>
    <p>Lý do giảm: ……………………</p><p style={{ textAlign: "right" }}>Ngày … tháng … năm …</p>
    <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
      <div><strong>Người lập</strong><p>(Ký, họ tên)</p></div><div><strong>Kế toán trưởng</strong><p>(Ký, họ tên)</p></div><div><strong>Giám đốc</strong><p>(Ký, họ tên, đóng dấu)</p></div>
    </div>
  </section>;
}
