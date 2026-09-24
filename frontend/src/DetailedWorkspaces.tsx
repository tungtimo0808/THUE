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

const genericRows = [
  [
    "CT-2609-018",
    "18/09/2026",
    "Công ty TNHH Gỗ Việt",
    "128.600.000",
    "Đã ghi sổ",
  ],
  ["CT-2609-017", "17/09/2026", "Công ty An Phú", "86.400.000", "Chờ duyệt"],
  [
    "CT-2609-016",
    "15/09/2026",
    "Nội bộ doanh nghiệp",
    "42.750.000",
    "Bản nháp",
  ],
];

export function ConfiguredListWorkspace({
  moduleId,
  title,
  notify,
}: {
  moduleId: string;
  title: string;
  notify: Notify;
}) {
  const noun = moduleNouns[moduleId] || title;
  const rows = useMemo(
    () =>
      moduleId === "assets"
        ? [
            [
              "TSCD-0012",
              "01/01/2025",
              "Máy cắt CNC Woodmaster",
              "680.000.000",
              "Đang sử dụng",
            ],
            [
              "TSCD-0011",
              "12/06/2024",
              "Xe tải giao hàng",
              "520.000.000",
              "Đang sử dụng",
            ],
            [
              "TSCD-0008",
              "20/03/2023",
              "Hệ thống hút bụi",
              "185.000.000",
              "Chờ thanh lý",
            ],
          ]
        : genericRows,
    [moduleId],
  );
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="erp3-workspace">
      <WorkspaceHeader
        title={title}
        description={`Quản lý ${noun.toLocaleLowerCase("vi")} theo kỳ, trạng thái và đối tượng liên quan.`}
        action={`Thêm ${noun.toLocaleLowerCase("vi")}`}
        notify={notify}
      />
      <div className="erp3-kpis">
        <article>
          <span>Tổng số</span>
          <strong>24</strong>
          <small>Trong kỳ hiện tại</small>
        </article>
        <article>
          <span>Cần xử lý</span>
          <strong>5</strong>
          <small>2 việc quá hạn</small>
        </article>
        <article>
          <span>Hoàn tất</span>
          <strong>79%</strong>
          <small>Tăng 6% so với kỳ trước</small>
        </article>
      </div>
      <section className="erp3-list-card">
        <ListToolbar title={title} notify={notify} />
        <div className="erp3-view-chips">
          <button className="active">
            Tất cả <span>24</span>
          </button>
          <button>
            Cần xử lý <span>5</span>
          </button>
          <button>
            Hoàn tất <span>19</span>
          </button>
        </div>
        <div className="erp3-table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input aria-label="Chọn tất cả bản ghi" type="checkbox" />
                </th>
                <th>Mã</th>
                <th>Ngày</th>
                <th>{moduleId === "assets" ? "Tên tài sản" : "Đối tượng"}</th>
                <th>Giá trị</th>
                <th>Tình trạng</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row[0]}>
                  <td>
                    <input aria-label={`Chọn ${row[0]}`} type="checkbox" />
                  </td>
                  <td>
                    <button
                      className="erp3-link"
                      onClick={() => setSelected(row[0])}
                    >
                      {row[0]}
                    </button>
                  </td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td className="numeric">{row[3]}</td>
                  <td>
                    <span
                      className={`erp3-status ${row[4].includes("Đã") || row[4].includes("Đang") ? "success" : "warning"}`}
                    >
                      {row[4]}
                    </span>
                  </td>
                  <td>
                    <button aria-label={`Thao tác ${row[0]}`}>
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="erp3-pagination">
          <span>1–3 / 24 bản ghi</span>
          <button disabled>Trước</button>
          <button className="active">1</button>
          <button>2</button>
          <button>Sau</button>
        </footer>
      </section>
      {selected && (
        <aside
          className="erp3-quick-detail"
          role="region"
          aria-label="Chi tiết nhanh"
        >
          <header>
            <div>
              <span>{noun}</span>
              <h3>{selected}</h3>
            </div>
            <button
              aria-label="Đóng chi tiết nhanh"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
          </header>
          <dl>
            <div>
              <dt>Tình trạng</dt>
              <dd>Đang theo dõi</dd>
            </div>
            <div>
              <dt>Người phụ trách</dt>
              <dd>Nguyễn Thị Lan</dd>
            </div>
            <div>
              <dt>Cập nhật</dt>
              <dd>Hôm nay, 09:42</dd>
            </div>
          </dl>
          <h4>Lịch sử</h4>
          <p>Tạo mới từ dữ liệu mẫu</p>
          <button
            className="erp3-primary erp3-full"
            onClick={() => notify(`Đã mở hồ sơ ${selected}.`)}
          >
            Mở chi tiết <ChevronRight size={14} />
          </button>
        </aside>
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
