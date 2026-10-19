import { useState } from "react";
import type { ReactNode } from "react";
import "./misa-payment-workflow.css";
export default function MisaPaymentWorkflow({
  children,
  notify,
  variant = "payment",
}: {
  children: ReactNode;
  variant?: "payment" | "settlement";
  notify: (text: string) => void;
}) {
  const [view, setView] = useState("workflow");
  return (
    <div className="pw-workspace">
      <nav aria-label={variant === "settlement" ? "Đề nghị quyết toán tạm ứng" : "Đề nghị chi tiền"}>
        <button
          className={view === "workflow" ? "active" : ""}
          onClick={() => setView("workflow")}
        >
          Quy trình tự động
        </button>
        <button
          className={view === "list" ? "active" : ""}
          onClick={() => setView("list")}
        >
          Danh sách đề nghị
        </button>
      </nav>
      {view === "list" ? (
        children
      ) : (
        <>
          <header>
            <div>
              <h1>LUỒNG QUY TRÌNH TỰ ĐỘNG HÓA {variant === "settlement" ? "ĐỀ NGHỊ QUYẾT TOÁN TẠM ỨNG" : "ĐỀ NGHỊ CHI TIỀN"}</h1>
              <p>
                Hệ thống liên thông thông suốt giữa Quy trình Sổ Việt và Sổ Việt ERP
              </p>
            </div>
            <button
              onClick={() =>
                notify("Đang xem mô phỏng quy trình phê duyệt trên frontend.")
              }
            >
              Thiết lập tự động
            </button>
          </header>
          <div className="pw-steps">
            <article>
              <span>BƯỚC 1</span>
              <small>Quy trình Sổ Việt</small>
              <h2>Nhân viên lập {variant === "settlement" ? "đề nghị quyết toán tạm ứng" : "đề nghị chi tiền"} trên Quy trình Sổ Việt</h2>
              <p>{variant === "settlement" ? "Sau khi tổng hợp toàn bộ hóa đơn, chứng từ để quyết toán tạm ứng, nhân viên chủ động tạo đề nghị quyết toán tạm ứng." : "Nhân viên chủ động tạo các đề nghị phát sinh như:"}</p>
              <ul hidden={variant === "settlement"}>
                {[
                  "Đề nghị trả tiền nhà cung cấp",
                  "Đề nghị tạm ứng nhân viên",
                  "Đề nghị thanh toán hóa đơn",
                  "Đề nghị thanh toán khác",
                  "Đề nghị quyết toán tạm ứng",
                ].map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
              <footer>Tạo đề nghị nhanh chóng trên web và mobile</footer>
            </article>
            <article>
              <span>BƯỚC 2</span>
              <small>Quy trình Sổ Việt</small>
              <h2>Giám đốc/Kế toán phê duyệt</h2>
              <p>
                Đề nghị được chuyển đến đúng người phụ trách để kiểm tra, trao
                đổi, bổ sung thông tin và phê duyệt trực tiếp trên Quy trình Sổ Việt.
              </p>
              <footer>Tạo đề nghị nhanh chóng trên web và mobile</footer>
            </article>
            <article>
              <span>BƯỚC 3</span>
              <small>Sổ Việt ERP</small>
              <h2>Đồng bộ đề nghị về Sổ Việt ERP</h2>
              <p>
                Kế toán kế thừa thông tin từ {variant === "settlement" ? "đề nghị quyết toán tạm ứng" : "đề nghị chi"} đã duyệt để lập chứng
                từ hạch toán nhanh chóng, không cần nhập lại thủ công.
              </p>
              <footer>Kế thừa dữ liệu &amp; tự động sinh hạch toán</footer>
            </article>
          </div>
        </>
      )}
    </div>
  );
}
