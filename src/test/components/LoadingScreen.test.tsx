import { describe, it, expect } from 'vitest';
import { render, screen } from '../test-utils';
import {
  LoadingScreen,
  PlayerCardSkeleton,
  PlayerListSkeleton,
  StatCardSkeleton,
  ChartSkeleton,
  TableSkeleton,
} from '@/components/LoadingScreen';

describe('LoadingScreen', () => {
  it('renders with default message', () => {
    render(<LoadingScreen />);

    expect(screen.getByText('Loading Draft Vault...')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingScreen message="Custom loading message" />);

    expect(screen.getByText('Custom loading message')).toBeInTheDocument();
  });

  it('renders Draft Vault logo text', () => {
    render(<LoadingScreen />);

    expect(screen.getByText('Draft Vault')).toBeInTheDocument();
  });

  it('renders the trophy icon container', () => {
    const { container } = render(<LoadingScreen />);

    // Check for the animated logo container
    const logoContainer = container.querySelector('.animate-pulse-glow');
    expect(logoContainer).toBeInTheDocument();
  });
});

describe('Skeleton Components', () => {
  it('renders PlayerCardSkeleton with animation', () => {
    const { container } = render(<PlayerCardSkeleton />);

    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
    expect(container.querySelector('.glass-card')).toBeInTheDocument();
  });

  it('renders PlayerListSkeleton with default count of 5', () => {
    const { container } = render(<PlayerListSkeleton />);

    const skeletons = container.querySelectorAll('.glass-card');
    expect(skeletons.length).toBe(5);
  });

  it('renders PlayerListSkeleton with custom count', () => {
    const { container } = render(<PlayerListSkeleton count={3} />);

    const skeletons = container.querySelectorAll('.glass-card');
    expect(skeletons.length).toBe(3);
  });

  it('renders StatCardSkeleton with animation', () => {
    const { container } = render(<StatCardSkeleton />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(container.querySelector('.glass-card')).toBeInTheDocument();
  });

  it('renders ChartSkeleton with animation', () => {
    const { container } = render(<ChartSkeleton />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(container.querySelector('.glass-card')).toBeInTheDocument();
  });

  it('renders TableSkeleton with default rows and cols', () => {
    const { container } = render(<TableSkeleton />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(container.querySelector('.glass-card')).toBeInTheDocument();

    // Check for border-b classes indicating rows
    const rows = container.querySelectorAll('.border-b');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('renders TableSkeleton with custom dimensions', () => {
    const { container } = render(<TableSkeleton rows={3} cols={2} />);

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();

    // 3 rows + 1 header = 4 rows with borders (but last has no border)
    const rows = container.querySelectorAll('.border-b');
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
