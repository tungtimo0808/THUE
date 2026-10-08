import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeReportHeaders } from "../src/audited-report-schema.ts";
const output = fileURLToPath(new URL("../docs/misa-audit/", import.meta.url));
const rows = JSON.parse(
  fs.readFileSync(output + "/misa-report-schemas.json", "utf8"),
);
const periods = JSON.parse(
  fs.readFileSync(output + "/misa-period-options.json", "utf8"),
);
const metaPath = output + "/misa-report-field-metadata.json";
const metadata = fs.existsSync(metaPath)
  ? JSON.parse(fs.readFileSync(metaPath, "utf8"))
  : {};
function titleFor(headers) {
  const text = headers.join(" ");
  if (/Số chứng từ/.test(text)) return "Chứng từ";
  if (/Mã kho|Tên kho/.test(text)) return "Kho";
  if (/Mã hàng|Tên hàng|Mã vật tư/.test(text)) return "Vật tư, hàng hóa";
  if (/Mã NCC|Tên NCC|nhà cung cấp/.test(text)) return "Nhà cung cấp";
  if (/khách hàng/.test(text)) return "Khách hàng";
  if (/Mã nhân viên|Tên nhân viên/.test(text)) return "Nhân viên";
  if (/hợp đồng/.test(text)) return "Hợp đồng";
  if (/đơn hàng|đơn đặt hàng/.test(text)) return "Đơn hàng";
  if (/công trình/.test(text)) return "Công trình";
  if (/đơn vị/.test(text)) return "Đơn vị";
  if (/TK|tài khoản/.test(text)) return "Tài khoản";
  if (/Mã thống kê/.test(text)) return "Mã thống kê";
  if (/Lệnh sản xuất/.test(text)) return "Lệnh sản xuất";
  return headers.find(Boolean) || "Đối tượng";
}
const definitions = rows
  .filter(
    (row) =>
      ((row.viewer ??
        (row.url.includes("RPDynamicViewer") ? "dynamic" : "parameterOnly")) ===
        "dynamic" &&
        row.tables?.[0]?.length) ||
      metadata[row.name]?.printLayout,
  )
  .map((row) => {
    const selectors = row.tables
      .slice(metadata[row.name]?.printLayout ? 0 : 1)
      .map((table) => {
        const headers = (table.at(-1) || [])
          .map((cell) => cell.text)
          .filter(Boolean);
        return { title: titleFor(headers), headers };
      })
      .filter((selector) => selector.headers.length);
    const selectLabels = row.checkboxes.filter((check) =>
      /^Chọn (tất cả|khách hàng|nhà cung cấp|vật tư)/.test(check.label),
    );
    selectors.forEach((selector, index) => {
      if (metadata[row.name]?.printLayout && selector.title === "Tài khoản")
        return;
      if (metadata[row.name]?.printLayout && selector.title === "Khách hàng") {
        selector.selectAllLabel = selectLabels[0]?.label;
        return;
      }
      if (selectLabels[index])
        selector.selectAllLabel = selectLabels[index].label;
    });
    const fields = (metadata[row.name]?.fields ?? row.fields ?? []).map(
      ({ label, kind, required, default: value }) => ({
        label,
        kind,
        required,
        default: value,
      }),
    );
    return {
      name: row.name,
      category: row.category,
      viewer: "dynamic",
      headers: normalizeReportHeaders(
        metadata[row.name]?.printHeaders ?? row.tables[0],
      ),
      printLayout: metadata[row.name]?.printLayout,
      labels: [
        ...new Set([...row.labels, ...fields.map((field) => field.label)]),
      ],
      selectors,
      checkboxes: row.checkboxes.filter(
        (check) => !selectLabels.includes(check),
      ),
      fields,
      radios: metadata[row.name]?.radios ?? row.radios ?? [],
      options: { "Kỳ báo cáo": periods, ...metadata[row.name]?.options },
    };
  });
fs.writeFileSync(
  new URL("../src/misa-report-definitions.json", import.meta.url),
  JSON.stringify(definitions, null, 2),
);
fs.writeFileSync(
  new URL("../src/misa-report-definitions.ts", import.meta.url),
  `import type { AuditedReportDefinition } from './audited-report-schema';\nexport const MISA_REPORT_DEFINITIONS: AuditedReportDefinition[] = ${JSON.stringify(definitions, null, 2)};\n`,
);
console.log(
  JSON.stringify({
    definitions: definitions.length,
    byCategory: Object.fromEntries(
      [...new Set(definitions.map((row) => row.category))].map((category) => [
        category,
        definitions.filter((row) => row.category === category).length,
      ]),
    ),
  }),
);
