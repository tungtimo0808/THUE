import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  Printer,
  Download,
  HelpCircle,
  X,
  Search,
  RefreshCw,
  Mail,
  MessageCircle,
  ChevronDown,
} from "lucide-react";

export interface BalanceSheetGrowthRow {
  target: string;
  code: string;
  isBold?: boolean;
  indent?: number; // 0, 1, 2, 3
  isHeading?: boolean;
  // Month 10 values
  month10Value?: number;
  month10Change?: number;
  month10Rate?: number;
}

const DEFAULT_ROWS: BalanceSheetGrowthRow[] = [
  // A. TÀI SẢN NGẮN HẠN
  {
    target: "A. TÀI SẢN NGẮN HẠN",
    code: "100",
    isBold: true,
    indent: 0,
    month10Value: 24475000,
    month10Change: 24475000,
  },
  {
    target: "I. Tiền và các khoản tương đương tiền",
    code: "110",
    isBold: true,
    indent: 1,
    month10Value: -20000000,
    month10Change: -20000000,
  },
  {
    target: "1. Tiền",
    code: "111",
    isBold: false,
    indent: 2,
    month10Value: -20000000,
    month10Change: -20000000,
  },
  {
    target: "2. Các khoản tương đương tiền",
    code: "112",
    isBold: false,
    indent: 2,
  },
  {
    target: "II. Đầu tư tài chính ngắn hạn",
    code: "120",
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Chứng khoán kinh doanh",
    code: "121",
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Dự phòng giảm giá chứng khoán kinh doanh (*)",
    code: "122",
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Đầu tư nắm giữ đến ngày đáo hạn",
    code: "123",
    isBold: false,
    indent: 2,
  },
  {
    target: "4. Dự phòng đầu tư nắm giữ đến ngày đáo hạn ngắn hạn (*)",
    code: "124",
    isBold: false,
    indent: 2,
  },
  {
    target: "5. Đầu tư ngắn hạn khác",
    code: "125",
    isBold: false,
    indent: 2,
  },
  {
    target: "6. Dự phòng tổn thất các khoản đầu tư ngắn hạn khác (*)",
    code: "126",
    isBold: false,
    indent: 2,
  },
  {
    target: "III. Các khoản phải thu ngắn hạn",
    code: "130",
    isBold: true,
    indent: 1,
    month10Value: 30000000,
    month10Change: 30000000,
  },
  {
    target: "1. Phải thu ngắn hạn của khách hàng",
    code: "131",
    isBold: false,
    indent: 2,
    month10Value: 20000000,
    month10Change: 20000000,
  },
  {
    target: "2. Trả trước cho người bán ngắn hạn",
    code: "132",
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Phải thu nội bộ ngắn hạn",
    code: "133",
    isBold: false,
    indent: 2,
  },
  {
    target: "4. Phải thu theo tiến độ hợp đồng xây dựng",
    code: "134",
    isBold: false,
    indent: 2,
  },
  {
    target: "5. Phải thu ngắn hạn khác",
    code: "135",
    isBold: false,
    indent: 2,
    month10Value: 10000000,
    month10Change: 10000000,
  },
  {
    target: "6. Dự phòng phải thu ngắn hạn khó đòi (*)",
    code: "136",
    isBold: false,
    indent: 2,
  },
  {
    target: "7. Tài sản thiếu chờ xử lý",
    code: "137",
    isBold: false,
    indent: 2,
  },
  {
    target: "IV. Hàng tồn kho",
    code: "140",
    isBold: true,
    indent: 1,
    month10Value: 12475000,
    month10Change: 12475000,
  },
  {
    target: "1. Hàng tồn kho",
    code: "141",
    isBold: false,
    indent: 2,
    month10Value: 12475000,
    month10Change: 12475000,
  },
  {
    target: "2. Dự phòng giảm giá hàng tồn kho (*)",
    code: "142",
    isBold: false,
    indent: 2,
  },
  {
    target: "V. Tài sản sinh học ngắn hạn",
    code: "150",
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Súc vật nuôi lấy sản phẩm một lần ngắn hạn",
    code: "151",
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần ngắn hạn",
    code: "152",
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Dự phòng tổn thất tài sản sinh học ngắn hạn (*)",
    code: "153",
    isBold: false,
    indent: 2,
  },
  {
    target: "VI. Tài sản ngắn hạn khác",
    code: "160",
    isBold: true,
    indent: 1,
    month10Value: 2000000,
    month10Change: 2000000,
  },
  {
    target: "1. Chi phí chờ phân bổ ngắn hạn",
    code: "161",
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Thuế GTGT được khấu trừ",
    code: "162",
    isBold: false,
    indent: 2,
    month10Value: 2000000,
    month10Change: 2000000,
  },
  {
    target: "3. Thuế và các khoản khác phải thu Nhà nước",
    code: "163",
    isBold: false,
    indent: 2,
  },
  {
    target: "4. Giao dịch mua bán lại trái phiếu Chính phủ",
    code: "164",
    isBold: false,
    indent: 2,
  },
  {
    target: "5. Tài sản ngắn hạn khác",
    code: "165",
    isBold: false,
    indent: 2,
  },

  // B. TÀI SẢN DÀI HẠN
  {
    target: "B. TÀI SẢN DÀI HẠN",
    code: "200",
    isBold: true,
    indent: 0,
  },
  {
    target: "I. Các khoản phải thu dài hạn",
    code: "210",
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Phải thu dài hạn của khách hàng",
    code: "211",
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Trả trước cho người bán dài hạn",
    code: "212",
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Vốn kinh doanh ở đơn vị trực thuộc",
    code: "213",
    isBold: false,
    indent: 2,
  },
  {
    target: "4. Phải thu nội bộ dài hạn",
    code: "214",
    isBold: false,
    indent: 2,
  },
  {
    target: "5. Phải thu dài hạn khác",
    code: "215",
    isBold: false,
    indent: 2,
  },
  {
    target: "6. Dự phòng phải thu dài hạn khó đòi (*)",
    code: "216",
    isBold: false,
    indent: 2,
  },
  {
    target: "II. Tài sản cố định",
    code: "220",
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Tài sản cố định hữu hình",
    code: "221",
    isBold: false,
    indent: 2,
  },
  {
    target: "- Nguyên giá",
    code: "222",
    isBold: false,
    indent: 3,
  },
  {
    target: "- Giá trị hao mòn lũy kế (*)",
    code: "223",
    isBold: false,
    indent: 3,
  },
  {
    target: "2. Tài sản cố định thuê tài chính",
    code: "224",
    isBold: false,
    indent: 2,
  },
  {
    target: "- Nguyên giá",
    code: "225",
    isBold: false,
    indent: 3,
  },
  {
    target: "- Giá trị hao mòn lũy kế (*)",
    code: "226",
    isBold: false,
    indent: 3,
  },
  {
    target: "3. Tài sản cố định vô hình",
    code: "227",
    isBold: false,
    indent: 2,
  },
  {
    target: "- Nguyên giá",
    code: "228",
    isBold: false,
    indent: 3,
  },
  {
    target: "- Giá trị hao mòn lũy kế (*)",
    code: "229",
    isBold: false,
    indent: 3,
  },
  {
    target: "III. Tài sản sinh học dài hạn",
    code: "230",
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Súc vật nuôi cho sản phẩm định kỳ",
    code: "231",
    isBold: false,
    indent: 2,
  },
  {
    target: "a) Súc vật nuôi cho sản phẩm định kỳ chưa đến giai đoạn trưởng thành",
    code: "232",
    isBold: false,
    indent: 3,
  },
  {
    target: "b) Súc vật nuôi cho sản phẩm định kỳ đến giai đoạn trưởng thành",
    code: "233",
    isBold: false,
    indent: 3,
  },
  {
    target: "- Nguyên giá",
    code: "234",
    isBold: false,
    indent: 3,
  },
  {
    target: "- Giá trị khấu hao lũy kế (*)",
    code: "235",
    isBold: false,
    indent: 3,
  },
  {
    target: "2. Súc vật nuôi lấy sản phẩm một lần dài hạn",
    code: "236",
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Cây trồng theo mùa vụ hoặc lấy sản phẩm một lần dài hạn",
    code: "237",
    isBold: false,
    indent: 2,
  },
  {
    target: "4. Dự phòng tổn thất tài sản sinh học dài hạn (*)",
    code: "238",
    isBold: false,
    indent: 2,
  },
  {
    target: "IV. Bất động sản đầu tư",
    code: "240",
    isBold: true,
    indent: 1,
  },
  {
    target: "- Nguyên giá",
    code: "241",
    isBold: false,
    indent: 2,
  },
  {
    target: "- Giá trị hao mòn lũy kế (*)",
    code: "242",
    isBold: false,
    indent: 2,
  },
  {
    target: "V. Tài sản dở dang dài hạn",
    code: "250",
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Chi phí sản xuất, kinh doanh dở dang dài hạn",
    code: "251",
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Chi phí xây dựng cơ bản dở dang",
    code: "252",
    isBold: false,
    indent: 2,
  },
  {
    target: "VI. Đầu tư tài chính dài hạn",
    code: "260",
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Đầu tư vào công ty con",
    code: "261",
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Đầu tư vào công ty liên doanh, liên kết",
    code: "262",
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Đầu tư góp vốn vào đơn vị khác",
    code: "263",
    isBold: false,
    indent: 2,
  },
  {
    target: "4. Dự phòng tổn thất đầu tư vào đơn vị khác dài hạn (*)",
    code: "264",
    isBold: false,
    indent: 2,
  },
  {
    target: "5. Đầu tư nắm giữ đến ngày đáo hạn dài hạn",
    code: "265",
    isBold: false,
    indent: 2,
  },
  {
    target: "6. Dự phòng đầu tư nắm giữ đến ngày đáo hạn dài hạn (*)",
    code: "266",
    isBold: false,
    indent: 2,
  },
  {
    target: "VII. Tài sản dài hạn khác",
    code: "270",
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Chi phí chờ phân bổ dài hạn",
    code: "271",
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Tài sản thuế thu nhập hoãn lại",
    code: "272",
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Thiết bị, vật tư, phụ tùng thay thế dài hạn",
    code: "273",
    isBold: false,
    indent: 2,
  },
  {
    target: "4. Tài sản dài hạn khác",
    code: "274",
    isBold: false,
    indent: 2,
  },

  // TỔNG CỘNG TÀI SẢN (280)
  {
    target: "TỔNG CỘNG TÀI SẢN (280 = 100 + 200)",
    code: "280",
    isBold: true,
    indent: 0,
    month10Value: 24475000,
    month10Change: 24475000,
  },

  // C - NỢ PHẢI TRẢ
  {
    target: "C - NỢ PHẢI TRẢ",
    code: "300",
    isBold: true,
    indent: 0,
    month10Value: 17000000,
    month10Change: 17000000,
  },
  {
    target: "I. Nợ ngắn hạn",
    code: "310",
    isBold: true,
    indent: 1,
    month10Value: 17000000,
    month10Change: 17000000,
  },
  {
    target: "1. Phải trả người bán ngắn hạn",
    code: "311",
    isBold: false,
    indent: 2,
    month10Value: 17000000,
    month10Change: 17000000,
  },
  {
    target: "2. Người mua trả tiền trước ngắn hạn",
    code: "312",
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Phải trả cổ tức, lợi nhuận",
    code: "313",
    isBold: false,
    indent: 2,
  },
  {
    target: "4. Thuế và các khoản phải nộp Nhà nước ngắn hạn",
    code: "314",
    isBold: false,
    indent: 2,
  },
  {
    target: "5. Phải trả người lao động",
    code: "315",
    isBold: false,
    indent: 2,
  },
  {
    target: "6. Chi phí phải trả ngắn hạn",
    code: "316",
    isBold: false,
    indent: 2,
  },
  {
    target: "7. Phải trả nội bộ ngắn hạn",
    code: "317",
    isBold: false,
    indent: 2,
  },
  {
    target: "8. Phải trả theo tiến độ hợp đồng xây dựng ngắn hạn",
    code: "318",
    isBold: false,
    indent: 2,
  },
  {
    target: "9. Doanh thu chờ phân bổ ngắn hạn",
    code: "319",
    isBold: false,
    indent: 2,
  },
  {
    target: "10. Phải trả ngắn hạn khác",
    code: "320",
    isBold: false,
    indent: 2,
  },
  {
    target: "11. Vay và nợ thuê tài chính ngắn hạn",
    code: "321",
    isBold: false,
    indent: 2,
  },
  {
    target: "12. Dự phòng phải trả ngắn hạn",
    code: "322",
    isBold: false,
    indent: 2,
  },
  {
    target: "13. Quỹ khen thưởng, phúc lợi",
    code: "323",
    isBold: false,
    indent: 2,
  },
  {
    target: "14. Quỹ bình ổn giá",
    code: "324",
    isBold: false,
    indent: 2,
  },
  {
    target: "15. Giao dịch mua bán lại trái phiếu Chính phủ",
    code: "325",
    isBold: false,
    indent: 2,
  },
  {
    target: "II. Nợ dài hạn",
    code: "330",
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Phải trả người bán dài hạn",
    code: "331",
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Người mua trả tiền trước dài hạn",
    code: "332",
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Thuế và các khoản phải nộp Nhà nước dài hạn",
    code: "333",
    isBold: false,
    indent: 2,
  },
  {
    target: "4. Chi phí phải trả dài hạn",
    code: "334",
    isBold: false,
    indent: 2,
  },
  {
    target: "5. Phải trả nội bộ về vốn kinh doanh",
    code: "335",
    isBold: false,
    indent: 2,
  },
  {
    target: "6. Phải trả nội bộ dài hạn",
    code: "336",
    isBold: false,
    indent: 2,
  },
  {
    target: "7. Doanh thu chờ phân bổ dài hạn",
    code: "337",
    isBold: false,
    indent: 2,
  },
  {
    target: "8. Phải trả dài hạn khác",
    code: "338",
    isBold: false,
    indent: 2,
  },
  {
    target: "9. Vay và nợ thuê tài chính dài hạn",
    code: "339",
    isBold: false,
    indent: 2,
  },
  {
    target: "10. Trái phiếu chuyển đổi",
    code: "340",
    isBold: false,
    indent: 2,
  },
  {
    target: "11. Cổ phiếu ưu đãi",
    code: "341",
    isBold: false,
    indent: 2,
  },
  {
    target: "12. Thuế thu nhập hoãn lại phải trả",
    code: "342",
    isBold: false,
    indent: 2,
  },
  {
    target: "13. Dự phòng phải trả dài hạn",
    code: "343",
    isBold: false,
    indent: 2,
  },
  {
    target: "14. Quỹ phát triển khoa học và công nghệ",
    code: "344",
    isBold: false,
    indent: 2,
  },

  // D - VỐN CHỦ SỞ HỮU
  {
    target: "D - VỐN CHỦ SỞ HỮU",
    code: "400",
    isBold: true,
    indent: 0,
  },
  {
    target: "1. Vốn góp của chủ sở hữu",
    code: "411",
    isBold: false,
    indent: 1,
  },
  {
    target: "- Cổ phiếu phổ thông có quyền biểu quyết",
    code: "411a",
    isBold: false,
    indent: 2,
  },
  {
    target: "- Cổ phiếu ưu đãi",
    code: "411b",
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Thặng dư vốn",
    code: "412",
    isBold: false,
    indent: 1,
  },
  {
    target: "3. Quyền chọn chuyển đổi trái phiếu",
    code: "413",
    isBold: false,
    indent: 1,
  },
  {
    target: "4. Vốn khác của chủ sở hữu",
    code: "414",
    isBold: false,
    indent: 1,
  },
  {
    target: "5. Cổ phiếu mua lại của chính mình (*)",
    code: "415",
    isBold: false,
    indent: 1,
  },
  {
    target: "6. Chênh lệch đánh giá lại tài sản",
    code: "416",
    isBold: false,
    indent: 1,
  },
  {
    target: "7. Chênh lệch tỷ giá hối đoái",
    code: "417",
    isBold: false,
    indent: 1,
  },
  {
    target: "8. Quỹ đầu tư phát triển",
    code: "418",
    isBold: false,
    indent: 1,
  },
  {
    target: "9. Quỹ khác thuộc vốn chủ sở hữu",
    code: "419",
    isBold: false,
    indent: 1,
  },
  {
    target: "10. Lợi nhuận sau thuế chưa phân phối",
    code: "420",
    isBold: false,
    indent: 1,
  },
  {
    target: "- LNST chưa phân phối lũy kế đến cuối kỳ trước",
    code: "420a",
    isBold: false,
    indent: 2,
  },
  {
    target: "- LNST chưa phân phối kỳ này",
    code: "420b",
    isBold: false,
    indent: 2,
  },

  // TỔNG CỘNG NGUỒN VỐN (440)
  {
    target: "TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)",
    code: "440",
    isBold: true,
    indent: 0,
    month10Value: 17000000,
    month10Change: 17000000,
  },
];

