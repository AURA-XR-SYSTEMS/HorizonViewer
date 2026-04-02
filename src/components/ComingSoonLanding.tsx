const LANDING_COPY = {
  eyebrow: 'AURA Horizon Viewer',
  title: 'AURA',
  status: 'Coming soon',
  message: 'A lightweight preview portal for exported AURA experiences is on the way.',
  note: 'Future Unreal Engine exporter instructions and documentation will live here.',
} as const

export default function ComingSoonLanding() {
  return (
    <section
      data-testid="coming-soon-page"
      className="landing-shell relative flex h-full w-full items-center justify-center overflow-hidden px-6 py-10 text-white"
    >
      <div className="landing-aurora landing-aurora-primary" aria-hidden="true" />
      <div className="landing-aurora landing-aurora-secondary" aria-hidden="true" />
      <div className="landing-grid" aria-hidden="true" />

      <div className="landing-card relative z-10 w-full max-w-2xl rounded-[32px] border border-white/16 px-6 py-8 text-left shadow-2xl sm:px-10 sm:py-10">
        <p className="landing-eyebrow text-[11px] tracking-[0.34em] text-white/52 uppercase">
          {LANDING_COPY.eyebrow}
        </p>
        <h1 className="landing-title mt-4 text-5xl leading-none font-semibold tracking-[0.18em] text-white uppercase sm:text-7xl">
          {LANDING_COPY.title}
        </h1>
        <p className="mt-6 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-[11px] tracking-[0.28em] text-cyan-100/80 uppercase">
          {LANDING_COPY.status}
        </p>
        <p className="mt-6 max-w-xl text-base leading-7 text-white/78 sm:text-lg">
          {LANDING_COPY.message}
        </p>
        <p className="mt-4 max-w-lg text-sm leading-6 text-white/56 sm:text-base">
          {LANDING_COPY.note}
        </p>
      </div>
    </section>
  )
}
