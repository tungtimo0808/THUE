import "./select-enhancer.css";

/*
 * Thay danh sách thả xuống mặc định của trình duyệt (nền xám, thô) bằng danh sách cùng kiểu với web
 * cho mọi <select> đơn. Ô <select> gốc vẫn giữ nguyên nên React/onChange hoạt động như cũ.
 * Bỏ qua: select multiple, select có size > 1, select bị vô hiệu hóa, hoặc có thuộc tính data-native-select.
 */

const CHECK_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

type Item = { kind: "option"; option: HTMLOptionElement; index: number } | { kind: "group"; label: string };

let current: {
  select: HTMLSelectElement;
  popover: HTMLDivElement;
  items: Item[];
  optionEls: HTMLDivElement[];
  active: number;
  cleanup: () => void;
} | null = null;

function isEnhanceable(el: EventTarget | null): el is HTMLSelectElement {
  return (
    el instanceof HTMLSelectElement &&
    !el.multiple &&
    (el.size || 0) <= 1 &&
    !el.disabled &&
    !el.hasAttribute("data-native-select")
  );
}

function setSelectValue(select: HTMLSelectElement, index: number) {
  if (select.selectedIndex === index) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex")?.set;
  if (setter) setter.call(select, index);
  else select.selectedIndex = index;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function close(refocus = false) {
  if (!current) return;
  const { select, popover, cleanup } = current;
  cleanup();
  popover.remove();
  select.classList.remove("sv-select-open");
  current = null;
  if (refocus) select.focus({ preventScroll: true });
}

function position(select: HTMLSelectElement, popover: HTMLDivElement) {
  const r = select.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const below = vh - r.bottom - 8;
  const above = r.top - 8;
  const naturalHeight = Math.min(popover.scrollHeight + 2, 320);
  const openAbove = below < Math.min(naturalHeight, 200) && above > below;
  const maxHeight = Math.max(120, Math.min(320, openAbove ? above : below));
  const minWidth = Math.max(r.width, 140);
  const maxWidth = Math.max(minWidth, Math.min(560, vw - 16));
  popover.style.minWidth = `${minWidth}px`;
  popover.style.maxWidth = `${maxWidth}px`;
  popover.style.maxHeight = `${maxHeight}px`;
  // Căn trái theo ô chọn, nếu tràn phải thì dịch sang trái
  const width = Math.min(Math.max(popover.offsetWidth, minWidth), maxWidth);
  const left = Math.max(8, Math.min(r.left, vw - width - 8));
  popover.style.left = `${left}px`;
  if (openAbove) {
    popover.style.top = "";
    popover.style.bottom = `${vh - r.top + 4}px`;
  } else {
    popover.style.bottom = "";
    popover.style.top = `${r.bottom + 4}px`;
  }
}

function setActive(index: number, scroll = true) {
  if (!current) return;
  current.optionEls.forEach((el, i) => el.classList.toggle("sv-active", i === index));
  current.active = index;
  if (scroll && index >= 0) current.optionEls[index]?.scrollIntoView({ block: "nearest" });
}

function optionItems(): { option: HTMLOptionElement; index: number }[] {
  return current ? (current.items.filter((i) => i.kind === "option") as { option: HTMLOptionElement; index: number }[]) : [];
}

function moveActive(delta: number) {
  if (!current) return;
  const opts = optionItems();
  if (!opts.length) return;
  let i = current.active;
  for (let step = 0; step < opts.length; step++) {
    i = Math.max(0, Math.min(opts.length - 1, i + delta));
    if (!opts[i].option.disabled) break;
    if (i === 0 || i === opts.length - 1) break;
  }
  setActive(i);
}

function choose(position: number) {
  if (!current) return;
  const opt = optionItems()[position];
  if (!opt || opt.option.disabled) return;
  const select = current.select;
  close(true);
  setSelectValue(select, opt.index);
}

function open(select: HTMLSelectElement) {
  if (current?.select === select) {
    close(true);
    return;
  }
  close();

  const popover = document.createElement("div");
  popover.className = "sv-select-popover";
  popover.setAttribute("role", "listbox");
  const items: Item[] = [];
  const optionEls: HTMLDivElement[] = [];

  const addOption = (option: HTMLOptionElement) => {
    if (option.hidden) return;
    const pos = optionEls.length;
    items.push({ kind: "option", option, index: option.index });
    const el = document.createElement("div");
    el.className = "sv-select-option";
    el.setAttribute("role", "option");
    const label = option.label || option.text;
    el.title = label;
    const span = document.createElement("span");
    span.textContent = label;
    el.appendChild(span);
    if (option.selected) {
      el.classList.add("sv-selected");
      el.setAttribute("aria-selected", "true");
      el.insertAdjacentHTML("beforeend", CHECK_SVG);
    }
    if (option.disabled) el.classList.add("sv-disabled");
    el.addEventListener("mouseenter", () => setActive(pos, false));
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      choose(pos);
    });
    popover.appendChild(el);
    optionEls.push(el);
  };

  for (const child of Array.from(select.children)) {
    if (child instanceof HTMLOptGroupElement) {
      const g = document.createElement("div");
      g.className = "sv-select-group";
      g.textContent = child.label;
      popover.appendChild(g);
      items.push({ kind: "group", label: child.label });
      Array.from(child.children).forEach((o) => o instanceof HTMLOptionElement && addOption(o));
    } else if (child instanceof HTMLOptionElement) {
      addOption(child);
    }
  }
  if (!optionEls.length) {
    const empty = document.createElement("div");
    empty.className = "sv-select-empty";
    empty.textContent = "Không có lựa chọn";
    popover.appendChild(empty);
  }

  document.body.appendChild(popover);
  select.classList.add("sv-select-open");

  const onOutside = (e: Event) => {
    const t = e.target as Node;
    if (popover.contains(t) || t === select) return;
    close();
  };
  const onScroll = (e: Event) => {
    if (popover.contains(e.target as Node)) return;
    if (!document.body.contains(select)) return close();
    position(select, popover);
  };
  const onResize = () => position(select, popover);
  const onBlur = () => setTimeout(() => {
    if (current?.select === select && document.activeElement !== select) close();
  }, 0);
  document.addEventListener("mousedown", onOutside, true);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onResize);
  select.addEventListener("blur", onBlur);

  current = {
    select,
    popover,
    items,
    optionEls,
    active: -1,
    cleanup: () => {
      document.removeEventListener("mousedown", onOutside, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      select.removeEventListener("blur", onBlur);
    },
  };

  position(select, popover);
  const selectedPos = optionItems().findIndex((o) => o.option.selected);
  setActive(selectedPos);
  if (selectedPos >= 0) {
    const el = optionEls[selectedPos];
    popover.scrollTop = Math.max(0, el.offsetTop - popover.clientHeight / 2 + el.offsetHeight / 2);
  }
}

