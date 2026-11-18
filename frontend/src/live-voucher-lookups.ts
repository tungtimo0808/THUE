import { useMemo } from "react";
import { useApiSession } from "./ApiSession";
import { apiDate, useMisaApiLists } from "./misa-api-lists";

export interface LiveEmployeeOption {
  id: string;
  code: string;
  name: string;
  person: string;
  dept: string;
  address: string;
  phone: string;
}

export interface LiveDebtItem {
  id: string;
  no: string;
  voucherNo: string;
  date: string;
  dueDate: string;
  desc: string;
  total: number;
  paid: number;
  remain: number;
  accountCode: string;
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  contactPerson: string;
  address: string;
  taxCode: string;
  payableId?: string;
  receivableId?: string;
}

const LOOKUP_RESOURCES: Record<string, string> = {
  parties: "/api/v1/master-data/parties/",
  customers: "/api/v1/master-data/customers/",
  items: "/api/v1/master-data/items/",
  units: "/api/v1/master-data/units-of-measure/",
  taxRates: "/api/v1/master-data/tax-rates/",
  employees: "/api/v1/organization/employees/",
  departments: "/api/v1/organization/departments/",
  branches: "/api/v1/organization/branches/",
  companyBankAccounts: "/api/v1/master-data/company-bank-accounts/",
  partyBankAccounts: "/api/v1/master-data/party-bank-accounts/",
  banks: "/api/v1/master-data/banks/",
  paymentTerms: "/api/v1/master-data/payment-terms/",
  accounts: "/api/v1/general-ledger/accounts/",
  payables: "/api/v1/accounts-payable/payables/",
  payableDocuments: "/api/v1/accounts-payable/documents/",
  supplierInvoices: "/api/v1/accounts-payable/invoices/",
  goodsPurchases: "/api/v1/purchases/goods-purchases/",
  servicePurchases: "/api/v1/purchases/service-purchases/",
  purchaseCosts: "/api/v1/purchases/purchase-costs/",
  receivables: "/api/v1/accounts-receivable/receivables/",
  goodsSales: "/api/v1/sales/goods-sales/",
  serviceSales: "/api/v1/sales/service-sales/",
  cashTransactions: "/api/v1/cash/transactions/",
  bankTransactions: "/api/v1/bank/transactions/",
};

