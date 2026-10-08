const fs = require("node:fs");
const base =
  require("node:path").resolve(__dirname, "../docs/misa-audit") + "/";
const schemas = JSON.parse(
  fs.readFileSync(base + "misa-module-schemas.json", "utf8"),
);
const forms = JSON.parse(
  fs.readFileSync(base + "misa-directory-forms.json", "utf8"),
);
const tabs = JSON.parse(
  fs.readFileSync(base + "misa-directory-tab-fields.json", "utf8"),
);
const groups = [
  [
    "Đối tượng",
    [
      "Khách hàng",
      "Nhà cung cấp",
      "Nhân viên",
      "Nhóm khách hàng, nhà cung cấp",
    ],
  ],
  [
    "Vật tư hàng hóa",
    ["Vật tư hàng hóa", "Kho", "Nhóm vật tư, hàng hóa, dịch vụ", "Đơn vị tính"],
  ],
  [
    "Tài khoản",
    ["Hệ thống tài khoản", "Tài khoản kết chuyển", "Tài khoản ngầm định"],
  ],
  [
    "Chi phí",
    [
      "Đối tượng tập hợp chi phí",
      "Khoản mục chi phí",
      "Công trình",
      "Loại công trình",
    ],
  ],
  ["Ngân hàng", ["Ngân hàng", "Tài khoản ngân hàng"]],
  ["Chi nhánh, phòng ban", ["Cơ cấu tổ chức"]],
  ["Tài sản", ["Loại công cụ dụng cụ", "Loại tài sản cố định"]],
  ["Tiền lương", ["Ký hiệu chấm công", "Biểu tính thuế thu nhập"]],
  ["Thuế", ["Biểu thuế tiêu thụ đặc biệt", "Biểu thuế tài nguyên"]],
  [
    "Khác",
    [
      "Điều khoản thanh toán",
      "Mục thu/chi",
      "Mã thống kê",
      "Loại tiền",
      "Loại chứng từ",
    ],
  ],
];
const normalize = (s) => s.replace(/\s+/g, " ").trim();
const definitions = groups.flatMap(([group, names]) =>
  names.map((name) => {
    const schema = schemas.find(
      (row) => row.module === "Danh mục" && normalize(row.page) === name,
    );
    const form = forms.find((row) => normalize(row.name) === name);
    const tabData = Object.fromEntries(
      tabs
        .filter((row) => normalize(row.name) === name)
        .map((row) => [
          row.tab,
          { fields: row.fields, headers: row.headers, checks: row.checks },
        ]),
    );
    if (name === "Khách hàng") {
      tabData["Ghi chú"] = {
        fields: [{ label: "Ghi chú", kind: "textarea" }],
        headers: [],
        checks: [],
      };
      tabData["Thông tin bổ sung"] = {
        fields: [1, 2, 3, 4, 5].map((index) => ({
          label: "Trường mở rộng " + index,
          kind: "text",
        })),
        headers: [],
        checks: [],
      };
    }
    let fields = form?.fields || [];
    if (name === "Khách hàng" || name === "Nhà cung cấp") {
      fields = fields.filter((field) => field.label !== "Đại diện theo PL");
      const position = fields.findIndex(
        (field) => field.label === "Tên " + name.toLowerCase(),
      );
      fields.splice(position + 1, 0, { label: "Địa chỉ", kind: "textarea" });
    }
    if (name === "Mục thu/chi")
      fields = [...fields, { label: "Diễn giải", kind: "textarea" }];
    if (name === "Kho")
      fields = [...fields, { label: "Địa chỉ", kind: "textarea" }];
    const radios =
      name === "Khách hàng"
        ? ["Tổ chức", "Cá nhân"]
        : name === "Mục thu/chi"
          ? ["Mục thu", "Mục chi"]
          : [];
    return {
      name,
      group,
      headers: [...new Set((schema?.headers?.[0]?.[0] || []).filter(Boolean))],
      fields,
      tabs: form?.tabs || [],
      tabData,
      checks: form?.checks || [],
      radios,
      canAdd: schema?.buttons.includes("Thêm") || !!form,
      formObserved: !!form,
    };
  }),
);
fs.writeFileSync(
  require("node:path").resolve(
    __dirname,
    "../src/misa-directory-definitions.ts",
  ),
  `export interface DirectoryTabDefinition {fields:{label:string;kind:string}[];headers:string[][];checks:string[]}\nexport interface DirectoryDefinition {name:string;group:string;headers:string[];fields:{label:string;kind:string}[];tabs:string[];tabData:Record<string,DirectoryTabDefinition>;checks:string[];radios:string[];canAdd:boolean;formObserved:boolean}\nexport const MISA_DIRECTORY_DEFINITIONS:DirectoryDefinition[]=${JSON.stringify(definitions, null, 2)};\n`,
);
console.log(
  JSON.stringify({
    groups: groups.length,
    definitions: definitions.length,
    observedForms: definitions.filter((d) => d.formObserved).length,
    missingHeaders: definitions
      .filter((d) => !d.headers.length)
      .map((d) => d.name),
  }),
);
