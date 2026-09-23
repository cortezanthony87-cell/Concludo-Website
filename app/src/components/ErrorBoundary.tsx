import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a101d',
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '24px',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              backgroundColor: '#111c30',
              border: '1px solid rgba(226, 181, 60, 0.25)',
              borderRadius: '12px',
              padding: '36px 32px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(226, 181, 60, 0.15)',
                color: '#e2b53c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '24px',
              }}
            >
              ⚠
            </div>
            <h1
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '12px',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              Workspace Interface Notice
            </h1>
            <p
              style={{
                fontSize: '0.95rem',
                color: '#94a3b8',
                lineHeight: 1.6,
                marginBottom: '24px',
              }}
            >
              The workspace encountered a temporary rendering issue. Please reload the page to refresh your session.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 28px',
                backgroundColor: '#e2b53c',
                color: '#060a12',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
