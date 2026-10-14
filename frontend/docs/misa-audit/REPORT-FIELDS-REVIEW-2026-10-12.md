# Rà trường báo cáo — 12/10/2026

- Đối chiếu 223 định nghĩa báo cáo dùng AuditedReportWorkspace với metadata trường đã lưu: không thiếu nhãn trường tĩnh trong các bản metadata tương ứng. Kết quả này không bao gồm mọi báo cáo riêng hoặc mọi nhánh động.
- LIVE bảng kê mua vào: 9 tiêu đề cột và 3 tham số ngày/kỳ, 2 checkbox hiện đủ trong định nghĩa.
- LIVE đối chiếu thông tin hóa đơn trên bảng kê mua vào và chứng từ: thiếu nhánh Quý khi đổi Theo quý; đã sửa renderer để hiện Quý1–4, Tháng1–12, bỏ dropdown kỳ ngày không phù hợp. Sửa tháng mặc định từ YYYY-MM sang số tháng cho chế độ radio kỳ.
- Local đã mở và xác nhận Quý có4 lựa chọn. Strict TS component và Vite build đạt trước sửa cuối tháng mặc định.
- Chưa rà LIVE toàn bộ danh mục, chưa kết luận mọi báo cáo đủ. Cần tiếp tục báo cáo riêng, nhánh thay đổi tham số, tùy chọn và cột động.

Các định nghĩa dùng nhánh tháng/quý: 
- Báo cáo đối chiếu bảng kê thuế và sổ cái
- Đối chiếu thông tin hóa đơn trên bảng kê mua vào và chứng từ

## Rà kỹ và bổ sung trường báo cáo — 12/10/2026
- Đã đối chiếu nhãn/cột tĩnh giữa 223 định nghĩa và schema/metadata MISA lưu trước. Không tìm thêm tiêu đề cột không rỗng bị thiếu trong các định nghĩa tương ứng; điều này không chứng minh mọi màn hình riêng hoặc nhánh động đã đủ. Checkbox Chọn khách hàng của Tổng hợp bán hàng theo mặt hàng có trong màn hình riêng MisaSalesSummaryReports, không thêm trùng vào generic.
- LIVE Thuế: quyết toán GTGT năm thiếu Năm và radio Tháng/Quý; đã thêm vào TS+JSON. Đối chiếu bảng kê thuế/sổ cái: Theo năm ẩn Tháng và hiện Năm*, defaultTK133 và đủ4TK133/33311/511/711. Đối chiếu hóa đơn đã có nhánh Quý từ lượt trước. UI local đã kiểm năm/tài khoản4 và quyết toánradio.
- LIVE cả4 Ngân sách: Xem một kỳ đổi Xem theo thành Kỳ báo cáo; đã bổ sung nhánh cho4 báo cáo. Xem theo Tháng/Quý, mặc định Tháng. Danh sách21 kỳ được đọc sâu riêng Kế hoạch ngân sách và dùng chung cho nhóm; chưa đọc lại toàn bộ21 lựa chọn riêng từng báo cáo. Source capture work/budget-period-options-source-2026-10-12.json. Báo cáo chi phí có2 nhómradio độc lập; đã tách Cách lấy chi phí thực hiện khỏi kỳ, giữ draft.radio cho kỳ. UI local xác nhận chọn đồng thời Xem một kỳ và Khi thực chi bằng tiền.
- Phát hiện12 báo cáo mua hàng ở4 sharedcomponent còn popupplaceholder chỉ dòng Kỳ: ...: MisaPurchaseReconciliationReports, MisaStaffPurchasesReports, MisaPurchaseOrderReports, MisaProjectPurchasesReports. Bổ sung AuditedReportParameters theo từng definition MISA có sẵn, ngày/kỳ/nhóm/tablechọn/checkbox riêng; giữ bảng kết quả và popupcũ làmfallback khi definitionkhông có. Không thay3protectedreport. Thêm tên truy cập cho nút quay về danh mục. UI sau sửa đã kiểm nhánh đối chiếu chi phí mua→chi phí và tổng hợp mặt hàng/nhân viên; cần kiểm lại cả12 nhánh bản cuối. Không giả định logic dữ liệu bảng kết quả đã nối tham số.
- Runtime mở nhiều báo cáo và lưu work/report-runtime-fields-2026-10-12.json. Có tên Sổ/Số/(tĩnh)/(tỉnh) chưa tìmexactlink; giữ pending, không coi thiếu báo cáo khi chưa resolvealias. Một số popup riêng khôngrole dialog nên cần đọccontrols trực tiếp. Bộ chạy Playwrightlocators đóng/quay lại không ổn định ở một số form; nativeAXclick hoạt động, chuyển native.
- Lượt cuối nativebatch20 timeout60s khiến Cua kernelreset, chưa lưu kết quả cuối. getTab local9378 sau reset báo Debugger unattached. Không lặp lại auditLIVE khi tab không điều khiển được. UI chưa kiểm cuối không được đánh dấuhoàn tất.
- Kiểm cuối: strictTypeScript các6module báo cáo liên quan +definition đạt; 9unittest audited-report-schema đạt; npx vite build đạt, cảnh báo kích thước bundle vẫn có. Không nới tsconfig, khôngstage/commit, giữ mọi thay đổi người dùng mới.
- Proof: outputs/vat-annual-parameters-2026-10-12.png; tax-report-year-fields-2026-10-12.png; budget-independent-parameters-2026-10-12.png.
- User mới ưu tiên Báo cáo. Tiếp tục từ report-runtime-coverage-2026-10-12.json: các tên pending, snapshot không cócontrols, QA12popup mới, các lựa chọn và cột động, rồi Cash/Bank tồnđọng. Không chốt100%; automationACTIVE.
- Coverage lưu ổn định: 177 tên đã xử lý, 160 tên có snapshot, 63 tên chưa xử lý hoặc unresolved. Số xử lý bao gồm skipped và snapshot cũ trướcfix.

