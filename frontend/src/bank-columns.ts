import type {CashColumn} from './cash-columns';
import {readCashColumns} from './cash-columns';
const names=['Ngày hạch toán','Ngày chứng từ','Số chứng từ','Diễn giải','Số tiền','Đối tượng','Số tài khoản NH','Lý do thu/chi','Loại chứng từ','Chức năng','Mã đối tượng','Số TK thụ hưởng','Tên NH thụ hưởng','Địa chỉ','Nhân viên','Tên ngân hàng','Hạch toán gộp nhiều hóa đơn','Đã quyết toán',...Array.from({length:10},(_,index)=>`Trường mở rộng ${index+1}`),'Người tạo','Ngày tạo','Người sửa','Ngày sửa'];
export const defaultBankColumns=():CashColumn[]=>names.map((name,index)=>({id:index+2,name,width:name==='Diễn giải'?280:name==='Đối tượng'?230:140,visible:index<10}));
export const readBankColumns=(raw:string|null)=>readCashColumns(raw,defaultBankColumns());
