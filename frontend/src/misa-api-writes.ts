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
  const wanted = String(name || "").trim();
  if (!wanted) throw new FormDataError("Vui lòng chọn loại tài sản hợp lệ.");
  const rows = await w.list("assetCategories");
  const found = rows.find((row) => [row.id, row.code, row.name].some((value) => String(value || "").toLowerCase() === wanted.toLowerCase()));
  if (found) return found;
  return w.post(`${FIXED_ASSETS}categories/`, {
    code: unitCode(wanted).slice(0, 20), name: wanted, asset_type: "FIXED_ASSET", default_method: "STRAIGHT_LINE",
    asset_account: (await w.account(accounts.cost || "211", "TK nguyên giá")).id,
    accumulated_account: (await w.account(accounts.depreciation || "214", "TK hao mòn")).id,
    expense_account: (await w.account(accounts.expense || "642", "TK chi phí khấu hao")).id,
  });
}

async function resolveOrEnsureDepartment(w: ApiWriter, deptInput: unknown) {
  const wanted = String(deptInput || "").trim();
  if (!wanted) throw new FormDataError("Vui lòng chọn đơn vị sử dụng hợp lệ.");
  const depts = await w.list("/api/v1/organization/departments/");
  const found = depts.find((row) => [row.id, row.code, row.name].some((val) => String(val || "").toLowerCase() === wanted.toLowerCase()));
  if (found) return found;
  const branch = await w.branch();
  const baseCode = unitCode(wanted).slice(0, 20) || "PB";
  const code = depts.some((row) => String(row.code).toUpperCase() === baseCode) ? `${baseCode}${depts.length + 1}` : baseCode;
  const created = await w.post("/api/v1/organization/departments/", {
    branch: branch.id, code, name: wanted, status: "ACTIVE",
  });
  w.invalidate();
  return created;
}

/** AF04: "Thêm loại tài sản" từ nút (+) trên form Ghi tăng TSCĐ. */
export async function saveFixedAssetCategory(w: ApiWriter, d: Row) {
  const code = String(d.code || "").trim();
  const name = String(d.name || "").trim();
  if (!code || !name) throw new FormDataError("Vui lòng nhập mã và tên loại tài sản.");
  const assetAcc = d.assetAccount ? (await w.account(d.assetAccount, "TK nguyên giá")).id : null;
  const deprAcc = d.deprAccount ? (await w.account(d.deprAccount, "TK khấu hao")).id : null;
  const expAcc = d.expenseAccount ? (await w.account(d.expenseAccount, "TK chi phí")).id : null;
  const record = await w.post(`${FIXED_ASSETS}categories/`, {
    code,
    name,
    asset_type: "FIXED_ASSET",
    default_method: String(d.defaultMethod || "STRAIGHT_LINE"),
    default_periods: Math.max(1, Math.round(num(d.defaultPeriods) || 60)),
    asset_account: assetAcc,
    accumulated_account: deprAcc,
    expense_account: expAcc,
    is_active: true,
  });
  w.invalidate();
  return { record, message: `Đã thêm loại tài sản ${record.code} - ${record.name}.` };
}

/** UC-FA-01: "Ghi tăng TSCĐ" (acquire = true) and AF18 "Khai báo TSCĐ đầu kỳ" (acquire = false). */
export async function saveFixedAsset(w: ApiWriter, d: Row, acquire: boolean) {
  const voucherNo = String(d.voucherNo || "").trim();
  if (!voucherNo) throw new FormDataError("Vui lòng nhập số chứng từ ghi tăng.");
  const acqDateRaw = String(d.voucherDate || d.startDate || "").trim();
  if (!acqDateRaw) throw new FormDataError("Vui lòng nhập Ngày ghi tăng hợp lệ theo định dạng DD/MM/YYYY.");
  const code = String(d.code || "").trim();
  if (!code) throw new FormDataError("Vui lòng nhập mã tài sản.");
  const name = String(d.name || "").trim();
  if (!name) throw new FormDataError("Vui lòng nhập tên tài sản cố định.");
  const cost = num(d.originalCost);
  if (cost <= 0) throw new FormDataError("Nguyên giá tài sản phải lớn hơn 0 và có căn cứ hợp lệ.");

  const noDepr = Boolean(d.noDepr);
  const firstAllocAcc = Array.isArray(d.allocations) && d.allocations[0]?.expenseAccount ? d.allocations[0].expenseAccount : d.expenseAccount;
  const category = await assetCategory(w, d.category, {
    cost: d.costAccount || "211",
    depreciation: d.deprAccount || "214",
    expense: firstAllocAcc || "642",
  });
  const department = await resolveOrEnsureDepartment(w, d.dept);
  const branch = await w.branch();

  const rawAllocations = Array.isArray(d.allocations) ? d.allocations : [];
  const allocations = [];
  if (!noDepr) {
    for (const row of rawAllocations) {
      const rowDept = await resolveOrEnsureDepartment(w, row.dept || d.dept);
      const expAcc = await w.account(row.expenseAccount, "TK chi phí");
      allocations.push({
        department_id: rowDept.id,
        department_name: rowDept.name,
        rate: String(num(row.rate)),
        expense_account: expAcc.code,
        expense_item: String(row.expenseItem || "").trim(),
        cost_center: String(row.costCenter || "").trim(),
      });
    }
  }

  const origins = (Array.isArray(d.origins) ? d.origins : [])
    .filter((row: Row) => String(row.documentNumber || "").trim() || num(row.amount) > 0)
    .map((row: Row) => ({
      origin_type: String(row.originType || "Mua sắm mới trong nước").trim(),
      document_number: String(row.documentNumber || "").trim(),
      document_date: String(row.documentDate || acqDateRaw).trim(),
      amount: String(num(row.amount)),
      partner_code: String(row.partnerCode || "").trim(),
      partner_name: String(row.partnerName || "").trim(),
      source_document_id: String(row.sourceDocumentId || "").trim(),
      allow_multiple_assets: Boolean(row.allowMultipleAssets),
    }));

  const components = (Array.isArray(d.components) ? d.components : [])
    .filter((row: Row) => String(row.name || "").trim())
    .map((row: Row) => ({
      name: String(row.name).trim(),
      unit: String(row.unit || "").trim(),
      quantity: String(num(row.quantity) || 1),
      value: String(num(row.value) || 0),
    }));

  const accessories = (Array.isArray(d.accessories) ? d.accessories : [])
    .filter((row: Row) => String(row.name || "").trim())
    .map((row: Row) => ({
      name: String(row.name).trim(),
      unit: String(row.unit || "").trim(),
      quantity: String(num(row.quantity) || 1),
      value: String(num(row.value) || 0),
    }));

  const assetAccObj = await w.account(d.costAccount, "TK nguyên giá");
  const deprAccObj = !noDepr ? await w.account(d.deprAccount, "TK khấu hao") : null;

  const payload: Row = {
    voucher_no: voucherNo,
    acquisition_date: acqDateRaw,
    category: category.id,
    code,
    department: department.id,
    branch: branch.id,
    name,
    no_depreciation: noDepr,
    asset_account: assetAccObj.code,
    accumulated_account: deprAccObj ? deprAccObj.code : "",
    original_cost: String(cost),
    depreciable_amount: String(noDepr ? 0 : num(d.deprCostValue || cost)),
    accumulated_depreciation: String(num(d.depreciatedAmount || 0)),
    useful_life_value: String(noDepr ? 0 : num(d.useDuration ?? d.years)),
    useful_life_unit: /tháng|month/i.test(String(d.useDurationUnit || "")) ? "MONTH" : "YEAR",
    in_service_date: String(d.deprStartDate || d.startDate || acqDateRaw).trim(),
    monthly_depreciation_rate: d.rateMonth !== undefined ? String(num(d.rateMonth)) : undefined,
    annual_depreciation_rate: d.rateYear !== undefined ? String(num(d.rateYear)) : undefined,
    monthly_depreciation_amount: d.deprMonthValue !== undefined ? String(num(d.deprMonthValue)) : undefined,
    annual_depreciation_amount: d.deprYearValue !== undefined ? String(num(d.deprYearValue)) : undefined,
    cit_cap_enabled: Boolean(d.limitTaxLaw),
    cit_depreciable_cap: String(num(d.taxLawValue || 0)),
    cit_monthly_cap: String(num(d.taxLawMonthValue || 0)),
    allocations,
    origins,
    origin_variance_reason: String(d.originVarianceReason || "").trim(),
    components,
    accessories,
    country_of_origin: String(d.countryOfOrigin || "").trim(),
    manufacture_year: d.manufactureYear ? Number(d.manufactureYear) : null,
    source_module: acquire ? "FA" : "OPENING",
    allow_prior_depreciation: !acquire || Boolean(d.allowPriorDepreciation),
  };

  const result = await w.post(`${FIXED_ASSETS}assets/acquire/`, payload);
  w.invalidate();
  return {
    record: result.asset,
    transaction: result.transaction,
    message: acquire
      ? (result.message || "Ghi tăng tài sản cố định thành công.")
      : `Đã khai báo TSCĐ đầu kỳ ${code} - ${name} thành công.`,
  };
}

/** UC-FA-02: "Cập nhật thông tin tài sản" (không tạo tài sản/chứng từ mới, giữ nguyên số liệu kế toán). */
export async function updateFixedAssetInfo(w: ApiWriter, d: Row) {
  let assetId = String(d.id || "").trim();
  if (!assetId) {
    const code = String(d.code || "").trim();
    const assets = await w.list("assets");
    const found = assets.find((row) => String(row.code || "") === code);
    if (!found) throw new FormDataError("Không tìm thấy thông tin tài sản cố định.");
    assetId = String(found.id);
  }

  const components = Array.isArray(d.components)
    ? d.components
        .filter((row: Row) => String(row.name || "").trim())
        .map((row: Row) => ({
          name: String(row.name).trim(),
          unit: String(row.unit || "").trim(),
          quantity: String(num(row.quantity) || 1),
          value: String(num(row.value) || 0),
        }))
    : undefined;

  const accessories = Array.isArray(d.accessories)
    ? d.accessories
        .filter((row: Row) => String(row.name || "").trim())
        .map((row: Row) => ({
          name: String(row.name).trim(),
          unit: String(row.unit || "").trim(),
          quantity: String(num(row.quantity) || 1),
          value: String(num(row.value) || 0),
        }))
    : undefined;

  const origins = Array.isArray(d.origins)
    ? d.origins
        .filter((row: Row) => String(row.documentNo || row.documentNumber || row.document_number || "").trim() || num(row.amount) > 0)
        .map((row: Row) => ({
          origin_type: String(row.sourceType || row.originType || row.origin_type || "Mua sắm mới trong nước").trim(),
          document_number: String(row.documentNo || row.documentNumber || row.document_number || "").trim(),
          document_date: String(row.documentDate || row.document_date || "").trim(),
          amount: String(num(row.amount)),
          partner_name: String(row.supplier || row.partnerName || row.partner_name || "").trim(),
        }))
    : undefined;

  const payload: Row = {
    name: d.name !== undefined ? String(d.name) : undefined,
    country_of_origin: d.countryOfOrigin !== undefined ? String(d.countryOfOrigin) : undefined,
    manufacture_year: d.manufactureYear !== undefined && String(d.manufactureYear).trim() !== "" ? d.manufactureYear : null,
    serial_number: d.serialNumber !== undefined ? String(d.serialNumber) : undefined,
    description: d.description !== undefined ? String(d.description) : undefined,
    ...(components !== undefined ? { components } : {}),
    ...(accessories !== undefined ? { accessories } : {}),
    ...(origins !== undefined ? { origins } : {}),
    update_reason: String(d.updateReason || "").trim(),
    ...(d.version !== undefined ? { version: d.version } : {}),
    ...(d.expectedStatus ? { expected_status: d.expectedStatus } : {}),
  };

  const result = await w.action(`${FIXED_ASSETS}assets/`, assetId, "update-info", payload);
  w.invalidate();
  return {
    record: result.asset,
    changes: result.changes,
    noChanges: Boolean(result.no_changes),
    message: result.message || "Cập nhật thông tin tài sản thành công.",
  };
}

/** UC-FA-02: Lấy chi tiết tài sản + lịch sử giao dịch + Audit Log thay đổi thông tin. */
export async function fetchFixedAssetHistory(w: ApiWriter, assetId: string) {
  return await w.get(`${FIXED_ASSETS}assets/${encodeURIComponent(assetId)}/history/`);
}

/** UC-FA-02: Đối chiếu hạch toán TSCĐ với chứng từ nguồn và Sổ cái. */
export async function reconcileFixedAssetAccounting(w: ApiWriter, assetIdOrCode: string) {
  let assetId = String(assetIdOrCode || "").trim();
  if (!assetId) throw new FormDataError("Không tìm thấy mã tài sản để đối chiếu.");
  if (!assetId.includes("-")) {
    const assets = await w.list("assets");
    const found = assets.find((row) => String(row.code || "") === assetId);
    if (!found) throw new FormDataError(`Không tìm thấy hồ sơ TSCĐ ${assetId} trên hệ thống.`);
    assetId = String(found.id);
  }
  const resp = await w.action(`${FIXED_ASSETS}assets/`, assetId, "reconcile", {});
  return {
    record: resp,
    message: String(resp?.message || "Đã đối chiếu dữ liệu hạch toán TSCĐ với Sổ cái."),
  };
}

/** UC-FA-10: Lấy danh sách chứng từ nguồn đủ điều kiện ghi tăng CCDC (Xuất kho/Mua hàng & Ghi giảm TSCĐ chuyển sang CCDC). */
export async function fetchToolSourceVouchers(w: ApiWriter, sourceType?: string) {
  const qs = sourceType ? `&source_type=${encodeURIComponent(sourceType)}` : "";
  return await w.get(`${FIXED_ASSETS}assets/tool-source-vouchers/?_=${Date.now()}${qs}`);
}

/** UC-FA-10 (Main Flow A): Ghi tăng một CCDC qua endpoint /api/v1/fixed-assets/assets/acquire-tool/ (với fallback tương thích). */
export async function saveToolAsset(w: ApiWriter, d: Row) {
  const code = String(d.code || "").trim();
  const name = String(d.name || "").trim();
  const cost = num(d.originalCost);
  const quantity = num(d.quantity) || 1;
  const periods = Math.round(num(d.allocationMonths) || 1);
  const unitPrice = d.unitPrice !== undefined ? num(d.unitPrice) : (quantity > 0 ? cost / quantity : cost);
  const allowZeroCost = Boolean(d.allowZeroCost) || String(d.sourceType || "").includes("TSCĐ") || String(d.sourceType || "") === "FA_DISPOSAL";

  if (!code) throw new FormDataError("Mã CCDC không hợp lệ hoặc đã tồn tại.");
  if (!name) throw new FormDataError("Vui lòng nhập tên công cụ dụng cụ.");
  if (!(quantity > 0)) throw new FormDataError("Số lượng ghi tăng phải lớn hơn 0.");
  if ((!allowZeroCost && !(cost > 0)) || cost < 0) {
    throw new FormDataError("Đơn giá hoặc thành tiền CCDC không hợp lệ. Vui lòng kiểm tra lại.");
  }
  if (!(periods > 0)) throw new FormDataError("Số kỳ phân bổ phải là số nguyên lớn hơn 0.");

  // If UC-FA-10 structured departmentAllocations or allocations are provided, use the dedicated UC-FA-10 endpoint
  const deptRows = Array.isArray(d.departmentAllocations)
    ? d.departmentAllocations.filter((r: Row) => String(r.code || r.department_code || r.name || r.department_name || "").trim())
    : [];
  const allocRows = Array.isArray(d.allocations)
    ? d.allocations.filter((r: Row) => String(r.targetCode || r.target_code || r.targetName || r.target_name || r.costAccount || r.expense_account || "").trim())
    : [];

  if (deptRows.length > 0 || allocRows.length > 0 || d.useUc10Endpoint) {
    const resp = await w.post(`${FIXED_ASSETS}assets/acquire-tool/`, {
      voucher_no: String(d.voucherNo || "").trim() || undefined,
      acquisition_date: String(d.startDate || d.acquisitionDate || "").trim(),
      start_allocation_date: String(d.startAllocationDate || d.startDate || "").trim() || undefined,
      code,
      name,
      category_name: String(d.category || "Công cụ dụng cụ").trim(),
      group_name: String(d.group || d.category || "Công cụ dụng cụ").trim(),
      reason: String(d.reason || `Ghi tăng CCDC ${code}`),
      unit: String(d.unit || "Cái").trim(),
      quantity: String(quantity),
      unit_price: String(unitPrice),
      original_cost: String(cost),
      useful_life_periods: periods,
      periodic_allocation_amount: d.periodicAllocationAmount !== undefined ? String(num(d.periodicAllocationAmount)) : undefined,
      waiting_account: String(d.waitingAccount || "242").trim(),
      suspend_allocation: Boolean(d.stopAllocation ?? d.suspendAllocation ?? false),
      suspend_reason: String(d.suspendReason || "Tạm dừng phân bổ theo thiết lập ban đầu"),
      source_type: String(d.sourceType || "STOCK_ISSUE"),
      source_voucher_no: String(d.sourceVoucherNo || ""),
      source_voucher_date: String(d.sourceVoucherDate || d.startDate || ""),
      source_gl_posted: d.sourceGlPosted !== undefined ? Boolean(d.sourceGlPosted) : true,
      credit_account: String(d.creditAccount || "153"),
      detailed_description: String(d.detailedDescription || d.reason || ""),
      technical_specs: d.technicalSpecs || {},
      origins: Array.isArray(d.origins) ? d.origins : undefined,
      department_allocations: deptRows.map((r: Row) => ({
        code: String(r.code || r.department_code || "").trim(),
        name: String(r.name || r.department_name || "").trim(),
        quantity: String(num(r.qty ?? r.quantity)),
      })),
      allocations: allocRows.map((r: Row) => ({
        target_code: String(r.targetCode || r.target_code || "").trim(),
        target_name: String(r.targetName || r.target_name || "").trim(),
        rate: String(num(r.rate)),
        expense_account: String(r.costAccount || r.expense_account || "6422").trim(),
        cost_item: String(r.costItem || r.cost_item || "").trim(),
        stats_code: String(r.statCode || r.stats_code || "").trim(),
      })),
    });
    return {
      record: resp.asset || resp,
      transaction: resp.transaction,
      message: resp.message || "Đã ghi tăng công cụ dụng cụ thành công.",
    };
  }

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

/** UC-FA-10 (AF01): Ghi tăng CCDC hàng loạt qua endpoint /api/v1/fixed-assets/assets/acquire-tools-batch/. */
export async function saveToolAssetBatch(w: ApiWriter, d: Row) {
  const items = Array.isArray(d.items) ? d.items : [];
  if (!items.length) {
    throw new FormDataError("Vui lòng nhập đầy đủ thông tin cho các dòng CCDC ghi tăng.");
  }
  const resp = await w.post(`${FIXED_ASSETS}assets/acquire-tools-batch/`, {
    source_type: String(d.sourceType || "STOCK_ISSUE"),
    items: items.map((item: Row) => ({
      code: String(item.code || "").trim(),
      name: String(item.name || "").trim(),
      category_name: String(item.category || item.group || "Công cụ dụng cụ").trim(),
      group_name: String(item.group || item.category || "Công cụ dụng cụ").trim(),
      reason: String(item.reason || "").trim(),
      unit: String(item.unit || "Cái").trim(),
      quantity: String(num(item.qty ?? item.quantity) || 1),
      unit_price: String(num(item.price ?? item.unitPrice)),
      original_cost: String(num(item.amount ?? item.originalCost) || (num(item.price) * num(item.qty))),
      acquisition_date: String(item.date || item.acquisitionDate || "").trim(),
      voucher_no: String(item.voucherNo || "").trim(),
      useful_life_periods: Math.round(num(item.allocMonths ?? item.usefulLifePeriods) || 12),
      waiting_account: String(item.waitingAccount || "242").trim(),
      department_allocations: Array.isArray(item.departmentAllocations)
        ? item.departmentAllocations.map((r: Row) => ({
            code: String(r.code || "").trim(),
            name: String(r.name || "").trim(),
            quantity: String(num(r.qty ?? r.quantity)),
          }))
        : [],
      allocations: Array.isArray(item.allocations)
        ? item.allocations.map((r: Row) => ({
            target_code: String(r.targetCode || r.target_code || "").trim(),
            target_name: String(r.targetName || r.target_name || "").trim(),
            rate: String(num(r.rate)),
            expense_account: String(r.costAccount || r.expense_account || "6422").trim(),
            cost_item: String(r.costItem || r.cost_item || "").trim(),
            stats_code: String(r.statCode || r.stats_code || "").trim(),
          }))
        : [],
    })),
  });
  return {
    record: resp,
    message: resp.message || `Đã ghi tăng hàng loạt thành công ${resp.count || items.length} CCDC.`,
  };
}

/** UC-FA-03: Preview depreciation calculation for a given month/year. */
export async function previewDepreciationPeriod(w: ApiWriter, d: Row) {
  const year = Number(d.year);
  const month = Number(d.month);
  if (!year || !month || month < 1 || month > 12) {
    throw new FormDataError("Kỳ tính khấu hao không hợp lệ. Vui lòng kiểm tra lại.");
  }
  const resp = await w.post(`${FIXED_ASSETS}calculations/preview/`, {
    month,
    year,
    prorate_by_days: Boolean(d.prorateByDays ?? d.prorate_by_days ?? false),
  });
  return { record: resp, message: `Đã tải dữ liệu tính khấu hao kỳ ${String(month).padStart(2, "0")}/${year}.` };
}

/** UC-FA-03: Save & optionally post a Fixed Asset Depreciation Calculation Voucher. */
export async function saveDepreciationVoucher(w: ApiWriter, d: Row) {
  const year = Number(d.year);
  const month = Number(d.month);
  if (!year || !month || month < 1 || month > 12) {
    throw new FormDataError("Kỳ tính khấu hao không hợp lệ. Vui lòng kiểm tra lại.");
  }
  const voucherNo = String(d.voucherNo || d.voucher_no || "").trim();
  if (!voucherNo) {
    throw new FormDataError("Vui lòng nhập số chứng từ tính khấu hao.");
  }
  const resp = await w.post(`${FIXED_ASSETS}calculations/save-voucher/`, {
    month,
    year,
    voucher_no: voucherNo,
    voucher_date: d.voucherDate ? isoDate(d.voucherDate) : undefined,
    posting_date: d.postingDate ? isoDate(d.postingDate) : undefined,
    description: d.reason || d.description || `Khấu hao TSCĐ tháng ${String(month).padStart(2, "0")} năm ${year}`,
    reference: d.reference || "",
    prorate_by_days: Boolean(d.prorateByDays ?? d.prorate_by_days ?? false),
    post_now: d.postNow !== undefined ? Boolean(d.postNow) : true,
    recalculate: Boolean(d.recalculate ?? false),
    idempotency_key: d.idempotencyKey || undefined,
    lines: Array.isArray(d.lines) ? d.lines : undefined,
    allocations: Array.isArray(d.allocations) ? d.allocations : undefined,
    accounting_entries: Array.isArray(d.accountingEntries) ? d.accountingEntries : undefined,
    attachments: Array.isArray(d.attachments) ? d.attachments : undefined,
  });
  return {
    record: resp.run || resp,
    message: resp.message || `Đã lưu chứng từ tính khấu hao ${voucherNo} thành công!`,
  };
}

/** UC-FA-04: Post (Ghi sổ) an unposted (CALCULATED) depreciation voucher. */
export async function postDepreciationVoucher(w: ApiWriter, id: string, payload: Row = {}) {
  const resp = await w.action(`${FIXED_ASSETS}calculations/`, id, "post", payload);
  return {
    record: resp,
    message: resp.message || "Ghi sổ chứng từ khấu hao thành công.",
  };
}

/** UC-FA-03 AF14: Unpost (Bỏ ghi sổ) a posted depreciation voucher. */
export async function unpostDepreciationVoucher(w: ApiWriter, id: string, reason = "Bỏ ghi sổ chứng từ tính khấu hao") {
  const resp = await w.action(`${FIXED_ASSETS}calculations/`, id, "unpost", { reason });
  return {
    record: resp,
    message: resp.message || `Đã bỏ ghi sổ chứng từ tính khấu hao ${resp.number || ""}.`,
  };
}

/** UC-FA-03 Section 5: Cancel an unposted depreciation voucher. */
export async function cancelDepreciationVoucher(w: ApiWriter, id: string, reason = "Hủy chứng từ tính khấu hao") {
  const resp = await w.action(`${FIXED_ASSETS}calculations/`, id, "cancel", { reason });
  return {
    record: resp,
    message: resp.message || `Đã hủy chứng từ tính khấu hao ${resp.number || ""}.`,
  };
}

/** UC-FA-03 / UC-FA-04: Xuất khẩu bảng phân bổ chi phí khấu hao TSCĐ. */
export async function exportDepreciationAllocation(w: ApiWriter, id: string) {
  const resp = await w.get(`${FIXED_ASSETS}calculations/${encodeURIComponent(id)}/export-allocation/?_=${Date.now()}`);
  return {
    record: resp,
    message: String(resp?.message || "Đã xuất bảng phân bổ khấu hao TSCĐ."),
  };
}

/** "Tính khấu hao TSCĐ" for a month: opens the FA period if needed, calculates, then posts. */
export async function saveDepreciation(w: ApiWriter, d: Row, calculationType: "DEPRECIATION" | "ALLOCATION" = "DEPRECIATION") {
  if (calculationType === "DEPRECIATION") {
    return saveDepreciationVoucher(w, d);
  }
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
    number: await nextVoucherNumber(w, path, "PBCC", d.voucherNo), calculation_type: calculationType,
    period_code: code, period_start: start, period_end: end,
  });
  record = await w.action(path, record.id, "calculate", { version: record.version });
  try {
    record = await w.action(path, record.id, "post", { version: record.version });
  } catch (error) {
    return { record, message: `Đã tính phân bổ CCDC kỳ ${code} (${record.number}), chưa ghi sổ: ${errorText(error)}` };
  }
  return { record, message: `Đã tính và ghi sổ phân bổ CCDC kỳ ${code} (${record.number}).` };
}

/** UC-FA-05: Điều chuyển tài sản cố định nội bộ (1..N tài sản, đầy đủ thông tin bàn giao & tập hợp chi phí). */
export async function saveFixedAssetTransfer(w: ApiWriter, d: Row) {
  const rows = (d.rows || d.lines || []).filter((row: Row) => String(row.assetCode || row.asset_code || row.asset_id || "").trim());
  if (!rows.length) {
    throw new FormDataError("Vui lòng chọn ít nhất một tài sản cần điều chuyển.");
  }
  const assets = await w.list("assets");
  const departments = await w.list("/api/v1/organization/departments/");
  const lines = rows.map((row: Row) => {
    const codeStr = String(row.assetCode || row.asset_code || "").trim();
    const asset = assets.find((item) => item.code === codeStr || String(item.id) === String(row.asset_id || ""));
    const toDeptStr = String(row.toDept || row.to_department || "").trim();
    const targetDept = departments.find((dept) => [dept.code, dept.name, String(dept.id)].includes(toDeptStr));
    return {
      asset_id: asset?.id || row.asset_id || "",
      asset_code: codeStr,
      from_department: String(row.fromDept || row.from_department || ""),
      to_department: targetDept ? targetDept.id : toDeptStr,
      sales_contract: String(row.contract || row.sales_contract || "").trim(),
      sales_order: String(row.order || row.sales_order || "").trim(),
      project: String(row.project || "").trim(),
      expense_item: String(row.costItem || row.expense_item || "").trim(),
      cost_object: String(row.costObj || row.cost_object || "").trim(),
    };
  });

  const payload: Row = {
    company: w.companyId,
    voucher_no: String(d.voucherNo || d.voucher_no || "").trim(),
    transaction_date: toApiDate(d.date || d.transaction_date),
    deliverer: String(d.deliverer || d.sender || "").trim(),
    receiver: String(d.receiver || "").trim(),
    reason: String(d.reason || "").trim(),
    reference: String(d.reference || "").trim(),
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
    lines,
  };
  const record = await w.post(`${FIXED_ASSETS}transactions/transfer/`, payload);
  return {
    record,
    message: String(record?.message || "Điều chuyển tài sản cố định thành công."),
  };
}