## Xác minh 12 popup báo cáo mới — 12/10/2026, lượt14:52
- Usage cho phép (primary46%, weekly41%). Edge đã kết nối điều khiển lại; chỉ thao tác frontend local9378.
- Mở đủ12 báo cáo thuộc4 sharedcomponents mới sửa, bấm Chọn tham số, đọc AX+DOM, rồi Hủy và quay về danh mục. Lưu từng báo cáo ngay sau khi đọc để tránh mất log khi batch timeout. work/report-added-popups-verified-2026-10-12.json có12snapshot bản cuối.
- Đối chiếu nhãn tham số, checkbox và các tiêu đề bảng chọn của12popup với definition MISA đã lưu: không thiếu nhãn/cột trong popup vừa kiểm. Đây xác minh runtime theo schema đã lưu; chưa LIVE đối chiếu lại mọi lựa chọn con/nhánh của12report. Không chốt toàn bộ Báo cáo100%.
- Không sửa mã lượt này, không chạy lại build/test khi không có thay đổi; kiểm cuối lượt trước vẫn là strict TS/9tests/Vite đạt. Khôngstage/commit, protected3reports không thay.
- Còn63 tên pending/unresolved trong coverage cũ; cần hợp nhất12logs mới vào coverage và rà tiếp tênSổ/Số cùng tham số/cộtđộng. Cash/Bank còn checkpoint riêng. AutomationACTIVE.

