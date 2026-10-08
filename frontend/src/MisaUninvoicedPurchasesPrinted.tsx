import type { AuditedParameters } from "./audited-report-parameters";
import type { AuditedReportDefinition } from "./audited-report-schema";
import { reportColumns } from "./audited-report-schema";
export default function MisaUninvoicedPurchasesPrinted({
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
  const from = parameters.fields["Từ ngày"] || "",
    to = parameters.fields["Đến ngày"] || "";
  return (
    <section className="ar-print-canvas" aria-label="Nội dung báo cáo">
      <article className="ar-print-paper up-print">
        <div className="up-form-number">
          <b>Mẫu số: 02/TNDN</b>
          <p>
            <i>(Ban hành kèm theo Thông tư số 20/2026/BTC của Bộ Tài chính)</i>
          </p>
        </div>
        <h1>
          BẢNG KÊ THU MUA HÀNG HÓA, DỊCH VỤ
          <br />
          MUA VÀO KHÔNG CÓ HÓA ĐƠN
        </h1>
        <p className="ar-print-period">
          {parameters.radio === "Theo tháng"
            ? `Tháng ${parameters.fields.Tháng} năm ${parameters.fields.Năm}`
            : `Ngày ${from.split("-").reverse().join("/")}`}
        </p>
        <div className="up-company">
          <p>- Tên doanh nghiệp: Công ty TNHH Minh An</p>
          <p>- Mã số thuế:</p>
          <p>- Địa chỉ:</p>
          <p>- Điện thoại:</p>
          <p>
            - Địa chỉ nơi tổ chức thu mua:{" "}
            {parameters.fields["Địa chỉ nơi tổ chức thu mua"] || ""}
          </p>
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
                <th key={column.id}>{Number(column.id) + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.id}>
                    {Number(column.id) === 9 &&
                    parameters.checks["Hiển thị số chứng từ trong phần ghi chú"]
                      ? `CT00${row.id}`
                      : row.cells[Number(column.id)]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="up-total">
          - Tổng giá trị hàng hóa mua vào: 0　　(Số tiền bằng chữ: Không đồng)
        </p>
        <p className="ar-print-sign-date">
          Ngày {to.slice(8, 10)} tháng {to.slice(5, 7)} năm {to.slice(0, 4)}
        </p>
        <div className="ar-print-signatures">
          <div>
            <b>Người lập bảng kê</b>
            <i>(Ký, ghi rõ họ tên)</i>
          </div>
          <div>
            <b>Giám đốc</b>
            <i>(Ký tên, đóng dấu)</i>
          </div>
        </div>
        <small className="ar-print-fixture">Dữ liệu mẫu</small>
      </article>
    </section>
  );
}
