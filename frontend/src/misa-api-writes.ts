/**
 * Turns the data the original (MISA-style) forms submit into backend API documents.
 * Kept free of React and browser APIs so the same code runs in the UI and in API tests.
 */
import { parseReportDate } from "./report-date";
export type Row = Record<string, any>;
export type FetchJson = (path: string, init?: { method?: string; body?: string | FormData }) => Promise<any>;

export class FormDataError extends Error {}

/** dd/mm/yyyy (form format) or yyyy-mm-dd → yyyy-mm-dd. */
export function toApiDate(value: unknown, fallback = new Date()) {
  const text = String(value ?? "").trim();
  const vn = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (vn) return `${vn[3]}-${vn[2].padStart(2, "0")}-${vn[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const local = new Date(fallback.getTime() - fallback.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** yyyy-mm-dd → dd/mm/yyyy for the form tables. */
export function toViDate(value: unknown) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value ?? "");
}

export function num(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const LIST_PATHS: Record<string, string> = {
  parties: "/api/v1/master-data/parties/",
  customers: "/api/v1/master-data/customers/",
  items: "/api/v1/master-data/items/",
  units: "/api/v1/master-data/units-of-measure/",
  taxRates: "/api/v1/master-data/tax-rates/",
  warehouses: "/api/v1/master-data/warehouses/",
  currencies: "/api/v1/master-data/currencies/",
  banks: "/api/v1/master-data/banks/",
  branches: "/api/v1/organization/branches/",
  accounts: "/api/v1/general-ledger/accounts/",
  glPeriods: "/api/v1/general-ledger/periods/",
  assetCategories: "/api/v1/fixed-assets/categories/",
  assets: "/api/v1/fixed-assets/assets/",
  goodsPurchases: "/api/v1/purchases/goods-purchases/",
  goodsSales: "/api/v1/sales/goods-sales/",
  salesOrders: "/api/v1/sales/orders/",
  payables: "/api/v1/accounts-payable/payables/",
  receivables: "/api/v1/accounts-receivable/receivables/",
};

export type ApiWriter = ReturnType<typeof createApiWriter>;

export function createApiWriter(companyId: string, fetchJson: FetchJson) {
  const cache = new Map<string, Promise<Row[]>>();
  const scoped = (path: string) => `${path}${path.includes("?") ? "&" : "?"}company_id=${encodeURIComponent(companyId)}`;

  async function listPath(path: string): Promise<Row[]> {
    const rows: Row[] = [];
    let next: string | null = scoped(path);
    for (let page = 0; next && page < 50; page += 1) {
      const data: any = await fetchJson(next);
      if (Array.isArray(data)) return data;
      rows.push(...(data.results || []));
      next = data.next ? new URL(data.next, "http://local").pathname + new URL(data.next, "http://local").search : null;
    }
    return rows;
  }

  function list(name: keyof typeof LIST_PATHS | string): Promise<Row[]> {
    const path = LIST_PATHS[name] || name;
    if (!cache.has(path)) cache.set(path, listPath(path).catch((error) => { cache.delete(path); throw error; }));
    return cache.get(path)!;
  }

  const post = (path: string, body: Row) => fetchJson(scoped(path), { method: "POST", body: JSON.stringify({ company: companyId, ...body }) });
  const patch = (path: string, body: Row) => fetchJson(scoped(path), { method: "PATCH", body: JSON.stringify({ company: companyId, ...body }) });
  const action = (path: string, id: string, name: string, body: Row = {}) =>
    fetchJson(scoped(`${path}${id}/${name}/`), { method: "POST", body: JSON.stringify(body) });
  const upload = (path: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetchJson(scoped(path), { method: "POST", body: form });
  };

  async function byCode(name: string, code: unknown, label: string) {
    const wanted = String(code ?? "").trim();
    if (!wanted) throw new FormDataError(`Chưa chọn ${label}.`);
    const rows = await list(name);
    const found = rows.find((row) => String(row.code).toLowerCase() === wanted.toLowerCase())
      || rows.find((row) => String(row.name).toLowerCase() === wanted.toLowerCase());
    if (!found) throw new FormDataError(`${label[0].toUpperCase()}${label.slice(1)} "${wanted}" chưa có trong danh mục.`);
    return found;
  }

  return {
    companyId,
    list,
    post,
    patch,
    action,
    upload,
    invalidate: () => cache.clear(),
    supplier: (code: unknown) => byCode("parties", code, "nhà cung cấp"),
    customer: (code: unknown) => byCode("customers", code, "khách hàng"),
    item: (code: unknown) => byCode("items", code, "mã hàng"),
    async branch() {
      const rows = await list("branches");
      const found = rows.find((row) => row.is_head_office && row.status === "ACTIVE") || rows.find((row) => row.status === "ACTIVE");
      if (!found) throw new FormDataError("Doanh nghiệp chưa có chi nhánh đang hoạt động.");
      return found;
    },
    async currency(code = "VND") {
      const rows = await list("currencies");
      const found = rows.find((row) => row.code === code);
      if (!found) throw new FormDataError(`Chưa có loại tiền ${code}.`);
      return found;
    },
    /** Exact postable account, otherwise the first postable sub-account (e.g. 156 → 1561). */
    async account(code: unknown, label = "tài khoản") {
      const wanted = String(code ?? "").trim();
      if (!wanted) throw new FormDataError(`Chưa nhập ${label}.`);
      const rows = (await list("accounts")).filter((row) => row.status === "ACTIVE");
      let found: Row | undefined = rows.find((row) => row.code === wanted && row.is_postable)
        || rows.filter((row) => row.is_postable && String(row.code).startsWith(wanted)).sort((a, b) => String(a.code).localeCompare(String(b.code)))[0];
      // Forms may name a detail account the chart does not have (33311 → 3331).
      for (let size = wanted.length - 1; !found && size >= 3; size -= 1) {
        found = rows.find((row) => row.code === wanted.slice(0, size) && row.is_postable);
      }
      if (!found) throw new FormDataError(`Tài khoản ${wanted} chưa có trong hệ thống tài khoản.`);
      return found;
    },
    async warehouse(codeOrName?: unknown) {
      const wanted = String(codeOrName ?? "").trim().toLowerCase();
      const rows = (await list("warehouses")).filter((row) => row.status === "ACTIVE");
      const found = (wanted && rows.find((row) => String(row.code).toLowerCase() === wanted || String(row.name).toLowerCase() === wanted)) || rows[0];
      if (!found) throw new FormDataError("Chưa có kho đang hoạt động. Hãy thêm kho trong Danh mục.");
      return found;
    },
    /** The named warehouse, otherwise the one holding enough available stock of the item. */
    async stockWarehouse(item: Row, quantity: number, codeOrName?: unknown) {
      if (String(codeOrName ?? "").trim()) return this.warehouse(codeOrName);
      const balances = (await list("/api/v1/inventory/balances/")).filter((row) => row.item === item.id);
      const stocked = balances.find((row) => num(row.available_quantity ?? row.quantity) >= quantity)
        || [...balances].sort((a, b) => num(b.quantity) - num(a.quantity))[0];
      return stocked ? (await list("warehouses")).find((row) => row.id === stocked.warehouse) || this.warehouse() : this.warehouse();
    },
    async uom(item: Row, kind: "purchase" | "sales" | "base" = "base") {
      const id = (kind === "purchase" && item.purchase_uom) || (kind === "sales" && item.sales_uom) || item.base_uom;
      if (!id) throw new FormDataError(`Mã hàng ${item.code} chưa khai báo đơn vị tính.`);
      return id as string;
    },
    async taxRate(percent: unknown, scope: "INPUT" | "OUTPUT") {
      const text = String(percent ?? "").replace("%", "").trim();
      if (!text || Number.isNaN(Number(text))) return null;
      const rows = await list("taxRates");
      const found = rows.find((row) => row.status === "ACTIVE" && row.application_form === "PERCENT"
        && [scope, "BOTH"].includes(row.business_scope) && Number(row.rate_percent) === Number(text));
      if (!found) throw new FormDataError(`Thuế suất ${text}% chưa có trong danh mục thuế.`);
      return found.id as string;
    },
    get: (path: string) => fetchJson(scoped(path)) as Promise<any>,
    company: () => fetchJson(scoped(`/api/v1/organization/companies/${companyId}/`)) as Promise<Row>,
    async paymentTerm(scope: "PURCHASE" | "SALE") {
      const rows = (await list("/api/v1/master-data/payment-terms/")).filter((row) => row.status === "ACTIVE" && [scope, "BOTH"].includes(row.scope));
      const found = rows.find((row) => scope === "PURCHASE" ? row.default_purchase : row.default_sale) || rows[0];
      if (!found) throw new FormDataError("Chưa có điều khoản thanh toán. Hãy thêm trong Danh mục.");
      return found;
    },
    async glPeriod(date: string) {
      const found = (await list("glPeriods")).find((row) => row.start_date <= date && date <= row.end_date && row.status === "OPEN");
      if (!found) throw new FormDataError(`Chưa có kỳ kế toán đang mở cho ngày ${date}.`);
      return found;
    },
  };
}

/** Lines the user actually filled in (a code and a positive quantity). */
export function filledLines<T extends Row>(lines: T[] | undefined, codeField = "code", quantityField = "quantity") {
  const rows = (lines || []).filter((line) => String(line[codeField] ?? "").trim() && num(line[quantityField] ?? 1) > 0);
  if (!rows.length) throw new FormDataError("Chứng từ cần ít nhất một dòng có mã hàng và số lượng.");
  return rows;
}

/**
 * Create a document, then walk it through the backend's approval chain.
 * Documents without an approval workflow are approved on submit and can be posted directly.
 */
export async function createAndPost(writer: ApiWriter, path: string, body: Row, steps: string[] = ["submit", "post"]) {
  let record = await writer.post(path, body);
  const done: string[] = [];
  try {
    for (const step of steps) {
      if (step === "post" && !["APPROVED", "CONFIRMED"].includes(record.status)) break;
      record = await writer.action(path, record.id, step, { version: record.version });
      done.push(step);
    }
  } catch (error) {
    return { record, done, warning: errorText(error) };
  }
  return { record, done, warning: "" };
}

export function describeResult(label: string, result: { record: Row; done: string[]; warning: string }) {
  const number = result.record.number || result.record.code || "";
  if (result.warning) return `Đã lưu ${label} ${number} (chưa ghi sổ: ${result.warning})`;
  if (result.done.includes("post")) return `Đã lưu và ghi sổ ${label} ${number}.`;
  if (result.record.status === "PENDING_APPROVAL") return `Đã lưu ${label} ${number}, đang chờ duyệt.`;
  return `Đã lưu ${label} ${number}.`;
}

/* ───────────────────────────── Mua hàng ───────────────────────────── */

const PURCHASES = "/api/v1/purchases/";

function paidNote(option: unknown) {
  // Immediate payment needs a confirmed payment document; the purchase is recorded as payable instead.
  return option === "paid" ? " Thanh toán ngay: hãy lập phiếu chi/ủy nhiệm chi trả NCC sau khi ghi sổ." : "";
}

async function purchaseLines(w: ApiWriter, lines: Row[], warehouseMode: boolean, fields: {
  code: string; debit: (line: Row) => unknown; credit: (line: Row) => unknown; stock?: string; description?: string;
}) {
  const result: Row[] = [];
  let receivingWarehouse: string | null = null;
  for (const [index, line] of filledLines(lines, fields.code).entries()) {
    const item = await w.item(line[fields.code]);
    const warehouse = warehouseMode && item.track_inventory ? await w.warehouse(fields.stock ? line[fields.stock] : "") : null;
    receivingWarehouse = receivingWarehouse || warehouse?.id || null;
    result.push({
      line_no: index + 1,
      item: item.id,
      uom: await w.uom(item, "purchase"),
      quantity: String(num(line.quantity ?? 1)),
      unit_price: String(num(line.unitPrice)),
      description: String(line[fields.description || "name"] || item.name),
      warehouse: warehouse?.id || null,
      tax_rate: num(line.vatRate) > 0 ? await w.taxRate(line.vatRate, "INPUT") : null,
      debit_account: (await w.account(fields.debit(line) || "156", "TK Nợ")).id,
      credit_account: (await w.account(fields.credit(line) || "331", "TK Có")).id,
    });
  }
  return { lines: result, receivingWarehouse };
}

/** "Chứng từ mua hàng" (PurchaseVoucherModal). */
export async function saveGoodsPurchaseLegacy(w: ApiWriter, d: Row) {
  const supplier = await w.supplier(d.supplierCode);
  const warehouseMode = !/không qua kho/i.test(String(d.purchaseType || ""));
  const { lines, receivingWarehouse } = await purchaseLines(w, d.items, warehouseMode, {
    code: "code", stock: "stock",
    debit: (line) => warehouseMode ? line.stockAccount || "156" : line.expenseAccount || line.stockAccount || "156",
    credit: (line) => line.debtAccount || "331",
  });
  const result = await createAndPost(w, `${PURCHASES}goods-purchases/`, {
    branch: (await w.branch()).id,
    supplier: supplier.id,
    document_date: toApiDate(d.docDate),
    posting_date: toApiDate(d.postingDate || d.docDate),
    purchase_type: warehouseMode && receivingWarehouse ? "WAREHOUSE" : "DIRECT",
    payment_type: "UNPAID",
    receiving_warehouse: warehouseMode ? receivingWarehouse : null,
    delivery_person: String(d.deliverer || ""),
    notes: String(d.description || ""),
    lines,
  });
  return { ...result, message: describeResult("chứng từ mua hàng", result) + paidNote(d.paymentOption) };
}

/** "Chứng từ mua dịch vụ" (PurchaseServiceModal). */
export async function saveGoodsPurchase(w: ApiWriter, d: Row) {
  if (/nhập khẩu/i.test(String(d.purchaseType || "")))
    throw new FormDataError("Phiếu nhập khẩu cần xử lý thuế và chi phí nhập khẩu. Vui lòng chọn mua hàng trong nước nhập kho.");
  const documentDate = parseReportDate(String(d.docDate || ""));
  const postingDate = parseReportDate(String(d.postingDate || "").slice(0, 10));
  if (!documentDate || !postingDate) throw new FormDataError("Vui lòng nhập ngày hợp lệ theo định dạng DD/MM/YYYY.");
  const supplier = await w.supplier(d.supplierCode);
  if (d.paymentOption === "paid") throw new FormDataError("Thanh toán ngay cần liên kết chứng từ chi đã xác nhận. Vui lòng chọn Chưa thanh toán để lưu phiếu nhập.");
  if (d.withInvoice && (!String(d.invoiceNumber || "").trim() || !String(d.invoiceSeries || "").trim() || !parseReportDate(String(d.invoiceDate || ""))))
    throw new FormDataError("Vui lòng nhập ký hiệu, số và ngày hóa đơn hợp lệ.");
  const entered = (d.items || []).filter((line: Row) => String(line.code || "").trim());
  if (!entered.length) throw new FormDataError("Vui lòng chọn ít nhất một hàng hóa cần nhập kho.");
  const warehouseMode = !/không qua kho/i.test(String(d.purchaseType || ""));
  const activeWarehouses = warehouseMode ? (await w.list("warehouses")).filter((row) => row.status === "ACTIVE") : [];
  for (const line of entered) {
    if (warehouseMode && !String(line.stock || "").trim()) throw new FormDataError("Vui lòng chọn kho nhập cho hàng hóa.");
    if (warehouseMode && !activeWarehouses.some((row) => String(row.code).toLowerCase() === String(line.stock).trim().toLowerCase()))
      throw new FormDataError(`Kho ${line.stock} không có trong danh mục kho đang hoạt động.`);
    if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0) throw new FormDataError("Số lượng nhập kho phải lớn hơn 0.");
    if (!Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) <= 0) throw new FormDataError("Đơn giá nhập kho phải lớn hơn 0.");
    if (!Number.isFinite(Number(line.vatRate || 0)) || Number(line.vatRate || 0) < 0 || Number(line.vatRate || 0) > 100)
      throw new FormDataError("Thuế suất GTGT phải từ 0% đến 100%.");
    const item = await w.item(line.code);
    if (warehouseMode && !item.track_inventory) throw new FormDataError(`Hàng hóa ${item.code} không theo dõi tồn kho.`);
  }
  const { lines, receivingWarehouse } = await purchaseLines(w, d.items, warehouseMode, {
    code: "code", stock: "stock",
    debit: (line) => warehouseMode ? line.stockAccount || "156" : line.expenseAccount || line.stockAccount || "156",
    credit: (line) => line.debtAccount || "331",
  });
  const dueDate = d.paymentDueDate ? parseReportDate(String(d.paymentDueDate)) : null;
  if (d.paymentDueDate && !dueDate) throw new FormDataError("Hạn thanh toán không hợp lệ.");
  const debtDays = d.debtDays === "" || d.debtDays == null ? null : Number(d.debtDays);
  if (debtDays !== null && (!Number.isInteger(debtDays) || debtDays < 0 || debtDays > 3650))
    throw new FormDataError("Số ngày được nợ phải là số nguyên từ 0 đến 3650.");
  const sourceCount = Number(d.attachedCount || 0);
  if (!Number.isInteger(sourceCount) || sourceCount < 0)
    throw new FormDataError("Số chứng từ gốc phải là số nguyên không âm.");
  const body = {
    branch: (await w.branch()).id, supplier: supplier.id,
    document_date: documentDate, posting_date: postingDate,
    purchase_type: warehouseMode ? "WAREHOUSE" : "DIRECT",
    payment_type: "UNPAID", receiving_warehouse: warehouseMode ? receivingWarehouse : null,
    delivery_person: String(d.deliverer || ""), supplier_address: String(d.address || ""),
    contact_person: String(d.employee || ""), source_document_count: sourceCount,
    debt_days: debtDays,
    payment_due_date: dueDate,
    invoice_details: d.withInvoice ? { received: true, template: String(d.invoiceForm || ""),
      series: String(d.invoiceSeries || ""), number: String(d.invoiceNumber || ""),
      date: parseReportDate(String(d.invoiceDate || "")) } : { received: false },
    notes: String(d.description || ""), lines,
    ...(String(d.voucherCode || "").trim() && d.voucherCode !== "Tự động" ? { number: String(d.voucherCode).trim() } : {}),
  };
  const record = d.recordId
    ? await w.patch(`${PURCHASES}goods-purchases/${d.recordId}/`, { ...body, version: d.version })
    : await w.post(`${PURCHASES}goods-purchases/`, body);
  return { record, message: `Lưu chứng từ mua hàng nhập kho ${record.number} thành công. Trạng thái: Chưa ghi sổ.` };
}

export async function saveServicePurchase(w: ApiWriter, d: Row) {
  const supplier = await w.supplier(d.supplierCode);
  const { lines } = await purchaseLines(w, d.items, false, {
    code: "serviceCode", description: "serviceName",
    debit: (line) => line.expenseAccount || "642",
    credit: (line) => line.debtAccount || "331",
  });
  const result = await createAndPost(w, `${PURCHASES}service-purchases/`, {
    branch: (await w.branch()).id,
    supplier: supplier.id,
    document_date: toApiDate(d.docDate),
    posting_date: toApiDate(d.postDate || d.docDate),
    payment_type: "UNPAID",
    notes: String(d.description || ""),
    lines,
  });
  return { ...result, message: describeResult("chứng từ mua dịch vụ", result) + paidNote(d.paymentOption) };
}

/** "Mua hàng nhiều hóa đơn": one goods purchase per supplier on the lines. */
export async function saveMultiInvoicePurchase(w: ApiWriter, d: Row) {
  const groups = new Map<string, Row[]>();
  for (const line of filledLines(d.items, "itemCode")) {
    const code = String(line.partnerCode || "").trim();
    if (!code) throw new FormDataError(`Dòng hàng ${line.itemCode} chưa chọn nhà cung cấp.`);
    groups.set(code, [...(groups.get(code) || []), line]);
  }
  const messages: string[] = [];
  const records: Row[] = [];
  for (const [supplierCode, items] of groups) {
    const saved = await saveGoodsPurchaseLegacy(w, {
      supplierCode, purchaseType: d.purchaseKind, paymentOption: d.paymentOption,
      docDate: d.docDate, postingDate: d.postDate, description: d.description, deliverer: d.deliverer,
      items: items.map((line) => ({
        code: line.itemCode, name: line.itemName, stock: line.stockCode, stockAccount: line.stockAccount,
        expenseAccount: line.expenseAccount, debtAccount: line.debtAccount, quantity: line.quantity, unitPrice: line.unitPrice,
      })),
    });
    records.push(saved.record);
    messages.push(saved.message);
  }
  return { records, message: messages.join(" ") };
}

/** "Hợp đồng mua" (PurchaseContractModal). */
export async function savePurchaseContract(w: ApiWriter, d: Row) {
  const supplier = await w.supplier(d.supplierCode);
  const start = toApiDate(d.signDate);
  const lines: Row[] = [];
  for (const [index, line] of (d.items || []).filter((row: Row) => String(row.code || "").trim()).entries()) {
    const item = await w.item(line.code);
    lines.push({
      line_no: index + 1, item: item.id, uom: await w.uom(item, "purchase"),
      quantity: String(num(line.reqQty ?? line.quantity ?? 1) || 1), unit_price: String(num(line.unitPrice)),
      tax_rate: await w.taxRate(num(line.vatRate), "INPUT"),
      description: String(line.name || item.name),
    });
  }
  const end = toApiDate(d.deliveryDeadline || d.paymentDeadline || d.signDate);
  const record = await w.post(`${PURCHASES}purchase-contracts/`, {
    branch: (await w.branch()).id, supplier: supplier.id, currency: (await w.currency()).id,
    payment_term: (await w.paymentTerm("PURCHASE")).id,
    title: String(d.summary || `Hợp đồng mua ${d.contractCode || ""}`).trim(),
    document_date: start, signed_date: start, start_date: start, end_date: end < start ? start : end,
    delivery_place: String(d.deliveryAddress || ""), content: String(d.otherTerms || ""), lines,
  });
  return { record, message: `Đã lưu hợp đồng mua ${record.number || ""}.` };
}

/** Latest posted purchase of this supplier that contains every item on the form. */
async function originalPurchase(w: ApiWriter, supplierId: string, itemIds: string[]) {
  const purchases = (await w.list("goodsPurchases"))
    .filter((row) => row.supplier === supplierId && row.status === "POSTED")
    .sort((a, b) => String(b.document_date).localeCompare(String(a.document_date)));
  const found = purchases.find((row) => itemIds.every((id) => (row.lines || []).some((line: Row) => line.item === id)));
  if (!found) throw new FormDataError("Không tìm thấy chứng từ mua đã ghi sổ của nhà cung cấp này chứa các mã hàng trên.");
  return found;
}

/** "Trả lại hàng mua" (PurchaseReturnModal). */
export async function savePurchaseReturn(w: ApiWriter, d: Row) {
  const supplier = await w.supplier(d.supplierCode);
  const rows = filledLines(d.items);
  const items = await Promise.all(rows.map((line) => w.item(line.code)));
  const original = await originalPurchase(w, supplier.id, items.map((item) => item.id));
  const result = await createAndPost(w, `${PURCHASES}purchase-returns/`, {
    original_purchase: original.id,
    document_date: toApiDate(d.docDate),
    posting_date: toApiDate(d.postingDate || d.docDate),
    reason: String(d.reason || "Trả lại hàng mua"),
    recipient: String(d.recipient || ""),
    handling: d.returnOption === "cash" ? "REFUND" : "REDUCE_PAYABLE",
    warehouse: original.receiving_warehouse || null,
    lines: rows.map((line, index) => ({
      line_no: index + 1, quantity: String(num(line.quantity)),
      original_line: original.lines.find((row: Row) => row.item === items[index].id).id,
    })),
  });
  return { ...result, message: describeResult("chứng từ trả lại hàng mua", result) };
}

/** "Giảm giá hàng mua" (PurchaseDiscountModal). */
export async function savePurchaseDiscount(w: ApiWriter, d: Row) {
  if (d.reduceStockValue && d.discountOption === "cash")
    throw new FormDataError("Thu tiền mặt cần phiếu thu liên kết; hiện chỉ hỗ trợ Giảm trừ công nợ khi giảm giá trị tồn kho.");
  const supplier = await w.supplier(d.supplierCode);
  const rows = filledLines(d.items);
  const items = await Promise.all(rows.map((line) => w.item(line.code)));
  if (!d.originalPurchaseId) throw new FormDataError("Vui lòng chọn chứng từ mua hàng nguồn.");
  const original = (await w.list("goodsPurchases")).find((row) => row.id === d.originalPurchaseId);
  if (!original || original.status !== "POSTED" || original.supplier !== supplier.id || original.purchase_type !== "WAREHOUSE")
    throw new FormDataError("Chứng từ mua hàng nguồn không hợp lệ hoặc không thuộc nhà cung cấp đã chọn.");
  const taxRates = await w.list("taxRates");
  const selectedLines = await Promise.all(rows.map(async (line, index) => {
    const source = (original.lines || []).find((row: Row) => row.item === items[index].id);
    if (!source) throw new FormDataError(`Mặt hàng ${line.code} không thuộc chứng từ mua hàng nguồn.`);
    if (num(line.quantity) <= 0 || num(line.unitPrice) < 0 || num(line.amount) <= 0)
      throw new FormDataError(`Dòng ${index + 1}: số lượng và số tiền giảm phải hợp lệ.`);
    if (num(line.quantity) > num(source.quantity))
      throw new FormDataError(`Dòng ${index + 1}: số lượng tính giảm vượt số lượng mua nguồn.`);
    const sourceRate = taxRates.find((rate) => rate.id === source.tax_rate);
    if (num(line.vatRate) !== num(sourceRate?.rate_percent))
      throw new FormDataError(`Dòng ${index + 1}: thuế suất phải khớp chứng từ mua nguồn (${sourceRate?.rate_percent || 0}%).`);
    const debit = line.debtAccount ? await w.account(line.debtAccount, "TK Công nợ") : null;
    const credit = line.stockAccount ? await w.account(line.stockAccount, "TK Kho") : null;
    if (debit && debit.id !== source.credit_account || credit && credit.id !== source.debit_account)
      throw new FormDataError(`Dòng ${index + 1}: tài khoản phải khớp chứng từ mua nguồn.`);
    return { line_no: index + 1, original_line: source.id,
      pre_tax_amount: String(num(line.amount) || num(line.quantity) * num(line.unitPrice)),
      ...(debit ? { debit_account: debit.id } : {}), ...(credit ? { credit_account: credit.id } : {}) };
  }));
  const record = await w.post(`${PURCHASES}purchase-discounts/`, {
    original_purchase: original.id,
    number: String(d.voucherCode || "").trim(),
    document_date: toApiDate(d.docDate),
    posting_date: toApiDate(d.postingDate || d.docDate),
    reason: String(d.description || "Giảm giá hàng mua"),
    method: "AMOUNT",
    handling: d.discountOption === "cash" ? "REFUND" : "REDUCE_PAYABLE",
    reduce_stock_value: Boolean(d.reduceStockValue),
    lines: selectedLines,
  });
  const result = { record, done: [] as string[], warning: "" };
  return { ...result, message: describeResult("chứng từ giảm giá hàng mua", result) };
}

/** Posted purchases of a supplier that still have lines without an input invoice. */
export async function uninvoicedPurchases(w: ApiWriter) {
  const purchases = (await w.list("goodsPurchases")).filter((row) => row.status === "POSTED");
  const suppliers = await w.list("parties");
  const rows: Row[] = [];
  for (const purchase of purchases) {
    const supplier = suppliers.find((party) => party.id === purchase.supplier);
    const eligible: Row[] = await w.list(`${PURCHASES}input-invoices/eligible-purchases/?supplier_id=${purchase.supplier}`);
    const match = eligible.find((row) => row.id === purchase.id);
    if (!match) continue;
    rows.push({
      id: purchase.id, voucherCode: purchase.number, postDate: purchase.posting_date, docDate: purchase.document_date,
      supplierCode: supplier?.code || "", supplierName: supplier?.name || "", description: purchase.notes || "",
      amount: num(match.remaining_amount),
    });
  }
  return rows;
}

/** "Nhận hóa đơn": one input invoice for the chosen purchases of a single supplier. */
export async function saveInputInvoice(w: ApiWriter, d: Row) {
  const purchaseIds: string[] = d.purchaseIds || [];
  if (!purchaseIds.length) throw new FormDataError("Chọn ít nhất một chứng từ mua hàng.");
  for (const field of ["invoiceSeries", "invoiceNumber", "invoiceDate"] as const) {
    if (!String(d[field] || "").trim()) throw new FormDataError("Cần nhập ký hiệu, số và ngày hóa đơn của người bán.");
  }
  const purchases = (await w.list("goodsPurchases")).filter((row) => purchaseIds.includes(row.id));
  const supplierIds = new Set(purchases.map((row) => row.supplier));
  if (supplierIds.size !== 1) throw new FormDataError("Một hóa đơn chỉ được nhận cho các chứng từ của cùng một nhà cung cấp.");
  const supplier = (await w.list("parties")).find((row) => row.id === purchases[0].supplier)!;
  if (!supplier.tax_code) throw new FormDataError(`Nhà cung cấp ${supplier.code} chưa có mã số thuế.`);
  const company = await w.company();
  const items = await w.list("items");
  const lines: Row[] = [];
  const links: Row[] = [];
  for (const purchase of purchases) {
    const available: Row[] = await w.list(`${PURCHASES}input-invoices/available-lines/?purchase_id=${purchase.id}`);
    for (const row of available.filter((line) => num(line.remaining_amount) > 0)) {
      const total = num(row.remaining_amount);
      const rate = num(row.tax_rate_percent);
      const taxable = Math.round(total / (1 + rate / 100));
      const lineNo = lines.length + 1;
      lines.push({
        line_no: lineNo, description: items.find((item) => item.id === row.item)?.name || "Hàng hóa", item: row.item,
        quantity: String(num(row.remaining_quantity)), unit_price: String(num(row.unit_price)), taxable_amount: String(taxable),
        tax_rate_percent: row.tax_rate_percent, tax_amount: String(total - taxable), total_amount: String(total),
      });
      links.push({ invoice_line_no: lineNo, purchase_line: row.purchase_line, amount: String(total), quantity: row.remaining_quantity });
    }
  }
  if (!lines.length) throw new FormDataError("Các chứng từ đã chọn đều đã có hóa đơn.");
  const sum = (field: string) => String(lines.reduce((total, line) => total + num(line[field]), 0));
  const invoice = await w.post(`${PURCHASES}input-invoices/`, {
    branch: purchases[0].branch, supplier: supplier.id, source: "MANUAL", invoice_type: "ORIGINAL",
    invoice_template: String(d.invoiceTemplate || "1"), invoice_series: String(d.invoiceSeries).trim(),
    invoice_number: String(d.invoiceNumber).trim(), invoice_date: toApiDate(d.invoiceDate),
    seller_name: supplier.legal_name || supplier.name, supplier_tax_code: supplier.tax_code,
    seller_address: String(d.sellerAddress || supplier.legal_name || supplier.name),
    buyer_name: company.legal_name || company.name, buyer_tax_code: company.tax_code, buyer_address: company.address || "",
    subtotal: sum("taxable_amount"), tax_amount: sum("tax_amount"), total_amount: sum("total_amount"), lines, links,
  });
  const confirmed = invoice.validation_status === "PENDING_VALIDATION"
    ? await w.action(`${PURCHASES}input-invoices/`, invoice.id, "confirm", { links }) : invoice;
  return { record: confirmed, message: `Đã nhận hóa đơn ${confirmed.invoice_series}-${confirmed.invoice_number} và liên kết ${links.length} dòng chứng từ mua.` };
}

/** "Đối chiếu công nợ nhà cung cấp": snapshot the book balance, then record the reconciliation. */
export async function saveSupplierReconciliation(w: ApiWriter, d: Row) {
  const supplier = await w.supplier(d.supplierCode || String(d.supplier || "").split(" - ")[0]);
  const currency = await w.currency();
  const today = toApiDate("");
  const start = toApiDate(d.fromDate || `01/${today.slice(5, 7)}/${today.slice(0, 4)}`);
  const end = toApiDate(d.toDate || today);
  const query = `supplier=${supplier.id}&currency=${currency.id}&period_start=${start}&period_end=${end}`;
  const preview = await w.get(`/api/v1/accounts-payable/supplier-reconciliations/preview/?${query}`);
  const record = await w.post("/api/v1/accounts-payable/supplier-reconciliations/", {
    supplier: supplier.id, currency: currency.id, period_start: start, period_end: end,
    snapshot_token: preview.snapshot_token,
    content: String(d.content || `Đối chiếu công nợ với ${supplier.name} từ ${start} đến ${end}`),
  });
  return { record, message: `Đã lập biên bản đối chiếu công nợ ${record.number || ""}.` };
}

/* ───────────────────────────── Bán hàng ───────────────────────────── */

const SALES = "/api/v1/sales/";

async function salesLines(w: ApiWriter, lines: Row[], code = "code") {
  const result: Row[] = [];
  for (const [index, line] of filledLines(lines, code).entries()) {
    const item = await w.item(line[code]);
    result.push({
      line_no: index + 1, item: item.id, uom: await w.uom(item, "sales"),
      quantity: String(num(line.quantity ?? 1)), unit_price: String(num(line.unitPrice)),
      description: String(line.name || line.itemName || item.name),
      tax_rate: await w.taxRate(num(line.vatRate), "OUTPUT"),
    });
  }
  return result;
}

/** "Đơn đặt hàng" (SaleOrderModal). */
export async function saveSalesOrder(w: ApiWriter, d: Row) {
  const customer = await w.customer(d.customerCode);
  const lines = await salesLines(w, d.items);
  const items = await w.list("items");
  let warehouse: Row | null = null;
  for (const line of lines) {
    const item = items.find((row) => row.id === line.item);
    if (!item?.track_inventory) continue;
    const chosen = await w.stockWarehouse(item, num(line.quantity), d.warehouse);
    line.warehouse = chosen.id;
    warehouse = warehouse || chosen;
  }
  const result = await createAndPost(w, `${SALES}orders/`, {
    branch: (await w.branch()).id, customer: customer.id, currency: (await w.currency()).id,
    default_warehouse: warehouse?.id || null,
    document_date: toApiDate(d.date), requested_delivery_date: toApiDate(d.deliveryDate || d.date),
    delivery_address: String(d.deliveryAddress || d.address || ""), customer_address: String(d.address || ""),
    contact_name: String(d.receiver || ""), notes: String(d.description || ""),
    lines,
  }, ["submit"]);
  return { ...result, message: describeResult("đơn đặt hàng", result) };
}

/** "Hợp đồng bán" (SaleContractModal). */
export async function saveSalesContract(w: ApiWriter, d: Row) {
  const customer = await w.customer(d.customerCode);
  const start = toApiDate(d.date);
  const endText = toApiDate(d.deliveryDate || d.paymentDueDate || d.date);
  const filled = (d.items || []).map((line: Row) => ({ ...line, quantity: line.reqQty ?? line.quantity }))
    .filter((line: Row) => String(line.code || "").trim() && num(line.quantity ?? 1) > 0);
  const lines = filled.length ? await salesLines(w, filled) : [];
  const record = await w.post(`${SALES}contracts/`, {
    branch: (await w.branch()).id, customer: customer.id, currency: (await w.currency()).id,
    number: String(d.code || ""), contract_number: String(d.code || ""),
    title: String(d.summary || `Hợp đồng bán ${d.code || ""}`).trim(),
    document_date: start, signed_date: start, start_date: start, end_date: endText < start ? start : endText,
    customer_representative: String(d.contact || customer.representative || customer.legal_name || customer.name),
    customer_representative_position: String(d.contactPosition || "Người đại diện"),
    payment_terms_text: String(d.paymentTerms || (d.paymentDueDate ? `Thanh toán trước ngày ${d.paymentDueDate}` : "Thanh toán theo thỏa thuận")),
    company_signer_name: String((await w.company()).legal_representative || ""),
    company_signer_position: "Người đại diện theo pháp luật",
    ...(lines.length
      ? { value_type: "FIXED", lines }
      : { value_type: "LIMIT", contract_limit: String(num(d.amount)), maximum_value: String(num(d.amount)) }),
    delivery_terms: String(d.deliveryAddress || "Giao hàng theo thỏa thuận"), notes: String(d.otherTerms || ""),
  });
  return { record, message: `Đã lưu hợp đồng bán ${record.number || record.contract_number || ""}.` };
}

/** "Chứng từ bán hàng / bán dịch vụ" (SaleVoucherModal). */
export async function saveSalesVoucher(w: ApiWriter, d: Row) {
  const customer = await w.customer(d.customerCode);
  const isService = Boolean(d.isService);
  const lines: Row[] = [];
  let needsWarehouse = false;
  for (const [index, line] of filledLines(d.items).entries()) {
    const item = await w.item(line.code);
    const tracked = !isService && item.track_inventory;
    needsWarehouse = needsWarehouse || tracked;
    lines.push({
      line_no: index + 1, item: item.id, uom: await w.uom(item, "sales"),
      quantity: String(num(line.quantity)), unit_price: String(num(line.unitPrice)),
      description: String(line.name || item.name),
      tax_rate: await w.taxRate(num(line.vatRate), "OUTPUT"),
      warehouse: tracked && d.hasDeliveryNote !== false ? (await w.stockWarehouse(item, num(line.quantity), line.stockCode || line.warehouse)).id : null,
      receivable_or_payment_account: (await w.account(line.debitAccount || "131", "TK Nợ")).id,
      revenue_account: (await w.account(line.creditAccount || (isService ? "5113" : "5111"), "TK doanh thu")).id,
      tax_account: (await w.account(line.vatAccount || "33311", "TK thuế GTGT")).id,
    });
  }
  const collected = d.collectionType === "collected_now";
  const result = await createAndPost(w, `${SALES}${isService ? "service-sales" : "goods-sales"}/`, {
    branch: (await w.branch()).id, customer: customer.id, currency: (await w.currency()).id,
    document_date: toApiDate(d.date), posting_date: toApiDate(d.postingDate || d.date),
    customer_address: String(d.address || ""), customer_tax_code: String(d.taxCode || customer.tax_code || ""),
    payment_type: collected ? (/ngân hàng|chuyển khoản/i.test(String(d.paymentMethod)) ? "BANK" : "CASH") : "UNPAID",
    ...(isService ? {} : { inventory_handling: needsWarehouse ? (d.hasDeliveryNote === false ? "SEPARATE_ISSUE" : "ATTACH_ISSUE") : "NO_INVENTORY" }),
    description: String(d.description || ""), lines,
  });
  return { ...result, message: describeResult(isService ? "chứng từ bán dịch vụ" : "chứng từ bán hàng", result) };
}

/** Latest posted goods sale of the customer that contains every item code on the form. */
async function originalSale(w: ApiWriter, customerId: string, itemIds: string[]) {
  const sales = (await w.list("goodsSales"))
    .filter((row) => row.customer === customerId && row.status === "POSTED")
    .sort((a, b) => String(b.document_date).localeCompare(String(a.document_date)));
  const found = sales.find((row) => itemIds.every((id) => (row.lines || []).some((line: Row) => line.item === id)));
  if (!found) throw new FormDataError("Không tìm thấy chứng từ bán hàng đã ghi sổ của khách hàng này chứa các mã hàng trên.");
  return found;
}

/** "Hàng bán trả lại" (SaleReturnModal). */
export async function saveSalesReturn(w: ApiWriter, d: Row) {
  const customer = await w.customer(d.customerCode);
  const rows = filledLines(d.items, "itemCode");
  const items = await Promise.all(rows.map((line) => w.item(line.itemCode)));
  const sale = await originalSale(w, customer.id, items.map((item) => item.id));
  const result = await createAndPost(w, `${SALES}sales-returns/`, {
    branch: sale.branch, customer: customer.id, goods_sale: sale.id,
    document_date: toApiDate(d.docDate), posting_date: toApiDate(d.postingDate || d.docDate),
    return_reason: String(d.reason || "Khách hàng trả lại hàng"),
    inventory_handling: d.isStockInward === false ? "NO_INVENTORY" : "ATTACH_INWARD",
    lines: rows.map((line, index) => ({
      goods_sale_line: sale.lines.find((row: Row) => row.item === items[index].id).id,
      return_quantity: String(num(line.quantity)),
    })),
  });
  return { ...result, message: describeResult("chứng từ hàng bán trả lại", result) };
}

/** "Giảm giá hàng bán" (SaleDiscountModal). */
export async function saveSalesAllowance(w: ApiWriter, d: Row) {
  const customer = await w.customer(d.customerCode);
  const rows = filledLines(d.items, "itemCode");
  const items = await Promise.all(rows.map((line) => w.item(line.itemCode)));
  const sale = await originalSale(w, customer.id, items.map((item) => item.id));
  const result = await createAndPost(w, `${SALES}sales-allowances/`, {
    branch: sale.branch, customer: customer.id, goods_sale: sale.id,
    document_date: toApiDate(d.docDate), posting_date: toApiDate(d.postingDate || d.docDate),
    allowance_reason: String(d.reason || "Giảm giá hàng bán"),
    lines: rows.map((line, index) => ({
      goods_sale_line: sale.lines.find((row: Row) => row.item === items[index].id).id,
      entry_method: "BY_AMOUNT",
      allowance_amount: String(num(line.amount) || num(line.quantity) * num(line.unitPrice)),
    })),
  });
  return { ...result, message: describeResult("chứng từ giảm giá hàng bán", result) };
}

/** "Hóa đơn bán hàng" (SaleInvoiceModal): invoices a posted sales voucher, or else an approved sales order. */
export async function saveSalesInvoice(w: ApiWriter, d: Row) {
  const customer = await w.customer(d.customerCode);
  const rows = filledLines(d.items, "itemCode");
  const items = await Promise.all(rows.map((line) => w.item(line.itemCode)));
  const newest = (a: Row, b: Row) => String(b.document_date).localeCompare(String(a.document_date));
  const hasItems = (row: Row) => items.every((item) => (row.lines || []).some((line: Row) => line.item === item.id));
  const sale = (await w.list("goodsSales")).sort(newest)
    .find((row) => row.customer === customer.id && row.status === "POSTED" && !row.tax_invoice && hasItems(row));
  const order = sale ? null : (await w.list("salesOrders")).sort(newest)
    .find((row) => row.customer === customer.id && ["APPROVED", "CONFIRMED", "PARTIALLY_DELIVERED", "DELIVERED"].includes(row.status) && hasItems(row));
  const source = sale || order;
  if (!source) throw new FormDataError("Hóa đơn bán phải lập từ chứng từ bán hàng đã ghi sổ hoặc đơn đặt hàng đã duyệt có các mã hàng trên.");
  const record = await w.post(`${SALES}sales-invoices/`, {
    branch: source.branch, customer: customer.id, currency: source.currency,
    ...(sale ? { goods_sale: sale.id } : { sales_order: order!.id }),
    number: String(d.invoiceNo || ""), request_date: toApiDate(d.invoiceDate), invoice_date: toApiDate(d.invoiceDate),
    invoice_series: String(d.invoiceSeries || ""), template_code: String(d.invoiceTemplate || ""),
    buyer_name: String(d.buyerName || d.customerName || customer.name), buyer_tax_code: String(d.taxCode || customer.tax_code || ""),
    buyer_address: String(d.address || ""),
    lines: await Promise.all(rows.map(async (line, index) => {
      const sourceLine = source.lines.find((row: Row) => row.item === items[index].id);
      return {
        [sale ? "goods_sale_line" : "order_line"]: sourceLine.id, item: items[index].id,
        description: String(line.itemName || items[index].name),
        quantity: String(num(line.quantity)), unit_price: String(num(line.unitPrice) || num(sourceLine.unit_price)),
        tax_rate: await w.taxRate(num(line.vatRate), "OUTPUT"),
      };
    })),
  });
  return { record, message: `Đã lập hóa đơn bán hàng ${record.number || ""} từ ${source.number}.` };
}

/** "Hóa đơn thương mại" (xuất khẩu). */
export async function saveCommercialInvoice(w: ApiWriter, d: Row) {
  const customer = await w.customer(d.customerCode);
  const lines: Row[] = [];
  for (const [index, line] of filledLines(d.items, "itemCode").entries()) {
    const item = await w.item(line.itemCode);
    lines.push({
      line_no: index + 1, item: item.id, description: String(line.itemName || item.name), uom: await w.uom(item, "sales"),
      quantity: String(num(line.quantity)), unit_price: String(num(line.unitPrice)),
    });
  }
  const record = await w.post(`${SALES}commercial-invoices/`, {
    branch: (await w.branch()).id, customer: customer.id, currency: (await w.currency(d.currency || "VND")).id,
    buyer_name: String(d.buyerName || d.customerName || customer.name), buyer_address: String(d.address || customer.name),
    buyer_country: String(d.country || "VN"), buyer_tax_code: String(d.taxCode || customer.tax_code || ""),
    invoice_series: String(d.invoiceSeries || ""), invoice_date: toApiDate(d.invoiceDate),
    payment_terms: String(d.paymentMethod || "TT"), incoterms_term: String(d.incoterms || "EXW"), incoterms_version: "2020", lines,
  });
  return { record, message: `Đã lưu hóa đơn thương mại ${record.number || record.invoice_number || ""}.` };
}

/* ───────────────────────────── Kho ───────────────────────────── */

const INVENTORY_TYPES = { receipt: "RECEIPT", issue: "ISSUE", transfer: "TRANSFER" } as const;

/** The form's voucher number when still free, otherwise the next one in the prefix series (NK00001 → NK00002). */
export async function nextVoucherNumber(w: ApiWriter, path: string, prefix: string, preferred?: unknown) {
  const used = new Set((await w.list(path)).map((row) => String(row.number || "")));
  const wanted = String(preferred ?? "").trim();
  if (wanted && !used.has(wanted)) return wanted;
  const highest = [...used].filter((number) => number.startsWith(prefix))
    .reduce((max, number) => Math.max(max, Number(number.slice(prefix.length).replace(/\D/g, "")) || 0), 0);
  return `${prefix}${String(highest + 1).padStart(5, "0")}`;
}

/** "Phiếu nhập kho / xuất kho / chuyển kho" (MisaInventoryWorkspace forms). */
export async function saveOtherInventoryReceipt(w: ApiWriter, d: Row) {
  const number = String(d.code || "").trim();
  if (!number) throw new FormDataError("Vui lòng nhập số chứng từ.");
  const documentDate = parseReportDate(String(d.date || ""));
  const postingDate = parseReportDate(String(d.postingDate || "").slice(0, 10));
  if (!documentDate) throw new FormDataError("Vui lòng chọn ngày chứng từ hợp lệ.");
  if (!postingDate) throw new FormDataError("Vui lòng chọn ngày hạch toán hợp lệ.");
  const rows: Row[] = d.lines || [];
  if (!rows.length || rows.every((row) => !String(row.itemCode || "").trim()))
    throw new FormDataError("Vui lòng thêm ít nhất một vật tư/hàng hóa.");
  const warehouses = await w.list("warehouses");
  const warehouseName = String(rows[0]?.warehouse || "").trim();
  const warehouse = warehouses.find((row) => row.name === warehouseName || row.code === warehouseName);
  if (!warehouse) throw new FormDataError("Vui lòng chọn kho nhập hợp lệ.");
  if (warehouse.status !== "ACTIVE" || !warehouse.allow_receipt) throw new FormDataError("Kho nhập không còn hoạt động hoặc không cho phép nhập.");
  if (rows.some((row) => String(row.warehouse || "").trim() !== warehouseName))
    throw new FormDataError("Các dòng hàng phải cùng một kho nhập.");
  const items = await w.list("items");
  const units = await w.list("units");
  const accounts = await w.list("accounts");
  const lines: Row[] = [];
  for (const [index, row] of rows.entries()) {
    const item = items.find((value) => value.code === String(row.itemCode || "").trim());
    if (!item || item.status !== "ACTIVE" || !item.track_inventory) throw new FormDataError(`Dòng ${index + 1}: vật tư/hàng hóa không hợp lệ để nhập kho.`);
    const uom = units.find((value) => value.name === row.unit || value.code === row.unit || value.symbol === row.unit);
    if (!uom) throw new FormDataError(`Dòng ${index + 1}: đơn vị tính không hợp lệ.`);
    const quantity = Number(row.qty);
    const unitCost = Number(row.price);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new FormDataError(`Dòng ${index + 1}: số lượng nhập phải lớn hơn 0.`);
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new FormDataError(`Dòng ${index + 1}: đơn giá nhập không được nhỏ hơn 0.`);
    const account = (code: unknown) => accounts.find((value) => value.code === String(code || "").trim() && value.status === "ACTIVE" && value.is_postable);
    const debit = row.debitAcc ? account(row.debitAcc) : null;
    const credit = row.creditAcc ? account(row.creditAcc) : null;
    if (row.debitAcc && !debit || row.creditAcc && !credit) throw new FormDataError(`Dòng ${index + 1}: tài khoản hạch toán không hợp lệ.`);
    lines.push({ line_no: index + 1, item: item.id, uom: uom.id, quantity: String(quantity), unit_cost: String(unitCost), debit_account: debit?.id || null, credit_account: credit?.id || null });
  }
  const parties = await w.list("parties");
  const party = d.partnerCode ? parties.find((row) => row.code === String(d.partnerCode).trim()) : null;
  if (d.partnerCode && !party) throw new FormDataError("Đối tượng không có trong danh mục.");
  const path = "/api/v1/inventory/transactions/";
  const payload = { number, transaction_type: "RECEIPT", source_module: "INV_OTHER", document_date: documentDate,
    transaction_date: postingDate, delivery_person: String(d.deliveryPerson || ""), reason: String(d.description || ""),
    destination_warehouse: warehouse.id, supplier: party?.id || null, branch: (await w.branch()).id, lines };
  const record = d.id ? await w.patch(`${path}${d.id}/`, payload) : await w.post(path, payload);
  return { record, message: `Đã lưu nháp phiếu nhập kho khác ${record.number}.` };
}

/** Form messages of UC-INV-03 (sale issue) and UC-INV-04 (other issue). */
const ISSUE_FORM_MESSAGES = {
  sale: {
    number: "Vui lòng nhập số phiếu xuất.", documentDate: "Vui lòng chọn ngày chứng từ.", postingDate: "Vui lòng chọn ngày hạch toán.",
    noLines: "Vui lòng chọn ít nhất một vật tư/hàng hóa để xuất kho.", item: "vật tư/hàng hóa không hợp lệ để xuất kho.",
    warehouse: "vui lòng chọn kho xuất.", quantity: "số lượng xuất phải lớn hơn 0.",
    account: "tài khoản hạch toán không hợp lệ. Vui lòng kiểm tra lại.",
  },
  other: {
    number: "Vui lòng nhập số chứng từ.", documentDate: "Vui lòng nhập ngày hợp lệ theo định dạng DD/MM/YYYY.",
    postingDate: "Vui lòng nhập ngày hợp lệ theo định dạng DD/MM/YYYY.",
    noLines: "Vui lòng chọn ít nhất một hàng hóa cần xuất kho.", item: "vui lòng chọn mã hàng hợp lệ.",
    warehouse: "vui lòng chọn kho xuất cho hàng hóa.", quantity: "số lượng xuất kho phải lớn hơn 0.",
    account: "vui lòng chọn tài khoản hạch toán hợp lệ.",
  },
};

/**
 * "Phiếu xuất kho" for sales (UC-INV-03) and other issues (UC-INV-04). Saving keeps the voucher "Chưa ghi sổ";
 * posting goes through submit-and-post, so a failed posting leaves an editable draft. New attachment files
 * (`d.files`) are uploaded after the voucher is saved and before it is posted.
 */
export async function saveOtherInventoryIssue(w: ApiWriter, d: Row, post = false) {
  const path = "/api/v1/inventory/transactions/";
  const text = d.saleMode ? ISSUE_FORM_MESSAGES.sale : ISSUE_FORM_MESSAGES.other;
  if (d.id && d.status === "PENDING_APPROVAL") throw new FormDataError("Phiếu xuất kho đang chờ duyệt, chưa thể ghi sổ.");
  if (d.id && d.status === "POSTED") throw new FormDataError("Phiếu xuất kho đã được ghi sổ.");
  if (d.id && ["CANCELLED", "REVERSED"].includes(d.status)) throw new FormDataError("Phiếu xuất kho đã bị hủy, không thể lưu hoặc ghi sổ.");
  let record: Row;
  if (d.id && d.status === "APPROVED") {
    // Already approved: nothing left to edit, only the posting step remains.
    record = { id: d.id, number: d.code, status: d.status };
  } else {
    const number = String(d.code || "").trim();
    if (!number) throw new FormDataError(text.number);
    const documentDate = parseReportDate(String(d.date || ""));
    if (!documentDate) throw new FormDataError(text.documentDate);
    const postingDate = parseReportDate(String(d.postingDate || "").slice(0, 10));
    if (!postingDate) throw new FormDataError(text.postingDate);
    const reason = String(d.description || "").trim();
    if (!reason) throw new FormDataError("Vui lòng nhập lý do xuất kho.");
    if (d.saleMode && !d.saleId) throw new FormDataError("Vui lòng chọn chứng từ bán hàng tham chiếu.");
    const rows: Row[] = d.lines || [];
    if (!rows.length || rows.every((row) => !String(row.itemCode || "").trim())) throw new FormDataError(text.noLines);
    const [warehouses, items, units, accounts, parties] = await Promise.all([
      w.list("warehouses"), w.list("items"), w.list("units"), w.list("accounts"), w.list("parties"),
    ]);
    const account = (code: unknown) => accounts.find((entry) => entry.code === String(code || "").trim() && entry.status === "ACTIVE" && entry.is_postable);
    const lines: Row[] = rows.map((row, index) => {
      const item = items.find((entry) => entry.code === String(row.itemCode || "").trim() && entry.status === "ACTIVE" && entry.track_inventory);
      if (!item) throw new FormDataError(`Dòng ${index + 1}: ${text.item}`);
      if (!String(row.warehouse || "").trim()) throw new FormDataError(`Dòng ${index + 1}: ${text.warehouse}`);
      const warehouse = warehouses.find((entry) => (entry.name === row.warehouse || entry.code === row.warehouse) && entry.status === "ACTIVE" && entry.allow_issue);
      if (!warehouse) throw new FormDataError(`Dòng ${index + 1}: kho xuất không hợp lệ. Vui lòng chọn kho khác.`);
      const uom = units.find((entry) => entry.name === row.unit || entry.code === row.unit || entry.symbol === row.unit);
      if (!uom) throw new FormDataError(`Dòng ${index + 1}: đơn vị tính không hợp lệ.`);
      const quantity = Number(row.qty); const unitCost = Number(row.price);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new FormDataError(`Dòng ${index + 1}: ${text.quantity}`);
      if (d.saleId && row.remaining !== undefined && quantity > Number(row.remaining))
        throw new FormDataError(`Dòng ${index + 1}: số lượng xuất vượt số lượng còn lại của chứng từ bán hàng.`);
      if (!Number.isFinite(unitCost) || unitCost < 0) throw new FormDataError(`Dòng ${index + 1}: đơn giá xuất kho không hợp lệ.`);
      const debit = account(row.debitAcc); const credit = account(row.creditAcc);
      if (!debit || !credit || debit.id === credit.id) throw new FormDataError(`Dòng ${index + 1}: ${text.account}`);
      if (d.saleId && !row.saleLineId) throw new FormDataError(`Dòng ${index + 1}: hàng hóa phải được chọn từ chứng từ bán hàng.`);
      return { line_no: index + 1, item: item.id, source_warehouse: warehouse.id, uom: uom.id,
        quantity: String(quantity), unit_cost: String(unitCost), debit_account: debit.id, credit_account: credit.id,
        ...(d.saleId && { sale_line: row.saleLineId }) };
    });
    const party = d.partnerCode ? parties.find((entry) => entry.code === String(d.partnerCode).trim()) : null;
    if (d.partnerCode && !party) throw new FormDataError("Đối tượng không có trong danh mục.");
    const payload = { number, transaction_type: "ISSUE", source_module: d.saleId ? "INV_SALE_ISSUE" : "INV_OTHER_ISSUE",
      source_warehouse: lines[0].source_warehouse, branch: (await w.branch()).id,
      document_date: documentDate, transaction_date: postingDate, reason,
      delivery_person: String(d.deliveryPerson || ""), supplier: party?.id || null,
      source_reference: String(d.saleId || d.reference || "").slice(0, 100),
      document_metadata: { partner_name: String(d.partnerName || ""), partner_address: String(d.partnerAddress || ""),
        attached_documents: String(d.attachedDocuments || "") }, lines };
    try {
      record = d.id ? await w.patch(`${path}${d.id}/`, payload) : await w.post(path, payload);
    } catch (error) {
      throw new FormDataError(`Không thể lưu phiếu xuất kho. ${errorText(error)}`);
    }
  }
  const files: File[] = d.files || [];
  let uploaded = 0;
  for (const file of files) {
    try {
      record = await w.upload(`${path}${record.id}/attachments/`, file);
      uploaded += 1;
    } catch (error) {
      return { record, posted: false, uploaded,
        message: `Đã lưu phiếu xuất kho ${record.number} (Chưa ghi sổ) nhưng chưa tải được tệp ${file.name}: ${errorText(error)}` };
    }
  }
  if (!post) return { record, posted: false, uploaded, message: `Lưu phiếu xuất kho thành công: ${record.number} (Chưa ghi sổ).` };
  try {
    const result = await w.action(path, record.id, "submit-and-post");
    if (result.status !== "POSTED") {
      return { record: result, posted: false, uploaded, message: `Đã lưu Phiếu xuất kho ${result.number}, đang chờ duyệt trước khi ghi sổ.` };
    }
    const warning = (result.warnings || []).length ? ` Lưu ý: ${result.warnings.join(" ")}` : "";
    return { record: result, posted: true, uploaded, message: d.saleMode
      ? `Ghi sổ thành công phiếu xuất kho ${result.number}.${warning}`
      : `Đã lưu và ghi sổ Phiếu xuất kho ${result.number} thành công!${warning}` };
  } catch (error) {
    return { record, posted: false, uploaded,
      message: `${d.saleMode ? "Ghi sổ không thành công" : "Không thể ghi sổ phiếu xuất kho"}: ${errorText(error)} Phiếu ${record.number} vẫn ở trạng thái Chưa ghi sổ.` };
  }
}

export async function saveInventoryTransaction(w: ApiWriter, kind: keyof typeof INVENTORY_TYPES, d: Row) {
  const rows = filledLines(d.lines, "itemCode", "qty");
  const first = rows[0];
  const source = kind === "receipt" ? null : await w.warehouse(kind === "transfer" ? first.sourceWarehouse : first.warehouse);
  const destination = kind === "issue" ? null : await w.warehouse(kind === "transfer" ? first.destWarehouse : first.warehouse);
  if (kind === "transfer" && source?.id === destination?.id) throw new FormDataError("Kho xuất và kho nhập phải khác nhau.");
  const lines: Row[] = [];
  for (const [index, line] of rows.entries()) {
    const item = await w.item(line.itemCode);
    lines.push({
      line_no: index + 1, item: item.id, uom: await w.uom(item), quantity: String(num(line.qty)),
      unit_cost: String(num(line.price)), notes: String(line.itemName || ""),
    });
  }
  const partner = d.partnerCode ? (await w.list("parties")).find((row) => row.code === d.partnerCode) : null;
  const result = await createAndPost(w, "/api/v1/inventory/transactions/", {
    branch: (await w.branch()).id,
    number: await nextVoucherNumber(w, "/api/v1/inventory/transactions/", { receipt: "NK", issue: "XK", transfer: "CK" }[kind], d.code),
    transaction_type: INVENTORY_TYPES[kind],
    transaction_date: toApiDate(d.date), reason: String(d.description || ""),
    source_warehouse: source?.id || null, destination_warehouse: destination?.id || null,
    supplier: kind === "receipt" ? partner?.id || null : null, lines,
  });
  const label = { receipt: "phiếu nhập kho", issue: "phiếu xuất kho", transfer: "phiếu chuyển kho" }[kind];
  return { ...result, message: describeResult(label, result) };
}

/** "Lệnh sản xuất": finished goods (with quantity) and the materials they consume. */
export async function saveProductionOrder(w: ApiWriter, d: Row) {
  const products = (d.products || []).filter((row: Row) => String(row.productCode || "").trim());
  if (!products.length) throw new FormDataError("Lệnh sản xuất cần ít nhất một thành phẩm có mã.");
  const materials = (d.materials || []).filter((row: Row) => String(row.materialCode || "").trim());
  const path = "/api/v1/inventory/production-orders/";
  const status = /hoàn thành/i.test(String(d.status)) ? "COMPLETED" : /chưa/i.test(String(d.status)) ? "PLANNED" : /hủy/i.test(String(d.status)) ? "CANCELLED" : "IN_PROGRESS";
  const record = await w.post(path, {
    number: await nextVoucherNumber(w, path, "LSX", d.code), document_date: toApiDate(d.date), description: String(d.description || ""), status,
    products: await Promise.all(products.map(async (row: Row) => {
      if (num(row.qty) <= 0) throw new FormDataError(`Nhập số lượng cho thành phẩm ${row.productCode}.`);
      return { item: (await w.item(row.productCode)).id, quantity: String(num(row.qty)), note: String(row.salesOrder || row.costObject || "") };
    })),
    materials: await Promise.all(materials.map(async (row: Row) => ({
      item: (await w.item(row.materialCode)).id, quantity: num(row.qty) ? String(num(row.qty)) : null,
    }))),
  });
  return { record, message: `Đã lưu lệnh sản xuất ${record.number}.` };
}

/* ───────────────────────────── Tài sản cố định ───────────────────────────── */

const FIXED_ASSETS = "/api/v1/fixed-assets/";

async function assetCategory(w: ApiWriter, name: unknown, accounts: { cost: unknown; depreciation: unknown; expense: unknown }) {
  const wanted = String(name || "").trim() || "Tài sản cố định khác";
  const rows = await w.list("assetCategories");
  const found = rows.find((row) => [row.code, row.name].some((value) => String(value).toLowerCase() === wanted.toLowerCase()));
  if (found) return found;
  return w.post(`${FIXED_ASSETS}categories/`, {
    code: unitCode(wanted).slice(0, 20), name: wanted, asset_type: "FIXED_ASSET", default_method: "STRAIGHT_LINE",
    asset_account: (await w.account(accounts.cost || "211", "TK nguyên giá")).id,
    accumulated_account: (await w.account(accounts.depreciation || "214", "TK hao mòn")).id,
    expense_account: (await w.account(accounts.expense || "642", "TK chi phí khấu hao")).id,
  });
}

/** "Ghi tăng TSCĐ" (acquire = true) and "Khai báo TSCĐ đầu kỳ" (acquire = false). */
export async function saveFixedAsset(w: ApiWriter, d: Row, acquire: boolean) {
  if (!String(d.name || "").trim()) throw new FormDataError("Vui lòng nhập Tên tài sản cố định!");
  const cost = num(d.originalCost);
  if (cost <= 0) throw new FormDataError("Nguyên giá phải lớn hơn 0.");
  const category = await assetCategory(w, d.category, { cost: d.costAccount, depreciation: d.deprAccount, expense: d.expenseAccount });
  const date = toApiDate(d.startDate);
  const assets = await w.list("assets");
  const code = String(d.code || "").trim() || `TSCD${String(assets.length + 1).padStart(5, "0")}`;
  if (assets.some((row) => row.code === code)) throw new FormDataError(`Mã tài sản ${code} đã tồn tại.`);
  const asset = await w.post(`${FIXED_ASSETS}assets/`, {
    code, name: String(d.name).trim(), asset_type: "FIXED_ASSET", category: category.id, branch: (await w.branch()).id,
    acquisition_date: date, in_service_date: date, original_cost: String(cost), method: "STRAIGHT_LINE",
    useful_life_periods: Math.round((num(d.years) || 5) * 12), source_module: acquire ? "FA" : "OPENING",
  });
  if (!acquire) {
    const note = num(d.depreciatedAmount) > 0 ? " Hao mòn lũy kế đầu kỳ cần nhập qua số dư đầu kỳ tài khoản 214." : "";
    return { record: asset, message: `Đã khai báo TSCĐ ${code} - ${asset.name}.${note}` };
  }
  const result = await createAndPost(w, `${FIXED_ASSETS}transactions/`, {
    number: await nextVoucherNumber(w, `${FIXED_ASSETS}transactions/`, "GTTS", d.voucherNo),
    transaction_type: "ACQUISITION", transaction_date: date, asset: asset.id, amount: String(cost),
    reason: `Ghi tăng ${code} - ${asset.name}`,
  });
  return { ...result, message: describeResult(`chứng từ ghi tăng ${code}`, result) };
}

/** Store a CCDC record and its acquisition transaction using the existing fixed-assets API. */
export async function saveToolAsset(w: ApiWriter, d: Row) {
  const code = String(d.code || "").trim();
  const name = String(d.name || "").trim();
  const cost = num(d.originalCost);
  const quantity = num(d.quantity) || 1;
  const periods = Math.round(num(d.allocationMonths) || 1);
  if (!code || !name) throw new FormDataError("Nhập mã và tên công cụ dụng cụ.");
  if (!(cost > 0) || !(quantity > 0) || !(periods > 0)) throw new FormDataError("Nguyên giá, số lượng và số kỳ phân bổ phải lớn hơn 0.");
  if ((await w.list("assets")).some((row) => row.code === code)) throw new FormDataError(`Mã CCDC ${code} đã tồn tại.`);
  const categories = await w.list("assetCategories");
  const categoryName = String(d.category || "Công cụ dụng cụ").trim();
  let category = categories.find((row) => row.asset_type === "TOOL" && (row.name === categoryName || row.code === categoryName));
  if (!category) {
    const baseCode = `CCDC-${unitCode(categoryName).slice(0, 35)}`;
    category = await w.post(`${FIXED_ASSETS}categories/`, {
      code: categories.some((row) => row.code === baseCode) ? `${baseCode}-${categories.length + 1}` : baseCode,
      name: categoryName, asset_type: "TOOL", default_method: "STRAIGHT_LINE", default_periods: periods,
    });
  }
  if (!category) throw new FormDataError("Không tạo được nhóm CCDC.");
  const date = toApiDate(d.startDate);
  const asset = await w.post(`${FIXED_ASSETS}assets/`, {
    code, name, asset_type: "TOOL", category: category.id, branch: (await w.branch()).id,
    quantity: String(quantity), acquisition_date: date, in_service_date: date,
    original_cost: String(cost), method: "STRAIGHT_LINE", useful_life_periods: periods,
    source_module: "TOOL", description: String(d.reason || ""),
  });
  let result;
  try {
    result = await createAndPost(w, `${FIXED_ASSETS}transactions/`, {
      number: await nextVoucherNumber(w, `${FIXED_ASSETS}transactions/`, "GTCC", d.voucherNo),
      transaction_type: "ACQUISITION", transaction_date: date, asset: asset.id,
      amount: String(cost), reason: String(d.reason || `Ghi tăng ${code}`),
    });
  } catch (error) {
    throw new FormDataError(`Đã tạo hồ sơ CCDC ${code}, nhưng chưa tạo được chứng từ ghi tăng: ${errorText(error)}`);
  }
  return { record: result.record, message: `Đã lưu CCDC ${code}. ${describeResult("chứng từ ghi tăng", result)}` };
}

/** "Tính khấu hao TSCĐ" for a month: opens the FA period if needed, calculates, then posts. */
export async function saveDepreciation(w: ApiWriter, d: Row, calculationType: "DEPRECIATION" | "ALLOCATION" = "DEPRECIATION") {
  const year = Number(d.year);
  const month = Number(d.month);
  if (!year || !month) throw new FormDataError("Chọn kỳ tính khấu hao.");
  const code = `${year}-${String(month).padStart(2, "0")}`;
  const start = `${code}-01`;
  const end = `${code}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  const periods = await w.list(`${FIXED_ASSETS}periods/`);
  if (!periods.some((row) => row.code === code)) {
    await w.post(`${FIXED_ASSETS}periods/`, { code, start_date: start, end_date: end, status: "OPEN" });
  }
  const path = `${FIXED_ASSETS}calculations/`;
  let record = await w.post(path, {
    number: await nextVoucherNumber(w, path, calculationType === "ALLOCATION" ? "PBCC" : "KH", d.voucherNo), calculation_type: calculationType,
    period_code: code, period_start: start, period_end: end,
  });
  record = await w.action(path, record.id, "calculate", { version: record.version });
  try {
    record = await w.action(path, record.id, "post", { version: record.version });
  } catch (error) {
    return { record, message: `Đã tính ${calculationType === "ALLOCATION" ? "phân bổ CCDC" : "khấu hao"} kỳ ${code} (${record.number}), chưa ghi sổ: ${errorText(error)}` };
  }
  return { record, message: `Đã tính và ghi sổ ${calculationType === "ALLOCATION" ? "phân bổ CCDC" : "khấu hao"} kỳ ${code} (${record.number}).` };
}