## Tiếp tục đến 100% — 12/10/2026 (chưa hoàn tất)
- Sửa tìm kiếm danh mục thêm canonicalReportName, giữ đường tìm tên gốc. Tìm Sổ/Số, mãmẫu DN có khoảng trắng, tĩnh/tỉnh mở cùngtên tươngđương; 17alias đãQA popup vàlưu work/report-alias-runtime-2026-10-12.json. Khôngxóađổitênliênkếtcũ.
- Mở tiếp38 tên còn thiếu log, lưu từng mục work/report-remaining-runtime-2026-10-12.json. Hợp nhất4logs đạt223/223definition cósnapshotpopup mặc định. WarningsNFC tiềnmặt/tiềngửi làencoding; B01-DN checkboxkhác chữ các nhưngcontrolđãcó, khôngthêmtrùng. Chưacoilà100% vì còncatalogue ngoài223, branchđộng/danh sáchoption/resultcolumns.
- LIVE3report doanhthu/chi phí/kếtquảkinhdoanh nhiều kỳ: Quý cầnTừquý/Đếnquý+2Năm, Năm cầnTừnăm/Đếnnăm, Tùychọn cầnSo sánh kỳ/Với kỳ mỗi nhóm2ngày. Lưu revenue/expense/combined-period-modes-source-2026-10-12.json. Source chỉdrafttham số khôngCất.
- Thêm ReportPeriodModeFields.tsx/CSS, dùngtrong3dedicatedreport. Giữnguyên nhánhTháng cũ, thêm3nhánhthiếu. Quarterinputs điềukhiểnstate thánghiệncó bằngthángđầuquý; years dùngstateyearhiệncó. Bốnngàycustom hiệnstatecục bộcomponent, CHƯA nốiapply/save/reset/resultcolumns, cầntiếp tụctrướcchốt100%; userchỉyêu cầufieldsUI nhưngformatcột vẫncầnđốichiếu.
- UI9nhánh Quý/Năm/Tùychọn trên3reports đãcaptured radioValue1 vàcontrols. work/multi-period-branches-local-2026-10-12.json. Nhập Với kỳ:Đếnngày31/12/2026 kiểmđược. FixCSS nativecalendar bịlặp ngoài.pc-report, hiện1ô/ngày. Screenshottoolthỉnhthoảngtrảframecũ: chụplạiđểđúngstate, proofcuối outputs/multi-period-custom-fields-2026-10-12.png.
- StrictTS3reports+helper vàVitebuildđạt trướcCSScuối; cầnbuildcuối/testappropriate saulogicmới. No stage/commit,3protectedreports giữnguyên. Userđangđòitiếptụcđến100%, taskactive, khônggửifinalpartialnếukhônglimit/blocker.
- Local9378 đangcustomcombinedmodal, markdeliverable. Source9481 đangcustomcombinedmodal; Hủy khi xong. Cần audit toàn bộmenu/checkconditionals/columns, các báo cáo ngoài223, rồiCash/Bank tồnđọng.

## Ngoài223 — bổsung8popup — 12/10/2026
- Catalogue263mục gồm245tên saucanonical/alias, có22báocáongoài223definitions. Đãmở22vàlưulog report-extra-runtime-2026-10-12.json (có1entrylặp, unique22). Phát hiệnorderdetail+7asset/cost dùnggenericpreview khôngtham sốthật.
- Thêm SalesOrderDetailParameters: Kỳ/Từ/Đến/Đơnvị/Nhânviên +bảngđơnđặt4cols theo schema. Thêm CatalogueReportParameters +catalogue-report-parameters.ts choS21-DN,ThẻTSCĐ,S36-DN2mẫu,S37-DN3mẫu. GeneratedtừsourceparameterOnly vàmetadatađãlưu, giữrequired/checks/tables. RootReportCenter thêmChọntham sốtrên8genericpreview, giữ nguyênpreview/Export/In cũ.
- CatalogueTK options dùng208codesđãaudit. LoạiTSCĐ/Kỳtínhgiáthành hiệnReportReferencePicker, nhưngdanh sáchfixturechungchưakhớpngữ nghĩa/optionnguồn, cầnSOURCEaudit vàsửa trước100%. Khôngcoi8resultformatgenericđúngMISA: còn6columnspreviewcũ, chưaxácminhmẫuPDFthật.
- Salesorderpopup đãQA5labels+4tableheaders; report-seven-added-parameters-2026-10-12.json đãQA7popup labels/checks/tableheaders, khôngwarnings. Sourceoptions/childpickers/columnsđộng cònthiếu.
- Strict CatalogueParameters/definitionsđạt; Vitebuild sauallchangesđạt. 13testsrange/audited-schema đạttrước8popupcuối (khôngđổilogicđãtest). RootReportCenterfullstrictchưađạtcheckchungdoexistingimports/unusedoldscope, khôngnớiconfig. No stage/commit,3protectedfileskhôngsửa.
- Primary93%lầnkiểmcuối, đãbáousergầngiới hạnvàtiếptụclưucheckpoint. Useryêucầu100%chỉchốt khiđủ; KHÔNGcomplete. AutomationACTIVE.
- Cua helperclosure primitivecounter khôngcậpnhậttừouterlet nhưdựkiến, tránhsửaouterindexđểskipitem; dùngloopliteralexplicitrange vàlưutừngreport. Frameảnhđôikhibịcũ,chụplại khiAXcurrentđúng.

