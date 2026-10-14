import {test} from "node:test";
import assert from "node:assert/strict";
import { reportPeriodLabels, initialComparisonDates } from "../src/report-period-range.ts";
const dates=initialComparisonDates(new Date(2026,9,12));
test("monthly report columns include both sides of a year boundary",()=>{
  assert.deepEqual(reportPeriodLabels("month",11,2025,2,2026,dates),["Thg 11/2025","Thg 12/2025","Thg 1/2026","Thg 2/2026"]);
});
test("quarter report columns follow the selected quarters instead of a fixed fourth quarter",()=>{
  assert.deepEqual(reportPeriodLabels("quarter",1,2026,4,2026,dates),["Quý 1/2026","Quý 2/2026"]);
  assert.deepEqual(reportPeriodLabels("quarter",10,2025,1,2026,dates),["Quý 4/2025","Quý 1/2026"]);
});
test("year reports show every selected year and reversed ranges produce no columns",()=>{
  assert.deepEqual(reportPeriodLabels("year",1,2024,12,2026,dates),["Năm 2024","Năm 2025","Năm 2026"]);
  assert.deepEqual(reportPeriodLabels("year",1,2026,12,2024,dates),[]);
});
test("custom reports retain separate comparison ranges in the column headings",()=>{
  assert.deepEqual(reportPeriodLabels("custom",1,2026,1,2026,["2026-01-01","2026-03-31","2025-01-01","2025-03-31"]),["01/01/2026 - 31/03/2026","01/01/2025 - 31/03/2025"]);
});
