import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn(`404: Route not found - ${location.pathname}`);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 text-center px-6 max-w-lg">
        {/* 404 Number */}
        <div className="mb-8">
          <h1 className="text-[12rem] md:text-[16rem] font-black leading-none tracking-tighter gradient-text select-none">
            404
          </h1>
        </div>

        {/* Glass Card */}
        <div className="glass-card rounded-3xl p-8 md:p-10">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-destructive/20 flex items-center justify-center">
              <Search className="w-8 h-8 text-destructive" />
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Page Not Found
          </h2>

          <p className="text-muted-foreground mb-8 text-lg">
            The page you're looking for doesn't exist or has been moved.
            Let's get you back to drafting!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              className="btn-premium gap-2"
            >
              <Link to="/">
                <Home className="w-4 h-4" />
                Back to Draft
              </Link>
            </Button>

            <Button
              variant="outline"
              className="btn-secondary gap-2"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
          </div>
        </div>

        {/* Attempted Path */}
        <p className="mt-6 text-sm text-muted-foreground">
          Attempted path: <code className="px-2 py-1 rounded bg-secondary text-foreground">{location.pathname}</code>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
