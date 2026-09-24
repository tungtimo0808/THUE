import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Plus } from "lucide-react";
import { productionOrders } from "./inventory-data";
import {
  ProductionOrderFilter,
  ProductionOrderTable,
  ProductionOrderToolbar,
  ProductionQuickDetail,
} from "./InventoryWorkspaceParts";

const PAGE_SIZE = 5;

export function InventoryProductionOrders({
  onInfo,
  notify,
}: {
  onInfo: (text: string) => void;
  notify: (text: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const status = params.get("status") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(status);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (!("page" in updates)) next.delete("page");
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi-VN");
    return productionOrders.filter((order) => {
      const matchesQuery =
        !needle ||
        [order.code, order.productCode, order.productName, order.workshop]
          .join(" ")
          .toLocaleLowerCase("vi-VN")
          .includes(needle);
      return matchesQuery && (!status || order.status === status);
    });
  }, [query, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const detail = productionOrders.find((order) => order.id === detailId);

  const reset = () => {
    setPendingStatus("");
    updateParams({ q: "", status: "", page: "" });
  };

  return (
    <div className="production-workspace">
      <header className="production-heading">
        <div>
          <p>Kho / Điều hành sản xuất</p>
          <h2>Lệnh sản xuất</h2>
        </div>
        <button
          className="ref-button primary-action"
          onClick={() => onInfo("Thêm lệnh sản xuất")}
        >
          <Plus size={15} />
          Thêm lệnh sản xuất
          <ChevronDown size={13} />
        </button>
      </header>

      <section className="production-list" aria-label="Danh sách lệnh sản xuất">
        <ProductionOrderToolbar
          selectedCount={selected.length}
          query={query}
          status={status}
          filterOpen={filterOpen}
          onQuery={(value) => updateParams({ q: value })}
          onReload={() => notify("Đã nạp lại danh sách lệnh sản xuất.")}
          onInfo={onInfo}
          onToggleFilter={() => setFilterOpen(!filterOpen)}
          onClearSelection={() => setSelected([])}
        />

        {filterOpen && (
          <ProductionOrderFilter
            value={pendingStatus}
            onChange={setPendingStatus}
            onReset={reset}
            onApply={() => {
              updateParams({ status: pendingStatus });
              setFilterOpen(false);
            }}
          />
        )}

        <ProductionOrderTable
          orders={paged}
          total={filtered.length}
          selected={selected}
          detailId={detailId}
          currentPage={currentPage}
          pageCount={pageCount}
          onToggle={(id) =>
            setSelected(
              selected.includes(id)
                ? selected.filter((selectedId) => selectedId !== id)
                : [...selected, id],
            )
          }
          onToggleAll={(checked) =>
            setSelected(
              checked
                ? Array.from(
                    new Set([...selected, ...paged.map((order) => order.id)]),
                  )
                : selected.filter(
                    (id) => !paged.some((order) => order.id === id),
                  ),
            )
          }
          onDetail={(id) => {
            setDetailId(id);
            setDetailOpen(true);
          }}
          onPage={(nextPage) => updateParams({ page: String(nextPage) })}
          onReset={reset}
        />
      </section>

      <ProductionQuickDetail
        order={detail}
        open={detailOpen}
        onToggle={() => setDetailOpen(!detailOpen)}
      />
    </div>
  );
}
