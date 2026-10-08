import type { AuditedParameters } from "./audited-report-parameters";
import type { AuditedReportDefinition } from "./audited-report-schema";
import { reportColumns } from "./audited-report-schema";
export default function MisaStockGroupsPrinted({
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
  const period = (parameters.fields["Từ ngày"] || "")
    .slice(0, 7)
    .split("-")
    .reverse();
  const indexes = ["A", "B", "C", "D", "1", "2", "3", "4", "5", "6", "7", "8"];
  return (
    <section className="ar-print-canvas" aria-label="Nội dung báo cáo">
      <article className="ar-print-paper sg-print">
        <p className="ar-print-company">Công ty TNHH Minh An</p>
        <h1>TỔNG HỢP TỒN KHO THEO NHÓM VẬT TƯ HÀNG HÓA</h1>
        <p className="ar-print-period">
          Tháng {period[0]} năm {period[1]}
        </p>
        <p>
          <b>Mã kho: KHO01</b>
        </p>
        <p>
          <b>Tên kho: Kho chính</b>
        </p>
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
                <th key={column.id}>{indexes[Number(column.id)]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td colSpan={columns.length} style={{ padding: 0 }}>
                  <table className="sg-group">
                    <tbody>
                      <tr>
                        {columns.map((column, i) => {
                          if (
                            !hidden.length &&
                            Number(column.id) > 0 &&
                            Number(column.id) < 4
                          )
                            return null;
                          return (
                            <td
                              key={column.id}
                              colSpan={!hidden.length && i === 0 ? 4 : 1}
                            >
                              <b>
                                {i === 0
                                  ? row.id === "1"
                                    ? "HH_Hàng hóa"
                                    : "VPP_Văn phòng phẩm"
                                  : Number(column.id) >= 4
                                    ? "0"
                                    : ""}
                              </b>
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        {columns.map((column) => (
                          <td key={column.id}>
                            {Number(column.id) === 0
                              ? index + 1
                              : row.cells[Number(column.id)]}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              {columns.map((column, index) => (
                <td key={column.id}>
                  <b>
                    {index === 0
                      ? "Tổng cộng"
                      : Number(column.id) >= 4
                        ? "0"
                        : ""}
                  </b>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
        <div className="ar-print-signatures">
          {["Người lập", "Kế toán trưởng", "Giám đốc"].map((label, index) => (
            <div key={label}>
              <b>{label}</b>
              <i>{index === 2 ? "(Ký, họ tên, đóng dấu)" : "(Ký, họ tên)"}</i>
            </div>
          ))}
        </div>
        <small className="ar-print-fixture">Dữ liệu mẫu</small>
      </article>
    </section>
  );
}