let typeBuffer = "";
let typeTimer: ReturnType<typeof setTimeout> | undefined;

export function installSelectEnhancer() {
  if (typeof document === "undefined") return;

  document.addEventListener(
    "mousedown",
    (e) => {
      if (e.button !== 0 || !isEnhanceable(e.target)) return;
      e.preventDefault(); // chặn danh sách mặc định của trình duyệt
      const select = e.target;
      select.focus({ preventScroll: true });
      open(select);
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (e) => {
      const target = e.target;
      if (current && target === current.select) {
        const opts = optionItems();
        switch (e.key) {
          case "ArrowDown": e.preventDefault(); moveActive(1); return;
          case "ArrowUp": e.preventDefault(); moveActive(-1); return;
          case "Home": e.preventDefault(); setActive(0); return;
          case "End": e.preventDefault(); setActive(opts.length - 1); return;
          case "PageDown": e.preventDefault(); moveActive(8); return;
          case "PageUp": e.preventDefault(); moveActive(-8); return;
          case "Enter":
          case " ":
            e.preventDefault();
            if (current.active >= 0) choose(current.active);
            else close(true);
            return;
          case "Escape": e.preventDefault(); e.stopPropagation(); close(true); return;
          case "Tab": close(); return;
          default:
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
              typeBuffer += e.key.toLocaleLowerCase("vi");
              clearTimeout(typeTimer);
              typeTimer = setTimeout(() => (typeBuffer = ""), 700);
              const hit = opts.findIndex((o) => (o.option.label || o.option.text).toLocaleLowerCase("vi").startsWith(typeBuffer));
              if (hit >= 0) setActive(hit);
            }
            return;
        }
      }
      if (!isEnhanceable(target)) return;
      // Các phím mở danh sách mặc định của trình duyệt -> mở danh sách thống nhất
      if ((e.key === "ArrowDown" && e.altKey) || e.key === "F4" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(target);
      }
    },
    true,
  );
}

