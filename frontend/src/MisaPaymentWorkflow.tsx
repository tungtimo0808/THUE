import { useState } from "react";
import type { ReactNode } from "react";
import "./misa-payment-workflow.css";

// Toàn bộ luồng chạy trong Sổ Việt ERP. Chưa có ứng dụng duyệt bên ngoài nên không mô tả bước "đồng bộ".
export default function MisaPaymentWorkflow({
  children,
  variant = "payment",
}: {
  children: ReactNode;
  variant?: "payment" | "settlement";
  notify?: (text: string) => void;
}) {
  const [view, setView] = useState("workflow");
  const settlement = variant === "settlement";
  const subject = settlement ? "đề nghị quyết toán tạm ứng" : "đề nghị chi tiền";
  return (
    <div className="pw-workspace">
      <nav aria-label={settlement ? "Đề nghị quyết toán tạm ứng" : "Đề nghị chi tiền"}>
        <button className={view === "workflow" ? "active" : ""} onClick={() => setView("workflow")}>
          Quy trình
        </button>
        <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
          Danh sách đề nghị
        </button>
      </nav>
      {view === "list" ? (
        children
      ) : (
        <>
          <header>
            <div>
              <h1>QUY TRÌNH {subject.toUpperCase()}</h1>
              <p>Lập, kiểm tra và hạch toán {subject} ngay trong Sổ Việt ERP</p>
            </div>
            <button onClick={() => setView("list")}>Mở danh sách đề nghị</button>
          </header>
          <div className="pw-steps">
            <article>
              <span>BƯỚC 1</span>
              <small>Sổ Việt ERP</small>
              <h2>Lập {subject}</h2>
              <p>
                {settlement
                  ? "Sau khi tổng hợp hóa đơn, chứng từ đã chi, nhân viên lập đề nghị quyết toán tạm ứng."
                  : "Lập đề nghị tại tab Danh sách đề nghị, gồm:"}
              </p>
              <ul hidden={settlement}>
                {[
                  "Đề nghị trả tiền nhà cung cấp",
                  "Đề nghị tạm ứng nhân viên",
                  "Đề nghị thanh toán hóa đơn",
                  "Đề nghị thanh toán khác",
                ].map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
              <footer>Danh sách đề nghị</footer>
            </article>
            <article>
              <span>BƯỚC 2</span>
              <small>Sổ Việt ERP</small>
              <h2>{settlement ? "Kế toán kiểm tra" : "Phê duyệt"}</h2>
              <p>
                {settlement
                  ? "Kế toán đối chiếu số đã tạm ứng với chứng từ quyết toán và xác định phần chênh lệch."
                  : "Đề nghị được gửi duyệt; người có thẩm quyền phê duyệt hoặc từ chối kèm lý do. Chỉ đề nghị đã duyệt mới được chi."}
              </p>
              <footer>{settlement ? "Đối chiếu tạm ứng" : "Chờ duyệt → Đã duyệt / Bị từ chối"}</footer>
            </article>
            <article>
              <span>BƯỚC 3</span>
              <small>Sổ Việt ERP</small>
              <h2>{settlement ? "Ghi nhận quyết toán" : "Lập chứng từ chi"}</h2>
              <p>
                {settlement
                  ? "Ghi nhận quyết toán và lập phiếu thu/chi cho phần chênh lệch nếu có."
                  : "Kế toán lập phiếu chi hoặc ủy nhiệm chi từ đề nghị đã duyệt; thông tin được kế thừa, không cần nhập lại."}
              </p>
              <footer>Kế thừa dữ liệu &amp; hạch toán</footer>
            </article>
          </div>
        </>
      )}
    </div>
  );
}
