import { useEffect, useRef } from 'react';
import { fx } from './fx';

/**
 * Mounts the effects canvas and the flash overlay above everything, and
 * points screen shake at the app content. Rendered once, by App.
 */
export function FxLayer({ enabled, shakeTarget }: { enabled: boolean; shakeTarget: React.RefObject<HTMLElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const flash = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvas.current || !flash.current || !shakeTarget.current) return;
    fx.attach(canvas.current, flash.current, shakeTarget.current);
    return () => fx.detach();
  }, [shakeTarget]);

  useEffect(() => {
    fx.enabled = enabled;
  }, [enabled]);

  return (
    <>
      <canvas ref={canvas} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] h-full w-full" />
      <div ref={flash} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[69] opacity-0" />
    </>
  );
}
