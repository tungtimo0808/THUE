import { useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
export default function ReportReferencePicker({
  label,
  value,
  onChange,
  choices,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = choices.find((choice) => choice.value === value);
  const visible = choices.filter((choice) =>
    `${choice.value} ${choice.label}`
      .toLocaleLowerCase("vi")
      .includes(query.toLocaleLowerCase("vi")),
  );
  const choose = (next: string) => {
    onChange(next);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };
  return (
    <div
      className="ar-reference-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      <div className="ar-reference-input">
        <input
          ref={inputRef}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={`ar-options-${label}`}
          aria-autocomplete="list"
          placeholder="Tất cả"
          value={open ? query : (selected?.label ?? value)}
          onFocus={() => {
            setQuery("");
          }}
          onInput={(event) => {
            setQuery(event.currentTarget.value);
            setOpen(true);
          }}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          aria-label={`Chọn ${label.toLowerCase()}`}
          onClick={() => {
            setQuery("");
            setOpen(!open);
          }}
        >
          <ChevronDown size={14} />
        </button>
      </div>
      {open && (
        <div
          className="ar-reference-options"
          role="listbox"
          id={`ar-options-${label}`}
          aria-label={label}
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose("")}
          >
            Tất cả
          </button>
          {visible.map((choice) => (
            <button
              type="button"
              role="option"
              key={choice.value}
              aria-selected={value === choice.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(choice.value)}
            >
              <span>{choice.value}</span>
              <span>{choice.label}</span>
            </button>
          ))}
          {!visible.length && (
            <div className="ar-reference-empty">
              <Search size={14} />
              Không có dữ liệu phù hợp
            </div>
          )}
        </div>
      )}
    </div>
  );
}
