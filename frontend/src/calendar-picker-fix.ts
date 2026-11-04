// Các ô ngày hiển thị dạng DD/MM/YYYY dùng một <input type="date"> trong suốt đè lên biểu tượng lịch.
// Chrome chỉ mở bảng chọn ngày khi bấm trúng vùng biểu tượng gốc rất nhỏ, nên chủ động mở bằng showPicker().
const PICKER_TYPES = new Set(["date", "month", "week", "time", "datetime-local"]);

export function installCalendarPickerFix() {
  if (typeof document === "undefined") return;
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !PICKER_TYPES.has(target.type)) return;
      if (target.disabled || target.readOnly) return;
      if (window.getComputedStyle(target).opacity !== "0") return;
      try {
        target.showPicker?.();
      } catch {
        target.focus();
      }
    },
    true,
  );
}

