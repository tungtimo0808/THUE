import MisaCashReceiptJournalReport from './MisaCashReceiptJournalReport';
import MisaCashDisbursementJournalReport from './MisaCashDisbursementJournalReport';
import MisaDetailedCashLedgerReport from './MisaDetailedCashLedgerReport';
import MisaDailyCashBalanceReport from './MisaDailyCashBalanceReport';
import MisaCashMovementReport from './MisaCashMovementReport';
import MisaCashFlowDirectReport from './MisaCashFlowDirectReport';
import MisaCashSupplementaryReport from './MisaCashSupplementaryReport';
import MisaCashInventoryWorkspace from './MisaCashInventoryWorkspace';
import {cashLedger,type CashEntry} from './cash-operations';
import {parseReportDate} from './report-date';
import {currentCashDate} from './cash-date';

export default function MisaCashReportView({id,onBack,notify,entries=[],companyId}:{id:string;onBack:()=>void;notify:(message:string)=>void;entries?:CashEntry[];companyId?:string}) {
  const props={onBack,notify};
  const posted=entries.filter(row=>row.status!=='draft').map(row=>({...row,date:parseReportDate(row.date)})).filter(row=>row.date);
  if(id==='s07'||id==='advance141')return <MisaCashSupplementaryReport id={id} entries={entries} onBack={onBack}/>;
  if(id==='inventory')return <MisaCashInventoryWorkspace companyId={companyId} bookBalance={cashLedger(entries.map(row=>({...row,date:parseReportDate(row.date)})),`${new Date().getFullYear()}-01-01`,parseReportDate(currentCashDate())).closing} onBack={onBack}/>;
  if(id==='s03a1')return <MisaCashReceiptJournalReport {...props} data={posted.filter(row=>row.kind==='receipt').map(row=>{const account=row.credit||'';return {account:row.debit||'111',bookDate:row.date.split('-').reverse().join('/'),voucherDate:row.date.split('-').reverse().join('/'),voucherNo:row.code||'',description:row.description||'',debit111:row.amount,creditAcc1:account.startsWith('511')?row.amount:0,creditAcc2:account.startsWith('131')?row.amount:0,creditAcc3:account.startsWith('112')?row.amount:0,creditAcc4:account.startsWith('711')?row.amount:0,creditOtherAmount:/^(511|131|112|711)/.test(account)?0:row.amount,creditOtherAcc:account};})}/>;
  if(id==='s03a2')return <MisaCashDisbursementJournalReport {...props} data={posted.filter(row=>row.kind==='payment').map(row=>{const account=row.debit||'';return {account:row.credit||'111',bookDate:row.date.split('-').reverse().join('/'),voucherDate:row.date.split('-').reverse().join('/'),voucherNo:row.code||'',description:row.description||'',credit111:row.amount,debitAcc141:account.startsWith('141')?row.amount:0,debitAcc2:account.startsWith('331')?row.amount:0,debitAcc3:account.startsWith('112')?row.amount:0,debitAcc4:account.startsWith('642')?row.amount:0,debitOtherAmount:/^(141|331|112|642)/.test(account)?0:row.amount,debitOtherAcc:account};})}/>;
  if(id==='bksd')return <MisaDailyCashBalanceReport {...props}/>;
  if(id==='movement')return <MisaCashMovementReport {...props}/>;
  if(id==='cashflow')return <MisaCashFlowDirectReport {...props}/>;
  return <MisaDetailedCashLedgerReport {...props} data={cashLedger(posted,'0000-01-01','9999-12-31').rows.map(row=>({postDate:row.date.split('-').reverse().join('/'),voucherDate:row.date.split('-').reverse().join('/'),receiptNo:row.kind==='receipt'?row.code:'',paymentNo:row.kind==='payment'?row.code:'',description:row.description||'',account:(row.kind==='receipt'?row.debit:row.credit)||'111',correspAccount:(row.kind==='receipt'?row.credit:row.debit)||'',debitAmount:row.receipt,creditAmount:row.payment,balance:row.balance,recipientPayer:row.person||row.partner||''}))}/>;
}
