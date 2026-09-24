import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ChevronRight,
  Columns3,
  FileClock,
  FilePlus2,
  Filter,
  Link2,
  MoreHorizontal,
  Paperclip,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { Modal } from "./components";

type Notify = (message: string) => void;

const moduleNouns: Record<string, string> = {
  invoices: "Hóa đơn",
  cash: "Phiếu thu chi",
  bank: "Giao dịch ngân hàng",
  purchases: "Chứng từ mua hàng",
  sales: "Chứng từ bán hàng",
  inventory: "Chứng từ kho",
  tools: "Công cụ dụng cụ",
  assets: "Tài sản",
  payroll: "Bảng lương",
  cost: "Kỳ tính giá thành",
  ledger: "Chứng từ tổng hợp",
  budget: "Khoản ngân sách",
  connections: "Hồ sơ vay vốn",
};

function WorkspaceHeader({
  title,
  description,
  action = "Thêm mới",
  notify,
}: {
  title: string;
  description: string;
  action?: string;
  notify: Notify;
}) {
  return (
    <header className="erp3-page-header">
      <div>
        <p className="erp3-eyebrow">KHÔNG GIAN LÀM VIỆC</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="erp3-header-actions">
        <button onClick={() => notify("Dữ liệu mẫu đã được làm mới.")}>
          <RefreshCw size={15} /> Làm mới
        </button>
        <button
          className="erp3-primary"
          onClick={() => notify(`${action} được tạo dưới dạng nháp.`)}
        >
          <Plus size={15} /> {action}
        </button>
      </div>
    </header>
  );
}

function ListToolbar({ title, notify }: { title: string; notify: Notify }) {
  return (
    <div className="erp3-list-toolbar">
      <label className="erp3-search">
        <Search size={15} />
        <span className="sr-only">Tìm trong {title}</span>
        <input
          aria-label={`Tìm trong ${title}`}
          placeholder="Tìm theo mã, tên, đối tượng…"
        />
      </label>
      <button>
        <Filter size={14} /> Bộ lọc <span className="erp3-count">2</span>
      </button>
      <label className="erp3-date-filter">
        <span>Từ ngày</span>
        <input type="date" defaultValue="2026-09-01" />
      </label>
      <label className="erp3-date-filter">
        <span>Đến ngày</span>
        <input type="date" defaultValue="2026-09-30" />
      </label>
      <span className="erp3-toolbar-spacer" />
      <button
        aria-label="Trợ lý AI"
        onClick={() => notify("Trợ lý đang phân tích dữ liệu mẫu.")}
      >
        <Sparkles size={15} />
      </button>
      <button
        aria-label="Nhập dữ liệu"
        onClick={() => notify("Sẵn sàng nhận tệp Excel mẫu.")}
      >
        <Upload size={15} />
      </button>
      <button
        aria-label="Xuất dữ liệu"
        onClick={() => notify("Đã chuẩn bị bản xuất dữ liệu mẫu.")}
      >
        <ArrowDownToLine size={15} />
      </button>
      <button aria-label="Tùy chỉnh cột">
        <Columns3 size={15} />
      </button>
    </div>
  );
}

function PurchaseDocument({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: Notify;
}) {
  return (
    <Modal title="Đơn mua hàng PO-2609-001" onClose={onClose} wide>
      <div className="erp3-document">
        <div className="erp3-document-state">
          <span className="erp3-status warning">Đang thực hiện</span>
          <span>Lập ngày 18/09/2026 · Người lập: Nguyễn Thị Lan</span>
        </div>
        <section className="erp3-info-card">
          <h3>Thông tin nhà cung cấp</h3>
          <dl className="erp3-definition-grid">
            <div>
              <dt>Nhà cung cấp</dt>
              <dd>Công ty TNHH Gỗ Việt</dd>
            </div>
            <div>
              <dt>Mã số thuế</dt>
              <dd>0108897261</dd>
            </div>
            <div>
              <dt>Người liên hệ</dt>
              <dd>Trần Minh Quân</dd>
            </div>
            <div>
              <dt>Hạn giao</dt>
              <dd>25/09/2026</dd>
            </div>
            <div>
              <dt>Kho nhận</dt>
              <dd>KHO-HN · Kho Hà Nội</dd>
            </div>
            <div>
              <dt>Phương thức thanh toán</dt>
              <dd>Chuyển khoản 30 ngày</dd>
            </div>
          </dl>
        </section>
        <div
          className="erp3-tabs"
          role="tablist"
          aria-label="Chi tiết đơn mua hàng"
        >
          <button role="tab" aria-selected="true">
            Hàng hóa, dịch vụ
          </button>
          <button role="tab" aria-selected="false">
            Điều khoản thanh toán
          </button>
          <button role="tab" aria-selected="false">
            Ghi chú
          </button>
        </div>
        <div className="erp3-table-wrap">
          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>Mã hàng</th>
                <th>Tên hàng hóa</th>
                <th>ĐVT</th>
                <th>Số lượng</th>
                <th>Đơn giá</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>NVL-GO-01</td>
                <td>Gỗ sồi xẻ quy cách</td>
                <td>m³</td>
                <td className="numeric">12</td>
                <td className="numeric">16.500.000</td>
                <td className="numeric">198.000.000</td>
              </tr>
              <tr>
                <td>2</td>
                <td>PK-DG-03</td>
                <td>Phụ kiện đóng gói</td>
                <td>Bộ</td>
                <td className="numeric">40</td>
                <td className="numeric">325.000</td>
                <td className="numeric">13.000.000</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="erp3-document-bottom">
          <section>
            <h3>Chứng từ liên quan</h3>
            <p className="erp3-related">
              <Link2 size={14} /> Chứng từ mua hàng đã lập: MH-2609-018
            </p>
            <p>
              <Paperclip size={14} /> Bao-gia-Go-Viet.pdf · 1,2 MB
            </p>
          </section>
          <dl className="erp3-summary">
            <div>
              <dt>Tiền hàng</dt>
              <dd>211.000.000</dd>
            </div>
            <div>
              <dt>Thuế GTGT</dt>
              <dd>21.100.000</dd>
            </div>
            <div className="total">
              <dt>Tổng thanh toán</dt>
              <dd>232.100.000</dd>
            </div>
          </dl>
        </div>
        <footer className="erp3-document-actions">
          <button onClick={() => notify("Bản in mẫu đã sẵn sàng.")}>
            <Printer size={14} /> In
          </button>
          <button
            onClick={() =>
              notify("Đã nhân bản đơn mua hàng trong trình duyệt.")
            }
          >
            Nhân bản
          </button>
          <button onClick={onClose}>Đóng</button>
          <button
            className="erp3-primary"
            onClick={() => notify("Thay đổi chỉ được lưu trong bản giao diện.")}
          >
            Chỉnh sửa
          </button>
        </footer>
      </div>
    </Modal>
  );
}

