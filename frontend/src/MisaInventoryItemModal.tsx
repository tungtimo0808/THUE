import React, { useState, useEffect } from "react";
import {
  X,
  HelpCircle,
  Package,
  Briefcase,
  Layers,
  Boxes,
  Tag,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  Edit2,
  Info,
  MoreHorizontal,
  Bot,
} from "lucide-react";

export interface BomItem {
  id: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number | string;
  costItem: string;
}

export interface ComboDetailItem {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number | string;
}

export interface InventoryItemData {
  id?: string;
  name: string;
  code: string;
  vatPolicy: string;
  nature: string;
  stockQty: number;
  stockValue: number;
  unit?: string;
  group?: string;
  vthhGroups?: string[];
  warrantyPeriod?: string;
  warrantyUnit?: string;
  minStockQty?: number | string;
  origin?: string;
  description?: string;
  purchaseDescription?: string;
  saleDescription?: string;
  specialType?: string;
  imageUrl?: string;

  // Accordion 1: Thông tin ngầm định
  warehouse?: string;
  stockAccount?: string;
  revenueAccount?: string;
  discountAccount?: string;
  priceReductionAccount?: string;
  returnAccount?: string;
  costAccount?: string;
  purchaseDiscountRate?: number | string;
  fixedPurchasePrice?: number | string;
  latestPurchasePrice?: number | string;
  salePrice?: number | string;
  vatRate?: string;
  importTaxRate?: number | string;
  exportTaxRate?: number | string;
  exciseGroup?: string;

  // Accordion 2 (Hàng hóa): Chiết khấu bán hàng
  discountType?: string;
  discountTiers?: Array<{
    id: string;
    fromQty: number;
    toQty: number;
    discountPercent: number;
  }>;

  // Accordion 3 (Hàng hóa): Đơn vị chuyển đổi
  conversionUnits?: Array<{
    id: string;
    unit: string;
    rate: number | string;
    operator: "Nhân" | "Chia";
    description: string;
    salePrice1: number | string;
  }>;

  // Accordion 4 (Thành phẩm): Định mức nguyên vật liệu
  bomItems?: BomItem[];

  // Mặt hàng chi tiết (Combo sản phẩm)
  comboItems?: ComboDetailItem[];

  // Accordion 5 (Hàng hóa): Công thức tính số lượng
  formulaType?: string;
  formulaExpression?: string;

  // Accordion 2 (Dịch vụ): Đơn vị tính khác
  serviceUnits?: Array<{
    id: string;
    unit: string;
  }>;

  // Accordion 3 (Dịch vụ): Các trường mở rộng 1-5
  customField1?: string;
  customField2?: string;
  customField3?: string;
  customField4?: string;
  customField5?: string;

  // Accordion 5 (Hàng hóa): Thông tin bổ sung
  barcode?: string;
  specification?: string;
  primarySupplier?: string;
}

interface MisaInventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNature?: string;
  editingItem?: InventoryItemData | null;
  onSubmit: (item: InventoryItemData, keepOpen?: boolean) => void;
  onChangeNature?: () => void;
  notify?: (msg: string) => void;
}

export const ITEM_NATURE_DEFAULTS: Record<
  string,
  {
    prefix: string;
    defaultGroup: string;
    warehouse: string;
    stockAccount: string;
    revenueAccount: string;
    costAccount: string;
    defaultUnit: string;
    icon: React.ReactNode;
  }
> = {
  "Hàng hóa": {
    prefix: "VT",
    defaultGroup: "HH",
    warehouse: "1561 - Kho hàng hóa",
    stockAccount: "156",
    revenueAccount: "5111",
    costAccount: "632",
    defaultUnit: "Cái",
    icon: <Package size={17} color="#ffffff" />,
  },
  "Dịch vụ": {
    prefix: "VT",
    defaultGroup: "DV",
    warehouse: "",
    stockAccount: "",
    revenueAccount: "5113",
    costAccount: "632",
    defaultUnit: "",
    icon: <Briefcase size={17} color="#ffffff" />,
  },
  "Nguyên vật liệu": {
    prefix: "VT",
    defaultGroup: "NVL",
    warehouse: "",
    stockAccount: "152A",
    revenueAccount: "5111",
    costAccount: "621",
    defaultUnit: "",
    icon: <Layers size={17} color="#ffffff" />,
  },
  "Thành phẩm": {
    prefix: "VT",
    defaultGroup: "TP",
    warehouse: "",
    stockAccount: "155",
    revenueAccount: "5112",
    costAccount: "632",
    defaultUnit: "",
    icon: <Boxes size={17} color="#ffffff" />,
  },
  "Công cụ dụng cụ": {
    prefix: "VT",
    defaultGroup: "CCDC",
    warehouse: "",
    stockAccount: "153",
    revenueAccount: "5111",
    costAccount: "632",
    defaultUnit: "",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 5l-4 4m2-4a2.8 2.8 0 0 0-4 0l-9 9a2 2 0 0 0 0 3l2 2a2 2 0 0 0 3 0l9-9a2.8 2.8 0 0 0 0-4z" />
        <path d="M5 5l4 4m-2-4a2.8 2.8 0 0 1 4 0l9 9a2 2 0 0 1 0 3l-2 2a2 2 0 0 1-3 0l-9-9a2.8 2.8 0 0 1 0-4z" />
      </svg>
    ),
  },
  "Combo sản phẩm": {
    prefix: "VT",
    defaultGroup: "",
    warehouse: "",
    stockAccount: "",
    revenueAccount: "5111",
    costAccount: "",
    defaultUnit: "",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="3" width="14" height="18" rx="4" />
        <circle cx="12" cy="7.5" r="1.5" fill="#ffffff" />
      </svg>
    ),
  },
};

