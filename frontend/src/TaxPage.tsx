import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  Calculator,
  FileCheck2,
  FileText,
  PlugZap,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "./components";

const categories = [
  {
    id: "vat",
    title: "Thuế giá trị gia tăng",
    short: "GTGT",
    text: "Tập hợp hóa đơn đầu vào, đầu ra và đối chiếu dữ liệu kê khai.",
    icon: FileText,
  },
  {
    id: "personal",
    title: "Thuế thu nhập cá nhân",
    short: "TNCN",
    text: "Theo dõi hồ sơ khấu trừ và dữ liệu thu nhập của người lao động.",
    icon: FileCheck2,
  },
  {
    id: "corporate",
    title: "Thuế thu nhập doanh nghiệp",
    short: "TNDN",
    text: "Chuẩn bị số liệu doanh thu, chi phí và hồ sơ quyết toán.",
    icon: Calculator,
  },
];
export function TaxPage({
  href,
}: {
  href: (path: string, extra?: Record<string, string>) => string;
}) {
  const [params, setParams] = useSearchParams();
  const tab =
    params.get("view") === "declarations" ? "declarations" : "overview";
  const [selected, setSelected] = useState<(typeof categories)[number] | null>(
    null,
  );
  const changeTab = (view: string) => {
    const next = new URLSearchParams(params);
    next.set("view", view);
    setParams(next);
  };
  return (
    <>
      <div className="module-tabs">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => changeTab("overview")}
        >
          Tổng quan thuế
        </button>
        <button
          className={tab === "declarations" ? "active" : ""}
          onClick={() => changeTab("declarations")}
        >
          Hồ sơ & tờ khai
        </button>
      </div>
      <div className="tax-banner">
        <span className="tax-banner-icon">
          <ShieldCheck size={30} />
        </span>
        <div>
          <h2>Chủ động hồ sơ, sẵn sàng kỳ kê khai</h2>
          <p>Tập trung chứng từ và theo dõi từng bước chuẩn bị hồ sơ thuế.</p>
        </div>
        <span className="connection-status">
          <PlugZap size={15} />
          Chưa kết nối thuế điện tử
        </span>
      </div>
      {tab === "overview" ? (
        <>
          <div className="tax-categories">
            {categories.map((c) => (
              <article className="card tax-category" key={c.id}>
                <span className="metric-icon blue">
                  <c.icon size={21} />
                </span>
                <span className="tax-short">{c.short}</span>
                <h2>{c.title}</h2>
                <p>{c.text}</p>
                <button className="text-button" onClick={() => setSelected(c)}>
                  Xem hồ sơ
                  <ArrowUpRight size={16} />
                </button>
              </article>
            ))}
          </div>
          <section className="card tax-workflow">
            <div className="card-heading">
              <div>
                <h2>Chuẩn bị dữ liệu kê khai</h2>
                <p>Kiểm tra chứng từ trước khi lập hồ sơ</p>
              </div>
            </div>
            <div className="tax-steps">
              <Link to={href("/invoices")}>
                <span>1</span>
                <div>
                  <strong>Rà soát hóa đơn</strong>
                  <small>Đối chiếu hóa đơn mua vào, bán ra</small>
                </div>
                <ArrowUpRight size={18} />
              </Link>
              <Link to={href("/ledger/transactions", { status: "pending" })}>
                <span>2</span>
                <div>
                  <strong>Kiểm tra chứng từ chờ duyệt</strong>
                  <small>Hoàn thiện thông tin còn thiếu</small>
                </div>
                <ArrowUpRight size={18} />
              </Link>
              <Link to={href("/reports")}>
                <span>3</span>
                <div>
                  <strong>Tổng hợp dữ liệu trong kỳ</strong>
                  <small>Xem báo cáo để đối chiếu số liệu</small>
                </div>
                <ArrowUpRight size={18} />
              </Link>
            </div>
          </section>
        </>
      ) : (
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Danh mục hồ sơ thuế</h2>
              <p>Chọn một loại hồ sơ để xem trạng thái chuẩn bị</p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Hồ sơ</th>
                  <th>Trạng thái kết nối</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.title}</strong>
                    </td>
                    <td>
                      <span className="status draft">Chưa kết nối</span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setSelected(c)}
                      >
                        Xem hồ sơ
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <p className="tax-disclaimer">
        Giao diện minh họa quy trình chuẩn bị hồ sơ. Chưa tính thuế, ký số hoặc
        gửi tờ khai.
      </p>
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="modal-body">
            <p className="info-note">
              Chưa có hồ sơ từ hệ thống thuế trong kỳ này. Cần kết nối API
              nghiệp vụ để lập, kiểm tra và ký gửi tờ khai.
            </p>
            <h3>Dữ liệu cần chuẩn bị</h3>
            <p className="muted">{selected.text}</p>
            <div className="settings-links">
              <Link
                to={href(selected.id === "personal" ? "/payroll" : "/invoices")}
                onClick={() => setSelected(null)}
              >
                Mở phân hệ dữ liệu liên quan
                <ArrowUpRight size={17} />
              </Link>
              <Link to={href("/reports")} onClick={() => setSelected(null)}>
                Xem báo cáo chứng từ mẫu
                <ArrowUpRight size={17} />
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