## 18:54 — rà picker báo cáo — 12/10/2026
- Usage cho phép, primary4%. Không có agent/lượt phụ chạy. Source Edge ReportList và local reports kết nối được.
- QA loại TSCĐ local đủ16options+Tất cả,2tiêu đề; gõ Phần mềm lọc đúng loại25, chọn hiển thị Phần mềm máy vi tính, mở lại giữ lựa chọn. Fix màu span bị inherited đỏ trong2picker đặc thù; DOM computed rgb34/34/34 và ảnh cuối đúng. Proof outputs/report-asset-category-options-2026-10-12.png.
- LIVE thẻ S37-DN theo yếu tố chi phí: dropdown Kỳ tính giá thành có2cột Tên kỳ tính giá thành/Loại, nguồn hiện Không có dữ liệu hiển thị. Không tạo kỳ MISA. Thêm2tiêu đề và phần loại tương ứng trong ReportReferencePicker; lựa chọn frontend lấy tên fixture đã có ở MisaCostWorkspace (không coi đó là dữ liệu nguồn MISA).
- reportReferenceChoices nhận thêm reportName để chọn fixture kỳ đúng ngữ cảnh công trình/đơn hàng/hợp đồng/sản xuất liên tục, giữ chữ ký cũ tương thích. Local S37 công trình: dropdown2cột+TechPark Theo công trình, chọn rồi combobox hiển thị tên đúng. Source popup đã Hủy, không save.
- StrictTS ba file ReportReferencePicker/AuditedReportParameters/audited-report-fixtures với types vite/client đạt. Vite build đạt trước sửa span color cuối; thay đổi span chỉstyle, strictTScuối đạt. Lệnh strict đầu thiếu --ignoreConfig/types viteclient đã sửa, không đổi tsconfig.
- Chưa100%:8generic preview vẫn6cột hàng hóa chung, cần đối chiếu và bổ sung mẫu báo cáo thực; picker bảng mẫu như Công trình còn DT001/Đối tượng mẫu/Chứng từ kế toán sai ngữ nghĩa. Cần tiếp tục selectorSampleRows tương ứng rồi các nhánh/option khác. Giữ mọi thay đổi người dùng; không stage/commit.

