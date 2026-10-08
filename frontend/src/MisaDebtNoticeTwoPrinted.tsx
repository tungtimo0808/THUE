import type { AuditedParameters } from "./audited-report-parameters";
import type { AuditedReportDefinition } from "./audited-report-schema";
import { reportColumns } from "./audited-report-schema";
export default function MisaDebtNoticeTwoPrinted({
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
  const end = parameters.fields["Đến ngày"] || "",
    notice = parameters.fields["Ngày thông báo"] || end;
  const columns = reportColumns(definition.headers).filter(
    (column) => !hidden.includes(column.id),
  );
  const aging = [
    "Không có hạn nợ",
    "Chưa đến hạn",
    "Quá hạn 1-30 ngày",
    "Quá hạn 31-45 ngày",
    "Quá hạn 46-60 ngày",
    "Quá hạn trên 60 ngày",
    "Tổng số dư Nợ",
  ];
  return (
    <section className="ar-print-canvas" aria-label="Nội dung báo cáo">
      <article className="ar-print-paper ar-debt-notice dn-two">
        <div className="dn-national">
          <h2>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</h2>
          <b>Độc lập – Tự do – Hạnh phúc</b>
          <p>*********</p>
        </div>
        <h1>THÔNG BÁO CÔNG NỢ</h1>
        <p className="ar-print-sign-date">
          Ngày {notice.slice(8, 10)} tháng {notice.slice(5, 7)} năm{" "}
          {notice.slice(0, 4)}
        </p>
        {!rows.length ? (
          <p className="ar-print-empty">
            Không có dữ liệu phù hợp với điều kiện đã chọn
          </p>
        ) : (
          rows.map((row) => (
            <section className="ar-print-customer" key={row.id}>
              <p>
                <b>
                  BÊN MUA:{" "}
                  {row.id === "1"
                    ? "Công ty TNHH Hoàng Minh"
                    : "Công ty CP An Phát"}
                </b>
              </p>
              <p>
                <i>Địa chỉ:</i>
              </p>
              <p>
                <b>BÊN BÁN: Công ty TNHH Minh An</b>
              </p>
              <p>
                <i>Địa chỉ:</i>
              </p>
              <p>
                <b>
                  Hai bên thống nhất đối chiếu công nợ từ ngày{" "}
                  {parameters.fields["Từ ngày"]?.split("-").reverse().join("/")}{" "}
                  đến ngày {end.split("-").reverse().join("/")} như sau:
                </b>
              </p>
              <table aria-label={definition.name}>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column.id}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {columns.map((column) => (
                      <td key={column.id}>
                        {column.label === "Diễn giải" ? (
                          <b>Dư đầu kỳ</b>
                        ) : column.label === "Phải thu" ? (
                          "0"
                        ) : (
                          ""
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    {columns.map((column) => (
                      <td key={column.id}>{row.cells[Number(column.id)]}</td>
                    ))}
                  </tr>
                  {["Cộng phát sinh", "Dư cuối kỳ"].map((label) => (
                    <tr key={label}>
                      {columns.map((column) => (
                        <td key={column.id}>
                          {column.label === "Diễn giải" ? (
                            <b>{label}</b>
                          ) : column.label === "Phải thu" ? (
                            <b>0</b>
                          ) : (
                            ""
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <table className="dn-aging">
                <thead>
                  <tr>
                    {aging.map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {aging.map((label) => (
                      <td key={label}>0</td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <p>Bằng chữ: Không đồng.</p>
              <p>
                Tính đến ngày {end.split("-").reverse().join("/")} số công nợ
                còn lại là 0 VND. Kính mong Quý Công ty thanh toán theo thông
                tin sau:
              </p>
              <dl className="dn-bank">
                <div>
                  <dt>Người thụ hưởng:</dt>
                  <dd>Công ty TNHH Minh An</dd>
                </div>
                <div>
                  <dt>Số tài khoản:</dt>
                  <dd>
                    {parameters.fields["TK ngân hàng yêu cầu thanh toán"] || ""}
                  </dd>
                </div>
                <div>
                  <dt>Ngân hàng:</dt>
                  <dd></dd>
                </div>
                <div>
                  <dt>Địa chỉ chi nhánh:</dt>
                  <dd></dd>
                </div>
              </dl>
            </section>
          ))
        )}
        <small className="ar-print-fixture">Dữ liệu mẫu</small>
      </article>
    </section>
  );
}
