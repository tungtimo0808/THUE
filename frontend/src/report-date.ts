export function parseReportDate(text: string): string {
  const cleaned = text.trim();
  const parts = /^\d{4}-\d{2}-\d{2}$/.test(cleaned)
    ? cleaned.split("-")
    : /^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)
      ? cleaned.split("/").reverse()
      : [];
  if (!parts.length) return "";
  const [year, month, day] = parts.map(Number);
  const date = new Date(year, month - 1, day);
  if (
    year < 1000 ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return "";
  return parts.join("-");
}
export const formatReportDate = (value: string) =>
  value ? value.split("-").reverse().join("/") : "";
