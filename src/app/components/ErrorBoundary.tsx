import { Component, type ReactNode, type ErrorInfo } from 'react';
import { errorMonitor } from '../utils/errorMonitor';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Optional fallback UI. If not provided, default recovery UI is shown */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary with integrated error monitoring.
 * 
 * Catches React rendering errors and:
 * 1. Reports to errorMonitor for persistence and optional remote reporting
 * 2. Shows a recovery UI with Retry and Reset options
 * 3. Prevents the entire app from white-screening
 * 
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Report to error monitor
    errorMonitor.capture(error, {
      type: 'react',
      componentStack: errorInfo.componentStack || undefined,
      context: 'ErrorBoundary',
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReset = () => {
    window.location.href = '/sw-reset';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: "'Noto Sans', system-ui, sans-serif",
            background: '#f0fdf4',
            color: '#065f46',
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <div style={{ maxWidth: '360px', width: '100%' }}>
            {/* Icon */}
            <div
              style={{
                width: 72,
                height: 72,
                margin: '0 auto 1.5rem',
                borderRadius: '50%',
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={36} color="#10b981" />
            </div>

            {/* Title */}
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>
              Something went wrong
            </h2>

            {/* Error message */}
            <p style={{ color: '#6b7280', margin: '0 0 0.25rem', fontSize: '0.875rem' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>

            {/* Error ID for support */}
            <p style={{ color: '#9ca3af', margin: '0 0 1.5rem', fontSize: '0.75rem' }}>
              Errors logged: {errorMonitor.getCount()}
            </p>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <RefreshCw size={18} />
                Retry
              </button>

              <button
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  background: 'white',
                  color: '#065f46',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <RefreshCw size={18} />
                Reload Page
              </button>

              <button
                onClick={this.handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  background: 'white',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: '0.75rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                <Trash2 size={16} />
                Reset App
              </button>
            </div>

            {/* Collapsible error details (for dev/support) */}
            {this.state.error?.stack && (
              <details
                style={{
                  marginTop: '1.5rem',
                  textAlign: 'left',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                }}
              >
                <summary
                  style={{
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    fontSize: '0.75rem',
                  }}
                >
                  Error Details
                </summary>
                <pre
                  style={{
                    padding: '0.5rem 0.75rem',
                    margin: 0,
                    fontSize: '0.625rem',
                    lineHeight: 1.4,
                    color: '#6b7280',
                    overflow: 'auto',
                    maxHeight: '200px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {this.state.error.stack}
                  {this.state.errorInfo?.componentStack && (
                    '\n\nComponent Stack:' + this.state.errorInfo.componentStack
                  )}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