export function PurchaseOrdersWorkspace({ notify }: { notify: Notify }) {
  const [quick, setQuick] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  return (
    <div className="erp3-workspace">
      <WorkspaceHeader
        title="Đơn mua hàng"
        description="Theo dõi nhu cầu, tiến độ giao hàng và chứng từ phát sinh."
        action="Lập đơn mua hàng"
        notify={notify}
      />
      <div className="erp3-kpis">
        <article>
          <span>Tổng giá trị</span>
          <strong>816,4 tr</strong>
          <small>12 đơn trong kỳ</small>
        </article>
        <article>
          <span>Chờ duyệt</span>
          <strong>3</strong>
          <small>128,6 triệu đồng</small>
        </article>
        <article>
          <span>Chậm giao</span>
          <strong>1</strong>
          <small>Cần xử lý hôm nay</small>
        </article>
      </div>
      <section className="erp3-list-card">
        <ListToolbar title="Đơn mua hàng" notify={notify} />
        <div className="erp3-bulk">
          <label>
            <input type="checkbox" /> Chọn tất cả
          </label>
          <span>0 đã chọn</span>
          <button disabled>Duyệt</button>
          <button disabled>Xuất Excel</button>
        </div>
        <div className="erp3-table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Số đơn</th>
                <th>Ngày đơn</th>
                <th>Nhà cung cấp</th>
                <th>Hạn giao</th>
                <th>Giá trị</th>
                <th>Tình trạng</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <input aria-label="Chọn PO-2609-001" type="checkbox" />
                </td>
                <td>
                  <button
                    className="erp3-link"
                    aria-label="Xem nhanh PO-2609-001"
                    onClick={() => setQuick(true)}
                  >
                    PO-2609-001
                  </button>
                </td>
                <td>18/09/2026</td>
                <td>Công ty TNHH Gỗ Việt</td>
                <td>25/09/2026</td>
                <td className="numeric">232.100.000</td>
                <td>
                  <span className="erp3-status warning">Đang thực hiện</span>
                </td>
                <td>
                  <button aria-label="Thao tác PO-2609-001">
                    <MoreHorizontal size={16} />
                  </button>
                </td>
              </tr>
              <tr>
                <td>
                  <input aria-label="Chọn PO-2609-002" type="checkbox" />
                </td>
                <td>
                  <button className="erp3-link" onClick={() => setQuick(true)}>
                    PO-2609-002
                  </button>
                </td>
                <td>20/09/2026</td>
                <td>Công ty Bao bì An Phú</td>
                <td>28/09/2026</td>
                <td className="numeric">86.400.000</td>
                <td>
                  <span className="erp3-status success">Đã duyệt</span>
                </td>
                <td>
                  <button aria-label="Thao tác PO-2609-002">
                    <MoreHorizontal size={16} />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <footer className="erp3-pagination">
          <span>1–2 / 12 bản ghi</span>
          <button disabled>Trước</button>
          <button>1</button>
          <button>2</button>
          <button>Sau</button>
        </footer>
      </section>
      {quick && (
        <aside
          className="erp3-quick-detail"
          role="region"
          aria-label="Chi tiết nhanh"
        >
          <header>
            <div>
              <span>Đơn mua hàng</span>
              <h3>PO-2609-001</h3>
            </div>
            <button
              aria-label="Đóng chi tiết nhanh"
              onClick={() => setQuick(false)}
            >
              ×
            </button>
          </header>
          <span className="erp3-status warning">Đang thực hiện</span>
          <dl>
            <div>
              <dt>Nhà cung cấp</dt>
              <dd>Công ty TNHH Gỗ Việt</dd>
            </div>
            <div>
              <dt>Tổng thanh toán</dt>
              <dd>232.100.000 đ</dd>
            </div>
            <div>
              <dt>Tiến độ nhận</dt>
              <dd>65%</dd>
            </div>
          </dl>
          <div className="erp3-progress">
            <span style={{ width: "65%" }} />
          </div>
          <h4>Hoạt động gần đây</h4>
          <p>20/09 · Đã lập chứng từ mua hàng</p>
          <button
            className="erp3-primary erp3-full"
            aria-label="Mở đầy đủ PO-2609-001"
            onClick={() => setDocumentOpen(true)}
          >
            Mở hồ sơ đầy đủ <ChevronRight size={14} />
          </button>
        </aside>
      )}
      {documentOpen && (
        <PurchaseDocument
          onClose={() => setDocumentOpen(false)}
          notify={notify}
        />
      )}
    </div>
  );
}

