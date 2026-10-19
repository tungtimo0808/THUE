import {useNavigate} from "react-router-dom";
import DirectoryChoiceField from "./DirectoryChoiceField";
import VoucherDateField from "./VoucherDateField";
import { useEffect, useRef, useState } from "react";
import { useApiSession } from "./ApiSession";
import { useMisaApiLists } from "./misa-api-lists";
import { request } from "./live-api";
import { createApiWriter, directoryInput } from "./misa-api-writes";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import { MISA_DIRECTORY_DEFINITIONS } from "./misa-directory-definitions";
import type { DirectoryDefinition } from "./misa-directory-definitions";
import "./misa-directory.css";
import DirectoryTabContent from "./DirectoryTabContent";
import {
  requiredDirectoryField,
  validateDirectoryEntry,
  normalizeDirectoryValues,
} from "./directory-entry";
type DirectoryRow = { id: string; values: Record<string, string> };
const directoryApiPaths: Record<string, string> = {
  "Khách hàng": "/api/v1/master-data/customers/",
  "Nhà cung cấp": "/api/v1/master-data/parties/",
  "Nhân viên": "/api/v1/organization/employees/",
  "Vật tư hàng hóa": "/api/v1/master-data/items/",
  "Kho": "/api/v1/master-data/warehouses/",
  "Nhóm vật tư, hàng hóa, dịch vụ": "/api/v1/master-data/item-categories/",
  "Đơn vị tính": "/api/v1/master-data/units-of-measure/",
  "Ngân hàng": "/api/v1/master-data/banks/",
  "Tài khoản ngân hàng": "/api/v1/master-data/company-bank-accounts/",
  "Khoản mục chi phí": "/api/v1/master-data/expense-items/",
  "Mã thống kê": "/api/v1/master-data/statistical-codes/",
  "Loại tiền": "/api/v1/master-data/currencies/",
  "Loại chứng từ": "/api/v1/master-data/document-types/",
  "Điều khoản thanh toán": "/api/v1/master-data/payment-terms/",
};
const writableDirectories = new Set([
  "Kho", "Khoản mục chi phí", "Mã thống kê", "Ngân hàng",
  "Nhóm vật tư, hàng hóa, dịch vụ", "Điều khoản thanh toán", "Loại tiền",
  "Nhà cung cấp", "Khách hàng", "Đơn vị tính", "Vật tư hàng hóa", "Tài khoản ngân hàng", "Nhân viên",
]);
const directoryValue = (row: Record<string, any>, header: string): string => {
  if (/^Mã/.test(header)) return String(row.code || row.number || "");
  if (/^Tên viết tắt/.test(header)) return String(row.code || "");
  if (/^Số tài khoản/.test(header)) return String(row.account_number || "");
  if (/^Tên/.test(header)) return String(row.name || row.full_name || row.bank_name || "");
  if (/^Địa chỉ/.test(header)) return String(row.address || "");
  if (/^Mô tả|^Diễn giải/.test(header)) return String(row.description || row.notes || "");
  if (/^Đơn vị tính/.test(header)) return String(row.name || row.code || "");
  if (/^Trạng thái/.test(header)) return String(row.status || "");
  if (/^Mã số thuế/.test(header)) return String(row.tax_code || "");
  return "";
};
const seedRows = (definition: DirectoryDefinition): DirectoryRow[] =>
  [1, 2].map((index) => ({
    id: String(index),
    values: Object.fromEntries(
      definition.headers.map((header) => [
        header,
        /Mã số thuế|CCCD|Điện thoại|Địa chỉ/.test(header)
          ? ""
          : /^Mã|^Số tài khoản|^Số hiệu|^Ký hiệu/.test(header)
            ? `${definition.name === "Khách hàng" ? "KH" : definition.name === "Nhà cung cấp" ? "NCC" : definition.name === "Nhân viên" ? "NV" : "DM"}00${index}`
            : /^Tên|^Họ/.test(header)
              ? `${definition.name} mẫu ${index}`
              : header === "Trạng thái"
                ? "Đang sử dụng"
                : /Công nợ|Số tiền|Giá trị|Số lượng/.test(header)
                  ? "0"
                  : "",
      ]),
    ),
  }));
