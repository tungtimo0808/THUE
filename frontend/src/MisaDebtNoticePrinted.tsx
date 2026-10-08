import type { AuditedParameters } from "./audited-report-parameters";
import AuditedReportTable from "./AuditedReportTable";
import type { AuditedReportDefinition } from "./audited-report-schema";
export default function MisaDebtNoticePrinted({
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
  const date = (
    parameters.fields["Ngày thông báo"] ||
    parameters.fields["Đến ngày"] ||
    ""
  )
    .split("-")
    .reverse()
    .join("/");
  const period = (parameters.fields["Từ ngày"] || "")
    .slice(0, 7)
    .split("-")
    .reverse();
  const aging = [
    "Không có hạn nợ",
    "Chưa đến hạn",
    "Quá hạn 1-30 ngày",
    "Quá hạn 31-60 ngày",
    "Quá hạn 61-90 ngày",
    "Quá hạn 91-120 ngày",
    "Quá hạn trên 120 ngày",
    "Tổng số dư Nợ",
  ];
  return (
    <section className="ar-print-canvas" aria-label="Nội dung báo cáo">
      <article className="ar-print-paper ar-debt-notice">
        <p className="ar-print-company">Công ty TNHH Minh An</p>
        <h1>THÔNG BÁO CÔNG NỢ</h1>
        <p className="ar-print-account">Ngày in: {date}</p>
        {!rows.length ? (
          <p className="ar-print-empty">
            Không có dữ liệu phù hợp với điều kiện đã chọn
          </p>
        ) : (
          rows.map((row) => (
            <section key={row.id} className="ar-print-customer">
              <div className="dn-contact-summary">
                <section>
                  <h3>Kính gửi:</h3>
                  <p>
                    Tên cơ sở sản xuất kinh doanh:{" "}
                    {row.id === "1"
                      ? "Công ty TNHH Hoàng Minh"
                      : "Công ty CP An Phát"}
                  </p>
                  <p>Địa chỉ:</p>
                  <p>Số điện thoại:</p>
                  <p>Mã số thuế:</p>
                </section>
                <section>
                  <h3>Kỳ</h3>
                  <p className="dn-period">
                    Tháng {period[0]} năm {period[1]}
                  </p>
                  <dl>
                    <div>
                      <dt>Số dư cuối kỳ</dt>
                      <dd>0</dd>
                    </div>
                    <div>
                      <dt>Số dư đầu kỳ</dt>
                      <dd>0</dd>
                    </div>
                  </dl>
                </section>
              </div>
              <AuditedReportTable
                name={definition.name}
                headers={definition.headers}
                rows={[row]}
                hidden={hidden}
              />
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
              <div className="dn-signature">
                <b>Người lập</b>
                <i>(Ký, họ tên)</i>
              </div>
            </section>
          ))
        )}
        <small className="ar-print-fixture">Dữ liệu mẫu</small>
      </article>
    </section>
  );
}
