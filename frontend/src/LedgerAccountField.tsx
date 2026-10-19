import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { MISA_REPORT_ACCOUNTS } from './misa-report-accounts';

export default function LedgerAccountField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const root = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const open = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (position) {
      setPosition(null);
      return;
    }
    const rect = root.current?.getBoundingClientRect();
    if (rect) {
      setQuery('');
      const width = 380;
      const height = 330;

      let left = rect.left;
      if (left + width > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - width - 12);
      }

      let top = rect.bottom + 4;
      if (top + height > window.innerHeight - 12) {
        top = Math.max(12, rect.top - height - 4);
      }

      const initialIdx = MISA_REPORT_ACCOUNTS.findIndex((a) => a.code === value);
      setHighlightIndex(initialIdx >= 0 ? initialIdx : 0);
      setPosition({ left, top, width });
    }
  };

  useEffect(() => {
    if (!position) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) {
        setPosition(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [position]);

  // Focus search input on open
  useEffect(() => {
    if (position) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [position]);

  const options = MISA_REPORT_ACCOUNTS.filter((account) =>
    `${account.code} ${account.name}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))
  );

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (position && listRef.current) {
      const items = listRef.current.querySelectorAll('.ref-cluster-popover-item');
      if (items[highlightIndex]) {
        (items[highlightIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex, position]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[highlightIndex]) {
        onChange(options[highlightIndex].code);
        setPosition(null);
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setPosition(null);
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!position) open();
    } else if (e.key === 'Escape' && position) {
      e.stopPropagation();
      setPosition(null);
    }
  };

  return (
    <div
      ref={root}
      onClick={open}
      onKeyDown={handleCellKeyDown}
      tabIndex={0}
      role="button"
      aria-haspopup="listbox"
      aria-expanded={!!position}
      aria-label={label}
      title={`Nhấp để chọn ${label}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <input
        aria-label={label}
        className="misa-voucher-cell-input"
        value={value}
        readOnly
        placeholder="--"
        tabIndex={-1}
        style={{
          textAlign: 'center',
          paddingRight: 20,
          cursor: 'pointer',
          fontWeight: value ? 600 : 400,
          color: value ? '#0f172a' : '#94a3b8',
          background: position ? '#f8fafc' : undefined,
          borderColor: position ? '#00b06b' : undefined,
          boxShadow: position ? '0 0 0 1px #00b06b' : undefined,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 5,
          top: '50%',
          transform: `translateY(-50%) ${position ? 'rotate(180deg)' : ''}`,
          transition: 'transform 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: position ? '#00b06b' : '#94a3b8',
          pointerEvents: 'none',
        }}
      >
        <ChevronDown size={12} />
      </div>

      {position &&
        createPortal(
          <div
            ref={popup}
            role="dialog"
            aria-label={`Chọn ${label}`}
            className="ref-cluster-popover misa-account-popover-card"
            style={{
              position: 'fixed',
              left: position.left,
              top: position.top,
              width: position.width,
              zIndex: 13000,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              boxShadow: '0 12px 28px -6px rgba(15, 23, 42, 0.16), 0 4px 10px -2px rgba(15, 23, 42, 0.06)',
              padding: 6,
              boxSizing: 'border-box',
            }}
          >
            {/* Header like taskbar reference */}
            <div
              className="ref-cluster-popover-header"
              style={{
                padding: '6px 10px 8px',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#94a3b8',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{label}</span>
              <span style={{ fontSize: 10, fontWeight: 500, color: '#cbd5e1', textTransform: 'none' }}>
                Hệ thống tài khoản
              </span>
            </div>

            {/* Compact Search Bar */}
            <div
              style={{
                position: 'relative',
                margin: '0 4px 6px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  left: 9,
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
              <input
                ref={searchInputRef}
                type="text"
                aria-label={`Tìm ${label}`}
                placeholder="Tìm số hoặc tên tài khoản..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                style={{
                  width: '100%',
                  height: 30,
                  padding: '0 26px 0 28px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 12,
                  outline: 'none',
                  background: '#f8fafc',
                  boxSizing: 'border-box',
                  color: '#1e293b',
                  transition: 'all 0.15s ease',
                }}
                onFocus={(e) => {
                  e.target.style.background = '#ffffff';
                  e.target.style.borderColor = '#0284c7';
                  e.target.style.boxShadow = '0 0 0 2px rgba(2, 132, 199, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.background = '#f8fafc';
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  title="Xóa tìm kiếm"
                  style={{
                    position: 'absolute',
                    right: 6,
                    border: 0,
                    background: 'transparent',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2,
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Options list styled exactly like taskbar ref-cluster-popover-item */}
            <div
              ref={listRef}
              className="ref-cluster-popover-list"
              style={{
                maxHeight: 240,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '0 2px',
              }}
            >
              {options.map((account, idx) => {
                const isSelected = value === account.code;
                const isHighlighted = idx === highlightIndex;
                return (
                  <button
                    type="button"
                    key={account.code}
                    className={`ref-cluster-popover-item ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      onChange(account.code);
                      setPosition(null);
                    }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: isSelected ? '#f0f9ff' : isHighlighted ? '#f1f5f9' : 'transparent',
                      color: isSelected ? '#0284c7' : isHighlighted ? '#0284c7' : '#334155',
                      fontFamily: 'inherit',
                      fontSize: 12.5,
                      fontWeight: isSelected ? 600 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      boxSizing: 'border-box',
                      minHeight: 30,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 12,
                          minWidth: 44,
                          color: isSelected || isHighlighted ? '#0284c7' : '#0f172a',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        }}
                      >
                        {account.code}
                      </span>
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                          fontSize: 12.5,
                          color: isSelected ? '#0284c7' : isHighlighted ? '#0284c7' : '#334155',
                        }}
                        title={account.name}
                      >
                        {account.name}
                      </span>
                    </div>

                    {isSelected && (
                      <Check
                        size={14}
                        className="ref-cluster-check"
                        style={{
                          color: '#0284c7',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </button>
                );
              })}

              {!options.length && (
                <div
                  style={{
                    padding: '16px 8px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: 12,
                  }}
                >
                  Không tìm thấy tài khoản phù hợp
                </div>
              )}
            </div>

            {/* Subtle footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px 2px',
                borderTop: '1px solid #f1f5f9',
                marginTop: 4,
                fontSize: 11,
                color: '#94a3b8',
              }}
            >
              <span>{options.length} tài khoản</span>
              <span style={{ fontSize: 10, color: '#cbd5e1' }}>↑ ↓ Enter để chọn</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
