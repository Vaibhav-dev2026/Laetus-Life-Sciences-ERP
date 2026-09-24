import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // In production this should report to a monitoring service.
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center",
        }}>
          <h2>Something went wrong.</h2>
          <p style={{ color: "#666", maxWidth: 420 }}>
            An unexpected error occurred while rendering the application. You can try reloading, or return to the dashboard.
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload Application</button>
            <button className="btn btn-secondary" onClick={() => { window.location.href = "/dashboard"; }}>Return to Dashboard</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