## 20:51 — mẫu S21-DN và hai bảng lựa chọn còn lại — 12/10/2026
- Usage primary16%, cho phép. Edge còn kết nối. Tên S21 nguồn không mở tham số, nhưng nút hình mẫu mở được; từ nay dùng hình mẫu để đối chiếu resultformat còn thiếu thay vì lặp click tên.
- LIVE ảnh S21 từ nút preview: https://actapp.misacdn.net/dn/g2/assets/images/preview_report/SỔ TÀI SẢN CỐ ĐỊNH (MẪU QUẢN TRỊ) TT99.png. Proof source outputs/misa-s21-template-source-2026-10-12.png. Không suy đoán pháp lý từ tên mẫu, chỉ đối chiếu UI.
- Thêm S21AssetRegisterPreview.tsx phía trên bảng generic hiện có trong ReportCenter (không xóa bảng/Export/In cũ). 14cột,3nhóm Ghi tăng/Khấu hao/Ghi giảm,2nhóm Chứng từ; mã/tênTSCĐ,loại/tênloại,Cộng/Tổng cộng,ngày mở sổ và3ô ký. Dữ liệu mẫu và ô trống, chưa nối tham số/tính toán. canonicalalias S21 cũng gọi mẫu này khi đi nhánh generic.
- QA DOM tbody mỗi hàng tổng colspan14, tất cảheader nguồn hiện diện. Proof local outputs/report-s21-register-local-2026-10-12.png; bảng có cuộn ngang do14cột. StrictTS component vàVitebuild đạt trước editconditionaliascuối (expressiontrivial đãQA exactname), không chạychecktoànrootdoexistingdeps.
- QA nốt2picker TSCĐ/Đối tượng THCP đúngmẫu; work/report-selector-remaining-2026-10-12.json. Tổng5picker đãruntimecheck; giữID/bậc/options cũ. HMR sửa root làm popup đóng nên lượtQA đầu Hủy no-match; đọcDOM lại rồi mở từcatalogue, không lặpblind.
- Source ảnhpreview đãEscape đóng, không Cất. Local đangmẫuS21, markedDeliverable. No stage/commit;3protectedreports khôngsửa. Chưa100%:còn7mẫugenericchưađốichiếu + nguồnS21chưaQAapplytham số; nhiềubranch/option còn tồn. Tiếp theo mởnútpreviewcác mẫuasset/cost/order còn lại đểthuheaders, bổsunggiữnguyênlegacytable.

## 21:58 — thẻ TSCĐ và hai mẫu S36 — 12/10/2026
- Usage primary22%, được phép. Edge đọcsourcepreviewđược; không Cất/tạo dữ liệu. Source hình mẫu đóngEscape cuối, local đangThẻTSCĐmarkedDeliverable.
- LIVE Thẻ TSCĐ từ nút ảnh: THẺ TÀI SẢN CỔ ĐỊNH TT99.png (URL MISA dùng chữ CỔ). Rà cảđầu/cuốihình. Thêm FixedAssetCardPreview.tsx: số/ngày/chi nhánh/biên bản giao nhận,tên kýmãhiệu quy cách,sốhiệu,nước/nămSX,bộphận/nămSD,công suất,đình chỉ/lýdo; bảnghao mòn8cols, phụtùng5cols,lýdogiảm,3ôký. Giữlegacytable/Export/In phía dưới.
- LIVE S36 THCP nguồn7cols: NgàyHT/Chứngtừ2/Diễngiải/TKđốiứng/GhiNợ2(Tổngsốtiền,6273). LIVE S36 côngtrình9cols: Ngày thángghisổ/Chứngtừ2/Diễngiải/TKđốiứng/GhiNợ4(Tổngsốtiền,6271,6277,6278). MetadataTK627/scope,5dòngdư/phátsinh/cộng/ghicó/cuốikỳ,ngàymởsổ/2ôký.
- Thêm ProductionCostLedgerPreview.tsx shared projectprop, nối2têncanonicalReportCenter. Giữcácpreview/featurescũ. Đây template nguồn và ômẫutrống, TK627/cộtcon theoảnh mẫu, chưa nối tham sốđể đổiTK/cộtsốliệu; khôngcoi100%nhánhđộng.
- QA ThẻTSCĐ8+5header đủ;QA2S36tbody7/9cộtđúng,log work/report-s36-templates-qa-2026-10-12.json. StrictTS2components +Vitebuildcuốiđạt.
- Proof outputs/misa-asset-card-source-bottom-2026-10-12.png,misa-s36-source-2026-10-12.png,misa-s36-project-source-2026-10-12.png,report-fixed-asset-card-local-2026-10-12.png. SourceURLs đãquan sát trongDOM vàlogtool; khôngfetchmạngẩn.
- Còn4/8mẫu generic chưađối chiếu/bổsung:3S37(thcp/yếutố,thcp/khoảnmục,côngtrình/khoảnmục) vàđơnđặthàngchi tiết. Sauđó cácnhánh/picker/fieldcoverage khác. Chưa100%; khôngstage/commit,3protectedreportskhôngsửa.
