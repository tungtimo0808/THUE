import type { CSSProperties } from "react";

const cellStyle: CSSProperties = { border: "1px solid #94999e", padding: "6px", verticalAlign: "middle" };
const columns = ["Số hiệu", "Ngày, tháng", "Nước sản xuất", "Tháng, năm đưa vào sử dụng", "Số hiệu TSCĐ", "Nguyên giá", "Giá trị tính KH", "Tỷ lệ khấu hao", "Khấu hao", "Khấu hao lũy kế", "Số hiệu", "Ngày, tháng, năm", "Lý do giảm TSCĐ"];

export default function S21AssetRegisterPreview() {
  return <section aria-label="Mẫu S21-DN: Sổ tài sản cố định" style={{ paddingBottom: 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
      <span>Đơn vị: Công ty TNHH Minh An</span><strong>Mẫu số: S21-DN</strong>
    </div>
    <h2 style={{ textAlign: "center", fontSize: 18, margin: "8px 0" }}>SỔ TÀI SẢN CỐ ĐỊNH</h2>
    <p style={{ textAlign: "center", margin: "8px 0" }}>Dữ liệu mẫu</p>
    <div style={{ display: "flex", gap: 32, marginBottom: 12 }}><span>Loại TSCĐ: Tất cả</span><span>Tên loại: Tất cả</span></div>
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 1400, borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr><th rowSpan={3} style={cellStyle}>STT</th><th colSpan={7} style={cellStyle}>Ghi tăng TSCĐ</th><th colSpan={3} style={cellStyle}>Khấu hao TSCĐ</th><th colSpan={3} style={cellStyle}>Ghi giảm TSCĐ</th></tr>
          <tr><th colSpan={2} style={cellStyle}>Chứng từ</th>{columns.slice(2,10).map((label,index)=><th key={index} rowSpan={2} style={cellStyle}>{label}</th>)}<th colSpan={2} style={cellStyle}>Chứng từ</th><th rowSpan={2} style={cellStyle}>Lý do giảm TSCĐ</th></tr>
          <tr>{[columns[0],columns[1],columns[10],columns[11]].map((label,index)=><th key={index} style={cellStyle}>{label}</th>)}</tr>
        </thead>
        <tbody>
          <tr><th colSpan={5} style={{ ...cellStyle, textAlign: "left" }}>Mã TSCĐ: TS-MAY01</th><th colSpan={9} style={{ ...cellStyle, textAlign: "left" }}>Tên TSCĐ: Máy gia công CNC</th></tr>
          <tr><td style={cellStyle}>1</td>{columns.map((_,index)=><td key={index} style={cellStyle}>{index === 4 ? "TS-MAY01" : ""}</td>)}</tr>
          <tr><th colSpan={6} style={{ ...cellStyle, textAlign: "left" }}>Cộng</th>{Array.from({length:8},(_,index)=><td key={index} style={cellStyle}></td>)}</tr>
          <tr><th colSpan={6} style={{ ...cellStyle, textAlign: "left" }}>Tổng cộng</th>{Array.from({length:8},(_,index)=><td key={index} style={cellStyle}></td>)}</tr>
        </tbody>
      </table>
    </div>
    <p>Sổ này có 01 trang, đánh số từ trang 01 đến trang 01</p><p>Ngày mở sổ: ……………………</p>
    <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center", marginTop: 24 }}>
      <div><strong>Người ghi sổ</strong><p>(Ký, họ tên)</p></div><div><strong>Kế toán trưởng</strong><p>(Ký, họ tên)</p></div><div><span>Ngày … tháng … năm …</span><p><strong>Giám đốc</strong></p><p>(Ký, họ tên, đóng dấu)</p></div>
    </div>
  </section>;
}
