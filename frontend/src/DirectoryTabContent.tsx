import type { DirectoryTabDefinition } from "./misa-directory-definitions";
export default function DirectoryTabContent({
  tab,
  data,
  values,
  onChange,
}: {
  tab: string;
  data?: DirectoryTabDefinition;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (!data) return null;
  const readGrid = (key: string): Record<string, string>[] => {
    try {
      const value = JSON.parse(values[key] || "[]");
      return Array.isArray(value)
        ? value.filter(
            (row) => row && typeof row === "object" && !Array.isArray(row),
          )
        : [];
    } catch {
      return [];
    }
  };
  return (
    <section className="md-tab-content" aria-label={tab}>
      <div className="md-fields">
        {data.fields.map((field) => {
          const key = `${tab}:${field.label}`;
          return (
            <label key={key}>
              {field.label}{field.label==="Loại hợp đồng"&&<em>*</em>}
              {field.options ? <select value={values[key]||field.options[0]} onChange={e=>onChange(key,e.target.value)}>{field.options.map(option=><option key={option}>{option}</option>)}</select> : field.kind === "textarea" ? (
                <textarea
                  value={values[key] || ""}
                  onChange={(e) => onChange(key, e.target.value)}
                />
              ) : (
                <input
                  type={field.kind === "number" ? "number" : "text"}
                  value={values[key] || ""}
                  onInput={(e) => onChange(key, e.currentTarget.value)}
                  onChange={(e) => onChange(key, e.target.value)}
                />
              )}
            </label>
          );
        })}
      </div>
      {data.headers.map((headers, index) => {
        const key = `${tab}:grid:${index}`,
          rows = readGrid(key);
        return (
          <div key={key} className="md-tab-grid">
            <table>
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {headers.map((header) => (
                      <td key={header}>
                        <input
                          aria-label={`${header} dòng ${rowIndex + 1}`}
                          value={row[header] || ""}
                          onInput={(e) => {
                            const value = e.currentTarget.value;
                            onChange(
                              key,
                              JSON.stringify(
                                rows.map((old, i) =>
                                  i === rowIndex
                                    ? { ...old, [header]: value }
                                    : old,
                                ),
                              ),
                            );
                          }}
                          onChange={(e) => {
                            const value = e.target.value;
                            onChange(
                              key,
                              JSON.stringify(
                                rows.map((old, i) =>
                                  i === rowIndex
                                    ? { ...old, [header]: value }
                                    : old,
                                ),
                              ),
                            );
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <button
                onClick={() => onChange(key, JSON.stringify([...rows, {}]))}
              >
                Thêm dòng
              </button>
              <button
                disabled={!rows.length}
                onClick={() => onChange(key, "[]")}
              >
                Xóa hết dòng
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
