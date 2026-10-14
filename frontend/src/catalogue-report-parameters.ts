import type { AuditedReportDefinition } from "./audited-report-schema";
import { MISA_REPORT_DEFINITIONS } from "./misa-report-definitions";
import { MISA_REPORT_ACCOUNTS } from "./misa-report-accounts";
const definitions:AuditedReportDefinition[] = [
  {
    "name": "S21-DN: Sổ tài sản cố định",
    "category": "Tài sản cố định",
    "viewer": "parameterOnly",
    "headers": [],
    "labels": [
      "Kỳ báo cáo",
      "Từ ngày",
      "Đến ngày",
      "Đơn vị sử dụng",
      "Loại tài sản cố định"
    ],
    "selectors": [],
    "checkboxes": [],
    "fields": [
      {
        "default": "Tháng này",
        "kind": "combo",
        "label": "Kỳ báo cáo",
        "required": false
      },
      {
        "default": "01/10/2026",
        "kind": "date",
        "label": "Từ ngày",
        "required": false
      },
      {
        "default": "31/10/2026",
        "kind": "date",
        "label": "Đến ngày",
        "required": false
      },
      {
        "kind": "combo",
        "label": "Đơn vị sử dụng",
        "required": false
      },
      {
        "kind": "combo",
        "label": "Loại tài sản cố định",
        "required": false
      }
    ],
    "radios": []
  },
  {
    "name": "Thẻ tài sản cố định",
    "category": "Tài sản cố định",
    "viewer": "parameterOnly",
    "headers": [],
    "labels": [
      "Đến ngày"
    ],
    "selectors": [
      {
        "title": "Tài sản cố định",
        "headers": [
          "Mã tài sản",
          "Tên tài sản",
          "Loại tài sản",
          "Tên đơn vị"
        ],
        "selectAllLabel": "Chọn tất cả"
      }
    ],
    "checkboxes": [],
    "fields": [
      {
        "default": "08/10/2026",
        "kind": "date",
        "label": "Đến ngày",
        "required": false
      }
    ],
    "radios": []
  },
  {
    "name": "S36-DN: Sổ chi phí sản xuất, kinh doanh",
    "category": "Giá thành",
    "viewer": "parameterOnly",
    "headers": [],
    "labels": [
      "Kỳ báo cáo",
      "Từ ngày",
      "Đến ngày",
      "Tài khoản"
    ],
    "selectors": [
      {
        "title": "Đối tượng tập hợp chi phí",
        "headers": [
          "Mã đối tượng THCP",
          "Tên đối tượng THCP",
          "Quy trình sản xuất",
          "Bậc"
        ],
        "selectAllLabel": "Chọn tất cả"
      }
    ],
    "checkboxes": [
      {
        "checked": false,
        "label": "Hiển thị số hóa đơn"
      },
      {
        "checked": false,
        "label": "Hiển thị số lượng và ĐVT chính của vật tư"
      },
      {
        "checked": true,
        "label": "Hiển thị theo dạng mở rộng"
      }
    ],
    "fields": [
      {
        "default": "Tháng này",
        "kind": "combo",
        "label": "Kỳ báo cáo",
        "required": false
      },
      {
        "default": "01/10/2026",
        "kind": "date",
        "label": "Từ ngày",
        "required": false
      },
      {
        "default": "31/10/2026",
        "kind": "date",
        "label": "Đến ngày",
        "required": false
      },
      {
        "default": "",
        "kind": "combo",
        "label": "Tài khoản",
        "required": true
      }
    ],
    "radios": []
  },
  {
    "name": "S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo yếu tố chi phí",
    "category": "Giá thành",
    "viewer": "parameterOnly",
    "headers": [],
    "labels": [
      "Kỳ tính giá thành"
    ],
    "selectors": [
      {
        "title": "Thành phẩm",
        "headers": [
          "Mã thành phẩm",
          "Tên thành phẩm",
          "Mã đối tượng THCP",
          "Quy trình sản xuất"
        ],
        "selectAllLabel": "Chọn tất cả"
      }
    ],
    "checkboxes": [],
    "fields": [
      {
        "kind": "combo",
        "label": "Kỳ tính giá thành",
        "required": false
      }
    ],
    "radios": []
  },
  {
    "name": "S37-DN: Thẻ tính giá thành đối tượng tập hợp chi phí - theo khoản mục chi phí",
    "category": "Giá thành",
    "viewer": "parameterOnly",
    "headers": [],
    "labels": [
      "Kỳ tính giá thành"
    ],
    "selectors": [
      {
        "title": "Thành phẩm",
        "headers": [
          "Mã thành phẩm",
          "Tên thành phẩm",
          "Mã đối tượng THCP",
          "Quy trình sản xuất"
        ],
        "selectAllLabel": "Chọn tất cả"
      }
    ],
    "checkboxes": [],
    "fields": [
      {
        "kind": "combo",
        "label": "Kỳ tính giá thành",
        "required": false
      }
    ],
    "radios": []
  },
  {
    "name": "S36-DN: Sổ chi phí sản xuất, kinh doanh theo công trình",
    "category": "Giá thành",
    "viewer": "parameterOnly",
    "headers": [],
    "labels": [
      "Kỳ báo cáo",
      "Từ ngày",
      "Đến ngày",
      "Tài khoản"
    ],
    "selectors": [
      {
        "title": "Công trình",
        "headers": [
          "Mã công trình",
          "Tên công trình",
          "Loại công trình",
          "Bậc"
        ],
        "selectAllLabel": "Chọn tất cả"
      }
    ],
    "checkboxes": [
      {
        "checked": false,
        "label": "Hiển thị số hóa đơn"
      },
      {
        "checked": false,
        "label": "Hiển thị số lượng và ĐVT chính của vật tư"
      },
      {
        "checked": true,
        "label": "Hiển thị theo dạng mở rộng"
      }
    ],
    "fields": [
      {
        "default": "Tháng này",
        "kind": "combo",
        "label": "Kỳ báo cáo",
        "required": false
      },
      {
        "default": "01/10/2026",
        "kind": "date",
        "label": "Từ ngày",
        "required": false
      },
      {
        "default": "31/10/2026",
        "kind": "date",
        "label": "Đến ngày",
        "required": false
      },
      {
        "default": "154",
        "kind": "combo",
        "label": "Tài khoản",
        "required": true
      }
    ],
    "radios": []
  },
  {
    "name": "S37-DN: Thẻ tính giá thành công trình - theo khoản mục chi phí",
    "category": "Giá thành",
    "viewer": "parameterOnly",
    "headers": [],
    "labels": [
      "Kỳ tính giá thành"
    ],
    "selectors": [
      {
        "title": "Công trình",
        "headers": [
          "Mã công trình",
          "Tên công trình",
          "Loại công trình",
          "Bậc"
        ],
        "selectAllLabel": "Chọn tất cả"
      }
    ],
    "checkboxes": [],
    "fields": [
      {
        "kind": "combo",
        "label": "Kỳ tính giá thành",
        "required": false
      }
    ],
    "radios": []
  }
];
export const CATALOGUE_PARAMETER_DEFINITIONS = definitions.map(definition=>({...definition,options:{"Kỳ báo cáo":MISA_REPORT_DEFINITIONS[0].options?.["Kỳ báo cáo"] || ["Tháng này","Tùy chọn"],"Tài khoản":["",...MISA_REPORT_ACCOUNTS.map(account=>account.code)]}}));