const MONTH_DATE_LABELS: Record<number, string> = {
  1: "31/01/2026",
  2: "28/02/2026",
  3: "31/03/2026",
  4: "30/04/2026",
  5: "31/05/2026",
  6: "30/06/2026",
  7: "31/07/2026",
  8: "31/08/2026",
  9: "30/09/2026",
  10: "31/10/2026",
  11: "30/11/2026",
  12: "31/12/2026",
};

export interface MisaBalanceSheetGrowthAnalysisReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaBalanceSheetGrowthAnalysisReport({
  onBack,
  notify,
}: MisaBalanceSheetGrowthAnalysisReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [periodType, setPeriodType] = useState<"month" | "quarter" | "halfYear" | "year" | "samePeriod">("month");
  const [fromMonth, setFromMonth] = useState(1);
  const [fromYear, setFromYear] = useState(2026);
  const [toMonth, setToMonth] = useState(10);
  const [toYear, setToYear] = useState(2026);
  const [fromPreparedReport, setFromPreparedReport] = useState(false);
  const [hideZeroRows, setHideZeroRows] = useState(false);

  // Temporary drawer draft state
  const [draftPeriodType, setDraftPeriodType] = useState<"month" | "quarter" | "halfYear" | "year" | "samePeriod">("month");
  const [draftFromMonth, setDraftFromMonth] = useState(1);
  const [draftFromYear, setDraftFromYear] = useState(2026);
  const [draftToMonth, setDraftToMonth] = useState(10);
  const [draftToYear, setDraftToYear] = useState(2026);
  const [draftFromPreparedReport, setDraftFromPreparedReport] = useState(false);
  const [draftHideZeroRows, setDraftHideZeroRows] = useState(false);

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  const handleOpenDrawer = () => {
    setDraftPeriodType(periodType);
    setDraftFromMonth(fromMonth);
    setDraftFromYear(fromYear);
    setDraftToMonth(toMonth);
    setDraftToYear(toYear);
    setDraftFromPreparedReport(fromPreparedReport);
    setDraftHideZeroRows(hideZeroRows);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriodType(draftPeriodType);
    setFromMonth(draftFromMonth);
    setFromYear(draftFromYear);
    setToMonth(draftToMonth);
    setToYear(draftToYear);
    setFromPreparedReport(draftFromPreparedReport);
    setHideZeroRows(draftHideZeroRows);
    setIsParamDrawerOpen(false);
    notify?.("Đã tải lại Phân tích tăng trưởng các chỉ tiêu Báo cáo tình hình tài chính.");
  };

  const handleResetParams = () => {
    setDraftPeriodType("month");
    setDraftFromMonth(1);
    setDraftFromYear(2026);
    setDraftToMonth(10);
    setDraftToYear(2026);
    setDraftFromPreparedReport(false);
    setDraftHideZeroRows(false);
  };

  // Format currency helper
  const formatCell = (val?: number) => {
    if (val === undefined || val === null) return { text: "", isNegative: false };
    if (val === 0) return { text: "0", isNegative: false };
    if (val < 0) {
      return {
        text: `(${Math.abs(val).toLocaleString("vi-VN")})`,
        isNegative: true,
      };
    }
    return {
      text: val.toLocaleString("vi-VN"),
      isNegative: false,
    };
  };

  // Range of months for the table columns
  const monthsRange = useMemo(() => {
    const list: number[] = [];
    for (let m = fromMonth; m <= toMonth; m++) {
      list.push(m);
    }
    return list;
  }, [fromMonth, toMonth]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return DEFAULT_ROWS.filter((row) => {
      if (hideZeroRows) {
        if (!row.month10Value && !row.month10Change) return false;
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return (
          row.code.toLowerCase().includes(kw) ||
          row.target.toLowerCase().includes(kw)
        );
      }
      return true;
    });
  }, [hideZeroRows, searchKeyword]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#ffffff",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* 1. Top Header Bar matching Screenshot 2/3/4/5 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          minHeight: 46,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "transparent",
              border: "none",
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              borderRadius: 4,
            }}
            title="Quay lại danh mục báo cáo"
          >
            <ChevronLeft size={20} />
          </button>
          <h2
            style={{
              margin: 0,
              fontSize: 14.5,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Phân tích tăng trưởng các chỉ tiêu Báo cáo tình hình tài chính
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Tải xuống"
            onClick={() => notify?.("Đang tải xuống dữ liệu báo cáo...")}
          >
            <Download size={17} />
          </button>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Đóng"
          >
            <X size={19} />
          </button>
        </div>
      </div>

      {/* 2. Action Toolbar matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          gap: 10,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              color: "#94a3b8",
            }}
          />
          <input
            type="text"
            placeholder="Tìm kiếm"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{
              height: 30,
              width: 200,
              padding: "0 10px 0 30px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              outline: "none",
              background: "#ffffff",
            }}
          />
        </div>

        <button
          type="button"
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
          }}
          title="Nạp lại"
          onClick={() => notify?.("Đã làm mới dữ liệu báo cáo.")}
        >
          <RefreshCw size={15} />
        </button>

        <button
          type="button"
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
          }}
          title="Gửi email"
          onClick={() => notify?.("Mở hộp thoại gửi email")}
        >
          <Mail size={15} />
        </button>

        <button
          type="button"
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "#0284c7",
            cursor: "pointer",
          }}
          title="Bình luận / Trao đổi"
          onClick={() => notify?.("Mở bảng trao đổi nội bộ")}
        >
          <MessageCircle size={15} />
        </button>

        <button
          type="button"
          style={{
            width: 30,
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
          }}
          title="In báo cáo"
          onClick={() => notify?.("Đang tải dữ liệu in báo cáo...")}
        >
          <Printer size={15} />
        </button>

        <button
          type="button"
          style={{
            height: 30,
            padding: "0 6px",
            display: "flex",
            alignItems: "center",
            gap: 2,
            background: "transparent",
            border: "none",
            color: "#16a34a",
            cursor: "pointer",
          }}
          title="Xuất khẩu Excel"
          onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>XLS</span>
          <ChevronDown size={13} color="#64748b" />
        </button>

        <button
          type="button"
          style={{
            height: 32,
            padding: "0 18px",
            background: "#00a862",
            border: "none",
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
          onClick={handleOpenDrawer}
        >
          Chọn tham số
        </button>
      </div>

      {/* 3. Subtitle matching Screenshot 2 */}
      <div style={{ textAlign: "center", padding: "14px 20px 10px 20px" }}>
        <h3
          style={{
            margin: 0,
            fontSize: 13.5,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Từ tháng {fromMonth}/{fromYear} đến tháng {toMonth}/{toYear}
        </h3>
      </div>

      {/* 4. Table Container with Horizontal Scroll matching Screenshots 2, 3, 4, 5 */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0 20px 16px 20px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "max-content",
              minWidth: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            <thead>
              {/* Row 1 Header */}
              <tr style={{ background: "#e2f0d9" }}>
                <th
                  rowSpan={2}
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    background: "#e2f0d9",
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 260,
                  }}
                >
                  Chỉ tiêu
                </th>
                <th
                  rowSpan={2}
                  style={{
                    position: "sticky",
                    left: 260,
                    zIndex: 2,
                    background: "#e2f0d9",
                    border: "1px solid #cbd5e1",
                    padding: "8px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 70,
                  }}
                >
                  Mã số
                </th>

                {/* Month 1 (first month in range): ColSpan 1 matching Screenshot 2 */}
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 120,
                  }}
                >
                  Tại ngày {MONTH_DATE_LABELS[monthsRange[0]] || `Tháng ${monthsRange[0]}`}
                </th>

                {/* Months 2..10: ColSpan 3 each matching Screenshot 2..5 */}
                {monthsRange.slice(1).map((m) => (
                  <th
                    key={m}
                    colSpan={3}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "6px 10px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#1e293b",
                      minWidth: 320,
                    }}
                  >
                    Tại ngày {MONTH_DATE_LABELS[m] || `Tháng ${m}`}
                  </th>
                ))}
              </tr>

              {/* Row 2 Subheaders */}
              <tr style={{ background: "#e2f0d9" }}>
                {/* Month 1 subheader: Giá trị */}
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                  Giá trị
                </th>

                {/* Months 2..10 subheaders: Giá trị | Tăng/giảm | Tỷ lệ tăng/giảm (%) */}
                {monthsRange.slice(1).map((m) => (
                  <React.Fragment key={m}>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                      Giá trị
                    </th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                      Tăng/giảm
                    </th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 110 }}>
                      Tỷ lệ tăng/giảm (%)
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const isMonth10 = monthsRange.includes(10);
                const m10ValFmt = formatCell(row.month10Value);
                const m10ChgFmt = formatCell(row.month10Change);

                return (
                  <tr
                    key={idx}
                    style={{
                      background: "#ffffff",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                  >
                    {/* Chỉ tiêu (Sticky) */}
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 1,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        paddingLeft: 12 + (row.indent || 0) * 16,
                        fontWeight: row.isBold ? 700 : 400,
                        color: row.isBold ? "#0f172a" : "#334155",
                      }}
                    >
                      {row.target}
                    </td>

                    {/* Mã số (Sticky) */}
                    <td
                      style={{
                        position: "sticky",
                        left: 260,
                        zIndex: 1,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        padding: "7px 10px",
                        textAlign: "center",
                        fontWeight: row.isBold ? 700 : 400,
                        color: row.isBold ? "#0f172a" : "#334155",
                      }}
                    >
                      {row.code}
                    </td>

                    {/* First month in range */}
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 8px",
                        textAlign: "right",
                        fontWeight: row.isBold ? 700 : 400,
                        color: monthsRange[0] === 10 && m10ValFmt.isNegative ? "#dc2626" : row.isBold ? "#0f172a" : "#334155",
                      }}
                    >
                      {monthsRange[0] === 10 ? m10ValFmt.text : ""}
                    </td>

                    {/* Subsequent months in range */}
                    {monthsRange.slice(1).map((m) => {
                      if (m === 10) {
                        return (
                          <React.Fragment key={m}>
                            <td
                              style={{
                                border: "1px solid #e2e8f0",
                                padding: "7px 8px",
                                textAlign: "right",
                                fontWeight: row.isBold ? 700 : 400,
                                color: m10ValFmt.isNegative ? "#dc2626" : row.isBold ? "#0f172a" : "#334155",
                              }}
                            >
                              {m10ValFmt.text}
                            </td>
                            <td
                              style={{
                                border: "1px solid #e2e8f0",
                                padding: "7px 8px",
                                textAlign: "right",
                                fontWeight: row.isBold ? 700 : 400,
                                color: m10ChgFmt.isNegative ? "#dc2626" : row.isBold ? "#0f172a" : "#334155",
                              }}
                            >
                              {m10ChgFmt.text}
                            </td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}></td>
                          </React.Fragment>
                        );
                      }
                      return (
                        <React.Fragment key={m}>
                          <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}></td>
                          <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}></td>
                          <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}></td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Parameter Drawer matching Screenshot 1 */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(15, 23, 42, 0.35)",
            backdropFilter: "blur(1px)",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: 520,
              maxWidth: "100%",
              height: "100%",
              background: "#ffffff",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  onClick={() => setIsParamDrawerOpen(false)}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body matching Screenshot 1 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                fontSize: 13,
              }}
            >
              {/* Kỳ báo cáo Radio Buttons: Tháng / Quý / 6 tháng / Năm / Cùng kỳ giữa các năm */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    marginBottom: 10,
                    color: "#0f172a",
                  }}
                >
                  Kỳ báo cáo
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="growthPeriodType"
                      checked={draftPeriodType === "month"}
                      onChange={() => setDraftPeriodType("month")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Tháng</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="growthPeriodType"
                      checked={draftPeriodType === "quarter"}
                      onChange={() => setDraftPeriodType("quarter")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Quý</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="growthPeriodType"
                      checked={draftPeriodType === "halfYear"}
                      onChange={() => setDraftPeriodType("halfYear")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>6 tháng</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="growthPeriodType"
                      checked={draftPeriodType === "year"}
                      onChange={() => setDraftPeriodType("year")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Năm</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="growthPeriodType"
                      checked={draftPeriodType === "samePeriod"}
                      onChange={() => setDraftPeriodType("samePeriod")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Cùng kỳ giữa các năm</span>
                  </label>
                </div>
              </div>

              {/* Từ tháng / Năm */}
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Từ tháng
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftFromMonth}
                      onChange={(e) => setDraftFromMonth(Number(e.target.value))}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 13,
                        outline: "none",
                        appearance: "none",
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          Tháng {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ width: 100 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Năm
                  </label>
                  <input
                    type="number"
                    value={draftFromYear}
                    onChange={(e) => setDraftFromYear(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Đến tháng / Năm */}
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Đến tháng
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftToMonth}
                      onChange={(e) => setDraftToMonth(Number(e.target.value))}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 13,
                        outline: "none",
                        appearance: "none",
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          Tháng {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ width: 100 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Năm
                  </label>
                  <input
                    type="number"
                    value={draftToYear}
                    onChange={(e) => setDraftToYear(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Checkboxes matching Screenshot 1 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#0f172a" }}>
                  <input
                    type="checkbox"
                    checked={draftFromPreparedReport}
                    onChange={(e) => setDraftFromPreparedReport(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span>Lấy số liệu từ báo cáo tài chính đã lập</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#0f172a" }}>
                  <input
                    type="checkbox"
                    checked={draftHideZeroRows}
                    onChange={(e) => setDraftHideZeroRows(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span>Không hiển thị các chỉ tiêu có số liệu = 0</span>
                </label>
              </div>
            </div>

            {/* Drawer Footer matching Screenshot 1 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={handleResetParams}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 13,
                  color: "#0f172a",
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: "6px 8px",
                }}
              >
                Xóa điều kiện
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    height: 32,
                    padding: "0 18px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#334155",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyParams}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Xem báo cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