/** UC-FA-06: Đánh giá lại tài sản cố định (nâng cấp / đánh giá lại theo quyết định / điều chỉnh giá trị & thời gian sử dụng còn lại). */
export async function saveFixedAssetRevaluation(w: ApiWriter, d: Row) {
  const rows = (d.rows || d.items || d.lines || []).filter((row: Row) =>
    String(row.assetCode || row.asset_code || row.asset_id || "").trim()
  );
  if (!rows.length) {
    throw new FormDataError("Vui lòng chọn ít nhất một tài sản cần đánh giá lại.");
  }
  const assets = await w.list("assets");
  const items = rows.map((row: Row) => {
    const codeStr = String(row.assetCode || row.asset_code || "").trim();
    const asset = assets.find((item) => item.code === codeStr || String(item.id) === String(row.asset_id || ""));
    return {
      asset_id: asset?.id || row.asset_id || "",
      asset_code: codeStr,
      orig_after: String(num(row.origAfter ?? row.orig_after ?? row.origBefore ?? 0)),
      depr_after: String(num(row.deprAfter ?? row.depr_after ?? row.deprBefore ?? 0)),
      months_after: Math.round(num(row.monthsAfter ?? row.months_after ?? row.monthsBefore ?? 0)),
      val_after: String(num(row.valAfter ?? row.val_after ?? (num(row.origAfter) - num(row.deprAfter)))),
      monthly_depr_after: String(num(row.monthlyDeprAfter ?? row.monthly_depr_after ?? 0)),
      monthly_depr_law_after: String(num(row.monthlyDeprLawAfter ?? row.monthly_depr_law_after ?? row.monthlyDeprAfter ?? 0)),
      cost_account: String(row.costAcc || row.cost_account || "6424").trim(),
      reval_account: String(row.revalAcc || row.reval_account || "").trim(),
      skip_months_before_check: true,
    };
  });

  const members = (d.members || [])
    .filter((m: Row) => String(m.name || "").trim() || String(m.title || "").trim() || String(m.representation || "").trim())
    .map((m: Row) => ({
      name: String(m.name || "").trim(),
      title: String(m.title || "").trim(),
      representation: String(m.representation || "").trim(),
    }));

  const accountingEntries = (d.accountingRows || d.accounting_entries || [])
    .filter((ae: Row) => num(ae.amount) > 0 && (String(ae.debitAcc || ae.debit_account || "").trim() || String(ae.creditAcc || ae.credit_account || "").trim()))
    .map((ae: Row) => ({
      description: String(ae.description || d.reason || "").trim(),
      debit_account: String(ae.debitAcc || ae.debit_account || "").trim(),
      credit_account: String(ae.creditAcc || ae.credit_account || "").trim(),
      amount: String(num(ae.amount)),
      object_code: String(ae.objCode || ae.object_code || "").trim(),
      object_name: String(ae.objName || ae.object_name || "").trim(),
      cost_item: String(ae.costItem || ae.cost_item || "").trim(),
    }));

  const payload: Row = {
    company: w.companyId,
    report_no: String(d.reportNo || d.report_no || "").trim(),
    report_date: toApiDate(d.reportDate || d.report_date || d.date),
    posting_date: toApiDate(d.postingDate || d.posting_date || d.date),
    voucher_date: toApiDate(d.voucherDate || d.voucher_date || d.date),
    voucher_no: String(d.voucherNo || d.voucher_no || "").trim(),
    reason: String(d.reason || "").trim(),
    conclusion: String(d.conclusion || "").trim(),
    reference: String(d.reference || "").trim(),
    members,
    items,
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
    ...(accountingEntries.length ? { accounting_entries: accountingEntries } : {}),
  };

  const record = await w.post(`${FIXED_ASSETS}transactions/revaluate/`, payload);
  return {
    record,
    message: String(record?.message || "Đánh giá lại tài sản cố định thành công."),
  };
}

/**
 * UC-FA-07 – Ghi giảm tài sản cố định:
 * Calls POST /api/v1/fixed-assets/transactions/dispose/ to atomically validate and save
 * the fixed asset disposal voucher across all 8 business reasons, post General Ledger entries,
 * transition asset status to DISPOSED, stop depreciation, and record audit logs.
 */
export async function saveFixedAssetDisposal(w: ApiWriter, d: Row) {
  const filledRows = (d.rows || d.items || []).filter((r: Row) =>
    String(r.assetCode || r.asset_code || r.asset_id || "").trim()
  );
  if (!filledRows.length) {
    throw new FormDataError("Vui lòng chọn ít nhất một tài sản cần ghi giảm.");
  }

  const assets = await w.list("assets");
  const rowsPayload = filledRows.map((row: Row) => {
    const code = String(row.assetCode || row.asset_code || "").trim();
    const asset = assets.find(
      (item) => String(item.code || "").trim().toLowerCase() === code.toLowerCase()
    );
    return {
      asset_id: asset?.id || row.asset_id || undefined,
      asset_code: code,
      asset_account: String(row.costAcc || row.asset_account || "2112").trim(),
      accumulated_account: String(row.accumulatedAcc || row.accumulated_account || "2141").trim(),
      disposal_account: String(row.handlingAcc || row.disposal_account || "811").trim(),
    };
  });

  const accountingEntries = (d.accountingRows || d.accounting_entries || [])
    .filter((ae: Row) => num(ae.amount) > 0 && (String(ae.debitAcc || ae.debit_account || "").trim() || String(ae.creditAcc || ae.credit_account || "").trim()))
    .map((ae: Row) => ({
      asset_code: String(ae.assetCode || ae.asset_code || "").trim(),
      description: String(ae.description || d.reason || "").trim(),
      debit_account: String(ae.debitAcc || ae.debit_account || "").trim(),
      credit_account: String(ae.creditAcc || ae.credit_account || "").trim(),
      amount: String(num(ae.amount)),
    }));

  const payload: Row = {
    company: w.companyId,
    voucher_no: String(d.voucherNo || d.voucher_no || "").trim(),
    reason: String(d.reason || "").trim(),
    posting_date: toApiDate(d.postingDate || d.posting_date || d.date),
    voucher_date: toApiDate(d.voucherDate || d.voucher_date || d.date),
    reference: String(d.reference || "").trim(),
    rows: rowsPayload,
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
    ...(accountingEntries.length ? { accounting_entries: accountingEntries } : {}),
  };

  const record = await w.post(`${FIXED_ASSETS}transactions/dispose/`, payload);
  return {
    record,
    message: String(record?.message || "Ghi giảm tài sản cố định thành công."),
  };
}

/** Đánh giá lại / Điều chuyển / Ghi giảm TSCĐ: one asset transaction per filled row. */
export async function saveAssetMovement(w: ApiWriter, kind: "revaluation" | "transfer" | "disposal" | "lifeChange", d: Row) {
  if (kind === "transfer" && (d.deliverer || d.receiver || d.sender)) {
    return saveFixedAssetTransfer(w, d);
  }
  if (kind === "revaluation") {
    return saveFixedAssetRevaluation(w, d);
  }
  if (kind === "disposal") {
    return saveFixedAssetDisposal(w, d);
  }
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

/** UC-FA-08: "Kiểm kê TSCĐ / CCDC" – Lập và lưu biên bản kiểm kê tài sản cố định, đối chiếu sổ kế toán và thực tế. */
export async function saveAssetCount(w: ApiWriter, assetType: "FIXED_ASSET" | "TOOL", d: Row) {
  const assets = (await w.list("assets")).filter((row) => row.asset_type === assetType);
  const rows = (d.rows || d.lines || []).filter((row: Row) =>
    Boolean(row.isSurplus || row.is_surplus || String(row.assetCode || row.asset_code || row.code || row.assetName || row.asset_name || "").trim())
  );
  if (!rows.length) throw new FormDataError("Chưa có tài sản trong bảng kiểm kê.");
  const path = `${FIXED_ASSETS}counts/`;
  const lines = rows.map((row: Row) => {
    const isSurplus = Boolean(row.isSurplus ?? row.is_surplus);
    if (isSurplus) {
      return {
        is_surplus: true,
        temp_code: String(row.assetCode || row.temp_code || "").trim(),
        asset_name: String(row.assetName || row.asset_name || "").trim(),
        actual_department_name: String(row.actualDept || row.actual_department_name || row.dept || "").trim(),
        identification_info: String(row.identificationInfo || row.identification_info || row.note || "").trim(),
        current_quality: String(row.currentQuality || row.current_quality || "Bình thường").trim(),
        recommendation: String(row.recommendation || row.solution || "Xác minh nguồn gốc để ghi tăng").trim(),
        note: String(row.note || "").trim(),
      };
    }
    const code = String(row.assetCode || row.asset_code || row.code || "").trim();
    const asset = assets.find((item) => String(item.code || "").toLowerCase() === code.toLowerCase());
    if (!asset) throw new FormDataError(`Tài sản ${code} không hợp lệ.`);
    const existenceStatus = String(
      row.existenceStatus || row.existence_status || (row.exists === null ? "UNCOUNTED" : row.exists === false ? "MISSING" : "EXISTS")
    ).toUpperCase();
    const actual = row.actualQty !== undefined ? num(row.actualQty) : existenceStatus === "EXISTS" ? num(asset.quantity) : 0;
    return {
      asset: asset.id,
      asset_code: asset.code,
      existence_status: existenceStatus,
      exists: existenceStatus === "UNCOUNTED" ? null : existenceStatus === "EXISTS",
      actual_quantity: String(actual),
      actual_department_name: String(row.actualDept || row.actual_department_name || row.dept || "").trim(),
      condition: String(row.currentQuality || row.condition || ""),
      current_quality: String(row.currentQuality || row.current_quality || row.condition || ""),
      recommendation: String(row.recommendation || row.solution || ""),
      resolution_voucher_no: String(row.resolutionVoucherNo || row.resolution_voucher_no || ""),
      note: String(row.note || ""),
    };
  });
  const members = Array.isArray(d.members)
    ? d.members
        .filter((m: Row) => String(m.name || "").trim() || String(m.position || "").trim() || String(m.represent || "").trim())
        .map((m: Row) => ({
          name: String(m.name || "").trim(),
          position: String(m.position || "").trim(),
          represent: String(m.represent || "").trim(),
          role: String(m.role || "Thành viên").trim(),
        }))
    : undefined;
  const voucherNo = await nextVoucherNumber(w, path, assetType === "TOOL" ? "BBKK" : "KKTS", d.voucherNo || d.number);
  const record = await w.post(path, {
    company: w.companyId,
    asset_type: assetType,
    number: voucherNo,
    voucher_no: voucherNo,
    count_date: toApiDate(d.auditDate || d.count_date || d.date),
    report_datetime: String(d.reportDatetime || d.report_datetime || d.date || ""),
    purpose: String(d.purpose || ""),
    conclusion: String(d.conclusion || ""),
    reference: String(d.reference || ""),
    recommendations_processed: Boolean(d.recommendationsProcessed ?? d.recommendations_processed ?? false),
    scope: d.scope || undefined,
    ...(members ? { members } : {}),
    ...(Array.isArray(d.attachments) ? { attachments: d.attachments } : {}),
    lines,
  });
  return {
    record,
    message: String(record?.message || "Lưu biên bản kiểm kê tài sản cố định thành công."),
  };
}

/** UC-FA-08: Tải danh sách tài sản trên sổ kế toán theo phạm vi và ngày kiểm kê. */
export async function loadBookAssetsForStocktakeUc08(w: ApiWriter, params: Row = {}) {
  const qs = new URLSearchParams();
  if (params.assetType || params.asset_type) qs.set("asset_type", String(params.assetType || params.asset_type));
  if (params.countDate || params.count_date) qs.set("count_date", toApiDate(params.countDate || params.count_date));
  if (params.departmentName || params.department_name) qs.set("department_name", String(params.departmentName || params.department_name));
  if (params.categoryName || params.category_name) qs.set("category_name", String(params.categoryName || params.category_name));
  qs.set("_", String(Date.now()));
  const resp = await w.get(`${FIXED_ASSETS}counts/load-book-assets/?${qs.toString()}`);
  return {
    record: resp,
    message: String(resp?.message || "Đã lấy danh sách TSCĐ từ sổ kế toán."),
  };
}

/** UC-FA-08: Cập nhật chứng từ kiểm kê TSCĐ đã lập (POST /api/v1/fixed-assets/counts/<id>/update-stocktake/). */
export async function updateStocktakeVoucherUc08(w: ApiWriter, countId: string, d: Row = {}) {
  const resp = await w.action(`${FIXED_ASSETS}counts/`, countId, "update-stocktake", {
    count_date: d.auditDate || d.count_date ? toApiDate(d.auditDate || d.count_date) : undefined,
    report_datetime: d.reportDatetime || d.report_datetime || undefined,
    purpose: d.purpose !== undefined ? String(d.purpose) : undefined,
    conclusion: d.conclusion !== undefined ? String(d.conclusion) : undefined,
    recommendations_processed:
      d.recommendationsProcessed !== undefined || d.recommendations_processed !== undefined
        ? Boolean(d.recommendationsProcessed ?? d.recommendations_processed)
        : undefined,
    members: Array.isArray(d.members) ? d.members : undefined,
    lines: Array.isArray(d.lines) ? d.lines : undefined,
  });
  return {
    record: resp,
    message: String(resp?.message || "Đã cập nhật chứng từ kiểm kê TSCĐ."),
  };
}

/** UC-FA-09 Main Flow A: Xem sổ tài sản cố định theo ngày xem số liệu (as_of_date) và điều kiện lọc. */
export async function fetchFixedAssetRegister(w: ApiWriter, params: Row = {}) {
  const path = `${FIXED_ASSETS}assets/register/`;
  const record = await w.post(path, {
    company: w.companyId,
    company_id: w.companyId,
    as_of_date: params.asOfDate || params.as_of_date || undefined,
    search: params.search || undefined,
    department_name: params.departmentName || params.department_name || undefined,
    category_name: params.categoryName || params.category_name || undefined,
    include_disposed: Boolean(params.includeDisposed ?? params.include_disposed ?? false),
    page: Number(params.page || 1),
    page_size: Number(params.pageSize || params.page_size || 50),
    export_excel: Boolean(params.exportExcel ?? params.export_excel ?? false),
  });
  return { record, message: "" };
}

/** UC-FA-09 Main Flow B: Lập và xem báo cáo tài sản cố định / báo cáo đối chiếu. */
export async function fetchFixedAssetReport(w: ApiWriter, params: Row = {}) {
  const path = `${FIXED_ASSETS}assets/reports/`;
  const record = await w.post(path, {
    company: w.companyId,
    company_id: w.companyId,
    report_code: params.reportCode || params.report_code || params.reportId || "ASSET_REGISTER",
    from_date: params.fromDate || params.from_date || undefined,
    to_date: params.toDate || params.to_date || undefined,
    year: params.year || undefined,
    department_name: params.departmentName || params.department_name || undefined,
    category_name: params.categoryName || params.category_name || undefined,
    asset_code: params.assetCode || params.asset_code || undefined,
    account_code: params.accountCode || params.account_code || undefined,
    only_differences: Boolean(params.onlyDifferences ?? params.only_differences ?? false),
    exclude_disposed_in_period: Boolean(params.excludeDisposedInPeriod ?? params.exclude_disposed_in_period ?? false),
    lang: params.lang || "vi",
  });
  return { record, message: "" };
}

/** UC-FA-09 Main Flow B (AF10, AF12, AF13, AF14): Danh mục báo cáo, tìm kiếm AVA và tùy chọn ẩn/hiện báo cáo. */
export async function fetchFixedAssetReportCatalog(w: ApiWriter, params: Row = {}) {
  const path = `${FIXED_ASSETS}assets/report-catalog/`;
  const record = await w.post(path, {
    company: w.companyId,
    company_id: w.companyId,
    search: params.search || undefined,
    ava_query: params.avaQuery || params.ava_query || undefined,
    lang: params.lang || "vi",
    hidden_report_codes: Array.isArray(params.hiddenReportCodes) ? params.hiddenReportCodes : undefined,
    include_hidden: Boolean(params.includeHidden ?? params.include_hidden ?? false),
  });
  return { record, message: "" };
}

/** UC-FA-11 (Step 4, BR06): Lấy kỳ phân bổ mặc định đề xuất theo kỳ làm việc của doanh nghiệp. */
export async function fetchDefaultAllocationPeriodUc11(
  w: ApiWriter,
  allocationType: "TOOL" | "PREPAID" = "TOOL",
) {
  return await w.get(
    `${FIXED_ASSETS}calculations/default-allocation-period/?allocation_type=${encodeURIComponent(allocationType)}&_=${Date.now()}`,
  );
}

/** UC-FA-11 (Main Flow A & B, Steps 7–11): Thiết lập kỳ phân bổ CCDC hoặc chi phí trả trước (chưa ghi sổ GL). */
export async function setupAllocationPeriodUc11(w: ApiWriter, d: Row) {
  const rawMonth = d.month ?? d.period_month;
  const rawYear = d.year ?? d.period_year;
  if (rawMonth === undefined || rawMonth === null || String(rawMonth).trim() === "") {
    throw new FormDataError("Vui lòng chọn tháng phân bổ.");
  }
  const monthNum = Number(rawMonth);
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    throw new FormDataError("Tháng phân bổ phải có giá trị từ 1 đến 12.");
  }
  if (rawYear === undefined || rawYear === null || String(rawYear).trim() === "") {
    throw new FormDataError("Vui lòng nhập năm phân bổ.");
  }
  const yearNum = Number(rawYear);
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 2100) {
    throw new FormDataError("Năm phân bổ không hợp lệ.");
  }

  const record = await w.post(`${FIXED_ASSETS}calculations/setup-allocation-period/`, {
    company: w.companyId,
    company_id: w.companyId,
    allocation_type: String(d.allocationType || d.allocation_type || "TOOL").toUpperCase(),
    month: monthNum,
    year: yearNum,
    ai_assisted: Boolean(d.aiAssisted ?? d.ai_assisted ?? false),
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
  });
  return {
    record,
    message: String(record?.message || ""),
  };
}

/** UC-FA-11 (AF17, EF18, EF19, BR27, BR34, BR35): Kiểm tra lại thông tin kỳ, ngày và số chứng từ trước khi lưu/ghi sổ. */
export async function validateAllocationVoucherUc11(w: ApiWriter, d: Row) {
  const record = await w.post(`${FIXED_ASSETS}calculations/validate-allocation-voucher/`, {
    company: w.companyId,
    company_id: w.companyId,
    allocation_type: String(d.allocationType || d.allocation_type || "TOOL").toUpperCase(),
    month: Number(d.month ?? d.period_month),
    year: Number(d.year ?? d.period_year),
    posting_date: String(d.postingDate || d.posting_date || "").trim(),
    voucher_date: String(d.voucherDate || d.voucher_date || "").trim(),
    voucher_no: String(d.voucherNo || d.voucher_no || "").trim(),
    description: String(d.description || "").trim(),
  });
  return {
    record,
    message: "",
  };
}

/** UC-FA-12 (Main Flow A & B): Tính / tính lại phân bổ chi phí CCDC hoặc chi phí trả trước theo kỳ (chưa ghi sổ GL). */
export async function calculateAllocationVoucherUc12(w: ApiWriter, d: Row) {
  const record = await w.post(`${FIXED_ASSETS}assets/calculate-allocation/`, {
    company: w.companyId,
    company_id: w.companyId,
    allocation_type: String(d.allocationType || d.allocation_type || "TOOL").toUpperCase(),
    month: Number(d.month ?? d.period_month),
    year: Number(d.year ?? d.period_year),
    voucher_no: String(d.voucherNo || d.voucher_no || "").trim() || undefined,
    description: String(d.description || "").trim() || undefined,
    reference: String(d.reference || "").trim() || undefined,
    item_ids: Array.isArray(d.itemIds) ? d.itemIds : undefined,
    identify_rows_override: Array.isArray(d.identifyRowsOverride) ? d.identifyRowsOverride : undefined,
    allocation_rows_override: Array.isArray(d.allocationRowsOverride) ? d.allocationRowsOverride : undefined,
    accounting_rows_override: Array.isArray(d.accountingRowsOverride) ? d.accountingRowsOverride : undefined,
  });
  return {
    record,
    message: String(record?.message || ""),
  };
}

/** UC-FA-12 (Main Flow A & B): Cất / Cất và In chứng từ phân bổ chi phí CCDC hoặc chi phí trả trước (ghi sổ GL & cập nhật lũy kế). */
export async function saveAllocationVoucherUc12(w: ApiWriter, d: Row) {
  const allocType = String(d.allocationType || d.allocation_type || "TOOL").toUpperCase();
  const record = await w.post(`${FIXED_ASSETS}assets/save-allocation-voucher/`, {
    company: w.companyId,
    company_id: w.companyId,
    allocation_type: allocType,
    month: Number(d.month ?? d.period_month),
    year: Number(d.year ?? d.period_year),
    voucher_no: String(d.voucherNo ?? d.voucher_no ?? "").trim(),
    posting_date: String(d.postingDate ?? d.posting_date ?? "").trim(),
    voucher_date: String(d.voucherDate ?? d.voucher_date ?? "").trim(),
    description: String(d.description ?? d.reason ?? "").trim(),
    reference: String(d.reference ?? "").trim(),
    selected_vouchers: Array.isArray(d.selectedVouchers) ? d.selectedVouchers : undefined,
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
    item_ids: Array.isArray(d.itemIds) ? d.itemIds : undefined,
    identify_rows_override: Array.isArray(d.identifyRowsOverride) ? d.identifyRowsOverride : undefined,
    allocation_rows_override: Array.isArray(d.allocationRowsOverride) ? d.allocationRowsOverride : undefined,
    accounting_rows_override: Array.isArray(d.accountingRowsOverride) ? d.accountingRowsOverride : undefined,
    print_on_save: Boolean(d.printOnSave ?? d.print_on_save ?? false),
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
  });
  w.invalidate();
  return {
    record,
    message: String(
      record?.message ||
        (allocType === "TOOL"
          ? "Đã cất chứng từ phân bổ CCDC thành công."
          : "Đã lưu chứng từ phân bổ chi phí trả trước thành công."),
    ),
  };
}

/** UC-FA-12 (AF22, BR36): Bỏ ghi sổ / hủy chứng từ phân bổ CCDC hoặc chi phí trả trước. */
export async function unpostAllocationVoucherUc12(w: ApiWriter, d: Row) {
  const record = await w.post(`${FIXED_ASSETS}assets/unpost-allocation-voucher/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_no: String(d.voucherNo || d.voucher_no || "").trim() || undefined,
    run_id: d.runId || d.run_id || undefined,
    reason: String(d.reason || "Bỏ ghi sổ chứng từ phân bổ").trim(),
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || "Đã bỏ ghi sổ chứng từ phân bổ."),
  };
}

/** UC-FA-12 (AF18, EF33, BR38): Xuất bảng phân bổ ra Excel (không tự động ghi sổ). */
export async function exportAllocationExcelUc12(w: ApiWriter, d: Row) {
  const record = await w.post(`${FIXED_ASSETS}assets/export-allocation-excel/`, {
    company: w.companyId,
    company_id: w.companyId,
    allocation_type: String(d.allocationType || d.allocation_type || "PREPAID").toUpperCase(),
    month: Number(d.month ?? d.period_month),
    year: Number(d.year ?? d.period_year),
    item_ids: Array.isArray(d.itemIds) ? d.itemIds : undefined,
  });
  return {
    record,
    message: String(record?.message || "Xuất bảng phân bổ ra Excel thành công."),
  };
}

/** UC-FA-12 (AF01–AF03, BR26–BR29): Tìm kiếm chứng từ tham chiếu cho chứng từ phân bổ. */
export async function fetchAllocationReferenceVouchersUc12(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/allocation-reference-vouchers/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_type: d.voucherType || d.voucher_type || "ALL",
    from_date: d.fromDate || d.from_date || undefined,
    to_date: d.toDate || d.to_date || undefined,
    keyword: d.keyword || d.search || undefined,
    selected_vouchers: Array.isArray(d.selectedVouchers) ? d.selectedVouchers : undefined,
  });
}

/** UC-FA-13 (Steps 5, 10–11): Lấy số biên bản đề xuất tiếp theo, ngày mặc định và danh sách CCDC khả dụng để điều chuyển. */
export async function fetchTransferableToolsUc13(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/transferable-tools/`, {
    company: w.companyId,
    company_id: w.companyId,
    transfer_date: d.transferDate || d.transfer_date || d.date || undefined,
    keyword: d.keyword || d.search || undefined,
  });
}

/** UC-FA-13 (Main Flow Steps 19–31): Lưu / Cất và In biên bản điều chuyển CCDC giữa các đơn vị. */
export async function saveToolTransferUc13(w: ApiWriter, d: Row) {
  const lines = (Array.isArray(d.lines) ? d.lines : Array.isArray(d.rows) ? d.rows : []).map((r: Row) => ({
    asset_id: r.assetId || r.asset_id || undefined,
    code: String(r.code || r.toolCode || r.assetCode || "").trim(),
    from_department: String(r.fromDept || r.from_department || "").trim(),
    to_department: String(r.toDept || r.to_department || "").trim(),
    transfer_quantity: r.transferQty ?? r.transfer_quantity ?? r.quantity ?? 0,
    statistical_code: String(r.statCode || r.statistical_code || "").trim(),
    sales_contract: String(r.contract || r.sales_contract || "").trim(),
    purchase_order: String(r.order || r.purchase_order || "").trim(),
  }));

  const record = await w.post(`${FIXED_ASSETS}assets/transfer-tools/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_no: String(d.voucherNo ?? d.voucher_no ?? "").trim(),
    transfer_date: String(d.transferDate ?? d.date ?? d.voucherDate ?? "").trim(),
    deliverer: String(d.deliverer ?? "").trim(),
    receiver: String(d.receiver ?? "").trim(),
    reason: String(d.reason ?? "").trim(),
    reference: String(d.reference ?? "").trim(),
    references: Array.isArray(d.references) ? d.references : undefined,
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
    lines,
    print_on_save: Boolean(d.printOnSave ?? d.print_on_save ?? false),
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || `Đã lưu chứng từ điều chuyển CCDC ${record?.voucher_no || ""} thành công.`),
  };
}

/** UC-FA-13 (AF24, EF29, BR36): Hủy biên bản điều chuyển CCDC. */
export async function cancelToolTransferUc13(w: ApiWriter, d: Row) {
  const record = await w.post(`${FIXED_ASSETS}assets/cancel-tool-transfer/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_no: String(d.voucherNo || d.voucher_no || "").trim(),
    transaction_id: d.transactionId || d.transaction_id || undefined,
    reason: String(d.reason || "Hủy biên bản điều chuyển CCDC").trim(),
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || "Đã hủy biên bản điều chuyển CCDC thành công."),
  };
}

/** UC-FA-14 (Main Flow A, Steps 5 & 8): Lấy số chứng từ đề xuất và danh sách CCDC khả dụng để ghi giảm. */
export async function fetchDisposableToolsUc14(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/disposable-tools/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_date: d.voucherDate || d.voucher_date || d.date || undefined,
    keyword: d.keyword || d.search || undefined,
  });
}

