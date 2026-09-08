import type { Metadata } from 'next';
import { PublicDocumentLayout } from '@/components/legal/PublicDocumentLayout';

export const metadata: Metadata = {
  title: 'Cookie Information | Lodario',
  description: 'How Lodario currently uses authentication tokens, browser storage, preferences, and offline caches.',
  alternates: { canonical: '/cookies' },
};

export default function CookieInformationPage() {
  return (
    <PublicDocumentLayout
      title="Cookie Information"
      description="Lodario currently uses essential browser storage to keep accounts signed in and preserve useful application state."
    >
      <Section title="Cookies and authentication">
        <p>
          The Lodario application does not currently set its own advertising, behavioural-tracking, or analytics cookies. Supabase authentication uses a browser-stored session token so your account can remain signed in. In the current web implementation, that token is stored through the Supabase client&apos;s local browser storage rather than a custom Lodario authentication cookie.
        </p>
      </Section>

      <Section title="Local storage">
        <p>
          Essential local storage may keep your Supabase authentication session, active account role, selected coach team, coach alert dismissals, and dismissed Player home notifications. This helps the application restore your session and choices on the same browser.
        </p>
      </Section>

      <Section title="Session storage">
        <p>
          Session storage is used for temporary interface state such as calendar dates and views, open event state, analytics ranges and views, and selected players. Session storage is normally cleared when the browser session ends.
        </p>
      </Section>

      <Section title="Offline and cache storage">
        <p>
          Lodario&apos;s service worker and browser Cache Storage may retain application files for loading and offline support. Browser and hosting network caches may also retain public application assets for performance.
        </p>
      </Section>

      <Section title="Analytics and advertising">
        <p>
          No active analytics tracker, advertising tracker, or behavioural profiling storage was found in the current beta application. Advertising and behavioural tracking remain disabled. Because current storage is limited to essential account, preference, and offline functions, Lodario does not show a non-essential cookie consent banner at this stage.
        </p>
      </Section>

      <Section title="Your controls">
        <p>
          You can sign out or use browser settings to inspect, block, or clear site storage. Clearing authentication storage signs you out. Clearing preferences or session storage resets saved interface choices, and clearing caches may remove offline files until they are downloaded again. Blocking essential storage may prevent authentication or other core features from working correctly.
        </p>
      </Section>
    </PublicDocumentLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 text-xl font-bold text-white">{title}</h2>{children}</section>;
}
