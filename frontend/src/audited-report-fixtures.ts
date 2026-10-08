import type { AuditedParameters } from "./audited-report-parameters";
import type {
  AuditedReportDefinition,
  ReportSelector,
} from "./audited-report-schema";
import { reportColumns } from "./audited-report-schema";
export const numericReportHeader = (header: string) =>
  !/^(Mã|Tên|Ngày|TK|Tài khoản|Số chứng từ|Số hóa đơn|Số hợp đồng|Tình trạng|Trạng thái)/.test(
    header,
  ) &&
  /Số lượng|Số dư|Phát sinh|Doanh|Tiền|Giá trị|Đơn giá|Lương|lương|BHXH|BHYT|BHTN|Lãi|Chiết khấu|Thuế|thuế|Chi phí|chi phí|Chênh lệch|Hệ số|Tổng số|Tổng cộng|Tỷ lệ|Nợ|Có|Số tiền|Bậc|Số ngày/.test(
    header,
  );
export function selectorSampleRows(selector: ReportSelector) {
  return [1, 2].map((index) => ({
    id: String(index),
    cells: selector.headers.map((header) => sampleCell(header, index)),
  }));
}
export function reportReferenceChoices(label: string) {
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
  if (/Số chứng từ/.test(header)) return `CT00${index}`;
  if (/Số hóa đơn/.test(header)) return `00000${index}`;
  if (/Số hợp đồng/.test(header)) return `HD00${index}`;
  if (/^Mã/.test(header))
    return `${/kho/.test(header) ? "KHO" : /hàng|vật tư/.test(header) ? "HH" : /nhân viên/.test(header) ? "NV" : /NCC|nhà cung cấp/.test(header) ? "NCC" : /khách hàng/.test(header) ? "KH" : "DT"}00${index}`;
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
      if (fields["Năm"] && fields["Năm"] !== "2026") return false;
      if (fields["Tháng"] && fields["Tháng"] !== "2026-10") return false;
      if (
        definition.selectors.some(
          (_, position) =>
            !parameters.selected[String(position)]?.includes(String(index)),
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
          /Chỉ (lấy|hiển thị)|Không hiển thị/.test(label) &&
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
