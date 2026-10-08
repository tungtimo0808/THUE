import type { AuditedParameters } from "./audited-report-parameters";
import type { AuditedReportDefinition } from "./audited-report-schema";
import { reportColumns } from "./audited-report-schema";
import { selectorSampleRows } from "./audited-report-fixtures";
export default function MisaGeneralLedgerPrinted({
  definition,
  parameters,
  rows,
  hidden,
}: {
  definition: AuditedReportDefinition;
  parameters: AuditedParameters;
  rows: { id: string; cells: string[] }[];
  hidden: string[];
}) {
  const columns = reportColumns(definition.headers).filter(
      (column) => !hidden.includes(column.id),
    ),
    letters = ["A", "B", "C", "D", "E", "G", "H", "1", "2"];
  const from = parameters.fields["Từ ngày"] || "",
    to = parameters.fields["Đến ngày"] || "";
  const accountIndex = definition.selectors.findIndex(selector => selector.title === "Tài khoản");
  const accountSelector = definition.selectors[accountIndex];
  const accounts = accountSelector
    ? selectorSampleRows(accountSelector).filter(row => parameters.selected[String(accountIndex)]?.includes(row.id))
    : [];
  const accountCaption = accounts.map(row => row.cells.slice(0, 2).join(" - ")).join("; ");
  const balanceRow = (label: string) => (
    <tr key={label}>
      {columns.map((column) => (
        <td key={column.id}>
          <b>
            {Number(column.id) === 3
              ? label
              : Number(column.id) >= 7
                ? "0"
                : ""}
          </b>
        </td>
      ))}
    </tr>
  );
  return (
    <section className="ar-print-canvas" aria-label="Nội dung báo cáo">
      <article className="ar-print-paper ar-debt-notice gl-print">
        <header>
          <p>Công ty TNHH Minh An</p>
          <div>
            <b>Mẫu số: S03b-DN</b>
            <p>
              <i>
                (Kèm theo Thông tư số 99/2025/TT-BTC
                <br />
                ngày 27 tháng 10 năm 2025 của Bộ trưởng Bộ Tài chính)
              </i>
            </p>
          </div>
        </header>
        <h1>SỔ CÁI</h1>
        <p className="gl-description">
          <b>(Dùng cho hình thức kế toán Nhật ký chung)</b>
        </p>
        <p className="ar-print-period">
          Tháng {from.slice(5, 7)} năm {from.slice(0, 4)}
        </p>
        <div className="gl-account">
          <b>Tài khoản: {accountCaption || parameters.fields["Tài khoản"] || ""}</b>
          <i>Đơn vị tính: VND</i>
        </div>
        <table aria-label={definition.name}>
          <thead>
            {hidden.length ? (
              <tr>
                {columns.map((column) => (
                  <th key={column.id}>{column.path}</th>
                ))}
              </tr>
            ) : (
              definition.headers.map((header, index) => (
                <tr key={index}>
                  {header.map((cell, i) => (
                    <th key={i} colSpan={cell.colSpan} rowSpan={cell.rowSpan}>
                      {cell.text}
                    </th>
                  ))}
                </tr>
              ))
            )}
            <tr>
              {columns.map((column) => (
                <th key={column.id}>{letters[Number(column.id)]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {balanceRow("- Số dư đầu kỳ")}
            {balanceRow("- Số phát sinh trong kỳ")}
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.id}>
                    {Number(column.id) === 1
                      ? `CT00${row.id}`
                      : Number(column.id) === 6
                        ? "5111"
                        : row.cells[Number(column.id)]}
                  </td>
                ))}
              </tr>
            ))}
            {[
              "- Cộng số phát sinh",
              "- Số dư cuối kỳ",
              "- Cộng lũy kế từ đầu năm",
            ].map(balanceRow)}
          </tbody>
        </table>
        <p className="gl-page-note">
          - Sổ này có 01 trang, đánh số từ trang số 01 đến trang 01
        </p>
        <p>- Ngày mở sổ: ...................</p>
        <p className="ar-print-sign-date">
          Ngày {to.slice(8, 10)} tháng {to.slice(5, 7)} năm {to.slice(0, 4)}
        </p>
        <div className="ar-print-signatures">
          {["Người ghi sổ", "Kế toán trưởng", "Giám đốc"].map(
            (label, index) => (
              <div key={label}>
                <b>{label}</b>
                <i>{index === 2 ? "(Ký, họ tên, đóng dấu)" : "(Ký, họ tên)"}</i>
              </div>
            ),
          )}
        </div>
        <small className="ar-print-fixture">Dữ liệu mẫu</small>
      </article>
    </section>
  );
}