const silentNotify = () => {};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function useLiveVoucherLookups(companyIdOverride?: string, enabled = true) {
  const { companyId: sessionCompanyId, token } = useApiSession();
  const targetCompanyId = enabled ? (companyIdOverride ?? sessionCompanyId) : "";
  const { rows, connected, reload } = useMisaApiLists(
    targetCompanyId,
    LOOKUP_RESOURCES,
    silentNotify,
  );

  const employees = useMemo<LiveEmployeeOption[]>(() => {
    const rawEmployees = rows.employees || [];
    const departments = rows.departments || [];
    const branches = rows.branches || [];
    return rawEmployees
      .filter((emp: any) => !emp.status || emp.status === "ACTIVE")
      .map((emp: any) => {
        const deptName =
          emp.department_name ||
          departments.find((d: any) => d.id === emp.department)?.name ||
          "";
        const branchName =
          emp.branch_name ||
          branches.find((b: any) => b.id === emp.branch)?.name ||
          "";
        const fullName = String(emp.full_name || emp.name || "").trim();
        return {
          id: String(emp.id || ""),
          code: String(emp.employee_code || emp.code || "").trim(),
          name: fullName,
          person: fullName,
          dept: String(deptName || branchName || "").trim(),
          address: String(emp.address || branchName || "").trim(),
          phone: String(emp.phone || emp.mobile_phone || "").trim(),
        };
      })
      .filter((emp) => Boolean(emp.code || emp.name));
  }, [rows.employees, rows.departments, rows.branches]);

  const companyBankAccounts = useMemo(() => {
    const rawAccounts = rows.companyBankAccounts || [];
    const banks = rows.banks || [];
    return rawAccounts
      .filter((acc: any) => !acc.status || acc.status === "ACTIVE")
      .map((acc: any) => {
        const bank = banks.find((b: any) => b.id === acc.bank);
        const bankLabel =
          acc.bank_name ||
          bank?.short_name ||
          bank?.name ||
          acc.account_name ||
          "Ngân hàng";
        const branchSuffix = acc.branch_name ? ` - ${acc.branch_name}` : "";
        return {
          id: String(acc.id || ""),
          account: String(acc.account_number || "").trim(),
          name: `${bankLabel}${branchSuffix}`,
          branchId: String(acc.branch || ""),
          currencyId: String(acc.currency || ""),
        };
      })
      .filter((acc) => Boolean(acc.account));
  }, [rows.companyBankAccounts, rows.banks]);

  const allParties = useMemo(() => {
    const combined = [...(rows.parties || []), ...(rows.customers || [])];
    const byId = new Map<string, any>();
    for (const p of combined) {
      if (p?.id && !byId.has(String(p.id))) {
        byId.set(String(p.id), p);
      }
    }
    return Array.from(byId.values());
  }, [rows.parties, rows.customers]);

  const partyBankAccountsFor = (partnerCode: string) => {
    const codeLower = String(partnerCode || "").trim().toLowerCase();
    if (!codeLower) return [];
    const party = allParties.find(
      (p: any) => String(p.code || "").trim().toLowerCase() === codeLower,
    );
    if (!party) return [];
    const banks = rows.banks || [];
    return (rows.partyBankAccounts || [])
      .filter((acc: any) => acc.party === party.id && (!acc.status || acc.status === "ACTIVE"))
      .map((acc: any) => {
        const bank = banks.find((b: any) => b.id === acc.bank);
        const bankName = bank?.short_name || bank?.name || acc.bank_name || "Ngân hàng";
        return {
          account: String(acc.account_number || "").trim(),
          name: acc.branch_name ? `${bankName} - ${acc.branch_name}` : bankName,
          bankOnlyName: bankName,
          branchName: String(acc.branch_name || ""),
        };
      })
      .filter((acc) => Boolean(acc.account));
  };

  const { supplierDebts, allSupplierDebtRecords } = useMemo(() => {
    const parties = allParties;
    const accounts = rows.accounts || [];
    const payables = rows.payables || [];
    const payableDocs = rows.payableDocuments || [];
    const supplierInvoices = rows.supplierInvoices || [];
    const goodsPurchases = rows.goodsPurchases || [];
    const servicePurchases = rows.servicePurchases || [];
    const purchaseCosts = rows.purchaseCosts || [];
    const paymentTxs = [
      ...(rows.cashTransactions || []),
      ...(rows.bankTransactions || []),
    ].filter(
      (tx: any) =>
        String(tx.transaction_type || "").toUpperCase() === "PAYMENT" &&
        !["CANCELLED", "REVERSED", "VOID"].includes(String(tx.status || "").toUpperCase()),
    );

    const coveredPurchaseIds = new Set<string>();
    const coveredCostIds = new Set<string>();
    const coveredDocNumbers = new Set<string>();
    const allRecords: LiveDebtItem[] = [];

    for (const debt of payables) {
      if (String(debt.status || "").toUpperCase() === "CANCELLED") continue;
      if (debt.goods_purchase) coveredPurchaseIds.add(String(debt.goods_purchase));
      if (debt.purchase_cost) coveredCostIds.add(String(debt.purchase_cost));

      const sourceDoc = payableDocs.find((r: any) => r.id === debt.document);
      const inv = supplierInvoices.find((r: any) => r.id === debt.invoice);
      const gp = goodsPurchases.find((r: any) => r.id === debt.goods_purchase);
      const pc = purchaseCosts.find((r: any) => r.id === debt.purchase_cost);
      const party = parties.find((p: any) => p.id === debt.supplier);

      const voucherNo = String(
        sourceDoc?.number || gp?.number || pc?.number || inv?.invoice_number || debt.id?.slice(0, 8) || "",
      ).trim();
      const invoiceNo = String(
        inv?.invoice_number ||
          gp?.invoice_details?.invoice_number ||
          voucherNo,
      ).trim();
      if (voucherNo) coveredDocNumbers.add(voucherNo.toLowerCase());
      if (invoiceNo) coveredDocNumbers.add(invoiceNo.toLowerCase());

      const total = toNum(debt.original_amount);
      const remain = Math.max(0, toNum(debt.balance));
      const paid = Math.max(0, total - remain);
      const accCode =
        accounts.find((a: any) => a.id === sourceDoc?.payable_account)?.code || "331";

      allRecords.push({
        id: String(debt.id),
        no: invoiceNo || voucherNo,
        voucherNo: voucherNo || invoiceNo,
        date: apiDate(
          inv?.invoice_date ||
            sourceDoc?.document_date ||
            gp?.document_date ||
            pc?.document_date ||
            debt.created_at,
        ),
        dueDate: apiDate(debt.due_date || gp?.payment_due_date),
        desc: String(
          sourceDoc?.description ||
            inv?.notes ||
            gp?.notes ||
            pc?.notes ||
            `Mua hàng của ${party?.name || ""}`,
        ).trim(),
        total,
        paid,
        remain,
        accountCode: String(accCode),
        partnerId: String(party?.id || debt.supplier || ""),
        partnerCode: String(party?.code || sourceDoc?.supplier_code || "").trim(),
        partnerName: String(party?.name || sourceDoc?.supplier_name || "").trim(),
        contactPerson: String(
          gp?.contact_person || party?.representative || party?.name || "",
        ).trim(),
        address: String(
          gp?.supplier_address ||
            party?.address ||
            party?.addresses?.[0]?.address_line ||
            "",
        ).trim(),
        taxCode: String(party?.tax_code || "").trim(),
        payableId: String(debt.id),
      });
    }

    const creditPurchases = [
      ...goodsPurchases.filter((gp: any) => !coveredPurchaseIds.has(String(gp.id))),
      ...servicePurchases.filter((sp: any) => !coveredPurchaseIds.has(String(sp.id))),
      ...purchaseCosts.filter((pc: any) => !coveredCostIds.has(String(pc.id))),
    ];

    for (const doc of creditPurchases) {
      const statusUpper = String(doc.status || "").toUpperCase();
      if (statusUpper !== "POSTED") continue;
      const payType = String(doc.payment_type || "").toUpperCase();
      if (payType === "IMMEDIATE" || payType === "PAID" || Boolean(doc.payment)) continue;

      const voucherNo = String(doc.number || "").trim();
      if (voucherNo && coveredDocNumbers.has(voucherNo.toLowerCase())) continue;

      const total = toNum(doc.total_amount);
      if (total <= 0) continue;

      const invoiceNo = String(
        doc.invoice_details?.invoice_number || doc.invoice_number || voucherNo,
      ).trim();
      const needleVoucher = voucherNo.toLowerCase();
      const needleInvoice = invoiceNo.toLowerCase();

      const matchedPaid = paymentTxs.reduce((sum: number, tx: any) => {
        const descLower = String(tx.description || "").toLowerCase();
        const hitVoucher = needleVoucher.length >= 4 && descLower.includes(needleVoucher);
        const hitInvoice =
          needleInvoice.length >= 4 &&
          needleInvoice !== needleVoucher &&
          descLower.includes(needleInvoice);
        return hitVoucher || hitInvoice ? sum + toNum(tx.amount) : sum;
      }, 0);

      const paid = Math.min(total, matchedPaid);
      const remain = Math.max(0, total - paid);
      const party = parties.find((p: any) => p.id === doc.supplier);

      allRecords.push({
        id: `purchase:${doc.id}`,
        no: invoiceNo || voucherNo,
        voucherNo: voucherNo || invoiceNo,
        date: apiDate(doc.document_date || doc.posting_date),
        dueDate: apiDate(doc.payment_due_date || doc.due_date),
        desc: String(
          doc.notes || doc.description || `Mua hàng theo chứng từ ${voucherNo}`,
        ).trim(),
        total,
        paid,
        remain,
        accountCode: "331",
        partnerId: String(party?.id || doc.supplier || ""),
        partnerCode: String(party?.code || doc.supplier_code || "").trim(),
        partnerName: String(party?.name || doc.supplier_name || "").trim(),
        contactPerson: String(
          doc.contact_person || party?.representative || party?.name || "",
        ).trim(),
        address: String(
          doc.supplier_address ||
            party?.address ||
            party?.addresses?.[0]?.address_line ||
            "",
        ).trim(),
        taxCode: String(party?.tax_code || "").trim(),
      });
    }

    return {
      supplierDebts: allRecords.filter((item) => item.remain > 0),
      allSupplierDebtRecords: allRecords,
    };
  }, [
    allParties,
    rows.accounts,
    rows.payables,
    rows.payableDocuments,
    rows.supplierInvoices,
    rows.goodsPurchases,
    rows.servicePurchases,
    rows.purchaseCosts,
    rows.cashTransactions,
    rows.bankTransactions,
  ]);

  const { customerDebts, allCustomerDebtRecords } = useMemo(() => {
    const parties = allParties;
    const receivables = rows.receivables || [];
    const goodsSales = rows.goodsSales || [];
    const serviceSales = rows.serviceSales || [];
    const receiptTxs = [
      ...(rows.cashTransactions || []),
      ...(rows.bankTransactions || []),
    ].filter(
      (tx: any) =>
        String(tx.transaction_type || "").toUpperCase() === "RECEIPT" &&
        !["CANCELLED", "REVERSED", "VOID"].includes(String(tx.status || "").toUpperCase()),
    );

    const coveredSaleIds = new Set<string>();
    const coveredDocNumbers = new Set<string>();
    const allRecords: LiveDebtItem[] = [];

    for (const debt of receivables) {
      if (String(debt.status || "").toUpperCase() === "CANCELLED") continue;
      if (debt.source_document_id) coveredSaleIds.add(String(debt.source_document_id));
      const voucherNo = String(debt.source_document_number || debt.code || "").trim();
      if (voucherNo) coveredDocNumbers.add(voucherNo.toLowerCase());

      const party = parties.find((p: any) => p.id === debt.customer);
      const total = toNum(debt.original_amount);
      const remain = Math.max(0, toNum(debt.balance));
      const paid = Math.max(0, total - remain);

      allRecords.push({
        id: String(debt.id),
        no: voucherNo || String(debt.id).slice(0, 8).toUpperCase(),
        voucherNo: voucherNo || String(debt.id).slice(0, 8).toUpperCase(),
        date: apiDate(debt.document_date || debt.posting_date || debt.created_at),
        dueDate: apiDate(debt.due_date),
        desc: String(
          debt.description || `Công nợ bán hàng ${voucherNo}`,
        ).trim(),
        total,
        paid,
        remain,
        accountCode: String(debt.account_code || "131"),
        partnerId: String(party?.id || debt.customer || ""),
        partnerCode: String(party?.code || debt.customer_code || "").trim(),
        partnerName: String(party?.name || debt.customer_name || "").trim(),
        contactPerson: String(party?.representative || party?.name || "").trim(),
        address: String(
          party?.address || party?.addresses?.[0]?.address_line || "",
        ).trim(),
        taxCode: String(party?.tax_code || "").trim(),
        receivableId: String(debt.id),
      });
    }

    const creditSales = [
      ...goodsSales.filter(
        (gs: any) => !gs.receivable && !coveredSaleIds.has(String(gs.id)),
      ),
      ...serviceSales.filter(
        (ss: any) => !ss.receivable && !coveredSaleIds.has(String(ss.id)),
      ),
    ];

    for (const doc of creditSales) {
      const statusUpper = String(doc.status || "").toUpperCase();
      if (statusUpper !== "POSTED") continue;
      const payType = String(doc.payment_type || "").toUpperCase();
      if (payType === "IMMEDIATE" || payType === "PAID") continue;

      const voucherNo = String(doc.number || "").trim();
      if (voucherNo && coveredDocNumbers.has(voucherNo.toLowerCase())) continue;

      const total = toNum(doc.total_amount);
      if (total <= 0) continue;

      const needle = voucherNo.toLowerCase();
      const matchedCollected = receiptTxs.reduce((sum: number, tx: any) => {
        const descLower = String(tx.description || "").toLowerCase();
        return needle.length >= 4 && descLower.includes(needle)
          ? sum + toNum(tx.amount)
          : sum;
      }, 0);

      const paid = Math.min(total, matchedCollected);
      const remain = Math.max(0, total - paid);
      const party = parties.find((p: any) => p.id === doc.customer);

      allRecords.push({
        id: `sale:${doc.id}`,
        no: voucherNo,
        voucherNo,
        date: apiDate(doc.document_date || doc.posting_date),
        dueDate: apiDate(doc.due_date),
        desc: String(
          doc.description || doc.notes || `Bán hàng theo chứng từ ${voucherNo}`,
        ).trim(),
        total,
        paid,
        remain,
        accountCode: "131",
        partnerId: String(party?.id || doc.customer || ""),
        partnerCode: String(party?.code || doc.customer_code || "").trim(),
        partnerName: String(party?.name || doc.customer_name || "").trim(),
        contactPerson: String(party?.representative || party?.name || "").trim(),
        address: String(
          doc.customer_address ||
            party?.address ||
            party?.addresses?.[0]?.address_line ||
            "",
        ).trim(),
        taxCode: String(doc.customer_tax_code || party?.tax_code || "").trim(),
      });
    }

    return {
      customerDebts: allRecords.filter((item) => item.remain > 0),
      allCustomerDebtRecords: allRecords,
    };
  }, [
    allParties,
    rows.receivables,
    rows.goodsSales,
    rows.serviceSales,
    rows.cashTransactions,
    rows.bankTransactions,
  ]);

  const supplierDebtSummary = (partnerCode?: string) => {
    const codeLower = String(partnerCode || "").trim().toLowerCase();
    const scoped = codeLower
      ? allSupplierDebtRecords.filter(
          (r) => r.partnerCode.toLowerCase() === codeLower,
        )
      : allSupplierDebtRecords;
    const totalInvoiced = scoped.reduce((s, r) => s + r.total, 0);
    const totalPaid = scoped.reduce((s, r) => s + r.paid, 0);
    const currentBalance = scoped.reduce((s, r) => s + r.remain, 0);
    return {
      totalInvoiced,
      totalPaid,
      currentBalance,
      count: scoped.filter((r) => r.remain > 0).length,
    };
  };

  const customerDebtSummary = (partnerCode?: string) => {
    const codeLower = String(partnerCode || "").trim().toLowerCase();
    const party = codeLower
      ? allParties.find(
          (p: any) => String(p.code || "").trim().toLowerCase() === codeLower,
        )
      : undefined;
    const term = party?.default_payment_term
      ? (rows.paymentTerms || []).find((t: any) => t.id === party.default_payment_term)
      : (rows.paymentTerms || []).find((t: any) => t.default_sale);
    const scoped = codeLower
      ? allCustomerDebtRecords.filter(
          (r) => r.partnerCode.toLowerCase() === codeLower,
        )
      : allCustomerDebtRecords;
    const totalInvoiced = scoped.reduce((s, r) => s + r.total, 0);
    const totalCollected = scoped.reduce((s, r) => s + r.paid, 0);
    const currentBalance = scoped.reduce((s, r) => s + r.remain, 0);
    return {
      totalInvoiced,
      totalCollected,
      currentBalance,
      creditLimit: toNum(party?.credit_limit || 0),
      dueDays: toNum(term?.net_days ?? party?.max_debt_days ?? 30),
      count: scoped.filter((r) => r.remain > 0).length,
    };
  };

  const saleCustomers = useMemo(() => {
    return allParties
      .filter((p: any) => !p.status || p.status === "ACTIVE")
      .map((p: any) => ({
        id: String(p.id || ""),
        code: String(p.code || "").trim(),
        name: String(p.name || "").trim(),
        taxCode: String(p.tax_code || "").trim(),
        address: String(
          p.address ||
            (p.addresses?.find((a: any) => a.is_default) || p.addresses?.[0])?.address_line ||
            "",
        ).trim(),
        contact: String(
          p.representative ||
            (p.contacts?.find((c: any) => c.is_default) || p.contacts?.[0])?.full_name ||
            p.name ||
            "",
        ).trim(),
        phone: String(
          p.phone ||
            (p.contacts?.find((c: any) => c.is_default) || p.contacts?.[0])?.phone ||
            "",
        ).trim(),
        type: p.party_type === "INDIVIDUAL" ? "Cá nhân" : "Tổ chức",
      }))
      .filter((c) => Boolean(c.code));
  }, [allParties]);

  const suppliers = useMemo(() => {
    const payables = rows.payables || [];
    return allParties
      .filter((p: any) => !p.status || p.status === "ACTIVE")
      .map((p: any) => ({
        id: String(p.id || ""),
        code: String(p.code || "").trim(),
        name: String(p.name || "").trim(),
        taxCode: String(p.tax_code || "").trim(),
        address: String(
          p.address ||
            (p.addresses?.find((a: any) => a.is_default) || p.addresses?.[0])?.address_line ||
            "",
        ).trim(),
        contact: String(
          p.representative ||
            (p.contacts?.find((c: any) => c.is_default) || p.contacts?.[0])?.full_name ||
            p.name ||
            "",
        ).trim(),
        phone: String(
          p.phone ||
            (p.contacts?.find((c: any) => c.is_default) || p.contacts?.[0])?.phone ||
            "",
        ).trim(),
        debtAmount: payables
          .filter((d: any) => d.supplier === p.id)
          .reduce((sum: number, d: any) => sum + toNum(d.balance), 0),
        invoiceRisk: "",
        refDoc: "",
        isInternal: false,
        isBranch: false,
        partnerType: "org" as const,
        isCustomer: false,
      }))
      .filter((s) => Boolean(s.code));
  }, [allParties, rows.payables]);

  const catalogItems = useMemo(() => {
    const rawItems = rows.items || [];
    const units = rows.units || [];
    const taxRates = rows.taxRates || [];
    const accounts = rows.accounts || [];
    return rawItems
      .filter((it: any) => !it.status || it.status === "ACTIVE")
      .map((it: any) => {
        const uom = units.find((u: any) => u.id === it.base_uom);
        const tax = taxRates.find((t: any) => t.id === it.default_tax_rate || t.id === it.tax_rate);
        const invAcc = accounts.find((a: any) => a.id === it.inventory_account);
        const expAcc = accounts.find((a: any) => a.id === it.expense_account || a.id === it.cogs_account);
        const revAcc = accounts.find((a: any) => a.id === it.revenue_account);
        const salePrice = toNum(it.default_sales_price ?? it.sales_price ?? it.standard_cost ?? 0);
        const purchasePrice = toNum(it.default_purchase_price ?? it.purchase_price ?? it.standard_cost ?? salePrice);
        return {
          id: String(it.id || ""),
          code: String(it.code || "").trim(),
          name: String(it.name || "").trim(),
          unit: String(uom?.name || uom?.code || it.uom_name || "Cái").trim(),
          price: salePrice,
          purchasePrice,
          vat: tax?.rate_percent != null ? toNum(tax.rate_percent) : 10,
          stock: 100,
          warehouse: "KHO_CHINH",
          stockAccount: String(invAcc?.code || "1561"),
          expenseAccount: String(expAcc?.code || "632"),
          revenueAccount: String(revAcc?.code || "5111"),
        };
      })
      .filter((it) => Boolean(it.code));
  }, [rows.items, rows.units, rows.taxRates, rows.accounts]);

  const partyBankAccounts = useMemo(() => {
    const banks = rows.banks || [];
    return (rows.partyBankAccounts || [])
      .filter((acc: any) => !acc.status || acc.status === "ACTIVE")
      .map((acc: any) => {
        const bank = banks.find((b: any) => b.id === acc.bank);
        const party = allParties.find((p: any) => p.id === acc.party);
        const bankName = bank?.short_name || bank?.name || acc.bank_name || "Ngân hàng";
        return {
          account: String(acc.account_number || "").trim(),
          name: party?.name ? `${bankName} - ${party.name}` : bankName,
          partnerCode: String(party?.code || "").trim(),
          partnerName: String(party?.name || "").trim(),
          branchName: String(acc.branch_name || ""),
        };
      })
      .filter((acc) => Boolean(acc.account));
  }, [rows.partyBankAccounts, rows.banks, allParties]);

  return {
    connected: Boolean(token && connected),
    employees,
    allParties,
    saleCustomers,
    suppliers,
    catalogItems,
    companyBankAccounts,
    partyBankAccounts,
    partyBankAccountsFor,
    supplierDebts,
    customerDebts,
    supplierDebtSummary,
    customerDebtSummary,
    reload,
  };
}
