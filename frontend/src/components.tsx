import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  X,
  Plus,
  Trash2,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
} from "lucide-react";
import {
  dateLabel,
  kinds,
  money,
  partners,
  statuses,
  type Kind,
  type Transaction,
} from "./data";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  drawer = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  drawer?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${drawer ? "drawer" : ""} ${className}`}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="modal-header">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" aria-label="Đóng" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function StatusBadge({ status }: { status: Transaction["status"] }) {
  return (
    <span className={`status ${status}`}>
      <span aria-hidden="true">
        {status === "posted" ? "✓" : status === "pending" ? "◷" : "•"}
      </span>
      {statuses[status]}
    </span>
  );
}
export function TransactionTable({
  items,
  onSelect,
  selected,
  onToggle,
}: {
  items: Transaction[];
  onSelect: (t: Transaction) => void;
  selected?: string[];
  onToggle?: (id: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">
          Danh sách chứng từ mẫu, đơn vị Việt Nam đồng
        </caption>
        <thead>
          <tr>
            {onToggle && (
              <th className="check-cell">
                <span className="sr-only">Chọn</span>
              </th>
            )}
            <th>Số chứng từ / Ngày</th>
            <th>Diễn giải</th>
            <th>Đối tượng</th>
            <th className="numeric">Số tiền</th>
            <th>Trạng thái</th>
            <th>
              <span className="sr-only">Chi tiết</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              {onToggle && (
                <td className="check-cell">
                  <input
                    type="checkbox"
                    aria-label={`Chọn ${t.code}`}
                    checked={selected?.includes(t.id) || false}
                    onChange={() => onToggle(t.id)}
                  />
                </td>
              )}
              <td>
                <button className="document-link" onClick={() => onSelect(t)}>
                  {t.code}
                </button>
                <small>{dateLabel(t.date)}</small>
              </td>
              <td>
                <div className="description-cell">
                  <span className={`transaction-icon ${t.kind}`}>
                    <FileText size={17} />
                  </span>
                  <span>
                    {t.description}
                    <small>{kinds[t.kind]}</small>
                  </span>
                </div>
              </td>
              <td className="partner-cell">{t.partner}</td>
              <td className="numeric amount">{money(t.amount)}</td>
              <td>
                <StatusBadge status={t.status} />
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Xem ${t.code}`}
                  onClick={() => onSelect(t)}
                >
                  <ArrowUpRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