/** Đánh giá lại / Điều chuyển / Ghi giảm TSCĐ: one asset transaction per filled row. */
export async function saveAssetMovement(w: ApiWriter, kind: "revaluation" | "transfer" | "disposal" | "lifeChange", d: Row) {
  const rows = (d.rows || []).filter((row: Row) => String(row.assetCode || "").trim());
  if (!rows.length) throw new FormDataError("Chọn ít nhất một tài sản.");
  const assets = await w.list("assets");
  const departments = kind === "transfer" ? await w.list("/api/v1/organization/departments/") : [];
  const path = `${FIXED_ASSETS}transactions/`;
  const prefix = { revaluation: "ĐGL", transfer: "ĐCTS", disposal: "GGTS", lifeChange: "ĐCKY" }[kind];
  const messages: string[] = [];
  for (const [index, row] of rows.entries()) {
    const asset = assets.find((item) => item.code === String(row.assetCode).trim());
    if (!asset) throw new FormDataError(`Tài sản ${row.assetCode} chưa có trên hệ thống.`);
    const body: Row = {
      number: await nextVoucherNumber(w, path, prefix, index === 0 ? d.voucherNo : ""),
      transaction_date: toApiDate(d.date), asset: asset.id, reason: String(d.reason || ""),
    };
    // Part of the tracked quantity: the backend splits that part off before moving or disposing of it.
    const requested = row.requestedQty === undefined || row.requestedQty === "" ? null : num(row.requestedQty);
    if (requested !== null && (kind === "transfer" || kind === "disposal")) {
      if (requested <= 0 || requested > num(asset.quantity)) {
        throw new FormDataError(`Số lượng của ${asset.code} phải lớn hơn 0 và không vượt ${num(asset.quantity)}.`);
      }
      if (requested < num(asset.quantity)) body.quantity = String(requested);
    }
    if (kind === "lifeChange") {
      const periods = Math.round(num(row.newPeriods) || num(asset.useful_life_periods) + num(row.periodDiff));
      if (periods <= num(asset.periods_processed)) throw new FormDataError(`Số kỳ mới của ${asset.code} phải lớn hơn số kỳ đã phân bổ (${num(asset.periods_processed)}).`);
      Object.assign(body, { transaction_type: "LIFE_CHANGE", target_useful_life_periods: periods });
    } else if (kind === "revaluation") {
      const diff = num(row.origDiff) || num(row.origAfter) - num(row.origBefore);
      if (!diff) throw new FormDataError(`Tài sản ${asset.code}: nhập nguyên giá sau đánh giá khác nguyên giá hiện tại.`);
      Object.assign(body, { transaction_type: diff > 0 ? "VALUE_INCREASE" : "VALUE_DECREASE", amount: String(Math.abs(diff)) });
    } else if (kind === "transfer") {
      const target = departments.find((dept) => [dept.code, dept.name].includes(String(row.toDept || "").trim()));
      if (!target) throw new FormDataError(`Phòng ban nhận "${row.toDept || ""}" chưa có trong cơ cấu tổ chức.`);
      Object.assign(body, { transaction_type: "TRANSFER", target_department: target.id });
    } else {
      // The backend only accepts the book value at the time of disposal; a partial one computes its own share.
      Object.assign(body, { transaction_type: "DISPOSAL", amount: body.quantity ? "0" : String(num(asset.remaining_value)) });
    }
    const result = await createAndPost(w, path, body);
    messages.push(describeResult(`chứng từ ${asset.code}`, result));
  }
  return { message: messages.join(" ") };
}