/** UC-FA-14 (Main Flow A, Steps 19–31): Lưu / Cất và In chứng từ ghi giảm CCDC. */
export async function saveToolDecreaseUc14(w: ApiWriter, d: Row) {
  const lines = (Array.isArray(d.lines) ? d.lines : Array.isArray(d.rows) ? d.rows : []).map((r: Row) => ({
    asset_id: r.assetId || r.asset_id || undefined,
    code: String(r.code || r.toolCode || r.assetCode || "").trim(),
    department: String(r.dept || r.department || r.departmentCode || "").trim() || undefined,
    decrease_quantity: r.decreaseQty ?? r.decrease_quantity ?? r.requestedQty ?? r.quantity ?? 0,
    decrease_remaining_value:
      r.remainingValue !== undefined && r.remainingValue !== "" && r.remainingValue !== null
        ? r.remainingValue
        : r.decrease_remaining_value,
    adjustment_basis: r.adjustmentBasis || r.adjustment_basis || (r.manualValueChanged ? "Điều chỉnh theo số liệu thực tế" : undefined),
    allow_manual_value_override: Boolean(r.allowManualValueOverride ?? r.allow_manual_value_override ?? r.manualValueChanged ?? false),
  }));

  const record = await w.post(`${FIXED_ASSETS}assets/decrease-tools/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_no: String(d.voucherNo ?? d.voucher_no ?? "").trim(),
    voucher_date: String(d.voucherDate ?? d.date ?? d.voucher_date ?? "").trim(),
    reason: String(d.reason ?? "Nhượng bán, Thanh lý").trim(),
    reference: String(d.reference ?? "").trim(),
    references: Array.isArray(d.references) ? d.references : undefined,
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
    accounting_treatment: d.accountingTreatment || d.accounting_treatment || undefined,
    lines,
    print_on_save: Boolean(d.printOnSave ?? d.print_on_save ?? d.printAfterSave ?? false),
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || `Đã lưu chứng từ ghi giảm CCDC ${record?.voucher_no || ""} thành công.`),
  };
}

/** UC-FA-14 (AF25, EF36, BR40): Hủy chứng từ ghi giảm CCDC và hoàn nguyên số lượng, giá trị còn lại. */
export async function cancelToolDecreaseUc14(w: ApiWriter, d: Row) {
  const record = await w.post(`${FIXED_ASSETS}assets/cancel-tool-decrease/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_no: String(d.voucherNo || d.voucher_no || "").trim(),
    reason: String(d.reason || "Hủy chứng từ ghi giảm CCDC").trim(),
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || "Đã hủy chứng từ ghi giảm CCDC thành công."),
  };
}

/** UC-FA-14 (Main Flow B, Steps 6 & 9): Lấy số chứng từ đề xuất và danh sách CPTT khả dụng để ghi giảm. */
export async function fetchDisposablePrepaidExpensesUc14(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/disposable-prepaid-expenses/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_date: d.voucherDate || d.voucher_date || d.date || undefined,
    keyword: d.keyword || d.search || undefined,
  });
}

/** UC-FA-14 (Main Flow B, Steps 15–26): Lưu (Cất / Cất và Đóng) chứng từ ghi giảm chi phí trả trước. */
export async function savePrepaidDecreaseUc14(w: ApiWriter, d: Row) {
  const lines = (Array.isArray(d.lines) ? d.lines : Array.isArray(d.rows) ? d.rows : []).map((r: Row) => ({
    prepaid_id: r.prepaidId || r.prepaid_id || undefined,
    code: String(r.code || r.prepaidCode || "").trim(),
    decrease_amount: r.decreaseAmount ?? r.decrease_amount ?? r.remainingAmount ?? r.amount ?? 0,
  }));

  const record = await w.post(`${FIXED_ASSETS}assets/decrease-prepaid-expenses/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_no: String(d.voucherNo ?? d.number ?? d.voucher_no ?? "").trim(),
    voucher_date: String(d.voucherDate ?? d.date ?? d.voucher_date ?? "").trim(),
    reason: String(d.reason ?? "").trim(),
    reference: String(d.reference ?? "").trim(),
    references: Array.isArray(d.references) ? d.references : undefined,
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
    accounting_treatment: d.accountingTreatment || d.accounting_treatment || undefined,
    lines,
    keep_open: Boolean(d.keepOpen ?? d.keep_open ?? false),
    allow_idempotent_voucher_resave: Boolean(d.allowIdempotentVoucherResave ?? d.allow_idempotent_voucher_resave ?? true),
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || `Đã lưu chứng từ ghi giảm chi phí trả trước ${record?.voucher_no || ""} thành công.`),
  };
}

/** UC-FA-14 (AF25, EF36, BR40): Hủy chứng từ ghi giảm chi phí trả trước. */
export async function cancelPrepaidDecreaseUc14(w: ApiWriter, d: Row) {
  const record = await w.post(`${FIXED_ASSETS}assets/cancel-prepaid-decrease/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_no: String(d.voucherNo || d.voucher_no || "").trim(),
    reason: String(d.reason || "Hủy chứng từ ghi giảm chi phí trả trước").trim(),
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || "Đã hủy chứng từ ghi giảm chi phí trả trước thành công."),
  };
}

/** UC-FA-14 (AF01–AF02, EF30): Tìm kiếm chứng từ tham chiếu cho chứng từ ghi giảm CCDC / CPTT. */
export async function fetchDecreaseReferenceVouchersUc14(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/decrease-reference-vouchers/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_type: d.voucherType || d.voucher_type || "ALL",
    from_date: d.fromDate || d.from_date || undefined,
    to_date: d.toDate || d.to_date || undefined,
    keyword: d.keyword || d.search || undefined,
  });
}

/* ───────────────────────── UC-FA-15: Kiểm kê CCDC ───────────────────────── */

/** UC-FA-15 (Steps 4–8, EF01–EF05): Kiểm tra ngày kiểm kê đến ngày và lấy số biên bản BBKK00001 đề xuất. */
export async function validateToolStocktakeDateUc15(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/validate-tool-stocktake-date/`, {
    company: w.companyId,
    company_id: w.companyId,
    count_to_date: d.countToDate || d.count_to_date || d.toDate || d.date ? toApiDate(d.countToDate || d.count_to_date || d.toDate || d.date) : "",
    require_explicit_date: true,
  });
}

/** UC-FA-15 (Steps 11–13, AF04–AF06, EF17–EF21, BR05, BR06, BR10, BR11, BR35): Lấy toàn bộ CCDC đang dùng tại ngày kiểm kê. */
export async function fetchInUseToolsForStocktakeUc15(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/tool-stocktake-items/`, {
    company: w.companyId,
    company_id: w.companyId,
    count_to_date: d.countToDate || d.count_to_date || d.toDate || d.date ? toApiDate(d.countToDate || d.count_to_date || d.toDate || d.date) : undefined,
    previous_count_to_date: d.previousCountToDate ? toApiDate(d.previousCountToDate) : undefined,
    confirm_date_change_reload: Boolean(d.confirmDateChangeReload),
    existing_rows: Array.isArray(d.existingRows) ? d.existingRows : undefined,
    confirm_overwrite: Boolean(d.confirmOverwrite),
    merge_existing: Boolean(d.mergeExisting),
    department: d.department || undefined,
    search: d.search || undefined,
  });
}

/** UC-FA-15 (Steps 14–33, AF07–AF19, EF01–EF32, BR01–BR36): Lưu / Cất hoặc Cất và In biên bản kiểm kê CCDC. */
export async function saveToolStocktakeUc15(w: ApiWriter, d: Row) {
  const rows = Array.isArray(d.rows) ? d.rows : Array.isArray(d.lines) ? d.lines : [];
  const validRows = rows.filter((r: Row) => String(r.code || r.asset_code || r.asset || r.asset_id || "").trim() !== "");
  if (!validRows.length) {
    throw new FormDataError("Vui lòng chọn ít nhất một CCDC cần kiểm kê.");
  }
  const committee = Array.isArray(d.committee) ? d.committee : [];
  const payload = {
    _uc15: true,
    company: w.companyId,
    company_id: w.companyId,
    voucher_no: String(d.voucherNo || d.number || d.voucher_no || "").trim(),
    count_to_date: toApiDate(d.countToDate || d.toDate || d.date || d.count_to_date),
    purpose: String(d.purpose || "").trim(),
    conclusion: String(d.conclusion || "").trim(),
    print_on_save: Boolean(d.printOnSave || d.print_on_save || d.print),
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
    lines: validRows.map((r: Row) => ({
      asset_id: r.asset_id || r.assetId || r.asset || undefined,
      code: String(r.code || r.asset_code || "").trim(),
      department_id: r.department_id || r.departmentId || undefined,
      department_code: String(r.department_code || r.deptCode || r.dept || "").trim(),
      department_name: String(r.department_name || r.dept || "").trim(),
      expected_book_quantity: r.expectedBookQty !== undefined ? String(r.expectedBookQty) : undefined,
      actual_quantity: r.actualQty !== undefined && r.actualQty !== "" && r.actualQty !== null
        ? String(r.actualQty)
        : (r.actual_quantity !== undefined && r.actual_quantity !== "" && r.actual_quantity !== null ? String(r.actual_quantity) : null),
      counted_confirmed: r.countedConfirmed !== undefined ? Boolean(r.countedConfirmed) : true,
      solution: String(r.solution || r.recommendation || "").trim(),
      verification_note: r.verificationNote || r.verification_note || undefined,
    })),
    committee: committee.map((m: Row) => ({
      name: String(m.name || m.full_name || "").trim(),
      title: String(m.title || m.position || "").trim(),
      department: String(m.dept || m.department || "").trim(),
      role: String(m.role || "").trim(),
    })),
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
  };
  const record = await w.post(`${FIXED_ASSETS}assets/save-tool-stocktake/`, payload);
  w.invalidate();
  return {
    record,
    message: String(record?.message || `Đã lưu biên bản kiểm kê CCDC ${record?.voucher_no || payload.voucher_no} thành công.`),
  };
}

/** UC-FA-15 (AF20–AF23, EF27, EF33–EF34, BR23–BR29, BR37): Xác minh, phê duyệt và xử lý chênh lệch sau kiểm kê CCDC. */
export async function resolveToolStocktakeUc15(w: ApiWriter, d: Row) {
  const record = await w.post(`${FIXED_ASSETS}assets/resolve-tool-stocktake/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_no: String(d.voucherNo || d.voucher_no || "").trim(),
    action: String(d.action || "RESOLVE").trim(),
    code: d.code || undefined,
    department_code: d.departmentCode || d.dept || undefined,
    verification_note: d.verificationNote || d.verification_note || undefined,
    solution: d.solution || undefined,
    approved: Boolean(d.approved),
    auto_create_voucher: Boolean(d.autoCreateVoucher),
    resolution_voucher_no: d.resolutionVoucherNo || undefined,
  });
  w.invalidate();
  return { record, message: "Đã cập nhật tình trạng xử lý chênh lệch kiểm kê CCDC." };
}

/** UC-FA-15 (EF35, BR40): Hủy biên bản kiểm kê CCDC. */
export async function cancelToolStocktakeUc15(w: ApiWriter, d: Row) {
  const record = await w.post(`${FIXED_ASSETS}assets/cancel-tool-stocktake/`, {
    company: w.companyId,
    company_id: w.companyId,
    voucher_no: String(d.voucherNo || d.voucher_no || "").trim(),
    reason: String(d.reason || "Hủy biên bản kiểm kê CCDC").trim(),
  });
  w.invalidate();
  return { record, message: String(record?.message || "Đã hủy biên bản kiểm kê CCDC thành công.") };
}

/** UC-FA-15 (AF24–AF27, BR39): Xuất Excel danh sách biên bản kiểm kê CCDC. */
export async function exportToolStocktakeExcelUc15(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/export-tool-stocktake-excel/`, {
    company: w.companyId,
    company_id: w.companyId,
    search: d.search || undefined,
    status: d.status || undefined,
  });
}

/* ───────────────────────── UC-FA-16: Xem sổ và báo cáo CCDC ───────────────────────── */

/** UC-FA-16 (Main Flow A, Steps 1–9, AF01–AF05, BR01–BR16): Lấy dữ liệu Sổ theo dõi công cụ dụng cụ (12 cột chuẩn). */
export async function fetchToolRegisterUc16(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/tool-register-uc16/`, {
    company: w.companyId,
    company_id: w.companyId,
    as_of_date: d.asOfDate || d.as_of_date || d.toDate || d.date ? toApiDate(d.asOfDate || d.as_of_date || d.toDate || d.date) : undefined,
    search: d.search || d.keyword || undefined,
    department: d.department || d.department_id || undefined,
    category: d.category || d.category_id || undefined,
    status: d.status || undefined,
    include_disposed: Boolean(d.includeDisposed ?? d.include_disposed ?? false),
    split_by_department: Boolean(d.splitByDepartment ?? d.split_by_department ?? false),
    page: d.page || 1,
    page_size: d.pageSize || d.page_size || 20,
  });
}

/** UC-FA-16 (Main Flow A, Steps 10–12, AF06–AF07, EF20–EF21, BR34, BR40): Xuất khẩu Sổ theo dõi CCDC ra Excel. */
export async function exportToolRegisterUc16(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/export-tool-register/`, {
    company: w.companyId,
    company_id: w.companyId,
    as_of_date: d.asOfDate || d.as_of_date || d.toDate || d.date ? toApiDate(d.asOfDate || d.as_of_date || d.toDate || d.date) : undefined,
    search: d.search || d.keyword || undefined,
    department: d.department || d.department_id || undefined,
    category: d.category || d.category_id || undefined,
    status: d.status || undefined,
    include_disposed: Boolean(d.includeDisposed ?? d.include_disposed ?? false),
    split_by_department: Boolean(d.splitByDepartment ?? d.split_by_department ?? false),
    export_excel: true,
    export_format: "EXCEL",
  });
}

/** UC-FA-16 (AF04, AF28, EF18, EF19, BR37): Xem chi tiết & lịch sử biến động CCDC hoặc truy vết chứng từ nguồn. */
export async function fetchToolDetailTraceUc16(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/tool-detail-trace/`, {
    company: w.companyId,
    company_id: w.companyId,
    tool_id: d.toolId || d.tool_id || d.id || undefined,
    tool_code: d.toolCode || d.tool_code || d.code || undefined,
    voucher_no: d.voucherNo || d.voucher_no || undefined,
  });
}

/** UC-FA-16 (Main Flow B, Steps 1–4, AF08–AF10, AF17–AF21, EF02, EF17, EF24, EF25, BR30–BR33): Lấy danh mục báo cáo CCDC, Yêu thích, Ẩn/hiện, Ngôn ngữ và Tìm kiếm AVA. */
export async function fetchToolReportCatalogUc16(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/tool-report-catalog/`, {
    company: w.companyId,
    company_id: w.companyId,
    search: d.search || d.q || undefined,
    ava_query: d.avaQuery || d.ava_query || undefined,
    lang: d.lang || d.language || undefined,
    toggle_favorite: d.toggleFavorite || d.toggle_favorite || d.reportName || d.report_name || undefined,
    favorite_report_codes: Array.isArray(d.favoriteReportCodes) ? d.favoriteReportCodes : undefined,
    hidden_report_codes: Array.isArray(d.hiddenReportCodes || d.hiddenReports || d.hidden_reports)
      ? (d.hiddenReportCodes || d.hiddenReports || d.hidden_reports)
      : undefined,
    include_hidden: Boolean(d.includeHidden ?? d.include_hidden ?? false),
  });
}

