import type { AuditedParameters } from "./audited-report-parameters";
import type { AuditedReportDefinition } from "./audited-report-schema";
import { reportColumns } from "./audited-report-schema";
export default function MisaSalesInventoryPrinted({
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
  );
  const date =
      parameters.fields["Ngày in báo cáo"] ||
      parameters.fields["Đến ngày"] ||
      "",
    end = parameters.fields["Đến ngày"] || "";
  const letters = ["A", "B", "C", "D", "1", "2", "3"];
  const summaryCells = (label: string, document = "") =>
    columns.map((column, index) => {
      const position = Number(column.id);
      if (!hidden.length && position === 0)
        return (
          <td key={column.id} colSpan={3}>
            <b>{document}</b>
          </td>
        );
      if (!hidden.length && (position === 1 || position === 2)) return null;
      return (
        <td key={column.id}>
          <b>
            {hidden.length && index === 0 && document
              ? document
              : position === 3
                ? label
                : position === 4
                  ? "0,00"
                  : position === 6
                    ? "0"
                    : ""}
          </b>
        </td>
      );
    });
  return (
    <section className="ar-print-canvas" aria-label="Nội dung báo cáo">
      <article className="ar-print-paper ar-debt-notice si-print">
        <p className="ar-print-company">Công ty TNHH Minh An</p>
        <h1>TỔNG HỢP XUẤT KHO BÁN HÀNG</h1>
        <p className="ar-print-period">
          Ngày {date.split("-").reverse().join("/")}
        </p>
        <p className="si-stock">
          <b>Mã kho: KHO01</b>
        </p>
        <table aria-label={definition.name}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id}>{column.label}</th>
              ))}
            </tr>
            <tr>
              {columns.map((column) => (
                <th key={column.id}>{letters[Number(column.id)]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.id}>
                    {Number(column.id) === 0
                      ? index + 1
                      : row.cells[Number(column.id)]}
                  </td>
                ))}
              </tr>
            ))}
            {rows.map((row) => (
              <tr key={`total-${row.id}`}>
                {summaryCells("Cộng", `Số CTBH: CT00${row.id}`)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>{summaryCells("Tổng cộng")}</tr>
          </tfoot>
        </table>
        <p className="ar-print-sign-date">
          Ngày {end.slice(8, 10)} tháng {end.slice(5, 7)} năm {end.slice(0, 4)}
        </p>
        <div className="ar-print-signatures">
          {["Thủ kho", "Người lập", "Kế toán trưởng", "Giám đốc"].map(
            (label, i) => (
              <div key={label}>
                <b>{label}</b>
                <i>{i === 3 ? "(Ký, họ tên, đóng dấu)" : "(Ký, họ tên)"}</i>
              </div>
            ),
          )}
        </div>
        <small className="ar-print-fixture">Dữ liệu mẫu</small>
      </article>
    </section>
  );
}