/** "Kiểm kê TSCĐ / CCDC": records book vs counted quantity per asset. */
export async function saveAssetCount(w: ApiWriter, assetType: "FIXED_ASSET" | "TOOL", d: Row) {
  const assets = (await w.list("assets")).filter((row) => row.asset_type === assetType);
  const rows = (d.rows || []).filter((row: Row) => String(row.assetCode || row.code || "").trim());
  if (!rows.length) throw new FormDataError("Chọn ít nhất một tài sản để kiểm kê.");
  const path = `${FIXED_ASSETS}counts/`;
  const lines = rows.map((row: Row) => {
    const code = String(row.assetCode || row.code).trim();
    const asset = assets.find((item) => item.code === code);
    if (!asset) throw new FormDataError(`${assetType === "TOOL" ? "CCDC" : "TSCĐ"} ${code} chưa có trên hệ thống.`);
    const actual = row.actualQty !== undefined ? num(row.actualQty) : row.exists === false ? 0 : num(asset.quantity);
    return {
      asset: asset.id, actual_quantity: String(actual), condition: String(row.currentQuality || ""),
      recommendation: String(row.recommendation || row.solution || ""), note: String(row.note || ""),
    };
  });
  const record = await w.post(path, {
    asset_type: assetType, number: await nextVoucherNumber(w, path, assetType === "TOOL" ? "BBKK" : "KKTS", d.number),
    count_date: toApiDate(d.date), purpose: String(d.purpose || ""), conclusion: String(d.conclusion || ""), lines,
  });
  return { record, message: `Đã lưu biên bản kiểm kê ${record.number} (${lines.length} tài sản).` };
}

