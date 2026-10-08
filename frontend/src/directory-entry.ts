export const requiredDirectoryField = (label: string) =>
  /^Mã(?! số)(?: |$)|^Tên(?: |$)|^Họ và tên$/.test(label);
export function normalizeDirectoryValues(
  fields: { label: string }[],
  headers: string[],
  values: Record<string, string>,
): Record<string, string> {
  const result = { ...values };
  if (headers.includes("Phát sinh định kỳ"))
    result["Phát sinh định kỳ"] =
      values["Là khoản phát sinh định kỳ hàng tháng"] === "true" ? "Có" : "";
  for (const pattern of [/^Mã(?! số)(?: |$)/, /^Tên(?: |$)|^Họ và tên$/]) {
    const field = fields.find((item) => pattern.test(item.label))?.label;
    const header = headers.find((item) => pattern.test(item));
    if (field && header) {
      const value = values[field] ?? values[header] ?? "";
      result[field] = value;
      result[header] = value;
    }
  }
  if (headers.includes("Trạng thái") && !result["Trạng thái"])
    result["Trạng thái"] = "Đang sử dụng";
  return result;
}
export function validateDirectoryEntry(
  fields: { label: string }[],
  values: Record<string, string>,
  existing: { id: string; values: Record<string, string> }[],
  id: string,
): string {
  if (
    fields.some(
      (field) =>
        requiredDirectoryField(field.label) && !values[field.label]?.trim(),
    )
  )
    return "Vui lòng nhập đầy đủ mã và tên danh mục.";
  const code = fields.find((field) => /^Mã(?! số)(?: |$)/.test(field.label));
  if (
    code &&
    existing.some(
      (row) =>
        row.id !== id &&
        row.values[code.label]?.trim().toLocaleUpperCase("vi") ===
          values[code.label]?.trim().toLocaleUpperCase("vi"),
    )
  )
    return "Mã danh mục đã tồn tại. Vui lòng nhập mã khác.";
  return "";
}
