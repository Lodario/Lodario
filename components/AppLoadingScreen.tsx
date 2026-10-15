'use client';

import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

const StartupContext = createContext<(() => () => void) | null>(null);

// The root provider survives navigation, sign-in and team/role changes.
export function AppStartupProvider({ children }: { children: ReactNode }) {
  const [starting, setStarting] = useState(true);
  const [pending, setPending] = useState(0);
  const register = useCallback(() => {
    setPending(count => count + 1);
    return () => setPending(count => count - 1);
  }, []);

  useEffect(() => {
    if (!starting || pending !== 0) return;
    let secondFrame = 0;
    // Let sequential auth, consent, data and route gates mount before ending startup.
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setStarting(false));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [pending, starting]);

  return (
    <StartupContext.Provider value={starting ? register : null}>
      {children}
      {starting ? <StartupSplash /> : null}
    </StartupContext.Provider>
  );
}

export function AppLoadingScreen() {
  const register = useContext(StartupContext);
  useEffect(() => register?.(), [register]);
  if (register) return null;
  return (
    <div role="status" aria-label="Loading" className="flex min-h-32 items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" aria-hidden="true" />
    </div>
  );
}

function StartupSplash() {
  const filterId = `loading-alpha-${useId().replace(/:/g, '')}`;
  return (
    <div
      role="status"
      aria-label="Loading Lodario"
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-black"
    >
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          {/* The GIF's dark matte has red below 0.1; the orange/red logo has red near 1.
              Key the matte out at render time, preserving the original animated frames. */}
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1.111111 0 0 0 -0.111111" />
          </filter>
        </defs>
      </svg>
      {/* Keep the supplied GIF animated rather than optimizing it as a still image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/lodario-loading.gif"
        alt=""
        width={180}
        height={195}
        fetchPriority="high"
        className="h-auto w-[180px] max-w-[50vw]"
        style={{ filter: `url(#${filterId})` }}
      />
    </div>
  );
}
