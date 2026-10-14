import type { CSSProperties } from "react";

const cell: CSSProperties = { border: "1px solid #94999e", padding: "8px", textAlign: "left" };
export default function ProductionCostLedgerPreview({ project = false }: { project?: boolean }) {
  const accountColumns = project ? ["Tổng số tiền", "6271", "6277", "6278"] : ["Tổng số tiền", "6273"];
  return <section aria-label={project ? "Mẫu S36-DN theo công trình" : "Mẫu S36-DN theo đối tượng tập hợp chi phí"} style={{ paddingBottom: 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Đơn vị: Công ty TNHH Minh An</span><strong>Mẫu số: S36-DN</strong></div>
    <h2 style={{ textAlign: "center", fontSize: 18 }}>SỔ CHI PHÍ SẢN XUẤT, KINH DOANH</h2>
    <p style={{ textAlign: "center" }}>(Dùng cho các TK: 154, 242, 335, 621, 622, 623, 627, 631, 632, 641, 642)</p>
    <p style={{ textAlign: "center" }}>Tài khoản: 627 - Chi phí sản xuất chung</p>
    <p style={{ textAlign: "center" }}>{project ? "Công trình: Tòa nhà Văn phòng TechPark" : "Đối tượng tập hợp chi phí: Xưởng Cơ khí chế tạo"}</p>
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr><th rowSpan={2} style={cell}>{project ? "Ngày, tháng ghi sổ" : "Ngày hạch toán"}</th><th colSpan={2} style={cell}>Chứng từ</th><th rowSpan={2} style={cell}>Diễn giải</th><th rowSpan={2} style={cell}>TK đối ứng</th><th colSpan={accountColumns.length} style={cell}>Ghi Nợ tài khoản 627</th></tr>
        <tr>{["Số hiệu","Ngày, tháng",...accountColumns].map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead>
      <tbody>{["Số dư đầu kỳ","Số phát sinh trong kỳ","Cộng số phát sinh trong kỳ","Ghi có TK: 627","Số dư cuối kỳ"].map(label=><tr key={label}><td style={cell}></td><td style={cell}></td><td style={cell}></td><th style={cell}>{label}</th><td style={cell}></td>{accountColumns.map(account=><td key={account} style={cell}></td>)}</tr>)}</tbody>
    </table></div>
    <p>Sổ này có 01 trang, đánh số từ trang 01 đến trang 01</p><p>Ngày mở sổ: ……………………</p><p style={{ textAlign: "right" }}>Ngày … tháng … năm …</p>
    <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}><div><strong>Người lập biểu</strong><p>(Ký, họ tên)</p></div><div><strong>Giám đốc</strong><p>(Ký, họ tên, đóng dấu)</p></div></div>
  </section>;
}
