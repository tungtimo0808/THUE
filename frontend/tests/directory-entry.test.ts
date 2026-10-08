import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateDirectoryEntry,
  normalizeDirectoryValues,
} from "../src/directory-entry.ts";
test("short form labels map to the named directory columns", () => {
  const fields = [{ label: "Mã" }, { label: "Tên" }],
    headers = ["Mã kho", "Tên kho", "Trạng thái"];
  const values = normalizeDirectoryValues(fields, headers, {
    Mã: "K01",
    Tên: "Kho mẫu",
  });
  assert.equal(values["Mã kho"], "K01");
  assert.equal(values["Tên kho"], "Kho mẫu");
  const initial = normalizeDirectoryValues(fields, headers, {
    "Mã kho": "K01",
    "Tên kho": "Kho mẫu",
  });
  assert.notEqual(
    validateDirectoryEntry(
      fields,
      { Mã: "K01", Tên: "Khác" },
      [{ id: "1", values: initial }],
      "2",
    ),
    "",
  );
});
test("directory entry keeps tax identifiers optional and rejects duplicate codes", () => {
  const fields = [
    "Mã số thuế/CCCD chủ hộ",
    "Mã số ĐVQHNS",
    "Mã khách hàng",
    "Tên khách hàng",
  ].map((label) => ({ label }));
  const values = {
    "Mã khách hàng": "KH001",
    "Tên khách hàng": "Khách hàng mẫu",
  };
  const rows = [{ id: "1", values }];
  assert.equal(validateDirectoryEntry(fields, values, [], "new"), "");
  assert.notEqual(
    validateDirectoryEntry(
      fields,
      { ...values, "Mã khách hàng": "" },
      [],
      "new",
    ),
    "",
  );
  assert.notEqual(
    validateDirectoryEntry(
      fields,
      { ...values, "Mã khách hàng": " kh001 " },
      rows,
      "new",
    ),
    "",
  );
  assert.equal(validateDirectoryEntry(fields, values, rows, "1"), "");
});
