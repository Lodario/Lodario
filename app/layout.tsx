import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { RootAppShell } from "@/components/RootAppShell";
import { getSiteUrl } from "@/lib/env/server";

const outfit = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

const siteUrl = getSiteUrl();
const siteDescription =
  "Football training, wellness, readiness, calendar, and team tools for adult players and coaches.";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "Lodario",
  title: "Lodario",
  description: siteDescription,
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "Lodario",
    description: siteDescription,
    siteName: "Lodario",
  },
  twitter: {
    card: "summary",
    title: "Lodario",
    description: siteDescription,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lodario",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  category: "sports",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0d0d0c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Lodario",
    url: siteUrl.toString(),
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    description: siteDescription,
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={`${outfit.className} antialiased min-h-screen bg-black`}>
        <AuthProvider>
          <RootAppShell>{children}</RootAppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