export function IncomingInvoiceWorkspace({ notify }: { notify: Notify }) {
  const [selected, setSelected] = useState("HD-000184");
  return (
    <div className="erp3-workspace">
      <WorkspaceHeader
        title="Xử lý hóa đơn đầu vào"
        description="Tiếp nhận, kiểm tra và liên kết hóa đơn với nghiệp vụ mua hàng."
        action="Tải hóa đơn lên"
        notify={notify}
      />
      <div className="erp3-invoice-layout">
        <section
          className="erp3-invoice-inbox"
          aria-label="Danh sách hóa đơn đầu vào"
        >
          <div className="erp3-inbox-heading">
            <div>
              <h3>Hộp thư hóa đơn</h3>
              <span>8 chờ xử lý</span>
            </div>
            <button>
              <Filter size={14} /> Lọc
            </button>
          </div>
          <label className="erp3-search">
            <Search size={14} />
            <input
              aria-label="Tìm hóa đơn đầu vào"
              placeholder="Số hóa đơn, nhà cung cấp…"
            />
          </label>
          {[
            {
              id: "HD-000184",
              vendor: "Công ty TNHH Gỗ Việt",
              amount: "232.100.000 đ",
              state: "Cần lập chứng từ",
            },
            {
              id: "HD-000183",
              vendor: "Công ty Bao bì An Phú",
              amount: "86.400.000 đ",
              state: "Chờ kiểm tra",
            },
            {
              id: "HD-000179",
              vendor: "Vận tải Minh Long",
              amount: "18.750.000 đ",
              state: "Đã liên kết",
            },
          ].map((invoice) => (
            <button
              key={invoice.id}
              className={`erp3-invoice-item ${selected === invoice.id ? "active" : ""}`}
              onClick={() => setSelected(invoice.id)}
            >
              <span>
                <strong>{invoice.vendor}</strong>
                <small>{invoice.id} · 20/09/2026</small>
              </span>
              <span>
                <b>{invoice.amount}</b>
                <small>{invoice.state}</small>
              </span>
            </button>
          ))}
        </section>
        <section
          className="erp3-invoice-preview"
          aria-label="Xem trước hóa đơn"
        >
          <div className="erp3-preview-toolbar">
            <span>
              <FileClock size={15} /> Bản xem trước XML/PDF
            </span>
            <button>
              <MoreHorizontal size={16} />
            </button>
          </div>
          <div className="erp3-paper">
            <p className="erp3-paper-kicker">HÓA ĐƠN GIÁ TRỊ GIA TĂNG</p>
            <h3>Công ty TNHH Gỗ Việt</h3>
            <p>Mẫu số 01GTKT0/001 · Ký hiệu GV/26E</p>
            <dl>
              <div>
                <dt>Số hóa đơn</dt>
                <dd>{selected}</dd>
              </div>
              <div>
                <dt>Ngày hóa đơn</dt>
                <dd>20/09/2026</dd>
              </div>
              <div>
                <dt>Mã số thuế</dt>
                <dd>0108897261</dd>
              </div>
            </dl>
            <table>
              <thead>
                <tr>
                  <th>Nội dung</th>
                  <th>Tiền trước thuế</th>
                  <th>Thuế</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gỗ sồi và phụ kiện</td>
                  <td>211.000.000</td>
                  <td>21.100.000</td>
                </tr>
              </tbody>
            </table>
            <strong className="erp3-paper-total">
              Tổng thanh toán: 232.100.000 đ
            </strong>
          </div>
          <aside className="erp3-validation">
            <h3>Kết quả kiểm tra</h3>
            <p>
              <span className="erp3-check">✓</span> Chữ ký số hợp lệ
            </p>
            <p>
              <span className="erp3-check">✓</span> Mã số thuế đang hoạt động
            </p>
            <p>
              <span className="erp3-warn">!</span> Chưa có chứng từ mua hàng phù
              hợp
            </p>
          </aside>
          <footer className="erp3-preview-actions">
            <button
              onClick={() => notify("Đã mở luồng liên kết trên dữ liệu mẫu.")}
            >
              <Link2 size={14} /> Liên kết chứng từ
            </button>
            <button
              className="erp3-primary"
              onClick={() =>
                notify("Chứng từ mua hàng mới đã được tạo dưới dạng nháp.")
              }
            >
              <FilePlus2 size={14} /> Lập chứng từ mua hàng
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}

function getSpecializedWorkspaceData(moduleId: string, title: string) {
  const t = title.toLowerCase();

  // 1. Công cụ dụng cụ
  if (moduleId === "tools") {
    if (t.includes("trả trước") || t.includes("cptt")) {
      return {
        noun: "Chi phí trả trước",
        headers: ["Mã CPTT", "Khoản chi phí", "Ngày ghi nhận", "Tổng số tiền (VND)", "Kỳ PB", "Đã PB", "PB kỳ này", "Còn lại", "Trạng thái"],
        rows: [
          ["CPTT-2026-01", "Thuê trụ sở văn phòng Hà Nội 12T", "01/01/2026", "240.000.000", "12 tháng", "160.000.000", "20.000.000", "60.000.000", "Đang phân bổ"],
          ["CPTT-2026-02", "Bảo hiểm cháy nổ nhà xưởng và kho", "01/03/2026", "36.000.000", "12 tháng", "18.000.000", "3.000.000", "15.000.000", "Đang phân bổ"],
          ["CPTT-2026-03", "Phí bản quyền ERP & Microsoft 365", "15/04/2026", "68.400.000", "12 tháng", "28.500.000", "5.700.000", "34.200.000", "Đang phân bổ"],
          ["CPTT-2026-04", "Sửa chữa lớn nhà xưởng khu B", "01/06/2026", "120.000.000", "24 tháng", "15.000.000", "5.000.000", "100.000.000", "Đang phân bổ"],
        ],
        kpis: [
          { label: "Tổng CPTT đang theo dõi", value: "464.400.000", hint: "4 khoản chi phí" },
          { label: "Đã phân bổ lũy kế", value: "221.500.000", hint: "Tính đến kỳ này" },
          { label: "Mức phân bổ tháng 9", value: "33.700.000", hint: "Đã tạo bút toán Nợ 642" },
        ]
      };
    }
    if (t.includes("ghi tăng")) {
      return {
        noun: "Chứng từ ghi tăng CCDC",
        headers: ["Số chứng từ", "Ngày ghi tăng", "Tên công cụ dụng cụ", "Số lượng", "Đơn giá", "Tổng giá trị (VND)", "Kỳ PB", "Đơn vị sử dụng", "Trạng thái"],
        rows: [
          ["GT-CCDC-2609", "15/09/2026", "Laptop Dell Vostro 15 3520", "5 chiếc", "18.500.000", "92.500.000", "24 tháng", "Phòng Kỹ thuật", "Đã ghi sổ"],
          ["GT-CCDC-2608", "28/08/2026", "Bộ bàn ghế nhân viên 6 chỗ", "4 bộ", "12.000.000", "48.000.000", "36 tháng", "Phòng Kinh doanh", "Đã ghi sổ"],
          ["GT-CCDC-2607", "10/08/2026", "Máy in mã vạch Zebra ZT411", "2 chiếc", "22.500.000", "45.000.000", "24 tháng", "Bộ phận Kho vận", "Đã ghi sổ"],
        ],
        kpis: [
          { label: "Tổng ghi tăng trong kỳ", value: "185.500.000", hint: "3 chứng từ ghi tăng" },
          { label: "Từ nguồn Mua hàng", value: "140.500.000", hint: "Kèm hóa đơn VAT" },
          { label: "Từ nguồn Xuất kho", value: "45.000.000", hint: "Xuất CCDC dùng ngay" },
        ]
      };
    }
    return {
      noun: "Công cụ dụng cụ",
      headers: ["Mã CCDC", "Tên công cụ dụng cụ", "Ngày ghi tăng", "Nguyên giá (VND)", "Kỳ PB", "Đã phân bổ", "Còn lại", "Đơn vị sử dụng", "Trạng thái"],
      rows: [
        ["CCDC-2026-001", "Laptop Dell Vostro 15 3520", "15/01/2026", "24.500.000", "24 tháng", "8.166.666", "16.333.334", "Phòng Kế toán", "Đang sử dụng"],
        ["CCDC-2026-002", "Máy in laser HP LaserJet M428fdw", "02/02/2026", "14.800.000", "18 tháng", "4.933.333", "9.866.667", "Phòng Hành chính", "Đang sử dụng"],
        ["CCDC-2026-003", "Bộ bàn ghế giám đốc gỗ sồi tự nhiên", "10/03/2026", "38.000.000", "36 tháng", "6.333.333", "31.666.667", "Ban Giám đốc", "Đang sử dụng"],
        ["CCDC-2025-089", "Máy chiếu Epson EB-X06 phòng họp A1", "12/08/2025", "12.500.000", "24 tháng", "6.770.833", "5.729.167", "Phòng Họp A1", "Đang sử dụng"],
        ["CCDC-2025-042", "Bộ máy hàn cáp quang Comway C6", "25/04/2025", "45.000.000", "24 tháng", "31.875.000", "13.125.000", "Đội Kỹ thuật", "Đang sử dụng"],
      ],
      kpis: [
        { label: "Tổng số CCDC đang dùng", value: "32 CCDC", hint: "8 đơn vị sử dụng" },
        { label: "Nguyên giá toàn bộ", value: "386.400.000", hint: "Giá trị sổ sách" },
        { label: "Giá trị còn lại", value: "194.250.000", hint: "Chờ phân bổ tiếp" },
      ]
    };
  }

  // 2. Tài sản cố định
  if (moduleId === "assets") {
    return {
      noun: "Tài sản cố định",
      headers: ["Mã TSCĐ", "Tên tài sản cố định", "Nhóm TSCĐ", "Ngày sử dụng", "Nguyên giá (VND)", "Hao mòn lũy kế", "Giá trị còn lại", "Đơn vị sử dụng", "Tình trạng"],
      rows: [
        ["TSCD-2025-01", "Xe tải vận chuyển Hyundai New Porter 150", "Phương tiện vận tải", "15/02/2025", "465.000.000", "124.000.000", "341.000.000", "Đội Xe Vận tải", "Đang sử dụng"],
        ["TSCD-2024-03", "Máy cắt CNC tự động 4 đầu Woodmaster", "Máy móc thiết bị", "10/06/2024", "780.000.000", "286.000.000", "494.000.000", "Xưởng Mộc CNC", "Đang sử dụng"],
        ["TSCD-2023-08", "Hệ thống máy chủ Dell R750 + Storage SAN", "Thiết bị IT", "20/08/2023", "350.000.000", "218.750.000", "131.250.000", "Phòng IT", "Đang sử dụng"],
        ["TSCD-2022-02", "Tòa nhà văn phòng điều hành 5 tầng Láng Hạ", "Nhà cửa kiến trúc", "01/01/2022", "4.800.000.000", "800.000.000", "4.000.000.000", "Tổng Cty", "Đang sử dụng"],
        ["TSCD-2021-12", "Dây chuyền sơn tĩnh điện công nghệ Đức", "Dây chuyền SX", "15/11/2021", "1.250.000.000", "750.000.000", "500.000.000", "Xưởng Sơn", "Chờ bảo dưỡng"],
      ],
      kpis: [
        { label: "Tổng nguyên giá TSCĐ", value: "7.645.000.000", hint: "5 nhóm tài sản" },
        { label: "Hao mòn lũy kế (TK 214)", value: "2.178.750.000", hint: "Tính đến 09/2026" },
        { label: "Giá trị còn lại", value: "5.466.250.000", hint: "Khấu hao tháng: 48.5 tr" },
      ]
    };
  }

  // 3. Tiền gửi
  if (moduleId === "bank") {
    if (t.includes("đối chiếu")) {
      return {
        noun: "Đối chiếu ngân hàng",
        headers: ["Số tài khoản", "Ngân hàng", "Số dư sổ KT (VND)", "Số dư sao kê NH", "Chênh lệch", "Số GD", "Phương thức", "Kết quả"],
        rows: [
          ["1121-BIDV-01", "BIDV - Chi nhánh Cầu Giấy (VND)", "1.820.400.000", "1.820.400.000", "0", "48 GD", "Online Open Banking", "✓ Khớp 100% (AVA Verified)"],
          ["1121-VCB-02", "Vietcombank - Sở Giao dịch (VND)", "2.450.800.000", "2.450.800.000", "0", "32 GD", "Online Open Banking", "✓ Khớp 100% (AVA Verified)"],
          ["1122-TCB-01", "Techcombank - USD (125,000 $)", "3.156.250.000", "3.156.250.000", "0", "14 GD", "Sao kê điện tử MT940", "✓ Khớp 100%"],
          ["1121-MB-03", "MB Bank - Chi nhánh Ba Đình", "645.200.000", "650.200.000", "-5.000.000", "19 GD", "Đối chiếu tự động", "⚠ Lệch phí duy trì NH"],
        ],
        kpis: [
          { label: "Tổng số dư tiền gửi", value: "8.072.650.000", hint: "4 tài khoản ngân hàng" },
          { label: "Tỷ lệ khớp số liệu", value: "99.94%", hint: "Đã khớp 93/94 giao dịch" },
          { label: "Chênh lệch cần xử lý", value: "-5.000.000", hint: "1 khoản phí sao kê" },
        ]
      };
    }
    if (t.includes("ngân hàng điện tử") || t.includes("lệnh")) {
      return {
        noun: "Ngân hàng điện tử",
        headers: ["Mã lệnh", "Ngày lập", "Tài khoản nguồn", "Đơn vị thụ hưởng", "Ngân hàng nhận", "Số tiền (VND)", "Ký số", "Trạng thái lệnh"],
        rows: [
          ["MBK-2609-001", "24/09/2026", "1121-BIDV-01", "Công ty CP Gỗ Việt Nam", "VietinBank", "185.000.000", "SmartCA HSM", "Đã chuyển tiền thành công"],
          ["MBK-2609-002", "24/09/2026", "1121-VCB-02", "Tổng công ty Điện lực Hà Nội", "BIDV", "34.500.000", "SmartCA HSM", "Đã chuyển tiền thành công"],
          ["MBK-2609-003", "23/09/2026", "1121-BIDV-01", "Kho bạc Nhà nước Cầu Giấy (Thuế)", "KBNN", "68.200.000", "SmartCA HSM", "Đã chuyển tiền thành công"],
        ],
        kpis: [
          { label: "Lệnh chuyển trong ngày", value: "3 lệnh", hint: "Tổng giá trị: 287.7 tr" },
          { label: "Phê duyệt Maker-Checker", value: "100% duyệt", hint: "Ký số SmartCA" },
          { label: "Tự động sinh hạch toán", value: "3 chứng từ", hint: "Nợ 331, 642 / Có 1121" },
        ]
      };
    }
    if (t.includes("bảo lãnh")) {
      return {
        noun: "Bảo lãnh ngân hàng",
        headers: ["Số cam kết BL", "Ngân hàng bảo lãnh", "Loại bảo lãnh", "Dự án / Hợp đồng", "Giá trị bảo lãnh", "Tài sản ký quỹ", "Hạn hiệu lực", "Tình trạng"],
        rows: [
          ["BL-2026-BIDV-08", "BIDV Cầu Giấy", "Bảo lãnh thực hiện HĐ", "Gói thầu Nội thất Tòa nhà Hòa Bình", "350.000.000", "175.000.000 (TK 244)", "31/12/2026", "Đang hiệu lực"],
          ["BL-2026-VCB-12", "Vietcombank", "Bảo lãnh hoàn trả tạm ứng", "HĐ Cung cấp thiết bị trường học", "200.000.000", "100.000.000 (TK 244)", "15/11/2026", "Đang hiệu lực"],
          ["BL-2026-TCB-03", "Techcombank", "Bảo lãnh dự thầu", "Gói thầu Bàn ghế Bệnh viện TW", "80.000.000", "Tín chấp theo hạn mức", "15/10/2026", "Sắp hết hạn"],
        ],
        kpis: [
          { label: "Tổng giá trị bảo lãnh", value: "630.000.000", hint: "3 hợp đồng bảo lãnh" },
          { label: "Ký quỹ ngân hàng (TK 244)", value: "275.000.000", hint: "Được quản lý chặt chẽ" },
          { label: "Sắp hết hạn (dưới 30 ngày)", value: "1 bảo lãnh", hint: "Cần theo dõi gia hạn" },
        ]
      };
    }
    return {
      noun: "Khế ước vay vốn",
      headers: ["Số hợp đồng", "Ngày ký", "Bên cho vay / Ngân hàng", "Mục đích vay", "Hạn mức (VND)", "Dư nợ hiện tại", "Lãi suất (%/năm)", "Hạn tất toán", "Trạng thái"],
      rows: [
        ["KU-2026-VCB01", "15/01/2026", "Vietcombank - CN Thăng Long", "Bổ sung vốn lưu động sản xuất", "2.000.000.000", "850.000.000", "7.2% / năm", "15/01/2027", "Đang thực hiện"],
        ["KU-2025-BIDV02", "10/05/2025", "BIDV - CN Cầu Giấy", "Đầu tư máy móc dây chuyền CNC", "1.500.000.000", "420.000.000", "8.5% / năm", "10/05/2028", "Đang thực hiện"],
      ],
      kpis: [
        { label: "Tổng hạn mức tín dụng", value: "3.500.000.000", hint: "2 hợp đồng tín dụng" },
        { label: "Dư nợ vay ngắn hạn", value: "1.270.000.000", hint: "Lãi vay kỳ này: 8.6 tr" },
        { label: "Tình trạng thanh toán", value: "Đúng hạn", hint: "Không có nợ quá hạn" },
      ]
    };
  }

  // 4. Bán hàng & Sàn TMĐT
  if (moduleId === "sales") {
    if (t.includes("sàn") || t.includes("tmđt") || t.includes("shopee") || t.includes("tiktok")) {
      return {
        noun: "Đơn hàng sàn TMĐT",
        headers: ["Mã đơn sàn", "Kênh / Gian hàng", "Khách hàng", "Doanh thu gộp", "Voucher Shop", "Phí sàn khấu trừ", "Thực nhận về NH", "Thời gian giao", "Trạng thái ERP"],
        rows: [
          ["SP-2609-8834921", "Shopee Mall - Nội thất Official", "Nguyễn Văn Tuấn", "1.450.000", "-50.000", "-108.750 (7.5%)", "1.291.250", "23/09/2026", "Đã sinh PX & HĐĐT"],
          ["TT-2609-9482103", "TikTok Shop - Sổ Việt Studio", "Trần Thu Thảo", "890.000", "-30.000", "-71.200 (8.0%)", "788.800", "23/09/2026", "Đã sinh PX & HĐĐT"],
          ["LZ-2609-7721840", "Lazada Flagship Store", "Phạm Hoàng Nam", "2.150.000", "-100.000", "-153.750 (7.5%)", "1.896.250", "22/09/2026", "Đã đối chiếu VCB"],
          ["SP-2609-8834990", "Shopee Mall - Nội thất Official", "Lê Mai Anh", "620.000", "0", "-46.500 (7.5%)", "573.500", "24/09/2026", "Chờ giao hàng"],
        ],
        kpis: [
          { label: "Doanh thu sàn tháng 9", value: "248.500.000", hint: "Tăng 18% so với T8" },
          { label: "Tổng phí sàn bóc tách", value: "19.880.000", hint: "Tỷ lệ phí TB: 8.0%" },
          { label: "Đã tự động hạch toán", value: "186 đơn hàng", hint: "Đồng bộ tồn kho 2 chiều" },
        ]
      };
    }
  }

  // 5. Thuế
  if (moduleId === "tax") {
    return {
      noun: "Hồ sơ khai thuế",
      headers: ["Kỳ tính thuế", "Mẫu tờ khai", "Tên loại tờ khai thuế", "Doanh thu chịu thuế", "Thuế phát sinh", "Thuế được khấu trừ", "Hạn nộp hồ sơ", "Trạng thái mTax", "Đối chiếu CQT"],
      rows: [
        ["Quý 3/2026", "01/GTGT", "Tờ khai thuế GTGT khấu trừ (TT80/2021)", "4.850.000.000", "485.000.000", "312.400.000", "30/10/2026", "Đã ký số - Đang hoàn tất", "✓ Khớp 100% với CQT"],
        ["Quý 3/2026", "05/KK-TNCN", "Tờ khai khấu trừ thuế TNCN từ lương", "850.000.000", "32.450.000", "0", "30/10/2026", "Chờ KTT phê duyệt", "Đã đối chiếu bảng lương"],
        ["Quý 3/2026", "03/TNDN", "Tạm nộp thuế TNDN Quý 3 (Tạm tính)", "1.420.000.000", "82.500.000", "0", "30/10/2026", "Đã lập Giấy nộp tiền", "Đã tạo bút toán Nợ 821"],
      ],
      kpis: [
        { label: "Thuế GTGT còn được khấu trừ", value: "172.600.000", hint: "Chuyển sang Quý 4" },
        { label: "Thuế TNDN tạm nộp kỳ này", value: "82.500.000", hint: "Hạn nộp: 30/10/2026" },
        { label: "Tình trạng đối chiếu CQT", value: "100% Khớp", hint: "Cổng hoadondientu.gdt" },
      ]
    };
  }

  // 6. Tổng hợp & Thông tư 99
  if (moduleId === "ledger") {
    if (t.includes("tt99") || t.includes("chuyển đổi") || t.includes("ghép")) {
      return {
        noun: "Chuyển đổi dữ liệu TT99",
        headers: ["TK cũ (TT200)", "Tên tài khoản cũ", "TK mới (TT99)", "Tên tài khoản mới", "Dư Nợ đầu kỳ (VND)", "Dư Có đầu kỳ (VND)", "Quy tắc chuyển đổi", "Trạng thái ghép"],
        rows: [
          ["155", "Thành phẩm", "155", "Thành phẩm (Phân loại mới TT99)", "450.000.000", "0", "Chuyển nguyên trạng số dư", "✓ Ghép tự động hoàn tất"],
          ["156", "Hàng hóa", "156", "Hàng hóa (Quy định chi tiết TT99)", "1.280.000.000", "0", "Chuyển chi tiết theo kho", "✓ Ghép tự động hoàn tất"],
          ["242", "Chi phí trả trước", "242", "Chi phí chờ phân bổ (TT99)", "285.000.000", "0", "Chuyển tiếp kỳ phân bổ", "✓ Ghép tự động hoàn tất"],
          ["4111", "Vốn góp chủ sở hữu", "4111", "Vốn góp của chủ sở hữu (TT99)", "0", "5.000.000.000", "Chuyển nguyên trạng số dư", "✓ Ghép tự động hoàn tất"],
        ],
        kpis: [
          { label: "Tổng tài khoản cần ghép", value: "68 tài khoản", hint: "Ánh xạ TT200 -> TT99" },
          { label: "Đã tự động ghép hoàn tất", value: "68 / 68 (100%)", hint: "Không có lỗi sai lệch" },
          { label: "Kiểm tra cân đối số dư", value: "✓ Khớp tuyệt đối", hint: "Tổng Nợ = Tổng Có" },
        ]
      };
    }
    return {
      noun: "Báo cáo tài chính TT99",
      headers: ["Kỳ BCTC", "Mã biểu mẫu", "Tên báo cáo tài chính (TT99)", "Kỳ so sánh", "Ngày lập", "Người ký số", "Cân đối kế toán", "Tình trạng nộp"],
      rows: [
        ["Năm 2026", "B01-DN", "Báo cáo tình hình tài chính (Thay Bảng CĐKT)", "Năm 2025", "20/09/2026", "KTT: Nguyễn Thị Mai (SmartCA)", "✓ Tổng TS = Tổng NV", "Bản nháp niên độ"],
        ["Năm 2026", "B02-DN", "Báo cáo kết quả hoạt động kinh doanh", "Năm 2025", "20/09/2026", "KTT: Nguyễn Thị Mai (SmartCA)", "✓ Doanh thu thuần: 18.5 tỷ", "Bản nháp niên độ"],
        ["Năm 2026", "B03-DN", "Báo cáo lưu chuyển tiền tệ (Trực tiếp)", "Năm 2025", "20/09/2026", "KTT: Nguyễn Thị Mai (SmartCA)", "✓ Dòng tiền thuần: +2.1 tỷ", "Bản nháp niên độ"],
        ["Năm 2026", "B09-DN", "Bản thuyết minh Báo cáo tài chính TT99", "Năm 2025", "20/09/2026", "KTT: Nguyễn Thị Mai", "Đã điền 18/18 phụ lục", "Bản nháp niên độ"],
      ],
      kpis: [
        { label: "Bộ BCTC chuẩn Thông tư 99", value: "4 báo cáo", hint: "Áp dụng từ 01/01/2026" },
        { label: "Lợi nhuận sau thuế năm 2026", value: "+1.680.000.000", hint: "Tăng 14.5% cùng kỳ" },
        { label: "Ký số từ xa qua SmartCA", value: "Sẵn sàng", hint: "Không cần USB Token" },
      ]
    };
  }

  // 7. Giá thành
  if (moduleId === "cost") {
    return {
      noun: "Kỳ tính giá thành",
      headers: ["Kỳ tính giá", "Phương pháp tính giá", "Đối tượng THCP / Sản phẩm", "Chi phí NVL (621)", "Chi phí NC (622)", "Chi phí SXC (627)", "Dở dang CK", "Tổng giá thành", "Giá thành ĐV", "Tình trạng"],
      rows: [
        ["Tháng 09/2026", "Giản đơn", "Bàn làm việc gỗ sồi Hòa Bình (60 cái)", "185.000.000", "45.000.000", "28.000.000", "12.000.000", "246.000.000", "4.100.000 đ/cái", "Đã nghiệm thu nhập kho"],
        ["Tháng 09/2026", "Hệ số, tỷ lệ", "Nhóm Ghế xoay văn phòng GX01-GX03", "120.000.000", "32.000.000", "19.500.000", "8.500.000", "163.000.000", "Hệ số 1.0 - 1.2", "Đã phân bổ hoàn tất"],
        ["Tháng 09/2026", "Công trình", "Công trình Showroom Vincom Megamall", "540.000.000", "145.000.000", "88.000.000", "0", "773.000.000", "Nghiệm thu trọn gói", "Đã kết chuyển GV 632"],
      ],
      kpis: [
        { label: "Tổng chi phí sản xuất kỳ này", value: "1.182.000.000", hint: "Tập hợp TK 621, 622, 627" },
        { label: "Thành phẩm nhập kho", value: "1.161.500.000", hint: "Nhập kho TK 155" },
        { label: "Chi phí dở dang cuối kỳ (154)", value: "20.500.000", hint: "Đánh giá theo NVL trực tiếp" },
      ]
    };
  }

  // 8. Tiền lương
  if (moduleId === "payroll") {
    return {
      noun: "Bảng lương & Đề nghị chi trả",
      headers: ["Mã bảng lương", "Kỳ tính lương", "Khối / Phòng ban", "Số nhân sự", "Tổng quỹ lương", "Trích nộp BHXH", "Thuế TNCN", "Thực lĩnh chuyển NH", "Trạng thái"],
      rows: [
        ["BL-2026-09-VP", "Tháng 09/2026", "Khối Văn phòng & Điều hành", "28 người", "385.000.000", "40.425.000", "24.150.000", "320.425.000", "Đã duyệt chi lương qua VCB"],
        ["BL-2026-09-SX", "Tháng 09/2026", "Phân xưởng Sản xuất & Thi công", "45 người", "495.000.000", "51.975.000", "14.200.000", "428.825.000", "Đã duyệt chi lương qua BIDV"],
        ["YC-2026-09-01", "Tháng 09/2026", "Đề nghị hạch toán chi phí lương từ AMIS", "73 người", "880.000.000", "92.400.000", "38.350.000", "749.250.000", "Đã tạo chứng từ hạch toán"],
      ],
      kpis: [
        { label: "Tổng quỹ lương tháng 9", value: "880.000.000", hint: "73 cán bộ nhân viên" },
        { label: "Bảo hiểm trích theo lương", value: "92.400.000", hint: "BHXH, BHYT, BHTN" },
        { label: "Thuế TNCN khấu trừ nộp NSNN", value: "38.350.000", hint: "Đã nộp giấy nộp tiền" },
      ]
    };
  }

  // Mặc định
  return {
    noun: moduleNouns[moduleId] || title,
    headers: ["Mã chứng từ", "Ngày hạch toán", "Đối tượng / Khách hàng", "Diễn giải nghiệp vụ", "Giá trị (VND)", "Trạng thái"],
    rows: [
      ["CT-2609-018", "18/09/2026", "Công ty TNHH Gỗ Việt", "Mua nguyên vật liệu gỗ sồi xẻ theo hợp đồng", "128.600.000", "Đã ghi sổ"],
      ["CT-2609-017", "17/09/2026", "Công ty An Phú Gia", "Thanh toán dịch vụ vận tải hàng về kho", "86.400.000", "Chờ duyệt KTT"],
      ["CT-2609-016", "15/09/2026", "Nội bộ doanh nghiệp", "Điều chuyển hàng hóa giữa các kho chi nhánh", "42.750.000", "Đã hoàn tất"],
    ],
    kpis: [
      { label: "Tổng số chứng từ", value: "24", hint: "Trong kỳ hiện tại" },
      { label: "Cần xử lý phê duyệt", value: "5 việc", hint: "2 việc quá hạn" },
      { label: "Tỷ lệ hoàn tất", value: "79%", hint: "Tăng 6% so với kỳ trước" },
    ]
  };
}

export function ConfiguredListWorkspace({
  moduleId,
  title,
  notify,
}: {
  moduleId: string;
  title: string;
  notify: Notify;
}) {
  const wsData = useMemo(() => getSpecializedWorkspaceData(moduleId, title), [moduleId, title]);
  const [selectedRow, setSelectedRow] = useState<string[] | null>(null);
  const [modalRow, setModalRow] = useState<string[] | null>(null);

  return (
    <div className="erp3-workspace">
      <WorkspaceHeader
        title={title}
        description={`Quản lý ${wsData.noun.toLocaleLowerCase("vi")} theo kỳ kế toán, trạng thái phê duyệt và đối tượng liên quan.`}
        action={`Thêm ${wsData.noun.toLocaleLowerCase("vi")}`}
        notify={notify}
      />
      <div className="erp3-kpis">
        {wsData.kpis.map((kpi, idx) => (
          <article key={idx}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <small>{kpi.hint}</small>
          </article>
        ))}
      </div>
      <section className="erp3-list-card">
        <ListToolbar title={title} notify={notify} />
        <div className="erp3-view-chips">
          <button className="active">
            Tất cả <span>{wsData.rows.length}</span>
          </button>
          <button>
            Cần xử lý <span>1</span>
          </button>
          <button>
            Đã hoàn tất <span>{wsData.rows.length - 1}</span>
          </button>
        </div>
        <div className="erp3-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input aria-label="Chọn tất cả bản ghi" type="checkbox" />
                </th>
                {wsData.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {wsData.rows.map((row) => (
                <tr key={row[0]}>
                  <td>
                    <input aria-label={`Chọn ${row[0]}`} type="checkbox" />
                  </td>
                  {row.map((cell, cIdx) => {
                    const isStatus = cIdx === row.length - 1;
                    const isNumeric = cell.includes(".") && (cell.includes("000") || cell.includes("%") || cell.includes("đ/"));
                    if (cIdx === 0) {
                      return (
                        <td key={cIdx}>
                          <button
                            className="erp3-link"
                            onClick={() => {
                              setSelectedRow(row);
                              setModalRow(row);
                            }}
                          >
                            {cell}
                          </button>
                        </td>
                      );
                    }
                    if (isStatus) {
                      const isSuccess = cell.includes("Đã") || cell.includes("Đang") || cell.includes("✓") || cell.includes("An toàn") || cell.includes("Hoàn thành") || cell.includes("Sẵn sàng");
                      const isWarning = cell.includes("Chờ") || cell.includes("Sắp") || cell.includes("⚠") || cell.includes("Tạm") || cell.includes("nháp");
                      return (
                        <td key={cIdx}>
                          <span className={`erp3-status ${isSuccess ? "success" : isWarning ? "warning" : "danger"}`}>
                            {cell}
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={cIdx} className={isNumeric ? "numeric" : ""}>
                        {cell}
                      </td>
                    );
                  })}
                  <td>
                    <button
                      aria-label={`Thao tác ${row[0]}`}
                      onClick={() => {
                        setSelectedRow(row);
                        setModalRow(row);
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="erp3-pagination">
          <span>1–{wsData.rows.length} / {wsData.rows.length} bản ghi</span>
          <button disabled>Trước</button>
          <button className="active">1</button>
          <button disabled>Sau</button>
        </footer>
      </section>

      {selectedRow && (
        <aside
          className="erp3-quick-detail"
          role="region"
          aria-label="Chi tiết nhanh"
        >
          <header>
            <div>
              <span>{wsData.noun}</span>
              <h3>{selectedRow[0]}</h3>
            </div>
            <button
              aria-label="Đóng chi tiết nhanh"
              onClick={() => setSelectedRow(null)}
            >
              ×
            </button>
          </header>
          <dl>
            {wsData.headers.slice(1, 5).map((h, i) => (
              <div key={i}>
                <dt>{h}</dt>
                <dd>{selectedRow[i + 1] || "—"}</dd>
              </div>
            ))}
            <div>
              <dt>Trạng thái</dt>
              <dd>{selectedRow[selectedRow.length - 1]}</dd>
            </div>
            <div>
              <dt>Người phụ trách</dt>
              <dd>Nguyễn Thị Lan (Kế toán)</dd>
            </div>
            <div>
              <dt>Thời gian ghi sổ</dt>
              <dd>Hôm nay, 09:42</dd>
            </div>
          </dl>
          <h4>Lịch sử & Vết kiểm toán</h4>
          <p>Tạo từ quy trình nghiệp vụ · Đã xác thực SmartCA</p>
          <button
            className="erp3-primary erp3-full"
            onClick={() => setModalRow(selectedRow)}
          >
            Mở toàn bộ chứng từ <ChevronRight size={14} />
          </button>
        </aside>
      )}

      {modalRow && (
        <Modal
          title={`Chi tiết: ${modalRow[0]} · ${wsData.noun}`}
          onClose={() => setModalRow(null)}
          wide
        >
          <div className="erp3-document">
            <header className="erp3-document-state">
              <span>Mã hồ sơ: <strong>{modalRow[0]}</strong></span>
              <span>·</span>
              <span>Ngày: <strong>{modalRow[1] || "24/09/2026"}</strong></span>
              <span>·</span>
              <span className="erp3-status success">
                {modalRow[modalRow.length - 1]}
              </span>
            </header>
            <section className="erp3-info-card">
              <h3>Thông tin chung</h3>
              <dl className="erp3-definition-grid">
                {wsData.headers.slice(0, 6).map((h, i) => (
                  <div key={i}>
                    <dt>{h}</dt>
                    <dd>{modalRow[i] || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <div className="erp3-tabs" role="tablist">
              <button role="tab" aria-selected="true">
                Chi tiết hạch toán & Bút toán
              </button>
              <button role="tab" aria-selected="false">
                Thuế & Phí liên quan
              </button>
              <button role="tab" aria-selected="false">
                Nguồn gốc & Chứng từ tham chiếu
              </button>
              <button role="tab" aria-selected="false">
                Tệp đính kèm (XML / PDF)
              </button>
            </div>
            <div className="erp3-table-wrap" style={{ marginTop: "12px" }}>
              <table>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Nội dung diễn giải nghiệp vụ</th>
                    <th>TK Nợ</th>
                    <th>TK Có</th>
                    <th>Số tiền (VND)</th>
                    <th>Đối tượng / Đơn vị THCP</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>{modalRow[1] ? `Hạch toán phát sinh ${modalRow[1]}` : `Nghiệp vụ chi tiết cho ${modalRow[0]}`}</td>
                    <td><strong>{moduleId === "tools" ? "242" : moduleId === "assets" ? "211" : moduleId === "bank" ? "1121" : "642"}</strong></td>
                    <td><strong>{moduleId === "bank" ? "331" : moduleId === "sales" ? "511" : "1121"}</strong></td>
                    <td className="numeric"><strong>{modalRow[3] || "128.600.000"}</strong></td>
                    <td>Cty CP Tập đoàn Hòa Bình</td>
                  </tr>
                  <tr>
                    <td>2</td>
                    <td>Thuế GTGT hoặc chi phí bổ sung theo Thông tư 99/2025/TT-BTC</td>
                    <td><strong>1331</strong></td>
                    <td><strong>1121</strong></td>
                    <td className="numeric"><strong>12.860.000</strong></td>
                    <td>Cục Thuế TP Hà Nội</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="erp3-document-bottom">
              <section>
                <h3>Chứng từ tham chiếu & Truy vết</h3>
                <p className="erp3-related">
                  <Link2 size={14} /> Hóa đơn điện tử gốc: 0001293 (CQT đã cấp mã)
                </p>
                <p>
                  <Paperclip size={14} /> Chung-tu-goc-dinh-kem.pdf · 1.4 MB (Đã ký số SmartCA)
                </p>
              </section>
              <dl className="erp3-summary">
                <div>
                  <dt>Giá trị phát sinh</dt>
                  <dd>{modalRow[3] || "128.600.000"}</dd>
                </div>
                <div>
                  <dt>Thuế / Phí liên quan</dt>
                  <dd>12.860.000</dd>
                </div>
                <div className="total">
                  <dt>Tổng quyết toán</dt>
                  <dd style={{ color: "#0284c7", fontSize: "16px" }}>141.460.000 VND</dd>
                </div>
              </dl>
            </div>
            <footer className="erp3-document-actions">
              <button onClick={() => notify(`Bản in mẫu cho ${modalRow[0]} đã sẵn sàng.`)}>
                <Printer size={14} /> In phiếu TT99
              </button>
              <button onClick={() => notify(`Đã nhân bản chứng từ ${modalRow[0]}.`)}>
                Nhân bản
              </button>
              <button onClick={() => setModalRow(null)}>Đóng</button>
              <button
                className="erp3-primary"
                onClick={() => {
                  notify(`Đã xác thực và ghi sổ thành công ${modalRow[0]}.`);
                  setModalRow(null);
                }}
              >
                Ghi sổ kế toán
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function ReportCenterWorkspace({ notify }: { notify: Notify }) {
  const groups = [
    {
      name: "Báo cáo tài chính",
      items: [
        "Báo cáo tình hình tài chính",
        "Báo cáo kết quả hoạt động kinh doanh",
        "Báo cáo lưu chuyển tiền tệ",
      ],
    },
    {
      name: "Báo cáo quản trị",
      items: [
        "Phân tích doanh thu theo khách hàng",
        "Tuổi nợ phải thu, phải trả",
        "Tồn kho theo kho và nhóm hàng",
      ],
    },
    {
      name: "Sổ sách kế toán",
      items: ["Sổ nhật ký chung", "Sổ cái tài khoản", "Bảng cân đối phát sinh"],
    },
  ];
  return (
    <div className="erp3-workspace">
      <WorkspaceHeader
        title="Trung tâm báo cáo"
        description="Tìm, ghim và khởi chạy báo cáo theo vai trò công việc."
        action="Tạo mẫu báo cáo"
        notify={notify}
      />
      <section className="erp3-report-hero">
        <label>
          <Search size={18} />
          <input
            aria-label="Tìm báo cáo"
            placeholder="Tìm theo tên, mã hoặc chỉ tiêu báo cáo…"
          />
        </label>
        <div>
          <button className="active">Tất cả</button>
          <button>Đã ghim</button>
          <button>Đã xem gần đây</button>
          <button>Mẫu của tôi</button>
        </div>
      </section>
      <div className="erp3-report-grid">
        {groups.map((group) => (
          <section key={group.name}>
            <header>
              <h3>{group.name}</h3>
              <span>{group.items.length} báo cáo</span>
            </header>
            {group.items.map((item, index) => (
              <button
                key={item}
                onClick={() => notify(`Đang mở ${item} với dữ liệu mẫu.`)}
              >
                <span className="erp3-report-icon">{index + 1}</span>
                <span>
                  <strong>{item}</strong>
                  <small>
                    Cập nhật theo kỳ kế toán · Có thể xuất Excel/PDF
                  </small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

export function DirectoryWorkspace({ notify }: { notify: Notify }) {
  const [group, setGroup] = useState("Khách hàng");
  return (
    <div className="erp3-workspace">
      <WorkspaceHeader
        title="Danh mục"
        description="Quản lý dữ liệu nền dùng chung cho toàn bộ phân hệ."
        action={`Thêm ${group.toLocaleLowerCase("vi")}`}
        notify={notify}
      />
      <div className="erp3-master-layout">
        <aside>
          <label className="erp3-search">
            <Search size={14} />
            <input aria-label="Tìm nhóm danh mục" placeholder="Tìm nhóm…" />
          </label>
          <div role="tree" aria-label="Nhóm danh mục">
            {[
              "Khách hàng",
              "Nhà cung cấp",
              "Nhân viên",
              "Hàng hóa, dịch vụ",
              "Kho",
              "Tài khoản ngân hàng",
              "Phòng ban",
              "Mục thu, chi",
            ].map((item) => (
              <button
                role="treeitem"
                aria-selected={group === item}
                className={group === item ? "active" : ""}
                onClick={() => setGroup(item)}
                key={item}
              >
                <span>{item}</span>
                <small>{item === group ? "126" : "24"}</small>
              </button>
            ))}
          </div>
        </aside>
        <section className="erp3-list-card">
          <ListToolbar title={group} notify={notify} />
          <div className="erp3-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input aria-label="Chọn tất cả danh mục" type="checkbox" />
                  </th>
                  <th aria-label="Mã">Mã danh mục</th>
                  <th>Tên {group.toLocaleLowerCase("vi")}</th>
                  <th aria-label="MST doanh nghiệp">Mã số thuế</th>
                  <th>Nhóm</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <input aria-label="Chọn KH0001" type="checkbox" />
                  </td>
                  <td>KH0001</td>
                  <td>Công ty CP Nội thất Hòa Bình</td>
                  <td>0109238456</td>
                  <td>Khách hàng doanh nghiệp</td>
                  <td>
                    <span className="erp3-status success">Đang theo dõi</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <input aria-label="Chọn KH0002" type="checkbox" />
                  </td>
                  <td>KH0002</td>
                  <td>Công ty TNHH Kiến trúc Mới</td>
                  <td>0107754921</td>
                  <td>Khách hàng dự án</td>
                  <td>
                    <span className="erp3-status success">Đang theo dõi</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export function OpeningBalanceWorkspace({ notify }: { notify: Notify }) {
  return (
    <div className="erp3-workspace">
      <WorkspaceHeader
        title="Số dư ban đầu"
        description="Khai báo và đối chiếu số dư khi bắt đầu sử dụng dữ liệu kế toán."
        action="Khai báo số dư"
        notify={notify}
      />
      <div className="erp3-opening-tabs" role="tablist" aria-label="Nhóm số dư">
        <button role="tab" aria-selected="true">
          Số dư tài khoản
        </button>
        <button role="tab" aria-selected="false">
          Công nợ khách hàng
        </button>
        <button role="tab" aria-selected="false">
          Công nợ nhà cung cấp
        </button>
        <button role="tab" aria-selected="false">
          Tồn kho
        </button>
        <button role="tab" aria-selected="false">
          Tài sản & CCDC
        </button>
      </div>
      <section className="erp3-list-card">
        <div className="erp3-list-toolbar">
          <label className="erp3-search">
            <Search size={14} />
            <input
              aria-label="Tìm tài khoản"
              placeholder="Tìm số hiệu hoặc tên tài khoản…"
            />
          </label>
          <button>
            <Filter size={14} /> Chỉ hiện có số dư
          </button>
          <span className="erp3-toolbar-spacer" />
          <button onClick={() => notify("Đã kiểm tra cân đối dữ liệu mẫu.")}>
            Kiểm tra cân đối
          </button>
          <button
            className="erp3-primary"
            onClick={() => notify("Sẵn sàng nhận tệp Excel mẫu.")}
          >
            <Upload size={14} /> Nhập từ Excel
          </button>
        </div>
        <div className="erp3-balance-summary">
          <span>
            Tổng dư Nợ <strong>4.286.540.000</strong>
          </span>
          <span>
            Tổng dư Có <strong>4.286.540.000</strong>
          </span>
          <span className="balanced">✓ Cân đối</span>
        </div>
        <div className="erp3-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Số hiệu</th>
                <th>Tên tài khoản</th>
                <th>Dư Nợ</th>
                <th>Dư Có</th>
                <th>Ngoại tệ</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["1111", "Tiền Việt Nam", "245.600.000", ""],
                ["1121", "Tiền gửi ngân hàng", "1.820.400.000", ""],
                ["331", "Phải trả cho người bán", "", "685.200.000"],
              ].map((r) => (
                <tr key={r[0]}>
                  <td>{r[0]}</td>
                  <td>{r[1]}</td>
                  <td className="numeric">{r[2]}</td>
                  <td className="numeric">{r[3]}</td>
                  <td>VND</td>
                  <td>
                    <input aria-label={`Ghi chú tài khoản ${r[0]}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
