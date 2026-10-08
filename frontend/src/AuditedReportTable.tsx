import { reportColumns } from "./audited-report-schema";
import type { ReportHeader } from "./audited-report-schema";
import { numericReportHeader } from "./audited-report-fixtures";
export default function AuditedReportTable({
  name,
  headers,
  rows,
  hidden,
}: {
  name: string;
  headers: ReportHeader[][];
  rows: { id: string; cells: string[] }[];
  hidden: string[];
}) {
  const columns = reportColumns(headers).filter(
    (column) => !hidden.includes(column.id),
  );
  return (
    <div className="pc-report-scroll">
      <table aria-label={name}>
        <thead>
          {hidden.length ? (
            <tr>
              {columns.map((column) => (
                <th key={column.id}>{column.path}</th>
              ))}
            </tr>
          ) : (
            headers.map((row, index) => (
              <tr key={index}>
                {row.map((cell, position) => (
                  <th
                    key={position}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                  >
                    {cell.text}
                  </th>
                ))}
              </tr>
            ))
          )}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={
                    /^-?\d+(\.\d+)?$/.test(row.cells[Number(column.id)])
                      ? "pc-number"
                      : ""
                  }
                >
                  {row.cells[Number(column.id)]}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="pc-empty" colSpan={Math.max(columns.length, 1)}>
                Không có dữ liệu phù hợp với điều kiện đã chọn
              </td>
            </tr>
          )}
        </tbody>
        {!!rows.length && (
          <tfoot>
            <tr>
              {columns.map((column, index) => (
                <td key={column.id} className="pc-number">
                  {index === 0
                    ? "Tổng cộng"
                    : numericReportHeader(column.label) &&
                        rows.every((row) =>
                          /^-?\d+(\.\d+)?$/.test(row.cells[Number(column.id)]),
                        )
                      ? rows
                          .reduce(
                            (sum, row) =>
                              sum + Number(row.cells[Number(column.id)]),
                            0,
                          )
                          .toLocaleString("vi-VN")
                      : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