/** UC-FA-16 (Main Flow B, Steps 5–14, AF11–AF16, AF22–AF28, EF04–EF16, EF20–EF27, BR17–BR40): Tổng hợp, Xem trước, Xuất Excel và In báo cáo CCDC / CPTT / Đối chiếu TK 242. */
export async function generateToolReportUc16(w: ApiWriter, d: Row = {}) {
  return await w.post(`${FIXED_ASSETS}assets/tool-reports/`, {
    company: w.companyId,
    company_id: w.companyId,
    report_code: d.reportCode || d.report_code || d.reportId || d.reportName || d.report_name || "TOOL_ALLOCATION_SHEET",
    period_type: d.periodType || d.period_type || undefined,
    month: d.month !== undefined ? Number(d.month) : undefined,
    quarter: d.quarter !== undefined ? Number(d.quarter) : undefined,
    year: d.year !== undefined ? Number(d.year) : undefined,
    from_date: d.fromDate || d.from_date ? toApiDate(d.fromDate || d.from_date) : undefined,
    to_date: d.toDate || d.to_date ? toApiDate(d.toDate || d.to_date) : undefined,
    department: d.department || d.department_id || undefined,
    category: d.category || d.category_id || undefined,
    tool_code: d.toolCode || d.tool_code || undefined,
    status: d.status || undefined,
    waiting_account: d.waitingAccount || d.waiting_account || undefined,
    lang: d.lang || d.language || undefined,
    export_excel: Boolean(d.exportExcel ?? d.export_excel ?? (String(d.exportFormat || "").toUpperCase() === "EXCEL")),
    print_report: Boolean(d.printReport ?? d.print_report ?? false),
  });
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

/** UC-GL-02: Lập chứng từ quyết toán tạm ứng (lưu ở trạng thái Chưa ghi sổ - UNPOSTED). */
export async function saveAdvanceSettlement(w: ApiWriter, d: Row) {
  const employeeText = String(d.employeeId || d.employee || "").trim();
  if (!employeeText) {
    throw new FormDataError("Nhân viên quyết toán tạm ứng là bắt buộc.");
  }

  const settlePerAdvance = Boolean(d.settlePerAdvance || d.settle_per_advance);
  const sourceAdvanceRef = String(d.sourceAdvanceRef || d.source_advance_ref || d.cashAdvance || "").trim();
  if (settlePerAdvance && !sourceAdvanceRef) {
    throw new FormDataError("Khi chọn 'Quyết toán cho từng lần tạm ứng', bắt buộc phải chọn khoản/lần tạm ứng nguồn.");
  }

  const rawRows = Array.isArray(d.rows) ? d.rows : Array.isArray(d.accounting_lines) ? d.accounting_lines : [];
  const validRows = rawRows.filter((row: Row) =>
    String(row.debitAcc || row.debit_account || "").trim() ||
    num(row.amount) > 0
  );
  if (!validRows.length) {
    throw new FormDataError("Chứng từ quyết toán tạm ứng phải có ít nhất một dòng hạch toán hợp lệ.");
  }

  const accountingLines = validRows.map((row: Row, idx: number) => {
    const debitAcc = String(row.debitAcc || row.debit_account || "").trim();
    const creditAcc = String(row.creditAcc || row.credit_account || "141").trim();
    const amount = num(row.amount);
    if (!debitAcc || !creditAcc) {
      throw new FormDataError(`Dòng hạch toán ${idx + 1}: Vui lòng nhập đầy đủ Tài khoản Nợ và Tài khoản Có.`);
    }
    if (debitAcc === creditAcc) {
      throw new FormDataError(`Dòng hạch toán ${idx + 1}: Tài khoản Nợ và Tài khoản Có (${debitAcc}) không được trùng nhau.`);
    }
    if (!(amount > 0)) {
      throw new FormDataError(`Dòng hạch toán ${idx + 1}: Số tiền phải lớn hơn 0.`);
    }
    return {
      description: String(row.desc || row.description || d.description || "Quyết toán tạm ứng").trim(),
      debit_account: debitAcc,
      credit_account: creditAcc,
      amount: String(amount),
      debit_object_code: String(row.debitObject || row.debit_object_code || "").trim(),
      debit_object_name: String(row.debitObjectName || row.debit_object_name || "").trim(),
      credit_object_code: String(row.creditObject || row.credit_object_code || "").trim(),
      credit_object_name: String(row.creditObjectName || row.credit_object_name || "").trim(),
      department: row.department || d.department || undefined,
    };
  });

  const rawTaxRows = Array.isArray(d.taxRows) ? d.taxRows : Array.isArray(d.tax_lines) ? d.tax_lines : [];
  const activeTaxRows = rawTaxRows.filter((tRow: Row) =>
    String(tRow.invoiceNo || tRow.invoice_number || "").trim() ||
    num(tRow.preTaxAmount ?? tRow.pre_tax_amount) > 0 ||
    num(tRow.vatAmount ?? tRow.vat_amount) > 0
  );

  const taxLines = activeTaxRows.map((tRow: Row, idx: number) => {
    const invNo = String(tRow.invoiceNo || tRow.invoice_number || "").trim();
    const invDateRaw = String(tRow.invoiceDate || tRow.invoice_date || "").trim();
    if (!invNo) {
      throw new FormDataError(`Dòng kê khai thuế ${idx + 1}: Vui lòng nhập Số hóa đơn.`);
    }
    if (!invDateRaw) {
      throw new FormDataError(`Dòng kê khai thuế ${idx + 1}: Vui lòng nhập Ngày hóa đơn.`);
    }
    const preTax = num(tRow.preTaxAmount ?? tRow.pre_tax_amount);
    const vatAmt = num(tRow.vatAmount ?? tRow.vat_amount);
    const vatRateStr = String(tRow.vatRate ?? tRow.vat_rate ?? "10").replace("%", "").trim();
    return {
      description: String(tRow.desc || tRow.description || "Thuế GTGT đầu vào").trim(),
      tax_account: String(tRow.debitAcc || tRow.tax_account || "1331").trim(),
      credit_account: String(tRow.creditAcc || tRow.credit_account || "141").trim(),
      goods_group: String(tRow.goodsGroup || tRow.goods_group || "1").trim(),
      pre_tax_amount: String(preTax),
      vat_rate: vatRateStr,
      vat_amount: String(vatAmt),
      invoice_date: toApiDate(invDateRaw),
      invoice_number: invNo,
      invoice_form: String(tRow.invoiceForm || tRow.invoice_form || "1").trim(),
      invoice_serial: String(tRow.invoiceSerial || tRow.invoice_serial || "").trim(),
      supplier_code: String(tRow.partnerCode || tRow.supplier_code || "").trim(),
      supplier_name: String(tRow.partnerName || tRow.supplier_name || "").trim(),
      supplier_tax_code: String(tRow.partnerTaxCode || tRow.supplier_tax_code || "").trim(),
    };
  });

  const rawAttachments = Array.isArray(d.attachments) ? d.attachments : [];
  for (const att of rawAttachments) {
    const sizeBytes = Number(att?.file_size ?? att?.size ?? 0);
    if (sizeBytes > 5 * 1024 * 1024) {
      throw new FormDataError(`Tệp đính kèm '${att?.file_name || att?.name || ""}' vượt quá giới hạn tối đa 5MB.`);
    }
  }

  const payload: Row = {
    number: String(d.number || "").trim() || undefined,
    posting_date: toApiDate(d.postingDate || d.docDate),
    document_date: toApiDate(d.docDate || d.postingDate),
    employee: employeeText,
    department: d.department || undefined,
    description: String(d.description || "Quyết toán tạm ứng").trim() || "Quyết toán tạm ứng",
    settle_per_advance: settlePerAdvance,
    group_invoices: Boolean(d.groupInvoices || d.group_invoices),
    advance_request: d.advanceRequestId || d.advance_request || undefined,
    cash_advance: d.cashAdvanceId || d.cash_advance || undefined,
    source_advance_ref: sourceAdvanceRef || undefined,
    source_advance_amount: d.sourceAdvanceAmount ? String(num(d.sourceAdvanceAmount)) : undefined,
    references: Array.isArray(d.references) ? d.references : [],
    attachments: rawAttachments,
    accounting_lines: accountingLines,
    tax_lines: taxLines,
    auto_create_employee_if_missing: true,
    save_and_new: Boolean(d.saveAndNew),
    idempotency_key: d.idempotencyKey || undefined,
  };

  const path = "/api/v1/general-ledger/advance-settlements/";
  const record = d.id
    ? await w.put(`${path}${d.id}/`, payload)
    : await w.post(path, payload);

  return {
    record,
    message: record.message || `Đã lưu chứng từ quyết toán tạm ứng ${record.number} thành công.`,
  };
}

/** Danh sách chứng từ quyết toán tạm ứng (UC-GL-02). */
export async function listAdvanceSettlementVouchers(w: ApiWriter) {
  return w.list("/api/v1/general-ledger/advance-settlements/");
}

/** UC-GL-03: Lập chứng từ nghiệp vụ khác (lưu ở trạng thái Chưa ghi sổ - UNPOSTED). */
export async function saveGeneralBusinessVoucher(w: ApiWriter, d: Row) {
  const businessType = String(d.businessType || d.business_type || "1. Hạch toán thuế TNDN phải nộp").trim();
  const isType2 = businessType.startsWith("2.") || businessType === "BANK_LOAN_TO_SUPPLIER";
  const isType3 = businessType.startsWith("3.") || businessType === "SALARY_EXPENSE";
  const isType4 = businessType.startsWith("4.") || businessType === "OTHER";
  const isType5 = businessType.startsWith("5.") || businessType === "OPENING_PROFIT_LOSS_TRANSFER";
  const isType6 = businessType.startsWith("6.") || businessType === "SCT_DEDUCTION";

  const rawRows = Array.isArray(d.rows) ? d.rows : Array.isArray(d.accounting_lines) ? d.accounting_lines : [];
  const validRows = rawRows.filter((row: Row) =>
    String(row.debitAcc || row.debit_account || "").trim() ||
    String(row.creditAcc || row.credit_account || "").trim() ||
    num(row.amount) > 0
  );
  if (!validRows.length) {
    throw new FormDataError("Chứng từ nghiệp vụ khác phải có ít nhất một dòng hạch toán hợp lệ.");
  }

  const accountingLines = validRows.map((row: Row, idx: number) => {
    const debitAcc = String(row.debitAcc || row.debit_account || "").trim();
    const creditAcc = String(row.creditAcc || row.credit_account || "").trim();
    const amount = num(row.amount);

    if (isType3 && !debitAcc) {
      throw new FormDataError(`Dòng hạch toán ${idx + 1}: Nghiệp vụ 'Hạch toán chi phí lương' bắt buộc chọn Tài khoản Nợ (tài khoản chi phí).`);
    }
    if (!debitAcc || !creditAcc) {
      throw new FormDataError(`Dòng hạch toán ${idx + 1}: Vui lòng nhập đầy đủ Tài khoản Nợ và Tài khoản Có.`);
    }
    if (debitAcc === creditAcc) {
      throw new FormDataError(`Dòng hạch toán ${idx + 1}: Tài khoản Nợ và Tài khoản Có (${debitAcc}) không được trùng nhau.`);
    }
    if (!(amount > 0)) {
      throw new FormDataError(`Dòng hạch toán ${idx + 1}: Số tiền phải lớn hơn 0.`);
    }

    const debitObjCode = String(row.debitObject || row.debit_object_code || "").trim();
    const debitObjName = String(row.debitObjectName || row.debit_object_name || "").trim();
    const creditObjCode = String(row.creditObject || row.credit_object_code || "").trim();
    const creditObjName = String(row.creditObjectName || row.credit_object_name || "").trim();
    const loanContract = String(row.loanContract || row.loan_contract || "").trim();

    if (isType2) {
      if (!debitObjCode && !debitObjName) {
        throw new FormDataError(`Dòng hạch toán ${idx + 1}: Nghiệp vụ 'Vay ngân hàng chuyển trả cho nhà cung cấp' bắt buộc nhập Đối tượng Nợ (Nhà cung cấp).`);
      }
      if (!creditObjCode && !creditObjName && !loanContract) {
        throw new FormDataError(`Dòng hạch toán ${idx + 1}: Nghiệp vụ 'Vay ngân hàng chuyển trả cho nhà cung cấp' bắt buộc nhập Đối tượng Có (Ngân hàng) hoặc Khế ước vay.`);
      }
    }

    return {
      description: String(row.desc || row.description || d.description || "Chứng từ nghiệp vụ khác").trim(),
      debit_account: debitAcc,
      credit_account: creditAcc,
      amount: String(amount),
      operation: String(row.operation || "").trim(),
      debit_object_code: debitObjCode,
      debit_object_name: debitObjName,
      credit_object_code: creditObjCode,
      credit_object_name: creditObjName,
      loan_contract: loanContract,
      expense_item: String(row.expenseItem || row.expense_item || "").trim(),
      department: String(row.department || "").trim() || undefined,
      cost_object: String(row.costObject || row.cost_object || "").trim(),
    };
  });

  const rawTaxRows = isType4 && Array.isArray(d.taxRows) ? d.taxRows : [];
  const activeTaxRows = rawTaxRows.filter((tRow: Row) =>
    String(tRow.invoiceNo || tRow.invoice_number || "").trim() ||
    num(tRow.preTaxAmount ?? tRow.pre_tax_amount) > 0 ||
    num(tRow.vatAmount ?? tRow.vat_amount) > 0
  );

  const taxLines = activeTaxRows.map((tRow: Row, idx: number) => {
    const invNo = String(tRow.invoiceNo || tRow.invoice_number || "").trim();
    const invDateRaw = String(tRow.invoiceDate || tRow.invoice_date || "").trim();
    if (!invNo) {
      throw new FormDataError(`Dòng kê khai thuế ${idx + 1}: Vui lòng nhập Số hóa đơn.`);
    }
    if (!invDateRaw) {
      throw new FormDataError(`Dòng kê khai thuế ${idx + 1}: Vui lòng nhập Ngày hóa đơn.`);
    }
    const preTax = num(tRow.preTaxAmount ?? tRow.pre_tax_amount);
    const vatAmt = num(tRow.vatAmount ?? tRow.vat_amount);
    const vatRateStr = String(tRow.vatRate ?? tRow.vat_rate ?? "10").replace("%", "").trim();
    return {
      description: String(tRow.desc || tRow.description || `Thuế GTGT HĐ ${invNo}`).trim(),
      tax_account: String(tRow.debitAcc || tRow.tax_account || "1331").trim(),
      credit_account: String(tRow.creditAcc || tRow.credit_account || "331").trim(),
      goods_group: String(tRow.goodsGroup || tRow.goods_group || "1").trim(),
      pre_tax_amount: String(preTax),
      vat_rate: vatRateStr,
      vat_amount: String(vatAmt),
      invoice_date: toApiDate(invDateRaw),
      invoice_number: invNo,
      invoice_form: String(tRow.invoiceForm || tRow.invoice_form || "1").trim(),
      invoice_serial: String(tRow.invoiceSerial || tRow.invoice_serial || "").trim(),
      supplier_code: String(tRow.partnerCode || tRow.supplier_code || "").trim(),
      supplier_name: String(tRow.partnerName || tRow.supplier_name || "").trim(),
      supplier_tax_code: String(tRow.partnerTaxCode || tRow.supplier_tax_code || "").trim(),
    };
  });

  const groupInvoices = Boolean(d.groupInvoices || d.group_invoices);
  const excludeFromVat = isType6 ? false : Boolean(d.excludeFromVatDeclaration || d.exclude_from_vat_declaration);
  if (excludeFromVat && groupInvoices && taxLines.length > 0) {
    throw new FormDataError("Thiết lập 'Không lên bảng kê thuế GTGT' mâu thuẫn với 'Hạch toán gộp nhiều hóa đơn' trên tab thuế.");
  }

  const rawAttachments = Array.isArray(d.attachments) ? d.attachments : [];
  for (const att of rawAttachments) {
    const sizeBytes = Number(att?.file_size ?? att?.size ?? 0);
    if (sizeBytes > 5 * 1024 * 1024) {
      throw new FormDataError(`Tệp đính kèm '${att?.file_name || att?.name || ""}' vượt quá giới hạn tối đa 5MB.`);
    }
  }

  const rawDueDate = String(d.dueDate || d.due_date || "").trim();
  const hasDueDate = !businessType.startsWith("1.") && !isType5 && rawDueDate && rawDueDate.toUpperCase() !== "DD/MM/YYYY";

  const payload: Row = {
    number: String(d.number || "").trim() || undefined,
    business_type: businessType,
    closing_year: isType5 ? Number(d.closingYear || d.closing_year || 2026) : undefined,
    posting_date: toApiDate(d.postingDate || d.docDate),
    document_date: toApiDate(d.docDate || d.postingDate),
    due_date: hasDueDate ? toApiDate(rawDueDate) : undefined,
    description: String(d.description || "Chứng từ nghiệp vụ khác").trim(),
    references: d.references || "",
    group_invoices: groupInvoices,
    exclude_from_vat_declaration: excludeFromVat,
    attachments: rawAttachments,
    accounting_lines: accountingLines,
    tax_lines: taxLines,
    auto_reallocate_number: !d.id,
    save_and_print: Boolean(d.saveAndPrint),
    idempotency_key: d.idempotencyKey || undefined,
  };

  const path = "/api/v1/general-ledger/general-vouchers/";
  const record = d.id
    ? await w.put(`${path}${d.id}/`, payload)
    : await w.post(path, payload);

  return {
    record,
    message: record.message || `Đã lưu chứng từ nghiệp vụ khác ${record.number} thành công.`,
  };
}

/** UC-GL-03 AF-16: Nhập chứng từ nghiệp vụ khác từ Excel. */
export async function importGeneralBusinessVouchersExcel(w: ApiWriter, vouchers: Row[]) {
  const record = await w.post("/api/v1/general-ledger/general-vouchers/import-excel/", {
    vouchers,
  });
  return {
    record,
    message: record.message || `Đã nhập thành công ${record.count || vouchers.length} chứng từ nghiệp vụ khác từ Excel.`,
  };
}

/**
 * UC-GL-04 – Tiếp nhận bút toán từ các phân hệ (PUR, AP, SAL, AR, CASH, BANK, INV, FA, TOOLS, PAYROLL, TAX, COST).
 */
export async function ingestSubledgerJournalEvent(w: ApiWriter, d: Row) {
  const sourceModule = String(d.sourceModule || d.source_module || "PUR").trim().toUpperCase();
  const sourceBusinessType = String(d.sourceBusinessType || d.source_business_type || "PURCHASE_GOODS").trim().toUpperCase();
  const sourceDocumentNumber = String(d.sourceDocumentNumber || d.source_document_number || "").trim();
  const sourceDocumentId = String(d.sourceDocumentId || d.source_document_id || sourceDocumentNumber).trim();
  const sourceEventId = String(
    d.sourceEventId || d.source_event_id || `EVT-${sourceModule}-${sourceDocumentNumber}-${Date.now()}`
  ).trim();

  if (!sourceDocumentNumber) {
    throw new FormDataError("Vui lòng nhập Số chứng từ nguồn (source_document_number).");
  }

  const rawLines = Array.isArray(d.lines) ? d.lines : [];
  const normalizedLines = rawLines
    .filter((ln: Row) => String(ln.account || ln.debitAcc || "").trim())
    .map((ln: Row) => ({
      account: String(ln.account || "").trim() || undefined,
      debit_account: String(ln.debitAcc || ln.debit_account || "").trim() || undefined,
      credit_account: String(ln.creditAcc || ln.credit_account || "").trim() || undefined,
      debit: ln.debit !== undefined ? cleanNum(ln.debit) : undefined,
      credit: ln.credit !== undefined ? cleanNum(ln.credit) : undefined,
      amount: ln.amount !== undefined ? cleanNum(ln.amount) : undefined,
      foreign_amount: ln.foreignAmount !== undefined ? cleanNum(ln.foreignAmount) : undefined,
      description: String(ln.description || d.description || "").trim(),
      party: String(ln.party || d.party || "").trim() || undefined,
      department: String(ln.department || d.department || "").trim() || undefined,
      project: String(ln.project || d.project || "").trim() || undefined,
      cost_center: String(ln.costCenter || d.costCenter || "").trim() || undefined,
    }));

  const payload: Row = {
    source_module: sourceModule,
    source_business_type: sourceBusinessType,
    source_document_type: String(d.sourceDocumentType || d.source_document_type || sourceModule).trim(),
    source_document_id: sourceDocumentId,
    source_document_number: sourceDocumentNumber,
    source_document_status: String(d.sourceDocumentStatus || d.source_document_status || "ELIGIBLE").trim().toUpperCase(),
    source_event_id: sourceEventId,
    posting_date: toApiDate(d.postingDate || d.posting_date),
    document_date: toApiDate(d.documentDate || d.document_date || d.postingDate),
    description: String(d.description || `Tiếp nhận bút toán ${sourceModule} - ${sourceDocumentNumber}`).trim(),
    currency: String(d.currency || "VND").trim().toUpperCase(),
    exchange_rate: cleanNum(d.exchangeRate || d.exchange_rate, 1),
    posting_mode: String(d.postingMode || d.posting_mode || "AUTO_POST").trim().toUpperCase(),
    party: String(d.party || "").trim() || undefined,
    department: String(d.department || "").trim() || undefined,
    project: String(d.project || "").trim() || undefined,
    cost_center: String(d.costCenter || d.cost_center || "").trim() || undefined,
    amount: d.amount !== undefined ? cleanNum(d.amount) : undefined,
    tax_amount: d.taxAmount !== undefined ? cleanNum(d.taxAmount) : undefined,
    lines: normalizedLines.length > 0 ? normalizedLines : undefined,
    entry_groups: Array.isArray(d.entryGroups) && d.entryGroups.length > 0 ? d.entryGroups : undefined,
    use_default_rule: d.useDefaultRule !== undefined ? Boolean(d.useDefaultRule) : true,
  };

  const record = await w.post("/api/v1/general-ledger/subledger-ingestions/ingest/", payload);
  return {
    record,
    message:
      record.message ||
      `Đã tiếp nhận bút toán từ phân hệ ${sourceModule} (${sourceDocumentNumber}) - trạng thái ${record.status}.`,
  };
}

/** UC-GL-04 BR-GL-INT-43: Thử lại (Retry) bản ghi tiếp nhận bút toán bị lỗi (ERROR). */
export async function retrySubledgerJournalIngestion(w: ApiWriter, ingestionId: string, overridePayload: Row = {}) {
  const record = await w.post(`/api/v1/general-ledger/subledger-ingestions/${ingestionId}/retry/`, overridePayload);
  return {
    record,
    message: record.message || `Đã thử lại tiếp nhận bút toán thành công (trạng thái: ${record.status}).`,
  };
}

/** UC-GL-04 AF-08: Ghi sổ bút toán tiếp nhận đang ở trạng thái UNPOSTED vào Sổ cái. */
export async function postSubledgerJournalIngestion(w: ApiWriter, ingestionId: string) {
  const record = await w.post(`/api/v1/general-ledger/subledger-ingestions/${ingestionId}/post/`, {});
  return {
    record,
    message: record.message || `Đã ghi sổ chính thức bút toán ${record.primary_journal_number || ""} vào Sổ cái.`,
  };
}

/** UC-GL-04 EF-24: Đồng bộ lại trạng thái callback về phân hệ nguồn. */
export async function retrySubledgerSourceCallback(w: ApiWriter, ingestionId: string) {
  const record = await w.post(`/api/v1/general-ledger/subledger-ingestions/${ingestionId}/retry-callback/`, {});
  return {
    record,
    message: record.message || "Đã đồng bộ lại phản hồi trạng thái về phân hệ nguồn.",
  };
}

/**
 * ===================================================================== * UC-GL-05 – GHI SỔ / BỎ GHI SỔ BÚT TOÁN (POST / UNPOST JOURNAL ENTRIES)
 * ===================================================================== */

/** UC-GL-05 Main Flow: Ghi sổ một bút toán Sổ cái (UNPOSTED -> POSTED). */
export async function postJournalEntry(w: ApiWriter, entryId: string, options: Row = {}) {
  const record = await w.post(`/api/v1/general-ledger/journals/${entryId}/post/`, options);
  return {
    record,
    message:
      record.message ||
      `Đã ghi sổ chính thức bút toán ${record.number || ""} vào Sổ cái (Mã tham chiếu: ${record.posting_reference || "N/A"}).`,
  };
}

/** UC-GL-05 AF-06..AF-18: Bỏ ghi sổ một bút toán Sổ cái (POSTED -> UNPOSTED). */
export async function unpostJournalEntry(w: ApiWriter, entryId: string, options: Row = {}) {
  const record = await w.post(`/api/v1/general-ledger/journals/${entryId}/unpost/`, options);
  return {
    record,
    message:
      record.message ||
      `Đã bỏ ghi sổ bút toán ${record.number || ""} khỏi Sổ cái, đưa về trạng thái chưa ghi sổ.`,
  };
}

/** UC-GL-05 AF-22: Ghi sổ hàng loạt nhiều bút toán/chứng từ. */
export async function batchPostJournalEntries(w: ApiWriter, journalIds: string[], options: Row = {}) {
  const record = await w.post("/api/v1/general-ledger/journals/batch-post/", {
    journal_ids: journalIds,
    ...options,
  });
  return {
    record,
    message:
      record.message ||
      `Đã ghi sổ hàng loạt: thành công ${record.succeeded_count ?? 0}/${record.total ?? journalIds.length}.`,
  };
}

/** UC-GL-05 AF-23: Bỏ ghi sổ hàng loạt nhiều bút toán/chứng từ. */
export async function batchUnpostJournalEntries(w: ApiWriter, journalIds: string[], options: Row = {}) {
  const record = await w.post("/api/v1/general-ledger/journals/batch-unpost/", {
    journal_ids: journalIds,
    ...options,
  });
  return {
    record,
    message:
      record.message ||
      `Đã bỏ ghi sổ hàng loạt: thành công ${record.succeeded_count ?? 0}/${record.total ?? journalIds.length}.`,
  };
}

/** UC-GL-05 + UC-GL-03: Ghi sổ Chứng từ nghiệp vụ khác (NVK). */
export async function postGeneralBusinessVoucher(w: ApiWriter, voucherId: string, options: Row = {}) {
  const record = await w.post(`/api/v1/general-ledger/general-vouchers/${voucherId}/post/`, options);
  return {
    record,
    message: record.message || `Đã ghi sổ chứng từ nghiệp vụ khác ${record.number || ""} thành công.`,
  };
}

/** UC-GL-05 + UC-GL-03: Bỏ ghi sổ Chứng từ nghiệp vụ khác (NVK). */
export async function unpostGeneralBusinessVoucher(w: ApiWriter, voucherId: string, options: Row = {}) {
  const record = await w.post(`/api/v1/general-ledger/general-vouchers/${voucherId}/unpost/`, options);
  return {
    record,
    message: record.message || `Đã bỏ ghi sổ chứng từ nghiệp vụ khác ${record.number || ""} thành công.`,
  };
}

/** UC-GL-05 + UC-GL-02: Ghi sổ Chứng từ quyết toán tạm ứng (QTTU). */
export async function postAdvanceSettlementVoucher(w: ApiWriter, voucherId: string, options: Row = {}) {
  const record = await w.post(`/api/v1/general-ledger/advance-settlements/${voucherId}/post/`, options);
  return {
    record,
    message: record.message || `Đã ghi sổ chứng từ quyết toán tạm ứng ${record.number || ""} thành công.`,
  };
}

/** UC-GL-05 + UC-GL-02: Bỏ ghi sổ Chứng từ quyết toán tạm ứng (QTTU). */
export async function unpostAdvanceSettlementVoucher(w: ApiWriter, voucherId: string, options: Row = {}) {
  const record = await w.post(`/api/v1/general-ledger/advance-settlements/${voucherId}/unpost/`, options);
  return {
    record,
    message: record.message || `Đã bỏ ghi sổ chứng từ quyết toán tạm ứng ${record.number || ""} thành công.`,
  };
}

/** UC-GL-05 + UC-GL-04: Bỏ ghi sổ bút toán tiếp nhận phân hệ (khi có xác nhận từ nguồn). */
export async function unpostSubledgerJournalIngestion(w: ApiWriter, ingestionId: string, options: Row = {}) {
  const record = await w.post(`/api/v1/general-ledger/subledger-ingestions/${ingestionId}/unpost/`, options);
  return {
    record,
    message: record.message || `Đã bỏ ghi sổ bút toán phân hệ ${record.primary_journal_number || ""} khỏi Sổ cái.`,
  };
}

/**
 * ===================================================================== * UC-GL-06 – ĐIỀU CHỈNH / ĐẢO BÚT TOÁN (ADJUST / REVERSE JOURNAL ENTRIES)
 * ===================================================================== */

/** UC-GL-06 (AF-01, AF-07..10): Điều chỉnh bút toán đã ghi sổ (POSTED). */
export async function adjustJournalEntry(w: ApiWriter, entryId: string, d: Row) {
  const reason = String(d.reason || d.correction_reason || "").trim();
  if (!reason) {
    throw new FormDataError("Vui lòng nhập Lý do điều chỉnh bút toán (BR-GL-ADJ-14).");
  }
  const rawRows = Array.isArray(d.accounting_lines)
    ? d.accounting_lines
    : Array.isArray(d.adjustment_lines)
    ? d.adjustment_lines
    : Array.isArray(d.rows)
    ? d.rows
    : [];
  const accountingLines = rawRows
    .filter((r: Row) => String(r.debitAcc || r.debit_account || "").trim() || String(r.creditAcc || r.credit_account || "").trim())
    .map((r: Row) => ({
      description: String(r.desc || r.description || d.description || reason).trim(),
      debit_account: String(r.debitAcc || r.debit_account || "").trim(),
      credit_account: String(r.creditAcc || r.credit_account || "").trim(),
      amount: String(cleanNum(r.amount)),
      debit_object_code: String(r.debitObject || r.debit_object_code || "").trim() || undefined,
      credit_object_code: String(r.creditObject || r.credit_object_code || "").trim() || undefined,
      department: String(r.department || "").trim() || undefined,
      project: String(r.project || "").trim() || undefined,
      cost_center: String(r.costCenter || r.cost_center || "").trim() || undefined,
    }));

  const payload: Row = {
    reason,
    posting_date: toApiDate(d.postingDate || d.posting_date),
    document_date: toApiDate(d.documentDate || d.document_date || d.postingDate || d.posting_date),
    number: String(d.number || "").trim() || undefined,
    description: String(d.description || "").trim() || undefined,
    adjustment_mode: String(d.adjustmentMode || d.adjustment_mode || "GENERAL").trim().toUpperCase(),
    accounting_lines: accountingLines.length > 0 ? accountingLines : undefined,
    lines: Array.isArray(d.lines) && d.lines.length > 0 ? d.lines : undefined,
    auto_post: Boolean(d.autoPost || d.auto_post),
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
  };
  const record = await w.post(`/api/v1/general-ledger/journals/${entryId}/adjust/`, payload);
  return {
    record,
    message: record.message || `Đã tạo bút toán điều chỉnh ${record.number || ""} thành công.`,
  };
}

/** UC-GL-06 (AF-02, AF-11..13): Đảo bút toán đã ghi sổ (POSTED). */
export async function reverseJournalEntry(w: ApiWriter, entryId: string, d: Row) {
  const reason = String(d.reason || d.correction_reason || "").trim();
  if (!reason) {
    throw new FormDataError("Vui lòng nhập Lý do đảo bút toán (BR-GL-ADJ-14).");
  }
  const payload: Row = {
    reason,
    posting_date: toApiDate(d.postingDate || d.posting_date),
    document_date: toApiDate(d.documentDate || d.document_date || d.postingDate || d.posting_date),
    number: String(d.number || "").trim() || undefined,
    description: String(d.description || "").trim() || undefined,
    reversal_method: String(d.reversalMethod || d.reversal_method || "SWAP_DEBIT_CREDIT").trim().toUpperCase(),
    reversal_amount: d.reversalAmount !== undefined || d.reversal_amount !== undefined
      ? String(cleanNum(d.reversalAmount ?? d.reversal_amount))
      : undefined,
    reversal_percent: d.reversalPercent !== undefined || d.reversal_percent !== undefined
      ? String(cleanNum(d.reversalPercent ?? d.reversal_percent))
      : undefined,
    auto_post: Boolean(d.autoPost || d.auto_post),
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
  };
  const record = await w.post(`/api/v1/general-ledger/journals/${entryId}/reverse/`, payload);
  return {
    record,
    message: record.message || `Đã tạo bút toán đảo ${record.number || ""} thành công.`,
  };
}

/** UC-GL-06 (AF-18, BR-GL-ADJ-68): Lập lại chứng từ đúng sau khi đảo. */
export async function createReplacementJournalEntry(w: ApiWriter, entryId: string, d: Row) {
  const record = await w.post(`/api/v1/general-ledger/journals/${entryId}/create-replacement/`, d);
  return {
    record,
    message: record.message || `Đã tạo bút toán lập lại thay thế ${record.number || ""} thành công.`,
  };
}

/** UC-GL-06 + UC-GL-03: Điều chỉnh từ Chứng từ nghiệp vụ khác đã ghi sổ. */
export async function adjustGeneralBusinessVoucher(w: ApiWriter, voucherId: string, d: Row) {
  const record = await w.post(`/api/v1/general-ledger/general-vouchers/${voucherId}/adjust/`, d);
  return {
    record,
    message: record.message || `Đã tạo bút toán điều chỉnh ${record.number || ""} thành công.`,
  };
}

/** UC-GL-06 + UC-GL-03: Đảo bút toán từ Chứng từ nghiệp vụ khác đã ghi sổ. */
export async function reverseGeneralBusinessVoucher(w: ApiWriter, voucherId: string, d: Row) {
  const record = await w.post(`/api/v1/general-ledger/general-vouchers/${voucherId}/reverse/`, d);
  return {
    record,
    message: record.message || `Đã tạo bút toán đảo ${record.number || ""} thành công.`,
  };
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

/** UC-FA-10 (Main Flow B & AF02): "Thêm chi phí trả trước" (opening = false) và "Chi phí trả trước đầu kỳ" (opening = true). */
export async function savePrepaidExpense(w: ApiWriter, d: Row, opening: boolean) {
  const code = String(d.code || "").trim();
  const name = String(d.name || "").trim();
  if (!code) throw new FormDataError("Mã chi phí trả trước không hợp lệ hoặc đã tồn tại.");
  if (!name) throw new FormDataError("Vui lòng nhập tên chi phí trả trước.");
  const amount = num(d.amount);
  const periods = Math.round(num(d.allocMonths));
  if (!(amount > 0)) throw new FormDataError("Số tiền chi phí trả trước phải lớn hơn 0.");
  if (!(periods > 0)) throw new FormDataError("Số kỳ phân bổ phải là số nguyên lớn hơn 0.");

  const rawRows = Array.isArray(d.rows) ? d.rows : [];
  const targets = rawRows.filter((row: Row) => String(row.costAccount || row.targetCode || row.targetName || "").trim());
  if (!targets.length) {
    throw new FormDataError("Vui lòng khai báo đầy đủ thông tin thiết lập phân bổ.");
  }
  const rates = targets.map((row: Row) => num(row.rate));
  if (targets.length === 1 && !rates[0]) rates[0] = 100;
  if (Math.abs(rates.reduce((total: number, rate: number) => total + rate, 0) - 100) > 0.0001) {
    throw new FormDataError("Tổng tỷ lệ phân bổ phải bằng 100%.");
  }

  const remainingPeriods = Math.round(num(d.remainingMonths));
  const allocatedAmount = num(d.allocatedAmount);
  const remainingAmount = d.remainingAmount !== undefined ? num(d.remainingAmount) : Math.max(0, amount - allocatedAmount);
  const periodicAmount = d.monthlyAlloc !== undefined && num(d.monthlyAlloc) > 0
    ? num(d.monthlyAlloc)
    : Math.round(amount / periods);

  const resp = await w.post(`${FIXED_ASSETS}assets/prepaid-expenses/`, {
    is_opening: opening,
    code,
    name,
    record_date: String(d.recordDate || "").trim(),
    start_date: String(d.startDate || d.recordDate || "").trim(),
    amount: String(amount),
    allocation_periods: periods,
    periodic_allocation_amount: String(periodicAmount),
    remaining_periods: opening ? remainingPeriods : undefined,
    allocated_amount: opening ? String(allocatedAmount) : undefined,
    remaining_amount: opening ? String(remainingAmount) : undefined,
    waiting_account: String(d.waitingAcc || "242").trim(),
    suspend_allocation: Boolean(d.stopAlloc),
    suspend_reason: String(d.suspendReason || "Tạm dừng phân bổ theo thiết lập"),
    references: Array.isArray(d.references) ? d.references : [],
    source_documents: Array.isArray(d.sourceDocs) ? d.sourceDocs : [],
    allocations: targets.map((row: Row, index: number) => ({
      target_code: String(row.targetCode || "").trim(),
      target_name: String(row.targetName || "").trim(),
      rate: String(rates[index]),
      expense_account: String(row.costAccount || "6422").trim(),
      cost_item: String(row.costItem || "").trim(),
      stats_code: String(row.statCode || "").trim(),
    })),
  });

  return {
    record: resp.prepaid_expense || resp,
    message: resp.message || (opening ? "Đã lưu chi phí trả trước đầu kỳ thành công." : "Đã lưu chi phí trả trước thành công."),
  };
}

/** UC-FA-10 (AF18, EF38): Nhập chi phí trả trước từ Excel. */
export async function importPrepaidExpensesExcel(w: ApiWriter, d: Row) {
  const resp = await w.post(`${FIXED_ASSETS}assets/prepaid-expenses/import-excel/`, {
    file_name: String(d.fileName || "Mau_Chi_Phi_Tra_Truoc.xlsx").trim(),
    sheet_name: String(d.sheetName || "Sheet1").trim(),
    header_row: Number(d.headerRow || 1),
    auto_map_ai: Boolean(d.autoMap ?? true),
    columns: Array.isArray(d.columns) ? d.columns : undefined,
    rows: Array.isArray(d.rows) ? d.rows : [],
  });
  return {
    record: resp,
    message: resp.message || `Đã nhập khẩu thành công ${resp.imported_count || 0} khoản chi phí trả trước từ Excel.`,
  };
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

/** "Ghi giảm chi phí trả trước" (UC-FA-14 Main Flow B): ghi giảm toàn bộ hoặc một phần giá trị chưa phân bổ của CPTT. */
export async function savePrepaidDecrease(w: ApiWriter, d: Row) {
  try {
    return await savePrepaidDecreaseUc14(w, d);
  } catch (err) {
    if (err instanceof FormDataError) throw err;
    const msg = errorText(err);
    if (msg && !msg.includes("404") && !msg.includes("Not Found")) {
      throw new FormDataError(msg);
    }
  }
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
  return { record, message: `Đã lưu chứng từ ghi giảm chi phí trả trước ${record.number} thành công.` };
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

/* ───────────────────────────── UC-GL-01: Đề nghị quyết toán tạm ứng ───────────────────────────── */

const GL_ADVANCE_REQUESTS = "/api/v1/general-ledger/advance-requests/";

/** UC-GL-01 (Main Flow Steps 1–20): Tạo mới và gửi phê duyệt đề nghị quyết toán tạm ứng. */
export async function saveAdvanceSettlementRequest(w: ApiWriter, d: Row) {
  const requester = String(d.requester || d.requester_id || d.employee || "").trim();
  if (!requester) {
    throw new FormDataError("Người đề nghị là bắt buộc.");
  }
  const rawAmount = d.amount;
  if (rawAmount === undefined || rawAmount === null || String(rawAmount).trim() === "") {
    throw new FormDataError("Số tiền đề nghị quyết toán là bắt buộc.");
  }
  const amountNum = Number(String(rawAmount).replace(/,/g, "").trim());
  if (!Number.isFinite(amountNum)) {
    throw new FormDataError("Số tiền đề nghị quyết toán không hợp lệ.");
  }
  if (amountNum <= 0) {
    throw new FormDataError("Số tiền đề nghị quyết toán phải lớn hơn 0.");
  }
  const purpose = String(d.purpose ?? d.description ?? "").trim();
  if (!purpose) {
    throw new FormDataError("Mục đích/Diễn giải là bắt buộc và không được chỉ chứa khoảng trắng.");
  }

  const record = await w.post(GL_ADVANCE_REQUESTS, {
    company: w.companyId,
    company_id: w.companyId,
    requester,
    department: d.department || d.department_id || undefined,
    amount: String(amountNum),
    purpose,
    request_date: d.requestDate ? toApiDate(d.requestDate) : undefined,
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
    auto_create_employee_if_missing: Boolean(d.autoCreateEmployeeIfMissing ?? true),
    workflow_snapshot: d.workflowSnapshot || d.workflow_snapshot || undefined,
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || "Đã gửi đề nghị quyết toán tạm ứng lên cấp duyệt."),
  };
}

/** UC-GL-01 (Steps 21–32, AF-04..09): Phê duyệt, Yêu cầu bổ sung hoặc Từ chối đề nghị quyết toán tạm ứng. */
export async function decideAdvanceSettlementRequest(
  w: ApiWriter,
  id: string,
  decision: "approve" | "reject" | "request-info",
  d: Row = {},
) {
  const record = await w.action(GL_ADVANCE_REQUESTS, id, decision, {
    company: w.companyId,
    company_id: w.companyId,
    comment: String(d.comment || d.reason || "").trim(),
    version: d.version,
    sync_mode: d.syncMode || d.sync_mode || undefined,
    simulate_sync_error: d.simulateSyncError ?? d.simulate_sync_error ?? undefined,
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || "Đã cập nhật trạng thái phê duyệt đề nghị quyết toán tạm ứng."),
  };
}

/** UC-GL-01 (AF-05): Bổ sung thông tin và gửi phê duyệt lại đề nghị quyết toán tạm ứng. */
export async function resubmitAdvanceSettlementRequest(w: ApiWriter, id: string, d: Row) {
  const record = await w.action(GL_ADVANCE_REQUESTS, id, "resubmit", {
    company: w.companyId,
    company_id: w.companyId,
    requester: d.requester || d.requester_id || undefined,
    department: d.department || d.department_id || undefined,
    amount: d.amount !== undefined ? String(Number(String(d.amount).replace(/,/g, "").trim())) : undefined,
    purpose: d.purpose !== undefined ? String(d.purpose).trim() : undefined,
    comment: String(d.comment || "Bổ sung thông tin và gửi duyệt lại").trim(),
    version: d.version,
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || "Đã gửi đề nghị quyết toán tạm ứng lên cấp duyệt."),
  };
}

/** UC-GL-01 (EF-17, EF-18): Thử đồng bộ lại đề nghị đã duyệt sang danh sách quyết toán. */
export async function retrySyncAdvanceSettlementRequest(w: ApiWriter, id: string) {
  const record = await w.action(GL_ADVANCE_REQUESTS, id, "retry-sync", {
    company: w.companyId,
    company_id: w.companyId,
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || "Đã đồng bộ thành công đề nghị sang danh sách quyết toán."),
  };
}

/** UC-GL-01 -> UC-GL-02 (AF-11, BR-GL-ADV-33, BR-GL-ADV-40): Đánh dấu kế thừa đề nghị sang chứng từ quyết toán tạm ứng. */
export async function inheritAdvanceRequestForSettlement(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_ADVANCE_REQUESTS, id, "inherit-to-settlement", {
    company: w.companyId,
    company_id: w.companyId,
    settlement_voucher_no: d.settlementVoucherNo || d.settlement_voucher_no || undefined,
    settlement_entry: d.settlementEntry || d.settlement_entry || undefined,
  });
  w.invalidate();
  return {
    record,
    message: String(record?.message || "Đã kế thừa đề nghị vào chứng từ quyết toán tạm ứng."),
  };
}

/* ───────────────────────────── UC-GL-07: Phân bổ chi phí bán hàng, QLDN và chi phí khác ───────────────────────────── */

const GL_ALLOCATION_RUNS = "/api/v1/general-ledger/allocation-runs/";

/** UC-GL-07 (Steps 7–12, AF-03, AF-19): Lấy số liệu chi phí nguồn đã POSTED và kiểm tra phần còn lại được phép phân bổ. */
export async function fetchAllocationSourceData(w: ApiWriter, d: Row) {
  const record = await w.post(`${GL_ALLOCATION_RUNS}fetch-source/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.period_id || undefined,
    posting_date: d.postingDate || d.posting_date ? toApiDate(d.postingDate || d.posting_date) : undefined,
    document_date: d.documentDate || d.document_date ? toApiDate(d.documentDate || d.document_date) : undefined,
    rule: d.rule || d.rule_id || undefined,
    source_account: d.sourceAccount || d.source_account || undefined,
    source_account_codes: d.sourceAccountCodes || d.source_account_codes || undefined,
    source_filter: d.sourceFilter || d.source_filter || undefined,
    exclude_run_id: d.excludeRunId || d.exclude_run_id || undefined,
  });
  return {
    record,
    message: "Đã tải dữ liệu chi phí nguồn cần phân bổ.",
  };
}

/** UC-GL-07 (Steps 13–25, AF-04..11): Tính phân bổ chi phí và xử lý làm tròn ở trạng thái CALCULATED. */
export async function calculateExpenseAllocation(w: ApiWriter, d: Row) {
  const record = await w.post(`${GL_ALLOCATION_RUNS}calculate/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.period_id || undefined,
    posting_date: d.postingDate || d.posting_date ? toApiDate(d.postingDate || d.posting_date) : undefined,
    document_date: d.documentDate || d.document_date ? toApiDate(d.documentDate || d.document_date) : undefined,
    rule: d.rule || d.rule_id || undefined,
    allocation_group: d.allocationGroup || d.allocation_group || "ADMIN",
    source_account: d.sourceAccount || d.source_account || undefined,
    source_account_codes: d.sourceAccountCodes || d.source_account_codes || undefined,
    offset_account: d.offsetAccount || d.offset_account || undefined,
    source_filter: d.sourceFilter || d.source_filter || undefined,
    method: d.method || "FIXED_PERCENT",
    rounding_method: d.roundingMethod || d.rounding_method || "LAST_LINE",
    amount_to_allocate: d.amountToAllocate || d.amount_to_allocate || undefined,
    destinations: Array.isArray(d.destinations) ? d.destinations : undefined,
    description: d.description || undefined,
    save_calculation: Boolean(d.saveCalculation ?? d.save_calculation ?? false),
  });
  return {
    record,
    message: "Đã tính toán kết quả phân bổ chi phí.",
  };
}

/** UC-GL-07 (Steps 26–50, AF-13..15): Xác nhận tạo chứng từ phân bổ ở trạng thái UNPOSTED (hoặc tự động POST nếu auto_post=true). */
export async function confirmExpenseAllocation(w: ApiWriter, d: Row) {
  const record = await w.post(`${GL_ALLOCATION_RUNS}confirm/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.period_id || undefined,
    number: d.number || d.voucherNo || undefined,
    posting_date: d.postingDate || d.posting_date ? toApiDate(d.postingDate || d.posting_date) : undefined,
    document_date: d.documentDate || d.document_date ? toApiDate(d.documentDate || d.document_date) : undefined,
    rule: d.rule || d.rule_id || undefined,
    allocation_group: d.allocationGroup || d.allocation_group || "ADMIN",
    source_account: d.sourceAccount || d.source_account || undefined,
    source_account_codes: d.sourceAccountCodes || d.source_account_codes || undefined,
    offset_account: d.offsetAccount || d.offset_account || undefined,
    source_filter: d.sourceFilter || d.source_filter || undefined,
    method: d.method || "FIXED_PERCENT",
    rounding_method: d.roundingMethod || d.rounding_method || "LAST_LINE",
    amount_to_allocate: d.amountToAllocate || d.amount_to_allocate || undefined,
    destinations: Array.isArray(d.destinations) ? d.destinations : undefined,
    description: d.description || undefined,
    expected_source_fingerprint: d.expectedSourceFingerprint || d.expected_source_fingerprint || undefined,
    replace_run_id: d.replaceRunId || d.replace_run_id || undefined,
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
    auto_post: Boolean(d.autoPost ?? d.auto_post ?? false),
  });
  w.invalidate();
  return {
    record,
    message: record?.status === "POSTED"
      ? `Đã tạo và ghi sổ chứng từ phân bổ ${record?.number || ""}.`
      : `Đã tạo chứng từ phân bổ ${record?.number || ""} ở trạng thái Chưa ghi sổ (UNPOSTED).`,
  };
}

/** UC-GL-07 (Step 50, UC-GL-05): Ghi sổ chứng từ phân bổ đang ở trạng thái UNPOSTED. */
export async function postAllocationRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_ALLOCATION_RUNS, id, "post", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || undefined,
  });
  w.invalidate();
  return {
    record,
    message: `Đã ghi sổ chứng từ phân bổ ${record?.number || id}.`,
  };
}

/** UC-GL-07 (AF-16, UC-GL-05): Bỏ ghi sổ chứng từ phân bổ đã POSTED về UNPOSTED. */
export async function unpostAllocationRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_ALLOCATION_RUNS, id, "unpost", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || "Bỏ ghi sổ chứng từ phân bổ để chạy lại",
  });
  w.invalidate();
  return {
    record,
    message: `Đã bỏ ghi sổ chứng từ phân bổ ${record?.number || id}.`,
  };
}

/** UC-GL-07 (AF-17, UC-GL-06): Đảo bút toán phân bổ đã POSTED để giải phóng nguồn chi phí và phân bổ lại. */
export async function reverseAllocationRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_ALLOCATION_RUNS, id, "reverse", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || "Đảo bút toán phân bổ chi phí",
    posting_date: d.postingDate || d.posting_date ? toApiDate(d.postingDate || d.posting_date) : undefined,
    auto_post: Boolean(d.autoPost ?? d.auto_post ?? true),
  });
  w.invalidate();
  return {
    record,
    message: `Đã tạo bút toán đảo cho đợt phân bổ ${record?.number || id}.`,
  };
}

/** UC-GL-07 (AF-12, AF-16): Hủy đợt phân bổ chưa ghi sổ (UNPOSTED / CALCULATED) để giải phóng nguồn. */
export async function cancelAllocationRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_ALLOCATION_RUNS, id, "cancel", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || "Hủy đợt phân bổ chưa ghi sổ",
  });
  w.invalidate();
  return {
    record,
    message: `Đã hủy đợt phân bổ ${record?.number || id}.`,
  };
}

/** UC-GL-07 (Steps 43–44, BR-GL-ALLOC-51, 52, 69..72): Truy vết hai chiều chứng từ phân bổ và nguồn chi phí. */
export async function fetchAllocationTrace(w: ApiWriter, id: string) {
  return await w.get(`${GL_ALLOCATION_RUNS}${encodeURIComponent(id)}/trace/?company_id=${encodeURIComponent(w.companyId)}`);
}

/* ───────────────────────────── UC-GL-08: Đánh giá lại tài khoản ngoại tệ ───────────────────────────── */

const GL_FX_REVALUATION_RUNS = "/api/v1/general-ledger/fx-revaluation-runs/";

/** UC-GL-08 (Steps 6–9, AF-02..05): Lấy danh sách tài khoản tiền tệ có gốc ngoại tệ và số dư nguyên tệ / giá trị ghi sổ. */
export async function fetchFxRevaluationBalances(w: ApiWriter, d: Row) {
  const record = await w.post(`${GL_FX_REVALUATION_RUNS}fetch-balances/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.period_id || undefined,
    revaluation_date: d.revaluationDate || d.revaluation_date ? toApiDate(d.revaluationDate || d.revaluation_date) : undefined,
    posting_date: d.postingDate || d.posting_date ? toApiDate(d.postingDate || d.posting_date) : undefined,
    document_date: d.documentDate || d.document_date ? toApiDate(d.documentDate || d.document_date) : undefined,
    currency: d.currency || d.currencyCode || d.currency_code || "USD",
    account_scope: d.accountScope || d.account_scope || "ALL",
    account_ids: d.accountIds || d.account_ids || undefined,
    account_codes: d.accountCodes || d.account_codes || undefined,
    item_groups: d.itemGroups || d.item_groups || undefined,
  });
  return {
    record,
    message: "Đã tải danh sách khoản mục ngoại tệ cần đánh giá lại.",
  };
}

/** UC-GL-08 (Steps 10–25, AF-01..09): Tính giá trị quy đổi cuối kỳ, chênh lệch tỷ giá tăng/giảm (Lãi/Lỗ) và định khoản dự kiến. */
export async function calculateFxRevaluation(w: ApiWriter, d: Row) {
  const record = await w.post(`${GL_FX_REVALUATION_RUNS}calculate/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.period_id || undefined,
    revaluation_date: d.revaluationDate || d.revaluation_date ? toApiDate(d.revaluationDate || d.revaluation_date) : undefined,
    posting_date: d.postingDate || d.posting_date ? toApiDate(d.postingDate || d.posting_date) : undefined,
    document_date: d.documentDate || d.document_date ? toApiDate(d.documentDate || d.document_date) : undefined,
    currency: d.currency || d.currencyCode || d.currency_code || "USD",
    exchange_rate: d.exchangeRate || d.exchange_rate || undefined,
    rate_type: d.rateType || d.rate_type || undefined,
    rate_source: d.rateSource || d.rate_source || undefined,
    account_scope: d.accountScope || d.account_scope || "ALL",
    account_ids: d.accountIds || d.account_ids || undefined,
    account_codes: d.accountCodes || d.account_codes || undefined,
    item_groups: d.itemGroups || d.item_groups || undefined,
    fx_difference_account: d.fxDifferenceAccount || d.fx_difference_account || undefined,
    fx_gain_account: d.fxGainAccount || d.fx_gain_account || undefined,
    fx_loss_account: d.fxLossAccount || d.fx_loss_account || undefined,
    selected_line_keys: d.selectedLineKeys || d.selected_line_keys || undefined,
    line_overrides: d.lineOverrides || d.line_overrides || undefined,
    description: d.description || undefined,
    save_calculation: Boolean(d.saveCalculation ?? d.save_calculation ?? false),
  });
  return {
    record,
    message: "Đã tính toán kết quả đánh giá lại tài khoản ngoại tệ.",
  };
}

/** UC-GL-08 (Steps 26–50, AF-14, AF-15): Xác nhận tạo chứng từ đánh giá lại ngoại tệ ở trạng thái UNPOSTED (hoặc tự động POST nếu auto_post=true). */
export async function confirmFxRevaluation(w: ApiWriter, d: Row) {
  const record = await w.post(`${GL_FX_REVALUATION_RUNS}confirm/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.period_id || undefined,
    number: d.number || d.voucherNo || undefined,
    revaluation_date: d.revaluationDate || d.revaluation_date ? toApiDate(d.revaluationDate || d.revaluation_date) : undefined,
    posting_date: d.postingDate || d.posting_date ? toApiDate(d.postingDate || d.posting_date) : undefined,
    document_date: d.documentDate || d.document_date ? toApiDate(d.documentDate || d.document_date) : undefined,
    currency: d.currency || d.currencyCode || d.currency_code || "USD",
    exchange_rate: d.exchangeRate || d.exchange_rate || undefined,
    rate_type: d.rateType || d.rate_type || undefined,
    rate_source: d.rateSource || d.rate_source || undefined,
    account_scope: d.accountScope || d.account_scope || "ALL",
    account_ids: d.accountIds || d.account_ids || undefined,
    account_codes: d.accountCodes || d.account_codes || undefined,
    item_groups: d.itemGroups || d.item_groups || undefined,
    fx_difference_account: d.fxDifferenceAccount || d.fx_difference_account || undefined,
    fx_gain_account: d.fxGainAccount || d.fx_gain_account || undefined,
    fx_loss_account: d.fxLossAccount || d.fx_loss_account || undefined,
    selected_line_keys: d.selectedLineKeys || d.selected_line_keys || undefined,
    line_overrides: d.lineOverrides || d.line_overrides || undefined,
    description: d.description || undefined,
    source_fingerprint: d.sourceFingerprint || d.source_fingerprint || undefined,
    replace_run_id: d.replaceRunId || d.replace_run_id || undefined,
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
    auto_post: Boolean(d.autoPost ?? d.auto_post ?? false),
  });
  w.invalidate();
  return {
    record,
    message: record?.status === "POSTED"
      ? `Đã tạo và ghi sổ chứng từ đánh giá lại ngoại tệ ${record?.number || ""}.`
      : `Đã tạo chứng từ đánh giá lại ngoại tệ ${record?.number || ""} ở trạng thái Chưa ghi sổ (UNPOSTED).`,
  };
}

