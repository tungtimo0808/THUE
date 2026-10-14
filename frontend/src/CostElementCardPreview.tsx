const elementHeaders = ["Chỉ tiêu", "Tổng số tiền", "Nguyên vật liệu", "Nhân công", "Khấu hao", "Chi phí mua ngoài", "Chi phí khác"];
const indicators = ["1. Chi phí SXKD dở dang đầu kỳ", "2. Chi phí SXKD phát sinh trong kỳ", "3. Chi phí SXKD dở dang cuối kỳ", "4. Các khoản giảm giá thành", "5. Tổng giá thành sản phẩm, dịch vụ", "6. Giá thành đơn vị sản phẩm"];
const cell = { border: "1px solid #94999e", padding: 8 };
export default function CostElementCardPreview({ mode = "elements" }: { mode?: "elements" | "items" | "project" }) {
  const headers = mode === "elements" ? elementHeaders : ["Chỉ tiêu", "Tổng số tiền", "Nguyên vật liệu trực tiếp", "Nhân công trực tiếp", ...(mode === "project" ? ["Máy thi công"] : []), "Chi phí sản xuất chung"];
  const rows = mode === "project" ? ["1. Số chưa nghiệm thu đầu kỳ", "2. Chi phí phát sinh trong kỳ", "3. Các khoản giảm giá thành", "4. Tổng chi phí", "5. Nghiệm thu trong kỳ", "6. Số chưa nghiệm thu cuối kỳ"] : indicators;
  return <section aria-label={mode === "elements" ? "Mẫu S37-DN theo yếu tố chi phí" : mode === "items" ? "Mẫu S37-DN THCP theo khoản mục chi phí" : "Mẫu S37-DN công trình theo khoản mục chi phí"} style={{ paddingBottom: 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Đơn vị: Công ty TNHH Minh An</span><strong>Mẫu số: S37-DN</strong></div>
    <h2 style={{ textAlign: "center", fontSize: 18 }}>THẺ TÍNH GIÁ THÀNH SẢN PHẨM, DỊCH VỤ</h2>
    <p style={{ textAlign: "center" }}>Tháng … năm …</p>
    {mode === "project" ? <p style={{ textAlign: "center" }}>Công trình: Tòa nhà Văn phòng TechPark</p> : <><p style={{ textAlign: "center" }}>Đối tượng tập hợp chi phí: Xưởng Cơ khí chế tạo</p><p style={{ textAlign: "center" }}>Thành phẩm: Bàn ghế inox cao cấp</p><p style={{ textAlign: "center" }}>Số lượng: ……………………</p></>}
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: 750, borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr>{headers.map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(label=><tr key={label}><th style={{ ...cell, textAlign: "left" }}>{label}</th>{headers.slice(1).map(header=><td key={header} style={cell}></td>)}</tr>)}</tbody>
    </table></div>
    <p style={{ textAlign: "right" }}>Ngày … tháng … năm …</p><div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}><div><strong>Người lập</strong><p>(Ký, họ tên)</p></div><div><strong>Kế toán trưởng</strong><p>(Ký, họ tên)</p></div></div>
  </section>;
}