/* ───────────────────────── Tiền mặt / Ngân hàng ───────────────────────── */

/**
 * "Ghi sổ" on a cash or bank voucher: walk it through submit → approve → confirm (cash) / post (bank).
 * Stops where the backend requires another person (e.g. the cashier must not be the preparer).
 */
export async function postMoneyTransaction(w: ApiWriter, module: "cash" | "bank", id: string, branchId?: string) {
  const path = `/api/v1/${module}/transactions/`;
  const finalStep = module === "cash" ? "confirm" : "post";
  let record = await w.get(`${path}${id}/${branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ""}`);
  for (let guard = 0; guard < 4 && record.status !== "POSTED"; guard += 1) {
    const step = ["DRAFT", "REJECTED", "REVISION_REQUIRED"].includes(record.status) ? "submit"
      : record.status === "PENDING_APPROVAL" ? "approve" : record.status === "APPROVED" ? finalStep : "";
    if (!step) throw new FormDataError(`Chứng từ ${record.number} đang ở trạng thái ${record.status}, không ghi sổ được.`);
    record = await w.action(path, id, step, {
      version: record.version,
      ...(module === "bank" && record.payment_details?.branch ? { branch: record.payment_details.branch } : {}),
    });
  }
  return record;
}

/**
 * "Cất" on Phiếu thu / Phiếu chi / Nộp tiền / Ủy nhiệm chi. Thu tiền khách hàng (Có 131) goes through the AR
 * receipt voucher so the customer's debt is credited; every other voucher saves the money document, takes it
 * through gửi → duyệt → ghi sổ, then has the backend post its accounting rows to the ledger.
 */