/** UC-GL-08 (Step 50, UC-GL-05): Ghi sổ chứng từ đánh giá lại ngoại tệ đang UNPOSTED. */
export async function postFxRevaluationRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_FX_REVALUATION_RUNS, id, "post", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || undefined,
  });
  w.invalidate();
  return {
    record,
    message: `Đã ghi sổ chứng từ đánh giá lại ngoại tệ ${record?.number || id}.`,
  };
}

/** UC-GL-08 (AF-16, UC-GL-05): Bỏ ghi sổ chứng từ đánh giá lại ngoại tệ đã POSTED về UNPOSTED. */
export async function unpostFxRevaluationRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_FX_REVALUATION_RUNS, id, "unpost", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || "Bỏ ghi sổ chứng từ đánh giá lại ngoại tệ để tính lại",
  });
  w.invalidate();
  return {
    record,
    message: `Đã bỏ ghi sổ chứng từ đánh giá lại ngoại tệ ${record?.number || id}.`,
  };
}

/** UC-GL-08 (AF-17, UC-GL-06): Đảo bút toán đánh giá lại ngoại tệ đã POSTED để đánh giá lại theo tỷ giá mới. */
export async function reverseFxRevaluationRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_FX_REVALUATION_RUNS, id, "reverse", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || "Đảo bút toán đánh giá lại ngoại tệ",
    posting_date: d.postingDate || d.posting_date ? toApiDate(d.postingDate || d.posting_date) : undefined,
    auto_post: Boolean(d.autoPost ?? d.auto_post ?? true),
  });
  w.invalidate();
  return {
    record,
    message: `Đã tạo bút toán đảo cho đợt đánh giá lại ngoại tệ ${record?.number || id}.`,
  };
}

/** UC-GL-08 (AF-11, AF-16): Hủy đợt đánh giá lại ngoại tệ chưa ghi sổ (UNPOSTED / CALCULATED). */
export async function cancelFxRevaluationRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_FX_REVALUATION_RUNS, id, "cancel", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || "Hủy đợt đánh giá lại ngoại tệ chưa ghi sổ",
  });
  w.invalidate();
  return {
    record,
    message: `Đã hủy đợt đánh giá lại ngoại tệ ${record?.number || id}.`,
  };
}

/** UC-GL-08 (Steps 42–43, BR-GL-FX-57, 58, 82): Truy vết hai chiều đợt đánh giá lại ngoại tệ và bút toán GL. */
export async function fetchFxRevaluationTrace(w: ApiWriter, id: string) {
  return await w.get(`${GL_FX_REVALUATION_RUNS}${encodeURIComponent(id)}/trace/?company_id=${encodeURIComponent(w.companyId)}`);
}

/* ───────────────────────────── UC-GL-09: Kết chuyển lãi lỗ ───────────────────────────── */

const GL_CLOSING_RULES = "/api/v1/general-ledger/closing-rules/";
const GL_CLOSING_RUNS = "/api/v1/general-ledger/closing-runs/";

/** UC-GL-09 (Pre-condition 6, BR-GL-PL-14): Khởi tạo bộ quy tắc kết chuyển lãi lỗ chuẩn (521->511, 511/515/711->911, 632/635/641/642/811/821->911, 911<->4212). */
export async function seedDefaultClosingRules(w: ApiWriter) {
  const record = await w.post(`${GL_CLOSING_RULES}seed-defaults/`, {
    company: w.companyId,
    company_id: w.companyId,
  });
  w.invalidate();
  return {
    record,
    message: "Đã khởi tạo bộ quy tắc kết chuyển lãi lỗ mặc định.",
  };
}

/** UC-GL-09 (Steps 11–35, AF-03..AF-09): Lấy dữ liệu kết chuyển lãi lỗ đến ngày được chọn từ các bút toán POSTED. */
export async function fetchProfitLossClosingData(w: ApiWriter, d: Row) {
  const record = await w.post(`${GL_CLOSING_RUNS}fetch-data/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.period_id || undefined,
    closing_to_date: d.closingToDate || d.closing_to_date ? toApiDate(d.closingToDate || d.closing_to_date) : undefined,
    posting_date: d.postingDate || d.posting_date ? toApiDate(d.postingDate || d.posting_date) : undefined,
    document_date: d.documentDate || d.document_date ? toApiDate(d.documentDate || d.document_date) : undefined,
    run_type: d.runType || d.run_type || "PROFIT_LOSS_CLOSING",
    auto_seed_default_rules: Boolean(d.autoSeedDefaultRules ?? d.auto_seed_default_rules ?? true),
  });
  return {
    record,
    message: "Đã lấy dữ liệu kết chuyển lãi lỗ từ Sổ cái.",
  };
}

/** UC-GL-09 (Steps 45–75, AF-10..AF-20): Xác nhận Cất (hoặc Cất và In) chứng từ kết chuyển lãi lỗ. */
export async function confirmProfitLossClosing(w: ApiWriter, d: Row) {
  const record = await w.post(`${GL_CLOSING_RUNS}confirm/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.period_id || undefined,
    number: d.number || d.voucherNo || d.voucher_no || undefined,
    closing_to_date: d.closingToDate || d.closing_to_date ? toApiDate(d.closingToDate || d.closing_to_date) : undefined,
    posting_date: d.postingDate || d.posting_date ? toApiDate(d.postingDate || d.posting_date) : undefined,
    document_date: d.documentDate || d.document_date ? toApiDate(d.documentDate || d.document_date) : undefined,
    description: d.description || undefined,
    reference: d.reference || undefined,
    attachments: Array.isArray(d.attachments) ? d.attachments : undefined,
    lines: Array.isArray(d.lines) ? d.lines : undefined,
    source_fingerprint: d.sourceFingerprint || d.source_fingerprint || undefined,
    replace_unposted: Boolean(d.replaceUnposted ?? d.replace_unposted ?? true),
    allow_additional_closing: Boolean(d.allowAdditionalClosing ?? d.allow_additional_closing ?? false),
    auto_post: Boolean(d.autoPost ?? d.auto_post ?? false),
    save_and_print: Boolean(d.saveAndPrint ?? d.save_and_print ?? false),
    idempotency_key: d.idempotencyKey || d.idempotency_key || undefined,
  });
  w.invalidate();
  return {
    record,
    message:
      record?.status === "COMPLETED" || record?.entry_status === "POSTED"
        ? `Đã tạo và ghi sổ chứng từ kết chuyển lãi lỗ ${record?.number || ""}.`
        : `Đã cất chứng từ kết chuyển lãi lỗ ${record?.number || ""} ở trạng thái Chưa ghi sổ (UNPOSTED).`,
  };
}

/** UC-GL-09 (Step 75, UC-GL-05): Ghi sổ chứng từ kết chuyển lãi lỗ đang UNPOSTED sang COMPLETED/POSTED. */
export async function postClosingRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_CLOSING_RUNS, id, "post", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || undefined,
  });
  w.invalidate();
  return {
    record,
    message: `Đã ghi sổ chứng từ kết chuyển lãi lỗ ${record?.number || id}.`,
  };
}

/** UC-GL-09 (AF-19, UC-GL-05): Bỏ ghi sổ chứng từ kết chuyển lãi lỗ về UNPOSTED. */
export async function unpostClosingRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_CLOSING_RUNS, id, "unpost", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || "Bỏ ghi sổ chứng từ kết chuyển lãi lỗ để kết chuyển lại",
  });
  w.invalidate();
  return {
    record,
    message: `Đã bỏ ghi sổ chứng từ kết chuyển lãi lỗ ${record?.number || id}.`,
  };
}

/** UC-GL-09 (AF-19, UC-GL-06): Đảo bút toán kết chuyển lãi lỗ đã POSTED. */
export async function reverseClosingRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_CLOSING_RUNS, id, "reverse", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || "Đảo bút toán kết chuyển lãi lỗ",
    posting_date: d.postingDate || d.posting_date ? toApiDate(d.postingDate || d.posting_date) : undefined,
    auto_post: Boolean(d.autoPost ?? d.auto_post ?? true),
  });
  w.invalidate();
  return {
    record,
    message: `Đã tạo bút toán đảo cho đợt kết chuyển lãi lỗ ${record?.number || id}.`,
  };
}

/** UC-GL-09 (AF-16, AF-18): Hủy đợt kết chuyển lãi lỗ chưa ghi sổ (DRAFT/UNPOSTED). */
export async function cancelClosingRun(w: ApiWriter, id: string, d: Row = {}) {
  const record = await w.action(GL_CLOSING_RUNS, id, "cancel", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || "Hủy chứng từ kết chuyển lãi lỗ chưa ghi sổ",
  });
  w.invalidate();
  return {
    record,
    message: `Đã hủy chứng từ kết chuyển lãi lỗ ${record?.number || id}.`,
  };
}

/** UC-GL-09 (Steps 71–73, BR-GL-PL-74..78): Truy vết từ lần kết chuyển -> dòng kết chuyển -> bút toán -> số liệu nguồn. */
export async function fetchClosingRunTrace(w: ApiWriter, id: string) {
  return await w.get(`${GL_CLOSING_RUNS}${encodeURIComponent(id)}/trace/?company_id=${encodeURIComponent(w.companyId)}`);
}

/* ───────────────────────────── UC-GL-10: Tổng hợp phát sinh, số dư và kiểm tra cân đối GL ───────────────────────────── */

const GL_BALANCES = "/api/v1/general-ledger/balances/";

/** UC-GL-10 (Steps 1–30, AF-01..AF-15, BR-GL-BAL-01..67): Tổng hợp lại số dư đầu kỳ, phát sinh Nợ/Có, số dư cuối kỳ và kiểm tra cân đối cho một kỳ kế toán. */
export async function aggregatePeriodBalances(w: ApiWriter, d: Row) {
  const record = await w.post(`${GL_BALANCES}aggregate-period/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.period_id || d.periodCode || d.period_code || undefined,
    trigger_type: d.triggerType || d.trigger_type || "MANUAL_REAGGREGATE",
    account_scope: d.accountScope || d.account_scope || "ALL",
    dimension_keys: d.dimensionKeys || d.dimension_keys || ["party", "department", "project", "cost_center"],
    include_zero_accounts: Boolean(d.includeZeroAccounts ?? d.include_zero_accounts ?? false),
    allow_closed_period_verify: Boolean(d.allowClosedPeriodVerify ?? d.allow_closed_period_verify ?? true),
    cascade_subsequent_periods: Boolean(d.cascadeSubsequentPeriods ?? d.cascade_subsequent_periods ?? true),
  });
  w.invalidate();
  return {
    record,
    message: `Đã tổng hợp số dư và kiểm tra cân đối kỳ ${record?.period_code || ""} (Trạng thái: ${record?.status || "VALID"}).`,
  };
}

/** UC-GL-10 (Steps 17–25, BR-GL-BAL-31..46): Kiểm tra cân đối Tổng phát sinh Nợ/Có, Tổng dư đầu kỳ/cuối kỳ, tính liên tục giữa các kỳ và khớp TK tổng hợp - chi tiết. */
export async function validatePeriodBalances(w: ApiWriter, d: Row) {
  const record = await w.post(`${GL_BALANCES}validate-balance/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.period_id || d.periodCode || d.period_code || undefined,
  });
  return {
    record,
    message: record?.is_balanced
      ? `Kỳ kế toán ${record?.period_code || ""} cân đối hợp lệ (VALID).`
      : `Phát hiện chênh lệch mất cân đối trong kỳ ${record?.period_code || ""} (INVALID).`,
  };
}

/** UC-GL-10 (AF-13, EF-21, BR-GL-BAL-51..54): Drill-down từ số dư tài khoản xuống danh sách dòng bút toán POSTED cấu thành. */
export async function drilldownAccountBalance(w: ApiWriter, d: Row) {
  const period = encodeURIComponent(String(d.period || d.period_id || d.periodCode || ""));
  const account = encodeURIComponent(String(d.account || d.account_id || d.accountCode || d.account_code || ""));
  return await w.get(
    `${GL_BALANCES}drilldown/?company_id=${encodeURIComponent(w.companyId)}&period=${period}&account=${account}`
  );
}

/* ───────────────────────────── UC-GL-11: Đối chiếu số liệu GL với các phân hệ ───────────────────────────── */

const GL_RECONCILIATION_RULES = "/api/v1/general-ledger/reconciliation-rules/";
const GL_RECONCILIATIONS = "/api/v1/general-ledger/reconciliations/";

/** UC-GL-11 (Section 1.1.B, BR-GL-REC-05..28): Khởi tạo 7 quy tắc đối chiếu mặc định (GL ↔ AP, AR, CASH, BANK, INV, FA, TAX). */
export async function seedDefaultReconciliationRules(w: ApiWriter) {
  const record = await w.post(`${GL_RECONCILIATION_RULES}seed-defaults/`, {
    company: w.companyId,
    company_id: w.companyId,
  });
  w.invalidate();
  return {
    record,
    message: "Đã khởi tạo bộ quy tắc đối chiếu mặc định giữa GL và 7 phân hệ (AP, AR, CASH, BANK, INV, FA, TAX).",
  };
}

