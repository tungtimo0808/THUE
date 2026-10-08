import type { AuditedParameters } from "./audited-report-parameters";
export default function MisaReceivablesReconciliationPrinted({
  parameters,
  rows,
}: {
  parameters: AuditedParameters;
  rows: { id: string; cells: string[] }[];
}) {
  const period = (parameters.fields["Từ ngày"] || "")
    .slice(0, 7)
    .split("-")
    .reverse();
  const hideYear =
    parameters.checks["Không hiển thị công nợ lũy kế năm và công nợ quá hạn"];
  const labels = [
    "1. Công nợ tồn đầu kỳ",
    "2. Phát sinh tăng trong kỳ (2 = 2.1 + 2.2)",
    "- Trong đó",
    "2.1. Phải thu từ bán hàng",
    "2.2. Phải thu khác",
    "3. Phát sinh giảm trong kỳ (3 = 3.1 + 3.2 + 3.3)",
    "3.1. Thanh toán trong kỳ",
    "3.2. Chiết khấu thanh toán",
    "3.3. Giảm khác",
    "4. Công nợ cuối kỳ (4 = 1 + 2 − 3)",
    ...(hideYear
      ? []
      : [
          "5. Phát sinh tăng công nợ lũy kế năm",
          "6. Phát sinh giảm công nợ lũy kế năm",
          "7. Công nợ quá hạn thanh toán",
        ]),
  ];
  return (
    <section className="ar-print-canvas" aria-label="Nội dung báo cáo">
      <article className="ar-print-paper ar-debt-notice rc-confirmation">
        <p className="ar-print-company">Công ty TNHH Minh An</p>
        <h1>BIÊN BẢN ĐỐI CHIẾU &amp; XÁC NHẬN CÔNG NỢ</h1>
        {!rows.length ? (
          <p className="ar-print-empty">
            Không có dữ liệu phù hợp với điều kiện đã chọn
          </p>
        ) : (
          rows.map((row) => (
            <section className="ar-print-customer" key={row.id}>
              <p>
                <b>Bên bán:　Công ty TNHH Minh An</b>
              </p>
              <p>
                <b>Địa chỉ:</b>
              </p>
              <p>
                <b>Mã số thuế:</b>
              </p>
              <div className="rc-buyer-code">
                <b>Bên mua:</b>
                <label>
                  Mã khách hàng <b>KH00{row.id}</b>
                </label>
              </div>
              <table className="rc-customer">
                <tbody>
                  <tr>
                    <th>Khách hàng</th>
                    <td>
                      {row.id === "1"
                        ? "Công ty TNHH Hoàng Minh"
                        : "Công ty CP An Phát"}
                    </td>
                  </tr>
                  <tr>
                    <th>Địa chỉ</th>
                    <td></td>
                  </tr>
                  <tr>
                    <th>Điện thoại và điện thoại di động</th>
                    <td></td>
                  </tr>
                </tbody>
              </table>
              <p className="rc-period">
                <b>
                  <i>
                    Thời điểm xác nhận:　Tháng {period[0]} năm {period[1]}
                  </i>
                </b>
              </p>
              <div className="rc-table-caption">
                <b>Các nội dung đối chiếu:</b>
                <i>Đơn vị tính:　VND</i>
              </div>
              <table aria-label="Các nội dung đối chiếu công nợ">
                <tbody>
                  {labels.map((label) => (
                    <tr key={label}>
                      <td className={/^\d\./.test(label) ? "rc-bold" : ""}>
                        {label}
                      </td>
                      <td className="pc-number">
                        {label === "- Trong đó" ? "" : "0"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="rc-amount-words">
                <b>
                  Số tiền công nợ cuối kỳ viết bằng chữ:　<i>Không đồng.</i>
                </b>
              </p>
              <div className="ar-print-signatures">
                <div>
                  <b>Trân trọng cảm ơn!</b>
                  <p>
                    <b>Xác nhận của khách hàng</b>
                  </p>
                  <i>(Ký, họ tên)</i>
                </div>
                <div>
                  <b>Kế toán trưởng</b>
                  <i>(Ký, họ tên)</i>
                </div>
                <div>
                  <b>Giám đốc</b>
                  <i>(Ký, họ tên, đóng dấu)</i>
                </div>
              </div>
            </section>
          ))
        )}
        <small className="ar-print-fixture">Dữ liệu mẫu</small>
      </article>
    </section>
  );
}
