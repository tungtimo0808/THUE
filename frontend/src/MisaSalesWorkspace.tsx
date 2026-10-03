import { useState } from "react";
import {
  Search,
  RefreshCw,
  Plus,
  Package,
  CreditCard,
  SlidersHorizontal,
  ChevronDown,
  UserRound,
  ShieldCheck,
  Lightbulb,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronUp,
  Maximize2,
  Copy,
  Settings,
  Filter,
  MoreHorizontal,
  FileSpreadsheet,
  Ban,
} from "lucide-react";
import {
  SingleCustomerInvoiceCollectionModal,
  MultiCustomerInvoiceCollectionModal,
} from "./MisaInvoiceCollectionModals";
import { AIAssistantModal } from "./MisaCashWorkspace";
import { formatVND } from "./MisaPurchaseModals";
import { SaleQuoteModal, SaleOrderModal, SaleContractModal, SAMPLE_SALE_ITEMS } from "./MisaSalesModals";
import {
  SaleInvoiceModal,
  SaleReturnModal,
  SaleDiscountModal,
  SaleInvoiceDiscountModal,
  SaleCommercialInvoiceModal,
  SaleInvoiceAdjustmentModal,
} from "./MisaSalesInvoicingModals";
import { SaleVoucherModal } from "./MisaSalesVoucherModal";
import { MisaCustomerModal } from "./MisaCustomerModal";
import { MisaItemNatureDrawer } from "./MisaItemNatureDrawer";
import "./misa-cash.css";

type MisaSalesWorkspaceProps = {
  company?: { id: string; name: string };
  period?: string;
  tab?: string;
  href?: (path: string) => string;
  notify: (msg: string) => void;
};

