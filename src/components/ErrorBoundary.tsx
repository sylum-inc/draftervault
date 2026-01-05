import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log to error reporting service in production
    if (import.meta.env.PROD) {
      // Example: Send to error tracking service
      // errorTrackingService.captureException(error, { extra: errorInfo });
    } else {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-6">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-grid opacity-20" />
          <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-destructive/10 rounded-full blur-3xl" />

          <div className="relative z-10 w-full max-w-lg">
            <div className="glass-card rounded-3xl p-8 md:p-10 text-center">
              {/* Error Icon */}
              <div className="flex items-center justify-center mb-6">
                <div className="w-20 h-20 rounded-2xl bg-destructive/20 flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-10 h-10 text-destructive" />
                </div>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold mb-3">
                Something Went Wrong
              </h1>

              <p className="text-muted-foreground mb-6 text-lg">
                We encountered an unexpected error. Don't worry, your draft data is safe.
              </p>

              {/* Error Details (Dev Only) */}
              {import.meta.env.DEV && this.state.error && (
                <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-left">
                  <p className="text-sm font-mono text-destructive mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground transition-colors">
                        Stack trace
                      </summary>
                      <pre className="mt-2 overflow-auto max-h-40 p-2 bg-background/50 rounded">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={this.handleReset}
                  className="btn-premium gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>

                <Button
                  variant="outline"
                  onClick={this.handleReload}
                  className="btn-secondary gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </Button>

                <Button
                  variant="ghost"
                  onClick={this.handleGoHome}
                  className="gap-2 hover:bg-secondary"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </Button>
              </div>
            </div>

            {/* Support Text */}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              If this problem persists, please refresh the page or contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
