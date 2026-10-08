import type { AuditedParameters } from "./audited-report-parameters";
import type { AuditedReportDefinition } from "./audited-report-schema";
import { reportColumns } from "./audited-report-schema";
export default function MisaReceivablesAgingPrinted({
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
  const end = parameters.fields["Đến ngày"] || "";
  return (
    <section className="ar-print-canvas" aria-label="Nội dung báo cáo">
      <article className="ar-print-paper ar-aging-paper">
        <p className="ar-print-company">Công ty TNHH Minh An</p>
        <h1>PHÂN TÍCH CÔNG NỢ PHẢI THU THEO TUỔI NỢ</h1>
        <p className="ar-print-period">
          Tài khoản: {parameters.fields["Tài khoản"] || "131"}; Đến ngày{" "}
          {end.split("-").reverse().join("/")}
        </p>
        <table aria-label={definition.name}>
          <colgroup>
            {columns.map((column) => (
              <col
                key={column.id}
                style={{
                  width:
                    Number(column.id) === 1 || Number(column.id) === 2
                      ? "12%"
                      : "5%",
                }}
              />
            ))}
          </colgroup>
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
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td colSpan={columns.length} style={{ padding: 0 }}>
                  <table className="ar-aging-group">
                    <colgroup>
                      {columns.map((column) => (
                        <col
                          key={column.id}
                          style={{
                            width:
                              Number(column.id) === 1 || Number(column.id) === 2
                                ? "12%"
                                : "5%",
                          }}
                        />
                      ))}
                    </colgroup>
                    <tbody>
                      <tr>
                        <td colSpan={columns.length}>
                          <b>
                            Mã nhóm khách hàng: NKH0{row.id}　Tên nhóm khách
                            hàng: {row.id === "1" ? "Doanh nghiệp" : "Cá nhân"}
                          </b>
                        </td>
                      </tr>
                      <tr>
                        {columns.map((column) => (
                          <td key={column.id}>
                            {row.cells[Number(column.id)]}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        {columns.map((column, index) => (
                          <td key={column.id}>
                            <b>
                              {index === 0
                                ? `Cộng nhóm: NKH0${row.id}`
                                : Number(column.id) > 2
                                  ? "0"
                                  : ""}
                            </b>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length}>
                  Không có dữ liệu phù hợp với điều kiện đã chọn
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              {columns.map((column, index) => (
                <td key={column.id}>
                  <b>
                    {index === 0
                      ? "Tổng cộng"
                      : Number(column.id) > 2
                        ? "0"
                        : ""}
                  </b>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
        <p className="ar-print-sign-date">
          Ngày {end.slice(8, 10)} tháng {end.slice(5, 7)} năm {end.slice(0, 4)}
        </p>
        <div className="ar-print-signatures">
          {["Người lập", "Kế toán trưởng", "Giám đốc"].map((label, i) => (
            <div key={label}>
              <b>{label}</b>
              <i>{i === 2 ? "(Ký, họ tên, đóng dấu)" : "(Ký, họ tên)"}</i>
            </div>
          ))}
        </div>
        <small className="ar-print-fixture">Dữ liệu mẫu</small>
      </article>
    </section>
  );
}
