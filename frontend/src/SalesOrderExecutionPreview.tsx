import type { CSSProperties } from "react";
const cell: CSSProperties = { border: "1px solid #94999e", padding: 6, textAlign: "left" };
const groups = [
  { title: "Thông tin chung", headers: ["Số đơn hàng", "Ngày đơn hàng", "Ngày giao hàng", "Khách hàng", "Giá trị đặt hàng", "Giá trị đã giao", "Giá trị còn lại", "% hoàn thành"] },
  { title: "Chi tiết tình trạng của đơn đặt hàng", headers: ["Mã hàng", "Tên hàng", "ĐVT", "Số lượng đặt hàng", "Số lượng đã giao", "Số lượng còn lại", "% hoàn thành"] },
  { title: "Chi tiết tình hình giao hàng", headers: ["Mã hàng", "Tên hàng", "ĐVT", "Ngày hạch toán", "Ngày chứng từ", "Số chứng từ", "Số lượng", "Đơn giá", "Thành tiền", "Tổng tiền thanh toán"] },
];
export default function SalesOrderExecutionPreview() {
  return <section aria-label="Mẫu chi tiết tình hình thực hiện đơn đặt hàng" style={{ paddingBottom: 24 }}>
    <p>Đơn vị: Công ty TNHH Minh An</p><h2 style={{ textAlign: "center", fontSize: 18 }}>BÁO CÁO CHI TIẾT TÌNH HÌNH THỰC HIỆN ĐƠN ĐẶT HÀNG</h2>
    <p style={{ textAlign: "center" }}>Từ ngày …………………… đến ngày ……………………</p>
    {groups.map((group,index)=><div key={group.title}><h3 style={{ fontSize: 13, margin: "12px 0 4px" }}>{group.title}</h3><div style={{ overflowX: "auto" }}>
      <table aria-label={group.title} style={{ width: "100%", minWidth: index === 2 ? 1000 : 800, borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr>{group.headers.map(header=><th key={header} style={cell}>{header}</th>)}</tr></thead>
        <tbody><tr>{group.headers.map(header=><td key={header} style={{ ...cell, height: 24 }}>{header === "Số đơn hàng" ? "DDH-2026-001" : header === "Khách hàng" ? "Công ty TNHH Hoàng Minh" : header === "Mã hàng" ? "HH001" : header === "Tên hàng" ? "Màn hình LG 24 inch" : ""}</td>)}</tr>
          {index === 2 && <><tr><th colSpan={6} style={cell}>Cộng theo mặt hàng: HH001</th>{group.headers.slice(6).map(header=><td key={header} style={cell}></td>)}</tr><tr><th colSpan={8} style={cell}>Tổng cộng</th><td style={cell}></td><td style={cell}></td></tr></>}
        </tbody>
      </table>
    </div></div>)}
    <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center", marginTop: 24 }}><div><strong>Người lập</strong><p>(Ký, họ tên)</p></div><div><strong>Kế toán trưởng</strong><p>(Ký, họ tên)</p></div></div>
  </section>;
}
