function actionTable(trigger: HTMLElement): HTMLTableElement {
  const boundary = trigger.closest("dialog, [role='dialog'], .misa-modal-card, .misa-purchase-modal-window");
  for (let container = trigger.parentElement; container; container = container.parentElement) {
    const tables = [...container.querySelectorAll<HTMLTableElement>("table")].filter((table) => table.getClientRects().length > 0);
    if (tables.length) return tables[0];
    if (container === boundary) break;
  }
  throw new Error("Không tìm thấy bảng dữ liệu để thực hiện thao tác.");
}

export type SavedTableReport = { id: string; title: string; savedAt: string; period: string; dataset: string; rows: string[][] };
function reportScope() {
  const session = JSON.parse(localStorage.getItem("erp_api_session") || "{}");
  const company = new URLSearchParams(location.search).get("company") || session.companyId || "local";
  const user = session.user?.id || session.user?.username || session.user?.email || "current";
  return `sv_saved_tables_${user}_${company}`;
}

export function savedTableReports(): SavedTableReport[] {
  try {
    const value = JSON.parse(localStorage.getItem(reportScope()) || "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item?.id === "string" && typeof item.title === "string" && Array.isArray(item.rows) && item.rows.every((row: unknown) => Array.isArray(row) && row.every((cell) => typeof cell === "string"))) : [];
  } catch { return []; }
}

export function saveVisibleTable(trigger: HTMLElement, title: string) {
  const table = actionTable(trigger);
  const report: SavedTableReport = {
    id: crypto.randomUUID(), title: reportTitle(trigger, title),
    savedAt: new Date().toISOString(),
    period: new URLSearchParams(location.search).get("period") || "",
    dataset: localStorage.getItem("ref_dataset") || "",
    rows: [...table.rows].map((row) => [...row.cells].map((cell) => cell.innerText.replace(/\s+/g, " ").trim())),
  };
  if (JSON.stringify(report).length > 2000000) throw new Error("Báo cáo quá lớn để lưu trên thiết bị. Hãy xuất Excel để lưu tệp.");
  const reports = [report, ...savedTableReports()].slice(0, 20);
  try { localStorage.setItem(reportScope(), JSON.stringify(reports)); }
  catch { throw new Error("Không đủ dung lượng lưu báo cáo trên thiết bị. Hãy xuất Excel hoặc xóa bớt bản lưu cũ."); }
}

export function removeSavedTable(id: string) {
  localStorage.setItem(reportScope(), JSON.stringify(savedTableReports().filter((item) => item.id !== id)));
}

export function openSavedTableReports() {
  window.dispatchEvent(new Event("sv_open_saved_tables"));
}

function fileName(title: string) {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 100) || "du-lieu";
}

function reportTitle(trigger: HTMLElement, fallback: string) {
  for (let container = trigger.parentElement; container; container = container.parentElement) {
    const heading = [...container.querySelectorAll<HTMLElement>("h1,h2,h3")].find((item) => item.getClientRects().length && item.innerText.trim());
    if (heading) return heading.innerText.trim();
  }
  return fallback;
}

export async function exportVisibleTable(trigger: HTMLElement, title: string) {
  const table = actionTable(trigger);
  title = reportTitle(trigger, title);
  // Keep displayed account codes, dates and formatted amounts intact in the workbook.
  const XLSX = await import("xlsx");
  const book = XLSX.utils.table_to_book(table, { sheet: "Du lieu", raw: true });
  XLSX.writeFile(book, `${fileName(title)}.xlsx`, { compression: true });
}

export async function printVisibleTable(trigger: HTMLElement, title: string) {
  const table = actionTable(trigger);
  title = reportTitle(trigger, title);
  const frame = document.createElement("iframe");
  frame.title = "Bản in báo cáo";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;left:-10000px;top:0";
  document.body.append(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); throw new Error("Không mở được bản in. Vui lòng thử lại."); }
  doc.open();
  doc.write("<!doctype html><html lang='vi'><head><meta charset='utf-8'></head><body></body></html>");
  doc.close();
  doc.title = title;
  const style = doc.createElement("style");
  style.textContent = "@page{size:A4 landscape;margin:12mm}body{font:12px Roboto,Arial,sans-serif;color:#111}h1{font-size:18px;margin:0 0 16px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #bbb;padding:6px;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}button,input,select{display:none!important}a{color:inherit;text-decoration:none}.numeric{text-align:right}";
  doc.head.append(style);
  const heading = doc.createElement("h1");
  heading.textContent = title;
  doc.body.append(heading, table.cloneNode(true));
  const cleanup = () => frame.remove();
  win.addEventListener("afterprint", cleanup, { once: true });
  const timer = setTimeout(cleanup, 60000);
  win.addEventListener("afterprint", () => clearTimeout(timer), { once: true });
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  try { win.focus(); win.print(); } catch { clearTimeout(timer); cleanup(); throw new Error("Không mở được hộp thoại in."); }
}
