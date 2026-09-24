/**
 * @author Flow (Florian) — FlowCreativeStudio
 * @see https://github.com/NayrolfRdgs
 * @discord nayrolf_rdgs
 * @signature FCS-SIG-2026:e2848c38514d22829359a8cedb77c1df2960c7ae3e946d90803516a68b87bd67
 */

/*fcs:Flow:e2848c38514d22829359a8cedb77c1df2960c7ae3e946d90803516a68b87bd67*/
console.log('%c🎨 FlowCreativeStudio', 'color:#6366f1;font-weight:bold;font-size:14px');

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Uncaught React exception:', error, errorInfo);
    (window as any).__errors = (window as any).__errors || [];
    (window as any).__errors.push({ error: error.toString(), stack: error.stack, info: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          backgroundColor: '#0b0f19',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '24px',
          boxSizing: 'border-box',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '640px',
            backgroundColor: '#1e293b',
            padding: '32px',
            borderRadius: '16px',
            border: '1px solid #334155',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f43f5e', marginBottom: '12px' }}>
              Une anomalie est survenue lors de l'affichage
            </h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
              KaïroOS a rencontré une erreur d'exécution. Vous pouvez recharger l'interface ou réinitialiser le cache.
            </p>
            <pre style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              backgroundColor: '#0f172a',
              color: '#cbd5e1',
              padding: '12px',
              borderRadius: '8px',
              textAlign: 'left',
              overflowX: 'auto',
              maxHeight: '180px',
              marginBottom: '20px',
              whiteSpace: 'pre-wrap'
            }}>
              {this.state.error?.toString() || 'Erreur inconnue'}
            </pre>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#f43f5e',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Recharger l'interface
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.clear();
                    sessionStorage.clear();
                  } catch (_) {}
                  window.location.reload();
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Vider le cache et relancer
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>
  );
}