/** UC-CASH-01: save a receipt as DRAFT; posting is a separate operation. */
export async function saveCashReceiptDraft(w: ApiWriter, d: Row) {
  const kinds: Record<string, string> = {
    customer: "CUSTOMER_ADVANCE", customer_invoice: "CUSTOMER_INVOICE",
    advance_refund: "EMPLOYEE_RETURN", bank_withdrawal: "BANK_WITHDRAWAL", other_receipt: "OTHER_RECEIPT",
  };
  const businessType = kinds[String(d.receiptType || "")];
  if (!businessType) throw new FormDataError("Vui lòng chọn loại thu tiền hợp lệ.");
  const funds = await w.list("/api/v1/cash/funds/");
  const fund = funds.find(row => row.id === d.fundId && row.status === "ACTIVE");
  if (!fund) throw new FormDataError("Vui lòng chọn quỹ tiền mặt đang sử dụng.");
  const currency = (await w.list("currencies")).find(row => row.id === fund.currency);
  if (!currency) throw new FormDataError("Không tìm thấy loại tiền của quỹ.");
  const rate = num(d.exchangeRate ?? 1);
  if (rate <= 0 || (currency.code === "VND" && rate !== 1)) throw new FormDataError("Tỷ giá không hợp lệ.");
  const partyText = String(d.partnerCode || d.partner || "").trim().toLowerCase();
  const parties = partyText ? await w.list(businessType.startsWith("CUSTOMER") ? "customers" : "parties") : [];
  const party = parties.find(row => String(row.code).toLowerCase() === partyText || String(row.name).toLowerCase() === partyText);
  if (businessType.startsWith("CUSTOMER") && !party) throw new FormDataError("Vui lòng chọn khách hàng trong danh mục.");
  const employee = businessType === "EMPLOYEE_RETURN"
    ? (await w.list("/api/v1/organization/employees/")).find(row => row.id === d.employeeId)
    : undefined;
  if (businessType === "EMPLOYEE_RETURN" && !employee) throw new FormDataError("Vui lòng chọn nhân viên hoàn ứng.");
  const bank = businessType === "BANK_WITHDRAWAL"
    ? (await w.list("/api/v1/master-data/company-bank-accounts/")).find(row => row.id === d.sourceBankAccountId)
    : undefined;
  if (businessType === "BANK_WITHDRAWAL" && !bank) throw new FormDataError("Vui lòng chọn tài khoản ngân hàng nguồn.");
  const rawLines = Array.isArray(d.rows) ? d.rows : [];
  if (!rawLines.length) throw new FormDataError("Phiếu thu cần ít nhất một dòng hạch toán.");
  const lines = [];
  for (const [index, row] of rawLines.entries()) {
    if (!String(row.description || "").trim()) throw new FormDataError(`Dòng ${index + 1}: vui lòng nhập diễn giải.`);
    if (num(row.amount) <= 0) throw new FormDataError(`Dòng ${index + 1}: số tiền phải lớn hơn 0.`);
    const debit = await w.account(row.debit, `TK Nợ dòng ${index + 1}`);
    const credit = await w.account(row.credit, `TK Có dòng ${index + 1}`);
    lines.push({ description: String(row.description).trim(), debit_account: debit.id, debit_code: debit.code,
      credit_account: credit.id, credit_code: credit.code, amount: String(num(row.amount)), dimensions: row.dimensions || {} });
  }
  const amount = lines.reduce((sum, row) => sum + num(row.amount), 0);
  const allocations = Array.isArray(d.allocations) ? d.allocations : [];
  if (businessType === "CUSTOMER_INVOICE" && !allocations.length) throw new FormDataError("Vui lòng chọn chứng từ công nợ cần thu.");
  const date = toApiDate(d.date);
  const record = await w.post(`/api/v1/cash/transactions/?branch_id=${encodeURIComponent(fund.branch)}`, {
    fund: fund.id, number: String(d.code || "").trim(), transaction_type: "RECEIPT",
    business_type: businessType, transaction_date: date, party: party?.id || null,
    payer_payee: String(d.person || party?.name || employee?.full_name || "").trim(),
    currency: fund.currency, exchange_rate: String(rate), amount: String(amount),
    description: String(d.description || "").trim(), attachments: d.attachedFiles || [],
    receipt_details: { posting_date: toApiDate(d.postDate || d.date), payer_address: String(d.address || ""),
      original_documents: String(d.originalDocsCount || ""), employee: employee?.id || null,
      bank_account: bank?.id || null, lines, allocations },
  });
  return { record, message: `Đã lưu phiếu thu ${record.number} — Chưa ghi sổ.` };
}

/** UC-BANK-02: save a bank payment without posting bank or payable balances. */
export async function saveBankPaymentDraft(w: ApiWriter, d: Row) {
  const kinds: Record<string, string> = {
    supplier: "SUPPLIER_ADVANCE", supplier_invoice: "SUPPLIER_INVOICE",
    advance: "EMPLOYEE_ADVANCE", other_expense: "OTHER_PAYMENT",
  };
  const businessType = kinds[String(d.receiptType || "")];
  if (!businessType) throw new FormDataError("Vui lòng chọn loại chi tiền gửi hợp lệ.");
  const profile = (await w.list("/api/v1/bank/accounts/")).find(row => row.id === d.bankProfileId);
  if (!profile || profile.account === undefined) throw new FormDataError("Vui lòng chọn tài khoản ngân hàng chi.");
  const account = (await w.list("/api/v1/master-data/company-bank-accounts/")).find(row => row.id === profile.account);
  if (!account || account.status !== "ACTIVE" || !account.allow_payment)
    throw new FormDataError("Tài khoản ngân hàng không còn cho phép chi.");
  if (!d.branchId || (account.branch && account.branch !== d.branchId))
    throw new FormDataError("Vui lòng chọn chi nhánh khớp tài khoản chi.");
  const rate = num(d.exchangeRate ?? 1);
  if (rate <= 0 || (profile.currency_code === "VND" && rate !== 1)) throw new FormDataError("Tỷ giá không hợp lệ.");
  const partyText = String(d.partnerCode || d.partner || "").trim().toLowerCase();
  const party = partyText ? (await w.list("parties")).find(row =>
    String(row.code).toLowerCase() === partyText || String(row.name).toLowerCase() === partyText) : undefined;
  if (businessType.startsWith("SUPPLIER") && !party) throw new FormDataError("Vui lòng chọn nhà cung cấp trong danh mục.");
  const employee = businessType === "EMPLOYEE_ADVANCE"
    ? (await w.list("/api/v1/organization/employees/")).find(row => row.id === d.employeeId) : undefined;
  if (businessType === "EMPLOYEE_ADVANCE" && !employee) throw new FormDataError("Vui lòng chọn nhân viên tạm ứng.");
  const rows = Array.isArray(d.rows) ? d.rows : [];
  if (!rows.length) throw new FormDataError("Cần ít nhất một dòng hạch toán.");
  const lines = [];
  for (const [index, row] of rows.entries()) {
    if (!String(row.description || "").trim()) throw new FormDataError(`Dòng ${index + 1}: vui lòng nhập diễn giải.`);
    if (num(row.amount) <= 0) throw new FormDataError(`Dòng ${index + 1}: số tiền phải lớn hơn 0.`);
    const debit = await w.account(row.debit, `TK Nợ dòng ${index + 1}`);
    const credit = await w.account(row.credit, `TK Có dòng ${index + 1}`);
    lines.push({ description: String(row.description).trim(), debit_account: debit.id, debit_code: debit.code,
      credit_account: credit.id, credit_code: credit.code, amount: String(num(row.amount)), dimensions: row.dimensions || {} });
  }
  const amount = lines.reduce((sum, row) => sum + num(row.amount), 0);
  const allocations = Array.isArray(d.allocations) ? d.allocations : [];
  if (businessType === "SUPPLIER_INVOICE" && !allocations.length) throw new FormDataError("Vui lòng chọn công nợ cần trả.");
  const record = await w.post(`/api/v1/bank/transactions/?branch_id=${encodeURIComponent(String(d.branchId || ""))}`, {
    account: profile.id, number: String(d.code || "").trim(), transaction_type: "PAYMENT",
    business_type: businessType, transaction_date: toApiDate(d.date), value_date: toApiDate(d.postDate || d.date),
    party: party?.id || null, counterparty_name: String(d.beneficiaryName || d.partner || employee?.full_name ||
      (d.bankFee ? profile.bank_name : "")).trim(),
    counterparty_account: String(d.receiverAccount || "").trim(), currency: profile.currency_id,
    exchange_rate: String(rate), amount: String(amount), description: String(d.description || "").trim(),
    bank_reference: String(d.bankReference || "").trim(),
    payment_details: { posting_date: toApiDate(d.postDate || d.date), branch: d.branchId,
      employee: employee?.id || null, payer_address: String(d.address || ""),
      beneficiary_name: String(d.beneficiaryName || "").trim(), beneficiary_account: String(d.receiverAccount || "").trim(),
      beneficiary_bank: String(d.receiverBank || "").trim(), beneficiary_bank_branch: String(d.receiverBankBranch || "").trim(),
      bank_fee: Boolean(d.bankFee), lines, allocations, attachments: d.attachedFiles || [] },
  });
  return { record, message: `Đã lưu chứng từ chi tiền gửi ${record.number} — Chưa ghi sổ.` };
}

export async function saveMoneyVoucher(w: ApiWriter, module: "cash" | "bank", d: Row) {
  const receipt = d.kind === "receipt";
  const rows = (d.rows || []).filter((row: Row) => num(row.amount) > 0);
  const amount = rows.reduce((total: number, row: Row) => total + num(row.amount), 0);
  if (amount <= 0) throw new FormDataError("Nhập Số tiền trên dòng hạch toán (phải lớn hơn 0) trước khi cất.");
  // Every account is checked before anything is saved; the money side comes from the fund / bank account.
  const lines: Row[] = [];
  for (const [index, row] of rows.entries()) {
    if (!String(row.debit || "").trim() || !String(row.credit || "").trim()) {
      throw new FormDataError(`Dòng ${index + 1}: nhập đủ TK Nợ và TK Có.`);
    }
    await w.account(receipt ? row.debit : row.credit, receipt ? "TK Nợ" : "TK Có");
    const counter = await w.account(receipt ? row.credit : row.debit, receipt ? "TK Có" : "TK Nợ");
    lines.push({ account: counter.id, amount: String(num(row.amount)), description: String(row.description || d.description || "") });
  }
  const partnerText = String(d.partnerCode || d.partner || "").trim().toLowerCase();
  const parties = partnerText ? await w.list("parties") : [];
  const party = parties.find((row) => String(row.code).toLowerCase() === partnerText)
    || parties.find((row) => String(row.name).toLowerCase() === partnerText);
  const date = toApiDate(d.postDate || d.date);
  const description = String(d.description || d.reasonLabel || (receipt ? "Thu tiền" : "Chi tiền")).trim();
  const label = module === "cash" ? (receipt ? "phiếu thu" : "phiếu chi") : (receipt ? "chứng từ thu tiền gửi" : "ủy nhiệm chi");
  const counterpart = String(d.person || party?.name || d.partner || "").trim() || (receipt ? "Người nộp tiền" : "Người nhận tiền");

  let fund: Row | undefined, profile: Row | undefined;
  if (module === "cash") {
    fund = (await w.list("/api/v1/cash/funds/")).find((row) => row.status === "ACTIVE");
    if (!fund) throw new FormDataError("Chưa có quỹ tiền mặt đang hoạt động. Hãy khai báo quỹ trong Danh mục.");
  } else {
    const profiles = await w.list("/api/v1/bank/accounts/");
    profile = profiles.find((row) => d.bankAccount && row.account_number === d.bankAccount) || profiles[0];
    if (!profile) throw new FormDataError("Chưa có tài khoản ngân hàng nào có sổ tiền gửi. Hãy khai báo trong Danh mục.");
  }

  if (receipt && party && rows.every((row: Row) => String(row.credit).startsWith("131"))) {
    const customers = await w.list("customers");
    if (customers.some((row) => row.id === party.id)) {
      const result = await createAndPost(w, "/api/v1/accounts-receivable/customer-receipt-vouchers/", {
        branch: (module === "cash" ? fund?.branch : null) || (await w.branch()).id, customer: party.id,
        method: module === "cash" ? "CASH" : "BANK", purpose: "ADVANCE",
        ...(module === "cash" ? { cash_fund: fund?.id } : { bank_account: profile?.account }),
        number: d.code || undefined, document_date: toApiDate(d.date || d.postDate), posting_date: date,
        amount: String(amount), payer_name: String(d.person || party.name), credit_account: (await w.account(rows[0].credit, "TK Có")).id,
        description, lines: [],
      });
      return { record: result.record, message: describeResult(label, result) };
    }
  }

  const path = `/api/v1/${module}/transactions/`;
  const number = await nextVoucherNumber(w, path, module === "cash" ? (receipt ? "PT" : "PC") : (receipt ? "NTTK" : "UNC"), d.code);
  let record = await w.post(path, {
    ...(module === "cash"
      ? { fund: fund?.id, currency: fund?.currency, payer_payee: counterpart }
      : { account: profile?.id, currency: profile?.currency_id || profile?.currency, counterparty_name: counterpart }),
    number, transaction_type: receipt ? "RECEIPT" : "PAYMENT", business_type: "GENERAL",
    transaction_date: date, party: party?.id || null, amount: String(amount), description,
  });
  try {
    // Single-user default; a workflow configured for the company still overrides it on the server.
    record = await w.action(path, record.id, "submit", { workflow_snapshot: { levels: 1, allow_self_approval: true, separate_cashier: false } });
    record = await postMoneyTransaction(w, module, record.id);
  } catch (error) {
    return { record, message: `Đã lưu ${label} ${number} nhưng chưa ghi sổ: ${errorText(error)}` };
  }
  try {
    record = await w.action(path, record.id, "post-gl", { lines });
  } catch (error) {
    return { record, message: `Đã ghi sổ quỹ ${label} ${number} nhưng chưa hạch toán sổ cái: ${errorText(error)}` };
  }
  return { record, message: `Đã lưu và ghi sổ ${label} ${number} (${amount.toLocaleString("vi-VN")}đ, bút toán ${record.gl_reference}).` };
}

/** "Bỏ ghi" a posted cash or bank voucher (the backend requires a reason). */
export async function reverseMoneyTransaction(w: ApiWriter, module: "cash" | "bank", id: string, reason = "Bỏ ghi từ danh sách chứng từ", branchId?: string) {
  const path = `/api/v1/${module}/transactions/`;
  const record = await w.get(`${path}${id}/${branchId ? `?branch_id=${encodeURIComponent(branchId)}` : ""}`);
  return w.action(path, id, "reverse", { reason,
    ...(module === "bank" && record.payment_details?.branch ? { branch: record.payment_details.branch } : {}) });
}

/** Complete an internal transfer: cash dispatches then receives; bank confirms in one step. */
export async function completeTransfer(w: ApiWriter, module: "cash" | "bank", id: string) {
  const path = `/api/v1/${module}/transfers/`;
  let record = await w.get(`${path}${id}/`);
  if (module === "bank") return record.status === "DRAFT" ? w.action(path, id, "confirm", {}) : record;
  if (record.status === "DRAFT") record = await w.action(path, id, "dispatch", {});
  if (record.status === "IN_TRANSIT") record = await w.action(path, id, "receive", {});
  return record;
}

/** Internal transfers shown alongside the vouchers they move money between. */
export async function internalTransfers(w: ApiWriter, module: "cash" | "bank") {
  return w.list(`/api/v1/${module}/transfers/`);
}

/** "Hợp đồng tín dụng" (CreditContractModal; kind "lending" = we lend). */
export async function saveCreditContract(w: ApiWriter, d: Row) {
  const number = String(d.contractNum || "").trim();
  if (!number || !String(d.partner || "").trim()) throw new FormDataError("Nhập số hợp đồng và đối tác.");
  const status = /đang/i.test(String(d.status)) ? "ACTIVE" : /tất toán|kết thúc|đã/i.test(String(d.status)) ? "CLOSED" : "PENDING";
  const record = await w.post("/api/v1/bank/credit-contracts/", {
    direction: d.kind === "lending" ? "LENDING" : "BORROWING", contract_type: d.contractType === "principle" ? "PRINCIPLE" : "LIMIT",
    number, sign_date: toApiDate(d.signDate), partner_name: String(d.partner).trim(), credit_limit: String(num(d.creditLimit)),
    start_date: d.startDate ? toApiDate(d.startDate) : null, end_date: d.endDate ? toApiDate(d.endDate) : null,
    purpose: String(d.purpose || ""), status, collaterals: d.assets || [],
  });
  return { record, message: `Đã lưu hợp đồng tín dụng ${record.number}.` };
}

/** "Khế ước cho vay" (direction LENDING) and "Khế ước đi vay" (BORROWING). */
export async function saveLoanAgreement(w: ApiWriter, d: Row, direction: "LENDING" | "BORROWING") {
  const number = String(d.code || "").trim();
  const counterparty = String((direction === "LENDING" ? d.borrower : d.lender) || "").trim();
  if (!number || !counterparty) throw new FormDataError("Nhập số khế ước và đối tượng vay.");
  if (num(d.loanAmount) <= 0) throw new FormDataError("Số tiền vay phải lớn hơn 0.");
  const contracts = String(d.creditContract || "").trim()
    ? (await w.list("/api/v1/bank/credit-contracts/")).filter((row) => row.number === String(d.creditContract).trim()) : [];
  const record = await w.post("/api/v1/bank/loans/", {
    direction, number, counterparty_name: counterparty, credit_contract: contracts[0]?.id || null, purpose: String(d.purpose || ""),
    principal_account: (await w.account(d.debitAccount || (direction === "LENDING" ? "1283" : "3411"), "TK gốc")).id,
    interest_account: (await w.account(d.creditInterestAccount || (direction === "LENDING" ? "515" : "635"), "TK lãi")).id,
    amount: String(num(d.loanAmount)), term: Math.max(1, Math.round(num(d.loanTerm))),
    term_unit: /ngày/i.test(String(d.termUnit)) ? "DAY" : /năm/i.test(String(d.termUnit)) ? "YEAR" : "MONTH",
    disbursement_date: toApiDate(d.disbursementDate), due_date: toApiDate(d.dueDate || d.disbursementDate),
    interest_rates: (d.interestRows || []).map((row: Row) => ({
      rate: num(row.rate), overdue_rate: num(row.overdueRate), effective_date: toApiDate(row.effectiveDate), note: String(row.note || ""),
    })),
    principal_period: String(d.principalPeriod || ""), interest_period: String(d.interestPeriod || ""),
    settlement_account: String(d.collectionAccount || d.repaymentAccount || d.beneficiaryAccount || ""),
  });
  return { record, message: `Đã lưu khế ước ${direction === "LENDING" ? "cho vay" : "đi vay"} ${record.number}.` };
}

/* ───────────────────────── Thu/chi theo hóa đơn ───────────────────────── */

async function moneySource(w: ApiWriter, method: "cash" | "bank") {
  if (method === "bank") {
    const accounts = (await w.list("/api/v1/master-data/company-bank-accounts/")).filter((row) => row.status === "ACTIVE");
    if (!accounts[0]) throw new FormDataError("Chưa có tài khoản ngân hàng đang hoạt động. Hãy thêm trong Danh mục.");
    return { bank_account: accounts[0].id, company_bank_account: accounts[0].id };
  }
  const funds = (await w.list("/api/v1/cash/funds/")).filter((row) => row.status === "ACTIVE");
  if (!funds[0]) throw new FormDataError("Chưa có quỹ tiền mặt đang hoạt động.");
  return { cash_fund: funds[0].id };
}

/** Open receivables of the customer, shaped like the rows of the collection forms. */
export async function openReceivables(w: ApiWriter, customerCode?: unknown) {
  const customer = customerCode ? await w.customer(customerCode) : null;
  const customers = await w.list("customers");
  return (await w.list("receivables"))
    .filter((row) => num(row.balance) > 0 && (!customer || row.customer === customer.id))
    .map((row) => {
      const party = customers.find((item) => item.id === row.customer);
      return {
        id: row.id, voucherDate: toViDate(row.document_date), voucherCode: row.source_document_number || row.code,
        invoiceCode: "", description: row.description || `Công nợ ${row.source_document_number || row.code}`,
        dueDate: toViDate(row.due_date), totalDebt: num(row.original_amount), remainingDebt: num(row.balance),
        collectAmount: 0, account: row.account_code || "131", paymentTerms: row.payment_term_name || "",
        discountRate: "0", discountAmount: 0, discountAccount: "635", checked: false,
        customerCode: party?.code || row.customer_code || "", customerName: party?.name || row.customer_name || "",
        customerGroup: party?.customer_group || "",
      };
    });
}

