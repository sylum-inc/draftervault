import { Trophy } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen = ({ message = 'Loading Draft Vault...' }: LoadingScreenProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />

      <div className="relative z-10 text-center">
        {/* Animated Logo */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow animate-pulse-glow">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            {/* Spinning Ring */}
            <div className="absolute inset-0 -m-2">
              <svg className="w-28 h-28 animate-spin" style={{ animationDuration: '3s' }} viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="70 200"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(265 89% 62%)" />
                    <stop offset="100%" stopColor="hsl(185 100% 50%)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>

        {/* Logo Text */}
        <h1 className="logo-text text-4xl mb-4">Draft Vault</h1>

        {/* Loading Message */}
        <p className="text-muted-foreground text-lg mb-6">{message}</p>

        {/* Loading Bar */}
        <div className="w-64 mx-auto">
          <div className="progress-bar">
            <div
              className="progress-bar-fill animate-pulse"
              style={{ width: '60%', animation: 'loadingBar 1.5s ease-in-out infinite' }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes loadingBar {
          0%, 100% { width: 20%; margin-left: 0; }
          50% { width: 60%; margin-left: 20%; }
        }
      `}</style>
    </div>
  );
};

// Skeleton Components for specific use cases
export const PlayerCardSkeleton = () => (
  <div className="glass-card rounded-2xl p-4 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-secondary" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-secondary rounded w-3/4" />
        <div className="h-3 bg-secondary rounded w-1/2" />
      </div>
      <div className="w-16 h-8 rounded-lg bg-secondary" />
    </div>
  </div>
);

export const PlayerListSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <PlayerCardSkeleton key={i} />
    ))}
  </div>
);

export const StatCardSkeleton = () => (
  <div className="glass-card rounded-xl p-4 animate-pulse">
    <div className="h-3 bg-secondary rounded w-1/2 mb-3" />
    <div className="h-8 bg-secondary rounded w-3/4 mb-2" />
    <div className="h-2 bg-secondary rounded w-full" />
  </div>
);

export const ChartSkeleton = () => (
  <div className="glass-card rounded-2xl p-6 animate-pulse">
    <div className="h-4 bg-secondary rounded w-1/3 mb-6" />
    <div className="h-48 bg-secondary rounded-xl" />
  </div>
);

export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="glass-card rounded-2xl overflow-hidden animate-pulse">
    {/* Header */}
    <div className="flex gap-4 p-4 border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="h-4 bg-secondary rounded flex-1" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-4 p-4 border-b border-border last:border-0">
        {Array.from({ length: cols }).map((_, colIndex) => (
          <div key={colIndex} className="h-4 bg-secondary rounded flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export default LoadingScreen;
