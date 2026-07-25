import React from 'react';

/**
 * Shown at the root when no project was requested.
 *
 * Replaces the ComingSoonLanding from origin/main. That version depended on ~90
 * lines of bespoke CSS (landing-shell, landing-aurora, landing-grid); this one
 * uses the Tailwind setup the rest of this viewer already builds with.
 */
const LandingPage: React.FC = () => (
  <section
    data-testid="landing-page"
    className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-950 px-6 py-10"
  >
    <div
      aria-hidden="true"
      className="absolute -top-1/3 left-1/2 h-[70vh] w-[70vh] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl"
    />
    <div
      aria-hidden="true"
      className="absolute -bottom-1/3 right-0 h-[50vh] w-[50vh] rounded-full bg-indigo-500/10 blur-3xl"
    />

    <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] px-8 py-10 backdrop-blur-xl sm:px-12">
      <p className="text-[11px] uppercase tracking-[0.34em] text-white/50">
        AURA Horizon
      </p>
      <h1 className="mt-4 text-5xl font-semibold uppercase leading-none tracking-[0.18em] text-white sm:text-7xl">
        Horizon
      </h1>
      <p className="mt-6 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-cyan-100/80">
        Viewer
      </p>
      <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
        Interactive digital twins, published straight from Unreal Engine.
      </p>
      <p className="mt-4 max-w-xl text-sm leading-6 text-white/45">
        Open a project using the link you were sent. If your link is not working,
        check with whoever shared it &mdash; published projects can be updated or
        removed.
      </p>
    </div>
  </section>
);

export default LandingPage;