export default function MisaSalesWorkspace({
  company: _company = { id: "minh-an", name: "Công ty Cổ phần Minh An" },
  period: _period = "2026-09",
  tab = "process",
  href,
  notify,
}: MisaSalesWorkspaceProps) {
  // Modal states
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showMultiCollectionModal, setShowMultiCollectionModal] = useState(false);
  const [isServiceSale, setIsServiceSale] = useState(false);
  const [isReplacementInvoiceMode, setIsReplacementInvoiceMode] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentTermsModal, setShowPaymentTermsModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showInvoiceDiscountModal, setShowInvoiceDiscountModal] = useState(false);
  const [showCommercialInvoiceModal, setShowCommercialInvoiceModal] = useState(false);
  const [showInvoiceAdjustmentModal, setShowInvoiceAdjustmentModal] = useState(false);
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
  const [invoiceViewMode, setInvoiceViewMode] = useState<"landing" | "list">("landing");

  // Quote view mode & selection
  const [quoteViewMode, setQuoteViewMode] = useState<"landing" | "list">("landing");
  const [selectedQuote, setSelectedQuote] = useState<any>(null);

  // Order view mode & selection
  const [orderViewMode, setOrderViewMode] = useState<"landing" | "list">("landing");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Contract view mode & selection
  const [contractViewMode, setContractViewMode] = useState<"landing" | "list">("landing");
  const [selectedContract, setSelectedContract] = useState<any>(null);

  // Sales Voucher view mode & selection
  const [salesViewMode, setSalesViewMode] = useState<"landing" | "list">("landing");
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [activeSaleType, setActiveSaleType] = useState<number>(1);
  const [showVoucherDropdown, setShowVoucherDropdown] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");

  // Inventory Items (Hàng hóa, dịch vụ) states
  const [showNatureDrawer, setShowNatureDrawer] = useState(false);
  const [statCardsCollapsed, setStatCardsCollapsed] = useState(false);
  const [inventorySearchQuery, setInventorySearchQuery] = useState("");
  const [selectedInventoryItems, setSelectedInventoryItems] = useState<string[]>([]);
  const [inventoryItemsList, setInventoryItemsList] = useState([
    {
      id: "cpmh",
      name: "Chi phí mua hàng",
      code: "CPMH",
      taxReduction: "Chưa xác định",
      nature: "Dịch vụ",
      stockQuantity: 0.0,
      stockValue: 0,
    },
  ]);

  // Sample data: Báo giá
  const [quotes, setQuotes] = useState([
    {
      id: "bg-01",
      code: "BG00001",
      date: "29/09/2026",
      expiryDate: "15/10/2026",
      customer: "Công ty TNHH Cơ điện & Tự động hóa Thiên An",
      amount: 45000000,
      status: "Đã gửi khách",
      description: "Báo giá thiết bị đóng cắt và tủ điện hạ thế",
    },
    {
      id: "bg-02",
      code: "BG00002",
      date: "28/09/2026",
      expiryDate: "10/10/2026",
      customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
      amount: 128000000,
      status: "Khách đã duyệt",
      description: "Báo giá vật tư cáp điện và phụ kiện công trình",
    },
  ]);

  // Sample data: Đơn đặt hàng
  const [orders, setOrders] = useState([
    {
      id: "so-01",
      code: "ĐH00001",
      date: "29/09/2026",
      deliveryDate: "05/10/2026",
      customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
      amount: 128000000,
      status: "Đang thực hiện",
      description: "Cung cấp cáp ngầm trung thế 24kV Cu/XLPE",
    },
    {
      id: "so-02",
      code: "ĐH00002",
      date: "26/09/2026",
      deliveryDate: "02/10/2026",
      customer: "Công ty TNHH Phát triển Công nghệ Việt Hưng",
      amount: 32500000,
      status: "Chưa thực hiện",
      description: "Đơn đặt hàng thiết bị mạng và cảm biến công nghiệp",
    },
  ]);

  // Sample data: Hợp đồng bán hàng
  const [contracts, setContracts] = useState([
    {
      id: "hdb-01",
      code: "HĐB00001",
      date: "20/09/2026",
      customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
      customerCode: "KH001",
      address: "Tòa nhà PVN, 18 Láng Hạ, Ba Đình, Hà Nội",
      contact: "Nguyễn Văn Hùng",
      amount: 350000000,
      status: "Đang thực hiện",
      deliveryStatus: "Giao một phần",
      deliveryDate: "30/10/2026",
      paymentDueDate: "15/11/2026",
      project: "Dự án Tòa nhà EVN Hapro",
      summary: "Hợp đồng cung cấp cáp ngầm trung thế và thiết bị trạm biến áp",
    },
    {
      id: "hdb-02",
      code: "HĐB00002",
      date: "25/09/2026",
      customer: "Công ty TNHH Cơ điện & Tự động hóa Thiên An",
      customerCode: "KH002",
      address: "Số 45 Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
      contact: "Trần Minh Đức",
      amount: 125000000,
      status: "Chưa thực hiện",
      deliveryStatus: "Chưa giao",
      deliveryDate: "10/11/2026",
      paymentDueDate: "25/11/2026",
      project: "Dự án Khu đô thị Nam An Khánh",
      summary: "Hợp đồng cung cấp tủ điện điều khiển PLC",
    },
  ]);

  // Sample data: Bán hàng (Chứng từ bán hàng / Ghi nhận doanh thu)
  const [salesVouchers, setSalesVouchers] = useState([
    {
      id: "bh-01",
      code: "BH00001",
      saleType: 1,
      date: "29/09/2026",
      customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
      customerCode: "KH001",
      taxCode: "0102345678",
      address: "Tòa nhà PVN, 18 Láng Hạ, Ba Đình, Hà Nội",
      contact: "Nguyễn Văn Hùng",
      amount: 64000000,
      totalPayment: 70400000,
      status: "Chưa thanh toán",
      hasInvoice: true,
      hasDeliveryNote: true,
      description: "Bán hàng theo đơn hàng ĐH00001 đợt 1",
      items: [
        {
          id: "bh-item-1",
          code: "VT001",
          name: "Cáp ngầm trung thế 24kV Cu/XLPE/PVC/DSTA",
          unit: "Mét",
          quantity: 200,
          tradeDiscount: false,
          debitAccount: "131",
          creditAccount: "5111",
          unitPrice: 285000,
          amount: 57000000,
          vatRate: 10,
          vatAmount: 5700000,
        },
      ],
    },
    {
      id: "bh-02",
      code: "BH00002",
      saleType: 1,
      date: "25/09/2026",
      customer: "Công ty TNHH Cơ điện & Tự động hóa Thiên An",
      customerCode: "KH002",
      taxCode: "0108765432",
      address: "Số 45 Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
      contact: "Trần Minh Đức",
      amount: 45000000,
      totalPayment: 49500000,
      status: "Đã thanh toán",
      hasInvoice: true,
      hasDeliveryNote: true,
      description: "Bán hàng thiết bị đóng cắt hạ thế Schneider",
      items: [
        {
          id: "bh-item-2",
          code: "VT002",
          name: "Tủ điện phân phối tổng MSB 630A Schneider",
          unit: "Bộ",
          quantity: 1,
          tradeDiscount: false,
          debitAccount: "131",
          creditAccount: "5111",
          unitPrice: 45000000,
          amount: 45000000,
          vatRate: 10,
          vatAmount: 4500000,
        },
      ],
    },
    {
      id: "bh-03",
      code: "BH00003",
      saleType: 2,
      date: "22/09/2026",
      customer: "Alpha Power Solutions Pte Ltd (Singapore)",
      customerCode: "KH003",
      taxCode: "201829381M",
      address: "80 Robinson Road, Singapore",
      contact: "Mr. David Lee",
      amount: 185000000,
      totalPayment: 185000000,
      status: "Chưa thanh toán",
      hasInvoice: true,
      hasDeliveryNote: true,
      description: "Xuất khẩu lô thiết bị tủ điều khiển trạm hạ thế",
      items: [
        {
          id: "bh-item-3",
          code: "VT002",
          name: "Tủ điện phân phối tổng MSB 630A Schneider",
          unit: "Bộ",
          quantity: 3,
          tradeDiscount: false,
          debitAccount: "131",
          creditAccount: "5111",
          unitPrice: 45000000,
          amount: 135000000,
          vatRate: "",
          vatAmount: 0,
          exportTaxBase: 135000000,
          exportTaxRate: 0,
          exportTaxAmount: 0,
        },
      ],
    },
  ]);

  // Sample data: Khách hàng
  const [customers, setCustomers] = useState([
    {
      id: "kh-01",
      code: "KH001",
      name: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
      taxCode: "0102345678",
      address: "Tòa nhà PVN, 18 Láng Hạ, Ba Đình, Hà Nội",
      phone: "0243.856.7890",
      debt: 64000000,
    },
    {
      id: "kh-02",
      code: "KH002",
      name: "Công ty TNHH Cơ điện & Tự động hóa Thiên An",
      taxCode: "0108765432",
      address: "Số 45 Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
      phone: "0243.987.6543",
      debt: 0,
    },
  ]);

  // Sample data: Hóa đơn bán hàng (Matching Screenshot 2)
  const [invoices, setInvoices] = useState([
    {
      id: "inv-01",
      code: "0000001",
      series: "1C26TAA",
      template: "1/001",
      date: "30/09/2026",
      customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
      taxCode: "0102345678",
      amount: 28500000,
      vat: 2850000,
      total: 31350000,
      status: "Chưa phát hành",
      type: "Hóa đơn bán hàng hóa, dịch vụ trong nước",
    },
    {
      id: "inv-02",
      code: "0000002",
      series: "1C26TAA",
      template: "1/001",
      date: "28/09/2026",
      customer: "Công ty TNHH Cơ điện & Tự động hóa Thiên An",
      taxCode: "0108765432",
      amount: 45000000,
      vat: 4500000,
      total: 49500000,
      status: "Đã phát hành",
      type: "Hóa đơn bán hàng hóa, dịch vụ trong nước",
    },
  ]);

  // Sample data: Trả lại hàng bán (BTL00001)
  const [returns, setReturns] = useState([
    {
      id: "ret-01",
      code: "BTL00001",
      stockCode: "PN00001",
      date: "30/09/2026",
      customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
      amount: 5700000,
      vat: 570000,
      total: 6270000,
      type: "Bán hàng hóa dịch vụ",
      reason: "Trả lại hàng bán - BTL00001",
      status: "Giảm trừ công nợ",
    },
  ]);

  // Sample data: Giảm giá hàng bán (BGG00001)
  const [discounts, setDiscounts] = useState([
    {
      id: "disc-01",
      code: "BGG00001",
      date: "30/09/2026",
      customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
      amount: 750000,
      vat: 75000,
      total: 825000,
      type: "Bán hàng hóa dịch vụ",
      reason: "Giảm giá hàng bán - BGG00001",
      status: "Giảm trừ công nợ",
    },
  ]);

  const handleSaveInvoice = (data: any) => {
    setInvoices([
      {
        id: `inv-${Date.now()}`,
        code: data.invoiceNo,
        series: data.invoiceSeries,
        template: data.invoiceTemplate,
        date: data.invoiceDate,
        customer: data.customerName,
        taxCode: data.taxCode,
        amount: data.totalGoods,
        vat: data.totalTax,
        total: data.totalGrand,
        status: data.andPrint ? "Đã phát hành" : "Chưa phát hành",
        type: data.invoiceFormType,
      },
      ...invoices,
    ]);
    notify(`Đã lưu Hóa đơn bán hàng ${data.invoiceNo}!`);
  };

  const handleSaveDiscountInvoice = (data: any) => {
    setInvoices([
      {
        id: `inv-${Date.now()}`,
        code: data.invoiceNo || `HDCK${invoices.length + 1}`,
        series: data.invoiceSeries || "1C26TAA",
        template: data.invoiceTemplate || "1/001",
        date: data.invoiceDate || "30/09/2026",
        customer: data.customerName || "Khách hàng chiết khấu",
        taxCode: data.taxCode || "",
        amount: data.totalGoods || 0,
        vat: data.totalVat || 0,
        total: data.grandTotal || 0,
        status: data.publish ? "Đã phát hành" : "Chưa phát hành",
        type: "Hóa đơn chiết khấu",
      },
      ...invoices,
    ]);
    notify(`Đã lưu Hóa đơn chiết khấu ${data.invoiceNo || ""}!`);
  };

  const handleSaveCommercialInvoice = (data: any) => {
    setInvoices([
      {
        id: `inv-${Date.now()}`,
        code: data.invoiceNo || `HDTM${invoices.length + 1}`,
        series: data.invoiceSeries || "1C26TAA",
        template: data.invoiceTemplate || "1/001",
        date: data.invoiceDate || "30/09/2026",
        customer: data.customerName || "Khách hàng thương mại",
        taxCode: data.taxCode || "",
        amount: data.totalAmount || 0,
        vat: 0,
        total: data.totalAmount || 0,
        status: "Chưa phát hành",
        type: "Hóa đơn thương mại",
      },
      ...invoices,
    ]);
    notify(`Đã lưu Hóa đơn thương mại ${data.invoiceNo || ""}!`);
  };

  const handleSaveAdjustmentInvoice = (data: any) => {
    setInvoices([
      {
        id: `inv-${Date.now()}`,
        code: data.invoiceNo || `HDDC${invoices.length + 1}`,
        series: data.invoiceSeries || "1C26TAA",
        template: data.invoiceTemplate || "1/001",
        date: data.invoiceDate || "30/09/2026",
        customer: data.customerName || "Khách hàng điều chỉnh",
        taxCode: data.taxCode || "",
        amount: data.totalGoods || 0,
        vat: data.totalVat || 0,
        total: data.grandTotal || 0,
        status: data.publish ? "Đã phát hành" : "Chưa phát hành",
        type: "Hóa đơn điều chỉnh",
      },
      ...invoices,
    ]);
    notify(`Đã lưu Hóa đơn điều chỉnh ${data.invoiceNo || ""}!`);
  };

  const handleSaveReturn = (data: any) => {
    setReturns([
      {
        id: `ret-${Date.now()}`,
        code: data.voucherCode,
        stockCode: data.stockVoucherCode,
        date: data.docDate,
        customer: data.customerName,
        amount: data.totalGoods,
        vat: data.totalTax,
        total: data.totalGrand,
        type: data.returnFormType,
        reason: data.reason,
        status: data.paymentTreatment === "debt" ? "Giảm trừ công nợ" : data.paymentTreatment === "cash" ? "Trả tiền mặt" : "Trả tiền gửi",
      },
      ...returns,
    ]);
    notify(`Đã lập Chứng từ bán hàng bị trả lại ${data.voucherCode}!`);
  };

  const handleSaveDiscount = (data: any) => {
    setDiscounts([
      {
        id: `disc-${Date.now()}`,
        code: data.voucherCode,
        date: data.docDate,
        customer: data.customerName,
        amount: data.totalDiscount,
        vat: data.totalTax,
        total: data.totalGrand,
        type: data.discountFormType,
        reason: data.reason,
        status: data.paymentTreatment === "debt" ? "Giảm trừ công nợ" : data.paymentTreatment === "cash" ? "Trả tiền mặt" : "Trả tiền gửi",
      },
      ...discounts,
    ]);
    notify(`Đã lập Chứng từ giảm giá hàng bán ${data.voucherCode}!`);
  };

  // Biểu đồ dashboard state
  const [currencyUnit, setCurrencyUnit] = useState("Đồng");
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [chartRefreshTime, setChartRefreshTime] = useState("11:32");
  const [chartPeriods] = useState<Record<string, string>>({
    orders: "Tháng này",
    contracts: "Tháng này",
    sales: "Tháng này",
    receivables: "Tháng này",
    revenue: "Tháng này",
  });

  const handleRefreshChart = () => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setChartRefreshTime(timeStr);
    notify(`Đã cập nhật số liệu biểu đồ bán hàng tính đến ${timeStr}.`);
  };

  const navigateTo = (targetTab: string) => {
    if (href) {
      window.location.href = href(`/sales/${targetTab}`);
    }
  };

  // Render Modals Helper
  const renderModals = () => (
    <>
      {showCollectionModal && (
        <SingleCustomerInvoiceCollectionModal
          onClose={() => setShowCollectionModal(false)}
          onSubmit={(_payload) => {
            setShowCollectionModal(false);
            notify("Đã lập chứng từ thu tiền khách hàng theo hóa đơn thành công!");
          }}
        />
      )}

      {showMultiCollectionModal && (
        <MultiCustomerInvoiceCollectionModal
          onClose={() => setShowMultiCollectionModal(false)}
          onSubmit={(_payload) => {
            setShowMultiCollectionModal(false);
            notify("Đã lập chứng từ thu tiền theo hóa đơn nhiều khách hàng thành công!");
          }}
        />
      )}

      {showAIModal && (
        <AIAssistantModal
          onClose={() => setShowAIModal(false)}
          onApply={(doc) => {
            setShowAIModal(false);
            notify(`AVA Kế toán đã phân tích nghiệp vụ bán hàng ${doc.code}.`);
          }}
        />
      )}

      {/* Modal: Hóa đơn bán hàng hóa, dịch vụ trong nước (Screenshot 2) */}
      {showInvoiceModal && (
        <SaleInvoiceModal
          initialIsReplacement={isReplacementInvoiceMode}
          onClose={() => {
            setShowInvoiceModal(false);
            setIsReplacementInvoiceMode(false);
          }}
          onSubmit={(data) => {
            handleSaveInvoice(data);
            setIsReplacementInvoiceMode(false);
          }}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
        />
      )}

      {/* Modal: Hóa đơn chiết khấu (Screenshot 1) */}
      {showInvoiceDiscountModal && (
        <SaleInvoiceDiscountModal
          onClose={() => setShowInvoiceDiscountModal(false)}
          onSubmit={handleSaveDiscountInvoice}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
        />
      )}

      {/* Modal: Hóa đơn thương mại (Screenshot 2) */}
      {showCommercialInvoiceModal && (
        <SaleCommercialInvoiceModal
          onClose={() => setShowCommercialInvoiceModal(false)}
          onSubmit={handleSaveCommercialInvoice}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
        />
      )}

      {/* Modal: Hóa đơn điều chỉnh (Screenshot 3) */}
      {showInvoiceAdjustmentModal && (
        <SaleInvoiceAdjustmentModal
          onClose={() => setShowInvoiceAdjustmentModal(false)}
          onSubmit={handleSaveAdjustmentInvoice}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
        />
      )}

      {/* Modal: Chứng từ bán hàng bị trả lại BTL00001 (3 biểu mẫu) */}
      {showReturnModal && (
        <SaleReturnModal
          onClose={() => setShowReturnModal(false)}
          onSubmit={handleSaveReturn}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
        />
      )}

      {/* Modal: Chứng từ giảm giá hàng bán BGG00001 (3 biểu mẫu) */}
      {showDiscountModal && (
        <SaleDiscountModal
          onClose={() => setShowDiscountModal(false)}
          onSubmit={handleSaveDiscount}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
        />
      )}

      {/* Modal: Khách hàng (Chuẩn MISA AMIS cho cả Tổ chức và Cá nhân) */}
      <MisaCustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        defaultCode={`KH${String(customers.length + 1).padStart(5, "0")}`}
        onSave={(newCust, andAddNew) => {
          setCustomers(prev => [...prev, newCust]);
          if (!andAddNew) {
            setShowCustomerModal(false);
          }
        }}
        notify={notify}
      />

      {/* Modal: Báo giá (Full modal form matching Screenshot 1) */}
      {showQuoteModal && (
        <SaleQuoteModal
          initialCode={selectedQuote?.code || `BG0000${quotes.length + 1}`}
          initialData={selectedQuote}
          onClose={() => {
            setShowQuoteModal(false);
            setSelectedQuote(null);
          }}
          onSubmit={(newQuote) => {
            const existingIdx = quotes.findIndex((q) => q.code === newQuote.code);
            if (existingIdx >= 0) {
              const updated = [...quotes];
              updated[existingIdx] = { ...updated[existingIdx], ...newQuote };
              setQuotes(updated);
            } else {
              setQuotes([
                {
                  id: `bg-${Date.now()}`,
                  code: newQuote.code,
                  date: newQuote.date,
                  expiryDate: newQuote.expiryDate,
                  customer: newQuote.customer,
                  amount: newQuote.amount,
                  status: newQuote.status || "Chưa gửi",
                  description: newQuote.description,
                },
                ...quotes,
              ]);
            }
          }}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
          notify={notify}
        />
      )}

      {/* Modal: Đơn đặt hàng (Full modal form matching Screenshot 1) */}
      {showOrderModal && (
        <SaleOrderModal
          initialCode={selectedOrder?.code || `ĐH0000${orders.length + 1}`}
          initialData={selectedOrder}
          quotesList={quotes}
          onClose={() => {
            setShowOrderModal(false);
            setSelectedOrder(null);
          }}
          onSubmit={(newOrder) => {
            const existingIdx = orders.findIndex((o) => o.code === newOrder.code);
            if (existingIdx >= 0) {
              const updated = [...orders];
              updated[existingIdx] = { ...updated[existingIdx], ...newOrder };
              setOrders(updated);
            } else {
              setOrders([
                {
                  id: `so-${Date.now()}`,
                  code: newOrder.code,
                  date: newOrder.date,
                  deliveryDate: newOrder.deliveryDate,
                  customer: newOrder.customer,
                  amount: newOrder.amount,
                  status: newOrder.status || "Chưa thực hiện",
                  description: newOrder.description,
                },
                ...orders,
              ]);
            }
          }}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
          notify={notify}
        />
      )}

      {/* Modal: Hợp đồng bán hàng (Full modal form matching Screenshot 2) */}
      {showContractModal && (
        <SaleContractModal
          initialCode={selectedContract?.code || `HĐB0000${contracts.length + 1}`}
          initialData={selectedContract}
          ordersList={orders}
          onClose={() => {
            setShowContractModal(false);
            setSelectedContract(null);
          }}
          onSubmit={(newContract) => {
            const existingIdx = contracts.findIndex((c) => c.code === newContract.code);
            if (existingIdx >= 0) {
              const updated = [...contracts];
              updated[existingIdx] = { ...updated[existingIdx], ...newContract };
              setContracts(updated);
            } else {
              setContracts([
                {
                  id: `hdb-${Date.now()}`,
                  code: newContract.code,
                  date: newContract.date,
                  customer: newContract.customer,
                  amount: newContract.amount,
                  status: newContract.status || "Chưa thực hiện",
                  deliveryStatus: newContract.deliveryStatus || "Chưa giao",
                  ...newContract,
                },
                ...contracts,
              ]);
            }
          }}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
          notify={notify}
        />
      )}

      {/* Modal: Ghi nhận doanh thu / Bán hàng (Full modal form matching Screenshots 1, 2, 3, 4) */}
      {showVoucherModal && (
        <SaleVoucherModal
          initialCode={
            selectedVoucher?.code || "BH00001"
          }
          initialType={selectedVoucher?.saleType || activeSaleType || 1}
          initialData={selectedVoucher}
          isService={isServiceSale}
          ordersList={orders}
          onClose={() => {
            setShowVoucherModal(false);
            setSelectedVoucher(null);
            setIsServiceSale(false);
          }}
          onSubmit={(newVoucher) => {
            const existingIdx = salesVouchers.findIndex((v) => v.code === newVoucher.code);
            if (existingIdx >= 0) {
              const updated = [...salesVouchers];
              updated[existingIdx] = { ...updated[existingIdx], ...newVoucher };
              setSalesVouchers(updated);
            } else {
              setSalesVouchers([
                {
                  id: `bh-${Date.now()}`,
                  code: newVoucher.code,
                  saleType: newVoucher.saleType || 1,
                  date: newVoucher.date,
                  customer: newVoucher.customer,
                  amount: newVoucher.totalPayment || newVoucher.amount,
                  totalPayment: newVoucher.totalPayment || newVoucher.amount,
                  status: newVoucher.collectionType === "collected_now" ? "Đã thanh toán" : "Chưa thanh toán",
                  hasInvoice: newVoucher.hasInvoice,
                  hasDeliveryNote: newVoucher.hasDeliveryNote,
                  description: newVoucher.description,
                  ...newVoucher,
                },
                ...salesVouchers,
              ]);
            }
            setIsServiceSale(false);
          }}
          onOpenCustomerModal={() => setShowCustomerModal(true)}
          notify={notify}
        />
      )}

      {/* Modal: Điều khoản thanh toán */}
      {showPaymentTermsModal && (
        <div className="misa-modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 99999, display: "grid", placeItems: "center" }}>
          <div style={{ background: "#ffffff", borderRadius: 8, width: 520, maxWidth: "95vw", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
              <strong style={{ fontSize: 15, color: "#1e293b" }}>Danh mục Điều khoản thanh toán</strong>
              <button type="button" onClick={() => setShowPaymentTermsModal(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}>×</button>
            </div>
            <div style={{ padding: 18 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Mã</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Tên điều khoản</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Số ngày được nợ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>TTN</td>
                    <td style={{ padding: "8px 10px" }}>Thanh toán ngay khi giao hàng</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>0</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>NET30</td>
                    <td style={{ padding: "8px 10px" }}>Gối đầu công nợ 30 ngày</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>30</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>NET45</td>
                    <td style={{ padding: "8px 10px" }}>Gối đầu công nợ 45 ngày</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>45</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" onClick={() => setShowPaymentTermsModal(false)} style={{ height: 32, padding: "0 16px", border: "none", background: "#00b06b", color: "#ffffff", borderRadius: 4, fontWeight: 600, cursor: "pointer" }}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // -------------------------------------------------------------------------
  // 1. TAB: QUY TRÌNH BÁN HÀNG (EXACT MATCHING USER SCREENSHOT)
  // -------------------------------------------------------------------------
  if (tab === "process") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
          background: "#f4f5f8",
          padding: "16px 18px 24px 18px",
          boxSizing: "border-box",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Main Grid: Flowchart Left (2.4fr) + Reports Right (1fr) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.4fr 1fr",
            gap: 14,
            marginBottom: 14,
            alignItems: "stretch",
          }}
        >
          {/* Panel 1: NGHIỆP VỤ BÁN HÀNG */}
          <section
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              padding: "16px 18px",
              position: "relative",
              minHeight: 330,
            }}
          >
            {/* Header */}
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#1e293b",
                textAlign: "center",
                margin: "0 0 16px 0",
                letterSpacing: 0.3,
              }}
            >
              NGHIỆP VỤ BÁN HÀNG
            </h2>

            {/* Canvas Container */}
            <div
              style={{
                flex: 1,
                position: "relative",
                minHeight: 280,
                width: "100%",
              }}
            >
              {/* SVG Connecting Timeline and Brackets */}
              <svg
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  overflow: "visible",
                }}
                viewBox="0 0 700 280"
                preserveAspectRatio="none"
              >
                <defs>
                  <marker
                    id="sales-flow-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6" fill="none" stroke="#94a3b8" strokeWidth="1.4" />
                  </marker>
                </defs>

                {/* Bracket connecting Left 3 nodes: Báo giá (y:42), Đơn đặt hàng (y:135), Hợp đồng (y:228) */}
                {/* Horizontal from Báo giá */}
                <path d="M 175 42 L 202 42" stroke="#cbd5e1" strokeWidth="1.4" fill="none" />
                {/* Horizontal from Đơn đặt hàng */}
                <path d="M 175 135 L 202 135" stroke="#cbd5e1" strokeWidth="1.4" fill="none" />
                {/* Horizontal from Hợp đồng bán hàng */}
                <path d="M 175 228 L 202 228" stroke="#cbd5e1" strokeWidth="1.4" fill="none" />
                {/* Vertical bracket bar */}
                <path d="M 202 42 Q 202 135 202 135 Q 202 135 202 228" stroke="#cbd5e1" strokeWidth="1.4" fill="none" />

                {/* Main horizontal workflow line from bracket (x:202, y:135) to arrow (x:620, y:135) */}
                <path
                  d="M 202 135 L 620 135"
                  stroke="#cbd5e1"
                  strokeWidth="1.4"
                  fill="none"
                  markerEnd="url(#sales-flow-arrow)"
                />

                {/* Vertical connector for Station 1: Ghi nhận doanh thu (y:42) & Xuất hóa đơn (y:228) */}
                <path d="M 295 85 L 295 135" stroke="#cbd5e1" strokeWidth="1.4" fill="none" />
                <path d="M 295 135 L 295 185" stroke="#cbd5e1" strokeWidth="1.4" fill="none" />
                <circle cx="295" cy="135" r="3" fill="#94a3b8" />

                {/* Vertical connector for Station 2: Trả lại hàng bán (y:42) & Giảm giá hàng bán (y:228) */}
                <path d="M 425 85 L 425 135" stroke="#cbd5e1" strokeWidth="1.4" fill="none" />
                <path d="M 425 135 L 425 185" stroke="#cbd5e1" strokeWidth="1.4" fill="none" />
                <circle cx="425" cy="135" r="3" fill="#94a3b8" />

                {/* Vertical connector for Station 3: Thu tiền theo hóa đơn (y:42) */}
                <path d="M 550 85 L 550 135" stroke="#cbd5e1" strokeWidth="1.4" fill="none" />
                <circle cx="550" cy="135" r="3" fill="#94a3b8" />
              </svg>

              {/* ----------------- FLOWCHART NODES ----------------- */}

              {/* Node 1: Báo giá (Top Left) */}
              <div
                style={{
                  position: "absolute",
                  left: "9%",
                  top: 8,
                  width: 90,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  textAlign: "center",
                  zIndex: 10,
                }}
                onClick={() => setShowQuoteModal(true)}
                title="Lập Báo giá cho khách hàng"
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: "#e8f7f0",
                    border: "1px solid #a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <rect x="7" y="6" width="22" height="25" rx="3" fill="#059669" />
                    <rect x="11" y="10" width="14" height="2.5" rx="1" fill="#a7f3d0" />
                    <rect x="11" y="15" width="10" height="2" rx="1" fill="#a7f3d0" />
                    <circle cx="23" cy="22" r="6" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                    <text x="23" y="25" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">$</text>
                  </svg>
                </div>
                <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                  Báo giá
                </span>
              </div>

              {/* Node 2: Đơn đặt hàng (Middle Left) */}
              <div
                style={{
                  position: "absolute",
                  left: "9%",
                  top: 104,
                  width: 90,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  textAlign: "center",
                  zIndex: 10,
                }}
                onClick={() => {
                  setSelectedOrder(null);
                  setShowOrderModal(true);
                }}
                title="Lập Đơn đặt hàng"
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: "#e8f7f0",
                    border: "1px solid #a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <rect x="7" y="7" width="22" height="24" rx="3" fill="#059669" />
                    <rect x="13" y="5" width="10" height="3" rx="1.5" fill="#f59e0b" />
                    <path d="M 12 14 L 15 17 L 23 11" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="11" y="21" width="14" height="2" rx="1" fill="#a7f3d0" />
                    <circle cx="23" cy="23" r="5" fill="#f59e0b" />
                    <path d="M 21 23 L 22.5 24.5 L 25 21.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                  Đơn đặt hàng
                </span>
              </div>

              {/* Node 3: Hợp đồng bán hàng (Bottom Left) */}
              <div
                style={{
                  position: "absolute",
                  left: "9%",
                  top: 198,
                  width: 90,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  textAlign: "center",
                  zIndex: 10,
                }}
                onClick={() => {
                  setSelectedContract(null);
                  setShowContractModal(true);
                }}
                title="Lập Hợp đồng bán hàng"
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: "#e8f7f0",
                    border: "1px solid #a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <rect x="6" y="8" width="24" height="22" rx="3" fill="#059669" />
                    <path d="M 6 12 L 30 12" stroke="#047857" strokeWidth="1.2" />
                    <rect x="10" y="16" width="12" height="2" rx="1" fill="#a7f3d0" />
                    <rect x="10" y="21" width="8" height="2" rx="1" fill="#a7f3d0" />
                    <rect x="21" y="16" width="8" height="11" rx="2" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                    <path d="M 23 20 L 27 20 M 23 23 L 27 23" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                </div>
                <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                  Hợp đồng<br />bán hàng
                </span>
              </div>

              {/* Node 4: Ghi nhận doanh thu (Station 1 Top) */}
              <div
                style={{
                  position: "absolute",
                  left: "37%",
                  top: 8,
                  width: 100,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  textAlign: "center",
                  zIndex: 10,
                }}
                onClick={() => {
                  setSelectedVoucher(null);
                  setActiveSaleType(1);
                  setShowVoucherModal(true);
                }}
                title="Lập Chứng từ bán hàng / Ghi nhận doanh thu"
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: "#e8f7f0",
                    border: "1px solid #a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <rect x="7" y="6" width="22" height="25" rx="3" fill="#059669" />
                    {/* Line chart trending up */}
                    <path d="M 11 24 L 16 19 L 20 21 L 25 14" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="25" cy="14" r="2" fill="#f59e0b" />
                    <circle cx="24" cy="24" r="5" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                    <text x="24" y="27" fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">$</text>
                  </svg>
                </div>
                <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                  Ghi nhận<br />doanh thu
                </span>
              </div>

              {/* Node 5: Xuất hóa đơn doanh thu (Station 1 Bottom) */}
              <div
                style={{
                  position: "absolute",
                  left: "37%",
                  top: 198,
                  width: 100,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  textAlign: "center",
                  zIndex: 10,
                }}
                onClick={() => {
                  navigateTo("invoices");
                  notify("Mở danh sách Hóa đơn bán hàng...");
                }}
                title="Xuất hóa đơn bán hàng"
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: "#e8f7f0",
                    border: "1px solid #a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <rect x="7" y="6" width="22" height="25" rx="3" fill="#059669" />
                    <rect x="11" y="10" width="14" height="2" rx="1" fill="#a7f3d0" />
                    <rect x="11" y="14" width="8" height="2" rx="1" fill="#a7f3d0" />
                    <rect x="11" y="18" width="12" height="2" rx="1" fill="#a7f3d0" />
                    <circle cx="23" cy="22" r="6" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                    <text x="23" y="25" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">$</text>
                  </svg>
                </div>
                <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                  Xuất hóa đơn<br />doanh thu
                </span>
              </div>

              {/* Node 6: Trả lại hàng bán (Station 2 Top) */}
              <div
                style={{
                  position: "absolute",
                  left: "56%",
                  top: 8,
                  width: 95,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  textAlign: "center",
                  zIndex: 10,
                }}
                onClick={() => {
                  navigateTo("returns");
                  notify("Lập chứng từ Trả lại hàng bán...");
                }}
                title="Lập chứng từ Trả lại hàng bán"
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: "#e8f7f0",
                    border: "1px solid #a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <rect x="7" y="6" width="22" height="25" rx="3" fill="#059669" />
                    {/* Return circular arrow */}
                    <path d="M 14 17 A 5 5 0 1 1 22 17" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M 12 15 L 14 17 L 16 15" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    {/* Yellow parcel box */}
                    <rect x="18" y="16" width="11" height="11" rx="2" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                    <path d="M 18 20 L 29 20" stroke="#ffffff" strokeWidth="1" />
                    <path d="M 23.5 16 L 23.5 27" stroke="#ffffff" strokeWidth="1" />
                  </svg>
                </div>
                <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                  Trả lại<br />hàng bán
                </span>
              </div>

              {/* Node 7: Giảm giá hàng bán (Station 2 Bottom) */}
              <div
                style={{
                  position: "absolute",
                  left: "56%",
                  top: 198,
                  width: 95,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  textAlign: "center",
                  zIndex: 10,
                }}
                onClick={() => {
                  navigateTo("discounts");
                  notify("Lập chứng từ Giảm giá hàng bán...");
                }}
                title="Lập chứng từ Giảm giá hàng bán"
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: "#e8f7f0",
                    border: "1px solid #a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <rect x="7" y="6" width="22" height="25" rx="3" fill="#059669" />
                    <circle cx="14" cy="14" r="1.5" fill="#ffffff" />
                    <circle cx="19" cy="19" r="1.5" fill="#ffffff" />
                    <path d="M 20 13 L 13 20" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
                    {/* Yellow box */}
                    <rect x="18" y="16" width="11" height="11" rx="2" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                    <path d="M 18 20 L 29 20" stroke="#ffffff" strokeWidth="1" />
                    <path d="M 23.5 16 L 23.5 27" stroke="#ffffff" strokeWidth="1" />
                  </svg>
                </div>
                <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                  Giảm giá<br />hàng bán
                </span>
              </div>

              {/* Node 8: Thu tiền theo hóa đơn (Station 3 Top) */}
              <div
                style={{
                  position: "absolute",
                  left: "74%",
                  top: 8,
                  width: 95,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                  textAlign: "center",
                  zIndex: 10,
                }}
                onClick={() => setShowCollectionModal(true)}
                title="Thu tiền khách hàng theo hóa đơn"
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: "#e8f7f0",
                    border: "1px solid #a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <rect x="9" y="7" width="18" height="22" rx="3" fill="#059669" stroke="#047857" strokeWidth="0.8" />
                    <rect x="12" y="11" width="12" height="7" rx="1" fill="#f59e0b" />
                    <path d="M 12 22 L 20 22" stroke="#a7f3d0" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M 5 18 L 10 18 M 8 15 L 11 18 L 8 21" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                  Thu tiền theo<br />hóa đơn
                </span>
              </div>
            </div>
          </section>

          {/* Panel 2: BÁO CÁO (Right Column) */}
          <aside
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                margin: 0,
                padding: "14px 16px",
                borderBottom: "1px solid #f1f5f9",
                color: "#1e293b",
                textAlign: "center",
              }}
            >
              BÁO CÁO
            </h2>

            <ul style={{ listStyle: "none", margin: 0, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              <li>
                <span
                  style={{ fontSize: 12.5, color: "#334155", cursor: "pointer", fontWeight: 500 }}
                  onClick={() => notify("Mở Sổ chi tiết bán hàng...")}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#0284c7")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                >
                  • Sổ chi tiết bán hàng
                </span>
              </li>
              <li>
                <span
                  style={{ fontSize: 12.5, color: "#334155", cursor: "pointer", fontWeight: 500 }}
                  onClick={() => notify("Mở Chi tiết công nợ phải thu khách hàng...")}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#0284c7")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                >
                  • Chi tiết công nợ phải thu khách hàng
                </span>
              </li>
              <li>
                <span
                  style={{ fontSize: 12.5, color: "#334155", cursor: "pointer", fontWeight: 500 }}
                  onClick={() => notify("Mở Báo cáo tổng hợp bán hàng theo mặt hàng...")}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#0284c7")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                >
                  • Tổng hợp bán hàng theo mặt hàng
                </span>
              </li>
              <li>
                <span
                  style={{ fontSize: 12.5, color: "#334155", cursor: "pointer", fontWeight: 500 }}
                  onClick={() => notify("Mở Báo cáo tổng hợp công nợ phải thu khách hàng...")}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#0284c7")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                >
                  • Tổng hợp công nợ phải thu khách hàng
                </span>
              </li>
              <li>
                <span
                  style={{ fontSize: 12.5, color: "#334155", cursor: "pointer", fontWeight: 500 }}
                  onClick={() => notify("Mở Báo cáo chi tiết lãi lỗ theo đơn hàng...")}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#0284c7")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                >
                  • Báo cáo chi tiết lãi lỗ theo đơn hàng
                </span>
              </li>
            </ul>

            <div style={{ marginTop: "auto", padding: "14px 16px", borderTop: "1px solid #f1f5f9", textAlign: "center" }}>
              <span
                style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                onClick={() => notify("Mở tất cả báo cáo bán hàng...")}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Tất cả báo cáo
              </span>
            </div>
          </aside>
        </div>

        {/* Panel 3: Quick Action Buttons (Bottom Bar spanning full width) */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            overflow: "hidden",
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12.5,
              color: "#334155",
            }}
            onClick={() => setShowCustomerModal(true)}
          >
            <UserRound size={20} style={{ color: "#f59e0b" }} />
            <span>Khách hàng</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12.5,
              color: "#334155",
            }}
            onClick={() => notify("Xem danh mục Hàng hóa, dịch vụ")}
          >
            <Package size={20} style={{ color: "#10b981" }} />
            <span>Hàng hóa, dịch vụ</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12.5,
              color: "#334155",
            }}
            onClick={() => setShowPaymentTermsModal(true)}
          >
            <ShieldCheck size={20} style={{ color: "#00b06b" }} />
            <span>Điều khoản thanh toán</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12.5,
              color: "#334155",
            }}
            onClick={() => notify("Mở danh sách tiện ích phân hệ Bán hàng...")}
          >
            <Lightbulb size={20} style={{ color: "#10b981" }} />
            <span>Tiện ích</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              cursor: "pointer",
              fontSize: 12.5,
              color: "#334155",
            }}
            onClick={() => notify("Tùy chọn thiết lập phân hệ Bán hàng...")}
          >
            <SlidersHorizontal size={20} style={{ color: "#64748b" }} />
            <span>Tùy chọn</span>
          </button>
        </div>

        {/* Panel 4: AMIS CRM Integration Banner */}
        <div
          style={{
            background: "linear-gradient(90deg, #dbeafe 0%, #eff6ff 100%)",
            borderRadius: 8,
            border: "1px solid #bfdbfe",
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* AMIS CRM Logo */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#2563eb",
                display: "grid",
                placeItems: "center",
                color: "#ffffff",
                boxShadow: "0 2px 4px rgba(37,99,235,0.25)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <strong style={{ color: "#1e293b", fontWeight: 700 }}>AMIS CRM</strong>
              <span style={{ color: "#334155" }}>
                <strong>Kết nối dữ liệu</strong> giữa bộ phận bán hàng và kế toán
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              onClick={() => notify("Xem chi tiết tính năng đồng bộ AMIS CRM...")}
              style={{
                background: "none",
                border: "none",
                color: "#0284c7",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Lightbulb size={15} style={{ color: "#f59e0b" }} />
              <span>Xem tính năng</span>
            </button>

            <button
              type="button"
              onClick={() => notify("Đang kết nối hệ thống AMIS CRM...")}
              style={{
                background: "#00b06b",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                padding: "6px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
              }}
            >
              <span>Kết nối ngay</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. TAB: BIỂU ĐỒ BÁN HÀNG
  // -------------------------------------------------------------------------
  if (tab === "chart") {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: "#f4f5f8", padding: "12px 18px 24px 18px", boxSizing: "border-box" }}>
        {/* Subheader: Đơn vị tính tiền */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
            <span>Đơn vị tính tiền</span>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
                style={{ background: "none", border: "none", color: "#0284c7", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 4px", fontSize: 13 }}
              >
                <span>{currencyUnit}</span>
                <ChevronDown size={14} />
              </button>
              {showCurrencyMenu && (
                <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.12)", zIndex: 50, minWidth: 130 }}>
                  {["Đồng", "Nghìn đồng", "Triệu đồng", "Tỷ đồng"].map((unit) => (
                    <div
                      key={unit}
                      onClick={() => { setCurrencyUnit(unit); setShowCurrencyMenu(false); notify(`Đã chuyển đơn vị tính tiền sang: ${unit}`); }}
                      style={{ padding: "7px 12px", fontSize: 13, color: currencyUnit === unit ? "#0284c7" : "#1e293b", fontWeight: currencyUnit === unit ? 600 : 400, background: currencyUnit === unit ? "#eff6ff" : "#ffffff", cursor: "pointer" }}
                    >
                      {unit}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3 KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 14 }}>
          {/* Card 1: Báo giá & Đơn đặt hàng */}
          <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#8b5cf6", color: "#ffffff", padding: "8px 14px", borderTopLeftRadius: 5, borderTopRightRadius: 5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Đơn đặt hàng</span>
              <span style={{ fontSize: 12.5, opacity: 0.9 }}>{chartPeriods.orders} ▾</span>
            </div>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#334155" }}>
                <span>Giá trị đơn hàng</span>
                <span style={{ color: "#0284c7", fontWeight: 600 }}>{formatVND(orders.reduce((s, o) => s + o.amount, 0))} đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#334155" }}>
                <span>Đã thực hiện</span>
                <span style={{ color: "#0284c7", fontWeight: 600 }}>0 đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#334155" }}>
                <span>Đã thu tiền</span>
                <span style={{ color: "#0284c7", fontWeight: 600 }}>0 đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#334155" }}>
                <span>Chưa thu tiền</span>
                <span style={{ color: "#ea580c", fontWeight: 600 }}>{formatVND(orders.reduce((s, o) => s + o.amount, 0))} đ</span>
              </div>
            </div>
            <div style={{ padding: "8px 14px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#64748b" }}>
              <Clock size={12.5} style={{ color: "#94a3b8" }} />
              <span>Số liệu tính đến: {chartRefreshTime}</span>
              <span onClick={handleRefreshChart} style={{ color: "#0284c7", cursor: "pointer", fontWeight: 500, marginLeft: 4 }}>Tải lại</span>
            </div>
          </div>

          {/* Card 2: Hợp đồng bán */}
          <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#0284c7", color: "#ffffff", padding: "8px 14px", borderTopLeftRadius: 5, borderTopRightRadius: 5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Hợp đồng bán</span>
              <span style={{ fontSize: 12.5, opacity: 0.9 }}>{chartPeriods.contracts} ▾</span>
            </div>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#334155" }}>
                <span>Giá trị hợp đồng</span>
                <span style={{ color: "#0284c7", fontWeight: 600 }}>{formatVND(contracts.reduce((s, c) => s + c.amount, 0))} đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#334155" }}>
                <span>Đã thực hiện</span>
                <span style={{ color: "#0284c7", fontWeight: 600 }}>0 đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#334155" }}>
                <span>Đã thu tiền</span>
                <span style={{ color: "#0284c7", fontWeight: 600 }}>0 đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#334155" }}>
                <span>Chưa thu tiền</span>
                <span style={{ color: "#ea580c", fontWeight: 600 }}>{formatVND(contracts.reduce((s, c) => s + c.amount, 0))} đ</span>
              </div>
            </div>
            <div style={{ padding: "8px 14px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#64748b" }}>
              <Clock size={12.5} style={{ color: "#94a3b8" }} />
              <span>Số liệu tính đến: {chartRefreshTime}</span>
              <span onClick={handleRefreshChart} style={{ color: "#0284c7", cursor: "pointer", fontWeight: 500, marginLeft: 4 }}>Tải lại</span>
            </div>
          </div>

          {/* Card 3: Bán hàng */}
          <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
            <div style={{ background: "#009688", color: "#ffffff", padding: "8px 14px", borderTopLeftRadius: 5, borderTopRightRadius: 5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Bán hàng</span>
              <span style={{ fontSize: 12.5, opacity: 0.9 }}>{chartPeriods.sales} ▾</span>
            </div>
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1, justifyContent: "space-around" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#334155" }}>
                <span>Tổng tiền bán hàng</span>
                <span style={{ color: "#0284c7", fontWeight: 600 }}>{formatVND(salesVouchers.reduce((s, v) => s + v.amount, 0))} đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#334155" }}>
                <span>Đã thu tiền</span>
                <span style={{ color: "#0284c7", fontWeight: 600 }}>45.000.000 đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#334155" }}>
                <span>Chưa thu tiền</span>
                <span style={{ color: "#ea580c", fontWeight: 600 }}>64.000.000 đ</span>
              </div>
            </div>
            <div style={{ padding: "8px 14px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#64748b" }}>
              <Clock size={12.5} style={{ color: "#94a3b8" }} />
              <span>Số liệu tính đến: {chartRefreshTime}</span>
              <span onClick={handleRefreshChart} style={{ color: "#0284c7", cursor: "pointer", fontWeight: 500, marginLeft: 4 }}>Tải lại</span>
            </div>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 3. TAB: BÁO GIÁ
  // -------------------------------------------------------------------------
  if (tab === "quotes") {
    if (quoteViewMode === "landing") {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "calc(100vh - 120px)",
            background: "#ffffff",
            padding: "36px 20px 24px 20px",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* Top / Center Hero Container */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              margin: "auto 0",
              maxWidth: 720,
              textAlign: "center",
            }}
          >
            {/* SVG Illustration matching Screenshot 2 */}
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
              <svg width="290" height="190" viewBox="0 0 290 190" fill="none">
                {/* Soft ground shadows */}
                <ellipse cx="145" cy="165" rx="110" ry="11" fill="#f1f5f9" />
                <ellipse cx="145" cy="164" rx="75" ry="6" fill="#e2e8f0" />

                {/* Left Floating Doc with Dollar */}
                <g transform="translate(44, 48)">
                  <rect x="0" y="0" width="36" height="46" rx="4" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <path d="M24 0 L36 12 L24 12 Z" fill="#10b981" />
                  <circle cx="18" cy="25" r="9" fill="#10b981" />
                  <text x="18" y="29.5" fill="#ffffff" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">$</text>
                  <circle cx="-5" cy="40" r="3" fill="#10b981" />
                </g>

                {/* Top Left Teal Users / Hierarchy Bubble */}
                <g transform="translate(50, 14)">
                  <circle cx="6" cy="6" r="3.5" fill="#a7f3d0" />
                  <circle cx="15" cy="4" r="4.5" fill="#6ee7b7" />
                  <circle cx="24" cy="6" r="3.5" fill="#a7f3d0" />
                  <path d="M1 18 C1 13 4 11 11 11 C18 11 21 13 21 18" fill="#a7f3d0" />
                  <path d="M8 18 C8 12 11 10 19 10 C27 10 30 12 30 18" fill="#6ee7b7" />
                </g>

                {/* Center Woman Character */}
                <g transform="translate(116, 58)">
                  {/* Body / Blazer in Green */}
                  <path d="M29 65 C16 65 6 72 2 86 L56 86 C52 72 42 65 29 65 Z" fill="#00a862" />
                  {/* Inner shirt / V-neck */}
                  <path d="M24 65 L29 76 L34 65 Z" fill="#1e293b" />
                  {/* Neck */}
                  <rect x="26" y="55" width="6" height="12" fill="#fed7aa" rx="2" />
                  {/* Head */}
                  <ellipse cx="29" cy="44" rx="13" ry="15" fill="#fed7aa" />
                  {/* Hair */}
                  <path d="M16 42 C16 28 23 24 29 24 C37 24 42 28 42 42 C42 44 39 41 37 38 C33 34 23 34 19 40 Z" fill="#1e293b" />
                  {/* Hair Ponytail */}
                  <path d="M38 36 C46 40 49 54 45 64 C43 67 41 65 41 60 C41 50 39 42 38 36 Z" fill="#1e293b" />
                  {/* Face features */}
                  <circle cx="25" cy="43" r="1.5" fill="#1e293b" />
                  <circle cx="32" cy="43" r="1.5" fill="#1e293b" />
                  <path d="M27 48 Q29 50 31 48" stroke="#ea580c" strokeWidth="1.2" fill="none" strokeLinecap="round" />

                  {/* Laptop */}
                  <polygon points="12,86 46,86 50,95 8,95" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
                  <rect x="15" y="67" width="28" height="19" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
                  <rect x="17" y="69" width="24" height="15" rx="1" fill="#f8fafc" />
                  <line x1="20" y1="74" x2="28" y2="74" stroke="#00b06b" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="20" y1="78" x2="36" y2="78" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                </g>

                {/* Right Floating Elements */}
                {/* 1. Green coin with % */}
                <g transform="translate(192, 34)">
                  <circle cx="13" cy="13" r="11" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <text x="13" y="17.5" fill="#10b981" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">%</text>
                </g>

                {/* 2. Green coin with Chart */}
                <g transform="translate(208, 65)">
                  <circle cx="14" cy="14" r="12" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <rect x="8" y="15" width="2.5" height="5" rx="0.5" fill="#10b981" />
                  <rect x="12" y="11" width="2.5" height="9" rx="0.5" fill="#10b981" />
                  <rect x="16" y="8" width="2.5" height="12" rx="0.5" fill="#10b981" />
                </g>

                {/* 3. Small smile coin */}
                <g transform="translate(186, 92)">
                  <circle cx="10" cy="10" r="9" fill="#ffffff" stroke="#10b981" strokeWidth="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.05))" />
                  <circle cx="7.5" cy="8.5" r="1.2" fill="#10b981" />
                  <circle cx="12.5" cy="8.5" r="1.2" fill="#10b981" />
                  <path d="M6.5 12 Q10 15 13.5 12" stroke="#10b981" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                </g>

                {/* Decorative pluses & sparkles */}
                <path d="M82 92 L86 92 M84 90 L84 94" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M206 20 L210 20 M208 18 L208 22" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M222 84 L224 84 M223 83 L223 85" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="78" cy="122" r="2.5" fill="#10b981" />
                <circle cx="226" cy="116" r="2.5" fill="#10b981" />
              </svg>
            </div>

            {/* Heading text */}
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#1e293b",
                margin: "0 0 22px 0",
                lineHeight: 1.4,
              }}
            >
              Thêm, gửi báo giá và quản lý các báo giá đã gửi cho khách hàng
            </h2>

            {/* 3 Action Buttons - spaced out evenly */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
              {/* Button 1: Thêm bằng AI */}
              <button
                type="button"
                onClick={() => {
                  setSelectedQuote({
                    code: `BG0000${quotes.length + 1}`,
                    customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
                    customerCode: "KH001",
                    taxCode: "0102345678",
                    address: "Tòa nhà PVN, 18 Láng Hạ, Ba Đình, Hà Nội",
                    contact: "Nguyễn Văn Hùng",
                    date: "29/09/2026",
                    expiryDate: "15/10/2026",
                    description: "Báo giá vật tư thiết bị điện hạ thế theo yêu cầu chào giá",
                    items: [
                      {
                        id: "ai-item-1",
                        code: "VT002",
                        name: "Tủ điện phân phối tổng MSB 630A Schneider",
                        unit: "Bộ",
                        quantity: 1,
                        unitPrice: 45000000,
                        amount: 45000000,
                        vatRate: 10,
                        vatAmount: 4500000,
                      },
                      {
                        id: "ai-item-2",
                        code: "VT003",
                        name: "Aptomat khối MCCB 3P 250A 36kA Mitsubishi",
                        unit: "Cái",
                        quantity: 3,
                        unitPrice: 3250000,
                        amount: 9750000,
                        vatRate: 10,
                        vatAmount: 975000,
                      },
                    ],
                  });
                  setShowQuoteModal(true);
                  notify("AVA AI đã tự động tổng hợp thông tin báo giá từ yêu cầu chào hàng!");
                }}
                style={{
                  height: 38,
                  padding: "0 20px",
                  borderRadius: 4,
                  background: "linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 2px 4px rgba(37,99,235,0.25)",
                  minWidth: 140,
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src="/ava_avatar.jpg"
                    alt="AVA"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
                <span>Thêm bằng AI</span>
              </button>

              {/* Button 2: Thêm (Solid Green) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedQuote(null);
                  setShowQuoteModal(true);
                }}
                style={{
                  height: 38,
                  padding: "0 28px",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                  minWidth: 100,
                  transition: "all 0.15s ease",
                }}
              >
                Thêm
              </button>

              {/* Button 3: Nhập từ Excel */}
              <button
                type="button"
                onClick={() => notify("Chọn tệp Excel danh sách báo giá mẫu để nhập khẩu")}
                style={{
                  height: 38,
                  padding: "0 20px",
                  borderRadius: 4,
                  background: "#ffffff",
                  color: "#1e293b",
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 130,
                  transition: "all 0.15s ease",
                }}
              >
                Nhập từ Excel
              </button>
            </div>

            {/* Bottom Button: Xem danh sách chứng từ - properly spaced out */}
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setQuoteViewMode("list")}
                style={{
                  height: 36,
                  padding: "0 24px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#15803d",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#00a862";
                  e.currentTarget.style.background = "#f0fdf4";
                  e.currentTarget.style.color = "#00a862";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.color = "#15803d";
                }}
              >
                Xem danh sách chứng từ
              </button>
            </div>
          </div>

          {renderModals()}
        </div>
      );
    }

    // LIST VIEW MODE FOR QUOTES
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* List Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setSelectedQuote(null);
                setShowQuoteModal(true);
              }}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={15} />
              <span>Thêm Báo giá</span>
            </button>

            <button
              type="button"
              onClick={() => notify("Chọn tệp Excel để nhập khẩu")}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Nhập từ Excel
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm kiếm báo giá..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>

            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách báo giá")}
              title="Làm mới"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <RefreshCw size={14} />
            </button>

            <button
              type="button"
              onClick={() => setQuoteViewMode("landing")}
              style={{
                height: 30,
                padding: "0 12px",
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>← Giới thiệu</span>
            </button>
          </div>
        </div>

        {/* Quotes Table */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "left" }}>Số báo giá</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "left" }}>Ngày</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "left" }}>Hạn báo giá</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Khách hàng</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Tổng tiền</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Diễn giải</th>
              </tr>
            </thead>
            <tbody>
              {quotes
                .filter(
                  (q) =>
                    !searchQuery ||
                    q.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    q.customer.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => {
                      setSelectedQuote(q);
                      setShowQuoteModal(true);
                    }}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                    title="Bấm để xem và sửa chi tiết báo giá"
                  >
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{q.code}</td>
                    <td style={{ padding: "8px 10px" }}>{q.date}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{q.expiryDate}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{q.customer}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{formatVND(q.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span
                        style={{
                          background: q.status === "Khách đã duyệt" ? "#dcfce7" : "#e0f2fe",
                          color: q.status === "Khách đã duyệt" ? "#15803d" : "#0284c7",
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 11.5,
                          fontWeight: 600,
                        }}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{q.description}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 4. TAB: ĐƠN ĐẶT HÀNG
  // -------------------------------------------------------------------------
  if (tab === "orders") {
    if (orderViewMode === "landing") {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "calc(100vh - 120px)",
            background: "#ffffff",
            padding: "36px 20px 24px 20px",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* Top / Center Hero Container */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              margin: "auto 0",
              maxWidth: 780,
              textAlign: "center",
            }}
          >
            {/* SVG Illustration matching Screenshot 2 */}
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
              <svg width="290" height="190" viewBox="0 0 290 190" fill="none">
                {/* Soft ground shadows */}
                <ellipse cx="145" cy="165" rx="110" ry="11" fill="#f1f5f9" />
                <ellipse cx="145" cy="164" rx="75" ry="6" fill="#e2e8f0" />

                {/* Left Floating Doc with Dollar */}
                <g transform="translate(44, 48)">
                  <rect x="0" y="0" width="36" height="46" rx="4" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <path d="M24 0 L36 12 L24 12 Z" fill="#10b981" />
                  <circle cx="18" cy="25" r="9" fill="#10b981" />
                  <text x="18" y="29.5" fill="#ffffff" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">$</text>
                  <circle cx="-5" cy="40" r="3" fill="#10b981" />
                </g>

                {/* Top Left Teal Users Bubble */}
                <g transform="translate(50, 14)">
                  <circle cx="6" cy="6" r="3.5" fill="#a7f3d0" />
                  <circle cx="15" cy="4" r="4.5" fill="#6ee7b7" />
                  <circle cx="24" cy="6" r="3.5" fill="#a7f3d0" />
                  <path d="M1 18 C1 13 4 11 11 11 C18 11 21 13 21 18" fill="#a7f3d0" />
                  <path d="M8 18 C8 12 11 10 19 10 C27 10 30 12 30 18" fill="#6ee7b7" />
                </g>

                {/* Center Woman Character */}
                <g transform="translate(116, 58)">
                  {/* Body / Blazer in Green */}
                  <path d="M29 65 C16 65 6 72 2 86 L56 86 C52 72 42 65 29 65 Z" fill="#00a862" />
                  {/* Inner shirt / V-neck */}
                  <path d="M24 65 L29 76 L34 65 Z" fill="#1e293b" />
                  {/* Neck */}
                  <rect x="26" y="55" width="6" height="12" fill="#fed7aa" rx="2" />
                  {/* Head */}
                  <ellipse cx="29" cy="44" rx="13" ry="15" fill="#fed7aa" />
                  {/* Hair */}
                  <path d="M16 42 C16 28 23 24 29 24 C37 24 42 28 42 42 C42 44 39 41 37 38 C33 34 23 34 19 40 Z" fill="#1e293b" />
                  {/* Hair Ponytail */}
                  <path d="M38 36 C46 40 49 54 45 64 C43 67 41 65 41 60 C41 50 39 42 38 36 Z" fill="#1e293b" />
                  {/* Face features */}
                  <circle cx="25" cy="43" r="1.5" fill="#1e293b" />
                  <circle cx="32" cy="43" r="1.5" fill="#1e293b" />
                  <path d="M27 48 Q29 50 31 48" stroke="#ea580c" strokeWidth="1.2" fill="none" strokeLinecap="round" />

                  {/* Laptop */}
                  <polygon points="12,86 46,86 50,95 8,95" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
                  <rect x="15" y="67" width="28" height="19" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
                  <rect x="17" y="69" width="24" height="15" rx="1" fill="#f8fafc" />
                  <line x1="20" y1="74" x2="28" y2="74" stroke="#00b06b" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="20" y1="78" x2="36" y2="78" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                </g>

                {/* Right Floating Elements */}
                {/* 1. Green coin with % */}
                <g transform="translate(192, 34)">
                  <circle cx="13" cy="13" r="11" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <text x="13" y="17.5" fill="#10b981" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">%</text>
                </g>

                {/* 2. Green coin with Chart */}
                <g transform="translate(208, 65)">
                  <circle cx="14" cy="14" r="12" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <rect x="8" y="15" width="2.5" height="5" rx="0.5" fill="#10b981" />
                  <rect x="12" y="11" width="2.5" height="9" rx="0.5" fill="#10b981" />
                  <rect x="16" y="8" width="2.5" height="12" rx="0.5" fill="#10b981" />
                </g>

                {/* 3. Small smile coin */}
                <g transform="translate(186, 92)">
                  <circle cx="10" cy="10" r="9" fill="#ffffff" stroke="#10b981" strokeWidth="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.05))" />
                  <circle cx="7.5" cy="8.5" r="1.2" fill="#10b981" />
                  <circle cx="12.5" cy="8.5" r="1.2" fill="#10b981" />
                  <path d="M6.5 12 Q10 15 13.5 12" stroke="#10b981" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                </g>

                {/* Decorative pluses & sparkles */}
                <path d="M82 92 L86 92 M84 90 L84 94" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M206 20 L210 20 M208 18 L208 22" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M222 84 L224 84 M223 83 L223 85" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="78" cy="122" r="2.5" fill="#10b981" />
                <circle cx="226" cy="116" r="2.5" fill="#10b981" />
              </svg>
            </div>

            {/* Heading text (verbatim from screenshot) */}
            <h2
              style={{
                fontSize: 17.5,
                fontWeight: 700,
                color: "#1e293b",
                margin: "0 0 22px 0",
                lineHeight: 1.45,
              }}
            >
              Thêm đơn đặt hàng để theo dõi tình trạng giao hàng, công nợ, doanh thu, chi phí, lãi lỗ theo từng đơn mua hàng
            </h2>

            {/* 4 Action Buttons - spaced out evenly */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
              {/* Button 1: Thêm bằng AI */}
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder({
                    code: `ĐH0000${orders.length + 1}`,
                    customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
                    customerCode: "KH001",
                    taxCode: "0102345678",
                    address: "Tòa nhà PVN, 18 Láng Hạ, Ba Đình, Hà Nội",
                    receiver: "Nguyễn Văn Hùng",
                    date: "29/09/2026",
                    deliveryDate: "10/10/2026",
                    description: "Đơn đặt hàng cung cấp cáp ngầm và tủ điện công nghiệp",
                    items: [
                      {
                        id: "ai-order-item-1",
                        code: "VT001",
                        name: "Cáp ngầm trung thế 24kV Cu/XLPE/PVC/DSTA",
                        unit: "Mét",
                        quantity: 500,
                        soldQty: 0,
                        exportedQty: 0,
                        unitPrice: 285000,
                        amount: 142500000,
                        vatRate: 10,
                        vatAmount: 14250000,
                      },
                    ],
                  });
                  setShowOrderModal(true);
                  notify("AVA AI đã tổng hợp tự động đơn đặt hàng bán!");
                }}
                style={{
                  height: 38,
                  padding: "0 20px",
                  borderRadius: 4,
                  background: "linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 2px 4px rgba(37,99,235,0.25)",
                  minWidth: 140,
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  <img
                    src="/ava_avatar.jpg"
                    alt="AVA"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
                <span>Thêm bằng AI</span>
              </button>

              {/* Button 2: Thêm (Solid Green) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  setShowOrderModal(true);
                }}
                style={{
                  height: 38,
                  padding: "0 28px",
                  borderRadius: 4,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 4px rgba(0,168,98,0.25)",
                  minWidth: 100,
                  transition: "all 0.15s ease",
                }}
              >
                Thêm
              </button>

              {/* Button 3: Nhập từ Excel */}
              <button
                type="button"
                onClick={() => notify("Chọn tệp Excel danh sách đơn đặt hàng để nhập khẩu")}
                style={{
                  height: 38,
                  padding: "0 20px",
                  borderRadius: 4,
                  background: "#ffffff",
                  color: "#1e293b",
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 130,
                  transition: "all 0.15s ease",
                }}
              >
                Nhập từ Excel
              </button>

              {/* Button 4: Tiện ích */}
              <button
                type="button"
                onClick={() => notify("Mở danh mục tiện ích đơn đặt hàng")}
                style={{
                  height: 38,
                  padding: "0 20px",
                  borderRadius: 4,
                  background: "#ffffff",
                  color: "#1e293b",
                  border: "1px solid #cbd5e1",
                  fontSize: 13.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 100,
                  transition: "all 0.15s ease",
                }}
              >
                Tiện ích
              </button>
            </div>

            {/* Bottom Button: Xem danh sách chứng từ - properly spaced out */}
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setOrderViewMode("list")}
                style={{
                  height: 36,
                  padding: "0 24px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#15803d",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#00a862";
                  e.currentTarget.style.background = "#f0fdf4";
                  e.currentTarget.style.color = "#00a862";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.color = "#15803d";
                }}
              >
                Xem danh sách chứng từ
              </button>
            </div>
          </div>

          {renderModals()}
        </div>
      );
    }

    // LIST VIEW MODE FOR ORDERS
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* List Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setSelectedOrder(null);
                setShowOrderModal(true);
              }}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={15} />
              <span>Thêm Đơn đặt hàng</span>
            </button>

            <button
              type="button"
              onClick={() => notify("Chọn tệp Excel để nhập khẩu")}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Nhập từ Excel
            </button>

            <button
              type="button"
              onClick={() => notify("Tiện ích xử lý hàng loạt")}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Tiện ích
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm kiếm đơn đặt hàng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>

            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách đơn đặt hàng")}
              title="Làm mới"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <RefreshCw size={14} />
            </button>

            <button
              type="button"
              onClick={() => setOrderViewMode("landing")}
              style={{
                height: 30,
                padding: "0 12px",
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>← Giới thiệu</span>
            </button>
          </div>
        </div>

        {/* Orders Table */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "left" }}>Số đơn hàng</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "left" }}>Ngày đặt</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "left" }}>Ngày giao</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Khách hàng</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Giá trị</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Tình trạng ĐH</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Giao hàng</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Diễn giải</th>
              </tr>
            </thead>
            <tbody>
              {orders
                .filter(
                  (o) =>
                    !searchQuery ||
                    o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    o.customer.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => {
                      setSelectedOrder(o);
                      setShowOrderModal(true);
                    }}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                    title="Bấm để xem và sửa chi tiết đơn hàng"
                  >
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{o.code}</td>
                    <td style={{ padding: "8px 10px" }}>{o.date}</td>
                    <td style={{ padding: "8px 10px" }}>{o.deliveryDate}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{o.customer}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{formatVND(o.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11.5, fontWeight: 600 }}>{o.status}</span>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 10, fontSize: 11.5, fontWeight: 600 }}>Chưa giao</span>
                    </td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{o.description}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 5. TAB: HỢP ĐỒNG BÁN HÀNG
  // -------------------------------------------------------------------------
  if (tab === "contracts") {
    if (contractViewMode === "landing") {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "calc(100vh - 120px)",
            background: "#ffffff",
            padding: "36px 20px 24px 20px",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* Top / Center Hero Container */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              margin: "auto 0",
              maxWidth: 780,
              textAlign: "center",
            }}
          >
            {/* SVG Illustration matching Screenshot 1 (Woman accountant + Contract doc with green signature loop + charts) */}
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
              <svg width="290" height="190" viewBox="0 0 290 190" fill="none">
                {/* Soft ground shadows */}
                <ellipse cx="145" cy="165" rx="110" ry="11" fill="#f1f5f9" />
                <ellipse cx="145" cy="164" rx="75" ry="6" fill="#e2e8f0" />

                {/* Left Floating Contract Document with Signature loop */}
                <g transform="translate(42, 42)">
                  {/* Document sheet */}
                  <rect
                    x="0"
                    y="0"
                    width="38"
                    height="50"
                    rx="4"
                    fill="#ffffff"
                    stroke="#10b981"
                    strokeWidth="2.2"
                    filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))"
                  />
                  {/* Folded top-right corner */}
                  <path d="M26 0 L38 12 L26 12 Z" fill="#10b981" />
                  {/* Distinctive green cursive signature ribbon 'e' loop in center */}
                  <path
                    d="M 12 34 C 8 26 12 18 22 20 C 32 22 30 36 16 38 C 28 39 36 32 36 28"
                    stroke="#00a862"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </g>

                {/* Connection line & badge with + */}
                <g transform="translate(90, 72)">
                  <line x1="-8" y1="0" x2="6" y2="0" stroke="#10b981" strokeWidth="1.6" strokeDasharray="2,2" />
                  <circle cx="8" cy="0" r="5.5" fill="#10b981" />
                  <path d="M 5.5 0 L 10.5 0 M 8 -2.5 L 8 2.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                </g>

                {/* Center Woman Character */}
                <g transform="translate(116, 58)">
                  {/* Body / Blazer in rich emerald green #00a862 */}
                  <path d="M29 65 C16 65 6 72 2 86 L56 86 C52 72 42 65 29 65 Z" fill="#00a862" />
                  {/* Inner shirt / V-neck */}
                  <path d="M24 65 L29 76 L34 65 Z" fill="#1e293b" />
                  {/* Neck */}
                  <rect x="26" y="55" width="6" height="12" fill="#fed7aa" rx="2" />
                  {/* Head */}
                  <ellipse cx="29" cy="44" rx="13" ry="15" fill="#fed7aa" />
                  {/* Hair */}
                  <path d="M16 42 C16 28 23 24 29 24 C37 24 42 28 42 42 C42 44 39 41 37 38 C33 34 23 34 19 40 Z" fill="#1e293b" />
                  {/* Hair Ponytail */}
                  <path d="M38 36 C46 40 49 54 45 64 C43 67 41 65 41 60 C41 50 39 42 38 36 Z" fill="#1e293b" />
                  {/* Face features */}
                  <circle cx="25" cy="43" r="1.5" fill="#1e293b" />
                  <circle cx="32" cy="43" r="1.5" fill="#1e293b" />
                  <path d="M27 48 Q29 50 31 48" stroke="#ea580c" strokeWidth="1.2" fill="none" strokeLinecap="round" />

                  {/* Laptop */}
                  <polygon points="12,86 46,86 50,95 8,95" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
                  <rect x="15" y="67" width="28" height="19" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
                  <rect x="17" y="69" width="24" height="15" rx="1" fill="#f8fafc" />
                  <line x1="20" y1="74" x2="28" y2="74" stroke="#00b06b" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="20" y1="78" x2="36" y2="78" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                </g>

                {/* Right Floating Elements matching Screenshot 1 */}
                {/* 1. Top Right: Green circle with clock & check / circular arrow */}
                <g transform="translate(196, 36)">
                  <circle cx="12" cy="12" r="10" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <circle cx="12" cy="12" r="7.5" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="1.5,1.5" />
                  <polyline points="12,7.5 12,12 15,14" stroke="#10b981" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </g>

                {/* 2. Middle Right: Green circle with Bar Chart & Trend */}
                <g transform="translate(208, 66)">
                  <circle cx="14" cy="14" r="12" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <rect x="8" y="15" width="2.5" height="5" rx="0.5" fill="#10b981" />
                  <rect x="12" y="11" width="2.5" height="9" rx="0.5" fill="#10b981" />
                  <rect x="16" y="8" width="2.5" height="12" rx="0.5" fill="#10b981" />
                </g>

                {/* 3. Lower Right: Green coin with $ */}
                <g transform="translate(186, 92)">
                  <circle cx="10" cy="10" r="9" fill="#ffffff" stroke="#10b981" strokeWidth="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.05))" />
                  <text x="10" y="14" fill="#10b981" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">$</text>
                </g>

                {/* Decorative pluses, sparkles & dots */}
                <path d="M82 92 L86 92 M84 90 L84 94" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M206 20 L210 20 M208 18 L208 22" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M224 86 L226 86 M225 85 L225 87" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="76" cy="120" r="2.5" fill="#10b981" />
                <circle cx="228" cy="114" r="2.5" fill="#10b981" />
                <circle cx="190" cy="62" r="1.8" fill="#a7f3d0" />
              </svg>
            </div>

            {/* Heading text (verbatim from user screenshot) */}
            <h2
              style={{
                fontSize: 17.5,
                fontWeight: 700,
                color: "#1e293b",
                margin: "0 0 22px 0",
                lineHeight: 1.45,
              }}
            >
              Thêm hợp đồng bán để theo dõi công nợ, doanh thu, chi phí, lãi lỗ theo từng hợp đồng
            </h2>

            {/* 3 Action Buttons matching Screenshot 1 - spaced out evenly */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
              {/* Button 1: Thêm bằng AI */}
              <button
                type="button"
                onClick={() => {
                  setSelectedContract({
                    code: `HĐB0000${contracts.length + 1}`,
                    customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
                    customerCode: "KH001",
                    address: "Tòa nhà PVN, 18 Láng Hạ, Ba Đình, Hà Nội",
                    contact: "Nguyễn Văn Hùng",
                    date: "29/09/2026",
                    project: "Dự án Khu đô thị Nam An Khánh",
                    amount: 320000000,
                    status: "Chưa thực hiện",
                    deliveryStatus: "Chưa giao",
                    deliveryDate: "15/10/2026",
                    paymentDueDate: "30/10/2026",
                    summary: "Hợp đồng kinh tế cung cấp lắp đặt hệ thống cơ điện và trạm biến áp",
                    items: [
                      {
                        id: "ai-contract-item-1",
                        code: "VT001",
                        name: "Cáp điện Cadivi 3x240+1x185 mm2",
                        unit: "Mét",
                        reqQty: 300,
                        deliveredQty: 0,
                        unitPrice: 450000,
                        amount: 135000000,
                        discountRate: 0,
                        discountAmount: 0,
                        vatRate: 10,
                        vatAmount: 13500000,
                      },
                      {
                        id: "ai-contract-item-2",
                        code: "VT002",
                        name: "Tủ điện phân phối tổng MSB 1600A",
                        unit: "Bộ",
                        reqQty: 2,
                        deliveredQty: 0,
                        unitPrice: 85000000,
                        amount: 170000000,
                        discountRate: 0,
                        discountAmount: 0,
                        vatRate: 10,
                        vatAmount: 17000000,
                      },
                    ],
                  });
                  setShowContractModal(true);
                  notify("AVA Kế toán đã khởi tạo Hợp đồng bán từ gợi ý AI!");
                }}
                style={{
                  height: 38,
                  padding: "0 20px",
                  background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
                  minWidth: 140,
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Sparkles size={12} style={{ color: "#ffffff" }} />
                </div>
                <span>Thêm bằng AI</span>
              </button>

              {/* Button 2: Thêm */}
              <button
                type="button"
                onClick={() => {
                  setSelectedContract(null);
                  setShowContractModal(true);
                }}
                style={{
                  height: 38,
                  padding: "0 28px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                  minWidth: 100,
                  transition: "all 0.15s ease",
                }}
              >
                <span>Thêm</span>
              </button>

              {/* Button 3: Nhập từ Excel */}
              <button
                type="button"
                onClick={() => notify("Chọn file Excel danh sách hợp đồng bán để nhập khẩu")}
                style={{
                  height: 38,
                  padding: "0 20px",
                  background: "#ffffff",
                  color: "#1e293b",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13.5,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 130,
                  transition: "all 0.15s ease",
                }}
              >
                <span>Nhập từ Excel</span>
              </button>
            </div>

            {/* Bottom Link: Xem danh sách chứng từ properly placed in flow */}
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setContractViewMode("list")}
                style={{
                  height: 36,
                  padding: "0 22px",
                  background: "#ffffff",
                  border: "1px solid #10b981",
                  borderRadius: 4,
                  color: "#00a862",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f0fdf4";
                  e.currentTarget.style.borderColor = "#059669";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#10b981";
                }}
              >
                <span>Xem danh sách chứng từ</span>
              </button>
            </div>
          </div>

          {renderModals()}
        </div>
      );
    }

    // LIST VIEW MODE
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Top Action & Search Bar */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setSelectedContract(null);
                setShowContractModal(true);
              }}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={15} />
              <span>Thêm Hợp đồng bán</span>
            </button>

            <button
              type="button"
              onClick={() => notify("Chọn tệp Excel để nhập khẩu")}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Nhập từ Excel
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm kiếm hợp đồng bán..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>

            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách hợp đồng bán")}
              title="Làm mới"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <RefreshCw size={14} />
            </button>

            <button
              type="button"
              onClick={() => setContractViewMode("landing")}
              style={{
                height: 30,
                padding: "0 12px",
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>← Giới thiệu</span>
            </button>
          </div>
        </div>

        {/* Contracts Table */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "left" }}>Số hợp đồng</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "left" }}>Ngày ký</th>
                <th style={{ width: 180, padding: "8px 10px", textAlign: "left" }}>Thuộc dự án</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Khách hàng</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Giá trị HĐ</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Tình trạng HĐ</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Tình trạng GH</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Trích yếu</th>
              </tr>
            </thead>
            <tbody>
              {contracts
                .filter(
                  (c) =>
                    !searchQuery ||
                    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (c.summary && c.summary.toLowerCase().includes(searchQuery.toLowerCase()))
                )
                .map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => {
                      setSelectedContract(c);
                      setShowContractModal(true);
                    }}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                    title="Bấm để xem và sửa chi tiết hợp đồng"
                  >
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{c.code}</td>
                    <td style={{ padding: "8px 10px" }}>{c.date}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{c.project || "—"}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{c.customer}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{formatVND(c.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span
                        style={{
                          background: c.status === "Đang thực hiện" ? "#dcfce7" : c.status === "Đã thanh lý" ? "#f1f5f9" : "#ffedd5",
                          color: c.status === "Đang thực hiện" ? "#15803d" : c.status === "Đã thanh lý" ? "#64748b" : "#c2410c",
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 11.5,
                          fontWeight: 600,
                        }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span
                        style={{
                          background: c.deliveryStatus === "Đã giao hết" ? "#dcfce7" : c.deliveryStatus === "Giao một phần" ? "#e0f2fe" : "#fef3c7",
                          color: c.deliveryStatus === "Đã giao hết" ? "#15803d" : c.deliveryStatus === "Giao một phần" ? "#0284c7" : "#b45309",
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 11.5,
                          fontWeight: 600,
                        }}
                      >
                        {c.deliveryStatus || "Chưa giao"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{c.summary || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* List Footer Summary */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
          <div>
            Tổng số: <strong>{contracts.length}</strong> hợp đồng
          </div>
          <div>
            Tổng giá trị: <strong style={{ color: "#00a862" }}>{formatVND(contracts.reduce((s, c) => s + c.amount, 0))} đ</strong>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 6. TAB: BÁN HÀNG (TRANSACTIONS / SALES) - MATCHING USER SCREENSHOTS
  // -------------------------------------------------------------------------
  if (tab === "transactions" || tab === "sales") {
    if (salesViewMode === "landing") {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "calc(100vh - 120px)",
            background: "#ffffff",
            padding: "36px 20px 80px 20px",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* Top / Center Hero Container */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              margin: "auto 0",
              maxWidth: 780,
              textAlign: "center",
            }}
          >
            {/* SVG Illustration matching Image 5 (Woman accountant + Package box with curved arrows + coins & chart) */}
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
              <svg width="290" height="190" viewBox="0 0 290 190" fill="none">
                {/* Soft ground shadows */}
                <ellipse cx="145" cy="165" rx="110" ry="11" fill="#f1f5f9" />
                <ellipse cx="145" cy="164" rx="75" ry="6" fill="#e2e8f0" />

                {/* Left Floating Package Box with Curved Arrow & Dollar Coin */}
                <g transform="translate(36, 44)">
                  {/* Floating green package box */}
                  <rect
                    x="10"
                    y="18"
                    width="42"
                    height="38"
                    rx="4"
                    fill="#00a862"
                    filter="drop-shadow(0 4px 6px rgba(0,0,0,0.08))"
                  />
                  {/* Box lid/tape */}
                  <path d="M 10 28 L 52 28" stroke="#047857" strokeWidth="1.5" />
                  <path d="M 31 18 L 31 56" stroke="#a7f3d0" strokeWidth="2.5" />

                  {/* Curved arrow wrapping into box */}
                  <path
                    d="M 6 12 C 4 -2 24 -6 38 -2 C 48 2 54 8 58 18"
                    stroke="#00a862"
                    strokeWidth="2.4"
                    strokeDasharray="3,2"
                    fill="none"
                  />
                  <polygon points="56,16 60,21 62,15" fill="#00a862" />

                  {/* Floating green dollar coin */}
                  <circle cx="2" cy="12" r="9.5" fill="#10b981" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))" />
                  <text x="2" y="16.5" fill="#ffffff" fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">$</text>

                  {/* Small connecting dashed line */}
                  <path d="M 2 21 C 2 34 8 40 10 42" stroke="#10b981" strokeWidth="1.6" strokeDasharray="2,2" fill="none" />
                </g>

                {/* Center Woman Character */}
                <g transform="translate(116, 58)">
                  {/* Body / Blazer in emerald green #00a862 */}
                  <path d="M29 65 C16 65 6 72 2 86 L56 86 C52 72 42 65 29 65 Z" fill="#00a862" />
                  {/* Inner shirt / V-neck */}
                  <path d="M24 65 L29 76 L34 65 Z" fill="#1e293b" />
                  {/* Neck */}
                  <rect x="26" y="55" width="6" height="12" fill="#fed7aa" rx="2" />
                  {/* Head */}
                  <ellipse cx="29" cy="44" rx="13" ry="15" fill="#fed7aa" />
                  {/* Hair */}
                  <path d="M16 42 C16 28 23 24 29 24 C37 24 42 28 42 42 C42 44 39 41 37 38 C33 34 23 34 19 40 Z" fill="#1e293b" />
                  {/* Hair Ponytail */}
                  <path d="M38 36 C46 40 49 54 45 64 C43 67 41 65 41 60 C41 50 39 42 38 36 Z" fill="#1e293b" />
                  {/* Face features */}
                  <circle cx="25" cy="43" r="1.5" fill="#1e293b" />
                  <circle cx="32" cy="43" r="1.5" fill="#1e293b" />
                  <path d="M27 48 Q29 50 31 48" stroke="#ea580c" strokeWidth="1.2" fill="none" strokeLinecap="round" />

                  {/* Laptop */}
                  <polygon points="12,86 46,86 50,95 8,95" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
                  <rect x="15" y="67" width="28" height="19" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
                  <rect x="17" y="69" width="24" height="15" rx="1" fill="#f8fafc" />
                  <line x1="20" y1="74" x2="28" y2="74" stroke="#00b06b" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="20" y1="78" x2="36" y2="78" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                </g>

                {/* Right Floating Elements matching Image 5 */}
                {/* 1. Top Right: Green circle with clock & circular arrow */}
                <g transform="translate(196, 36)">
                  <circle cx="12" cy="12" r="10" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <circle cx="12" cy="12" r="7.5" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="1.5,1.5" />
                  <polyline points="12,7.5 12,12 15,14" stroke="#10b981" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </g>

                {/* 2. Middle Right: Green circle with Bar Chart & Trend */}
                <g transform="translate(208, 66)">
                  <circle cx="14" cy="14" r="12" fill="#ffffff" stroke="#10b981" strokeWidth="2.2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.06))" />
                  <rect x="8" y="15" width="2.5" height="5" rx="0.5" fill="#10b981" />
                  <rect x="12" y="11" width="2.5" height="9" rx="0.5" fill="#10b981" />
                  <rect x="16" y="8" width="2.5" height="12" rx="0.5" fill="#10b981" />
                </g>

                {/* 3. Lower Right: Green coin with % */}
                <g transform="translate(186, 92)">
                  <circle cx="10" cy="10" r="9" fill="#ffffff" stroke="#10b981" strokeWidth="2" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.05))" />
                  <text x="10" y="14" fill="#10b981" fontSize="10" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">%</text>
                </g>

                {/* Decorative pluses, sparkles & dots */}
                <path d="M82 92 L86 92 M84 90 L84 94" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M206 20 L210 20 M208 18 L208 22" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M224 86 L226 86 M225 85 L225 87" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="76" cy="120" r="2.5" fill="#10b981" />
                <circle cx="228" cy="114" r="2.5" fill="#10b981" />
                <circle cx="190" cy="62" r="1.8" fill="#a7f3d0" />
              </svg>
            </div>

            {/* Heading text (verbatim from Image 5) */}
            <h2
              style={{
                fontSize: 17.5,
                fontWeight: 700,
                color: "#1e293b",
                margin: "0 0 22px 0",
                lineHeight: 1.45,
              }}
            >
              Tại đây bạn có thể quản lý các giao dịch bán hàng, ghi nhận doanh thu
            </h2>

            {/* 4 Action Buttons matching Image 5 - spaced out evenly */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
              {/* Button 1: Thêm bằng AI */}
              <button
                type="button"
                onClick={() => {
                  setSelectedVoucher({
                    code: `BH0000${salesVouchers.length + 1}`,
                    saleType: 1,
                    customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
                    customerCode: "KH001",
                    taxCode: "0102345678",
                    address: "Tòa nhà PVN, 18 Láng Hạ, Ba Đình, Hà Nội",
                    contact: "Nguyễn Văn Hùng",
                    salesPerson: "Nguyễn Văn A - Phòng Kinh doanh",
                    date: "29/09/2026",
                    postingDate: "29/09/2026 11:59:38",
                    description: "Bán cáp điện và phụ kiện hạ thế kèm phiếu xuất kho",
                    items: [
                      {
                        id: "ai-item-1",
                        code: "VT001",
                        name: "Cáp ngầm trung thế 24kV Cu/XLPE/PVC/DSTA",
                        unit: "Mét",
                        quantity: 150,
                        tradeDiscount: false,
                        debitAccount: "131",
                        creditAccount: "5111",
                        unitPrice: 285000,
                        amount: 42750000,
                        vatRate: 10,
                        vatAmount: 4275000,
                      },
                      {
                        id: "ai-item-2",
                        code: "VT002",
                        name: "Tủ điện phân phối tổng MSB 630A Schneider",
                        unit: "Bộ",
                        quantity: 1,
                        tradeDiscount: false,
                        debitAccount: "131",
                        creditAccount: "5111",
                        unitPrice: 45000000,
                        amount: 45000000,
                        vatRate: 10,
                        vatAmount: 4500000,
                      },
                    ],
                  });
                  setShowVoucherModal(true);
                  notify("AVA Kế toán đã khởi tạo Chứng từ bán hàng từ gợi ý AI!");
                }}
                style={{
                  height: 36,
                  padding: "0 18px",
                  background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 5,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Sparkles size={12} style={{ color: "#ffffff" }} />
                </div>
                <span>Thêm bằng AI</span>
              </button>

              {/* Button 2: Thêm ▾ (Split Button) */}
              <div style={{ position: "relative", display: "inline-flex" }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVoucher(null);
                    setIsServiceSale(false);
                    setActiveSaleType(1);
                    setShowVoucherModal(true);
                  }}
                  style={{
                    height: 36,
                    padding: "0 18px",
                    background: "#00a862",
                    color: "#ffffff",
                    border: "none",
                    borderTopLeftRadius: 5,
                    borderBottomLeftRadius: 5,
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                  }}
                >
                  <span>Thêm</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowVoucherDropdown(!showVoucherDropdown)}
                  style={{
                    height: 36,
                    padding: "0 8px",
                    background: "#00a862",
                    color: "#ffffff",
                    border: "none",
                    borderLeft: "1px solid rgba(255,255,255,0.3)",
                    borderTopRightRadius: 5,
                    borderBottomRightRadius: 5,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                  }}
                >
                  <ChevronDown size={14} />
                </button>

                {/* Dropdown 5 options */}
                {showVoucherDropdown && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 59 }}
                      onClick={() => setShowVoucherDropdown(false)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: 4,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                        zIndex: 60,
                        minWidth: 260,
                        overflow: "hidden",
                        padding: "4px 0",
                      }}
                    >
                      {[
                        {
                          id: "voucher",
                          label: "Chứng từ bán hàng",
                          action: () => {
                            setSelectedVoucher(null);
                            setIsServiceSale(false);
                            setActiveSaleType(1);
                            setShowVoucherModal(true);
                            setShowVoucherDropdown(false);
                          },
                        },
                        {
                          id: "service",
                          label: "Chứng từ bán dịch vụ",
                          action: () => {
                            setSelectedVoucher(null);
                            setIsServiceSale(true);
                            setActiveSaleType(1);
                            setShowVoucherModal(true);
                            setShowVoucherDropdown(false);
                          },
                        },
                        {
                          id: "collect-single",
                          label: "Thu tiền theo hóa đơn",
                          action: () => {
                            setShowCollectionModal(true);
                            setShowVoucherDropdown(false);
                          },
                        },
                        {
                          id: "collect-multi",
                          label: "Thu tiền theo hóa đơn nhiều khách hàng",
                          action: () => {
                            setShowMultiCollectionModal(true);
                            setShowVoucherDropdown(false);
                          },
                        },
                        {
                          id: "replace-invoice",
                          label: "Hóa đơn thay thế",
                          action: () => {
                            setIsReplacementInvoiceMode(true);
                            setShowInvoiceModal(true);
                            setShowVoucherDropdown(false);
                          },
                        },
                      ].map((opt) => (
                        <div
                          key={opt.id}
                          onClick={opt.action}
                          style={{
                            padding: "9px 16px",
                            fontSize: 13,
                            cursor: "pointer",
                            color: "#1e293b",
                            textAlign: "left",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#eff6ff";
                            e.currentTarget.style.color = "#00a862";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#ffffff";
                            e.currentTarget.style.color = "#1e293b";
                          }}
                        >
                          {opt.label}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Button 3: Nhập từ Excel */}
              <button
                type="button"
                onClick={() => notify("Chọn file Excel danh sách chứng từ bán hàng để nhập khẩu")}
                style={{
                  height: 36,
                  padding: "0 18px",
                  background: "#ffffff",
                  color: "#1e293b",
                  border: "1px solid #cbd5e1",
                  borderRadius: 5,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span>Nhập từ Excel</span>
              </button>

              {/* Button 4: Tiện ích */}
              <button
                type="button"
                onClick={() => notify("Mở danh mục tiện ích mở rộng bán hàng")}
                style={{
                  height: 36,
                  padding: "0 18px",
                  background: "#ffffff",
                  color: "#1e293b",
                  border: "1px solid #cbd5e1",
                  borderRadius: 5,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span>Tiện ích</span>
              </button>
            </div>

            {/* Bottom Link: Xem danh sách chứng từ properly placed in flow */}
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setSalesViewMode("list")}
                style={{
                  height: 36,
                  padding: "0 22px",
                  background: "#ffffff",
                  border: "1px solid #10b981",
                  borderRadius: 4,
                  color: "#00a862",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f0fdf4";
                  e.currentTarget.style.borderColor = "#059669";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#10b981";
                }}
              >
                <span>Xem danh sách chứng từ</span>
              </button>
            </div>
          </div>

          {renderModals()}
        </div>
      );
    }

    // LIST VIEW MODE
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Top Action & Search Bar */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ position: "relative", display: "inline-flex" }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedVoucher(null);
                  setIsServiceSale(false);
                  setActiveSaleType(1);
                  setShowVoucherModal(true);
                }}
                style={{
                  height: 32,
                  padding: "0 14px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderTopLeftRadius: 4,
                  borderBottomLeftRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Plus size={15} />
                <span>Thêm</span>
              </button>

              <button
                type="button"
                onClick={() => setShowVoucherDropdown(!showVoucherDropdown)}
                style={{
                  height: 32,
                  padding: "0 6px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderLeft: "1px solid rgba(255,255,255,0.3)",
                  borderTopRightRadius: 4,
                  borderBottomRightRadius: 4,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <ChevronDown size={14} />
              </button>

              {showVoucherDropdown && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 59 }}
                    onClick={() => setShowVoucherDropdown(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: 4,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      zIndex: 60,
                      minWidth: 260,
                      overflow: "hidden",
                      padding: "4px 0",
                    }}
                  >
                    {[
                      {
                        id: "voucher",
                        label: "Chứng từ bán hàng",
                        action: () => {
                          setSelectedVoucher(null);
                          setIsServiceSale(false);
                          setActiveSaleType(1);
                          setShowVoucherModal(true);
                          setShowVoucherDropdown(false);
                        },
                      },
                      {
                        id: "service",
                        label: "Chứng từ bán dịch vụ",
                        action: () => {
                          setSelectedVoucher(null);
                          setIsServiceSale(true);
                          setActiveSaleType(1);
                          setShowVoucherModal(true);
                          setShowVoucherDropdown(false);
                        },
                      },
                      {
                        id: "collect-single",
                        label: "Thu tiền theo hóa đơn",
                        action: () => {
                          setShowCollectionModal(true);
                          setShowVoucherDropdown(false);
                        },
                      },
                      {
                        id: "collect-multi",
                        label: "Thu tiền theo hóa đơn nhiều khách hàng",
                        action: () => {
                          setShowMultiCollectionModal(true);
                          setShowVoucherDropdown(false);
                        },
                      },
                      {
                        id: "replace-invoice",
                        label: "Hóa đơn thay thế",
                        action: () => {
                          setIsReplacementInvoiceMode(true);
                          setShowInvoiceModal(true);
                          setShowVoucherDropdown(false);
                        },
                      },
                    ].map((opt) => (
                      <div
                        key={opt.id}
                        onClick={opt.action}
                        style={{
                          padding: "9px 16px",
                          fontSize: 13,
                          cursor: "pointer",
                          color: "#1e293b",
                          textAlign: "left",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#eff6ff";
                          e.currentTarget.style.color = "#00a862";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#ffffff";
                          e.currentTarget.style.color = "#1e293b";
                        }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowCollectionModal(true)}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#ffffff",
                color: "#00b06b",
                border: "1px solid #00b06b",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <CreditCard size={15} />
              <span>Thu tiền theo hóa đơn</span>
            </button>

            <button
              type="button"
              onClick={() => notify("Chọn tệp Excel để nhập khẩu")}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Nhập từ Excel
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm kiếm chứng từ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>

            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách chứng từ bán hàng")}
              title="Làm mới"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <RefreshCw size={14} />
            </button>

            <button
              type="button"
              onClick={() => setSalesViewMode("landing")}
              style={{
                height: 30,
                padding: "0 12px",
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>← Giới thiệu</span>
            </button>
          </div>
        </div>

        {/* Sales Transactions Table */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "left" }}>Số chứng từ</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "left" }}>Ngày</th>
                <th style={{ width: 160, padding: "8px 10px", textAlign: "left" }}>Loại chứng từ</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Khách hàng</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Tổng tiền</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Trạng thái TT</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "center" }}>Hóa đơn</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Diễn giải</th>
              </tr>
            </thead>
            <tbody>
              {salesVouchers
                .filter(
                  (v) =>
                    !searchQuery ||
                    v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    v.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()))
                )
                .map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => {
                      setSelectedVoucher(v);
                      setActiveSaleType(v.saleType || 1);
                      setShowVoucherModal(true);
                    }}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                    title="Bấm để xem và sửa chi tiết chứng từ bán hàng"
                  >
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{v.code}</td>
                    <td style={{ padding: "8px 10px" }}>{v.date}</td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>
                      {v.saleType === 2
                        ? "Bán hàng xuất khẩu"
                        : v.saleType === 3
                        ? "Đại lý bán đúng giá"
                        : v.saleType === 4
                        ? "Ủy thác xuất khẩu"
                        : "Bán hàng trong nước"}
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{v.customer}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{formatVND(v.totalPayment || v.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span
                        style={{
                          background: v.status === "Đã thanh toán" ? "#dcfce7" : "#ffedd5",
                          color: v.status === "Đã thanh toán" ? "#15803d" : "#c2410c",
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 11.5,
                          fontWeight: 600,
                        }}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ color: "#059669", fontWeight: 500 }}>Đã xuất HĐ</span>
                    </td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{v.description}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* List Footer Summary */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
          <div>
            Tổng số: <strong>{salesVouchers.length}</strong> chứng từ
          </div>
          <div>
            Tổng tiền bán hàng: <strong style={{ color: "#00a862" }}>{formatVND(salesVouchers.reduce((s, v) => s + (v.totalPayment || v.amount), 0))} đ</strong>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 7. TAB: HÓA ĐƠN (INVOICES - MATCHING USER SCREENSHOT 1 & 2)
  // -------------------------------------------------------------------------
  if (tab === "invoices") {
    // 1. LANDING MODE MATCHING USER SCREENSHOT media_1790740487706.png
    if (invoiceViewMode === "landing") {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            background: "#ffffff",
            padding: "40px 20px",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* SVG Illustration: Invoicing & billing girl at laptop with floating coins */}
          <div style={{ marginBottom: 16 }}>
            <svg width="260" height="170" viewBox="0 0 260 170" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="130" cy="148" rx="100" ry="14" fill="#f1f5f9" />
              {/* Bill / Document */}
              <rect x="75" y="32" width="70" height="96" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
              <rect x="85" y="44" width="30" height="5" rx="2.5" fill="#e2e8f0" />
              <rect x="85" y="55" width="50" height="3" rx="1.5" fill="#f1f5f9" />
              <rect x="85" y="63" width="45" height="3" rx="1.5" fill="#f1f5f9" />
              <rect x="85" y="71" width="35" height="3" rx="1.5" fill="#f1f5f9" />
              {/* Dollar / Dong badge on doc */}
              <circle cx="120" cy="46" r="10" fill="#00a862" />
              <text x="120" y="50" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">$</text>
              {/* Plus badge */}
              <circle cx="95" cy="100" r="7" fill="#00b06b" />
              <path d="M95 96 V104 M91 100 H99" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
              {/* Woman at laptop */}
              <circle cx="165" cy="80" r="14" fill="#64748b" />
              <path d="M151 116 C151 100 179 100 179 116 Z" fill="#00a862" />
              <rect x="145" y="104" width="36" height="22" rx="3" fill="#cbd5e1" />
              <path d="M140 126 H186" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
              {/* Floating coins */}
              <circle cx="185" cy="55" r="7" fill="#10b981" />
              <circle cx="205" cy="72" r="9" fill="#059669" />
              <text x="205" y="76" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">$</text>
            </svg>
          </div>

          {/* Heading verbatim from screenshot */}
          <h2
            style={{
              fontSize: 17.5,
              fontWeight: 700,
              color: "#1e293b",
              margin: "0 0 24px 0",
              textAlign: "center",
            }}
          >
            Lập, phát hành hóa đơn và quản lý các hóa đơn bán hàng đã xuất cho khách hàng
          </h2>

          {/* Action buttons: Thêm ▾ (split button) | Nhập từ Excel */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div style={{ position: "relative", display: "inline-flex" }}>
              <button
                type="button"
                onClick={() => {
                  setIsReplacementInvoiceMode(false);
                  setShowInvoiceModal(true);
                }}
                style={{
                  height: 36,
                  padding: "0 18px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderTopLeftRadius: 5,
                  borderBottomLeftRadius: 5,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                }}
              >
                <span>Thêm</span>
              </button>

              <button
                type="button"
                onClick={() => setShowInvoiceDropdown(!showInvoiceDropdown)}
                style={{
                  height: 36,
                  padding: "0 8px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderLeft: "1px solid rgba(255,255,255,0.3)",
                  borderTopRightRadius: 5,
                  borderBottomRightRadius: 5,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                }}
              >
                <ChevronDown size={14} />
              </button>

              {/* Dropdown 5 options matching user screenshot media_1790740487706.png */}
              {showInvoiceDropdown && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 59 }}
                    onClick={() => setShowInvoiceDropdown(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: 4,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      zIndex: 60,
                      minWidth: 220,
                      overflow: "hidden",
                      padding: "4px 0",
                    }}
                  >
                    {[
                      {
                        id: "inv-regular",
                        label: "Hóa đơn",
                        action: () => {
                          setIsReplacementInvoiceMode(false);
                          setShowInvoiceModal(true);
                          setShowInvoiceDropdown(false);
                        },
                      },
                      {
                        id: "inv-adj",
                        label: "Hóa đơn điều chỉnh",
                        action: () => {
                          setShowInvoiceAdjustmentModal(true);
                          setShowInvoiceDropdown(false);
                        },
                      },
                      {
                        id: "inv-disc",
                        label: "Hóa đơn chiết khấu",
                        action: () => {
                          setShowInvoiceDiscountModal(true);
                          setShowInvoiceDropdown(false);
                        },
                      },
                      {
                        id: "inv-replace",
                        label: "Hóa đơn thay thế",
                        action: () => {
                          setIsReplacementInvoiceMode(true);
                          setShowInvoiceModal(true);
                          setShowInvoiceDropdown(false);
                        },
                      },
                      {
                        id: "inv-commercial",
                        label: "Hóa đơn thương mại",
                        action: () => {
                          setShowCommercialInvoiceModal(true);
                          setShowInvoiceDropdown(false);
                        },
                      },
                    ].map((opt) => (
                      <div
                        key={opt.id}
                        onClick={opt.action}
                        style={{
                          padding: "9px 16px",
                          fontSize: 13,
                          cursor: "pointer",
                          color: "#1e293b",
                          textAlign: "left",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#eff6ff";
                          e.currentTarget.style.color = "#00a862";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#ffffff";
                          e.currentTarget.style.color = "#1e293b";
                        }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => notify("Đang chuẩn bị mẫu Excel hóa đơn bán hàng...")}
              style={{
                height: 36,
                padding: "0 18px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 500,
                color: "#334155",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              Nhập từ Excel
            </button>
          </div>

          {/* Bottom pill button: Xem danh sách chứng từ */}
          <button
            type="button"
            onClick={() => setInvoiceViewMode("list")}
            style={{
              marginTop: 48,
              height: 32,
              padding: "0 20px",
              background: "#ffffff",
              border: "1px solid #00a862",
              borderRadius: 16,
              fontSize: 12.5,
              fontWeight: 600,
              color: "#00a862",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f0fdf4";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ffffff";
            }}
          >
            Xem danh sách chứng từ
          </button>

          {renderModals()}
        </div>
      );
    }

    // 2. LIST VIEW MODE
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Split Button Thêm ▾ */}
            <div style={{ position: "relative", display: "inline-flex" }}>
              <button
                type="button"
                onClick={() => {
                  setIsReplacementInvoiceMode(false);
                  setShowInvoiceModal(true);
                }}
                style={{
                  height: 32,
                  padding: "0 14px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderTopLeftRadius: 4,
                  borderBottomLeftRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Plus size={15} />
                <span>Thêm</span>
              </button>

              <button
                type="button"
                onClick={() => setShowInvoiceDropdown(!showInvoiceDropdown)}
                style={{
                  height: 32,
                  padding: "0 6px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderLeft: "1px solid rgba(255,255,255,0.3)",
                  borderTopRightRadius: 4,
                  borderBottomRightRadius: 4,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <ChevronDown size={14} />
              </button>

              {showInvoiceDropdown && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 59 }}
                    onClick={() => setShowInvoiceDropdown(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: 4,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      zIndex: 60,
                      minWidth: 220,
                      overflow: "hidden",
                      padding: "4px 0",
                    }}
                  >
                    {[
                      {
                        id: "inv-regular",
                        label: "Hóa đơn",
                        action: () => {
                          setIsReplacementInvoiceMode(false);
                          setShowInvoiceModal(true);
                          setShowInvoiceDropdown(false);
                        },
                      },
                      {
                        id: "inv-adj",
                        label: "Hóa đơn điều chỉnh",
                        action: () => {
                          setShowInvoiceAdjustmentModal(true);
                          setShowInvoiceDropdown(false);
                        },
                      },
                      {
                        id: "inv-disc",
                        label: "Hóa đơn chiết khấu",
                        action: () => {
                          setShowInvoiceDiscountModal(true);
                          setShowInvoiceDropdown(false);
                        },
                      },
                      {
                        id: "inv-replace",
                        label: "Hóa đơn thay thế",
                        action: () => {
                          setIsReplacementInvoiceMode(true);
                          setShowInvoiceModal(true);
                          setShowInvoiceDropdown(false);
                        },
                      },
                      {
                        id: "inv-commercial",
                        label: "Hóa đơn thương mại",
                        action: () => {
                          setShowCommercialInvoiceModal(true);
                          setShowInvoiceDropdown(false);
                        },
                      },
                    ].map((opt) => (
                      <div
                        key={opt.id}
                        onClick={opt.action}
                        style={{
                          padding: "9px 16px",
                          fontSize: 13,
                          cursor: "pointer",
                          color: "#1e293b",
                          textAlign: "left",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#eff6ff";
                          e.currentTarget.style.color = "#00a862";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#ffffff";
                          e.currentTarget.style.color = "#1e293b";
                        }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => notify("Đang mở chức năng nhập hóa đơn từ file Excel...")}
              style={{
                height: 32,
                padding: "0 12px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                background: "#ffffff",
                fontSize: 12.5,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Nhập từ Excel
            </button>

            <button
              type="button"
              onClick={() => setInvoiceViewMode("landing")}
              style={{
                height: 32,
                padding: "0 12px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                background: "#ffffff",
                fontSize: 12.5,
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              Quay lại quy trình
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm kiếm hóa đơn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>
            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách hóa đơn")}
              title="Làm mới"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Invoices Table Grid */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px" }}>Số hóa đơn</th>
                <th style={{ width: 90, padding: "8px 10px", textAlign: "center" }}>Ký hiệu</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày HĐ</th>
                <th style={{ padding: "8px 10px" }}>Khách hàng</th>
                <th style={{ width: 110, padding: "8px 10px" }}>Mã số thuế</th>
                <th style={{ padding: "8px 10px" }}>Loại hóa đơn</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng tiền hàng</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "right" }}>Thuế GTGT</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng thanh toán</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {invoices
                .filter(
                  (inv) =>
                    !searchQuery ||
                    inv.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    inv.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    inv.series.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => {
                      if (inv.type === "Hóa đơn chiết khấu") {
                        setShowInvoiceDiscountModal(true);
                      } else if (inv.type === "Hóa đơn thương mại") {
                        setShowCommercialInvoiceModal(true);
                      } else if (inv.type === "Hóa đơn điều chỉnh") {
                        setShowInvoiceAdjustmentModal(true);
                      } else {
                        setShowInvoiceModal(true);
                      }
                    }}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                    title="Bấm để xem và sửa chi tiết hóa đơn bán hàng"
                  >
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{inv.code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", color: "#475569" }}>{inv.series}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{inv.date}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{inv.customer}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{inv.taxCode}</td>
                    <td style={{ padding: "8px 10px", color: "#475569", fontSize: 12 }}>{inv.type}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatVND(inv.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>{formatVND(inv.vat)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#059669" }}>{formatVND(inv.total)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span
                        style={{
                          background: inv.status === "Đã phát hành" ? "#dcfce7" : "#f1f5f9",
                          color: inv.status === "Đã phát hành" ? "#15803d" : "#475569",
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
          <div>
            Tổng số: <strong>{invoices.length}</strong> hóa đơn
          </div>
          <div>
            Tổng tiền thanh toán: <strong style={{ color: "#00a862" }}>{formatVND(invoices.reduce((s, i) => s + i.total, 0))} đ</strong>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 8. TAB: TRẢ LẠI HÀNG BÁN (RETURNS - BTL00001)
  // -------------------------------------------------------------------------
  if (tab === "returns") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowReturnModal(true)}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#00b06b",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={15} />
              <span>Thêm chứng từ trả lại hàng bán</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm kiếm chứng từ trả lại..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>
            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách trả lại hàng bán")}
              title="Làm mới"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Returns Table Grid */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px" }}>Số chứng từ</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày hạch toán</th>
                <th style={{ width: 160, padding: "8px 10px" }}>Biểu mẫu</th>
                <th style={{ padding: "8px 10px" }}>Khách hàng</th>
                <th style={{ padding: "8px 10px" }}>Lý do trả lại</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng tiền hàng</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "right" }}>Thuế GTGT</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng hoàn trả</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Phương thức</th>
              </tr>
            </thead>
            <tbody>
              {returns
                .filter(
                  (ret) =>
                    !searchQuery ||
                    ret.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    ret.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    ret.reason.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((ret) => (
                  <tr
                    key={ret.id}
                    onClick={() => setShowReturnModal(true)}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                    title="Bấm để xem và sửa chi tiết chứng từ bán hàng bị trả lại"
                  >
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{ret.code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{ret.date}</td>
                    <td style={{ padding: "8px 10px", color: "#475569", fontWeight: 500 }}>{ret.type}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{ret.customer}</td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>{ret.reason}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatVND(ret.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>{formatVND(ret.vat)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{formatVND(ret.total)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: "#ffedd5", color: "#c2410c", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{ret.status}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
          <div>
            Tổng số: <strong>{returns.length}</strong> chứng từ trả lại
          </div>
          <div>
            Tổng tiền hoàn trả: <strong style={{ color: "#dc2626" }}>{formatVND(returns.reduce((s, r) => s + r.total, 0))} đ</strong>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 9. TAB: GIẢM GIÁ HÀNG BÁN (DISCOUNTS - BGG00001)
  // -------------------------------------------------------------------------
  if (tab === "discounts") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowDiscountModal(true)}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#00b06b",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={15} />
              <span>Thêm chứng từ giảm giá hàng bán</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input
                type="text"
                placeholder="Tìm kiếm chứng từ giảm giá..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
              />
            </div>
            <button
              type="button"
              onClick={() => notify("Đã làm mới danh sách giảm giá hàng bán")}
              title="Làm mới"
              style={{
                width: 30,
                height: 30,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Discounts Table Grid */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px" }}>Số chứng từ</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày hạch toán</th>
                <th style={{ width: 160, padding: "8px 10px" }}>Biểu mẫu</th>
                <th style={{ padding: "8px 10px" }}>Khách hàng</th>
                <th style={{ padding: "8px 10px" }}>Lý do giảm giá</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng tiền giảm</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "right" }}>Thuế GTGT</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng giảm trừ</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Phương thức</th>
              </tr>
            </thead>
            <tbody>
              {discounts
                .filter(
                  (disc) =>
                    !searchQuery ||
                    disc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    disc.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    disc.reason.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((disc) => (
                  <tr
                    key={disc.id}
                    onClick={() => setShowDiscountModal(true)}
                    style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                    title="Bấm để xem và sửa chi tiết chứng từ giảm giá hàng bán"
                  >
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{disc.code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{disc.date}</td>
                    <td style={{ padding: "8px 10px", color: "#475569", fontWeight: 500 }}>{disc.type}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{disc.customer}</td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>{disc.reason}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatVND(disc.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>{formatVND(disc.vat)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#ea580c" }}>{formatVND(disc.total)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: "#ffedd5", color: "#c2410c", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{disc.status}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
          <div>
            Tổng số: <strong>{discounts.length}</strong> chứng từ giảm giá
          </div>
          <div>
            Tổng tiền giảm giá: <strong style={{ color: "#ea580c" }}>{formatVND(discounts.reduce((s, d) => s + d.total, 0))} đ</strong>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 10. TAB: BÁO CÁO (REPORTS)
  // -------------------------------------------------------------------------
  if (tab === "reports") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <strong style={{ fontSize: 14, color: "#1e293b" }}>Báo cáo bán hàng</strong>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240 }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input type="text" placeholder="Tìm kiếm báo cáo..." style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }} />
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {[
              { title: "Sổ chi tiết bán hàng", desc: "Theo dõi doanh thu, chiết khấu và thuế theo từng hóa đơn, chứng từ", count: "128 dòng" },
              { title: "Bảng kê hóa đơn, chứng từ bán ra", desc: "Tổng hợp toàn bộ hóa đơn GTGT đầu ra theo kỳ kê khai thuế", count: "45 hóa đơn" },
              { title: "Báo cáo công nợ phải thu khách hàng", desc: "Theo dõi số dư nợ 131, hạn thanh toán và tuổi nợ theo khách hàng", count: "2 khách hàng" },
              { title: "Báo cáo lãi lỗ theo đơn đặt hàng / hợp đồng", desc: "Phân tích doanh thu, giá vốn và tỷ suất lợi nhuận gộp", count: "8 hợp đồng" },
              { title: "Tổng hợp bán hàng theo mặt hàng", desc: "Thống kê số lượng xuất bán, đơn giá bình quân và doanh thu theo mã hàng", count: "6 mặt hàng" },
              { title: "Biên bản đối chiếu và xác nhận công nợ", desc: "Mẫu in biên bản đối chiếu gửi khách hàng ký xác nhận số dư", count: "Mẫu chuẩn MISA" },
            ].map((rep, idx) => (
              <div
                key={idx}
                onClick={() => notify(`Đang mở ${rep.title}...`)}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "14px 16px",
                  background: "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#00b06b";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 176, 107, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: 13.5, color: "#1e293b", fontWeight: 600 }}>{rep.title}</h4>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>{rep.desc}</p>
                </div>
                <div style={{ marginTop: 12, fontSize: 11.5, color: "#00b06b", fontWeight: 500 }}>{rep.count}</div>
              </div>
            ))}
          </div>
        </div>
        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 11. TAB: CÔNG NỢ (RECEIVABLES)
  // -------------------------------------------------------------------------
  if (tab === "receivables") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowCollectionModal(true)}
              style={{ height: 32, padding: "0 14px", background: "#00b06b", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <CreditCard size={15} />
              <span>Thu tiền theo hóa đơn</span>
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240 }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input type="text" placeholder="Tìm theo khách hàng..." style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }} />
            </div>
            <button type="button" onClick={() => notify("Đã làm mới công nợ khách hàng")} style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer" }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 110, padding: "8px 10px" }}>Mã KH</th>
                <th style={{ minWidth: 200, padding: "8px 10px" }}>Tên khách hàng</th>
                <th style={{ width: 120, padding: "8px 10px" }}>Mã số thuế</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Nợ đầu kỳ</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Phát sinh nợ (bán)</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Phát sinh có (thu)</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Dư nợ cuối kỳ (131)</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "center" }}>Hạn nợ</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{c.code}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: "8px 10px", color: "#64748b" }}>{c.taxCode}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>0 đ</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#059669" }}>{formatVND(c.debt || 64000000)} đ</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#0284c7" }}>0 đ</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: (c.debt || 0) > 0 ? "#ea580c" : "#059669" }}>
                    {formatVND(c.debt || 0)} đ
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>30 ngày</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 12. TAB: ĐỐI CHIẾU CÔNG NỢ (RECONCILIATION)
  // -------------------------------------------------------------------------
  if (tab === "reconciliation") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={() => notify("Đang tạo kỳ đối chiếu công nợ mới...")}
            style={{ height: 32, padding: "0 14px", background: "#00b06b", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={15} />
            <span>Lập biên bản đối chiếu</span>
          </button>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 110, padding: "8px 10px" }}>Kỳ đối chiếu</th>
                <th style={{ minWidth: 200, padding: "8px 10px" }}>Khách hàng</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Tài khoản</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Số liệu sổ sách</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Số liệu khách hàng</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "right" }}>Chênh lệch</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 10px", fontWeight: 600 }}>Tháng 09/2026</td>
                <td style={{ padding: "8px 10px", fontWeight: 500 }}>Công ty Cổ phần Xây lắp Dầu khí Đông Đô</td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>131</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>64.000.000 đ</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>64.000.000 đ</td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "#059669" }}>0 đ</td>
                <td style={{ padding: "8px 10px", textAlign: "center" }}>
                  <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Khớp đúng 100%</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 13. TAB: HÀNG HÓA, DỊCH VỤ (INVENTORY-ITEMS - MATCHING USER SCREENSHOTS)
  // -------------------------------------------------------------------------
  if (tab === "inventory-items") {
    const filteredItems = inventoryItemsList.filter((it) =>
      it.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) ||
      it.code.toLowerCase().includes(inventorySearchQuery.toLowerCase())
    );

    const totalStockQty = filteredItems.reduce((acc, curr) => acc + curr.stockQuantity, 0);
    const totalStockVal = filteredItems.reduce((acc, curr) => acc + curr.stockValue, 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Top breadcrumb */}
        <div
          style={{ padding: "10px 16px 4px", display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#0284c7", cursor: "pointer" }}
          onClick={() => notify("Đang lấy lại danh mục...")}
        >
          <ChevronLeft size={16} />
          <span style={{ fontWeight: 500 }}>Lấy lại danh mục</span>
        </div>

        {/* Stat cards section (2 cards: Sắp hết hàng & Hết hàng) */}
        {!statCardsCollapsed && (
          <div style={{ padding: "6px 16px 8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Card 1: Hàng hóa sắp hết hàng (Orange) */}
            <div style={{ border: "1px solid #f97316", borderRadius: 6, background: "#ffffff", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: "#ffedd5", display: "grid", placeItems: "center", color: "#ea580c" }}>
                  <Package size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, color: "#475569" }}>Hàng hóa sắp hết hàng</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#ea580c", lineHeight: 1.2 }}>0</div>
                </div>
                <button
                  type="button"
                  onClick={() => notify("Đang lọc danh sách hàng hóa sắp hết hàng...")}
                  style={{
                    background: "#334155",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 500,
                    border: "none",
                    borderRadius: 4,
                    padding: "3px 8px",
                    marginLeft: 10,
                    cursor: "pointer",
                  }}
                >
                  Bấm vào để lọc
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8" }}>
                <Clock size={13} />
                <span>11:36</span>
              </div>
            </div>

            {/* Card 2: Hàng hóa hết hàng (Red) */}
            <div style={{ border: "1px solid #f43f5e", borderRadius: 6, background: "#ffffff", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 6, background: "#ffe4e6", display: "grid", placeItems: "center", color: "#e11d48" }}>
                  <Ban size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, color: "#475569" }}>Hàng hóa hết hàng</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#e11d48", lineHeight: 1.2 }}>0</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8" }}>
                <Clock size={13} />
                <span>11:36</span>
              </div>
            </div>
          </div>
        )}

        {/* Toggle collapse stat cards */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: -6, marginBottom: 4 }}>
          <button
            type="button"
            onClick={() => setStatCardsCollapsed(!statCardsCollapsed)}
            title={statCardsCollapsed ? "Mở rộng bảng thống kê tồn kho" : "Thu gọn bảng thống kê tồn kho"}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "50%",
              width: 18,
              height: 18,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "#64748b",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            {statCardsCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ padding: "6px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Search input */}
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 220, background: "#ffffff" }}>
            <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
            <input
              type="text"
              value={inventorySearchQuery}
              onChange={(e) => setInventorySearchQuery(e.target.value)}
              placeholder="Tìm kiếm"
              style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%", background: "transparent" }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              onClick={() => notify("Đã làm mới danh mục hàng hóa dịch vụ")}
              title="Làm mới"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#475569" }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              type="button"
              onClick={() => notify("Tùy chỉnh cột hiển thị")}
              title="Tùy chỉnh cột"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#475569" }}
            >
              <SlidersHorizontal size={14} />
            </button>
            <button
              type="button"
              onClick={() => notify("Toàn màn hình / Thu nhỏ")}
              title="Toàn màn hình"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#475569" }}
            >
              <Maximize2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => notify("Nhân bản hàng hóa dịch vụ")}
              title="Nhân bản"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#475569" }}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={() => notify("Thiết lập hàng hóa dịch vụ")}
              title="Thiết lập"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#475569" }}
            >
              <Settings size={14} />
            </button>
            <button
              type="button"
              onClick={() => notify("Bộ lọc nâng cao")}
              title="Bộ lọc"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#475569" }}
            >
              <Filter size={14} />
            </button>

            {/* Main green Thêm button with split chevron */}
            <button
              type="button"
              onClick={() => setShowNatureDrawer(true)}
              style={{
                height: 30,
                padding: "0 12px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>Thêm</span>
              <ChevronDown size={14} />
            </button>

            {/* More options button */}
            <button
              type="button"
              onClick={() => notify("Tùy chọn khác")}
              title="Tùy chọn khác"
              style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#475569" }}
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, padding: "8px 10px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedInventoryItems.length === filteredItems.length && filteredItems.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedInventoryItems(filteredItems.map((it) => it.id));
                      } else {
                        setSelectedInventoryItems([]);
                      }
                    }}
                    style={{ accentColor: "#00a862", cursor: "pointer" }}
                  />
                </th>
                <th style={{ minWidth: 260, padding: "8px 10px", textAlign: "left" }}>Tên</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "left" }}>Mã</th>
                <th style={{ width: 220, padding: "8px 10px", textAlign: "left" }}>Giảm thuế theo quy định</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "left" }}>Tính chất</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "right" }}>Số lượng tồn</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "right" }}>Giá trị tồn</th>
                <th style={{ width: 90, padding: "8px 10px", textAlign: "center" }}>Chức năng</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => (
                <tr key={it.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedInventoryItems.includes(it.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInventoryItems([...selectedInventoryItems, it.id]);
                        } else {
                          setSelectedInventoryItems(selectedInventoryItems.filter((id) => id !== it.id));
                        }
                      }}
                      style={{ accentColor: "#00a862", cursor: "pointer" }}
                    />
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 500, color: "#1e293b" }}>{it.name}</td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>{it.code}</td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span>{it.taxReduction}</span>
                      <FileSpreadsheet size={15} style={{ color: "#16a34a" }} />
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>{it.nature}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    {it.stockQuantity.toFixed(2).replace(".", ",")}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    {it.stockValue.toLocaleString("vi-VN")}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}>
                      <span onClick={() => notify(`Xem và sửa thông tin ${it.name}`)}>Sửa</span>
                      <ChevronDown size={13} onClick={() => notify(`Tùy chọn: Xóa / Ngừng theo dõi ${it.name}`)} />
                    </div>
                  </td>
                </tr>
              ))}

              {/* Summary Row */}
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 700 }}>
                <td style={{ padding: "8px 10px" }}></td>
                <td style={{ padding: "8px 10px", color: "#1e293b" }}>Tổng</td>
                <td style={{ padding: "8px 10px" }}></td>
                <td style={{ padding: "8px 10px" }}></td>
                <td style={{ padding: "8px 10px" }}></td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>
                  {totalStockQty.toFixed(2).replace(".", ",")}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>
                  {totalStockVal.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "8px 10px" }}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", fontSize: 13, color: "#475569" }}>
          <div>
            Tổng số: <strong>{filteredItems.length}</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Số dòng/trang</span>
              <select style={{ height: 26, border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 6px", fontSize: 12, outline: "none" }}>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>|&lt;</button>
              <button style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>&lt;</button>
              <span style={{ padding: "0 6px", fontWeight: 600, color: "#00a862" }}>1</span>
              <button style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>&gt;</button>
              <button style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>&gt;|</button>
            </div>
          </div>
        </div>

        {/* Nature Drawer for Adding New Item */}
        <MisaItemNatureDrawer
          isOpen={showNatureDrawer}
          onClose={() => setShowNatureDrawer(false)}
          onSelectNature={(natureId, natureName) => {
            notify(`Đã chọn tính chất: ${natureName}`);
            setShowNatureDrawer(false);
            const newCode = `HH${String(inventoryItemsList.length + 1).padStart(4, "0")}`;
            setInventoryItemsList((prev) => [
              ...prev,
              {
                id: `item-${Date.now()}`,
                name: `${natureName} mới`,
                code: newCode,
                taxReduction: "Chưa xác định",
                nature: natureName,
                stockQuantity: 0.0,
                stockValue: 0,
              },
            ]);
          }}
          notify={notify}
        />

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 14. TAB: KHÁCH HÀNG (CUSTOMERS - MATCHING USER SCREENSHOT)
  // -------------------------------------------------------------------------
  if (tab === "customers") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Breadcrumb matching user screenshot */}
        <div style={{ padding: "10px 16px 4px", display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#0284c7", cursor: "pointer" }} onClick={() => notify("Quay lại Tất cả danh mục")}>
          <ChevronLeft size={16} />
          <span style={{ fontWeight: 500 }}>Tất cả danh mục</span>
        </div>

        <div style={{ padding: "8px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              style={{ height: 32, padding: "0 14px", background: "#00b06b", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={15} />
              <span>Thêm</span>
            </button>
            <button
              type="button"
              onClick={() => notify("Nhập khẩu danh sách khách hàng từ Excel...")}
              style={{ height: 32, padding: "0 14px", background: "#ffffff", color: "#1e293b", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
            >
              Nhập từ Excel
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240 }}>
              <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
              <input type="text" placeholder="Tìm theo tên, MST, SĐT..." style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }} />
            </div>
            <button type="button" onClick={() => notify("Đã làm mới danh sách khách hàng")} style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer" }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 110, padding: "8px 10px" }}>Mã khách hàng</th>
                <th style={{ minWidth: 200, padding: "8px 10px" }}>Tên khách hàng</th>
                <th style={{ width: 120, padding: "8px 10px" }}>Mã số thuế</th>
                <th style={{ padding: "8px 10px" }}>Địa chỉ</th>
                <th style={{ width: 120, padding: "8px 10px" }}>Điện thoại</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Dư nợ (131)</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{c.code}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: "8px 10px", color: "#64748b" }}>{c.taxCode}</td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>{c.address}</td>
                  <td style={{ padding: "8px 10px" }}>{c.phone}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: (c.debt || 0) > 0 ? "#ea580c" : "#059669" }}>
                    {formatVND(c.debt || 0)} đ
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer button matching user screenshot */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "center", background: "#f8fafc" }}>
          <button
            type="button"
            onClick={() => notify("Mở danh sách chứng từ bán hàng liên quan...")}
            style={{
              padding: "6px 20px",
              background: "#ffffff",
              border: "1px solid #00a862",
              color: "#00a862",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Xem danh sách chứng từ
          </button>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 15. TAB: TỰ ĐỘNG HẠCH TOÁN HĐ (AUTO-POSTING)
  // -------------------------------------------------------------------------
  if (tab === "auto-posting") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={() => notify("Kết nối meInvoice tự động hạch toán hóa đơn...")}
            style={{ height: 32, padding: "0 14px", background: "#00b06b", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Sparkles size={15} />
            <span>Đồng bộ từ meInvoice</span>
          </button>
        </div>
        <div style={{ flex: 1, padding: 20, color: "#64748b", textAlign: "center" }}>
          <div style={{ maxWidth: 480, margin: "40px auto" }}>
            <Sparkles size={40} style={{ color: "#00b06b", marginBottom: 12 }} />
            <h3 style={{ fontSize: 16, color: "#1e293b", margin: "0 0 8px 0" }}>Tự động hạch toán Hóa đơn bán hàng MISA meInvoice</h3>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              Hệ thống tự động đồng bộ hóa đơn đầu ra mới nhất từ meInvoice, tự động nhận diện khách hàng và sinh chứng từ bán hàng theo thiết lập sẵn.
            </p>
          </div>
        </div>
        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 16. DEFAULT / OTHER TABS (fallback)
  // -------------------------------------------------------------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setSelectedVoucher(null);
              setActiveSaleType(1);
              setShowVoucherModal(true);
            }}
            style={{ height: 32, padding: "0 14px", background: "#00b06b", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={15} />
            <span>Thêm chứng từ bán hàng</span>
          </button>
        </div>
      </div>
      <div style={{ padding: 20, color: "#64748b" }}>
        Nội dung phân hệ Bán hàng - {tab}
      </div>
      {renderModals()}
    </div>
  );
}
