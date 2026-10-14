import type { AuditedParameters } from "./audited-report-parameters";
import type {
  AuditedReportDefinition,
  ReportSelector,
} from "./audited-report-schema";
import { reportColumns } from "./audited-report-schema";
import { reportAccountSelectorRows } from "./report-account-selector-rows";
export const numericReportHeader = (header: string) =>
  !/^(Mã|Tên|Ngày|TK|Tài khoản|Số chứng từ|Số hóa đơn|Số hợp đồng|Tình trạng|Trạng thái)/.test(
    header,
  ) &&
  /Số lượng|Số dư|Phát sinh|Doanh|Tiền|Giá trị|Đơn giá|Lương|lương|BHXH|BHYT|BHTN|Lãi|Chiết khấu|Thuế|thuế|Chi phí|chi phí|Chênh lệch|Hệ số|Tổng số|Tổng cộng|Tỷ lệ|Nợ|Có|Số tiền|Bậc|Số ngày|Phải thu|Phải trả|Thanh toán|Giảm trừ|Trả lại|Số đã thu|Số phải thu/.test(
    header,
  );
export function selectorSampleRows(selector: ReportSelector) {
  if (selector.title === "Tài khoản") {
    return reportAccountSelectorRows(selector.headers);
  }
  const contextualCell = (header: string, index: number): string | undefined => {
    if (selector.title === "Công trình") {
      if (header === "Mã công trình") return index === 1 ? "CT-TECHPARK" : "CT-NHAXUONG";
      if (header === "Tên công trình") return index === 1 ? "Tòa nhà Văn phòng TechPark" : "Nhà xưởng sản xuất";
      if (header === "Loại công trình") return "Công trình";
    }
    if (selector.title === "Thành phẩm") {
      if (header === "Mã thành phẩm") return index === 1 ? "TP-INOX" : "TP-POLO";
      if (header === "Tên thành phẩm") return index === 1 ? "Bàn ghế inox cao cấp" : "Áo Polo nam";
      if (header === "Mã đối tượng THCP") return index === 1 ? "THCP-CO KHI" : "THCP-MAY";
      if (header === "Quy trình sản xuất") return "Giản đơn";
    }
    if (selector.title === "Đối tượng tập hợp chi phí") {
      if (/^Mã/.test(header)) return index === 1 ? "THCP-CO KHI" : "THCP-MAY";
      if (/^Tên/.test(header)) return index === 1 ? "Xưởng Cơ khí chế tạo" : "Xưởng May xuất khẩu";
      if (/^Loại/.test(header)) return "Phân xưởng";
    }
    if (selector.title === "Tài sản cố định") {
      if (/^Mã/.test(header)) return index === 1 ? "TS-MAY01" : "TS-XE01";
      if (/^Tên/.test(header)) return index === 1 ? "Máy gia công CNC" : "Ô tô vận tải";
      if (/Loại/.test(header)) return index === 1 ? "Máy móc, thiết bị" : "Phương tiện vận tải, truyền dẫn";
    }
    if (selector.title === "Đơn đặt hàng") {
      if (header === "Số đơn hàng") return `DDH-2026-00${index}`;
      if (header === "Ngày đơn hàng") return `0${index + 5}/10/2026`;
      if (header === "Khách hàng") return index === 1 ? "Công ty TNHH Hoàng Minh" : "Công ty CP An Phát";
      if (header === "Diễn giải") return `Đơn đặt hàng bán số 00${index}`;
    }
    return undefined;
  };
  return [1, 2].map((index) => ({
    id: String(index),
    cells: selector.headers.map((header) =>
      selector.title === "Tài khoản" && header === "Số tài khoản"
        ? index === 1
          ? "131"
          : "136"
        : selector.title === "Tài khoản" && header === "Tên tài khoản"
          ? index === 1
            ? "Phải thu của khách hàng"
            : "Phải thu nội bộ"
          : header === "Bậc"
            ? "1"
            : (contextualCell(header, index) ?? sampleCell(header, index)),
    ),
  }));
}
export function reportReferenceChoices(label: string, reportName = "") {
  if (/Kỳ tính giá thành/.test(label) && /công trình/i.test(reportName))
    return [{ value: "CT-2026-01", label: "Tính giá thành Công trình Tòa nhà Văn phòng TechPark", detail: "Theo công trình" }];
  if (/Kỳ tính giá thành/.test(label) && /đơn hàng/i.test(reportName))
    return [{ value: "DH-2026-01", label: "Tính giá thành Đơn hàng DH-2026-0089 (Công ty Samy Electronics)", detail: "Theo đơn hàng" }];
  if (/Kỳ tính giá thành/.test(label) && /hợp đồng/i.test(reportName))
    return [{ value: "HD-2026-01", label: "Tính giá thành Hợp đồng HĐ-KT-2026/012 (Tập đoàn Hòa An)", detail: "Theo hợp đồng" }];
  if (/Kỳ tính giá thành/.test(label))
    return [
      { value: "GT-2026-01", label: "Tính giá thành T01/2026 - Xưởng Cơ khí chế tạo", detail: "Sản xuất liên tục - Giản đơn" },
      { value: "GT-2026-02", label: "Tính giá thành T02/2026 - Xưởng May xuất khẩu", detail: "Sản xuất liên tục - Giản đơn" },
      { value: "GT-2026-03", label: "Tính giá thành T03/2026 - Xưởng Nhựa công nghiệp", detail: "Sản xuất liên tục - Giản đơn" },
    ];
  if (/Loại tài sản cố định/.test(label))
    return [
      { value: "10", label: "Tài sản cố định hữu hình" },
      { value: "11", label: "Nhà cửa, vật kiến trúc" },
      { value: "12", label: "Máy móc, thiết bị" },
      { value: "13", label: "Phương tiện vận tải, truyền dẫn" },
      { value: "14", label: "Thiết bị, dụng cụ quản lý" },
      { value: "15", label: "Vườn cây lâu năm, súc vật làm việc và cho sản phẩm" },
      { value: "16", label: "Các TSCĐ là kết cấu hạ tầng, có giá trị lớn do Nhà nước ĐTXD từ NSNN giao cho các tổ chức kinh tế quản lý, khai thác, sử dụng" },
      { value: "17", label: "Tài sản cố định khác" },
      { value: "20", label: "Tài sản cố định vô hình" },
      { value: "21", label: "Quyền sử dụng đất" },
      { value: "22", label: "Quyền phát hành" },
      { value: "23", label: "Bản quyền, bằng sáng chế" },
      { value: "24", label: "Nhãn hiệu hàng hóa" },
      { value: "25", label: "Phần mềm máy vi tính" },
      { value: "26", label: "Giấy phép và giấy phép nhượng quyền" },
      { value: "27", label: "Tài sản cố định vô hình khác" },
    ];
  if (/Nhân viên/.test(label))
    return [
      { value: "NV001", label: "Nguyễn Minh" },
      { value: "NV002", label: "Lê An" },
    ];
  if (/Nhóm.*khách hàng/.test(label))
    return [
      { value: "Doanh nghiệp", label: "Doanh nghiệp" },
      { value: "Cá nhân", label: "Cá nhân" },
    ];
  if (/Nhóm.*(hàng|VTHH|vật tư|CCDC|tài sản|NCC|cung cấp)/.test(label))
    return [
      { value: "Thiết bị", label: "Thiết bị" },
      { value: "Văn phòng", label: "Văn phòng" },
    ];
  if (/Đơn vị|Chi nhánh|Bộ phận/.test(label))
    return [
      { value: "Trụ sở chính", label: "Trụ sở chính" },
      {
        value: "Chi nhánh TP. Hồ Chí Minh",
        label: "Chi nhánh TP. Hồ Chí Minh",
      },
    ];
  return [
    { value: "DT001", label: "Đối tượng mẫu 1" },
    { value: "DT002", label: "Đối tượng mẫu 2" },
  ];
}
export function sampleCell(header: string, index: number): string {
  if (/Mã số thuế|Địa chỉ|Ký nhận/.test(header)) return "";
  if (/^Ngày|ngày$/.test(header)) return `0${index + 5}/10/2026`;
  if (/^(TK|Tài khoản)|TK /.test(header)) return "131";
  if (/Số chứng từ/.test(header) || header === "Số") return `CT00${index}`;
  if (/Số hóa đơn/.test(header)) return `00000${index}`;
  if (/Số hợp đồng/.test(header)) return `HD00${index}`;
  if (/^Mã/.test(header))
    return `${/kho/.test(header) ? "KHO" : /khách hàng/.test(header) ? "KH" : /NCC|nhà cung cấp/.test(header) ? "NCC" : /hàng|vật tư/.test(header) ? "HH" : /nhân viên/.test(header) ? "NV" : "DT"}00${index}`;
  if (/Tên kho|Từ kho|Đến kho/.test(header))
    return index === 1 ? "Kho chính" : "Kho chi nhánh";
  if (/Tên hàng|Tên vật tư/.test(header))
    return index === 1 ? "Màn hình LG 24 inch" : "Giấy A4";
  if (/Tên khách hàng|Tên NCC|Tên nhà cung cấp|Tên đối tượng/.test(header))
    return index === 1 ? "Công ty TNHH Hoàng Minh" : "Công ty CP An Phát";
  if (/Tên đơn vị|Chi nhánh/.test(header))
    return index === 1 ? "Trụ sở chính" : "Chi nhánh TP. Hồ Chí Minh";
  if (/Họ và tên|Tên nhân viên/.test(header))
    return index === 1 ? "Nguyễn Minh" : "Lê An";
  if (/ĐVT|Đơn vị tính/.test(header)) return "Chiếc";
  if (/Diễn giải|Trích yếu/.test(header)) return `Chứng từ mẫu ${index}`;
  if (/Tình trạng|Trạng thái/.test(header))
    return index === 1 ? "Đang thực hiện" : "Đã thực hiện";
  if (/Tên/.test(header)) return `Đối tượng mẫu ${index}`;
  if (/Loại/.test(header)) return "Chứng từ kế toán";
  return numericReportHeader(header) ? "0" : "";
}
export function auditedFixtureRows(
  definition: AuditedReportDefinition,
  parameters: AuditedParameters,
  query = "",
) {
  const fields = parameters.fields;
  const columns = reportColumns(definition.headers);
  return [1, 2]
    .filter((index) => {
      const date = `2026-10-0${index + 5}`;
      if (fields["Từ ngày"] && date < fields["Từ ngày"]) return false;
      if (fields["Đến ngày"] && date > fields["Đến ngày"]) return false;
      const useMonthFields =
        definition.printLayout !== "taxUninvoiced" ||
        parameters.radio === "Theo tháng";
      if (useMonthFields && fields["Năm"] && fields["Năm"] !== "2026")
        return false;
      if (
        useMonthFields &&
        fields["Tháng"] &&
        fields["Tháng"] !==
          (definition.printLayout === "taxUninvoiced" ? "10" : "2026-10")
      )
        return false;
      if (
        definition.selectors.some(
          (selector, position) =>
            !parameters.selected[String(position)]?.includes(
              selector.title === "Tài khoản" ? "1" : String(index),
            ),
        )
      )
        return false;
      if (fields["Nhân viên"] && fields["Nhân viên"] !== `NV00${index}`)
        return false;
      for (const [label, value] of Object.entries(fields)) {
        if (!value) continue;
        if (
          /^Nhóm/.test(label) &&
          value !==
            (/khách hàng/.test(label)
              ? index === 1
                ? "Doanh nghiệp"
                : "Cá nhân"
              : index === 1
                ? "Thiết bị"
                : "Văn phòng")
        )
          return false;
        if (
          (label === "Đơn vị" ||
            label === "Đơn vị sử dụng" ||
            label === "Chi nhánh" ||
            label === "Bộ phận") &&
          value !== (index === 1 ? "Trụ sở chính" : "Chi nhánh TP. Hồ Chí Minh")
        )
          return false;
      }
      for (const [label, checked] of Object.entries(parameters.checks)) {
        if (
          checked &&
          /Chỉ (lấy|hiển thị)|Không hiển thị (khách hàng|nhà cung cấp|hàng hóa|nhân viên)/.test(
            label,
          ) &&
          index === 2
        )
          return false;
        if (!checked && /hàng khuyến mại/.test(label) && index === 2)
          return false;
      }
      return true;
    })
    .map((index) => ({
      id: String(index),
      cells: columns.map((column) => sampleCell(column.label, index)),
    }))
    .filter((row) =>
      row.cells
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")),
    );
}
