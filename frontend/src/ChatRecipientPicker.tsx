import { useState } from "react";
import { ChevronDown, X } from "lucide-react";

const recipients = [
  { name: "Nguyễn Minh", email: "minh@example.com" },
  { name: "Lê An", email: "an@example.com" },
];

export default function ChatRecipientPicker() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const visible = recipients.filter((person) =>
    `${person.name} ${person.email}`
      .toLocaleLowerCase("vi")
      .includes(query.toLocaleLowerCase("vi")),
  );
  return (
    <div
      style={{ position: "relative" }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
          minHeight: 34,
          border: `1px solid ${open ? "var(--brand, #1d4ed8)" : "#cbd5e1"}`,
          borderRadius: 6,
          padding: "3px 4px 3px 8px",
          background: "#ffffff",
          boxSizing: "border-box",
        }}
      >
        {selected.map((email) => (
          <button
            key={email}
            type="button"
            aria-label={`Bỏ người nhận ${recipients.find((person) => person.email === email)?.name}`}
            onClick={() =>
              setSelected((current) =>
                current.filter((value) => value !== email),
              )
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 7px",
              borderRadius: 5,
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <span>{recipients.find((person) => person.email === email)?.name}</span>
            <X size={12.5} aria-hidden="true" />
          </button>
        ))}
        <input
          aria-label="Người nhận"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="schedule-chat-recipients"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          style={{ flex: 1, minWidth: 140, border: 0, outline: "none", padding: "4px 2px" }}
        />
        <button
          type="button"
          aria-label="Chọn người nhận Sổ Việt Chat"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          style={{
            width: 26,
            height: 26,
            padding: 0,
            border: "none",
            borderRadius: 5,
            background: open ? "#eff6ff" : "transparent",
            color: open ? "var(--brand, #1d4ed8)" : "#64748b",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <ChevronDown
            size={15}
            strokeWidth={2.2}
            aria-hidden="true"
            style={{
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.16s ease",
            }}
          />
        </button>
      </div>
      {open && (
        <div
          id="schedule-chat-recipients"
          role="listbox"
          aria-label="Danh sách người nhận Sổ Việt Chat"
          aria-multiselectable="true"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 3,
            background: "white",
            border: "1px solid #cdd3da",
            boxShadow: "0 4px 10px #0002",
            maxHeight: 190,
            overflow: "auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              padding: 8,
              background: "#f1f2f4",
              fontWeight: 600,
            }}
          >
            <span>Tên người nhận</span>
            <span>Email người nhận</span>
          </div>
          {visible.map((person) => (
            <button
              key={person.email}
              type="button"
              role="option"
              aria-selected={selected.includes(person.email)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setSelected((current) =>
                  current.includes(person.email)
                    ? current
                    : [...current, person.email],
                );
                setQuery("");
                setOpen(false);
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                width: "100%",
                border: 0,
                padding: 8,
                textAlign: "left",
                background: selected.includes(person.email)
                  ? "#eaf7f0"
                  : "white",
              }}
            >
              <span>{person.name}</span>
              <span>{person.email}</span>
            </button>
          ))}
          {!visible.length && (
            <div style={{ padding: 8 }}>Không có dữ liệu phù hợp</div>
          )}
        </div>
      )}
    </div>
  );
}