export default function MisaDirectoryWorkspace({
  legacy,
  initialName,
  initialCreate = false,
  onEntrySaved,
  onEditorClose,
  notify,
}: {
  legacy: ReactNode;
  initialName?: string|null;
  initialCreate?: boolean;
  onEntrySaved?: (values: Record<string,string>)=>void;
  onEditorClose?: ()=>void;
  notify: (text: string) => void;
}) {
  const directoryNavigate=useNavigate();
  const { companyId, token } = useApiSession();
  const [definition, setDefinition] = useState<DirectoryDefinition | null>(
    MISA_DIRECTORY_DEFINITIONS.find(item=>item.name===initialName) || null,
  );
  const apiPath = definition ? directoryApiPaths[definition.name] : undefined;
  const { rows: apiRows, connected: apiConnected, reload: reloadApi } = useMisaApiLists(
    companyId, apiPath ? { entries: apiPath } : {}, notify,
  );
  const [legacyView, setLegacyView] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<Record<string, DirectoryRow[]>>({});
  useEffect(() => setRecords({}), [companyId]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [editor, setEditor] = useState<DirectoryRow | null>(():DirectoryRow|null=>initialCreate&&definition?{id:crypto.randomUUID(),values:definition.radios.length?{Loại:definition.radios[0]}:{}}:null);
  const [error, setError] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState(initialCreate?definition?.tabs[0]||"":"");
  const editorRef = useRef<HTMLDivElement>(null);
  const closeEditor = () => { setEditor(null); onEditorClose?.(); };
  const updateEditor = (key: string, value: string) =>
    setEditor((previous) =>
      previous
        ? { ...previous, values: { ...previous.values, [key]: value } }
        : previous,
    );
  useEffect(() => {
    if (!editor) return;
    const previous = document.activeElement as HTMLElement | null;
    editorRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditor();
      if (event.key === "Tab") {
        const items = [
          ...editorRef.current!.querySelectorAll<HTMLElement>(
            "button,input,select,textarea",
          ),
        ].filter((element) => !element.hasAttribute("disabled"));
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, [!!editor]);
  const open = (next: DirectoryDefinition) => {
    setDefinition(next);
    setQuery("");
    setSelected([]);
    setHidden([]);
    setColumnsOpen(false);
    setPage(1);
  };
  const allRows = definition
    ? records[definition.name] ||
      (apiConnected && apiPath
        ? (apiRows.entries || []).map((row) => ({
            id: String(row.id),
            values: Object.fromEntries(definition.headers.map((header) => [header, directoryValue(row, header)])),
          }))
        : seedRows(definition)).map((row) => ({
        ...row,
        values: normalizeDirectoryValues(
          definition.fields,
          definition.headers,
          row.values,
        ),
      }))
    : [];
  const rows = allRows.filter((row) =>
    Object.values(row.values)
      .join(" ")
      .toLocaleLowerCase("vi")
      .includes(query.toLocaleLowerCase("vi")),
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const headers =
    definition?.headers.filter((header) => !hidden.includes(header)) || [];
  const editFields = definition?.fields.length
    ? definition.fields
    : definition?.headers
        .filter(
          (header) =>
            header !== "Chức năng" &&
            !/Công nợ|Số tiền nợ|Giá trị tồn|Số lượng tồn/.test(header),
        )
        .map((label) => ({ label, kind: "text" })) || [];
  const showEditor = (row?: DirectoryRow) => {
    setEditor(
      row
        ? structuredClone(row)
        : {
            id: crypto.randomUUID(),
            values: definition?.radios.length
              ? {
                  Loại:
                    definition.name === "Mục thu/chi"
                      ? definition.radios.at(-1)!
                      : definition.radios[0],
                }
              : {},
          },
    );
    setError("");
    setTab(definition?.tabs[0] || "");
  };
  const save = async (addAnother = false) => {
    if (!definition || !editor) return;
    const normalized = {
      ...editor,
      values: normalizeDirectoryValues(
        editFields,
        definition.headers,
        editor.values,
      ),
    };
    const problem = validateDirectoryEntry(
      editFields,
      normalized.values,
      allRows,
      editor.id,
    );
    if (problem) {
      setError(problem);
      return;
    }
    if (apiConnected && apiPath && writableDirectories.has(definition.name)) {
      const original = apiRows.entries?.find((row) => String(row.id) === editor.id);
      const existing = allRows.some((row) => row.id === editor.id);
      const values = normalized.values;
      const code = definition.name === "Ngân hàng"
        ? values["Tên viết tắt"]
        : Object.entries(values).find(([label]) => /^Mã/.test(label))?.[1] || values["Mã"];
      const name = definition.name === "Ngân hàng"
        ? values["Tên đầy đủ"]
        : Object.entries(values).find(([label]) => /^Tên/.test(label))?.[1] || values["Tên"];
      try {
        const baseInput: Record<string, any> = {
          ...(definition.name === "Ngân hàng" || definition.name === "Loại tiền" ? {} : { company: companyId }),
          code, name,
          ...(original?.version ? { version: original.version } : {}),
        };
        if (definition.name === "Kho") Object.assign(baseInput, {
          address: values["Địa chỉ"] || "", warehouse_type: "PHYSICAL", warehouse_scope: "COMPANY_SHARED",
        });
        if (definition.name === "Nhà cung cấp" || definition.name === "Khách hàng") {
          baseInput.party_type = values["Loại"] === "Cá nhân" ? "INDIVIDUAL" : "ORGANIZATION";
          baseInput.tax_code = values["Mã số thuế"] || null;
          baseInput.legal_name = name;
        }
        if (definition.name === "Điều khoản thanh toán") {
          baseInput.due_days = Number(values["Số ngày được nợ"] || 0);
          baseInput.discount_days = values["Thời hạn hưởng chiết khấu"] ? Number(values["Thời hạn hưởng chiết khấu"]) : null;
          baseInput.discount_rate = values["Tỷ lệ chiết khấu"] ? Number(values["Tỷ lệ chiết khấu"]) : null;
          baseInput.scope = "BOTH";
          baseInput.due_base = "DOCUMENT";
          baseInput.has_discount = Boolean(baseInput.discount_rate);
        }
        const special = await directoryInput(
          createApiWriter(companyId, (path, init) => request(path, token, init)), definition.name, values,
        );
        if (special) Object.assign(baseInput, special);
        const saved = await request<Record<string, any>>(
          existing ? `${apiPath}${editor.id}/?company_id=${encodeURIComponent(companyId)}`
            : `${apiPath}?company_id=${encodeURIComponent(companyId)}`,
          token,
          {
            method: existing ? "PATCH" : "POST",
            body: JSON.stringify(baseInput),
          },
        );
        normalized.id = String(saved.id);
        reloadApi();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Không lưu được danh mục.");
        return;
      }
    }
    setRecords((previous) => ({
      ...previous,
      [definition.name]: allRows.some((row) => row.id === editor.id)
        ? allRows.map((row) => (row.id === editor.id ? normalized : row))
        : [...allRows, normalized],
    }));
    notify(apiConnected && apiPath && writableDirectories.has(definition.name)
      ? "Đã lưu danh mục lên hệ thống." : "Đã cất dữ liệu danh mục trên frontend.");
    onEntrySaved?.(normalized.values);
    if (addAnother) {
      setEditor({
        id: crypto.randomUUID(),
        values: definition.radios.length
          ? {
              Loại:
                definition.name === "Mục thu/chi"
                  ? definition.radios.at(-1)!
                  : definition.radios[0],
            }
          : {},
      });
      setError("");
    } else closeEditor();
  };
  if (legacyView)
    return (
      <div>
        <div className="md-legacy-bar">
          <button onClick={() => setLegacyView(false)}>
            <ArrowLeft size={14} /> Danh mục Sổ Việt
          </button>
        </div>
        {legacy}
      </div>
    );
  if (!definition) {
    const groups = [
      ...new Set(MISA_DIRECTORY_DEFINITIONS.map((item) => item.group)),
    ];
    return (
      <div className="md-home">
        <header>
          <h1>Danh mục</h1>
          <label>
            <Search size={16} />
            <input
              aria-label="Tìm danh mục"
              placeholder="Tìm danh mục"
              value={menuQuery}
              onInput={(e) => setMenuQuery(e.currentTarget.value)}
              onChange={(e) => setMenuQuery(e.target.value)}
            />
          </label>
          <button onClick={() => setLegacyView(true)}>Danh sách hiện có</button>
        </header>
        <div className="md-groups">
          {groups.map((group) => {
            const items = MISA_DIRECTORY_DEFINITIONS.filter(
              (item) =>
                item.group === group &&
                item.name
                  .toLocaleLowerCase("vi")
                  .includes(menuQuery.toLocaleLowerCase("vi")),
            );
            return items.length ? (
              <section key={group}>
                <h2>{group}</h2>
                {items.map((item) => (
                  <button key={item.name} onClick={() => open(item)}>
                    {item.name}
                  </button>
                ))}
              </section>
            ) : null;
          })}
        </div>
      </div>
    );
  }
  return (
    <div className={`md-list${initialCreate ? " md-editor-only" : ""}`}>
      <header>
        <button aria-label="Về danh mục" onClick={() => setDefinition(null)}>
          <ArrowLeft size={18} />
        </button>
        <h1>{definition.name}</h1>
        {definition.canAdd && (
          <button onClick={() => showEditor()}>
            <Plus size={15} /> Thêm
          </button>
        )}
      </header>
      <div className="md-toolbar">
        <label>
          <Search size={15} />
          <input
            aria-label={`Tìm ${definition.name.toLocaleLowerCase("vi")}`}
            placeholder="Tìm kiếm"
            value={query}
            onInput={(e) => {
              setQuery(e.currentTarget.value);
              setPage(1);
            }}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span />
        {selected.length > 0 && <b>Đã chọn {selected.length}</b>}
        <button
          aria-label="Ẩn hiện cột danh mục"
          onClick={() => setColumnsOpen(!columnsOpen)}
        >
          <Settings size={16} />
          <ChevronDown size={13} />
        </button>
      </div>
      {columnsOpen && (
        <div className="md-column-picker">
          {definition.headers.map((header) => (
            <label key={header}>
              <input
                type="checkbox"
                checked={!hidden.includes(header)}
                onChange={() =>
                  setHidden((previous) =>
                    previous.includes(header)
                      ? previous.filter((value) => value !== header)
                      : [...previous, header],
                  )
                }
              />
              {header}
            </label>
          ))}
        </div>
      )}
      <div className="md-table">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  aria-label="Chọn tất cả danh mục"
                  type="checkbox"
                  checked={
                    rows.length > 0 &&
                    rows.every((row) => selected.includes(row.id))
                  }
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? rows.map((row) => row.id) : [],
                    )
                  }
                />
              </th>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice((visiblePage - 1) * pageSize, visiblePage * pageSize)
              .map((row) => (
                <tr key={row.id} onDoubleClick={() => showEditor(row)}>
                  <td>
                    <input
                      aria-label={`Chọn dòng ${row.id}`}
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={(e) =>
                        setSelected((previous) =>
                          e.target.checked
                            ? [...previous, row.id]
                            : previous.filter((id) => id !== row.id),
                        )
                      }
                    />
                  </td>
                  {headers.map((header) => (
                    <td key={header}>
                      {header === "Chức năng" ? (
                        <button onClick={() => showEditor(row)}>Sửa</button>
                      ) : (
                        row.values[header]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            {!rows.length && (
              <tr>
                <td colSpan={headers.length + 1} className="md-empty">
                  Không có dữ liệu phù hợp với điều kiện tìm kiếm
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer>
        <span>
          Tổng số: <b>{rows.length}</b>
        </span>
        <label>
          Số dòng/trang{" "}
          <select
            aria-label="Số dòng/trang danh mục"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[20, 50, 100].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <button
          disabled={visiblePage === 1}
          aria-label="Trang trước danh mục"
          onClick={() => setPage(visiblePage - 1)}
        >
          ‹
        </button>
        <span>
          {visiblePage}/{pageCount}
        </span>
        <button
          disabled={visiblePage === pageCount}
          aria-label="Trang sau danh mục"
          onClick={() => setPage(visiblePage + 1)}
        >
          ›
        </button>
      </footer>
      {editor && (
        <div
          className="md-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEditor();
          }}
        >
          <div
            className="md-editor"
            ref={editorRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Thông tin ${definition.name.toLocaleLowerCase("vi")}`}
          >
            <header>
              <h2>Thông tin {definition.name.toLocaleLowerCase("vi")}</h2>
              <button
                aria-label="Đóng thông tin danh mục"
                onClick={() => closeEditor()}
              >
                <X size={20} />
              </button>
            </header>
            <div className="md-editor-body">
              {definition.radios.length > 0 && (
                <div
                  className="md-radio-types"
                  role="radiogroup"
                  aria-label={definition.name==="Nhân viên"?"Giới tính":"Loại đối tượng"}
                >
                  {definition.radios.map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="directory-type"
                        checked={editor.values.Loại === value}
                        onChange={() => updateEditor("Loại", value)}
                      />
                      {value}
                    </label>
                  ))}
                </div>
              )}
              <div className="md-fields">
                {editFields.map((field) => (
                  <label key={field.label}>
                    {field.label}
                    {(definition.name==="Tài khoản ngân hàng"?["Số tài khoản","Tên ngân hàng"].includes(field.label):requiredDirectoryField(field.label)||(definition.name==="Nhân viên"&&["Đơn vị","Chức danh"].includes(field.label))) && <em>*</em>}
                    {field.kind==="combo"?<DirectoryChoiceField onManage={()=>{const query=new URLSearchParams(window.location.search);query.set("directory","Cơ cấu tổ chức");directoryNavigate("/directory?"+query.toString());}} label={field.label} value={editor.values[field.label]||""} onChange={value=>updateEditor(field.label,value)} options={"options" in field?field.options as string[]:[]}/> : ["Ngày sinh","Ngày cấp"].includes(field.label)?<VoucherDateField value={editor.values[field.label]||""} onChange={value=>updateEditor(field.label,value)} label={field.label}/> : field.kind === "textarea" ? (
                      <textarea
                        value={editor.values[field.label] || ""}
                        onChange={(e) =>
                          updateEditor(field.label, e.target.value)
                        }
                      />
                    ) : (
                      <input
                        value={editor.values[field.label] || ""}
                        type={field.kind === "number" ? "number" : "text"}
                        onInput={(e) =>
                          updateEditor(field.label, e.currentTarget.value)
                        }
                        onChange={(e) =>
                          updateEditor(field.label, e.target.value)
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
              <div className="md-checks">
                {definition.checks.map((label) => (
                  <label key={label}>
                    <input
                      type="checkbox"
                      checked={editor.values[label] === "true"}
                      onChange={(e) =>
                        setEditor((previous) =>
                          previous
                            ? {
                                ...previous,
                                values: {
                                  ...previous.values,
                                  [label]: String(e.target.checked),
                                },
                              }
                            : previous,
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              {definition.tabs.length > 0 && (
                <>
                  <nav aria-label="Thông tin danh mục">
                    {definition.tabs.map((label) => (
                      <button
                        key={label}
                        className={tab === label ? "active" : ""}
                        onClick={() => setTab(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                  <DirectoryTabContent
                    tab={tab}
                    data={definition.tabData[tab]}
                    values={editor.values}
                    onChange={updateEditor}
                  />
                </>
              )}
            </div>
            {definition.name==="Tài khoản ngân hàng"&&<div style={{padding:"12px 18px",display:"flex",gap:12,alignItems:"center"}}><span>Tự động thêm nhiều tài khoản ngân hàng cùng lúc chỉ trong 15 giây với Ngân hàng điện tử</span><button type="button" onClick={()=>directoryNavigate("/bank/ebanking"+window.location.search)}>Kết nối ngay</button></div>}
            {error && (
              <p role="alert" className="md-error">
                {error}
              </p>
            )}
            <footer>
              <button onClick={() => closeEditor()}>Hủy</button>
              <button onClick={() => save()}>Lưu</button>
              <button className="md-primary" onClick={() => save(true)}>
                Lưu và Thêm
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
