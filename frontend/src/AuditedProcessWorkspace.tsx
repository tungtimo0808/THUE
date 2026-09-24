import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  Calculator,
  ClipboardCheck,
  FileStack,
  Workflow,
} from "lucide-react";

type ProcessNode = {
  label: string;
  group: "prepare" | "execute" | "control";
};

const processNodes: Record<string, ProcessNode[]> = {
  inventory: [
    { label: "Nhập kho", group: "execute" },
    { label: "Xuất kho", group: "execute" },
    { label: "Chuyển kho", group: "execute" },
    { label: "Lệnh sản xuất", group: "prepare" },
    { label: "Kiểm kê kho", group: "control" },
  ],
  tools: [
    { label: "Ghi tăng CCDC", group: "prepare" },
    { label: "Phân bổ chi phí", group: "execute" },
    { label: "Điều chỉnh", group: "execute" },
    { label: "Điều chuyển", group: "execute" },
    { label: "Ghi giảm", group: "execute" },
    { label: "Kiểm kê CCDC", group: "control" },
  ],
  payroll: [
    { label: "Chấm công", group: "prepare" },
    { label: "Tổng hợp chấm công", group: "prepare" },
    { label: "Tính lương", group: "execute" },
    { label: "Hạch toán chi phí", group: "execute" },
    { label: "Trả lương", group: "control" },
    { label: "Nộp bảo hiểm", group: "control" },
  ],
  ledger: [
    { label: "Quyết toán tạm ứng", group: "prepare" },
    { label: "Chứng từ ghi sổ", group: "prepare" },
    { label: "Kết chuyển lợi nhuận", group: "execute" },
    { label: "Tính tỷ giá xuất quỹ", group: "execute" },
    { label: "Kết chuyển lãi lỗ", group: "execute" },
    { label: "Đánh giá lại ngoại tệ", group: "execute" },
    { label: "Phân bổ chi phí", group: "execute" },
    { label: "Khóa sổ", group: "control" },
    { label: "Chọn hoạt động LCTT", group: "control" },
    { label: "Kiểm tra đối chiếu", group: "control" },
  ],
};

const groups = [
  { id: "prepare", label: "Chuẩn bị dữ liệu", icon: FileStack },
  { id: "execute", label: "Xử lý nghiệp vụ", icon: Calculator },
  { id: "control", label: "Kiểm soát & hoàn tất", icon: ClipboardCheck },
] as const;

export function AuditedProcessWorkspace({
  moduleId,
  moduleLabel,
  notify,
}: {
  moduleId: string;
  moduleLabel: string;
  notify: (message: string) => void;
}) {
  const nodes = processNodes[moduleId] || [
    { label: "Chuẩn bị", group: "prepare" as const },
    { label: "Thực hiện", group: "execute" as const },
    { label: "Kiểm tra", group: "control" as const },
  ];

  return (
    <div className="ref-audited-process">
      <header>
        <div>
          <p>WORKSPACE QUY TRÌNH · V5</p>
          <h2>Quy trình {moduleLabel}</h2>
          <span>
            Các nút bên dưới là bước nghiệp vụ, không phải tab cấp phân hệ.
          </span>
        </div>
        <span className="ref-process-version">
          <BadgeCheck size={15} /> Đã phân cấp
        </span>
      </header>
      <section className="ref-process-map" aria-label={`Sơ đồ ${moduleLabel}`}>
        {groups.map((group, groupIndex) => {
          const groupNodes = nodes.filter((item) => item.group === group.id);
          return (
            <div className="ref-process-stage" key={group.id}>
              <div className="ref-stage-heading">
                <span>{groupIndex + 1}</span>
                <group.icon size={17} />
                <h3>{group.label}</h3>
              </div>
              <div className="ref-stage-nodes">
                {groupNodes.map((item) => (
                  <button
                    key={item.label}
                    onClick={() =>
                      notify(`${item.label} đang dùng dữ liệu mẫu frontend.`)
                    }
                  >
                    {group.id === "control" ? (
                      <BookOpenCheck size={16} />
                    ) : group.id === "execute" ? (
                      <Workflow size={16} />
                    ) : (
                      <Boxes size={16} />
                    )}
                    <span>{item.label}</span>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>
      <footer>
        <span>
          <i /> Dữ liệu sẵn sàng
        </span>
        <span>
          <i /> Cần thực hiện
        </span>
        <span>
          <i /> Bước kiểm soát
        </span>
      </footer>
    </div>
  );
}
