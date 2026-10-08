import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { formatReportDate, parseReportDate } from "./report-date";
export default function ReportDateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(() => formatReportDate(value));
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(formatReportDate(value));
    }
  }, [value]);
  return (
    <div className="pc-date-input">
      <input
        aria-label={label}
        placeholder="DD/MM/YYYY"
        inputMode="numeric"
        value={text}
        onInput={(event) => {
          const next = event.currentTarget.value;
          setText(next);
          lastEmitted.current = parseReportDate(next);
          onChange(lastEmitted.current);
        }}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const parsed = parseReportDate(text);
          if (parsed) setText(formatReportDate(parsed));
        }}
      />
      <CalendarDays size={15} aria-hidden="true" />
      <input
        className="pc-native-date"
        type="date"
        aria-label={`${label} (lịch)`}
        value={value}
        onInput={(event) => {
          const next = event.currentTarget.value;
          lastEmitted.current = next;
          setText(formatReportDate(next));
          onChange(next);
        }}
        onChange={(event) => {
          const next = event.target.value;
          lastEmitted.current = next;
          setText(formatReportDate(next));
          onChange(next);
        }}
      />
    </div>
  );
}