/** UC-GL-11 (Steps 1–38, AF-01..AF-19, BR-GL-REC-01..94): Thực hiện đối chiếu số liệu GL với phân hệ chi tiết. */
export async function runGlSubledgerReconciliation(w: ApiWriter, d: Row) {
  const record = await w.post(`${GL_RECONCILIATIONS}run/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.periodId || d.periodCode || undefined,
    reconciliation_type: d.reconciliationType || d.reconciliation_type || "GL_AR",
    source_module: d.sourceModule || d.source_module || undefined,
    account_code: d.accountCode || d.account_code || undefined,
    party_code: d.partyCode || d.party_code || undefined,
    currency_code: d.currencyCode || d.currency_code || undefined,
    rounding_tolerance: d.roundingTolerance ?? d.rounding_tolerance ?? "0",
    tolerance_behavior: d.toleranceBehavior || d.tolerance_behavior || "MATCHED",
    subledger_items: Array.isArray(d.subledgerItems) ? d.subledgerItems : undefined,
  });
  w.invalidate();
  return {
    record,
    message: `Đã hoàn tất đối chiếu ${record?.reconciliation_type || d.reconciliationType || "GL"} (Trạng thái: ${record?.status || "MATCHED"}).`,
  };
}

/** UC-GL-11 (Steps 39–43, AF-14, AF-15, EF-25, BR-GL-REC-48, 49, 68, 69, 93): Drill-down chi tiết chênh lệch 2 phía GL và phân hệ. */
export async function drilldownGlReconciliation(w: ApiWriter, id: string, d: Row = {}) {
  const q = new URLSearchParams({ company_id: w.companyId });
  if (d.lineId) q.set("line_id", String(d.lineId));
  if (d.reconciliationKey) q.set("reconciliation_key", String(d.reconciliationKey));
  if (d.restrictSubledgerPermission) q.set("restrict_subledger_permission", "true");
  return await w.get(`${GL_RECONCILIATIONS}${encodeURIComponent(id)}/drilldown/?${q.toString()}`);
}

/** UC-GL-11 (Step 44, BR-GL-REC-50, 56, 57): Ghi chú nguyên nhân/xử lý chênh lệch mà không tự động đổi trạng thái thành MATCHED. */
export async function annotateGlReconciliationNote(w: ApiWriter, id: string, d: Row) {
  const record = await w.action(GL_RECONCILIATIONS, id, "annotate", {
    company: w.companyId,
    company_id: w.companyId,
    note: d.note || d.reason || "",
    line_id: d.lineId || d.line_id || undefined,
  });
  w.invalidate();
  return {
    record,
    message: "Đã lưu ghi chú xử lý chênh lệch (BR-GL-REC-56: Cần chạy 'Đối chiếu lại' sau khi xử lý chứng từ nguồn để chuyển sang MATCHED).",
  };
}

/** UC-GL-11 (AF-18, BR-GL-REC-81..83): Kiểm tra điều kiện đối chiếu trước khi khóa sổ kỳ kế toán (UC-GL-12). */
export async function checkPreClosingReconciliations(w: ApiWriter, period: string) {
  return await w.get(
    `${GL_RECONCILIATIONS}pre-closing-check/?company_id=${encodeURIComponent(w.companyId)}&period=${encodeURIComponent(period)}`
  );
}

// ======================================================================// UC-GL-12 – KHÓA / BỎ KHÓA SỔ KỲ KẾ TOÁN (ACCOUNTING PERIOD CLOSE & REOPEN)
// ======================================================================
const GL_PERIODS = "/api/v1/general-ledger/periods/";

/** UC-GL-12 (Main Flow Steps 8..21, AF-01..AF-08, EF-07..EF-14, BR-GL-LOCK-13..27): Chạy Checklist kiểm tra điều kiện trước khóa sổ kỳ kế toán. */
export async function evaluatePeriodCloseChecklist(w: ApiWriter, periodId: string, d: Row = {}) {
  const record = await w.action(GL_PERIODS, periodId, "checklist", {
    company: w.companyId,
    company_id: w.companyId,
    lock_scope: d.lockScope || d.lock_scope || "FULL_PERIOD",
    lock_to_date: d.lockToDate || d.lock_to_date || undefined,
    document_types: Array.isArray(d.documentTypes) ? d.documentTypes : d.document_types,
    unposted_policy: d.unpostedPolicy || d.unposted_policy || undefined,
    reconciliation_policy: d.reconciliationPolicy || d.reconciliation_policy || undefined,
    require_expense_allocation: d.requireExpenseAllocation ?? d.require_expense_allocation,
    require_fx_revaluation: d.requireFxRevaluation ?? d.require_fx_revaluation,
    require_pl_closing: d.requirePlClosing ?? d.require_pl_closing,
  });
  return {
    record,
    message: `Đã kiểm tra Checklist khóa sổ kỳ ${record?.period_code || periodId} (${record?.status || "READY"}).`,
  };
}

/** UC-GL-12 (Main Flow Steps 22..34, AF-01, AF-02, AF-25, BR-GL-LOCK-01..53, 80..90): Xác nhận Khóa sổ toàn kỳ hoặc Khóa theo loại chứng từ. */
export async function closeAccountingPeriod(w: ApiWriter, periodId: string, d: Row = {}) {
  const record = await w.action(GL_PERIODS, periodId, "close", {
    company: w.companyId,
    company_id: w.companyId,
    checklist_id: d.checklistId || d.checklist_id || undefined,
    expected_watermark: d.expectedWatermark || d.expected_watermark || undefined,
    lock_scope: d.lockScope || d.lock_scope || "FULL_PERIOD",
    lock_to_date: d.lockToDate || d.lock_to_date || undefined,
    document_types: Array.isArray(d.documentTypes) ? d.documentTypes : d.document_types,
    unposted_policy: d.unpostedPolicy || d.unposted_policy || undefined,
    reconciliation_policy: d.reconciliationPolicy || d.reconciliation_policy || undefined,
    require_expense_allocation: d.requireExpenseAllocation ?? d.require_expense_allocation,
    require_fx_revaluation: d.requireFxRevaluation ?? d.require_fx_revaluation,
    require_pl_closing: d.requirePlClosing ?? d.require_pl_closing,
    notes: d.notes || d.reason || "",
    version: d.version ?? undefined,
  });
  w.invalidate();
  return {
    record,
    message: record?.message || `Khóa sổ kỳ kế toán ${record?.code || periodId} thành công (${record?.status || "CLOSED"}).`,
  };
}

/** UC-GL-12 (AF-11..AF-24, EF-03, EF-24..EF-28, BR-GL-LOCK-52..76): Bỏ khóa / Mở lại kỳ kế toán hoặc mở khóa theo loại chứng từ. */
export async function reopenAccountingPeriod(w: ApiWriter, periodId: string, d: Row) {
  const record = await w.action(GL_PERIODS, periodId, "reopen", {
    company: w.companyId,
    company_id: w.companyId,
    reason: d.reason || d.reopenReason || "",
    unlock_scope: d.unlockScope || d.unlock_scope || "FULL_PERIOD",
    document_types: Array.isArray(d.documentTypes) ? d.documentTypes : d.document_types,
    require_reopen_approval: d.requireReopenApproval ?? d.require_reopen_approval ?? false,
    enforce_reverse_chronological_reopen: d.enforceReverseChronologicalReopen ?? d.enforce_reverse_chronological_reopen,
    version: d.version ?? undefined,
  });
  w.invalidate();
  return {
    record,
    message: record?.message || `Bỏ khóa sổ kỳ kế toán ${record?.code || periodId} thành công (${record?.status || "OPEN"}).`,
  };
}

/** UC-GL-12 (AF-16, AF-17, EF-25, EF-26, BR-GL-LOCK-57..59, 64): Phê duyệt hoặc từ chối yêu cầu mở lại kỳ kế toán. */
export async function decideReopenAccountingPeriod(w: ApiWriter, periodId: string, d: Row) {
  const record = await w.action(GL_PERIODS, periodId, "decide-reopen", {
    company: w.companyId,
    company_id: w.companyId,
    approved: d.approved ?? true,
    comment: d.comment || d.reason || "",
  });
  w.invalidate();
  return {
    record,
    message: record?.message || (d.approved ? "Đã phê duyệt mở lại kỳ kế toán." : "Đã từ chối yêu cầu mở lại kỳ kế toán."),
  };
}

/** UC-GL-12 (Section 1.1.D, BR-GL-LOCK-60..64, 88..96): Truy vấn lịch sử Khóa / Bỏ khóa và Checklist của kỳ kế toán. */
export async function fetchPeriodLockHistory(w: ApiWriter, periodId: string) {
  return await w.get(
    `${GL_PERIODS}${encodeURIComponent(periodId)}/lock-history/?company_id=${encodeURIComponent(w.companyId)}`
  );
}

/** UC-GL-12 (Trigger 3, AF-10, BR-GL-LOCK-91..93): Thực thi khóa sổ tự động định kỳ theo chính sách doanh nghiệp. */
export async function runAutoPeriodLock(w: ApiWriter, d: Row = {}) {
  const record = await w.post(`${GL_PERIODS}auto-lock/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.periodId || undefined,
    cutoff_date: d.cutoffDate || d.cutoff_date || undefined,
  });
  w.invalidate();
  return {
    record,
    message: `Khóa sổ tự động hoàn tất: Đã khóa ${record?.closed_count ?? 0} kỳ, chặn ${record?.failed_count ?? 0} kỳ do còn lỗi BLOCKER.`,
  };
}

// ======================================================================// UC-GL-13 – LẬP BÁO CÁO TÀI CHÍNH (FINANCIAL STATEMENTS UNDER TT99/2025/TT-BTC)
// ======================================================================
const GL_FINANCIAL_STATEMENT_MAPPINGS = "/api/v1/general-ledger/financial-statement-mappings/";
const GL_FINANCIAL_STATEMENTS = "/api/v1/general-ledger/financial-statements/";

/** UC-GL-13 (Section 1.1, BR-GL-FS-06..26, 54..59): Khởi tạo cấu hình mapping chỉ tiêu BCTC mặc định theo TT99/2025/TT-BTC. */
export async function seedDefaultFinancialStatementMappings(w: ApiWriter) {
  const record = await w.post(`${GL_FINANCIAL_STATEMENT_MAPPINGS}seed-defaults/`, {
    company: w.companyId,
    company_id: w.companyId,
  });
  w.invalidate();
  return {
    record,
    message: "Đã khởi tạo bộ quy tắc mapping chỉ tiêu Báo cáo tài chính theo Thông tư 99/2025/TT-BTC.",
  };
}

/** UC-GL-13 (Main Flow Steps 23–25, EF-08..13, BR-GL-FS-02..05, 81, 82, 86): Kiểm tra điều kiện nguồn GL, tổng hợp số dư (UC-GL-10), đối chiếu (UC-GL-11), khóa kỳ (UC-GL-12) và kết chuyển lãi lỗ (UC-GL-09) trước khi lập BCTC. */
export async function precheckFinancialStatements(w: ApiWriter, d: Row = {}) {
  const record = await w.post(`${GL_FINANCIAL_STATEMENTS}precheck/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.periodId || d.periodCode || undefined,
    report_group: d.reportGroup || d.report_group || "ANNUAL_BCTC",
    going_concern_assumption: d.goingConcernAssumption || d.going_concern_assumption || "CONTINUOUS",
    interim_format: d.interimFormat || d.interim_format || "FULL",
    cash_flow_method: d.cashFlowMethod || d.cash_flow_method || "DIRECT",
    selected_forms: Array.isArray(d.selectedForms) ? d.selectedForms : d.selected_forms,
    from_date: d.fromDate || d.from_date || undefined,
    to_date: d.toDate || d.to_date || undefined,
    require_closed_period: d.requireClosedPeriod ?? d.require_closed_period ?? false,
    require_pl_closing: d.requirePlClosing ?? d.require_pl_closing ?? false,
  });
  return {
    record,
    message: `Đã kiểm tra điều kiện lập BCTC (${record?.status || "READY"}).`,
  };
}

/** UC-GL-13 (Main Flow Steps 1–47, AF-01..AF-24, EF-01..EF-29, BR-GL-FS-01..90): Lập / Lập lại bộ Báo cáo tài chính phiên bản mới theo Thông tư 99/2025/TT-BTC. */
export async function generateFinancialStatements(w: ApiWriter, d: Row = {}) {
  const record = await w.post(`${GL_FINANCIAL_STATEMENTS}generate/`, {
    company: w.companyId,
    company_id: w.companyId,
    period: d.period || d.periodId || d.periodCode || undefined,
    comparative_period: d.comparativePeriod || d.comparative_period || undefined,
    report_group: d.reportGroup || d.report_group || "ANNUAL_BCTC",
    going_concern_assumption: d.goingConcernAssumption || d.going_concern_assumption || "CONTINUOUS",
    interim_format: d.interimFormat || d.interim_format || "FULL",
    cash_flow_method: d.cashFlowMethod || d.cash_flow_method || "DIRECT",
    selected_forms: Array.isArray(d.selectedForms) ? d.selectedForms : d.selected_forms,
    from_date: d.fromDate || d.from_date || undefined,
    to_date: d.toDate || d.to_date || undefined,
    comparative_from_date: d.comparativeFromDate || d.comparative_from_date || undefined,
    comparative_to_date: d.comparativeToDate || d.comparative_to_date || undefined,
    unit_scale: d.unitScale ?? d.unit_scale ?? 1,
    reuse_latest_notes: Boolean(d.reuseLatestNotes ?? d.reuse_latest_notes ?? false),
    notes_general_info: d.notesGeneralInfo || d.notes_general_info || undefined,
    accounting_policies: d.accountingPolicies || d.accounting_policies || undefined,
    notes_explanations: d.notesExplanations || d.notes_explanations || undefined,
    custom_indicators: Array.isArray(d.customIndicators) ? d.customIndicators : d.custom_indicators,
    require_closed_period: d.requireClosedPeriod ?? d.require_closed_period ?? false,
    require_pl_closing: d.requirePlClosing ?? d.require_pl_closing ?? false,
  });
  w.invalidate();
  return {
    record,
    message: `Đã lập bộ Báo cáo tài chính ${record?.batch_number || ""} (Phiên bản v${record?.version_number || 1}, Trạng thái: ${record?.status || "GENERATED"}).`,
  };
}

/** UC-GL-13 (AF-12, AF-13, BR-GL-FS-38..40, 75): Cập nhật nội dung Thuyết minh BCTC (B09-DN / B09-DNKLT / B09a-DN) trên phiên bản chưa chốt. */
export async function updateFinancialStatementNotes(w: ApiWriter, batchId: string, d: Row = {}) {
  const record = await w.action(GL_FINANCIAL_STATEMENTS, batchId, "update-notes", {
    company: w.companyId,
    company_id: w.companyId,
    notes_general_info: d.notesGeneralInfo || d.notes_general_info || undefined,
    accounting_policies: d.accountingPolicies || d.accounting_policies || undefined,
    notes_explanations: d.notesExplanations || d.notes_explanations || undefined,
    custom_indicators: Array.isArray(d.customIndicators) ? d.customIndicators : d.custom_indicators,
  });
  w.invalidate();
  return {
    record,
    message: `Đã lưu cập nhật Thuyết minh BCTC cho phiên bản ${record?.batch_number || batchId}.`,
  };
}

/** UC-GL-13 (AF-21, EF-29, BR-GL-FS-68..75): Chốt chính thức (FINALIZED) phiên bản Báo cáo tài chính để khóa sửa trực tiếp. */
export async function finalizeFinancialStatementBatch(w: ApiWriter, batchId: string, d: Row = {}) {
  const record = await w.action(GL_FINANCIAL_STATEMENTS, batchId, "finalize", {
    company: w.companyId,
    company_id: w.companyId,
    require_closed_period: d.requireClosedPeriod ?? d.require_closed_period ?? true,
    allow_open_period_finalize: d.allowOpenPeriodFinalize ?? d.allow_open_period_finalize ?? false,
    finalize_note: d.finalizeNote || d.finalize_note || d.notes || "",
  });
  w.invalidate();
  return {
    record,
    message: `Đã chốt chính thức (FINALIZED) bộ Báo cáo tài chính ${record?.batch_number || batchId}.`,
  };
}

/** UC-GL-13 (Main Flow Steps 48–50, BR-GL-FS-78..80, 112, 115): Truy vết ngược (Drill-down) từ dòng chỉ tiêu BCTC về số dư tài khoản/đối tượng và bút toán POSTED. */
export async function drilldownFinancialStatementLine(w: ApiWriter, batchId: string, d: Row = {}) {
  const q = new URLSearchParams({ company_id: w.companyId });
  if (d.formCode || d.form_code) q.set("form_code", String(d.formCode || d.form_code));
  if (d.indicatorCode || d.indicator_code) q.set("indicator_code", String(d.indicatorCode || d.indicator_code));
  if (d.cashFlowMethod || d.cash_flow_method) q.set("cash_flow_method", String(d.cashFlowMethod || d.cash_flow_method));
  return await w.get(`${GL_FINANCIAL_STATEMENTS}${encodeURIComponent(batchId)}/drilldown/?${q.toString()}`);
}

/** UC-GL-13 (Main Flow Step 51, AF-20, BR-GL-FS-66, 72..74): Xuất khẩu bộ Báo cáo tài chính kèm đầy đủ siêu dữ liệu pháp lý, phiên bản và trạng thái. */
export async function exportFinancialStatementBatch(w: ApiWriter, batchId: string, exportFormat = "JSON") {
  return await w.get(
    `${GL_FINANCIAL_STATEMENTS}${encodeURIComponent(batchId)}/export/?company_id=${encodeURIComponent(w.companyId)}&export_format=${encodeURIComponent(exportFormat)}`
  );
}

// =====================================================================// UC-GL-14: TRA CỨU SỔ CÁI / NHẬT KÝ / TRUY VẾT CHỨNG TỪ
// =====================================================================const GL_LEDGER_INQUIRY = "/api/v1/general-ledger/ledger-inquiry/";

/** UC-GL-14 (Main Flow Steps 1–23, AF-01..16, AF-24, EF-01..15, BR-GL-TRACE-01..34, 56..75): Tra cứu Sổ cái, Sổ nhật ký chung, Sổ chi tiết tài khoản, Bảng cân đối, Nhật ký thu/chi/mua/bán, Sổ ngoại tệ và Bút toán GL theo Thông tư 99/2025/TT-BTC. */
export async function queryAccountingBookUcGl14(w: ApiWriter, d: Row = {}) {
  const payload: Row = {
    company: w.companyId,
    company_id: w.companyId,
    book_type: d.bookType || d.book_type || d.inquiryMode || d.inquiry_mode || undefined,
    report_name: d.reportName || d.report_name || undefined,
    period: d.period || d.periodCode || d.period_code || undefined,
    from_date: d.fromDate || d.from_date ? toApiDate(d.fromDate || d.from_date) : undefined,
    to_date: d.toDate || d.to_date ? toApiDate(d.toDate || d.to_date) : undefined,
    account_code: d.accountCode || d.account_code || undefined,
    include_child_accounts: d.includeChildAccounts ?? d.include_child_accounts ?? true,
    reciprocal_account_code: d.reciprocalAccountCode || d.reciprocal_account_code || undefined,
    voucher_number: d.voucherNumber || d.voucher_number || undefined,
    entry_type: d.entryType || d.entry_type || undefined,
    source_module: d.sourceModule || d.source_module || undefined,
    entry_status: d.entryStatus || d.entry_status || undefined,
    currency_code: d.currencyCode || d.currency_code || undefined,
    party_code: d.partyCode || d.party_code || undefined,
    department_code: d.departmentCode || d.department_code || undefined,
    project_code: d.projectCode || d.project_code || undefined,
    cost_center_code: d.costCenterCode || d.cost_center_code || undefined,
    cost_item_code: d.costItemCode || d.cost_item_code || undefined,
    contract_code: d.contractCode || d.contract_code || undefined,
    stat_code: d.statCode || d.stat_code || undefined,
    keyword: d.keyword || d.search || undefined,
    min_amount: d.minAmount ?? d.min_amount ?? undefined,
    max_amount: d.maxAmount ?? d.max_amount ?? undefined,
    page: d.page ?? 1,
    page_size: d.pageSize ?? d.page_size ?? 200,
  };
  return await w.post(`${GL_LEDGER_INQUIRY}query/`, payload);
}

/** UC-GL-14 (Main Flow Steps 24–40, AF-17..23, EF-16..21, BR-GL-TRACE-35..55, 108..111): Truy vết chuỗi 2 chiều Sổ/Báo cáo ↔ Dòng hạch toán ↔ Bút toán GL (kèm chuỗi Đảo/Điều chỉnh UC-GL-06) ↔ Chứng từ nghiệp vụ nguồn. */
export async function traceGlEntryAndVoucherUcGl14(w: ApiWriter, d: Row = {}) {
  const payload: Row = {
    company: w.companyId,
    company_id: w.companyId,
    entry_id: d.entryId || d.entry_id || undefined,
    line_id: d.lineId || d.line_id || undefined,
    voucher_number: d.voucherNumber || d.voucher_number || d.number || undefined,
    source_document_id: d.sourceDocumentId || d.source_document_id || undefined,
    source_module: d.sourceModule || d.source_module || undefined,
    denied_source_modules: Array.isArray(d.deniedSourceModules) ? d.deniedSourceModules : d.denied_source_modules,
  };
  return await w.post(`${GL_LEDGER_INQUIRY}trace/`, payload);
}

/** UC-GL-14 (Main Flow Steps 41–44, AF-25, AF-26, EF-22..24, BR-GL-TRACE-64..70): In / Xuất Sổ kế toán theo đúng bộ lọc và phạm vi dữ liệu hiện tại. */
export async function exportAccountingBookUcGl14(w: ApiWriter, d: Row = {}) {
  const payload: Row = {
    company: w.companyId,
    company_id: w.companyId,
    book_type: d.bookType || d.book_type || undefined,
    report_name: d.reportName || d.report_name || undefined,
    period: d.period || d.periodCode || d.period_code || undefined,
    from_date: d.fromDate || d.from_date ? toApiDate(d.fromDate || d.from_date) : undefined,
    to_date: d.toDate || d.to_date ? toApiDate(d.toDate || d.to_date) : undefined,
    account_code: d.accountCode || d.account_code || undefined,
    include_child_accounts: d.includeChildAccounts ?? d.include_child_accounts ?? true,
    reciprocal_account_code: d.reciprocalAccountCode || d.reciprocal_account_code || undefined,
    voucher_number: d.voucherNumber || d.voucher_number || undefined,
    entry_type: d.entryType || d.entry_type || undefined,
    source_module: d.sourceModule || d.source_module || undefined,
    entry_status: d.entryStatus || d.entry_status || undefined,
    currency_code: d.currencyCode || d.currency_code || undefined,
    keyword: d.keyword || undefined,
    format: d.format || d.exportFormat || "EXCEL",
  };
  return await w.post(`${GL_LEDGER_INQUIRY}export/`, payload);
}








// =====================================================================// UC-GL-15: NHẬP SỐ DƯ BAN ĐẦU (10 LUỒNG NGHIỆP VỤ A–J)
// =====================================================================const GL_OPENING_BALANCES = "/api/v1/general-ledger/opening-balances/";

/** UC-GL-15 (MF-01..03): Truy xuất toàn bộ 10 nhóm số dư ban đầu, trạng thái cân đối Nợ/Có, tổng hợp tài khoản cha-con (BR07), version (EF-21) và trạng thái khóa kỳ (EF-19). */
export async function fetchOpeningBalancesUcGl15(w: ApiWriter) {
  return await w.get(`${GL_OPENING_BALANCES}?company_id=${encodeURIComponent(w.companyId)}&_=${Date.now()}`);
}

/** UC-GL-15 (Luồng A–J, AF-01..02): Lưu đồng bộ một hoặc nhiều nhóm số dư ban đầu, kiểm tra EF-01..23 và BR01..42. */
export async function saveOpeningBalancesUcGl15(w: ApiWriter, d: Row = {}) {
  const payload: Row = {
    company_id: w.companyId,
    ...d,
  };
  return await w.post(GL_OPENING_BALANCES, payload);
}

/** UC-GL-15 (AF-01, AF-02, AF-10, AF-12, AF-13): Thêm mới hoặc Sửa một bản ghi số dư ban đầu (kèm hỗ trợ Lưu và Thêm / Lưu và Đóng / Lưu và In). */
export async function saveOpeningBalanceItemUcGl15(w: ApiWriter, d: Row = {}) {
  const payload: Row = {
    company_id: w.companyId,
    category: d.category,
    editing_id: d.editingId || d.editing_id || undefined,
    action_mode: d.actionMode || d.action_mode || "SAVE",
    expected_version: d.expectedVersion ?? d.expected_version ?? undefined,
    simulate_print_error: d.simulatePrintError ?? d.simulate_print_error ?? undefined,
    item: d.item || {},
  };
  return await w.post(`${GL_OPENING_BALANCES}save-item/`, payload);
}

/** UC-GL-15 (AF-11, EF-19): Xóa một bản ghi số dư ban đầu đã lưu, kiểm tra khóa kỳ và chứng từ phụ thuộc. */
export async function deleteOpeningBalanceItemUcGl15(w: ApiWriter, d: Row = {}) {
  const payload: Row = {
    company_id: w.companyId,
    category: d.category,
    item_id: d.itemId || d.item_id || d.id || d.code,
  };
  return await w.post(`${GL_OPENING_BALANCES}delete-item/`, payload);
}

/** UC-GL-15 (AF-03, EF-18, BR41): Nhập số dư ban đầu từ tệp Excel với kiểm tra cấu trúc và quy tắc nghiệp vụ từng dòng. */
export async function importOpeningBalancesExcelUcGl15(w: ApiWriter, d: Row = {}) {
  const payload: Row = {
    company_id: w.companyId,
    category: d.category,
    rows: Array.isArray(d.rows) ? d.rows : [],
    atomic: d.atomic ?? true,
    replace_existing: d.replaceExisting ?? d.replace_existing ?? false,
  };
  return await w.post(`${GL_OPENING_BALANCES}import-excel/`, payload);
}

/** UC-GL-15 (AF-09): Xem danh sách chứng từ / bản ghi số dư ban đầu đã khai báo. */
export async function fetchOpeningBalanceVouchersUcGl15(w: ApiWriter, category?: string) {
  const catParam = category ? `&category=${encodeURIComponent(category)}` : "";
  return await w.get(`${GL_OPENING_BALANCES}vouchers/?company_id=${encodeURIComponent(w.companyId)}${catParam}&_=${Date.now()}`);
}

/** UC-GL-15 (AF-13, EF-17, BR34, BR35): Tạo dữ liệu in Phiếu/Bảng kê số dư ban đầu từ dữ liệu đã lưu thành công. */
export async function printOpeningBalanceUcGl15(w: ApiWriter, d: Row = {}) {
  const payload: Row = {
    company_id: w.companyId,
    category: d.category || "accounts",
    item_id: d.itemId || d.item_id || undefined,
    simulate_print_error: d.simulatePrintError ?? d.simulate_print_error ?? undefined,
  };
  return await w.post(`${GL_OPENING_BALANCES}print/`, payload);
}

// =====================================================================// UC-RPT-01: XEM DASHBOARD TỔNG QUAN (DASH-01 .. DASH-12)
// =====================================================================const RPT_DASHBOARD = "/api/v1/reports/dashboard/";

function buildDashboardQueryParams(companyId: string, d: Row = {}) {
  const q = new URLSearchParams({ company_id: companyId });
  if (d.period || d.periodCode || d.period_code) q.set("period", String(d.period || d.periodCode || d.period_code));
  if (d.periodId || d.period_id) q.set("period_id", String(d.periodId || d.period_id));
  if (d.fromDate || d.from_date) q.set("from_date", toApiDate(d.fromDate || d.from_date));
  if (d.toDate || d.to_date) q.set("to_date", toApiDate(d.toDate || d.to_date));
  if (d.asOfDate || d.as_of_date) q.set("as_of_date", toApiDate(d.asOfDate || d.as_of_date));
  if (d.branchId || d.branch_id) q.set("branch_id", String(d.branchId || d.branch_id));
  if (d.departmentId || d.department_id) q.set("department_id", String(d.departmentId || d.department_id));
  if (d.comparisonMode || d.comparison_mode) q.set("comparison_mode", String(d.comparisonMode || d.comparison_mode));
  if (d.basis) q.set("basis", String(d.basis));
  if (d.refresh) q.set("refresh", "true");
  if (d.moduleFilter || d.module_filter || d.module) q.set("module", String(d.moduleFilter || d.module_filter || d.module));
  if (d.statusFilter || d.status_filter || d.status) q.set("status", String(d.statusFilter || d.status_filter || d.status));
  if (d.limit) q.set("limit", String(d.limit));
  return q.toString();
}

/** UC-RPT-01 (MF-02, MF-03, DR-RPT-01, DR-RPT-09): Nạp cấu hình Dashboard, danh mục kỳ kế toán thật, chi nhánh trong Data Scope và danh mục 12 thành phần DASH-01..DASH-12. */
export async function fetchDashboardConfigUcRpt01(w: ApiWriter) {
  return await w.get(`${RPT_DASHBOARD}config/?company_id=${encodeURIComponent(w.companyId)}`);
}

/** UC-RPT-01 (DR-RPT-09): Lưu cấu hình cá nhân hóa hoặc mặc định Dashboard của người dùng/doanh nghiệp. */
export async function saveDashboardConfigUcRpt01(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_DASHBOARD}config/`, {
    company_id: w.companyId,
    is_company_default: Boolean(d.isCompanyDefault ?? d.is_company_default ?? false),
    default_period_type: d.defaultPeriodType || d.default_period_type || "CURRENT_PERIOD",
    default_branch_id: d.defaultBranchId || d.default_branch_id || null,
    default_comparison_mode: d.defaultComparisonMode || d.default_comparison_mode || "PREVIOUS_PERIOD",
    revenue_basis: d.revenueBasis || d.revenue_basis || "GL",
    visible_widgets: Array.isArray(d.visibleWidgets || d.visible_widgets) ? (d.visibleWidgets || d.visible_widgets) : undefined,
    widget_order: Array.isArray(d.widgetOrder || d.widget_order) ? (d.widgetOrder || d.widget_order) : undefined,
    auto_refresh_seconds: d.autoRefreshSeconds ?? d.auto_refresh_seconds ?? 0,
  });
}

