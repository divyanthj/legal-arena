export default function IndependenceDayPromoBanner() {
  return (
    <aside
      aria-label="India Independence Day offer"
      className="relative overflow-hidden border-b border-white/10 bg-[#080808]"
    >
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[#ff9933] via-white to-[#138808]"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-12 top-1/2 h-20 w-40 -translate-y-1/2 rounded-full bg-[#ff9933]/10 blur-3xl" />
        <div className="absolute -right-12 top-1/2 h-20 w-40 -translate-y-1/2 rounded-full bg-[#138808]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-7xl items-center justify-center gap-3 px-5 py-2.5 text-center text-xs sm:text-sm md:px-8">
        <span
          className="hidden h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/20 shadow-[0_0_18px_rgba(255,255,255,0.08)] sm:grid"
          aria-hidden="true"
        >
          <span className="bg-[#ff9933]" />
          <span className="relative bg-white">
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#000080]" />
          </span>
          <span className="bg-[#138808]" />
        </span>
        <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 leading-5 text-white/74">
          <strong className="font-semibold text-white">
            Happy Independence Day, India!
          </strong>
          <span>Celebrate with</span>
          <strong className="font-semibold text-white">25% off</strong>
          <span>using code</span>
          <code className="rounded-md border border-white/16 bg-white/[0.07] px-2 py-0.5 font-mono text-xs font-bold tracking-[0.14em] text-white shadow-sm">
            INDIA
          </code>
          <span className="text-white/48">· Ends Aug 17, 23:59 UTC</span>
        </p>
      </div>
    </aside>
  );
}
