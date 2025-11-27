import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Hero / welcome card */}
      <section className="card">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Transafe 7D Inspections
          </p>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">
            Welcome to the Transafe Inspection Portal
          </h1>
          <p className="text-sm leading-relaxed text-slate-200/90">
            A mobile-first tool for{" "}
            <span className="font-semibold">
              daily pre-trip and post-trip 7D inspections
            </span>{" "}
            for Transafe Transportation drivers and administrators.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {/* Driver Portal card */}
          <Link href="/driver" className="group">
            <div className="flex h-full flex-col justify-between rounded-2xl bg-slate-950/60 p-4 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-slate-900/80 hover:shadow-xl hover:ring-emerald-500/60">
              <div className="space-y-2">
                <p className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Driver Portal
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  For daily pre-trip &amp; post-trip checks
                </p>
                <p className="text-sm text-slate-300">
                  Start your shift by selecting your name and vehicle, complete
                  the state-required inspection checklist, and sign with your
                  typed name.
                </p>
              </div>
              <p className="mt-3 text-xs font-semibold text-emerald-300 group-hover:text-emerald-200">
                Go to Driver Portal →
              </p>
            </div>
          </Link>

          {/* Admin Portal card */}
          <Link href="/admin" className="group">
            <div className="flex h-full flex-col justify-between rounded-2xl bg-slate-950/60 p-4 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-slate-900/80 hover:shadow-xl hover:ring-emerald-500/60">
              <div className="space-y-2">
                <p className="inline-flex items-center rounded-full bg-slate-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                  Admin Portal
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  Manage drivers, vehicles &amp; inspections
                </p>
                <p className="text-sm text-slate-300">
                  Register fleet vehicles and drivers, review inspection history
                  for up to 90 days, export records, and support 7D audit
                  requirements.
                </p>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-200 group-hover:text-emerald-200">
                Go to Admin Portal →
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* Key features / roadmap */}
      <section className="card space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
          How the portal works
        </h2>
        <div className="grid gap-3 text-sm text-slate-200/90 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-emerald-300">
              1. Drivers
            </p>
            <p className="mt-1 text-sm">
              Drivers select their name &amp; vehicle, complete all checklist
              items (Pass / Fail / N/A), enter odometer, and certify with their
              name.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-emerald-300">
              2. Automatic records
            </p>
            <p className="mt-1 text-sm">
              Submissions are stored with full details for 90 days, available to
              both drivers and admins for audits and downloads.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950/60 p-3">
            <p className="text-xs font-semibold text-emerald-300">
              3. Future phases
            </p>
            <p className="mt-1 text-sm">
              Time-clock integration, student attendance, and a SaaS version for
              other transportation providers are planned next.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
