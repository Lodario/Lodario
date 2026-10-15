export function AppLoadingScreen() {
  return (
    <div
      role="status"
      aria-label="Loading Lodario"
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-black"
    >
      {/* Keep the supplied GIF animated rather than optimizing it as a still image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/lodario-loading.gif"
        alt=""
        width={180}
        height={195}
        fetchPriority="high"
        className="h-auto w-[180px] max-w-[50vw]"
      />
    </div>
  );
}
