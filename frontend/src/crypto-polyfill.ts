/**
 * Polyfills `crypto.randomUUID()` for non-secure HTTP contexts (e.g. `http://<public-ip>:2601/`),
 * where browsers restrict `[SecureContext]` methods like `crypto.randomUUID` while still exposing
 * `crypto.getRandomValues`.
 */
export function safeRandomUUID(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // Fallback below
    }
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // RFC 4122 version 4 & variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
}

export function installCryptoPolyfill(): void {
  if (typeof globalThis === "undefined") return;
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID !== "function") {
    try {
      Object.defineProperty(c, "randomUUID", {
        value: safeRandomUUID,
        configurable: true,
        writable: true,
      });
    } catch {
      try {
        (c as any).randomUUID = safeRandomUUID;
      } catch {
        // Ignore if crypto object is strictly non-extensible
      }
    }
  }
}

installCryptoPolyfill();
