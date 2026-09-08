import Link from 'next/link';
import { LEGAL_LINKS } from '@/lib/legal';

export function PublicLegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="Legal and support" className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs ${className}`}>
      {LEGAL_LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-gray-400 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