/** "Thu tiền khách hàng theo hóa đơn": one receipt voucher per customer, allocated to the chosen receivables. */
export async function saveCustomerReceipts(w: ApiWriter, d: Row) {
  const chosen = (d.invoices || []).filter((row: Row) => num(row.collectAmount) > 0);
  if (!chosen.length) throw new FormDataError("Vui lòng chọn ít nhất một chứng từ công nợ để thu tiền.");
  const receivables = await w.list("receivables");
  const byCustomer = new Map<string, Row[]>();
  for (const row of chosen) {
    const receivable = receivables.find((item) => item.id === row.id);
    if (!receivable) throw new FormDataError(`Công nợ ${row.voucherCode} không còn trên hệ thống.`);
    byCustomer.set(receivable.customer, [...(byCustomer.get(receivable.customer) || []), { ...row, receivable }]);
  }
  const method = d.payMethod === "bank" ? "bank" : "cash";
  const source = await moneySource(w, method);
  const date = toApiDate(d.collectDate);
  const messages: string[] = [];
  for (const [customerId, rows] of byCustomer) {
    const amount = rows.reduce((total, row) => total + num(row.collectAmount), 0);
    const result = await createAndPost(w, "/api/v1/accounts-receivable/customer-receipt-vouchers/", {
      branch: rows[0].receivable.branch || (await w.branch()).id, customer: customerId,
      method: method === "bank" ? "BANK" : "CASH", purpose: "DEBT", ...source,
      document_date: date, posting_date: date, amount: String(amount), payer_name: String(d.employee || ""),
      credit_account: rows[0].receivable.account || (await w.account("131")).id,
      description: `Thu tiền khách hàng theo ${rows.length} chứng từ công nợ`,
      lines: rows.map((row) => ({ receivable: row.receivable.id, amount: String(num(row.collectAmount)) })),
    });
    messages.push(describeResult("phiếu thu", result));
  }
  return { message: messages.join(" ") };
}

/** Open payables of the supplier, shaped like the rows of "Trả tiền theo hóa đơn". */
export async function openPayables(w: ApiWriter, supplierCode: unknown) {
  const supplier = await w.supplier(supplierCode);
  const purchases = await w.list("goodsPurchases");
  return (await w.list("payables"))
    .filter((row) => row.supplier === supplier.id && num(row.balance) > 0)
    .map((row) => {
      const purchase = purchases.find((item) => item.id === row.goods_purchase);
      return {
        id: row.id, voucherDate: toViDate(purchase?.document_date || row.created_at), voucherCode: purchase?.number || "",
        invoiceDate: "", invoiceCode: "", description: purchase?.notes || `Công nợ ${purchase?.number || ""}`.trim(),
        dueDate: toViDate(row.due_date), totalDebt: num(row.original_amount), remainingDebt: num(row.balance),
        payAmount: num(row.balance), account: "331", terms: "", checked: true,
      };
    });
}

/** "Trả tiền nhà cung cấp theo hóa đơn": a posted payment voucher allocated to the chosen payables. */
export async function saveSupplierPayment(w: ApiWriter, d: Row) {
  const chosen = (d.invoices || []).filter((row: Row) => num(row.payAmount) > 0);
  if (!chosen.length) throw new FormDataError("Vui lòng chọn ít nhất một chứng từ công nợ để trả tiền.");
  const supplier = await w.supplier(d.supplierCode || d.supplier);
  const bank = /gửi|ngân hàng|bank/i.test(String(d.payMethod));
  const source = await moneySource(w, bank ? "bank" : "cash");
  const record = await w.post("/api/v1/accounts-payable/payments/", {
    action: "POST", payment_source: "DIRECT", supplier: supplier.id, currency: (await w.currency()).id,
    payment_date: toApiDate(d.payDate), payment_method: bank ? "BANK_TRANSFER" : "CASH",
    ...(bank ? { company_bank_account: source.company_bank_account } : { cash_fund: source.cash_fund }),
    recipient_name: String(d.employee || supplier.name), payment_content: `Trả tiền ${supplier.name} theo ${chosen.length} chứng từ`,
    lines: chosen.map((row: Row) => ({ payable: row.id, amount: String(num(row.payAmount)) })),
  });
  return { record, message: `Đã lập và ghi sổ phiếu chi ${record.number || record.voucher_number || ""} trả ${supplier.name}.` };
}

/* ───────────────────────────── Tổng hợp ───────────────────────────── */

/** "Lấy dữ liệu" for Kết chuyển lãi lỗ: income/expense balances of the period moved to 911, then 911 to 4212. */
export async function closingRowsFromLedger(w: ApiWriter, toDate: unknown) {
  const date = toApiDate(toDate);
  const period = await w.glPeriod(date);
  const balances = (await w.list("/api/v1/general-ledger/balances/")).filter((row) => row.period === period.id);
  const totals = new Map<string, { name: string; amount: number }>();
  for (const row of balances) {
    const code = String(row.account_code);
    if (!/^[5-8]/.test(code)) continue;
    const net = num(row.closing_debit) - num(row.closing_credit);
    const entry = totals.get(code) || { name: row.account_name, amount: 0 };
    entry.amount += net;
    totals.set(code, entry);
  }
  const rows: Row[] = [];
  let result = 0;
  for (const [code, { name, amount }] of [...totals].sort(([a], [b]) => a.localeCompare(b))) {
    if (Math.round(amount) === 0) continue;
    result -= amount;
    rows.push(amount < 0
      ? { id: code, desc: `Kết chuyển ${name} sang 911`, debitAcc: code, creditAcc: "911", amount: -amount }
      : { id: code, desc: `Kết chuyển ${name} sang 911`, debitAcc: "911", creditAcc: code, amount });
  }
  if (Math.round(result) !== 0) {
    rows.push(result > 0
      ? { id: "911-lai", desc: "Kết chuyển lãi hoạt động kinh doanh", debitAcc: "911", creditAcc: "4212", amount: result }
      : { id: "911-lo", desc: "Kết chuyển lỗ hoạt động kinh doanh", debitAcc: "4212", creditAcc: "911", amount: -result });
  }
  return rows;
}

/** A general-ledger voucher from rows of (TK Nợ, TK Có, số tiền) — used by Kết chuyển lãi lỗ. */
export async function saveJournalVoucher(w: ApiWriter, d: Row) {
  const rows = (d.rows || []).filter((row: Row) => num(row.amount) > 0);
  if (!rows.length) throw new FormDataError("Chứng từ chưa có dòng hạch toán nào có số tiền.");
  const postingDate = toApiDate(d.postingDate);
  const currency = (await w.currency()).id;
  const lines: Row[] = [];
  for (const row of rows) {
    const amount = String(Math.round(num(row.amount)));
    const description = String(row.desc || d.description || "");
    // Accounts tracked by object (131, 331, 141…) take the voucher's object.
    const party = row.party || d.party || null;
    const debit = await w.account(row.debitAcc, "TK Nợ"), credit = await w.account(row.creditAcc, "TK Có");
    lines.push({ line_no: lines.length + 1, account: debit.id, debit: amount, credit: "0", currency, description, ...(party && debit.requires_party ? { party } : {}) });
    lines.push({ line_no: lines.length + 1, account: credit.id, debit: "0", credit: amount, currency, description, ...(party && credit.requires_party ? { party } : {}) });
  }
  const path = "/api/v1/general-ledger/journals/";
  const result = await createAndPost(w, path, {
    branch: (await w.branch()).id, period: (await w.glPeriod(postingDate)).id,
    number: await nextVoucherNumber(w, path, "NVK", d.number), entry_type: d.entryType || "MANUAL",
    posting_date: postingDate, document_date: toApiDate(d.docDate || d.postingDate),
    description: String(d.description || "Chứng từ nghiệp vụ khác"), lines,
  });
  return { ...result, message: describeResult("chứng từ", result) };
}

/** Settle an existing disbursed advance. The cash API owns the advance balance. */
export async function saveAdvanceSettlement(w: ApiWriter, d: Row) {
  const employeeText = String(d.employee || "").trim().toLowerCase();
  if (!employeeText) throw new FormDataError("Chọn nhân viên hoặc nhập số khoản tạm ứng cần quyết toán.");
  const employees = await w.list("/api/v1/organization/employees/");
  const employee = employees.find((row) =>
    [row.code, row.full_name, row.name].some((value) => String(value || "").trim().toLowerCase() === employeeText));
  const advances = (await w.list("/api/v1/cash/advances/"))
    .filter((row) => ["ACTIVE", "PARTIAL"].includes(row.status) && num(row.remaining_amount) > 0)
    .filter((row) => String(row.number || "").toLowerCase() === employeeText || (employee && row.recipient === employee.id));
  if (advances.length !== 1) {
    throw new FormDataError(advances.length
      ? "Nhân viên có nhiều khoản tạm ứng đang mở; hãy nhập số khoản tạm ứng vào ô Nhân viên."
      : "Không tìm thấy khoản tạm ứng đang mở của nhân viên này.");
  }
  const accepted = (d.rows || []).reduce((sum: number, row: Row) => sum + num(row.amount), 0);
  if (accepted <= 0) throw new FormDataError("Nhập số tiền quyết toán lớn hơn 0.");
  if (accepted > num(advances[0].remaining_amount)) throw new FormDataError("Số tiền quyết toán vượt số tạm ứng còn lại.");
  const record = await w.action("/api/v1/cash/advances/", advances[0].id, "settle", {
    settlement_date: toApiDate(d.docDate),
    accepted_expense: String(accepted),
    note: String(d.description || d.number || "").slice(0, 500),
    documents: [{ number: String(d.number || ""), description: String(d.description || "") }],
  });
  return { record, message: `Đã quyết toán ${accepted.toLocaleString("vi-VN")}đ cho khoản tạm ứng ${advances[0].number}. Các dòng hạch toán chưa được ghi sổ.` };
}

/** Preserve the existing assembly/disassembly form as a draft inventory order. */
export async function saveAssemblyOrder(w: ApiWriter, d: Row) {
  const disassemble = d.operation === "DISASSEMBLE";
  const inputRows = (d.inputRows || []).filter((row: Row) => String(row.itemCode || "").trim());
  const outputRows = (d.outputRows || []).filter((row: Row) => String(row.itemCode || "").trim());
  if (!inputRows.length || !outputRows.length) throw new FormDataError("Lệnh cần ít nhất một hàng đầu vào và một hàng đầu ra.");
  const warehouse = await w.warehouse(inputRows[0].warehouse);
  const lines: Row[] = [];
  for (const [rows, role] of [[inputRows, disassemble ? "OUTPUT" : "COMPONENT"], [outputRows, disassemble ? "COMPONENT" : "OUTPUT"]] as const) {
    for (const row of rows) {
      const item = await w.item(row.itemCode);
      await w.uom(item, "base");
      const quantity = num(row.qty);
      if (quantity <= 0) throw new FormDataError(`Nhập số lượng lớn hơn 0 cho mã hàng ${item.code}.`);
      lines.push({ line_no: lines.length + 1, role, item: item.id,
        quantity: String(quantity), unit_cost: String(num(row.price ?? item.purchase_price)) });
    }
  }
  const record = await w.post("/api/v1/inventory/assemblies/", {
    number: await nextVoucherNumber(w, "/api/v1/inventory/assemblies/", "LRTD", d.number),
    warehouse: warehouse.id, assembly_date: toApiDate(d.date), operation: d.operation, lines,
  });
  return { record, message: `Đã lưu lệnh ${disassemble ? "tháo dỡ" : "lắp ráp"} ${record.number} dưới dạng dự thảo.` };
}

/* ─────────────────────────── Chi phí trả trước ─────────────────────────── */

const PREPAID = "/api/v1/general-ledger/";

/** "Thêm chi phí trả trước" (opening = false) and "… đầu kỳ" (opening = true). */
export async function savePrepaidExpense(w: ApiWriter, d: Row, opening: boolean) {
  const code = String(d.code || "").trim();
  if (!code || !String(d.name || "").trim()) throw new FormDataError("Cần nhập mã và tên chi phí trả trước.");
  const amount = num(d.amount);
  const periods = Math.round(num(d.allocMonths));
  if (amount <= 0 || periods <= 0) throw new FormDataError("Số tiền và số kỳ phân bổ phải lớn hơn 0.");
  const targets = (d.rows || []).filter((row: Row) => String(row.costAccount || "").trim());
  if (!targets.length) throw new FormDataError("Cần ít nhất một dòng TK chi phí nhận phân bổ.");
  const rates = targets.map((row: Row) => num(row.rate));
  // A single line without a rate takes the whole amount.
  if (targets.length === 1 && !rates[0]) rates[0] = 100;
  if (Math.abs(rates.reduce((total: number, rate: number) => total + rate, 0) - 100) > 0.0001) {
    throw new FormDataError("Tổng tỷ lệ phân bổ các dòng phải bằng 100%.");
  }
  const remainingPeriods = Math.round(num(d.remainingMonths));
  const record = await w.post(`${PREPAID}prepaid-expenses/`, {
    code, name: String(d.name).trim(), record_date: toApiDate(d.recordDate), start_date: toApiDate(d.startDate || d.recordDate),
    amount: String(amount), allocation_periods: periods,
    prepaid_account: (await w.account(d.waitingAcc || "242", "TK chờ phân bổ")).id,
    is_opening: opening, stop_allocation: Boolean(d.stopAlloc),
    opening_allocated_amount: opening ? String(num(d.allocatedAmount)) : "0",
    opening_allocated_periods: opening ? Math.max(periods - remainingPeriods, 0) : 0,
    targets: await Promise.all(targets.map(async (row: Row, index: number) => ({
      expense_account: (await w.account(row.costAccount, "TK chi phí")).id, rate: String(rates[index]),
      description: String(row.targetName || row.costItem || ""),
    }))),
  });
  return { record, message: `Đã lưu chi phí trả trước ${code}.` };
}

/** Items the allocation of that posting date would book (the "Phân bổ" tab). */
export async function previewPrepaidAllocation(w: ApiWriter, postingDate: unknown) {
  return await w.get(`${PREPAID}prepaid-allocations/preview/?posting_date=${toApiDate(postingDate)}`) as Row[];
}

/** "Phân bổ chi phí trả trước" for the period of the posting date. */
export async function savePrepaidAllocation(w: ApiWriter, d: Row) {
  const record = await w.post(`${PREPAID}prepaid-allocations/`, {
    number: String(d.number || ""), posting_date: toApiDate(d.postingDate), document_date: toApiDate(d.documentDate || d.postingDate),
    description: String(d.description || ""),
  });
  return { record, message: `Đã ghi sổ phân bổ chi phí trả trước ${record.number}: ${num(record.total_amount).toLocaleString("vi-VN")}đ.` };
}

/** "Ghi giảm chi phí trả trước": the remainder of each chosen item goes to expense. */
export async function savePrepaidDecrease(w: ApiWriter, d: Row) {
  const codes = (d.rows || []).map((row: Row) => String(row.code || "").trim()).filter(Boolean);
  if (!codes.length) throw new FormDataError("Chọn ít nhất một khoản chi phí trả trước cần ghi giảm.");
  const items = await w.list(`${PREPAID}prepaid-expenses/`);
  const lines = codes.map((code: string) => {
    const item = items.find((row) => row.code === code);
    if (!item) throw new FormDataError(`Chi phí trả trước ${code} chưa có trên hệ thống.`);
    return { prepaid: item.id };
  });
  const record = await w.post(`${PREPAID}prepaid-decreases/`, {
    number: String(d.number || ""), document_date: toApiDate(d.date), reason: String(d.reason || ""), lines,
  });
  return { record, message: `Đã ghi sổ ghi giảm chi phí trả trước ${record.number}: ${num(record.total_amount).toLocaleString("vi-VN")}đ.` };
}

/** "Hóa đơn điều chỉnh": an ADJUSTMENT tax invoice against the original output invoice the form searched for. */
export async function saveAdjustmentInvoice(w: ApiWriter, d: Row) {
  const wanted = String(d.targetInvoiceSearch || "").trim();
  if (!wanted) throw new FormDataError("Nhập số hóa đơn gốc cần điều chỉnh.");
  const original = (await w.list("/api/v1/tax/invoices/"))
    .find((row) => row.direction === "OUTPUT" && row.invoice_type !== "ADJUSTMENT" && [row.invoice_number, `${row.invoice_series}-${row.invoice_number}`].includes(wanted));
  if (!original) throw new FormDataError(`Không tìm thấy hóa đơn đầu ra số ${wanted} để điều chỉnh.`);
  if (original.status !== "ISSUED") throw new FormDataError(`Hóa đơn ${wanted} chưa phát hành nên chưa thể lập hóa đơn điều chỉnh.`);
  const rows = (d.items || []).filter((row: Row) => String(row.itemName || row.itemCode || "").trim() && num(row.quantity) > 0);
  if (!rows.length) throw new FormDataError("Nhập ít nhất một dòng hàng điều chỉnh.");
  if (!String(d.invoiceSeries || "").trim() || !String(d.invoiceNo || "").trim()) throw new FormDataError("Nhập ký hiệu và số hóa đơn điều chỉnh.");
  const items = await w.list("items");
  // Tax invoice lines carry the percentage itself; the adjustment follows the original invoice's rate.
  const taxRate = String(num(original.lines?.[0]?.tax_rate));
  const record = await w.post("/api/v1/tax/invoices/", {
    branch: original.branch, direction: "OUTPUT", invoice_type: "ADJUSTMENT", original_invoice: original.id,
    adjustment_effect: /giảm/i.test(String(d.adjustReason)) ? "DECREASE" : "INCREASE",
    invoice_series: String(d.invoiceSeries).trim(), invoice_number: String(d.invoiceNo).trim(), invoice_date: toApiDate(d.invoiceDate),
    seller_name: original.seller_name, seller_tax_code: original.seller_tax_code,
    buyer_name: String(d.buyerName || d.customerName || original.buyer_name), buyer_tax_code: String(d.taxCode || original.buyer_tax_code || ""),
    party: original.party, currency: original.currency, source: "MANUAL",
    raw_data: { reason: String(d.adjustReason || ""), content: String(d.adjustContent || "") },
    lines: rows.map((row: Row, index: number) => ({
      line_no: index + 1, description: String(row.itemName || row.itemCode), quantity: String(num(row.quantity)),
      unit_price: String(num(row.unitPrice)), discount_amount: String(num(row.discountAmount)), tax_rate: taxRate,
      item: items.find((item) => item.code === row.itemCode)?.id || null,
    })),
  });
  return { record, message: `Đã lưu hóa đơn điều chỉnh ${record.invoice_series}-${record.invoice_number} cho hóa đơn ${wanted}.` };
}

/* ───────────────────────────── Tiền lương ───────────────────────────── */

const PAYROLL = "/api/v1/payroll/";

/** Employees with their pay profile (if any), shaped like the payroll employee table. */
export async function payrollEmployees(w: ApiWriter) {
  const [employees, profiles, departments] = await Promise.all([
    w.list("/api/v1/organization/employees/"), w.list(`${PAYROLL}profiles/`), w.list("/api/v1/organization/departments/"),
  ]);
  return employees.filter((row) => row.status === "ACTIVE").map((employee) => {
    const profile = profiles.find((row) => row.employee === employee.id);
    return {
      id: employee.employee_code, employeeId: employee.id, profileId: profile?.id || "", name: employee.full_name,
      dept: departments.find((row) => row.id === employee.department)?.name || "", title: "",
      salaryRate: num(profile?.base_salary), allowance: num(profile?.allowance), bankAcc: profile?.bank_account || "",
      dependents: num(profile?.dependents), insuranceSalary: num(profile?.insurance_salary),
      status: profile?.is_active === false ? "Ngừng tính lương" : profile ? "Đang làm việc" : "Chưa có hồ sơ lương",
    };
  });
}

/** Saves the salary columns edited in the payroll employee table. */
export async function savePayProfiles(w: ApiWriter, rows: Row[]) {
  const changed = rows.filter((row) => row.dirty);
  if (!changed.length) return { message: "Không có thay đổi hồ sơ lương." };
  const expense = await w.account("642", "TK chi phí lương");
  for (const row of changed) {
    const body = {
      base_salary: String(num(row.salaryRate)), allowance: String(num(row.allowance)), dependents: Math.round(num(row.dependents)),
      insurance_salary: String(num(row.insuranceSalary) || num(row.salaryRate)), bank_account: String(row.bankAcc || ""),
    };
    if (row.profileId) await w.patch(`${PAYROLL}profiles/${row.profileId}/`, body);
    else await w.post(`${PAYROLL}profiles/`, { ...body, employee: row.employeeId, expense_account: expense.id });
  }
  return { message: `Đã lưu hồ sơ lương của ${changed.length} nhân viên.` };
}

