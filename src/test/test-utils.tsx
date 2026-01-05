import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface AllProvidersProps {
  children: ReactNode;
}

const AllProviders = ({ children }: AllProvidersProps) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: AllProviders, ...options });

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };

// Helper to wait for loading states
export const waitForLoadingToFinish = () => new Promise((resolve) => setTimeout(resolve, 0));

// Mock player data for tests
export const mockPlayer = {
  id: 'player-1',
  name: 'Patrick Mahomes',
  position: 'QB',
  team: 'KC',
  projectedPoints: 380,
  estimatedValue: 65,
  valueOverReplacement: 85,
  byeWeek: 10,
  rank: 1,
  adp: 1.5,
  trend: 'up' as const,
  injuryStatus: null,
  isAvailable: true,
  isDrafted: false,
  draftedBy: null,
  draftCost: null,
  pickNumber: null,
};

export const mockTeam = {
  id: 'team-1',
  name: 'My Team',
  budget: 200,
  spent: 0,
  remaining: 200,
  roster: [],
  rosterSpots: {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    FLEX: 1,
    BENCH: 6,
  },
  projectedTotal: 0,
  isUserTeam: true,
};

export const mockPlayers = [
  mockPlayer,
  {
    ...mockPlayer,
    id: 'player-2',
    name: 'Josh Allen',
    projectedPoints: 370,
    estimatedValue: 60,
    rank: 2,
  },
  {
    ...mockPlayer,
    id: 'player-3',
    name: 'Christian McCaffrey',
    position: 'RB',
    projectedPoints: 320,
    estimatedValue: 70,
    rank: 3,
  },
];

export const mockTeams = [
  mockTeam,
  { ...mockTeam, id: 'team-2', name: 'Team 2', isUserTeam: false },
  { ...mockTeam, id: 'team-3', name: 'Team 3', isUserTeam: false },
];