type Line = {
  id: string;
  description: string;
  debit: string;
  credit: string;
  amount: string;
};
export function DocumentForm({
  kind,
  company,
  period,
  onSave,
  onClose,
}: {
  kind: Kind;
  company: string;
  period: string;
  onSave: (item: Transaction, another: boolean) => boolean;
  onClose: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([
    {
      id: crypto.randomUUID(),
      description: "",
      debit: "",
      credit: "",
      amount: "",
    },
  ]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const close = () => {
    if (
      !dirty ||
      window.confirm("Bạn có thay đổi chưa lưu. Đóng và bỏ các thay đổi?")
    )
      onClose();
  };
  const total = lines.reduce(
    (sum, line) => sum + (Number(line.amount) || 0),
    0,
  );
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!Number.isSafeInteger(total) || total <= 0) {
      setError("Nhập số tiền nguyên dương và trong phạm vi cho phép.");
      return;
    }
    const data = new FormData(e.currentTarget);
    const partner = String(data.get("partner")).trim(),
      description = String(data.get("description")).trim();
    if (!partner || !description) {
      setError("Vui lòng nhập đối tượng và diễn giải, không chỉ khoảng trắng.");
      formRef.current
        ?.querySelector<HTMLInputElement>('[name="partner"]')
        ?.focus();
      return;
    }
    const id = crypto.randomUUID();
    const another =
      (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "another";
    const saved = onSave(
      {
        id,
        code: `NH-${id.slice(0, 8).toUpperCase()}`,
        company,
        kind,
        date: String(data.get("date")),
        partner,
        description,
        amount: total,
        status: "draft",
        lines: lines.map((line) => ({
          description: line.description.trim(),
          amount: Number(line.amount),
        })),
      },
      another,
    );
    if (!saved) {
      setError(
        "Không thể lưu phiếu. Hãy kiểm tra quyền hoặc dung lượng lưu trữ trình duyệt rồi thử lại.",
      );
      return;
    }
    if (another) {
      formRef.current?.reset();
      setLines([
        {
          id: crypto.randomUUID(),
          description: "",
          debit: "",
          credit: "",
          amount: "",
        },
      ]);
      setDirty(false);
      setError("");
    }
  }
  const updateLine = (id: string, field: keyof Line, value: string) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
    setDirty(true);
  };
  return (
    <Modal
      title={`Tạo ${kinds[kind].toLocaleLowerCase("vi-VN")}`}
      onClose={close}
      wide
    >
      <form ref={formRef} onSubmit={submit} onChange={() => setDirty(true)}>
        <div className="modal-body">
          <p className="info-note">
            Bản trải nghiệm · Phiếu nháp được lưu trên trình duyệt, chưa ghi sổ
            kế toán.
          </p>
          <h3>Thông tin chung</h3>
          <div className="form-grid">
            <label>
              Đối tượng <span>*</span>
              <input
                name="partner"
                required
                maxLength={180}
                list="partners"
                autoComplete="off"
                placeholder="Chọn hoặc nhập tên đối tượng…"
              />
            </label>
            <datalist id="partners">
              {partners.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </datalist>
            <label>
              Ngày chứng từ <span>*</span>
              <input
                type="date"
                name="date"
                required
                defaultValue={`${period.length === 7 ? period : period + "-09"}-24`}
              />
            </label>
            <label className="full">
              Diễn giải <span>*</span>
              <input
                name="description"
                required
                maxLength={240}
                autoComplete="off"
                placeholder="Nội dung nghiệp vụ…"
              />
            </label>
          </div>
          <div className="section-heading">
            <h3>Chi tiết số tiền</h3>
            <span className="muted">Đơn vị: VND</span>
          </div>
          <div className="entry-lines">
            {lines.map((l, i) => (
              <div className="entry-line" key={l.id}>
                <span className="line-number">{i + 1}</span>
                <label className="line-description">
                  Nội dung
                  <input
                    value={l.description}
                    onChange={(e) =>
                      updateLine(l.id, "description", e.target.value)
                    }
                    aria-label={`Nội dung dòng ${i + 1}`}
                    placeholder="Nội dung chi tiết…"
                  />
                </label>
                <label>
                  Số tiền <span>*</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    required
                    min="1"
                    max="999999999999"
                    step="1"
                    value={l.amount}
                    onChange={(e) => updateLine(l.id, "amount", e.target.value)}
                    aria-label={`Số tiền dòng ${i + 1}`}
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Sao chép dòng ${i + 1}`}
                  onClick={() => {
                    setLines([...lines, { ...l, id: crypto.randomUUID() }]);
                    setDirty(true);
                  }}
                >
                  <Copy size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={lines.length === 1}
                  aria-label={`Xóa dòng ${i + 1}`}
                  onClick={() => {
                    setLines(lines.filter((x) => x.id !== l.id));
                    setDirty(true);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="text-button add-line"
            onClick={() => {
              setLines([
                ...lines,
                {
                  id: crypto.randomUUID(),
                  description: "",
                  debit: "",
                  credit: "",
                  amount: "",
                },
              ]);
              setDirty(true);
            }}
          >
            <Plus size={16} />
            Thêm dòng
          </button>
          <div className="form-total">
            Tổng cộng<strong>{money(total)}</strong>
          </div>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-footer">
          <button type="button" className="button" onClick={close}>
            Hủy
          </button>
          <button className="button" type="submit" value="another">
            Lưu & thêm mới
          </button>
          <button className="button primary" type="submit">
            <Check size={16} />
            Lưu bản nháp
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function DocumentDetail({
  item,
  onClose,
  onSubmit,
}: {
  item: Transaction;
  onClose: () => void;
  onSubmit: (id: string) => void;
}) {
  const lineTable = item.lines && (
    <>
      <h3>Chi tiết số tiền</h3>
      <div className="table-scroll">
        <table className="detail-lines">
          <thead>
            <tr>
              <th>Nội dung</th>
              <th className="numeric">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {item.lines.map((line, i) => (
              <tr key={i}>
                <td>{line.description || `Dòng ${i + 1}`}</td>
                <td className="numeric">{money(line.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
  return (
    <Modal title={`Chứng từ ${item.code}`} onClose={onClose} drawer>
      <div className="modal-body">
        <div className="detail-amount">
          <span className="large-icon">
            <ArrowDownLeft />
          </span>
          <span>
            {kinds[item.kind]}
            <strong>{money(item.amount)}</strong>
          </span>
          <StatusBadge status={item.status} />
        </div>
        <dl className="detail-fields">
          <div>
            <dt>Đối tượng</dt>
            <dd>{item.partner}</dd>
          </div>
          <div>
            <dt>Ngày chứng từ</dt>
            <dd>{dateLabel(item.date)}</dd>
          </div>
          <div>
            <dt>Diễn giải</dt>
            <dd>{item.description}</dd>
          </div>
        </dl>
        {lineTable}
        <h3>Lịch sử nghiệp vụ</h3>
        <ol className="timeline">
          <li className="complete">
            <strong>Tạo chứng từ</strong>
            <small>{dateLabel(item.date)} · Dữ liệu mẫu</small>
          </li>
          <li className={item.status !== "draft" ? "complete" : ""}>
            <strong>
              {item.status === "draft" ? "Chưa gửi duyệt" : "Đã gửi duyệt"}
            </strong>
            <small>Kiểm tra thông tin chứng từ</small>
          </li>
          <li className={item.status === "posted" ? "complete" : ""}>
            <strong>
              {item.status === "posted" ? "Đã ghi sổ (mẫu)" : "Chưa ghi sổ"}
            </strong>
            <small>Nghiệp vụ thật sẽ được xử lý tại máy chủ</small>
          </li>
        </ol>
      </div>
      <footer className="modal-footer">
        <button className="button" onClick={onClose}>
          Đóng
        </button>
        {item.status === "draft" && (
          <button className="button primary" onClick={() => onSubmit(item.id)}>
            Gửi duyệt thử
          </button>
        )}
      </footer>
    </Modal>
  );
}
