import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: 'square' | 'circle' | 'triangle';
}

interface ConfettiProps {
  active: boolean;
  duration?: number;
  particleCount?: number;
  spread?: number;
  colors?: string[];
  onComplete?: () => void;
}

const defaultColors = [
  '#a855f7', // Purple (primary)
  '#06b6d4', // Cyan (accent)
  '#f59e0b', // Gold
  '#10b981', // Emerald
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#ec4899', // Pink
];

export const Confetti = ({
  active,
  duration = 3000,
  particleCount = 150,
  spread = 70,
  colors = defaultColors,
  onComplete,
}: ConfettiProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>(0);

  const createParticle = useCallback((centerX: number, centerY: number): Particle => {
    const angle = (Math.random() - 0.5) * spread * (Math.PI / 180) - Math.PI / 2;
    const velocity = 10 + Math.random() * 15;
    const shapes: Particle['shape'][] = ['square', 'circle', 'triangle'];

    return {
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * velocity * (0.5 + Math.random()),
      vy: Math.sin(angle) * velocity,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    };
  }, [colors, spread]);

  const drawParticle = useCallback((ctx: CanvasRenderingContext2D, particle: Particle) => {
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate((particle.rotation * Math.PI) / 180);
    ctx.globalAlpha = particle.opacity;
    ctx.fillStyle = particle.color;

    const halfSize = particle.size / 2;

    switch (particle.shape) {
      case 'square':
        ctx.fillRect(-halfSize, -halfSize, particle.size, particle.size);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(0, -halfSize);
        ctx.lineTo(halfSize, halfSize);
        ctx.lineTo(-halfSize, halfSize);
        ctx.closePath();
        ctx.fill();
        break;
    }

    ctx.restore();
  }, []);

  const animate = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const elapsed = timestamp - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particlesRef.current = particlesRef.current.filter((particle) => {
      // Update physics
      particle.vy += 0.3; // Gravity
      particle.vx *= 0.99; // Air resistance
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;

      // Fade out based on progress
      particle.opacity = 1 - progress;

      // Remove if off screen
      if (particle.y > canvas.height + 50) return false;

      drawParticle(ctx, particle);
      return true;
    });

    if (progress < 1 && particlesRef.current.length > 0) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }
  }, [duration, drawParticle, onComplete]);

  const startConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create particles from center-top
    const centerX = canvas.width / 2;
    const centerY = canvas.height * 0.3;

    particlesRef.current = Array.from({ length: particleCount }, () =>
      createParticle(centerX, centerY)
    );

    startTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animate);
  }, [particleCount, createParticle, animate]);

  useEffect(() => {
    if (active) {
      startConfetti();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active, startConfetti]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!active) return null;

  return createPortal(
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ width: '100vw', height: '100vh' }}
    />,
    document.body
  );
};

// Hook for easy confetti triggering
export function useConfetti() {
  const triggerRef = useRef<() => void>();
  const setTrigger = useCallback((fn: () => void) => {
    triggerRef.current = fn;
  }, []);

  const fire = useCallback(() => {
    triggerRef.current?.();
  }, []);

  return { fire, setTrigger };
}

export default Confetti;