/** UC-RPT-01 (MF-04, MF-05, DASH-01..DASH-12, BR-RPT-DASH-01..70): Nạp toàn bộ dữ liệu tổng quan Dashboard (4 KPI, 2 biểu đồ, 4 widget công nợ/tồn kho/thuế, 2 danh sách điều hành) với cô lập lỗi từng thành phần. */
export async function fetchDashboardOverviewUcRpt01(w: ApiWriter, d: Row = {}) {
  const qs = buildDashboardQueryParams(w.companyId, d);
  return await w.get(`${RPT_DASHBOARD}overview/?${qs}`);
}

/** UC-RPT-01 (AF-05, BR-RPT-DASH-59): Làm mới (Invalidate Cache & Tính lại) toàn bộ hoặc một số thành phần Dashboard. */
export async function refreshDashboardUcRpt01(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_DASHBOARD}refresh/`, {
    company_id: w.companyId,
    period: d.period || d.periodCode || d.period_code || undefined,
    branch_id: d.branchId || d.branch_id || undefined,
    comparison_mode: d.comparisonMode || d.comparison_mode || undefined,
    basis: d.basis || undefined,
    widgets: Array.isArray(d.widgets) ? d.widgets : undefined,
  });
}

/** UC-RPT-01 (DASH-05): Nạp dữ liệu biểu đồ Dòng tiền thu - chi theo kỳ/ngày/tháng. */
export async function fetchDashboardCashFlowUcRpt01(w: ApiWriter, d: Row = {}) {
  const qs = buildDashboardQueryParams(w.companyId, d);
  return await w.get(`${RPT_DASHBOARD}cash-flow/?${qs}`);
}

/** UC-RPT-01 (DASH-06): Nạp dữ liệu biểu đồ Doanh thu, Chi phí và Lợi nhuận theo kỳ. */
export async function fetchDashboardProfitabilityUcRpt01(w: ApiWriter, d: Row = {}) {
  const qs = buildDashboardQueryParams(w.companyId, d);
  return await w.get(`${RPT_DASHBOARD}profitability/?${qs}`);
}

/** UC-RPT-01 (DASH-07): Nạp dữ liệu Tổng quan Công nợ phải thu (AR) và tuổi nợ. */
export async function fetchDashboardReceivablesUcRpt01(w: ApiWriter, d: Row = {}) {
  const qs = buildDashboardQueryParams(w.companyId, d);
  return await w.get(`${RPT_DASHBOARD}receivables/?${qs}`);
}

/** UC-RPT-01 (DASH-08): Nạp dữ liệu Tổng quan Công nợ phải trả (AP) và tuổi nợ. */
export async function fetchDashboardPayablesUcRpt01(w: ApiWriter, d: Row = {}) {
  const qs = buildDashboardQueryParams(w.companyId, d);
  return await w.get(`${RPT_DASHBOARD}payables/?${qs}`);
}

/** UC-RPT-01 (DASH-09): Nạp dữ liệu Tổng quan Tồn kho (INV) và cảnh báo dưới định mức tối thiểu. */
export async function fetchDashboardInventoryUcRpt01(w: ApiWriter, d: Row = {}) {
  const qs = buildDashboardQueryParams(w.companyId, d);
  return await w.get(`${RPT_DASHBOARD}inventory/?${qs}`);
}

/** UC-RPT-01 (DASH-10): Nạp dữ liệu Tổng quan Nghĩa vụ thuế (TAX) và tờ khai sắp đến hạn. */
export async function fetchDashboardTaxObligationsUcRpt01(w: ApiWriter, d: Row = {}) {
  const qs = buildDashboardQueryParams(w.companyId, d);
  return await w.get(`${RPT_DASHBOARD}tax-obligations/?${qs}`);
}

/** UC-RPT-01 (DASH-11): Nạp Danh sách công việc cần xử lý (Approval / Chờ ghi sổ / Cảnh báo tồn kho / Thuế). */
export async function fetchDashboardTasksUcRpt01(w: ApiWriter, d: Row = {}) {
  const qs = buildDashboardQueryParams(w.companyId, d);
  return await w.get(`${RPT_DASHBOARD}tasks/?${qs}`);
}

/** UC-RPT-01 (DASH-12): Nạp Danh sách chứng từ gần đây có phân lọc theo phân hệ và trạng thái. */
export async function fetchDashboardRecentDocumentsUcRpt01(w: ApiWriter, d: Row = {}) {
  const qs = buildDashboardQueryParams(w.companyId, d);
  return await w.get(`${RPT_DASHBOARD}recent-documents/?${qs}`);
}

/** UC-RPT-01 (MF-06, AF-06..AF-08, BR-RPT-DASH-60..63): Drill-down chi tiết chỉ tiêu KPI (DASH-01..DASH-10) để mở danh sách chứng từ/báo cáo nguồn kèm bộ lọc đồng bộ. */
export async function fetchDashboardMetricDetailsUcRpt01(w: ApiWriter, metricCode: string, d: Row = {}) {
  const qs = buildDashboardQueryParams(w.companyId, d);
  return await w.get(`${RPT_DASHBOARD}metrics/${encodeURIComponent(metricCode)}/details/?${qs}`);
}

/* ===================================================================== * UC-RPT-02 – Xem bộ báo cáo tài chính (Financial Statement Bundles)
 * ============================================================================ */

const RPT_FS_BUNDLES = "/api/v1/reports/financial-bundles/";
const RPT_FS_STATEMENTS = "/api/v1/reports/financial-statements/";

function buildFsBundleQueryParams(companyId: string | null | undefined, d: Row = {}): string {
  const p = new URLSearchParams();
  const cid = String(d.company_id || companyId || "");
  if (cid) p.set("company_id", cid);
  for (const key of [
    "fiscal_year",
    "fiscal_period_id",
    "bundle_type",
    "reporting_scope",
    "branch_id",
    "bundle_status",
    "bundle_version",
    "current_only",
    "show_zero_lines",
  ]) {
    if (d[key] !== undefined && d[key] !== null && d[key] !== "") {
      p.set(key, String(d[key]));
    }
  }
  return p.toString();
}

export async function fetchFinancialBundleTypesUcRpt02(w: ApiWriter, d: Row = {}) {
  const qs = buildFsBundleQueryParams(w.companyId, d);
  return await w.get(`${RPT_FS_BUNDLES}types/?${qs}`);
}

export async function fetchFinancialBundlesListUcRpt02(w: ApiWriter, d: Row = {}) {
  const qs = buildFsBundleQueryParams(w.companyId, d);
  return await w.get(`${RPT_FS_BUNDLES}?${qs}`);
}

export async function createFinancialBundleUcRpt02(w: ApiWriter, d: Row = {}) {
  return await w.post(RPT_FS_BUNDLES, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchFinancialBundleDetailUcRpt02(w: ApiWriter, bundleId: string, d: Row = {}) {
  const qs = buildFsBundleQueryParams(w.companyId, d);
  return await w.get(`${RPT_FS_BUNDLES}${encodeURIComponent(bundleId)}/?${qs}`);
}

export async function fetchFinancialBundleComponentsUcRpt02(w: ApiWriter, bundleId: string, d: Row = {}) {
  const qs = buildFsBundleQueryParams(w.companyId, d);
  return await w.get(`${RPT_FS_BUNDLES}${encodeURIComponent(bundleId)}/components/?${qs}`);
}

export async function fetchFinancialBundleValidationUcRpt02(w: ApiWriter, bundleId: string, d: Row = {}) {
  const qs = buildFsBundleQueryParams(w.companyId, d);
  return await w.get(`${RPT_FS_BUNDLES}${encodeURIComponent(bundleId)}/validation/?${qs}`);
}

export async function validateFinancialBundleUcRpt02(w: ApiWriter, bundleId: string, d: Row = {}) {
  return await w.post(`${RPT_FS_BUNDLES}${encodeURIComponent(bundleId)}/validate/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchFinancialBundleHistoryUcRpt02(w: ApiWriter, bundleId: string, d: Row = {}) {
  const qs = buildFsBundleQueryParams(w.companyId, d);
  return await w.get(`${RPT_FS_BUNDLES}${encodeURIComponent(bundleId)}/history/?${qs}`);
}

export async function fetchFinancialBundleSupportingReportsUcRpt02(w: ApiWriter, bundleId: string, d: Row = {}) {
  const qs = buildFsBundleQueryParams(w.companyId, d);
  return await w.get(`${RPT_FS_BUNDLES}${encodeURIComponent(bundleId)}/supporting-reports/?${qs}`);
}

export async function submitFinancialBundleReviewUcRpt02(w: ApiWriter, bundleId: string, d: Row = {}) {
  return await w.post(`${RPT_FS_BUNDLES}${encodeURIComponent(bundleId)}/submit-review/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function approveFinancialBundleUcRpt02(w: ApiWriter, bundleId: string, d: Row = {}) {
  return await w.post(`${RPT_FS_BUNDLES}${encodeURIComponent(bundleId)}/approve/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function exportFinancialBundleUcRpt02(w: ApiWriter, bundleId: string, d: Row = {}) {
  return await w.post(`${RPT_FS_BUNDLES}${encodeURIComponent(bundleId)}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function generateFinancialStatementRunUcRpt02(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_FS_STATEMENTS}generate/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchFinancialStatementRunDetailUcRpt02(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFsBundleQueryParams(w.companyId, d);
  return await w.get(`${RPT_FS_STATEMENTS}${encodeURIComponent(runId)}/?${qs}`);
}

export async function fetchFinancialStatementRunLinesUcRpt02(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFsBundleQueryParams(w.companyId, d);
  return await w.get(`${RPT_FS_STATEMENTS}${encodeURIComponent(runId)}/lines/?${qs}`);
}

export async function approveFinancialStatementRunUcRpt02(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_FS_STATEMENTS}${encodeURIComponent(runId)}/approve/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchFinancialStatementLineSourcesUcRpt02(
  w: ApiWriter,
  runId: string,
  lineId: string,
  d: Row = {},
) {
  const qs = buildFsBundleQueryParams(w.companyId, d);
  return await w.get(`${RPT_FS_STATEMENTS}${encodeURIComponent(runId)}/line/${encodeURIComponent(lineId)}/sources/?${qs}`);
}

/* ===================================================================== * UC-RPT-03 – Xem bảng cân đối kế toán / Báo cáo tình hình tài chính (B01-DN)
 * ============================================================================ */

const RPT_FINANCIAL_POSITION = "/api/v1/reports/financial-position/";

function buildFinancialPositionQueryParams(companyId: string | null | undefined, d: Row = {}): string {
  const p = new URLSearchParams();
  const cid = String(d.company_id || companyId || "");
  if (cid) p.set("company_id", cid);
  for (const key of [
    "template_code",
    "template_id",
    "template_version_id",
    "fiscal_year",
    "fiscal_period_id",
    "period_id",
    "comparison_period_id",
    "reporting_scope",
    "branch_id",
    "run_status",
    "display_unit",
    "hide_zero_lines",
    "show_zero_lines",
    "search",
    "column",
    "bundle_id",
  ]) {
    if (d[key] !== undefined && d[key] !== null && d[key] !== "") {
      p.set(key, String(d[key]));
    }
  }
  return p.toString();
}

export async function fetchFinancialPositionTemplatesUcRpt03(w: ApiWriter, d: Row = {}) {
  const qs = buildFinancialPositionQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_POSITION}templates/?${qs}`);
}

export async function fetchFinancialPositionTemplateVersionsUcRpt03(
  w: ApiWriter,
  templateIdOrCode: string,
  d: Row = {},
) {
  const qs = buildFinancialPositionQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_POSITION}templates/${encodeURIComponent(templateIdOrCode)}/versions/?${qs}`);
}

export async function fetchFinancialPositionParametersUcRpt03(w: ApiWriter, d: Row = {}) {
  const qs = buildFinancialPositionQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_POSITION}parameters/?${qs}`);
}

export async function fetchFinancialPositionRunsUcRpt03(w: ApiWriter, d: Row = {}) {
  const qs = buildFinancialPositionQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_POSITION}runs/?${qs}`);
}

export async function generateFinancialPositionRunUcRpt03(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_FINANCIAL_POSITION}runs/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchFinancialPositionRunDetailUcRpt03(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFinancialPositionQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_POSITION}runs/${encodeURIComponent(runId)}/?${qs}`);
}

export async function fetchFinancialPositionRunLinesUcRpt03(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFinancialPositionQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_POSITION}runs/${encodeURIComponent(runId)}/lines/?${qs}`);
}

export async function fetchFinancialPositionRunValidationUcRpt03(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFinancialPositionQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_POSITION}runs/${encodeURIComponent(runId)}/validation/?${qs}`);
}

export async function validateFinancialPositionRunUcRpt03(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_FINANCIAL_POSITION}runs/${encodeURIComponent(runId)}/validate/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchFinancialPositionLineCalculationUcRpt03(
  w: ApiWriter,
  runId: string,
  lineIdOrCode: string,
  d: Row = {},
) {
  const qs = buildFinancialPositionQueryParams(w.companyId, d);
  return await w.get(
    `${RPT_FINANCIAL_POSITION}runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(lineIdOrCode)}/calculation/?${qs}`,
  );
}

export async function fetchFinancialPositionLineDrilldownUcRpt03(
  w: ApiWriter,
  runId: string,
  lineIdOrCode: string,
  d: Row = {},
) {
  const qs = buildFinancialPositionQueryParams(w.companyId, d);
  return await w.get(
    `${RPT_FINANCIAL_POSITION}runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(lineIdOrCode)}/drilldown/?${qs}`,
  );
}

export async function fetchFinancialPositionRunHistoryUcRpt03(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFinancialPositionQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_POSITION}runs/${encodeURIComponent(runId)}/history/?${qs}`);
}

export async function submitFinancialPositionRunReviewUcRpt03(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_FINANCIAL_POSITION}runs/${encodeURIComponent(runId)}/submit-review/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function approveFinancialPositionRunUcRpt03(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_FINANCIAL_POSITION}runs/${encodeURIComponent(runId)}/approve/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function exportFinancialPositionRunUcRpt03(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_FINANCIAL_POSITION}runs/${encodeURIComponent(runId)}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}



/* ===================================================================== * UC-RPT-04 – Xem báo cáo kết quả hoạt động kinh doanh (B02-DN / B02-DNKLT / B02a-DN / B02b-DN)
 * ============================================================================ */

const RPT_BUSINESS_RESULT = "/api/v1/reports/business-result/";

function buildBusinessResultQueryParams(companyId: string | null | undefined, d: Row = {}): string {
  const p = new URLSearchParams();
  const cid = String(d.company_id || companyId || "");
  if (cid) p.set("company_id", cid);
  for (const key of [
    "template_code",
    "legal_form_code",
    "template_id",
    "template_version_id",
    "going_concern_status",
    "period_type",
    "fiscal_year",
    "fiscal_period_id",
    "period_id",
    "comparison_period_id",
    "reporting_scope",
    "branch_id",
    "run_status",
    "display_unit",
    "negative_format",
    "hide_zero_lines",
    "search",
    "slot_code",
    "require_saved_run",
    "strict_completeness",
  ]) {
    if (d[key] !== undefined && d[key] !== null && d[key] !== "") {
      p.set(key, String(d[key]));
    }
  }
  return p.toString();
}

export async function fetchBusinessResultTemplatesUcRpt04(w: ApiWriter, d: Row = {}) {
  const qs = buildBusinessResultQueryParams(w.companyId, d);
  return await w.get(`${RPT_BUSINESS_RESULT}templates/?${qs}`);
}

export async function fetchBusinessResultTemplateVersionsUcRpt04(
  w: ApiWriter,
  templateIdOrCode: string = "",
  d: Row = {},
) {
  const qs = buildBusinessResultQueryParams(w.companyId, {
    ...d,
    ...(templateIdOrCode ? { template_code: templateIdOrCode } : {}),
  });
  return await w.get(`${RPT_BUSINESS_RESULT}template-versions/?${qs}`);
}

export async function fetchBusinessResultParametersUcRpt04(w: ApiWriter, d: Row = {}) {
  const qs = buildBusinessResultQueryParams(w.companyId, d);
  return await w.get(`${RPT_BUSINESS_RESULT}parameters/?${qs}`);
}

export async function fetchBusinessResultRunsUcRpt04(w: ApiWriter, d: Row = {}) {
  const qs = buildBusinessResultQueryParams(w.companyId, d);
  return await w.get(`${RPT_BUSINESS_RESULT}runs/?${qs}`);
}

export async function generateBusinessResultRunUcRpt04(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_BUSINESS_RESULT}runs/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchBusinessResultRunDetailUcRpt04(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildBusinessResultQueryParams(w.companyId, d);
  return await w.get(`${RPT_BUSINESS_RESULT}runs/${encodeURIComponent(runId)}/?${qs}`);
}

export async function fetchBusinessResultRunLinesUcRpt04(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildBusinessResultQueryParams(w.companyId, d);
  return await w.get(`${RPT_BUSINESS_RESULT}runs/${encodeURIComponent(runId)}/lines/?${qs}`);
}

export async function fetchBusinessResultRunValuesUcRpt04(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildBusinessResultQueryParams(w.companyId, d);
  return await w.get(`${RPT_BUSINESS_RESULT}runs/${encodeURIComponent(runId)}/values/?${qs}`);
}

export async function fetchBusinessResultRunValidationUcRpt04(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildBusinessResultQueryParams(w.companyId, d);
  return await w.get(`${RPT_BUSINESS_RESULT}runs/${encodeURIComponent(runId)}/validation/?${qs}`);
}

export async function validateBusinessResultRunUcRpt04(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_BUSINESS_RESULT}runs/${encodeURIComponent(runId)}/validate/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchBusinessResultLineCalculationUcRpt04(
  w: ApiWriter,
  runId: string,
  indicatorCode: string,
  d: Row = {},
) {
  const qs = buildBusinessResultQueryParams(w.companyId, d);
  return await w.get(
    `${RPT_BUSINESS_RESULT}runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(indicatorCode)}/calculation/?${qs}`,
  );
}

export async function fetchBusinessResultLineDrilldownUcRpt04(
  w: ApiWriter,
  runId: string,
  indicatorCode: string,
  d: Row = {},
) {
  const qs = buildBusinessResultQueryParams(w.companyId, d);
  return await w.get(
    `${RPT_BUSINESS_RESULT}runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(indicatorCode)}/drilldown/?${qs}`,
  );
}

export async function fetchBusinessResultRunHistoryUcRpt04(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildBusinessResultQueryParams(w.companyId, d);
  return await w.get(`${RPT_BUSINESS_RESULT}runs/${encodeURIComponent(runId)}/history/?${qs}`);
}

export async function submitBusinessResultRunReviewUcRpt04(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_BUSINESS_RESULT}runs/${encodeURIComponent(runId)}/submit-review/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function approveBusinessResultRunUcRpt04(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_BUSINESS_RESULT}runs/${encodeURIComponent(runId)}/approve/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function exportBusinessResultRunUcRpt04(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_BUSINESS_RESULT}runs/${encodeURIComponent(runId)}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}



/* ===================================================================== * UC-RPT-05 – Xem báo cáo lưu chuyển tiền tệ (B03-DN / B03-DNKLT / B03a-DN / B03b-DN)
 * ============================================================================ */

const RPT_CASH_FLOW = "/api/v1/reports/cash-flow/";

function buildCashFlowQueryParams(companyId: string | null | undefined, d: Row = {}): string {
  const p = new URLSearchParams();
  const cid = String(d.company_id || companyId || "");
  if (cid) p.set("company_id", cid);
  for (const key of [
    "template_code",
    "legal_form_code",
    "template_id",
    "template_version_id",
    "cash_flow_method",
    "going_concern_status",
    "period_type",
    "fiscal_year",
    "fiscal_period_id",
    "period_id",
    "comparison_period_id",
    "reporting_scope",
    "branch_id",
    "run_status",
    "display_unit",
    "negative_format",
    "hide_zero_lines",
    "search",
    "slot_code",
    "require_saved_run",
  ]) {
    if (d[key] !== undefined && d[key] !== null && d[key] !== "") {
      p.set(key, String(d[key]));
    }
  }
  return p.toString();
}

export async function fetchCashFlowTemplatesUcRpt05(w: ApiWriter, d: Row = {}) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(`${RPT_CASH_FLOW}templates/?${qs}`);
}

export async function fetchCashFlowTemplateVersionsUcRpt05(
  w: ApiWriter,
  templateIdOrCode: string = "",
  d: Row = {},
) {
  const qs = buildCashFlowQueryParams(w.companyId, {
    ...d,
    ...(templateIdOrCode ? { template_code: templateIdOrCode } : {}),
  });
  return await w.get(`${RPT_CASH_FLOW}template-versions/?${qs}`);
}

export async function fetchCashFlowParametersUcRpt05(w: ApiWriter, d: Row = {}) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(`${RPT_CASH_FLOW}parameters/?${qs}`);
}

export async function fetchCashFlowRunsUcRpt05(w: ApiWriter, d: Row = {}) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(`${RPT_CASH_FLOW}runs/?${qs}`);
}

export async function generateCashFlowRunUcRpt05(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_CASH_FLOW}runs/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchCashFlowRunDetailUcRpt05(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(`${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/?${qs}`);
}

export async function fetchCashFlowRunLinesUcRpt05(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(`${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/lines/?${qs}`);
}

export async function fetchCashFlowRunValuesUcRpt05(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(`${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/values/?${qs}`);
}

export async function fetchCashFlowRunValidationUcRpt05(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(`${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/validation/?${qs}`);
}

export async function validateCashFlowRunUcRpt05(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/validate/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchCashFlowLineCalculationUcRpt05(
  w: ApiWriter,
  runId: string,
  indicatorCode: string,
  d: Row = {},
) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(
    `${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(indicatorCode)}/calculation/?${qs}`,
  );
}

export async function fetchCashFlowLineDrilldownUcRpt05(
  w: ApiWriter,
  runId: string,
  indicatorCode: string,
  d: Row = {},
) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(
    `${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(indicatorCode)}/drilldown/?${qs}`,
  );
}

export async function fetchCashFlowUnclassifiedTransactionsUcRpt05(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(`${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/unclassified-transactions/?${qs}`);
}

export async function fetchCashFlowReconciliationUcRpt05(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(`${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/reconciliation/?${qs}`);
}

export async function fetchCashFlowRunHistoryUcRpt05(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildCashFlowQueryParams(w.companyId, d);
  return await w.get(`${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/history/?${qs}`);
}

export async function submitCashFlowRunReviewUcRpt05(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/submit-review/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function approveCashFlowRunUcRpt05(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/approve/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function exportCashFlowRunUcRpt05(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_CASH_FLOW}runs/${encodeURIComponent(runId)}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

/* ===================================================================== * UC-RPT-06 – Xem thuyết minh báo cáo tài chính (B09-DN / B09-DNKLT / B09a-DN)
 * ============================================================================ */

const RPT_FINANCIAL_NOTES = "/api/v1/reports/financial-notes/";

function buildFinancialNotesQueryParams(companyId: string | null | undefined, d: Row = {}): string {
  const p = new URLSearchParams();
  const cid = String(d.company_id || companyId || "");
  if (cid) p.set("company_id", cid);
  for (const key of [
    "template_code",
    "legal_form_code",
    "template_id",
    "template_version_id",
    "going_concern_status",
    "period_type",
    "fiscal_year",
    "fiscal_period_id",
    "period_id",
    "comparison_period_id",
    "reporting_scope",
    "branch_id",
    "run_status",
    "display_unit",
    "negative_format",
    "hide_not_applicable",
    "search",
    "q",
    "slot_code",
    "require_saved_run",
  ]) {
    if (d[key] !== undefined && d[key] !== null && d[key] !== "") {
      p.set(key, String(d[key]));
    }
  }
  return p.toString();
}

export async function fetchFinancialNotesTemplatesUcRpt06(w: ApiWriter, d: Row = {}) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_NOTES}templates/?${qs}`);
}

export async function fetchFinancialNotesTemplateVersionsUcRpt06(
  w: ApiWriter,
  templateIdOrCode: string = "",
  d: Row = {},
) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  if (templateIdOrCode) {
    return await w.get(
      `${RPT_FINANCIAL_NOTES}templates/${encodeURIComponent(templateIdOrCode)}/versions/?${qs}`,
    );
  }
  return await w.get(`${RPT_FINANCIAL_NOTES}template-versions/?${qs}`);
}

export async function fetchFinancialNotesParametersUcRpt06(w: ApiWriter, d: Row = {}) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_NOTES}parameters/?${qs}`);
}

export async function fetchFinancialNotesRunsUcRpt06(w: ApiWriter, d: Row = {}) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_NOTES}runs/?${qs}`);
}

export async function generateFinancialNotesRunUcRpt06(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_FINANCIAL_NOTES}runs/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchFinancialNotesRunDetailUcRpt06(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/?${qs}`);
}

export async function fetchFinancialNotesRunSectionsUcRpt06(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/sections/?${qs}`);
}

export async function fetchFinancialNotesSectionDetailUcRpt06(
  w: ApiWriter,
  runId: string,
  sectionCode: string,
  d: Row = {},
) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(
    `${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/sections/${encodeURIComponent(sectionCode)}/?${qs}`,
  );
}

export async function fetchFinancialNotesItemDetailUcRpt06(
  w: ApiWriter,
  runId: string,
  noteCode: string,
  d: Row = {},
) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(
    `${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(noteCode)}/?${qs}`,
  );
}

export async function updateFinancialNotesItemDetailUcRpt06(
  w: ApiWriter,
  runId: string,
  noteCode: string,
  d: Row = {},
) {
  return await w.post(
    `${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(noteCode)}/`,
    {
      company_id: d.company_id || w.companyId,
      ...d,
    },
  );
}

export async function fetchFinancialNotesItemTablesUcRpt06(
  w: ApiWriter,
  runId: string,
  noteCode: string,
  d: Row = {},
) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(
    `${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(noteCode)}/tables/?${qs}`,
  );
}

export async function fetchFinancialNotesTableRowsUcRpt06(
  w: ApiWriter,
  runId: string,
  tableIdOrCode: string,
  d: Row = {},
) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(
    `${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/tables/${encodeURIComponent(tableIdOrCode)}/rows/?${qs}`,
  );
}

export async function fetchFinancialNotesItemSourcesUcRpt06(
  w: ApiWriter,
  runId: string,
  noteCode: string,
  d: Row = {},
) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(
    `${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(noteCode)}/sources/?${qs}`,
  );
}

export async function fetchFinancialNotesRunValidationUcRpt06(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/validation/?${qs}`);
}

export async function fetchFinancialNotesRunCompletenessUcRpt06(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/completeness/?${qs}`);
}

