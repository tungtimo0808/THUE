import type { AuditedReportDefinition } from "./audited-report-schema";
import type { AuditedParameters } from "./audited-report-parameters";
import AuditedReportTable from "./AuditedReportTable";

export default function AuditedPrintedReport({
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
  const end = parameters.fields["Đến ngày"] || "";
  return (
    <section className="ar-print-canvas" aria-label="Nội dung báo cáo">
      <article className="ar-print-paper">
        <p className="ar-print-company">Công ty TNHH Minh An</p>
        <h1>CHI TIẾT CÔNG NỢ PHẢI THU THEO MẶT HÀNG</h1>
        <p className="ar-print-period">
          Từ ngày {parameters.fields["Từ ngày"]?.split("-").reverse().join("/")}{" "}
          đến ngày {end.split("-").reverse().join("/")}
        </p>
        <p className="ar-print-account">
          Tài khoản: 131 - Phải thu của khách hàng
        </p>
        {rows.length === 0 ? (
          <p className="ar-print-empty">
            Không có dữ liệu phù hợp với điều kiện đã chọn
          </p>
        ) : (
          rows.map((row, index) => (
            <section className="ar-print-customer" key={index}>
              <p>
                <b>Mã khách hàng:</b> KH00{row.id}
              </p>
              <p>
                <b>Tên khách hàng:</b>{" "}
              {row.id === "1" ? "Công ty TNHH Hoàng Minh" : "Công ty CP An Phát"}
              </p>
              <AuditedReportTable
                name={definition.name}
                headers={definition.headers}
                rows={[row]}
                hidden={hidden}
              />
              <dl className="ar-print-balances">
                {[
                  "Công nợ đầu kỳ",
                  "Số phát sinh trong kỳ",
                  "Số đã thanh toán",
                  "Công nợ còn lại",
                ].map((label) => (
                  <div key={label}>
                    <dt>{label}:</dt>
                    <dd>0</dd>
                  </div>
                ))}
              </dl>
              <p className="ar-print-sign-date">
                Ngày {end.slice(8, 10)} tháng {end.slice(5, 7)} năm{" "}
                {end.slice(0, 4)}
              </p>
              <div className="ar-print-signatures">
                {["Người lập", "Kế toán trưởng", "Giám đốc"].map((role, i) => (
                  <div key={role}>
                    <b>{role}</b>
                    <i>{i === 2 ? "(Ký, họ tên, đóng dấu)" : "(Ký, họ tên)"}</i>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
        <small className="ar-print-fixture">Dữ liệu mẫu</small>
      </article>
    </section>
  );
}
