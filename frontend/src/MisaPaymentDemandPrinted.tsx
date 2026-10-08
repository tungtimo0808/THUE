import type { AuditedParameters } from "./audited-report-parameters";
export default function MisaPaymentDemandPrinted({
  parameters,
  rows,
}: {
  parameters: AuditedParameters;
  rows: { id: string; cells: string[] }[];
}) {
  const date =
    parameters.fields["Ngày đề nghị"] || parameters.fields["Đến ngày"] || "";
  const format = (value: string) => value.split("-").reverse().join("/");
  return (
    <section className="ar-print-canvas" aria-label="Nội dung báo cáo">
      <article className="ar-print-paper ar-debt-notice pd-letter">
        <header>
          <p>Công ty TNHH Minh An</p>
          <div>
            <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b>
            <p>
              <b>Độc lập - Tự do - Hạnh phúc</b>
            </p>
          </div>
        </header>
        <h1>GIẤY ĐỀ NGHỊ THANH TOÁN CÔNG NỢ</h1>
        {!rows.length ? (
          <p className="ar-print-empty">
            Không có dữ liệu phù hợp với điều kiện đã chọn
          </p>
        ) : (
          rows.map((row) => (
            <section className="ar-print-customer" key={row.id}>
              <p>
                <b>
                  <i>Kính gửi:</i>
                </b>
              </p>
              <p>
                <b>
                  Đơn vị:{" "}
                  {row.id === "1"
                    ? "Công ty TNHH Hoàng Minh"
                    : "Công ty CP An Phát"}
                </b>
              </p>
              <p>
                <b>Địa chỉ:</b>
              </p>
              <p>
                <b>Mã số thuế:</b>
              </p>
              <p>
                Căn cứ biên bản đối chiếu và xác nhận công nợ, đề nghị quý khách
                thanh toán khoản còn phải thu trong kỳ{" "}
                {format(parameters.fields["Từ ngày"] || "")} đến{" "}
                {format(parameters.fields["Đến ngày"] || "")}.
              </p>
              <p>
                Số tiền còn phải thanh toán: <b>0</b>　VND
              </p>
              <p>Số tiền bằng chữ: Không đồng.</p>
              <div className="pd-bank">
                <p>Thông tin tài khoản nhận thanh toán:</p>
                <p>Chủ tài khoản: Công ty TNHH Minh An</p>
                <p>
                  Số tài khoản: {parameters.fields["Tài khoản ngân hàng"] || ""}
                </p>
                <p>Tên ngân hàng:</p>
                <p>Chi nhánh:</p>
              </div>
              <p>Rất mong nhận được sự hợp tác từ Quý khách hàng.</p>
              <p>Trân trọng cảm ơn!</p>
              <div className="pd-signature">
                <i>
                  Ngày {date.slice(8, 10)} tháng {date.slice(5, 7)} năm{" "}
                  {date.slice(0, 4)}
                </i>
                <b>Giám đốc</b>
                <i>(Ký, họ tên, đóng dấu)</i>
              </div>
            </section>
          ))
        )}
        <small className="ar-print-fixture">Dữ liệu mẫu</small>
      </article>
    </section>
  );
}
