const MODAL_BACKDROP_CLASSES = [
  "misa-opening-modal-overlay",
  "misa-opening-check-modal-overlay",
  "misa-modal-overlay",
  "misa-modal-backdrop",
  "admin-modal-backdrop",
  "erp3-modal-backdrop",
  "md-overlay",
  "br-overlay",
  "ce-overlay",
  "il-backdrop",
  "modal-backdrop",
];

function isModalBackdropElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  for (const cls of MODAL_BACKDROP_CLASSES) {
    if (target.classList.contains(cls)) return true;
  }
  if (target.tagName === "DIALOG") {
    return true;
  }
  if (target.children.length >= 1 && target.children.length <= 3) {
    const style = target.style;
    const isFixedFull =
      style.position === "fixed" &&
      (style.inset === "0px" ||
        style.inset === "0" ||
        (style.top === "0px" && style.left === "0px" && style.right === "0px" && style.bottom === "0px"));
    if (isFixedFull) {
      const bg = style.background || style.backgroundColor || "";
      const hasDimmedBackdrop = bg.includes("rgba") || bg.includes("rgb") || bg.includes("#000");
      if (hasDimmedBackdrop && target.querySelector("button, input, select, textarea, table, [role='dialog']")) {
        return true;
      }
    }
  }
  return false;
}

export function installModalBackdropGuard(): void {
  if (typeof window === "undefined") return;
  const guard = (event: Event) => {
    if (isModalBackdropElement(event.target)) {
      event.stopPropagation();
    }
  };
  window.addEventListener("mousedown", guard, true);
  window.addEventListener("pointerdown", guard, true);
  window.addEventListener("mouseup", guard, true);
  window.addEventListener("click", guard, true);
}
