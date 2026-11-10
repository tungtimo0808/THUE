import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./misa-payment-workflow.css";

export default function MisaPaymentWorkflow({
  children,
  variant = "payment",
}: {
  children: ReactNode;
  variant?: "payment" | "settlement";
  notify?: (text: string) => void;
}) {
  const [view, setView] = useState<"list" | "workflow">("list");
  useEffect(() => {
    const onOpenNotif = () => setView("list");
    window.addEventListener("sv_open_voucher_notif", onOpenNotif);
    return () => window.removeEventListener("sv_open_voucher_notif", onOpenNotif);
  }, []);
  const settlement = variant === "settlement";
  const subject = settlement ? "đề nghị quyết toán tạm ứng" : "đề nghị chi tiền";
  return (
    <div className="pw-workspace">
      <nav aria-label={settlement ? "Đề nghị quyết toán tạm ứng" : "Đề nghị chi tiền"}>
        <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
          Danh sách đề nghị
        </button>
        <button className={view === "workflow" ? "active" : ""} onClick={() => setView("workflow")}>
          Quy trình phê duyệt
        </button>
      </nav>
      {view === "list" ? (
        children
      ) : (
        <>
          <header>
            <div>
              <h1>QUY TRÌNH {subject.toUpperCase()}</h1>
              <p>Lập, phê duyệt và kế thừa hạch toán {subject} trực tiếp trên Sổ Việt ERP</p>
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
                  ? "Sau khi tổng hợp hóa đơn, chứng từ đã chi, nhân viên lập bảng quyết toán tạm ứng (Mẫu 04-TT)."
                  : "Nhân viên hoặc kế toán lập giấy đề nghị chi tiền kèm chứng từ gốc tại tab Danh sách đề nghị, gồm:"}
              </p>
              <ul hidden={settlement}>
                {[
                  "Đề nghị trả tiền nhà cung cấp",
                  "Đề nghị tạm ứng nhân viên",
                  "Đề nghị thanh toán hóa đơn dịch vụ",
                  "Đề nghị thanh toán chi phí vận hành khác",
                ].map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
              <footer>Lưu trữ trực tiếp theo Chi nhánh &amp; Kỳ kế toán</footer>
            </article>
            <article>
              <span>BƯỚC 2</span>
              <small>Sổ Việt ERP</small>
              <h2>{settlement ? "Kế toán đối chiếu & duyệt" : "Kế toán trưởng / Giám đốc phê duyệt"}</h2>
              <p>
                {settlement
                  ? "Kế toán đối chiếu số tiền đã tạm ứng với chứng từ quyết toán thực tế và xác nhận phần chênh lệch hoàn ứng hoặc chi thêm."
                  : "Đề nghị được kiểm tra hạn mức, chứng từ gốc và phê duyệt hoặc từ chối trực tiếp trên hệ thống. Chỉ đề nghị Đã duyệt mới được lập phiếu chi."}
              </p>
              <footer>{settlement ? "Đối chiếu tạm ứng ↔ thực chi" : "Chờ duyệt → Đã duyệt / Từ chối"}</footer>
            </article>
            <article>
              <span>BƯỚC 3</span>
              <small>Sổ Việt ERP</small>
              <h2>{settlement ? "Ghi nhận quyết toán & Hoàn ứng" : "Lập Phiếu chi / Ủy nhiệm chi"}</h2>
              <p>
                {settlement
                  ? "Ghi nhận hoàn tất quyết toán và tự động liên kết Phiếu thu hoàn ứng (hoặc Phiếu chi bổ sung) cho phần chênh lệch."
                  : "Kế toán bấm Chi tiền ngay trên dòng đề nghị đã duyệt để sinh Phiếu chi tiền mặt hoặc Ủy nhiệm chi ngân hàng mà không phải nhập lại."}
              </p>
              <footer>Kế thừa dữ liệu &amp; tự động liên kết chứng từ</footer>
            </article>
          </div>
        </>
      )}
    </div>
  );
}
