import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money, type Transaction } from "./data";

export default function FinancialChart({
  items,
  period,
}: {
  items: Transaction[];
  period: string;
}) {
  const yearly = period.length === 4;
  const data = Array.from({ length: yearly ? 12 : 6 }, (_, i) => {
    const group = items.filter((t) =>
      yearly
        ? Number(t.date.slice(5, 7)) === i + 1
        : Math.min(5, Math.floor((Number(t.date.slice(8)) - 1) / 5)) === i,
    );
    return {
      name: yearly
        ? `T${i + 1}`
        : `${String(i * 5 + 1).padStart(2, "0")}–${Math.min((i + 1) * 5, new Date(Number(period.slice(0, 4)), Number(period.slice(5)), 0).getDate())}`,
      thu: group
        .filter((t) => t.kind === "receipt" || t.kind === "bank")
        .reduce((s, t) => s + t.amount, 0),
      chi: group
        .filter((t) => t.kind === "payment")
        .reduce((s, t) => s + t.amount, 0),
    };
  });
  return (
    <>
      <div
        className="financial-chart"
        role="img"
        aria-label="Biểu đồ dòng tiền thu và chi theo kỳ. Bảng số liệu tương đương ở bên dưới."
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 15, right: 12, left: -12, bottom: 0 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3478f6" stopOpacity={0.17} />
                <stop offset="100%" stopColor="#3478f6" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 4"
              vertical={false}
              stroke="#e7ecf3"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#65738b", fontSize: 11 }}
              dy={9}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v / 1000000} tr`}
              tick={{ fill: "#65738b", fontSize: 11 }}
            />
            <Tooltip
              formatter={(value, name) => [
                money(Number(value)),
                name === "thu" ? "Tiền thu" : "Tiền chi",
              ]}
              contentStyle={{
                border: "1px solid #e7ecf3",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="chi"
              stroke="#91add5"
              fill="transparent"
              strokeWidth={2}
              strokeDasharray="5 4"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="thu"
              stroke="#3478f6"
              fill="url(#incomeFill)"
              strokeWidth={3}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-data">
        <summary>Xem bảng số liệu</summary>
        <table>
          <caption>Dòng tiền theo {yearly ? "tháng" : "nhóm ngày"}</caption>
          <thead>
            <tr>
              <th>Kỳ</th>
              <th>Thu</th>
              <th>Chi</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.name}>
                <td>{d.name}</td>
                <td>{money(d.thu)}</td>
                <td>{money(d.chi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
