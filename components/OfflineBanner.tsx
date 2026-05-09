'use client';

import { useNetwork } from '@/hooks/useNetwork';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const isOnline = useNetwork();

  if (isOnline) return null;

  return (
    <div className="bg-[rgba(255,107,107,0.15)] border-b border-[rgba(255,107,107,0.3)] px-4 py-2.5 flex items-center justify-center space-x-2 animate-slide-up">
      <WifiOff size={14} className="text-[#ff6b6b] flex-shrink-0" />
      <p className="text-xs text-[#ff6b6b] font-medium">
        You&apos;re offline — data won&apos;t sync until you reconnect
      </p>
    </div>
  );
}
