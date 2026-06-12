import Image from 'next/image';

interface AppLogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

export function AppLogo({ size = 40, className = '', priority = false }: AppLogoProps) {
  return (
    <Image
      src="/icons/icon-512x512.png"
      alt="Lodario"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
