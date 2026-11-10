import { useEffect, useState } from "react";
import { Download, Printer, Trash2 } from "lucide-react";
import { Modal } from "./components";
import { exportVisibleTable, printVisibleTable, removeSavedTable, savedTableReports, type SavedTableReport } from "./table-actions";

export function SavedReportsHost() {
  const [reports, setReports] = useState<SavedTableReport[] | null>(null);
  const [selected, setSelected] = useState<SavedTableReport | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const open = () => { setReports(savedTableReports()); setSelected(null); setError(""); };
    window.addEventListener("sv_open_saved_tables", open);
    return () => window.removeEventListener("sv_open_saved_tables", open);
  }, []);
  if (!reports) return null;
  return (
    <Modal title={selected ? selected.title : "Báo cáo đã lưu"} onClose={() => setReports(null)} wide className="saved-reports-modal">
      <div className="modal-body">
        <p className="saved-report-note">Các bản lưu trên trình duyệt này, thuộc doanh nghiệp đang chọn. Tối đa 20 bản gần nhất.</p>
        {error && <p role="alert" className="error-text">{error}</p>}
        {selected ? <>
          <div className="saved-report-actions">
            <button type="button" className="button" onClick={() => setSelected(null)}>Quay lại danh sách</button>
            <button type="button" className="button" onClick={async (event) => { try { await printVisibleTable(event.currentTarget, selected.title); } catch (error) { setError(String(error)); } }}><Printer size={14} />In</button>
            <button type="button" className="button" onClick={async (event) => { try { await exportVisibleTable(event.currentTarget, selected.title); } catch (error) { setError(String(error)); } }}><Download size={14} />Xuất Excel</button>
          </div>
          <div className="table-scroll"><table aria-label="Nội dung báo cáo đã lưu"><tbody>{selected.rows.map((row, index) => <tr key={index}>{row.map((cell, col) => index === 0 ? <th key={col}>{cell}</th> : <td key={col}>{cell}</td>)}</tr>)}</tbody></table></div>
        </> : reports.length ? <ul className="saved-report-list">{reports.map((report) => <li key={report.id}>
          <button type="button" onClick={() => { setSelected(report); setError(""); }}><strong>{report.title}</strong><small>{report.period ? `${report.period} · ` : ""}{new Date(report.savedAt).toLocaleString("vi-VN")}</small></button>
          <button type="button" className="icon-button" aria-label={`Xóa bản lưu ${report.title}`} onClick={() => { try { removeSavedTable(report.id); setReports(savedTableReports()); } catch { setError("Không xóa được bản lưu."); } }}><Trash2 size={16} /></button>
        </li>)}</ul> : <p className="empty-state">Chưa có báo cáo đã lưu trên trình duyệt này.</p>}
      </div>
      <footer className="modal-footer"><button type="button" className="button" onClick={() => setReports(null)}>Đóng</button></footer>
    </Modal>
  );
}
