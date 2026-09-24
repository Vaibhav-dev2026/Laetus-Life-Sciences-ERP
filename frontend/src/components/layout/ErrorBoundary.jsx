import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('ErrorBoundary caught:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="state-block" style={{ minHeight: '70vh', justifyContent: 'center' }}>
          <div className="state-icon">⚠️</div>
          <div className="state-title">Something went wrong.</div>
          <div className="state-desc">An unexpected error occurred while rendering this page.</div>
          <div className="flex-gap-3">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload Application</button>
            <button className="btn btn-secondary" onClick={() => { window.location.href = '/dashboard'; }}>Return to Dashboard</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
