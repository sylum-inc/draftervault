import { lazy, Suspense, useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ThemeProvider } from '@/components/ThemeToggle';
import { PWAPrompt } from '@/components/PWAPrompt';
import { initSentry } from '@/lib/sentry';
import { initWebVitals, observeLongTasks } from '@/lib/web-vitals';
import { initAccessibility } from '@/utils/accessibility';
import { logInfo } from '@/lib/logger';

// Initialize Sentry for error tracking
initSentry();

// Hash routing (VITE_ROUTER=hash) works on any static host and from file://
// without server-side rewrite rules; browser history routing is the default.
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter;

// Lazy load pages for code splitting
const Index = lazy(() => import('./pages/Index'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Configure React Query with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const AppContent = () => {
  useEffect(() => {
    // Initialize web vitals monitoring
    initWebVitals();
    observeLongTasks();

    // Initialize accessibility features
    initAccessibility();

    // Log app start
    logInfo('Application started', {
      component: 'App',
      version: __APP_VERSION__,
      buildTime: __BUILD_TIME__,
    });
  }, []);

  return (
    <>
      <Toaster />
      <Sonner
        position="top-right"
        toastOptions={{
          className: 'toast-premium',
          duration: 4000,
        }}
      />
      <PWAPrompt />
      <Router>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

// Declare global constants from Vite define
declare global {
  const __APP_VERSION__: string;
  const __BUILD_TIME__: string;
}

export default App;