/** "Bảng chấm công" (DETAIL) / "Bảng tổng hợp chấm công" (SUMMARY) of a month, prefilled with active employees. */
export async function saveAttendanceSheet(w: ApiWriter, d: Row, kind: "DETAIL" | "SUMMARY") {
  const month = String(d.month).padStart(2, "0");
  const record = await w.post(`${PAYROLL}attendance-sheets/`, {
    kind, method: /giờ/i.test(String(d.type)) ? "HOUR" : "SESSION", name: String(d.name || ""), period: `${d.year}-${month}`,
  });
  return { record, message: `Đã tạo ${record.name} (${(record.lines || []).length} nhân viên).` };
}

/** "Bảng lương": calculated on the backend from pay profiles (and the month's attendance sheet when one exists). */
export async function saveSalarySheet(w: ApiWriter, d: Row) {
  const period = `${d.year}-${String(d.month).padStart(2, "0")}`;
  const basedOnAttendance = !/cố định/i.test(String(d.type || ""));
  const attendance = basedOnAttendance
    ? (await w.list(`${PAYROLL}attendance-sheets/`)).find((row) => row.period === period) : null;
  if (basedOnAttendance && !attendance) throw new FormDataError(`Chưa có bảng chấm công tháng ${d.month}/${d.year}.`);
  const record = await w.post(`${PAYROLL}salary-sheets/`, { name: String(d.name || ""), period, attendance_sheet: attendance?.id || null });
  return { record, message: `Đã tính ${record.name}: ${(record.lines || []).length} nhân viên.` };
}

/** "Hạch toán chi phí lương" of a calculated salary sheet. */
export async function postSalarySheet(w: ApiWriter, sheetId: string) {
  const record = await w.action(`${PAYROLL}salary-sheets/`, sheetId, "post", {});
  return { record, message: `Đã hạch toán ${record.name} (chứng từ ${record.journal_number}).` };
}

/** Latest posted salary sheet still waiting for the given payment. */
export async function payableSalarySheet(w: ApiWriter, insurance: boolean) {
  const sheets = (await w.list(`${PAYROLL}salary-sheets/`)).filter((row) =>
    insurance ? row.status !== "CALCULATED" && !row.insurance_payment_reference : row.status === "POSTED");
  const sheet = sheets.sort((a, b) => String(b.period).localeCompare(String(a.period)))[0];
  if (!sheet) throw new FormDataError(insurance ? "Không có bảng lương đã hạch toán nào chưa nộp bảo hiểm." : "Không có bảng lương đã hạch toán nào chưa trả lương.");
  return sheet;
}

/** Rows of the salary-payment form: each employee's net pay. */
export async function salaryPaymentRows(w: ApiWriter) {
  const sheet = await payableSalarySheet(w, false);
  const profiles = await w.list(`${PAYROLL}profiles/`);
  return (sheet.lines || []).map((line: Row) => {
    const profile = profiles.find((row) => row.employee === line.employee);
    return {
      id: line.id, code: line.employee_code, name: line.employee_name, department: profile?.department_name || "",
      account: profile?.bank_account || "", bank: "", due: num(line.net), pay: num(line.net), checked: true,
    };
  });
}

const FUND_NAMES: Record<string, string> = {
  social: "Bảo hiểm Xã hội (BHXH)", health: "Bảo hiểm Y tế (BHYT)", unemployment: "Bảo hiểm Thất nghiệp (BHTN)", union: "Kinh phí công đoàn (KPCĐ)",
};

/** Rows of the insurance-payment form: employee + employer share per fund. */
export async function insurancePaymentRows(w: ApiWriter) {
  const sheet = await payableSalarySheet(w, true);
  const totals = new Map<string, number>();
  for (const line of sheet.lines || []) {
    for (const side of ["employee", "employer"]) {
      for (const [fund, amount] of Object.entries(line.detail?.[side] || {})) totals.set(fund, (totals.get(fund) || 0) + num(amount));
    }
  }
  return [...totals].map(([fund, amount]) => ({ id: fund, name: FUND_NAMES[fund] || fund, due: amount, pay: amount, checked: true }));
}

/** Pays the salaries or the insurance of the latest posted sheet with a cash or bank payment voucher. */
export async function savePayrollPayment(w: ApiWriter, d: Row, insurance: boolean) {
  const sheet = await payableSalarySheet(w, insurance);
  const amount = num(d.totalAmount);
  if (amount <= 0) throw new FormDataError("Chọn ít nhất một dòng cần chi.");
  const date = toApiDate(d.payDate);
  const description = `${insurance ? "Nộp bảo hiểm" : "Trả lương"} ${sheet.name}`.slice(0, 500);
  const counterparty = insurance ? "Cơ quan Bảo hiểm xã hội" : "Người lao động";
  let voucher: Row;
  if (d.payMethod === "bank") {
    const account = (await w.list("/api/v1/bank/accounts/")).find((row) => row.status === "ACTIVE") || (await w.list("/api/v1/bank/accounts/"))[0];
    if (!account) throw new FormDataError("Chưa có tài khoản ngân hàng để chi.");
    const path = "/api/v1/bank/transactions/";
    voucher = await w.post(path, {
      number: await nextVoucherNumber(w, path, "UNC"), transaction_type: "PAYMENT", business_type: insurance ? "INSURANCE" : "SALARY",
      transaction_date: date, counterparty_name: counterparty, amount: String(amount), description, account: account.id,
      currency: account.currency_id || account.currency,
    });
  } else {
    const fund = (await w.list("/api/v1/cash/funds/")).find((row) => row.status === "ACTIVE");
    if (!fund) throw new FormDataError("Chưa có quỹ tiền mặt đang hoạt động.");
    const path = "/api/v1/cash/transactions/";
    voucher = await w.post(path, {
      number: await nextVoucherNumber(w, path, "PC"), transaction_type: "PAYMENT", business_type: insurance ? "INSURANCE" : "SALARY",
      transaction_date: date, payer_payee: counterparty, amount: String(amount), description, fund: fund.id, currency: fund.currency,
    });
  }
  await w.action(`${PAYROLL}salary-sheets/`, sheet.id, insurance ? "insurance-paid" : "paid", { reference: voucher.number });
  return { record: voucher, message: `Đã lập chứng từ chi ${voucher.number} - ${description}: ${amount.toLocaleString("vi-VN")}đ (chờ duyệt và ghi sổ).` };
}

/* ───────────────────────────── Giá thành ───────────────────────────── */

const COSTING = "/api/v1/costing/";
export type CostObjectType = "COST_CENTER" | "PROJECT" | "ORDER" | "CONTRACT";

/** Cost objects of a type from the catalogs they live in, as { id, code, name, type, ... } rows. */
export async function costObjectCatalog(w: ApiWriter, objectType: CostObjectType | "PROCESS"): Promise<Row[]> {
  if (objectType === "COST_CENTER" || objectType === "PROCESS") {
    const centers = (await w.list("/api/v1/master-data/cost-centers/")).filter((row) => row.status === "ACTIVE");
    if (objectType === "COST_CENTER") return centers.map((row) => ({ id: row.id, code: row.code, name: row.name, type: "Phân xưởng" }));
    // A production process is a parent cost center; its children are the stages in code order.
    return centers.filter((row) => centers.some((child) => child.parent === row.id)).map((row) => {
      const stages = centers.filter((child) => child.parent === row.id).sort((a, b) => String(a.code).localeCompare(String(b.code)));
      return { id: row.id, code: row.code, name: row.name, stagesCount: stages.length, stages: stages.map((stage) => stage.name).join(" → "), stageIds: stages.map((stage) => stage.id) };
    });
  }
  if (objectType === "PROJECT") {
    return (await w.list("/api/v1/master-data/projects/")).filter((row) => row.status === "ACTIVE").map((row) => ({ id: row.id, code: row.code, name: row.name, type: "Công trình" }));
  }
  const rows = await w.list(objectType === "ORDER" ? "/api/v1/sales/orders/" : "/api/v1/sales/contracts/");
  return rows.filter((row) => !["DRAFT", "CANCELLED", "REJECTED"].includes(row.status)).map((row) => ({
    id: row.id, code: row.number || row.contract_number, name: row.title || row.customer_name || row.number,
    date: toViDate(row.document_date), customer: row.customer_name || "", note: row.title || "",
  }));
}

/** "Thêm kỳ tính giá thành" for any method; objects are referenced by their codes on the form. */
export async function saveCostPeriod(w: ApiWriter, d: Row) {
  const method = String(d.method);
  const objectType: CostObjectType = method === "PROJECT" ? "PROJECT" : method === "ORDER" ? "ORDER" : method === "CONTRACT" ? "CONTRACT" : "COST_CENTER";
  const codes: string[] = (d.codes || []).map((code: unknown) => String(code).trim()).filter(Boolean);
  if (!codes.length) throw new FormDataError("Chọn ít nhất một đối tượng tập hợp chi phí.");
  let objects: Row[];
  if (method === "STEP") {
    const processes = await costObjectCatalog(w, "PROCESS");
    objects = codes.flatMap((code) => {
      const process = processes.find((row) => row.code === code || row.name === code);
      if (!process) throw new FormDataError(`Quy trình ${code} chưa khai báo (trung tâm chi phí cha có các công đoạn con).`);
      return (process.stageIds as string[]).map((id) => ({ object_type: "COST_CENTER", object_id: id }));
    });
  } else {
    const catalog = await costObjectCatalog(w, objectType);
    objects = codes.map((code) => {
      const row = catalog.find((item) => item.code === code);
      if (!row) throw new FormDataError(`Đối tượng ${code} chưa có trong danh mục.`);
      return { object_type: objectType, object_id: row.id, output_quantity: String(num(d.quantities?.[code])) };
    });
  }
  const path = `${COSTING}periods/`;
  const used = new Set((await w.list(path)).map((row) => String(row.code)));
  let counter = used.size + 1;
  while (used.has(`GT${String(counter).padStart(5, "0")}`)) counter += 1;
  const record = await w.post(path, {
    code: `GT${String(counter).padStart(5, "0")}`, name: String(d.name || ""), method,
    start_date: toApiDate(d.from), end_date: toApiDate(d.to), objects,
  });
  const total = (record.objects || []).reduce((sum: number, row: Row) => sum + num(row.total_cost), 0);
  return { record, message: `Đã cất "${record.name}" - giá thành ${total.toLocaleString("vi-VN")}đ cho ${(record.objects || []).length} đối tượng.` };
}

async function costPeriodByName(w: ApiWriter, name: unknown) {
  const period = (await w.list(`${COSTING}periods/`)).find((row) => row.name === String(name || "").trim() || row.code === String(name || "").trim());
  if (!period) throw new FormDataError("Chọn kỳ tính giá thành đã lưu trên hệ thống.");
  return period;
}

/** "Kết chuyển chi phí" 621/622/627 → 154 of a period. */
export async function transferCostPeriod(w: ApiWriter, periodName: unknown) {
  const period = await costPeriodByName(w, periodName);
  const record = await w.action(`${COSTING}periods/`, period.id, "transfer", {});
  return { record, message: `Đã kết chuyển chi phí sang TK 154 (chứng từ ${record.transfer_number}).` };
}

/** "Nghiệm thu" (632) or "nhập kho thành phẩm" (155) of the chosen objects of a period. */
export async function acceptCostPeriod(w: ApiWriter, periodName: unknown, codes: string[], target: "COGS" | "FINISHED_GOODS") {
  const period = await costPeriodByName(w, periodName);
  const objects = (period.objects || []).filter((row: Row) => !codes.length || codes.includes(row.object_code)).map((row: Row) => row.id);
  if (!objects.length) throw new FormDataError("Chọn ít nhất một đối tượng thuộc kỳ tính giá thành.");
  const record = await w.action(`${COSTING}periods/`, period.id, "accept", { objects, target });
  return { record, message: `Đã ${target === "COGS" ? "nghiệm thu sang TK 632" : "nhập kho thành phẩm"} ${objects.length} đối tượng (chứng từ ${record.acceptance_number}).` };
}

/** Acceptance screens pick objects only: accept them in the latest transferred period of the method that holds them. */
export async function acceptCostObjects(w: ApiWriter, method: string, codes: string[], target: "COGS" | "FINISHED_GOODS") {
  if (!codes.length) throw new FormDataError("Chọn ít nhất một đối tượng để nghiệm thu.");
  const periods = (await w.list(`${COSTING}periods/`))
    .filter((row) => row.method === method && row.status === "TRANSFERRED"
      && (row.objects || []).some((object: Row) => codes.includes(object.object_code) && !object.accepted))
    .sort((a, b) => String(b.end_date).localeCompare(String(a.end_date)));
  if (!periods.length) throw new FormDataError("Chưa có kỳ tính giá thành đã kết chuyển chi phí chứa các đối tượng đã chọn.");
  return acceptCostPeriod(w, periods[0].code, codes, target);
}

/** Norms of cost objects (opening WIP, coefficient, planned cost, material norms, estimate) keyed by object code. */
export async function saveCostObjectSettings(w: ApiWriter, objectType: CostObjectType, rows: Row[]) {
  const catalog = await costObjectCatalog(w, objectType);
  let saved = 0;
  for (const row of rows.filter((item) => String(item.code || "").trim())) {
    const target = catalog.find((item) => item.code === String(row.code).trim());
    if (!target) throw new FormDataError(`Đối tượng ${row.code} chưa có trong danh mục.`);
    const body: Row = { object_type: objectType, object_id: target.id };
    if (row.openingWip !== undefined) body.opening_wip = String(num(row.openingWip));
    if (row.coefficient !== undefined) body.coefficient = String(num(row.coefficient) || 1);
    if (row.plannedCost !== undefined) body.planned_cost = String(num(row.plannedCost));
    if (row.materialNorms !== undefined) body.material_norms = row.materialNorms;
    if (row.estimate !== undefined) body.estimate = row.estimate;
    if (row.finishedItemCode) body.finished_item = (await w.item(row.finishedItemCode)).id;
    await w.post(`${COSTING}object-settings/`, body);
    saved += 1;
  }
  if (!saved) throw new FormDataError("Chưa nhập số liệu cho đối tượng nào.");
  return { message: `Đã lưu số liệu cho ${saved} đối tượng tập hợp chi phí.` };
}

/* ───────────────────────────── Thuế ───────────────────────────── */

/** Output VAT (3331x) and deductible input VAT (133x) of the period containing the date. */
export async function vatPosition(w: ApiWriter, date: unknown) {
  const period = await w.glPeriod(toApiDate(date));
  const balances = (await w.list("/api/v1/general-ledger/balances/")).filter((row) => row.period === period.id);
  const sum = (prefix: string, sign: 1 | -1) => balances.filter((row) => String(row.account_code).startsWith(prefix))
    .reduce((total, row) => total + sign * (num(row.closing_debit) - num(row.closing_credit)), 0);
  const input = Math.max(0, sum("133", 1));
  const output = Math.max(0, sum("3331", -1));
  const deductible = Math.min(input, output);
  return { periodCode: String(period.code), input, output, deductible, payable: output - deductible, carryForward: input - deductible };
}

/** "Khấu trừ thuế GTGT": Nợ 33311 / Có 1331 for the deductible amount of the period. */
export async function saveVatDeduction(w: ApiWriter, date: unknown) {
  const vat = await vatPosition(w, date);
  if (vat.deductible <= 0) throw new FormDataError(`Kỳ ${vat.periodCode} không có số thuế GTGT cần khấu trừ.`);
  const [year, month] = vat.periodCode.split("-");
  const lastDay = toApiDate(`${new Date(Number(year), Number(month), 0).getDate()}/${month}/${year}`);
  return saveJournalVoucher(w, {
    postingDate: lastDay, docDate: lastDay, description: `Khấu trừ thuế GTGT tháng ${month}/${year}`, entryType: "ADJUSTMENT",
    rows: [{ debitAcc: "33311", creditAcc: "1331", amount: vat.deductible, desc: `Khấu trừ thuế GTGT tháng ${month}/${year}` }],
  });
}

/* ───────────────────────────── Danh mục ───────────────────────────── */

/** Request body for the directory forms whose fields differ from the generic code/name catalogs. */
export async function directoryInput(w: ApiWriter, name: string, values: Row): Promise<Row | null> {
  const text = (label: string) => String(values[label] ?? "").trim();
  if (name === "Đơn vị tính") {
    const unit = text("Đơn vị tính") || text("Tên");
    if (!unit) throw new FormDataError("Cần nhập đơn vị tính.");
    return { code: unitCode(unit), name: unit, symbol: unit, description: text("Mô tả"), measurement_type: "CUSTOM", decimal_places: 0 };
  }
  if (name === "Vật tư hàng hóa") {
    if (!text("Mã") || !text("Tên")) throw new FormDataError("Cần nhập mã và tên vật tư, hàng hóa.");
    const nature = text("Tính chất") || text("Loại");
    const unitText = text("Đơn vị tính chính");
    const units = await w.list("units");
    let unit = units.find((row) => [row.code, row.name, row.symbol].some((value) => String(value || "").toLowerCase() === unitText.toLowerCase()));
    if (!unit && unitText) {
      unit = await w.post("/api/v1/master-data/units-of-measure/", {
        code: unitCode(unitText), name: unitText, symbol: unitText, decimal_places: 0, measurement_type: "CUSTOM",
      });
    }
    const itemType = /dịch vụ/i.test(nature) ? "SERVICE" : /nguyên|vật liệu|vật tư/i.test(nature) ? "MATERIAL"
      : /thành phẩm/i.test(nature) ? "FINISHED_GOOD" : "GOODS";
    return {
      code: text("Mã"), name: text("Tên"), item_type: itemType, status: "ACTIVE",
      base_uom: unit?.id || units[0]?.id || null, track_inventory: itemType !== "SERVICE",
      purchase_price: num(text("Đơn giá mua cố định")) || null,
    };
  }
  if (name === "Tài khoản ngân hàng") {
    const number = text("Số tài khoản");
    const bankText = text("Tên ngân hàng").toLowerCase();
    if (!number || !bankText) throw new FormDataError("Cần nhập số tài khoản và tên ngân hàng.");
    const bank = (await w.list("banks")).find((row) => [row.code, row.short_name, row.name].some((value) => String(value || "").toLowerCase() === bankText)
      || String(row.name || "").toLowerCase().includes(bankText));
    if (!bank) throw new FormDataError(`Ngân hàng "${text("Tên ngân hàng")}" chưa có trong danh mục Ngân hàng.`);
    const company = await w.company();
    return {
      code: number, account_number: number, account_name: text("Chủ tài khoản") || company.legal_name || company.name,
      bank: bank.id, currency: (await w.currency()).id, status: "ACTIVE", account_type: "PAYMENT",
      bank_branch: text("Tên chi nhánh ngân hàng"), notes: text("Diễn giải"), account_scope: "COMPANY_SHARED",
      allow_receipt: true, allow_payment: true, gl_account: (await w.account("112", "TK tiền gửi")).id,
    };
  }
  if (name === "Nhân viên") {
    if (!text("Mã") || !text("Tên")) throw new FormDataError("Cần nhập mã và tên nhân viên.");
    const departments = await w.list("/api/v1/organization/departments/");
    const department = departments.find((row) => [row.code, row.name].includes(text("Đơn vị")));
    return {
      employee_code: text("Mã"), full_name: text("Tên"), status: "ACTIVE", identity_number: text("Số CCCD") || undefined,
      branch: department?.branch || (await w.branch()).id, department: department?.id || null,
    };
  }
  return null;
}