export async function fetchFinancialNotesRunHistoryUcRpt06(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/history/?${qs}`);
}

export async function searchFinancialNotesRunUcRpt06(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = buildFinancialNotesQueryParams(w.companyId, d);
  return await w.get(`${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/search/?${qs}`);
}

export async function validateFinancialNotesRunUcRpt06(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/validate/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function submitFinancialNotesRunReviewUcRpt06(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/submit-review/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function approveFinancialNotesRunUcRpt06(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/approve/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function exportFinancialNotesRunUcRpt06(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_FINANCIAL_NOTES}runs/${encodeURIComponent(runId)}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

// =====================================================================// UC-RPT-07 – Xem báo cáo thuế (Tax Reports)
// =====================================================================const RPT_TAX = "/api/v1/reports/tax/";

export async function fetchTaxReportCatalogueUcRpt07(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.tax_type) qs.set("tax_type", String(d.tax_type));
  if (d.report_category) qs.set("report_category", String(d.report_category));
  return await w.get(`${RPT_TAX}catalogue/?${qs.toString()}`);
}

export async function fetchTaxReportSchemaUcRpt07(w: ApiWriter, reportCode: string, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  return await w.get(`${RPT_TAX}${encodeURIComponent(reportCode)}/schema/?${qs.toString()}`);
}

export async function fetchTaxReportParametersUcRpt07(w: ApiWriter, reportCode: string, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  return await w.get(`${RPT_TAX}${encodeURIComponent(reportCode)}/parameters/?${qs.toString()}`);
}

export async function fetchTaxReportFormsUcRpt07(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  return await w.get(`${RPT_TAX}forms/?${qs.toString()}`);
}

export async function fetchTaxReportFormVersionsUcRpt07(w: ApiWriter, formCode: string, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  return await w.get(`${RPT_TAX}forms/${encodeURIComponent(formCode)}/versions/?${qs.toString()}`);
}

export async function queryTaxReportUcRpt07(w: ApiWriter, reportCode: string, d: Row = {}) {
  return await w.post(`${RPT_TAX}${encodeURIComponent(reportCode)}/query/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchTaxReportRunHeaderUcRpt07(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_TAX}runs/${encodeURIComponent(String(runId))}/`);
}

export async function fetchTaxReportRunRowsUcRpt07(w: ApiWriter, runId: string | number, d: Row = {}) {
  const qs = new URLSearchParams();
  if (d.search) qs.set("search", String(d.search));
  if (d.only_warnings) qs.set("only_warnings", String(d.only_warnings));
  const queryStr = qs.toString() ? `?${qs.toString()}` : "";
  return await w.get(`${RPT_TAX}runs/${encodeURIComponent(String(runId))}/rows/${queryStr}`);
}

export async function fetchTaxReportRunSummaryUcRpt07(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_TAX}runs/${encodeURIComponent(String(runId))}/summary/`);
}

export async function fetchTaxReportRunValidationUcRpt07(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_TAX}runs/${encodeURIComponent(String(runId))}/validation/`);
}

export async function fetchTaxReportRowSourcesUcRpt07(w: ApiWriter, runId: string | number, rowId: string | number) {
  return await w.get(`${RPT_TAX}runs/${encodeURIComponent(String(runId))}/rows/${encodeURIComponent(String(rowId))}/sources/`);
}

export async function fetchTaxReportRunHistoryUcRpt07(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_TAX}runs/${encodeURIComponent(String(runId))}/history/`);
}

export async function fetchTaxReconciliationDifferencesUcRpt07(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_TAX}reconciliation-runs/${encodeURIComponent(String(runId))}/differences/`);
}

export async function exportTaxReportRunUcRpt07(w: ApiWriter, runId: string | number, d: Row = {}) {
  return await w.post(`${RPT_TAX}runs/${encodeURIComponent(String(runId))}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

// =====================================================================// UC-RPT-08 – Xem báo cáo mua hàng (Purchase Reports)
// =====================================================================const RPT_PURCHASE = "/api/v1/reports/purchase/";

export async function fetchPurchaseReportCatalogueUcRpt08(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.report_category_type) qs.set("report_category_type", String(d.report_category_type));
  if (d.report_category) qs.set("report_category", String(d.report_category));
  return await w.get(`${RPT_PURCHASE}catalogue/?${qs.toString()}`);
}

export async function fetchPurchaseReportSchemaUcRpt08(w: ApiWriter, reportCode: string, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  return await w.get(`${RPT_PURCHASE}${encodeURIComponent(reportCode)}/schema/?${qs.toString()}`);
}

export async function fetchPurchaseReportParametersUcRpt08(w: ApiWriter, reportCode: string, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  return await w.get(`${RPT_PURCHASE}${encodeURIComponent(reportCode)}/parameters/?${qs.toString()}`);
}

export async function queryPurchaseReportUcRpt08(w: ApiWriter, reportCode: string, d: Row = {}) {
  return await w.post(`${RPT_PURCHASE}${encodeURIComponent(reportCode)}/query/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchPurchaseReportRunHeaderUcRpt08(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_PURCHASE}runs/${encodeURIComponent(String(runId))}/`);
}

export async function fetchPurchaseReportRunRowsUcRpt08(w: ApiWriter, runId: string | number, d: Row = {}) {
  const qs = new URLSearchParams();
  if (d.search) qs.set("search", String(d.search));
  if (d.only_warnings) qs.set("only_warnings", String(d.only_warnings));
  const queryStr = qs.toString() ? `?${qs.toString()}` : "";
  return await w.get(`${RPT_PURCHASE}runs/${encodeURIComponent(String(runId))}/rows/${queryStr}`);
}

export async function fetchPurchaseReportRunSummaryUcRpt08(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_PURCHASE}runs/${encodeURIComponent(String(runId))}/summary/`);
}

export async function fetchPurchaseReportRunValidationUcRpt08(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_PURCHASE}runs/${encodeURIComponent(String(runId))}/validation/`);
}

export async function fetchPurchaseReportRowSourcesUcRpt08(w: ApiWriter, runId: string | number, rowId: string | number) {
  return await w.get(`${RPT_PURCHASE}runs/${encodeURIComponent(String(runId))}/rows/${encodeURIComponent(String(rowId))}/sources/`);
}

export async function fetchPurchaseReportRunHistoryUcRpt08(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_PURCHASE}runs/${encodeURIComponent(String(runId))}/history/`);
}

export async function fetchPurchaseReportSavedFiltersUcRpt08(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.report_code) qs.set("report_code", String(d.report_code));
  return await w.get(`${RPT_PURCHASE}saved/?${qs.toString()}`);
}

export async function savePurchaseReportFilterUcRpt08(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_PURCHASE}saved/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchPurchaseReconciliationDifferencesUcRpt08(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_PURCHASE}reconciliation/${encodeURIComponent(String(runId))}/differences/`);
}

export async function exportPurchaseReportRunUcRpt08(w: ApiWriter, runId: string | number, d: Row = {}) {
  return await w.post(`${RPT_PURCHASE}runs/${encodeURIComponent(String(runId))}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

// =====================================================================// UC-RPT-09: Báo cáo bán hàng (36 báo cáo)
// =====================================================================const RPT_SALES = "/api/v1/reports/sales/";

export async function fetchSalesReportCatalogueUcRpt09(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.report_category_type) qs.set("report_category_type", String(d.report_category_type));
  if (d.report_category) qs.set("report_category", String(d.report_category));
  return await w.get(`${RPT_SALES}catalogue/?${qs.toString()}`);
}

export async function fetchSalesReportSchemaUcRpt09(w: ApiWriter, reportCode: string, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  return await w.get(`${RPT_SALES}${encodeURIComponent(reportCode)}/schema/?${qs.toString()}`);
}

export async function fetchSalesReportParametersUcRpt09(w: ApiWriter, reportCode: string, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  return await w.get(`${RPT_SALES}${encodeURIComponent(reportCode)}/parameters/?${qs.toString()}`);
}

export async function querySalesReportUcRpt09(w: ApiWriter, reportCode: string, d: Row = {}) {
  return await w.post(`${RPT_SALES}${encodeURIComponent(reportCode)}/query/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchSalesReportRunHeaderUcRpt09(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_SALES}runs/${encodeURIComponent(String(runId))}/`);
}

export async function fetchSalesReportRunRowsUcRpt09(w: ApiWriter, runId: string | number, d: Row = {}) {
  const qs = new URLSearchParams();
  if (d.search) qs.set("search", String(d.search));
  if (d.only_warnings) qs.set("only_warnings", String(d.only_warnings));
  const queryStr = qs.toString() ? `?${qs.toString()}` : "";
  return await w.get(`${RPT_SALES}runs/${encodeURIComponent(String(runId))}/rows/${queryStr}`);
}

export async function fetchSalesReportRunSummaryUcRpt09(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_SALES}runs/${encodeURIComponent(String(runId))}/summary/`);
}

export async function fetchSalesReportRunValidationUcRpt09(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_SALES}runs/${encodeURIComponent(String(runId))}/validation/`);
}

export async function fetchSalesReportRowSourcesUcRpt09(w: ApiWriter, runId: string | number, rowId: string | number) {
  return await w.get(`${RPT_SALES}runs/${encodeURIComponent(String(runId))}/rows/${encodeURIComponent(String(rowId))}/sources/`);
}

export async function fetchSalesReportRunHistoryUcRpt09(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_SALES}runs/${encodeURIComponent(String(runId))}/history/`);
}

export async function fetchSalesReportSavedFiltersUcRpt09(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.report_code) qs.set("report_code", String(d.report_code));
  return await w.get(`${RPT_SALES}saved/?${qs.toString()}`);
}

export async function saveSalesReportFilterUcRpt09(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_SALES}saved/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchSalesOrderFulfillmentUcRpt09(w: ApiWriter, orderId: string | number) {
  return await w.get(`${RPT_SALES}order-fulfillment/${encodeURIComponent(String(orderId))}/`);
}

export async function fetchSalesContractFulfillmentUcRpt09(w: ApiWriter, contractId: string | number) {
  return await w.get(`${RPT_SALES}contract-fulfillment/${encodeURIComponent(String(contractId))}/`);
}

export async function fetchSalesProfitabilityUcRpt09(w: ApiWriter, targetType: string, targetId: string | number) {
  return await w.get(`${RPT_SALES}profitability/${encodeURIComponent(targetType)}/${encodeURIComponent(String(targetId))}/`);
}

export async function exportSalesReportRunUcRpt09(w: ApiWriter, runId: string | number, d: Row = {}) {
  return await w.post(`${RPT_SALES}runs/${encodeURIComponent(String(runId))}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

// =====================================================================// UC-RPT-10: Báo cáo công nợ (49 báo cáo: 18 AP + 31 AR / Combined)
// =====================================================================const RPT_DEBT = "/api/v1/reports/debt/";

export async function fetchDebtReportCatalogueUcRpt10(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.report_direction) qs.set("report_direction", String(d.report_direction));
  if (d.report_category_type) qs.set("report_category_type", String(d.report_category_type));
  return await w.get(`${RPT_DEBT}catalogue/?${qs.toString()}`);
}

export async function fetchDebtReportSchemaUcRpt10(w: ApiWriter, reportCode: string, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  return await w.get(`${RPT_DEBT}${encodeURIComponent(reportCode)}/schema/?${qs.toString()}`);
}

export async function fetchDebtReportParametersUcRpt10(w: ApiWriter, reportCode: string, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  return await w.get(`${RPT_DEBT}${encodeURIComponent(reportCode)}/parameters/?${qs.toString()}`);
}

export async function queryDebtReportUcRpt10(w: ApiWriter, reportCode: string, d: Row = {}) {
  return await w.post(`${RPT_DEBT}${encodeURIComponent(reportCode)}/query/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchDebtReportRunHeaderUcRpt10(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_DEBT}runs/${encodeURIComponent(String(runId))}/`);
}

export async function fetchDebtReportRunRowsUcRpt10(w: ApiWriter, runId: string | number, d: Row = {}) {
  const qs = new URLSearchParams();
  if (d.search) qs.set("search", String(d.search));
  if (d.only_warnings) qs.set("only_warnings", String(d.only_warnings));
  const queryStr = qs.toString() ? `?${qs.toString()}` : "";
  return await w.get(`${RPT_DEBT}runs/${encodeURIComponent(String(runId))}/rows/${queryStr}`);
}

export async function fetchDebtReportRunSummaryUcRpt10(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_DEBT}runs/${encodeURIComponent(String(runId))}/summary/`);
}

export async function fetchDebtReportRunValidationUcRpt10(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_DEBT}runs/${encodeURIComponent(String(runId))}/validation/`);
}

export async function fetchDebtReportRowSourcesUcRpt10(w: ApiWriter, runId: string | number, rowId: string | number) {
  return await w.get(`${RPT_DEBT}runs/${encodeURIComponent(String(runId))}/rows/${encodeURIComponent(String(rowId))}/sources/`);
}

export async function fetchDebtReportRunHistoryUcRpt10(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_DEBT}runs/${encodeURIComponent(String(runId))}/history/`);
}

export async function fetchDebtReportSavedFiltersUcRpt10(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.report_code) qs.set("report_code", String(d.report_code));
  return await w.get(`${RPT_DEBT}saved/?${qs.toString()}`);
}

export async function saveDebtReportFilterUcRpt10(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_DEBT}saved/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchDebtAgingAnalysisUcRpt10(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_DEBT}aging-analysis/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchDebtConfirmationDocumentUcRpt10(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_DEBT}confirmation-document/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchDebtContractCombinedUcRpt10(w: ApiWriter, contractId: string | number) {
  return await w.get(`${RPT_DEBT}contract-combined/${encodeURIComponent(String(contractId))}/`);
}

export async function fetchDebtReconciliationDifferencesUcRpt10(w: ApiWriter, runId: string | number) {
  return await w.get(`${RPT_DEBT}reconciliation/${encodeURIComponent(String(runId))}/differences/`);
}

export async function exportDebtReportRunUcRpt10(w: ApiWriter, runId: string | number, d: Row = {}) {
  return await w.post(`${RPT_DEBT}runs/${encodeURIComponent(String(runId))}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

// =====================================================================// UC-RPT-11: Báo cáo tiền (Cash, Bank, Transfers, Loans)
// =====================================================================
const RPT_MONEY = "/api/v1/reports/money/";

export async function fetchMoneyReportCatalogueUcRpt11(w: ApiWriter, companyId?: string) {
  const cid = companyId || w.companyId;
  return await w.get(`${RPT_MONEY}catalogue/?company_id=${encodeURIComponent(cid)}`);
}

export async function fetchMoneyReportSchemaUcRpt11(w: ApiWriter, reportCode: string) {
  return await w.get(`${RPT_MONEY}${encodeURIComponent(reportCode)}/schema/`);
}

export async function fetchMoneyReportParametersUcRpt11(w: ApiWriter, reportCode: string) {
  return await w.get(`${RPT_MONEY}${encodeURIComponent(reportCode)}/parameters/`);
}

export async function queryMoneyReportUcRpt11(w: ApiWriter, reportCode: string, d: Row = {}) {
  return await w.post(`${RPT_MONEY}${encodeURIComponent(reportCode)}/query/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchMoneyReportRunDetailsUcRpt11(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_MONEY}runs/${encodeURIComponent(runId)}/`);
}

export async function fetchMoneyReportRunRowsUcRpt11(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = new URLSearchParams();
  if (d.search) qs.set("search", String(d.search));
  const queryStr = qs.toString() ? `?${qs.toString()}` : "";
  return await w.get(`${RPT_MONEY}runs/${encodeURIComponent(runId)}/rows/${queryStr}`);
}

export async function fetchMoneyReportRunSummaryUcRpt11(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_MONEY}runs/${encodeURIComponent(runId)}/summary/`);
}

export async function fetchMoneyReportRunValidationUcRpt11(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_MONEY}runs/${encodeURIComponent(runId)}/validation/`);
}

export async function fetchMoneyReportRowSourcesUcRpt11(w: ApiWriter, runId: string, rowId: string | number) {
  return await w.get(`${RPT_MONEY}runs/${encodeURIComponent(runId)}/rows/${encodeURIComponent(String(rowId))}/sources/`);
}

export async function fetchMoneyReportRunHistoryUcRpt11(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_MONEY}runs/${encodeURIComponent(runId)}/history/`);
}

export async function fetchMoneyBalancesAsOfUcRpt11(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.as_of_date) qs.set("as_of_date", String(d.as_of_date));
  if (d.comparison_date) qs.set("comparison_date", String(d.comparison_date));
  return await w.get(`${RPT_MONEY}balances/as-of/?${qs.toString()}`);
}

export async function fetchMoneyCashFundsUcRpt11(w: ApiWriter, companyId?: string) {
  const cid = companyId || w.companyId;
  return await w.get(`${RPT_MONEY}cash-funds/?company_id=${encodeURIComponent(cid)}`);
}

export async function fetchMoneyBankAccountsUcRpt11(w: ApiWriter, companyId?: string) {
  const cid = companyId || w.companyId;
  return await w.get(`${RPT_MONEY}bank-accounts/?company_id=${encodeURIComponent(cid)}`);
}

export async function traceMoneyTransferUcRpt11(w: ApiWriter, transferId: string) {
  return await w.get(`${RPT_MONEY}transfers/${encodeURIComponent(transferId)}/trace/`);
}

export async function fetchLoanSummaryUcRpt11(w: ApiWriter, loanId: string) {
  return await w.get(`${RPT_MONEY}loans/${encodeURIComponent(loanId)}/summary/`);
}

export async function fetchBankReconciliationDifferencesUcRpt11(w: ApiWriter, companyId?: string) {
  const cid = companyId || w.companyId;
  return await w.get(`${RPT_MONEY}reconciliation/differences/?company_id=${encodeURIComponent(cid)}`);
}

export async function fetchMoneyReportSavedFiltersUcRpt11(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.report_code) qs.set("report_code", String(d.report_code));
  return await w.get(`${RPT_MONEY}saved/?${qs.toString()}`);
}

export async function saveMoneyReportFilterUcRpt11(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_MONEY}saved/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function exportMoneyReportRunUcRpt11(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_MONEY}runs/${encodeURIComponent(runId)}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

// ---------------------------------------------------------------------------
// UC-RPT-12 – Xem báo cáo kho (15 Báo cáo)
// ---------------------------------------------------------------------------
const RPT_INVENTORY = "/api/v1/reports/inventory/";

export async function fetchInventoryReportCatalogueUcRpt12(w: ApiWriter, companyId?: string) {
  const cid = companyId || w.companyId;
  return await w.get(`${RPT_INVENTORY}catalogue/?company_id=${encodeURIComponent(cid)}`);
}

export async function fetchInventoryReportSchemaUcRpt12(w: ApiWriter, reportCode: string) {
  return await w.get(`${RPT_INVENTORY}${encodeURIComponent(reportCode)}/schema/`);
}

export async function fetchInventoryReportParametersUcRpt12(w: ApiWriter, reportCode: string) {
  return await w.get(`${RPT_INVENTORY}${encodeURIComponent(reportCode)}/parameters/`);
}

export async function queryInventoryReportUcRpt12(w: ApiWriter, reportCode: string, d: Row = {}) {
  return await w.post(`${RPT_INVENTORY}${encodeURIComponent(reportCode)}/query/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchInventoryReportRunDetailsUcRpt12(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_INVENTORY}runs/${encodeURIComponent(runId)}/`);
}

export async function fetchInventoryReportRunRowsUcRpt12(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = new URLSearchParams();
  if (d.search) qs.set("search", String(d.search));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return await w.get(`${RPT_INVENTORY}runs/${encodeURIComponent(runId)}/rows/${query}`);
}

export async function fetchInventoryReportRunSummaryUcRpt12(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_INVENTORY}runs/${encodeURIComponent(runId)}/summary/`);
}

export async function fetchInventoryReportRunValidationUcRpt12(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_INVENTORY}runs/${encodeURIComponent(runId)}/validation/`);
}

export async function fetchInventoryReportRowSourcesUcRpt12(w: ApiWriter, runId: string, rowId: string | number) {
  return await w.get(`${RPT_INVENTORY}runs/${encodeURIComponent(runId)}/rows/${encodeURIComponent(String(rowId))}/sources/`);
}

export async function fetchInventoryReportRunHistoryUcRpt12(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_INVENTORY}runs/${encodeURIComponent(runId)}/history/`);
}

export async function fetchInventoryBalancesAsOfUcRpt12(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.as_of_date) qs.set("as_of_date", String(d.as_of_date));
  return await w.get(`${RPT_INVENTORY}balances/as-of/?${qs.toString()}`);
}

export async function fetchInventorySavedFiltersUcRpt12(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.report_code) qs.set("report_code", String(d.report_code));
  return await w.get(`${RPT_INVENTORY}saved/?${qs.toString()}`);
}

export async function saveInventoryFilterUcRpt12(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_INVENTORY}saved/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function exportInventoryReportRunUcRpt12(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_INVENTORY}runs/${encodeURIComponent(runId)}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

// ---------------------------------------------------------------------------
// UC-RPT-13 – Xem báo cáo tài sản và công cụ dụng cụ (14 Báo cáo TSCĐ, CCDC & CPTT)
// ---------------------------------------------------------------------------
const RPT_ASSETS = "/api/v1/reports/assets/";

export async function fetchAssetReportCatalogueUcRpt13(w: ApiWriter, companyId?: string) {
  const cid = companyId || w.companyId;
  return await w.get(`${RPT_ASSETS}catalogue/?company_id=${encodeURIComponent(cid)}`);
}

export async function fetchAssetReportSchemaUcRpt13(w: ApiWriter, reportCode: string) {
  return await w.get(`${RPT_ASSETS}${encodeURIComponent(reportCode)}/schema/`);
}

export async function fetchAssetReportParametersUcRpt13(w: ApiWriter, reportCode: string) {
  return await w.get(`${RPT_ASSETS}${encodeURIComponent(reportCode)}/parameters/`);
}

export async function queryAssetReportUcRpt13(w: ApiWriter, reportCode: string, d: Row = {}) {
  return await w.post(`${RPT_ASSETS}${encodeURIComponent(reportCode)}/query/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchAssetReportRunDetailsUcRpt13(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_ASSETS}runs/${encodeURIComponent(runId)}/`);
}

export async function fetchAssetReportRunRowsUcRpt13(w: ApiWriter, runId: string, d: Row = {}) {
  const qs = new URLSearchParams();
  if (d.search) qs.set("search", String(d.search));
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return await w.get(`${RPT_ASSETS}runs/${encodeURIComponent(runId)}/rows/${query}`);
}

export async function fetchAssetReportRunSummaryUcRpt13(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_ASSETS}runs/${encodeURIComponent(runId)}/summary/`);
}

export async function fetchAssetReportRunValidationUcRpt13(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_ASSETS}runs/${encodeURIComponent(runId)}/validation/`);
}

export async function fetchAssetReportRowSourcesUcRpt13(w: ApiWriter, runId: string, rowId: string | number) {
  return await w.get(`${RPT_ASSETS}runs/${encodeURIComponent(runId)}/rows/${encodeURIComponent(String(rowId))}/sources/`);
}

export async function fetchAssetReportRunHistoryUcRpt13(w: ApiWriter, runId: string) {
  return await w.get(`${RPT_ASSETS}runs/${encodeURIComponent(runId)}/history/`);
}

export async function fetchAssetBalancesAsOfUcRpt13(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.as_of_date) qs.set("as_of_date", String(d.as_of_date));
  return await w.get(`${RPT_ASSETS}balances/as-of/?${qs.toString()}`);
}

export async function fetchAssetSavedFiltersUcRpt13(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  if (d.report_code) qs.set("report_code", String(d.report_code));
  return await w.get(`${RPT_ASSETS}saved/?${qs.toString()}`);
}

export async function saveAssetFilterUcRpt13(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_ASSETS}saved/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function exportAssetReportRunUcRpt13(w: ApiWriter, runId: string, d: Row = {}) {
  return await w.post(`${RPT_ASSETS}runs/${encodeURIComponent(runId)}/export/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

// =====================================================================// UC-RPT-15: In hoặc Export báo cáo (Print & Export Reports Engine)
// =====================================================================
const RPT_EXPORT = "/api/v1/reports/export/";

export async function fetchReportExportCapabilitiesUcRpt15(w: ApiWriter, reportCode: string) {
  return await w.get(`/api/v1/reports/${encodeURIComponent(reportCode)}/export-capabilities/`);
}

export async function fetchReportExportTemplatesUcRpt15(w: ApiWriter, reportCode: string) {
  return await w.get(`/api/v1/reports/${encodeURIComponent(reportCode)}/export-templates/`);
}

export async function previewReportExportUcRpt15(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_EXPORT}preview/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function createReportExportJobUcRpt15(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_EXPORT}jobs/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchReportExportJobDetailUcRpt15(w: ApiWriter, jobId: string) {
  return await w.get(`${RPT_EXPORT}jobs/${encodeURIComponent(jobId)}/`);
}

export async function fetchReportExportJobArtifactsUcRpt15(w: ApiWriter, jobId: string) {
  return await w.get(`${RPT_EXPORT}jobs/${encodeURIComponent(jobId)}/artifacts/`);
}

export async function cancelReportExportJobUcRpt15(w: ApiWriter, jobId: string) {
  return await w.post(`${RPT_EXPORT}jobs/${encodeURIComponent(jobId)}/cancel/`, {});
}

export async function retryReportExportJobUcRpt15(w: ApiWriter, jobId: string, d: Row = {}) {
  return await w.post(`${RPT_EXPORT}jobs/${encodeURIComponent(jobId)}/retry/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function requestReportExportDownloadAccessUcRpt15(w: ApiWriter, artifactId: string) {
  return await w.post(`${RPT_EXPORT}artifacts/${encodeURIComponent(artifactId)}/download-access/`, {});
}

export async function fetchReportExportHistoryUcRpt15(w: ApiWriter, d: Row = {}) {
  const qs = new URLSearchParams();
  qs.set("company_id", String(d.company_id || w.companyId));
  return await w.get(`${RPT_EXPORT}history/?${qs.toString()}`);
}

export async function exportReportDetailUcRpt15(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_EXPORT}detail/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

// =====================================================================// UC-RPT-14: Xem chi tiết số liệu báo cáo (Report Data Drill-Down & Lineage)
// =====================================================================
const RPT_DRILLDOWN = "/api/v1/reports/drilldown/";

export async function fetchReportDrilldownCapabilitiesUcRpt14(w: ApiWriter, reportCode: string) {
  return await w.get(`/api/v1/reports/${encodeURIComponent(reportCode)}/drilldown-capabilities/`);
}

export async function openReportCellDrilldownUcRpt14(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_DRILLDOWN}open/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}


export async function openCellContextUcRpt14(
  w: ApiWriter,
  reportCode: string,
  cellKey: string,
  field: string,
  val: any,
  contextData: Row = {}
) {
  return await openReportCellDrilldownUcRpt14(w, {
    report_code: reportCode,
    cell_key: cellKey,
    field_code: field,
    value: val,
    ...contextData,
  });
}
export async function queryReportDrilldownNodeUcRpt14(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_DRILLDOWN}nodes/query/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
}

export async function fetchReportCellFormulaUcRpt14(w: ApiWriter, contextId: string) {
  return await w.get(`${RPT_DRILLDOWN}${encodeURIComponent(contextId)}/formula/`);
}

export async function fetchReportCellSummaryUcRpt14(w: ApiWriter, contextId: string) {
  return await w.get(`${RPT_DRILLDOWN}${encodeURIComponent(contextId)}/summary/`);
}

export async function fetchReportCellTransactionsUcRpt14(w: ApiWriter, contextId: string, d: Row = {}) {
  const qs = new URLSearchParams();
  if (d.page) qs.set("page", String(d.page));
  if (d.page_size) qs.set("page_size", String(d.page_size));
  return await w.get(`${RPT_DRILLDOWN}${encodeURIComponent(contextId)}/transactions/?${qs.toString()}`);
}

export async function fetchReportCellSourcesUcRpt14(w: ApiWriter, contextId: string) {
  return await w.get(`${RPT_DRILLDOWN}${encodeURIComponent(contextId)}/sources/`);
}

export async function openReportSourceDocumentUcRpt14(w: ApiWriter, contextId: string, sourceId: string) {
  return await w.get(`${RPT_DRILLDOWN}${encodeURIComponent(contextId)}/sources/${encodeURIComponent(sourceId)}/open/`);
}

export async function fetchReportCellValidationUcRpt14(w: ApiWriter, contextId: string) {
  return await w.get(`${RPT_DRILLDOWN}${encodeURIComponent(contextId)}/validation/`);
}

export async function fetchReportCellBreadcrumbsUcRpt14(w: ApiWriter, contextId: string) {
  return await w.get(`${RPT_DRILLDOWN}${encodeURIComponent(contextId)}/breadcrumbs/`);
}

export async function drillThroughReportUcRpt14(w: ApiWriter, d: Row = {}) {
  return await w.post(`${RPT_DRILLDOWN}through/`, {
    company_id: d.company_id || w.companyId,
    ...d,
  });
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