export const MisaInventoryItemModal: React.FC<MisaInventoryItemModalProps> = ({
  isOpen,
  onClose,
  initialNature = "Hàng hóa",
  editingItem = null,
  onSubmit,
  onChangeNature,
  notify = () => {},
}) => {
  // Top fields
  const [nature, setNature] = useState(initialNature);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [vthhGroups, setVthhGroups] = useState<string[]>(["HH"]);
  const [unit, setUnit] = useState("Cái");
  const [vatPolicy, setVatPolicy] = useState("Chưa xác định");
  const [warrantyPeriod, setWarrantyPeriod] = useState("");
  const [warrantyUnit, setWarrantyUnit] = useState("Tháng");
  const [warrantyExtra, setWarrantyExtra] = useState("");
  const [minStockQty, setMinStockQty] = useState<number | string>("");
  const [origin, setOrigin] = useState("");
  const [description, setDescription] = useState("");
  const [purchaseDescription, setPurchaseDescription] = useState("");
  const [saleDescription, setSaleDescription] = useState("");
  const [specialType, setSpecialType] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Accordion open/close state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    defaults: false,
    discount: false,
    conversion: false,
    bom: false,
    formula: false,
    additional: false,
    serviceUnits: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Section 1: Thông tin ngầm định
  const [warehouse, setWarehouse] = useState("");
  const [stockAccount, setStockAccount] = useState("156");
  const [revenueAccount, setRevenueAccount] = useState("5111");
  const [discountAccount, setDiscountAccount] = useState("5211");
  const [priceReductionAccount, setPriceReductionAccount] = useState("5213");
  const [returnAccount, setReturnAccount] = useState("5212");
  const [costAccount, setCostAccount] = useState("632");
  const [purchaseDiscountRate, setPurchaseDiscountRate] = useState<number | string>("");
  const [fixedPurchasePrice, setFixedPurchasePrice] = useState<number | string>("");
  const [latestPurchasePrice, setLatestPurchasePrice] = useState<number | string>("");
  const [salePrice, setSalePrice] = useState<number | string>("");
  const [vatRate, setVatRate] = useState("10%");
  const [importTaxRate, setImportTaxRate] = useState<number | string>("");
  const [exportTaxRate, setExportTaxRate] = useState<number | string>("");
  const [exciseGroup, setExciseGroup] = useState("");

  // Section 2 (Hàng hóa): Chiết khấu bán hàng
  const [discountType, setDiscountType] = useState("Không chiết khấu");
  const [discountTiers, setDiscountTiers] = useState<
    Array<{ id: string; fromQty: number; toQty: number; discountPercent: number }>
  >([]);

  // Section 3 (Hàng hóa): Đơn vị chuyển đổi
  const [conversionUnits, setConversionUnits] = useState<
    Array<{
      id: string;
      unit: string;
      rate: number | string;
      operator: "Nhân" | "Chia";
      description: string;
      salePrice1: number | string;
    }>
  >([
    {
      id: "conv-1",
      unit: "",
      rate: "1,00",
      operator: "Nhân",
      description: "",
      salePrice1: "0,00",
    },
  ]);

  // Section 4 (Thành phẩm): Định mức nguyên vật liệu
  const [bomItems, setBomItems] = useState<BomItem[]>([]);

  // Section 4 (Hàng hóa): Công thức tính số lượng
  const [formulaType, setFormulaType] = useState("Khác");
  const [formulaExpression, setFormulaExpression] = useState("");

  // Section 2 (Dịch vụ): Đơn vị tính khác
  const [serviceUnits, setServiceUnits] = useState<Array<{ id: string; unit: string }>>([
    { id: "su-1", unit: "" },
  ]);

  // Section 3 (Dịch vụ): 5 trường mở rộng
  const [customField1, setCustomField1] = useState("");
  const [customField2, setCustomField2] = useState("");
  const [customField3, setCustomField3] = useState("");
  const [customField4, setCustomField4] = useState("");
  const [customField5, setCustomField5] = useState("");

  // Section 5 (Hàng hóa): Thông tin bổ sung
  const [barcode, setBarcode] = useState("");
  const [specification, setSpecification] = useState("");
  const [primarySupplier, setPrimarySupplier] = useState("");

  // Section: Mặt hàng chi tiết (Combo sản phẩm)
  const [comboItems, setComboItems] = useState<ComboDetailItem[]>([
    { id: "combo-1", itemCode: "", itemName: "", unit: "", quantity: "1,00" },
  ]);

  const isService = nature === "Dịch vụ";
  const isTool = nature === "Công cụ dụng cụ";
  const isCombo = nature === "Combo sản phẩm";

  // Sync state when editing or initial nature changes
  useEffect(() => {
    if (editingItem) {
      const nat = editingItem.nature || "Hàng hóa";
      setNature(nat);
      setName(editingItem.name || "");
      setCode(editingItem.code || "");
      setVthhGroups(editingItem.vthhGroups || [ITEM_NATURE_DEFAULTS[nat]?.defaultGroup || "HH"]);
      setUnit(editingItem.unit || (nat === "Dịch vụ" || nat === "Công cụ dụng cụ" ? "" : "Cái"));
      setVatPolicy(editingItem.vatPolicy || "Chưa xác định");
      setWarrantyPeriod(editingItem.warrantyPeriod || "");
      setWarrantyUnit(editingItem.warrantyUnit || "Tháng");
      setMinStockQty(editingItem.minStockQty ?? "");
      setOrigin(editingItem.origin || "");
      setDescription(editingItem.description || "");
      setPurchaseDescription(editingItem.purchaseDescription || "");
      setSaleDescription(editingItem.saleDescription || "");
      setSpecialType(editingItem.specialType || "");
      setImageUrl(editingItem.imageUrl || null);

      setWarehouse(editingItem.warehouse || "");
      setStockAccount(editingItem.stockAccount || (nat === "Công cụ dụng cụ" ? "153" : "156"));
      setRevenueAccount(editingItem.revenueAccount || (nat === "Dịch vụ" ? "5113" : "5111"));
      setDiscountAccount(editingItem.discountAccount || "5211");
      setPriceReductionAccount(editingItem.priceReductionAccount || "5213");
      setReturnAccount(editingItem.returnAccount || "5212");
      setCostAccount(editingItem.costAccount || "632");
      setPurchaseDiscountRate(editingItem.purchaseDiscountRate ?? "");
      setFixedPurchasePrice(editingItem.fixedPurchasePrice ?? (nat === "Dịch vụ" ? 0 : ""));
      setLatestPurchasePrice(editingItem.latestPurchasePrice ?? (nat === "Dịch vụ" ? 0 : ""));
      setSalePrice(editingItem.salePrice ?? (nat === "Dịch vụ" ? 0 : ""));
      setVatRate(editingItem.vatRate || (nat === "Công cụ dụng cụ" ? "" : "10%"));
      setImportTaxRate(editingItem.importTaxRate ?? "");
      setExportTaxRate(editingItem.exportTaxRate ?? "");
      setExciseGroup(editingItem.exciseGroup || "");

      setDiscountType(editingItem.discountType || "Không chiết khấu");
      setDiscountTiers(editingItem.discountTiers || []);
      setConversionUnits(
        editingItem.conversionUnits && editingItem.conversionUnits.length > 0
          ? editingItem.conversionUnits
          : [{ id: "conv-1", unit: "", rate: "1,00", operator: "Nhân", description: "", salePrice1: "0,00" }]
      );
      setBomItems(editingItem.bomItems || []);
      setComboItems(
        editingItem.comboItems && editingItem.comboItems.length > 0
          ? editingItem.comboItems
          : [{ id: "combo-1", itemCode: "", itemName: "", unit: "", quantity: "1,00" }]
      );
      setServiceUnits(
        editingItem.serviceUnits && editingItem.serviceUnits.length > 0
          ? editingItem.serviceUnits
          : [{ id: "su-1", unit: "" }]
      );
      setCustomField1(editingItem.customField1 || "");
      setCustomField2(editingItem.customField2 || "");
      setCustomField3(editingItem.customField3 || "");
      setCustomField4(editingItem.customField4 || "");
      setCustomField5(editingItem.customField5 || "");

      setFormulaType(editingItem.formulaType || "Khác");
      setFormulaExpression(editingItem.formulaExpression || "");
      setBarcode(editingItem.barcode || "");
      setSpecification(editingItem.specification || "");
      setPrimarySupplier(editingItem.primarySupplier || "");
    } else {
      const nat = initialNature || "Hàng hóa";
      setNature(nat);
      const conf = ITEM_NATURE_DEFAULTS[nat] || ITEM_NATURE_DEFAULTS["Hàng hóa"];
      const rand = String(Math.floor(1000 + Math.random() * 9000)).padStart(5, "0");
      setCode(nat === "Thành phẩm" || nat === "Công cụ dụng cụ" || nat === "Combo sản phẩm" ? "VT00002" : `${conf.prefix}${rand}`);
      setName("");
      setVthhGroups(nat === "Combo sản phẩm" ? [] : (conf.defaultGroup ? [conf.defaultGroup] : []));
      setUnit(conf.defaultUnit);
      setVatPolicy("Chưa xác định");
      setWarrantyPeriod(nat === "Thành phẩm" || nat === "Công cụ dụng cụ" || nat === "Nguyên vật liệu" || nat === "Combo sản phẩm" ? "0" : "");
      setWarrantyUnit("Tháng");
      setWarrantyExtra("");
      setMinStockQty(nat === "Thành phẩm" || nat === "Công cụ dụng cụ" ? "0,00" : (nat === "Nguyên vật liệu" ? "0.00" : ""));
      setOrigin("");
      setDescription("");
      setPurchaseDescription("");
      setSaleDescription("");
      setSpecialType("");
      setImageUrl(null);

      setWarehouse(conf.warehouse);
      setStockAccount(conf.stockAccount);
      setRevenueAccount(conf.revenueAccount);
      setDiscountAccount("5211");
      setPriceReductionAccount("5213");
      setReturnAccount("5212");
      setCostAccount(conf.costAccount);
      setPurchaseDiscountRate("");
      setFixedPurchasePrice(nat === "Thành phẩm" || nat === "Công cụ dụng cụ" ? "0,00" : (nat === "Dịch vụ" || nat === "Nguyên vật liệu" ? 0 : ""));
      setLatestPurchasePrice(nat === "Thành phẩm" || nat === "Công cụ dụng cụ" ? "0,00" : (nat === "Dịch vụ" || nat === "Nguyên vật liệu" ? 0 : ""));
      setSalePrice(nat === "Thành phẩm" || nat === "Công cụ dụng cụ" || nat === "Combo sản phẩm" ? "0,00" : (nat === "Dịch vụ" || nat === "Nguyên vật liệu" ? 0 : ""));
      setVatRate(nat === "Thành phẩm" || nat === "Công cụ dụng cụ" || nat === "Combo sản phẩm" ? "" : "10%");
      setImportTaxRate(nat === "Thành phẩm" || nat === "Công cụ dụng cụ" ? "0,00" : (nat === "Nguyên vật liệu" ? 0 : ""));
      setExportTaxRate(nat === "Thành phẩm" || nat === "Công cụ dụng cụ" ? "0,00" : (nat === "Nguyên vật liệu" ? 0 : ""));
      setExciseGroup("");

      setDiscountType("Không chiết khấu");
      setDiscountTiers([]);
      setConversionUnits([
        { id: "conv-1", unit: "", rate: "1,00", operator: "Nhân", description: "", salePrice1: "0,00" },
      ]);
      setBomItems([]);
      setComboItems([
        { id: "combo-1", itemCode: "", itemName: "", unit: "", quantity: "1,00" },
      ]);
      setServiceUnits([{ id: "su-1", unit: "" }]);
      setCustomField1("");
      setCustomField2("");
      setCustomField3("");
      setCustomField4("");
      setCustomField5("");

      setFormulaType("Khác");
      setFormulaExpression("");
      setBarcode("");
      setSpecification("");
      setPrimarySupplier("");
    }
  }, [isOpen, editingItem, initialNature]);

  const handleSave = (keepOpen: boolean = false) => {
    if (!name.trim()) {
      notify("Vui lòng nhập Tên hàng hóa, dịch vụ!");
      return;
    }
    if (!code.trim()) {
      notify("Vui lòng nhập Mã hàng hóa, dịch vụ!");
      return;
    }

    const payload: InventoryItemData = {
      id: editingItem?.id || `item-${Date.now()}`,
      name: name.trim(),
      code: code.trim(),
      nature,
      vthhGroups,
      unit,
      vatPolicy,
      warrantyPeriod: isService ? undefined : warrantyPeriod,
      warrantyUnit: isService ? undefined : warrantyUnit,
      minStockQty: (isService || isCombo) ? 0 : Number(String(minStockQty).replace(",", ".")) || 0,
      origin: isService ? undefined : origin,
      description: isService ? undefined : description,
      purchaseDescription: isCombo ? undefined : purchaseDescription,
      saleDescription,
      specialType: (isTool || isCombo) ? undefined : specialType,
      imageUrl: imageUrl || undefined,

      warehouse: (isService || isCombo) ? undefined : warehouse,
      stockAccount: (isService || isCombo) ? undefined : stockAccount,
      revenueAccount,
      discountAccount,
      priceReductionAccount,
      returnAccount,
      costAccount: isCombo ? undefined : costAccount,
      purchaseDiscountRate: isCombo ? undefined : Number(String(purchaseDiscountRate).replace(",", ".")) || 0,
      fixedPurchasePrice: isCombo ? undefined : Number(String(fixedPurchasePrice).replace(",", ".")) || 0,
      latestPurchasePrice: isCombo ? undefined : Number(String(latestPurchasePrice).replace(",", ".")) || 0,
      salePrice: Number(String(salePrice).replace(",", ".")) || 0,
      vatRate,
      importTaxRate: (isService || isCombo) ? undefined : Number(String(importTaxRate).replace(",", ".")) || 0,
      exportTaxRate: (isService || isCombo) ? undefined : Number(String(exportTaxRate).replace(",", ".")) || 0,
      exciseGroup,

      discountType: (isService || isTool || isCombo) ? undefined : discountType,
      discountTiers: (isService || isTool || isCombo) ? undefined : discountTiers,
      conversionUnits: (isService || isCombo) ? undefined : conversionUnits,
      bomItems: (nature === "Thành phẩm") ? bomItems : undefined,
      comboItems: isCombo ? comboItems : undefined,
      formulaType: (isService || isTool || isCombo) ? undefined : formulaType,
      formulaExpression: (isService || isTool || isCombo) ? undefined : formulaExpression,
      barcode: (isService || isTool || isCombo) ? undefined : barcode,
      specification: (isService || isTool || isCombo) ? undefined : specification,
      primarySupplier: (isService || isTool || isCombo) ? undefined : primarySupplier,

      serviceUnits: isService ? serviceUnits : undefined,
      customField1: (isService || isTool || isCombo) ? customField1 : undefined,
      customField2: (isService || isTool || isCombo) ? customField2 : undefined,
      customField3: (isService || isTool || isCombo) ? customField3 : undefined,
      customField4: (isService || isTool || isCombo) ? customField4 : undefined,
      customField5: (isService || isTool || isCombo) ? customField5 : undefined,

      stockQty: (isService || isCombo) ? 0 : editingItem?.stockQty || 0,
      stockValue: (isService || isCombo) ? 0 : editingItem?.stockValue || 0,
    };

    onSubmit(payload, keepOpen);

    if (keepOpen) {
      const conf = ITEM_NATURE_DEFAULTS[nature] || ITEM_NATURE_DEFAULTS["Hàng hóa"];
      const rand = String(Math.floor(1000 + Math.random() * 9000)).padStart(5, "0");
      setCode(`${conf.prefix}${rand}`);
      setName("");
      setDescription("");
      setPurchaseDescription("");
      setSaleDescription("");
      notify("Đã lưu. Sẵn sàng thêm mới tiếp tục!");
    } else {
      onClose();
    }
  };

  const insertFormulaSymbol = (sym: string) => {
    setFormulaExpression((prev) => (prev ? `${prev} ${sym}` : sym));
  };

  if (!isOpen) return null;

  const currentConf = ITEM_NATURE_DEFAULTS[nature] || ITEM_NATURE_DEFAULTS["Hàng hóa"];

  return (
    <div
      className="misa-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        zIndex: 99999,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        className="misa-item-drawer-window"
        style={{
          width: 780,
          maxWidth: "94vw",
          height: "100%",
          background: "#ffffff",
          boxShadow: "-10px 0 35px rgba(0, 0, 0, 0.2)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.22s ease-out",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            padding: "12px 20px 10px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 16.5,
              fontWeight: 700,
              color: "#1e293b",
            }}
          >
            Thông tin vật tư, hàng hóa, dịch vụ
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => notify("Hướng dẫn lập danh mục Hàng hóa, dịch vụ chuẩn MISA AMIS")}
              title="Hướng dẫn"
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "grid",
                placeItems: "center",
                borderRadius: 4,
              }}
            >
              <HelpCircle size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Đóng (Esc)"
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "grid",
                placeItems: "center",
                borderRadius: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Subheader: Nature badge and "Thay đổi tính chất" link */}
        <div
          style={{
            padding: "10px 20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#ffffff",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#00a862",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              boxShadow: "0 2px 4px rgba(0, 168, 98, 0.25)",
            }}
          >
            {currentConf.icon}
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{nature}</span>
          <span
            onClick={() => {
              if (onChangeNature) {
                onChangeNature();
              } else {
                notify("Mở danh sách chọn tính chất hàng hóa dịch vụ");
              }
            }}
            style={{
              fontSize: 13,
              color: "#00a862",
              cursor: "pointer",
              fontWeight: 500,
              textDecoration: "none",
              marginLeft: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            Thay đổi tính chất
          </span>
        </div>

        {/* Scrollable Form Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px 24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Row 1: Tên * */}
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
              Tên <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder=""
              style={{
                width: "100%",
                height: 32,
                padding: "0 10px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Middle Layout: Left fields + Right Image Box */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 16 }}>
            {/* Left side fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Mã * and Nhóm VTHH */}
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Mã <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Nhóm VTHH
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      height: 32,
                      padding: "0 6px",
                      background: "#ffffff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, overflow: "hidden" }}>
                      {vthhGroups.map((grp) => (
                        <span
                          key={grp}
                          style={{
                            background: "#e2e8f0",
                            color: "#1e293b",
                            padding: "2px 6px",
                            borderRadius: 3,
                            fontSize: 11.5,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {grp}
                          <X
                            size={11}
                            style={{ cursor: "pointer" }}
                            onClick={() => setVthhGroups(vthhGroups.filter((g) => g !== grp))}
                          />
                        </span>
                      ))}
                      {vthhGroups.length === 0 && !isCombo && (
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>Nhóm vật tư hàng hóa</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newGrp = prompt("Nhập mã nhóm VTHH:");
                        if (newGrp && !vthhGroups.includes(newGrp)) {
                          setVthhGroups([...vthhGroups, newGrp]);
                        }
                      }}
                      style={{ background: "none", border: "none", color: "#00a862", cursor: "pointer", padding: "0 4px" }}
                      title="Thêm nhóm VTHH"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "0 2px" }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Đơn vị tính / Đơn vị tính chính */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  {isCombo ? "Đơn vị tính" : "Đơn vị tính chính"}
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    height: 32,
                    padding: "0 8px",
                    background: "#ffffff",
                  }}
                >
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder={isService ? "Nhập đơn vị tính..." : ""}
                    style={{ border: "none", outline: "none", width: "100%", fontSize: 13 }}
                  />
                  <button
                    type="button"
                    onClick={() => notify("Thêm mới đơn vị tính")}
                    style={{ background: "none", border: "none", color: "#00a862", cursor: "pointer", padding: "0 4px" }}
                    title="Thêm đơn vị tính"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "0 2px" }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              {/* Giảm thuế theo quy định + Tra cứu giảm thuế link (Hidden for Combo sản phẩm) */}
              {!isCombo && (
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Giảm thuế theo quy định
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <select
                        value={vatPolicy}
                        onChange={(e) => setVatPolicy(e.target.value)}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 13,
                          background: "#ffffff",
                          appearance: "none",
                        }}
                      >
                        <option value="Chưa xác định">Chưa xác định</option>
                        <option value="Không giảm thuế">Không giảm thuế</option>
                        <option value="Giảm thuế theo NQ43">Giảm thuế theo NQ43</option>
                        <option value="10%">10%</option>
                        <option value="8%">8%</option>
                        <option value="Không chịu thuế">Không chịu thuế</option>
                      </select>
                      <ChevronDown
                        size={14}
                        style={{ position: "absolute", right: 8, top: 9, color: "#64748b", pointerEvents: "none" }}
                      />
                    </div>

                    <span
                      onClick={() => notify("Mở bảng tra cứu chính sách giảm thuế GTGT")}
                      style={{
                        fontSize: 12.5,
                        color: "#00a862",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <FileText size={14} />
                      <span>Tra cứu giảm thuế</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Image Upload Box */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div
                onClick={() => {
                  const url = prompt("Nhập đường dẫn URL ảnh hoặc dùng ảnh mặc định:", "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=200");
                  if (url) setImageUrl(url);
                }}
                style={{
                  width: 105,
                  height: 95,
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  display: "grid",
                  placeItems: "center",
                  background: "#f8fafc",
                  cursor: "pointer",
                  overflow: "hidden",
                }}
                title="Bấm để tải ảnh lên"
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="Item" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <ImageIcon size={38} style={{ color: "#94a3b8" }} />
                )}
              </div>

              {/* Icons below image: edit and delete */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6, color: "#64748b" }}>
                <span title="Sửa ảnh" style={{ display: "inline-flex" }}><Edit2
                  size={14}
                  style={{ cursor: "pointer" }}
                  
                  onClick={() => {
                    const url = prompt("Cập nhật đường dẫn ảnh:");
                    if (url) setImageUrl(url);
                  }}
                /></span>
                <span style={{ color: "#cbd5e1" }}>|</span>
                <span title="Xóa ảnh" style={{ display: "inline-flex" }}><Trash2
                  size={14}
                  style={{ cursor: "pointer", color: imageUrl ? "#ef4444" : "#94a3b8" }}
                  
                  onClick={() => setImageUrl(null)}
                /></span>
              </div>
            </div>
          </div>

          {/* Master fields specific to Physical Items (Hidden for Dịch vụ) */}
          {!isService && (
            <>
              {/* Thời hạn bảo hành */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Thời hạn bảo hành
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr", gap: 8 }}>
                  <input
                    type="text"
                    value={warrantyPeriod}
                    onChange={(e) => setWarrantyPeriod(e.target.value)}
                    placeholder="VD: 12"
                    style={{ height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13 }}
                  />
                  <div style={{ position: "relative" }}>
                    <select
                      value={warrantyUnit}
                      onChange={(e) => setWarrantyUnit(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        background: "#ffffff",
                        appearance: "none",
                      }}
                    >
                      <option value="Tháng">Tháng</option>
                      <option value="Năm">Năm</option>
                      <option value="Ngày">Ngày</option>
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 6, top: 9, color: "#64748b", pointerEvents: "none" }} />
                  </div>
                  <input
                    type="text"
                    value={warrantyExtra}
                    onChange={(e) => setWarrantyExtra(e.target.value)}
                    placeholder=""
                    style={{ height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, background: "#f8fafc" }}
                  />
                </div>
              </div>

              {/* Số lượng tồn tối thiểu & Nguồn gốc */}
              {isCombo ? (
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Nguồn gốc
                  </label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder=""
                    style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }}
                  />
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Số lượng tồn tối thiểu
                    </label>
                    <input
                      type="text"
                      value={minStockQty}
                      onChange={(e) => setMinStockQty(e.target.value)}
                      style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, textAlign: "right", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Nguồn gốc
                    </label>
                    <input
                      type="text"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder=""
                      style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}

              {/* Mô tả */}
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                  Mô tả
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                />
              </div>
            </>
          )}

          {/* Diễn giải khi mua (Present in both Hàng hóa & Dịch vụ, hidden for Combo sản phẩm) */}
          {!isCombo && (
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                Diễn giải khi mua
              </label>
              <input
                type="text"
                value={purchaseDescription}
                onChange={(e) => setPurchaseDescription(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          )}

          {/* Diễn giải khi bán */}
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
              Diễn giải khi bán
            </label>
            <input
              type="text"
              value={saleDescription}
              onChange={(e) => setSaleDescription(e.target.value)}
              style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          {/* Loại hàng hóa đặc trưng (hidden for Công cụ dụng cụ & Combo sản phẩm) */}
          {!isTool && !isCombo && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>
                  Loại hàng hóa đặc trưng
                </label>
                <HelpCircle size={14} style={{ color: "#94a3b8", cursor: "pointer" }} />
              </div>
              <div style={{ position: "relative" }}>
                <select
                  value={specialType}
                  onChange={(e) => setSpecialType(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    background: "#ffffff",
                    appearance: "none",
                  }}
                >
                  <option value="">Chọn loại hàng hóa đặc trưng</option>
                  <option value="normal">Hàng hóa thông thường</option>
                  <option value="serial">Hàng theo dõi theo số khung, số máy, IMEI</option>
                  <option value="batch">Hàng theo dõi theo Số lô, Hạn sử dụng</option>
                  <option value="dimension">Hàng có kích thước quy cách dài, rộng, cao</option>
                </select>
                <ChevronDown size={14} style={{ position: "absolute", right: 8, top: 9, color: "#64748b", pointerEvents: "none" }} />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MẶT HÀNG CHI TIẾT (ONLY FOR COMBO SẢN PHẨM) */}
          {/* ========================================================================= */}
          {isCombo && (
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                Mặt hàng chi tiết
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", width: "25%", fontWeight: 600, color: "#1e293b" }}>Mã hàng</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", width: "35%", fontWeight: 600, color: "#1e293b" }}>Tên hàng</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", width: "20%", fontWeight: 600, color: "#1e293b" }}>Đơn vị tính</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", width: "15%", fontWeight: 600, color: "#1e293b" }}>Số lượng</th>
                      <th style={{ padding: "8px 6px", textAlign: "center", width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {comboItems.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="text"
                            value={item.itemCode}
                            onChange={(e) => {
                              const list = [...comboItems];
                              list[idx].itemCode = e.target.value;
                              setComboItems(list);
                            }}
                            placeholder=""
                            style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12.5 }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="text"
                            value={item.itemName}
                            onChange={(e) => {
                              const list = [...comboItems];
                              list[idx].itemName = e.target.value;
                              setComboItems(list);
                            }}
                            placeholder=""
                            style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12.5 }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => {
                              const list = [...comboItems];
                              list[idx].unit = e.target.value;
                              setComboItems(list);
                            }}
                            placeholder=""
                            style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12.5 }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right" }}>
                          <input
                            type="text"
                            value={item.quantity}
                            onChange={(e) => {
                              const list = [...comboItems];
                              list[idx].quantity = e.target.value;
                              setComboItems(list);
                            }}
                            style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, textAlign: "right", fontSize: 12.5 }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          <Trash2
                            size={14}
                            style={{ color: "#ef4444", cursor: "pointer" }}
                            onClick={() => {
                              setComboItems(comboItems.filter((_, i) => i !== idx));
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination & Count */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#475569", padding: "2px 4px" }}>
                <div>
                  Tổng số: <strong>{comboItems.length}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span>Số dòng/trang</span>
                  <select style={{ height: 24, padding: "0 4px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 11.5, background: "#fff" }}>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b" }}>
                    <span style={{ cursor: "pointer" }}>&laquo;</span>
                    <span style={{ cursor: "pointer" }}>&lsaquo;</span>
                    <span style={{ color: "#00a862", fontWeight: 700, textDecoration: "underline", cursor: "pointer" }}>1</span>
                    <span style={{ cursor: "pointer" }}>&rsaquo;</span>
                    <span style={{ cursor: "pointer" }}>&raquo;</span>
                  </div>
                </div>
              </div>

              {/* Buttons: + Thêm dòng, Xóa hết dòng */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setComboItems([
                      ...comboItems,
                      { id: `combo-${Date.now()}`, itemCode: "", itemName: "", unit: "", quantity: "1,00" },
                    ]);
                  }}
                  style={{
                    height: 28,
                    padding: "0 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Plus size={13} />
                  <span>Thêm dòng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setComboItems([])}
                  style={{
                    height: 28,
                    padding: "0 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#dc2626",
                  }}
                >
                  <Trash2 size={13} />
                  <span>Xóa hết dòng</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ACCORDION 1: THÔNG TIN NGẦM ĐỊNH */}
          {/* ========================================================================= */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
            <div
              onClick={() => toggleSection("defaults")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                userSelect: "none",
                padding: "4px 0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {openSections.defaults ? <ChevronDown size={16} color="#475569" /> : <ChevronRight size={16} color="#475569" />}
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                  Thông tin ngầm định
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "#9333ea",
                    fontWeight: 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    marginLeft: 6,
                  }}
                >
                  <Bot size={14} />
                  <span>Trợ lý số AVA Kế toán đã có thể gợi ý Thuế suất GTGT</span>
                </span>
              </div>
            </div>

            {openSections.defaults && (
              isCombo ? (
                /* Combo Layout (Matching Combo Screenshot 2: 4 Columns with selected fields) */
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    gap: 10,
                    padding: "10px 0",
                  }}
                >
                  {/* Combo Column 1 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK doanh thu
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={revenueAccount}
                          onChange={(e) => setRevenueAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5111">5111</option>
                          <option value="5112">5112</option>
                          <option value="5113">5113</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK chiết khấu
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={discountAccount}
                          onChange={(e) => setDiscountAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5211">5211</option>
                          <option value="5212">5212</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>
                  </div>

                  {/* Combo Column 2 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK giảm giá
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={priceReductionAccount}
                          onChange={(e) => setPriceReductionAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5213">5213</option>
                          <option value="5211">5211</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK trả lại
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={returnAccount}
                          onChange={(e) => setReturnAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5212">5212</option>
                          <option value="5213">5213</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>
                  </div>

                  {/* Combo Column 3 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Đơn giá bán
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="text"
                          value={salePrice}
                          onChange={(e) => setSalePrice(e.target.value)}
                          style={{ flex: 1, height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right" }}
                        />
                        <button type="button" style={{ height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer" }}>
                          <MoreHorizontal size={13} color="#64748b" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Combo Column 4 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                        <label style={{ fontSize: 11.5, color: "#475569" }}>
                          Thuế suất GTGT (%)
                        </label>
                        <Bot size={13} color="#9333ea" />
                      </div>
                      <div style={{ position: "relative" }}>
                        <select
                          value={vatRate}
                          onChange={(e) => setVatRate(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value=""></option>
                          <option value="10%">10%</option>
                          <option value="8%">8%</option>
                          <option value="5%">5%</option>
                          <option value="0%">0%</option>
                          <option value="KCT">Không chịu thuế</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Nhóm HHDV chịu thuế TTĐB
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={exciseGroup}
                          onChange={(e) => setExciseGroup(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="">Chọn nhóm...</option>
                          <option value="RuouBia">Rượu, bia</option>
                          <option value="ThuocLa">Thuốc lá</option>
                          <option value="OTo">Ô tô dưới 24 chỗ</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : isService ? (
                /* Service Layout (Matching Service Screenshot 2: 3 Columns) */
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 12,
                    padding: "10px 0",
                  }}
                >
                  {/* Service Column 1 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK doanh thu
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={revenueAccount}
                          onChange={(e) => setRevenueAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5113">5113</option>
                          <option value="5111">5111</option>
                          <option value="5112">5112</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK chiết khấu
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={discountAccount}
                          onChange={(e) => setDiscountAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5211">5211</option>
                          <option value="5212">5212</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK giảm giá
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={priceReductionAccount}
                          onChange={(e) => setPriceReductionAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5213">5213</option>
                          <option value="5211">5211</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK trả lại
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={returnAccount}
                          onChange={(e) => setReturnAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5212">5212</option>
                          <option value="5213">5213</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>
                  </div>

                  {/* Service Column 2 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK Chi phí
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={costAccount}
                          onChange={(e) => setCostAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="632">632</option>
                          <option value="642">642</option>
                          <option value="641">641</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Tỷ lệ CKMH (%)
                      </label>
                      <input
                        type="number"
                        value={purchaseDiscountRate}
                        onChange={(e) => setPurchaseDiscountRate(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, boxSizing: "border-box" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Đơn giá mua cố định
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="number"
                          value={fixedPurchasePrice}
                          onChange={(e) => setFixedPurchasePrice(e.target.value)}
                          style={{ flex: 1, height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right" }}
                        />
                        <button type="button" style={{ height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer" }}>
                          <MoreHorizontal size={13} color="#64748b" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Đơn giá mua gần nhất
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="number"
                          value={latestPurchasePrice}
                          onChange={(e) => setLatestPurchasePrice(e.target.value)}
                          style={{ flex: 1, height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right" }}
                        />
                        <button type="button" style={{ height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer" }}>
                          <MoreHorizontal size={13} color="#64748b" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Service Column 3 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Đơn giá bán
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="number"
                          value={salePrice}
                          onChange={(e) => setSalePrice(e.target.value)}
                          style={{ flex: 1, height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right" }}
                        />
                        <button type="button" style={{ height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer" }}>
                          <MoreHorizontal size={13} color="#64748b" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                        <label style={{ fontSize: 11.5, color: "#475569" }}>
                          Thuế suất GTGT (%)
                        </label>
                        <Bot size={13} color="#9333ea" />
                      </div>
                      <div style={{ position: "relative" }}>
                        <select
                          value={vatRate}
                          onChange={(e) => setVatRate(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="10%">10%</option>
                          <option value="8%">8%</option>
                          <option value="5%">5%</option>
                          <option value="0%">0%</option>
                          <option value="KCT">Không chịu thuế</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Nhóm HHDV chịu thuế TTĐB
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={exciseGroup}
                          onChange={(e) => setExciseGroup(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="">Chọn nhóm...</option>
                          <option value="Karaoke">Kinh doanh vũ trường, karaoke, massage</option>
                          <option value="Golf">Kinh doanh golf</option>
                          <option value="Casino">Kinh doanh ca-si-nô, trò chơi điện tử có thưởng</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Physical Goods Layout (4 Columns) */
                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    gap: 10,
                    padding: "10px 0",
                  }}
                >
                  {/* Column 1 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Kho ngầm định
                      </label>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, height: 30, background: "#ffffff", padding: "0 4px" }}>
                        <input
                          type="text"
                          value={warehouse}
                          onChange={(e) => setWarehouse(e.target.value)}
                          placeholder="Chọn kho..."
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 12 }}
                        />
                        <Plus size={13} style={{ color: "#00a862", cursor: "pointer", marginRight: 2 }} />
                        <ChevronDown size={13} style={{ color: "#64748b", cursor: "pointer" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Tài khoản kho
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={stockAccount}
                          onChange={(e) => setStockAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="156">156</option>
                          <option value="1561">1561</option>
                          <option value="152">152</option>
                          <option value="152A">152A</option>
                          <option value="152B">152B</option>
                          <option value="1521">1521</option>
                          <option value="155">155</option>
                          <option value="153">153</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK doanh thu
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={revenueAccount}
                          onChange={(e) => setRevenueAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5111">5111</option>
                          <option value="5112">5112</option>
                          <option value="5113">5113</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK chiết khấu
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={discountAccount}
                          onChange={(e) => setDiscountAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5211">5211</option>
                          <option value="5212">5212</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>
                  </div>

                  {/* Column 2 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK giảm giá
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={priceReductionAccount}
                          onChange={(e) => setPriceReductionAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5213">5213</option>
                          <option value="5211">5211</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK trả lại
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={returnAccount}
                          onChange={(e) => setReturnAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="5212">5212</option>
                          <option value="5213">5213</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        TK Chi phí
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={costAccount}
                          onChange={(e) => setCostAccount(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="632">632</option>
                          <option value="642">642</option>
                          <option value="641">641</option>
                          <option value="621">621</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Tỷ lệ CKMH (%)
                      </label>
                      <input
                        type="number"
                        value={purchaseDiscountRate}
                        onChange={(e) => setPurchaseDiscountRate(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Column 3 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Đơn giá mua cố định
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="text"
                          value={fixedPurchasePrice}
                          onChange={(e) => setFixedPurchasePrice(e.target.value)}
                          style={{ flex: 1, height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right" }}
                        />
                        <button type="button" style={{ height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer" }}>
                          <MoreHorizontal size={13} color="#64748b" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Đơn giá mua gần nhất
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="text"
                          value={latestPurchasePrice}
                          onChange={(e) => setLatestPurchasePrice(e.target.value)}
                          style={{ flex: 1, height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right" }}
                        />
                        <button type="button" style={{ height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer" }}>
                          <MoreHorizontal size={13} color="#64748b" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Đơn giá bán
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="text"
                          value={salePrice}
                          onChange={(e) => setSalePrice(e.target.value)}
                          style={{ flex: 1, height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right" }}
                        />
                        <button type="button" style={{ height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", cursor: "pointer" }}>
                          <MoreHorizontal size={13} color="#64748b" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Column 4 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                        <label style={{ fontSize: 11.5, color: "#475569" }}>
                          Thuế suất GTGT (%)
                        </label>
                        <Bot size={13} color="#9333ea" />
                      </div>
                      <div style={{ position: "relative" }}>
                        <select
                          value={vatRate}
                          onChange={(e) => setVatRate(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value=""></option>
                          <option value="10%">10%</option>
                          <option value="8%">8%</option>
                          <option value="5%">5%</option>
                          <option value="0%">0%</option>
                          <option value="KCT">Không chịu thuế</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Thuế suất thuế NK (%)
                      </label>
                      <input
                        type="text"
                        value={importTaxRate}
                        onChange={(e) => setImportTaxRate(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", boxSizing: "border-box" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Thuế suất thuế XK (%)
                      </label>
                      <input
                        type="text"
                        value={exportTaxRate}
                        onChange={(e) => setExportTaxRate(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", boxSizing: "border-box" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#475569", marginBottom: 3 }}>
                        Nhóm HHDV chịu thuế TTĐB
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={exciseGroup}
                          onChange={(e) => setExciseGroup(e.target.value)}
                          style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", appearance: "none" }}
                        >
                          <option value="">Chọn nhóm...</option>
                          <option value="RuouBia">Rượu, bia</option>
                          <option value="ThuocLa">Thuốc lá</option>
                          <option value="OTo">Ô tô dưới 24 chỗ</option>
                        </select>
                        <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* ========================================================================= */}
          {/* ACCORDION 2 FOR DỊCH VỤ: ĐƠN VỊ TÍNH KHÁC (MATCHING SERVICE SCREENSHOT 3) */}
          {/* ========================================================================= */}
          {isService && (
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              <div
                onClick={() => toggleSection("serviceUnits")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  userSelect: "none",
                  padding: "4px 0",
                }}
              >
                {openSections.serviceUnits ? <ChevronDown size={16} color="#00a862" /> : <ChevronRight size={16} color="#475569" />}
                <span style={{ fontSize: 14, fontWeight: 700, color: openSections.serviceUnits ? "#00a862" : "#1e293b" }}>
                  Đơn vị tính khác
                </span>
              </div>

              {openSections.serviceUnits && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #cbd5e1" }}>
                    <thead>
                      <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", width: 80 }}>STT</th>
                        <th style={{ padding: "8px 12px", textAlign: "left" }}>Đơn vị tính</th>
                        <th style={{ padding: "8px 12px", textAlign: "center", width: 45 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceUnits.map((su, idx) => (
                        <tr key={su.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "6px 12px", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "6px 12px" }}>
                            <input
                              type="text"
                              value={su.unit}
                              onChange={(e) => {
                                const list = [...serviceUnits];
                                list[idx].unit = e.target.value;
                                setServiceUnits(list);
                              }}
                              placeholder="Nhập đơn vị tính khác..."
                              style={{ width: "100%", height: 26, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 3 }}
                            />
                          </td>
                          <td style={{ padding: "6px 12px", textAlign: "center" }}>
                            <Trash2
                              size={14}
                              style={{ color: "#ef4444", cursor: "pointer" }}
                              onClick={() => {
                                setServiceUnits(serviceUnits.filter((_, i) => i !== idx));
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setServiceUnits([...serviceUnits, { id: `su-${Date.now()}`, unit: "" }]);
                      }}
                      style={{
                        height: 28,
                        padding: "0 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceUnits([])}
                      style={{
                        height: 28,
                        padding: "0 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: "#dc2626",
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ACCORDION 2 FOR HÀNG HÓA: CHIẾT KHẤU BÁN HÀNG */}
          {/* ========================================================================= */}
          {!isService && !isTool && !isCombo && (
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              <div
                onClick={() => toggleSection("discount")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  userSelect: "none",
                  padding: "4px 0",
                }}
              >
                {openSections.discount ? <ChevronDown size={16} color="#475569" /> : <ChevronRight size={16} color="#475569" />}
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                  Chiết khấu bán hàng
                </span>
              </div>

              {openSections.discount && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12.5, color: "#475569" }}>
                    <Info size={15} style={{ color: "#00a862", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <span>Thiết lập chiết khấu thương mại theo số lượng bán trên chứng từ bán hàng.</span>
                      <br />
                      <span style={{ color: "#64748b" }}>VD: Số lượng từ 100 - 200 thì chiết khấu 5%</span>
                    </div>
                  </div>

                  <div style={{ width: 220 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Chiết khấu bán hàng
                    </label>
                    <div style={{ position: "relative" }}>
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value)}
                        style={{
                          width: "100%",
                          height: 30,
                          padding: "0 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          background: "#ffffff",
                          appearance: "none",
                        }}
                      >
                        <option value="Không chiết khấu">Không chiết khấu</option>
                        <option value="Theo số lượng">Theo số lượng</option>
                        <option value="Theo số tiền">Theo số tiền</option>
                      </select>
                      <ChevronDown size={14} style={{ position: "absolute", right: 6, top: 8, color: "#64748b", pointerEvents: "none" }} />
                    </div>
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #cbd5e1" }}>
                    <thead>
                      <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", width: "40%" }}>Số lượng từ</th>
                        <th style={{ padding: "8px 12px", textAlign: "left", width: "40%" }}>Số lượng đến</th>
                        <th style={{ padding: "8px 12px", textAlign: "right" }}>% chiết khấu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discountTiers.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: "14px", textAlign: "center", color: "#94a3b8" }}>
                            Chưa có bậc chiết khấu. Bấm "Thêm dòng" bên dưới để thiết lập.
                          </td>
                        </tr>
                      ) : (
                        discountTiers.map((tier, idx) => (
                          <tr key={tier.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "6px 12px" }}>
                              <input
                                type="number"
                                value={tier.fromQty}
                                onChange={(e) => {
                                  const newTiers = [...discountTiers];
                                  newTiers[idx].fromQty = Number(e.target.value);
                                  setDiscountTiers(newTiers);
                                }}
                                style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3 }}
                              />
                            </td>
                            <td style={{ padding: "6px 12px" }}>
                              <input
                                type="number"
                                value={tier.toQty}
                                onChange={(e) => {
                                  const newTiers = [...discountTiers];
                                  newTiers[idx].toQty = Number(e.target.value);
                                  setDiscountTiers(newTiers);
                                }}
                                style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3 }}
                              />
                            </td>
                            <td style={{ padding: "6px 12px", textAlign: "right" }}>
                              <input
                                type="number"
                                value={tier.discountPercent}
                                onChange={(e) => {
                                  const newTiers = [...discountTiers];
                                  newTiers[idx].discountPercent = Number(e.target.value);
                                  setDiscountTiers(newTiers);
                                }}
                                style={{ width: 80, height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, textAlign: "right" }}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscountTiers([
                          ...discountTiers,
                          { id: `tier-${Date.now()}`, fromQty: 100, toQty: 200, discountPercent: 5 },
                        ]);
                      }}
                      style={{
                        height: 28,
                        padding: "0 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountTiers([])}
                      style={{
                        height: 28,
                        padding: "0 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: "#dc2626",
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ACCORDION 3 FOR HÀNG HÓA: ĐƠN VỊ CHUYỂN ĐỔI */}
          {/* ========================================================================= */}
          {!isService && !isCombo && (
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              <div
                onClick={() => toggleSection("conversion")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  userSelect: "none",
                  padding: "4px 0",
                }}
              >
                {openSections.conversion ? <ChevronDown size={16} color="#475569" /> : <ChevronRight size={16} color="#475569" />}
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                  Đơn vị chuyển đổi
                </span>
              </div>

              {openSections.conversion && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12.5, color: "#475569" }}>
                    <Info size={15} style={{ color: "#00a862", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <span>Trường hợp vật tư, hàng hóa sử dụng đơn vị tính khác nhau khi nhập/xuất thì khai báo thêm các đơn vị tính ở đây.</span>
                      <br />
                      <span style={{ color: "#64748b" }}>VD: 1 tạ = 100kg, 1 két bia = 20 chai , ...</span>
                    </div>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #cbd5e1" }}>
                      <thead>
                        <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Đơn vị chuyển đổi</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", width: 110 }}>Tỷ lệ chuyển đổi</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", width: 110 }}>Phép tính</th>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Mô tả</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", width: 110 }}>Đơn giá bán 1</th>
                          <th style={{ padding: "8px 10px", textAlign: "center", width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {conversionUnits.map((conv, idx) => (
                          <tr key={conv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={conv.unit}
                                onChange={(e) => {
                                  const list = [...conversionUnits];
                                  list[idx].unit = e.target.value;
                                  setConversionUnits(list);
                                }}
                                placeholder=""
                                style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3 }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>
                              <input
                                type="text"
                                value={conv.rate}
                                onChange={(e) => {
                                  const list = [...conversionUnits];
                                  list[idx].rate = e.target.value;
                                  setConversionUnits(list);
                                }}
                                style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, textAlign: "right" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <select
                                value={conv.operator}
                                onChange={(e) => {
                                  const list = [...conversionUnits];
                                  list[idx].operator = e.target.value as "Nhân" | "Chia";
                                  setConversionUnits(list);
                                }}
                                style={{ width: "100%", height: 26, padding: "0 4px", border: "1px solid #cbd5e1", borderRadius: 3, background: "#ffffff" }}
                              >
                                <option value="Nhân">Phép nhân</option>
                                <option value="Chia">Phép chia</option>
                              </select>
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={conv.description}
                                onChange={(e) => {
                                  const list = [...conversionUnits];
                                  list[idx].description = e.target.value;
                                  setConversionUnits(list);
                                }}
                                placeholder=""
                                style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3 }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>
                              <input
                                type="text"
                                value={conv.salePrice1}
                                onChange={(e) => {
                                  const list = [...conversionUnits];
                                  list[idx].salePrice1 = e.target.value;
                                  setConversionUnits(list);
                                }}
                                style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, textAlign: "right" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "center" }}>
                              <Trash2
                                size={14}
                                style={{ color: "#ef4444", cursor: "pointer" }}
                                onClick={() => {
                                  setConversionUnits(conversionUnits.filter((_, i) => i !== idx));
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setConversionUnits([
                          ...conversionUnits,
                          { id: `conv-${Date.now()}`, unit: "", rate: 1.0, operator: "Nhân", description: "", salePrice1: 0 },
                        ]);
                      }}
                      style={{
                        height: 28,
                        padding: "0 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConversionUnits([])}
                      style={{
                        height: 28,
                        padding: "0 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: "#dc2626",
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ACCORDION FOR THÀNH PHẨM: ĐỊNH MỨC NGUYÊN VẬT LIỆU (SCREENSHOT 5) */}
          {/* ========================================================================= */}
          {!isService && nature === "Thành phẩm" && (
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              <div
                onClick={() => toggleSection("bom")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  userSelect: "none",
                  padding: "4px 0",
                }}
              >
                {openSections.bom ? <ChevronDown size={16} color="#00a862" /> : <ChevronRight size={16} color="#475569" />}
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: openSections.bom ? "#00a862" : "#1e293b",
                  }}
                >
                  Định mức nguyên vật liệu
                </span>
              </div>

              {openSections.bom && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#475569" }}>
                    <Info size={15} style={{ color: "#00a862", flexShrink: 0 }} />
                    <span>(Định nghĩa định mức các thành phần, nguyên liệu để cấu thành thành phẩm)</span>
                  </div>

                  <datalist id="bom-materials-datalist">
                    <option value="NVL00001">NVL00001 - Vải cotton cao cấp</option>
                    <option value="NVL00002">NVL00002 - Nút áo nhựa 4 lỗ</option>
                    <option value="NVL00003">NVL00003 - Chỉ may Poly chống đứt</option>
                    <option value="NVL00004">NVL00004 - Thép tấm mạ kẽm Ø6</option>
                    <option value="NVL00005">NVL00005 - Sơn tĩnh điện màu đen</option>
                    <option value="NVL00006">NVL00006 - Ốc vít bắt liên kết M4</option>
                  </datalist>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #cbd5e1" }}>
                      <thead>
                        <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                          <th style={{ padding: "8px 10px", textAlign: "left", width: "22%" }}>Mã nguyên vật liệu</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", width: "26%" }}>Tên nguyên vật liệu</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", width: "14%" }}>Đơn vị tính</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", width: "14%" }}>Số lượng</th>
                          <th style={{ padding: "8px 10px", textAlign: "left", width: "20%" }}>Khoản mục CP</th>
                          <th style={{ padding: "8px 10px", textAlign: "center", width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {bomItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: "14px", textAlign: "center", color: "#94a3b8" }}>
                              Chưa có nguyên vật liệu trong định mức. Bấm "Thêm dòng" bên dưới để thiết lập.
                            </td>
                          </tr>
                        ) : (
                          bomItems.map((item, idx) => (
                            <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "6px 8px" }}>
                                <input
                                  type="text"
                                  list="bom-materials-datalist"
                                  value={item.materialCode}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const list = [...bomItems];
                                    list[idx].materialCode = val;
                                    if (val === "NVL00001") {
                                      list[idx].materialName = "Vải cotton cao cấp";
                                      list[idx].unit = "Mét";
                                    } else if (val === "NVL00002") {
                                      list[idx].materialName = "Nút áo nhựa 4 lỗ";
                                      list[idx].unit = "Cái";
                                    } else if (val === "NVL00003") {
                                      list[idx].materialName = "Chỉ may Poly chống đứt";
                                      list[idx].unit = "Cuộn";
                                    } else if (val === "NVL00004") {
                                      list[idx].materialName = "Thép tấm mạ kẽm Ø6";
                                      list[idx].unit = "Kg";
                                    } else if (val === "NVL00005") {
                                      list[idx].materialName = "Sơn tĩnh điện màu đen";
                                      list[idx].unit = "Kg";
                                    } else if (val === "NVL00006") {
                                      list[idx].materialName = "Ốc vít bắt liên kết M4";
                                      list[idx].unit = "Bộ";
                                    }
                                    setBomItems(list);
                                  }}
                                  placeholder="Nhập mã NVL..."
                                  style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3 }}
                                />
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <input
                                  type="text"
                                  value={item.materialName}
                                  onChange={(e) => {
                                    const list = [...bomItems];
                                    list[idx].materialName = e.target.value;
                                    setBomItems(list);
                                  }}
                                  placeholder="Tên nguyên vật liệu..."
                                  style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3 }}
                                />
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <input
                                  type="text"
                                  value={item.unit}
                                  onChange={(e) => {
                                    const list = [...bomItems];
                                    list[idx].unit = e.target.value;
                                    setBomItems(list);
                                  }}
                                  placeholder="ĐVT"
                                  style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3 }}
                                />
                              </td>
                              <td style={{ padding: "6px 8px", textAlign: "right" }}>
                                <input
                                  type="text"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const list = [...bomItems];
                                    list[idx].quantity = e.target.value;
                                    setBomItems(list);
                                  }}
                                  style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, textAlign: "right" }}
                                />
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <select
                                  value={item.costItem}
                                  onChange={(e) => {
                                    const list = [...bomItems];
                                    list[idx].costItem = e.target.value;
                                    setBomItems(list);
                                  }}
                                  style={{ width: "100%", height: 26, padding: "0 4px", border: "1px solid #cbd5e1", borderRadius: 3, background: "#ffffff" }}
                                >
                                  <option value="CPNVLTT">CPNVLTT - Chi phí NVL trực tiếp</option>
                                  <option value="621">621 - Chi phí nguyên liệu, vật liệu trực tiếp</option>
                                  <option value="CPNCTT">CPNCTT - Chi phí nhân công trực tiếp</option>
                                  <option value="CPSXC">CPSXC - Chi phí sản xuất chung</option>
                                </select>
                              </td>
                              <td style={{ padding: "6px 8px", textAlign: "center" }}>
                                <Trash2
                                  size={14}
                                  style={{ color: "#ef4444", cursor: "pointer" }}
                                  onClick={() => {
                                    setBomItems(bomItems.filter((_, i) => i !== idx));
                                  }}
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setBomItems([
                          ...bomItems,
                          {
                            id: `bom-${Date.now()}`,
                            materialCode: "",
                            materialName: "",
                            unit: "",
                            quantity: "1,00",
                            costItem: "CPNVLTT",
                          },
                        ]);
                      }}
                      style={{
                        height: 28,
                        padding: "0 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBomItems([])}
                      style={{
                        height: 28,
                        padding: "0 12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: "#dc2626",
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Xóa hết dòng</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ACCORDION 5 FOR HÀNG HÓA: CÔNG THỨC TÍNH SỐ LƯỢNG */}
          {/* ========================================================================= */}
          {!isService && !isTool && !isCombo && (
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              <div
                onClick={() => toggleSection("formula")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  userSelect: "none",
                  padding: "4px 0",
                }}
              >
                {openSections.formula ? <ChevronDown size={16} color="#475569" /> : <ChevronRight size={16} color="#475569" />}
                <span style={{ fontSize: 14, fontWeight: 700, color: "#00a862" }}>
                  Công thức tính số lượng
                </span>
              </div>

              {openSections.formula && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12.5, color: "#475569" }}>
                    <Info size={15} style={{ color: "#00a862", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <span>Chức năng này cho phép thiết lập công thức tính toán Số lượng trên chứng từ.</span>
                      <br />
                      <span style={{ color: "#64748b" }}>Dùng dấu "." để ngăn cách phần thập phân.</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11.5, color: "#64748b", marginBottom: 2 }}>
                        Dựa trên cách tính
                      </label>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                        Công thức tính số lượng
                      </label>
                      <div style={{ position: "relative" }}>
                        <select
                          value={formulaType}
                          onChange={(e) => setFormulaType(e.target.value)}
                          style={{
                            width: "100%",
                            height: 32,
                            padding: "0 8px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 12.5,
                            background: "#ffffff",
                            appearance: "none",
                          }}
                        >
                          <option value="Khác">Khác</option>
                          <option value="DaiRong">Dài x Rộng</option>
                          <option value="DaiRongCao">Dài x Rộng x Cao</option>
                          <option value="TrongLuong">Trọng lượng x Số lượng</option>
                        </select>
                        <ChevronDown size={14} style={{ position: "absolute", right: 6, top: 9, color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                        Công thức
                      </label>
                      <textarea
                        value={formulaExpression}
                        onChange={(e) => setFormulaExpression(e.target.value)}
                        placeholder="Nhập hoặc click các biến số bên dưới để ghép công thức..."
                        rows={3}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 13,
                          fontFamily: "monospace",
                          boxSizing: "border-box",
                        }}
                      />

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {["Chiều dài", "Chiều rộng", "Chiều cao", "Bán kính", "Lượng"].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => insertFormulaSymbol(`[${v}]`)}
                            style={{
                              height: 26,
                              padding: "0 10px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 4,
                              background: "#ffffff",
                              fontSize: 12,
                              cursor: "pointer",
                              color: "#334155",
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        {["+", "-", "*", "/", "(", ")"].map((op) => (
                          <button
                            key={op}
                            type="button"
                            onClick={() => insertFormulaSymbol(op)}
                            style={{
                              height: 26,
                              width: 30,
                              border: "1px solid #cbd5e1",
                              borderRadius: 4,
                              background: "#ffffff",
                              fontSize: 12.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              color: "#334155",
                            }}
                          >
                            {op}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            if (!formulaExpression.trim()) {
                              notify("Vui lòng nhập công thức cần kiểm tra!");
                            } else {
                              notify("Công thức tính số lượng hợp lệ!");
                            }
                          }}
                          style={{
                            height: 26,
                            padding: "0 12px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            background: "#ffffff",
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: "pointer",
                            color: "#00a862",
                          }}
                        >
                          Kiểm tra công thức
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ACCORDION: THÔNG TIN BỔ SUNG (DỊCH VỤ: 5 TRƯỜNG MỞ RỘNG; HÀNG HÓA: QUY CÁCH) */}
          {/* ========================================================================= */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
            <div
              onClick={() => toggleSection("additional")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                userSelect: "none",
                padding: "4px 0",
              }}
            >
              {openSections.additional ? <ChevronDown size={16} color="#475569" /> : <ChevronRight size={16} color="#475569" />}
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                Thông tin bổ sung
              </span>
            </div>

            {openSections.additional && (
              (isService || isTool || isCombo) ? (
                /* Service, Tool & Combo Layout (Matching Screenshot 3: Trường mở rộng 1-5) */
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Trường mở rộng 1", val: customField1, setter: setCustomField1 },
                    { label: "Trường mở rộng 2", val: customField2, setter: setCustomField2 },
                    { label: "Trường mở rộng 3", val: customField3, setter: setCustomField3 },
                    { label: "Trường mở rộng 4", val: customField4, setter: setCustomField4 },
                    { label: "Trường mở rộng 5", val: customField5, setter: setCustomField5 },
                  ].map((field) => (
                    <div key={field.label} style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", gap: 12 }}>
                      <label style={{ fontSize: 12.5, color: "#334155" }}>
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={field.val}
                        onChange={(e) => field.setter(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                /* Physical Goods Layout */
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Mã vạch (Barcode)
                    </label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="VD: 893500123456"
                      style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Quy cách kỹ thuật
                    </label>
                    <input
                      type="text"
                      value={specification}
                      onChange={(e) => setSpecification(e.target.value)}
                      placeholder="VD: Dày 3.5mm, chiều dài 6m"
                      style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Nhà cung cấp chính
                    </label>
                    <input
                      type="text"
                      value={primarySupplier}
                      onChange={(e) => setPrimarySupplier(e.target.value)}
                      placeholder="Chọn nhà cung cấp chính..."
                      style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )
            )}
          </div>

          {/* Bottom Footnote Notice (Hidden for Combo sản phẩm) */}
          {!isCombo && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 12,
                borderTop: "1px solid #e2e8f0",
                fontSize: 12,
                color: "#475569",
                lineHeight: 1.6,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <Info size={14} style={{ color: "#00a862", marginTop: 2, flexShrink: 0 }} />
                <div>
                  {!isService && (
                    <div>
                      - Để theo dõi vật tư hàng hóa theo quy cách bạn có thể thiết lập{" "}
                      <span
                        onClick={() => notify("Mở thiết lập theo dõi quy cách")}
                        style={{ color: "#0284c7", cursor: "pointer", textDecoration: "none" }}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                      >
                        tại đây
                      </span>
                    </div>
                  )}
                  <div>
                    - Để <strong>phân bổ doanh thu nhận trước</strong> khi bán sản phẩm bạn có thể thiết lập{" "}
                    <span
                      onClick={() => notify("Mở thiết lập phân bổ doanh thu nhận trước")}
                      style={{ color: "#0284c7", cursor: "pointer", textDecoration: "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                    >
                      tại đây
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            padding: "12px 20px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 32,
              padding: "0 18px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              background: "#ffffff",
              color: "#334155",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            style={{
              height: 32,
              padding: "0 22px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              background: "#ffffff",
              color: "#334155",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >Lưu</button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            style={{
              height: 32,
              padding: "0 20px",
              border: "none",
              borderRadius: 4,
              background: "#00a862",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
            }}
          >
            Lưu và Thêm
          </button>
        </div>
      </div>
    </div>
  );
};

export default MisaInventoryItemModal;
