export interface ReconciliationTransaction {
  id: string;
  code: string;
  dateHachToan: string;
  amount: number;
  kind: string;
  partner: string;
}
export function reconciliationAmounts(
  rows: ReconciliationTransaction[],
  selected: string[],
  opening: number,
  statement: number,
) {
  const selectedRows = rows.filter((row) => selected.includes(row.id));
  const receipts = selectedRows
    .filter((row) => row.kind === "receipt")
    .reduce((sum, row) => sum + row.amount, 0);
  const payments = selectedRows
    .filter((row) => row.kind === "payment")
    .reduce((sum, row) => sum + row.amount, 0);
  const closing = opening + receipts - payments;
  return {
    opening,
    receipts,
    payments,
    closing,
    statement,
    difference: closing - statement,
  };
}
