import { Component, ErrorInfo, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { AdminButton } from '@/components/pichangas/admin-ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: number;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorId: 0,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('=== ERROR BOUNDARY CAUGHT ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('=== END ERROR ===');
    this.setState({ errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, errorId: (this.state.errorId || 0) + 1 });
  };

  private toggleDetails = () => {
    this.setState({ showDetails: !this.state.showDetails });
  };

  public render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;
      
      return (
        <div className="flex min-h-screen items-center justify-center bg-night p-4 font-satoshi text-night-text">
          <div className="w-full max-w-lg rounded-md bg-night-container p-6 shadow-night-card">
            <div className="text-center">
              <TriangleAlert className="mx-auto mb-4 size-icon-empty text-crimson" aria-hidden />
              <h2 className="mb-2 text-subheading font-bold text-night-text">
                Algo salió mal
              </h2>
              <p className="mb-4 text-body text-night-muted">
                Ha ocurrido un error inesperado. Por favor, intenta de nuevo.
              </p>

              {/* Error details toggle */}
              <button
                onClick={this.toggleDetails}
                className="mb-4 rounded-sm text-label text-night-muted underline hover:text-night-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch"
              >
                {showDetails ? 'Ocultar detalles' : 'Ver detalles del error'}
              </button>

              {showDetails && error && (
                <div className="mb-4 max-h-48 overflow-auto rounded-sm bg-night-lowest p-3 text-left">
                  <p className="mb-2 text-label text-crimson">
                    {error.message}
                  </p>
                  {error.stack && (
                    <pre className="whitespace-pre-wrap text-caption text-night-muted">
                      {error.stack.split('\n').slice(0, 5).join('\n')}
                    </pre>
                  )}
                  {errorInfo?.componentStack && (
                    <pre className="mt-2 whitespace-pre-wrap text-caption text-night-muted">
                      {errorInfo.componentStack.split('\n').slice(0, 5).join('\n')}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex justify-center gap-3">
                <AdminButton tone="pitch" onClick={this.handleRetry}>Reintentar</AdminButton>
                <AdminButton onClick={() => window.location.reload()}>Recargar página</AdminButton>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}