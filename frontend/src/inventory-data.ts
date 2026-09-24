export type ProductionOrderStatus = "draft" | "in-progress" | "completed";

export type MaterialLine = {
  code: string;
  name: string;
  quantity: number;
  unit: string;
};

export type ProductionOrder = {
  id: string;
  code: string;
  date: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  completionDate: string;
  workshop: string;
  status: ProductionOrderStatus;
  materials: MaterialLine[];
};

export const productionOrderStatuses: Record<ProductionOrderStatus, string> = {
  draft: "Chưa thực hiện",
  "in-progress": "Đang sản xuất",
  completed: "Đã hoàn thành",
};

export const productionOrders: ProductionOrder[] = [
  {
    id: "po-001",
    code: "LSX-0001",
    date: "2026-09-02",
    productCode: "TP-001",
    productName: "Tủ bếp module 2,4m",
    quantity: 12,
    unit: "Bộ",
    completionDate: "2026-09-18",
    workshop: "Xưởng nội thất 1",
    status: "in-progress",
    materials: [
      {
        code: "NVL-011",
        name: "Gỗ MDF lõi xanh 18mm",
        quantity: 36,
        unit: "Tấm",
      },
      { code: "NVL-024", name: "Bản lề giảm chấn", quantity: 144, unit: "Cái" },
    ],
  },
  {
    id: "po-002",
    code: "LSX-0002",
    date: "2026-09-05",
    productCode: "TP-004",
    productName: "Bộ bàn ăn gỗ sồi",
    quantity: 8,
    unit: "Bộ",
    completionDate: "2026-09-22",
    workshop: "Xưởng mộc 2",
    status: "in-progress",
    materials: [
      { code: "NVL-031", name: "Gỗ sồi ghép thanh", quantity: 4.8, unit: "m³" },
      { code: "NVL-045", name: "Sơn phủ mờ", quantity: 24, unit: "Lít" },
    ],
  },
  {
    id: "po-003",
    code: "LSX-0003",
    date: "2026-09-07",
    productCode: "TP-009",
    productName: "Ghế làm việc công thái học",
    quantity: 40,
    unit: "Cái",
    completionDate: "2026-09-25",
    workshop: "Xưởng lắp ráp",
    status: "draft",
    materials: [
      {
        code: "NVL-052",
        name: "Khung ghế thép sơn tĩnh điện",
        quantity: 40,
        unit: "Bộ",
      },
      {
        code: "NVL-057",
        name: "Đệm lưới công thái học",
        quantity: 40,
        unit: "Bộ",
      },
    ],
  },
  {
    id: "po-004",
    code: "LSX-0004",
    date: "2026-09-09",
    productCode: "TP-012",
    productName: "Kệ hồ sơ 5 tầng",
    quantity: 25,
    unit: "Cái",
    completionDate: "2026-09-16",
    workshop: "Xưởng nội thất 1",
    status: "completed",
    materials: [
      { code: "NVL-014", name: "Ván phủ melamine", quantity: 50, unit: "Tấm" },
      { code: "NVL-019", name: "Nẹp cạnh PVC", quantity: 210, unit: "Mét" },
    ],
  },
  {
    id: "po-005",
    code: "LSX-0005",
    date: "2026-09-12",
    productCode: "TP-016",
    productName: "Bàn họp oval 10 người",
    quantity: 6,
    unit: "Cái",
    completionDate: "2026-09-28",
    workshop: "Xưởng mộc 2",
    status: "draft",
    materials: [
      {
        code: "NVL-011",
        name: "Gỗ MDF lõi xanh 18mm",
        quantity: 18,
        unit: "Tấm",
      },
      { code: "NVL-063", name: "Chân bàn thép hộp", quantity: 12, unit: "Bộ" },
    ],
  },
  {
    id: "po-006",
    code: "LSX-0006",
    date: "2026-09-14",
    productCode: "TP-021",
    productName: "Tủ tài liệu cánh kính",
    quantity: 15,
    unit: "Cái",
    completionDate: "2026-09-30",
    workshop: "Xưởng lắp ráp",
    status: "completed",
    materials: [
      { code: "NVL-014", name: "Ván phủ melamine", quantity: 30, unit: "Tấm" },
      {
        code: "NVL-071",
        name: "Kính cường lực 5mm",
        quantity: 15,
        unit: "Tấm",
      },
    ],
  },
];