function unitCode(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "D")
    .toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30) || "DVT";
}

/** Vật tư, hàng hóa (MisaInventoryItemModal). */
export async function saveItem(w: ApiWriter, d: Row) {
  const code = String(d.code || "").trim();
  const name = String(d.name || "").trim();
  if (!code || !name) throw new FormDataError("Cần nhập mã và tên vật tư, hàng hóa.");
  const minimum = Number(d.minStockQty ?? 0);
  if (!Number.isFinite(minimum) || minimum < 0 || !/^\d+(?:\.\d{1,4})?$/.test(String(d.minStockQty ?? 0)))
    throw new FormDataError("Số lượng tồn tối thiểu phải là số không âm, tối đa 4 chữ số thập phân.");
  if (d.recordId) {
    const record = await w.patch(`/api/v1/master-data/items/${d.recordId}/`, {
      version: d.version, code, name, min_stock: String(minimum),
    });
    w.invalidate();
    return { record, message: `Đã cập nhật số lượng tồn tối thiểu của ${code}.` };
  }
  const nature = String(d.nature || d.type || "");
  const itemType = /dịch vụ/i.test(nature) ? "SERVICE" : /nguyên|vật liệu|vật tư/i.test(nature) ? "MATERIAL"
    : /thành phẩm/i.test(nature) ? "FINISHED_GOOD" : "GOODS";
  const units = await w.list("units");
  const unitText = String(d.unit || "").trim();
  let unit = units.find((row) => [row.code, row.name, row.symbol].some((value) => String(value || "").toLowerCase() === unitText.toLowerCase()));
  if (!unit && unitText) {
    unit = await w.post("/api/v1/master-data/units-of-measure/", {
      code: unitCode(unitText), name: unitText, symbol: unitText, decimal_places: 0, measurement_type: "COUNT",
    });
  }
  const record = await w.post("/api/v1/master-data/items/", {
    code, name, item_type: itemType, status: "ACTIVE",
    base_uom: unit?.id || units[0]?.id || null,
    track_inventory: itemType !== "SERVICE",
    min_stock: String(minimum),
    purchase_price: num(d.purchasePrice ?? d.unitPrice) || null,
    sales_price: num(d.salePrice ?? d.salesPrice) || null,
  });
  w.invalidate();
  return { record, message: `Đã lưu vật tư, hàng hóa ${code}.` };
}

/** The three kinds of "Chuyển kho" voucher (UC-INV-05) and their backend codes. */
export const TRANSFER_KIND_CODES: Record<string, string> = {
  "Xuất chuyển kho nội bộ": "INTERNAL",
  "Xuất kho kiêm vận chuyển nội bộ": "TRANSPORT",
  "Xuất kho gửi bán đại lý": "CONSIGNMENT",
};

/**
 * "Chuyển kho" voucher (UC-INV-05): every line names its source and destination warehouse.
 * "Cất" saves, uploads new attachments (`d.files`) and posts with submit-and-post, so a failed posting
 * leaves an editable draft. With `d.inTransit` the goods wait in the transit warehouse until received.
 */
export async function saveTransferVoucher(w: ApiWriter, d: Row, post = true) {
  const path = "/api/v1/inventory/transactions/";
  if (d.id && d.status === "PENDING_APPROVAL") throw new FormDataError("Chứng từ chuyển kho đang chờ duyệt, chưa thể ghi sổ.");
  if (d.id && d.status === "POSTED") throw new FormDataError("Chứng từ chuyển kho đã được ghi sổ.");
  if (d.id && ["CANCELLED", "REVERSED"].includes(d.status)) throw new FormDataError("Chứng từ chuyển kho đã bị hủy, không thể lưu hoặc ghi sổ.");
  const kind = TRANSFER_KIND_CODES[String(d.transferType)] || "INTERNAL";
  let record: Row;
  if (d.id && d.status === "APPROVED") {
    record = { id: d.id, number: d.code, status: d.status };
  } else {
    const number = String(d.code || "").trim();
    if (!number) throw new FormDataError("Vui lòng nhập số chứng từ.");
    const documentDate = parseReportDate(String(d.date || ""));
    const postingDate = parseReportDate(String(d.postingDate || "").slice(0, 10));
    if (!documentDate || !postingDate) throw new FormDataError("Vui lòng nhập ngày hợp lệ theo định dạng DD/MM/YYYY.");
    const rows: Row[] = d.lines || [];
    if (!rows.length || rows.every((row) => !String(row.itemCode || "").trim()))
      throw new FormDataError("Vui lòng chọn ít nhất một hàng hóa cần chuyển kho.");
    const [warehouses, items, units, accounts, parties] = await Promise.all([
      w.list("warehouses"), w.list("items"), w.list("units"), w.list("accounts"), w.list("parties"),
    ]);
    const warehouseOf = (name: unknown) => warehouses.find((entry) => entry.name === name || entry.code === name);
    const account = (code: unknown) => accounts.find((entry) => entry.code === String(code || "").trim() && entry.status === "ACTIVE" && entry.is_postable);
    const lines: Row[] = rows.map((row, index) => {
      const item = items.find((entry) => entry.code === String(row.itemCode || "").trim() && entry.status === "ACTIVE" && entry.track_inventory);
      if (!item) throw new FormDataError(`Dòng ${index + 1}: vui lòng chọn mã hàng hợp lệ.`);
      if (!String(row.sourceWarehouse || "").trim()) throw new FormDataError(`Dòng ${index + 1}: vui lòng chọn kho xuất cho hàng hóa.`);
      if (!String(row.destWarehouse || "").trim()) throw new FormDataError(`Dòng ${index + 1}: vui lòng chọn kho nhập cho hàng hóa.`);
      const source = warehouseOf(row.sourceWarehouse); const destination = warehouseOf(row.destWarehouse);
      if (!source || !destination || source.status !== "ACTIVE" || destination.status !== "ACTIVE")
        throw new FormDataError(`Dòng ${index + 1}: kho xuất hoặc kho nhập không hợp lệ.`);
      if (source.id === destination.id) throw new FormDataError(`Dòng ${index + 1}: kho nhập phải khác kho xuất.`);
      const uom = units.find((entry) => entry.name === row.unit || entry.code === row.unit || entry.symbol === row.unit) || units.find((entry) => entry.id === item.base_uom);
      if (!uom) throw new FormDataError(`Dòng ${index + 1}: đơn vị tính không hợp lệ.`);
      const quantity = Number(row.qty); const unitCost = Number(row.price || 0);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new FormDataError(`Dòng ${index + 1}: số lượng chuyển kho phải lớn hơn 0.`);
      if (!Number.isFinite(unitCost) || unitCost < 0) throw new FormDataError(`Dòng ${index + 1}: đơn giá chuyển kho không hợp lệ.`);
      const hasDebit = Boolean(String(row.debitAcc || "").trim()); const hasCredit = Boolean(String(row.creditAcc || "").trim());
      const debit = hasDebit ? account(row.debitAcc) : null; const credit = hasCredit ? account(row.creditAcc) : null;
      if (hasDebit !== hasCredit || hasDebit && (!debit || !credit) || kind === "CONSIGNMENT" && !debit)
        throw new FormDataError(`Dòng ${index + 1}: vui lòng chọn tài khoản hạch toán hợp lệ.`);
      return { line_no: index + 1, item: item.id, uom: uom.id, source_warehouse: source.id, destination_warehouse: destination.id,
        quantity: String(quantity), unit_cost: String(unitCost), debit_account: debit?.id || null, credit_account: credit?.id || null };
    });
    const partyCode = kind === "CONSIGNMENT" ? d.agentCode : kind === "TRANSPORT" ? d.receiverUnitCode : "";
    const party = partyCode ? parties.find((entry) => entry.code === String(partyCode).trim()) : null;
    if (partyCode && !party) throw new FormDataError("Đối tượng không có trong danh mục.");
    if (kind === "CONSIGNMENT" && !party) throw new FormDataError("Vui lòng chọn đại lý nhận hàng gửi bán.");
    const metadata: Row = { transfer_kind: kind, in_transit: kind !== "CONSIGNMENT" && Boolean(d.inTransit) };
    for (const [key, value] of Object.entries(d.metadata || {})) metadata[key] = String(value ?? "");
    const payload = { number, transaction_type: "TRANSFER", source_module: "INV_TRANSFER",
      source_warehouse: lines[0].source_warehouse, destination_warehouse: lines[0].destination_warehouse, branch: (await w.branch()).id,
      document_date: documentDate, transaction_date: postingDate, reason: String(d.description || "").trim(),
      delivery_person: String(d.transporterName || ""), supplier: party?.id || null,
      source_reference: String(d.reference || "").slice(0, 100), document_metadata: metadata, lines };
    try {
      record = d.id ? await w.patch(`${path}${d.id}/`, payload) : await w.post(path, payload);
    } catch (error) {
      throw new FormDataError(`Không thể lưu chứng từ chuyển kho. ${errorText(error)}`);
    }
  }
  const files: File[] = d.files || [];
  let uploaded = 0;
  for (const file of files) {
    try {
      record = await w.upload(`${path}${record.id}/attachments/`, file);
      uploaded += 1;
    } catch (error) {
      return { record, posted: false, uploaded,
        message: `Đã lưu chứng từ chuyển kho ${record.number} (Chưa ghi sổ) nhưng chưa tải được tệp ${file.name}: ${errorText(error)}` };
    }
  }
  if (!post) return { record, posted: false, uploaded, message: `Đã lưu chứng từ chuyển kho ${record.number} (Chưa ghi sổ).` };
  try {
    const result = await w.action(path, record.id, "submit-and-post");
    if (result.status !== "POSTED") {
      return { record: result, posted: false, uploaded, message: `Đã lưu Phiếu chuyển kho ${result.number}, đang chờ duyệt trước khi ghi sổ.` };
    }
    const transit = result.document_metadata?.receipt_status === "IN_TRANSIT" ? " Hàng đang vận chuyển, chờ kho nhận xác nhận." : "";
    return { record: result, posted: true, uploaded, message: `Đã lưu Phiếu chuyển kho ${result.number} thành công!${transit}` };
  } catch (error) {
    return { record, posted: false, uploaded,
      message: `Không thể ghi sổ chứng từ chuyển kho: ${errorText(error)} Chứng từ ${record.number} vẫn ở trạng thái Chưa ghi sổ.` };
  }
}

/** AF16: the receiving warehouse confirms the quantities that actually arrived. */
export async function receiveTransfer(w: ApiWriter, id: string, lines: { line: string; received: number }[], acceptDiscrepancy: boolean, reason: string) {
  if (lines.some((row) => !Number.isFinite(row.received) || row.received < 0)) throw new FormDataError("Số lượng thực nhận không hợp lệ.");
  const record = await w.action("/api/v1/inventory/transactions/", id, "receive", {
    lines: lines.map((row) => ({ line: row.line, received_quantity: String(row.received) })),
    accept_discrepancy: acceptDiscrepancy, reason,
  });
  const differences = (record.document_metadata?.discrepancies || []).length;
  return { record, message: differences
    ? `Đã xác nhận nhận hàng ${record.number} với ${differences} dòng chênh lệch.`
    : `Đã xác nhận nhận đủ hàng chuyển kho ${record.number}.` };
}

/** Reasons of UC-FA-06 as shown in the form, and their backend codes. */
export const REVALUATION_REASON_CODES: Record<string, string> = {
  "Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản": "UPGRADE",
  "Đánh giá lại theo quyết định của cơ quan nhà nước": "STATE_DECISION",
  "Đánh giá lại khi chia tách, hợp nhất, sáp nhập doanh nghiệp": "RESTRUCTURE",
  "Đánh giá lại khi chuyển đổi loại hình doanh nghiệp": "CONVERSION",
  "Lý do khác": "OTHER",
};

/** Backend messages without the "field:" prefixes the API error carries. */
export function plainApiError(error: unknown) {
  return errorText(error).replace(/(^|; )[a-z_]+: /g, "$1").replace(/(^|; )\d+: /g, "$1");
}

/**
 * "Đánh giá lại tài sản cố định" (UC-FA-06). Cất saves the document, uploads new attachments (`d.files`)
 * and posts it; the backend updates the asset cards, history and ledger together or not at all.
 */
export async function saveRevaluation(w: ApiWriter, d: Row, post = true) {
  const path = `${FIXED_ASSETS}revaluations/`;
  if (d.id && d.status === "POSTED") throw new FormDataError("Chứng từ đánh giá lại đã được ghi sổ.");
  if (d.id && d.status === "REVERSED") throw new FormDataError("Chứng từ đánh giá lại đã bỏ ghi sổ, không thể sửa.");
  const number = String(d.number || "").trim();
  if (!number) throw new FormDataError("Số chứng từ đánh giá lại không hợp lệ hoặc đã tồn tại.");
  const reason = REVALUATION_REASON_CODES[String(d.reason || "")] || "";
  if (!reason) throw new FormDataError("Vui lòng chọn lý do đánh giá lại tài sản.");
  const documentDate = parseReportDate(String(d.documentDate || ""));
  const postingDate = parseReportDate(String(d.postingDate || ""));
  if (!documentDate || !postingDate) throw new FormDataError("Vui lòng nhập ngày chứng từ và ngày hạch toán hợp lệ.");
  const recordDate = String(d.recordDate || "").trim() ? parseReportDate(String(d.recordDate)) : null;
  if (String(d.recordDate || "").trim() && !recordDate) throw new FormDataError("Ngày biên bản không hợp lệ. Vui lòng kiểm tra lại.");
  const rows: Row[] = (d.rows || []).filter((row: Row) => String(row.assetCode || "").trim());
  if (!rows.length) throw new FormDataError("Vui lòng chọn ít nhất một tài sản cần đánh giá lại.");
  const [assets, accounts, parties, expenseItems, departments] = await Promise.all([
    w.list("assets"), w.list("accounts"), w.list("parties"),
    w.list("/api/v1/master-data/expense-items/"), w.list("/api/v1/organization/departments/"),
  ]);
  const account = (code: unknown) => {
    const wanted = String(code || "").trim();
    if (!wanted) return null;
    const found = accounts.find((row) => row.code === wanted && row.status === "ACTIVE" && row.is_postable);
    if (!found) throw new FormDataError(`Tài khoản hạch toán không phù hợp với nghiệp vụ đánh giá lại. (TK ${wanted})`);
    return found.id as string;
  };
  const lines = rows.map((row) => {
    const asset = assets.find((entry) => entry.code === String(row.assetCode).trim());
    if (!asset) throw new FormDataError(`Tài sản ${row.assetCode} không hợp lệ.`);
    const months = Number(row.monthsAfter);
    if (!Number.isInteger(months) || months < 0) throw new FormDataError("Thời gian sử dụng còn lại sau điều chỉnh không hợp lệ.");
    const law = row.monthlyDeprLawAfter === "" || row.monthlyDeprLawAfter === null || row.monthlyDeprLawAfter === undefined ? null : Number(row.monthlyDeprLawAfter);
    return {
      asset: asset.id,
      before_original_cost: String(num(row.origBefore)), after_original_cost: String(num(row.origAfter)),
      before_remaining_periods: Math.round(num(row.monthsBefore)), after_remaining_periods: months,
      before_accumulated_depreciation: String(num(row.deprBefore)), after_accumulated_depreciation: String(num(row.deprAfter)),
      before_depreciable_value: String(num(row.valBefore)), after_depreciable_value: String(num(row.valAfter)),
      monthly_depreciation_after: String(Math.round(num(row.monthlyDeprAfter))),
      tax_monthly_depreciation_after: law === null ? null : String(law),
      expense_account: account(row.costAccount), revaluation_account: account(row.revalAccount),
    };
  });
  const entries = (d.entries || []).filter((row: Row) => String(row.debitAccount || "").trim() || String(row.creditAccount || "").trim() || num(row.amount))
    .map((row: Row) => {
      const party = String(row.objectCode || "").trim() ? parties.find((entry) => entry.code === String(row.objectCode).trim()) : null;
      if (String(row.objectCode || "").trim() && !party) throw new FormDataError(`Đối tượng ${row.objectCode} không có trong danh mục.`);
      const item = String(row.costItem || "").trim() ? expenseItems.find((entry) => entry.code === String(row.costItem).trim()) : null;
      if (String(row.costItem || "").trim() && !item) throw new FormDataError(`Khoản mục chi phí ${row.costItem} không có trong danh mục.`);
      const department = String(row.dept || "").trim() ? departments.find((entry) => entry.name === row.dept || entry.code === row.dept) : null;
      const debit = account(row.debitAccount); const credit = account(row.creditAccount);
      if (!debit || !credit || !(num(row.amount) > 0)) throw new FormDataError("Số tiền hạch toán không khớp với kết quả đánh giá lại.");
      return { description: String(row.desc || ""), debit_account: debit, credit_account: credit, amount: String(num(row.amount)),
        party: party?.id || null, expense_item: item?.id || null, department: department?.id || null };
    });
  const members = (d.members || []).filter((row: Row) => [row.name, row.title, row.rep].some((value) => String(value || "").trim()))
    .map((row: Row) => ({ full_name: String(row.name || "").trim(), title: String(row.title || "").trim(), representing: String(row.rep || "").trim() }));
  const payload = {
    number, reason, record_number: String(d.recordNumber || "").trim(), record_date: recordDate,
    document_date: documentDate, posting_date: postingDate, conclusion: String(d.conclusion || "").trim(),
    references: d.references || [], cost_booked_at_source: Boolean(d.costBookedAtSource), source_reference: String(d.sourceReference || "").trim(),
    idempotency_key: d.id ? undefined : d.idempotencyKey, members, lines, entries,
  };
  let record: Row;
  try {
    record = d.id ? await w.patch(`${path}${d.id}/`, payload) : await w.post(path, payload);
  } catch (error) {
    throw new FormDataError(plainApiError(error));
  }
  let uploaded = 0;
  for (const file of (d.files || []) as File[]) {
    try {
      record = await w.upload(`${path}${record.id}/attachments/`, file);
      uploaded += 1;
    } catch (error) {
      return { record, posted: false, uploaded, message: `Đã lưu chứng từ ${record.number} (Chưa ghi sổ) nhưng chưa tải được tệp ${file.name}: ${plainApiError(error)}` };
    }
  }
  if (!post || record.status === "POSTED") return { record, posted: record.status === "POSTED", uploaded, message: `Đã lưu chứng từ đánh giá lại ${record.number}.` };
  try {
    record = await w.action(path, record.id, "post");
    return { record, posted: true, uploaded, message: "Đánh giá lại tài sản cố định thành công." };
  } catch (error) {
    return { record, posted: false, uploaded, message: `${plainApiError(error)} Chứng từ ${record.number} vẫn ở trạng thái Chưa ghi sổ.` };
  }
}

/** AF28: unpost a revaluation; the backend restores the asset values and reverses the entry. */
export async function reverseRevaluation(w: ApiWriter, id: string, reason: string) {
  if (!reason.trim()) throw new FormDataError("Vui lòng nhập lý do bỏ ghi sổ.");
  try {
    const record = await w.action(`${FIXED_ASSETS}revaluations/`, id, "reverse", { reason });
    return { record, message: `Đã bỏ ghi sổ chứng từ đánh giá lại ${record.number}.` };
  } catch (error) {
    throw new FormDataError(plainApiError(error));
  }
}
