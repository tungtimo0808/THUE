import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            fontFamily: "'Be Vietnam Pro', sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 500,
              width: "100%",
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
              border: "1px solid #e2e8f0",
              padding: 28,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#fef2f2",
                color: "#ef4444",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 14px",
              }}
            >
              <AlertCircle size={24} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 6px" }}>
              Giao diện đang tải lại hoặc gặp gián đoạn tạm thời
            </h2>
            <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 16px", lineHeight: 1.5 }}>
              Hệ thống vừa cập nhật dữ liệu. Nhấn <strong>"Thử lại"</strong> hoặc <strong>"Tải lại trang"</strong> để hiển thị bình thường.
            </p>

            {this.state.error && (
              <div
                style={{
                  textAlign: "left",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 4,
                  padding: "8px 12px",
                  marginBottom: 16,
                  fontSize: 11.5,
                  color: "#64748b",
                  maxHeight: 120,
                  overflowY: "auto",
                }}
              >
                <span style={{ fontWeight: 600, color: "#ef4444" }}>Chi tiết: </span>
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleRetry}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  borderRadius: 4,
                  border: "none",
                  background: "#00a862",
                  color: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={14} />
                <span>Thử lại</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={14} />
                <span>Tải lại trang</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
