import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Hero / welcome card */}
      <section className="card space-y-4">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Transafe 7D Operations
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            Transafe Operations Portal
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            Manage your 7D student transportation operations in one place – drivers complete
            pre and post trip inspections, view routes, and log time, while admins manage routes,
            students, schools, vehicles, and inspections from a single portal.
          </p>

        </div>

        {/* Primary actions */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {/* Driver Portal card */}
          <Link href="/driver" className="group">
            <div className="flex h-full flex-col justify-between rounded-2xl bg-slate-950/70 p-4 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-slate-900/80 hover:shadow-xl hover:ring-emerald-500/60">
              <div className="space-y-2">
                <p className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Driver Portal
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  Start inspections, auto log time & view routes.
                </p>
                <ul className="mt-1 space-y-1 text-xs text-slate-300">
                  <li>• Select your name & vehicle</li>
                  <li>• Complete pre-trip / post-trip checklists</li>
                  <li>• Clock starts on pre-trip and stops on post-trip</li>
                </ul>
              </div>
              <p className="mt-3 text-xs font-semibold text-emerald-300 group-hover:text-emerald-200">
                Open Driver Portal →
              </p>
            </div>
          </Link>

          {/* Admin Portal card */}
          <Link href="/admin" className="group">
            <div className="flex h-full flex-col justify-between rounded-2xl bg-slate-950/70 p-4 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-slate-900/80 hover:shadow-xl hover:ring-emerald-500/60">
              <div className="space-y-2">
                <p className="inline-flex items-center rounded-full bg-slate-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                  Admin Portal
                </p>
                <p className="text-sm font-semibold text-slate-50">
                  Manage inspections, routes, fleet & timecards
                </p>
                <ul className="mt-1 space-y-1 text-xs text-slate-300">
                  <li>• Add / update drivers and vehicles</li>
                  <li>• View 90-day inspection history</li>
                  <li>• See weekly driver timecards & export data</li>
                </ul>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-200 group-hover:text-emerald-200">
                Open Admin Portal →
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* How it works – short and mobile-friendly */}
      <section className="card space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
          How the portal works
        </h2>

        <div className="grid gap-3 text-sm text-slate-200/90 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-950/70 p-3">
            <p className="text-xs font-semibold text-emerald-300">
              1. Driver clock-in
            </p>
            <p className="mt-1 text-xs sm:text-sm">
              Driver selects their name and vehicle, completes the{" "}
              <span className="font-semibold">pre-trip</span> checklist, and
              submits the form. This{" "}
              <span className="font-semibold">starts their daily clock.</span>
            </p>
          </div>

          <div className="rounded-2xl bg-slate-950/70 p-3">
            <p className="text-xs font-semibold text-emerald-300">
              2. Driver clock-out
            </p>
            <p className="mt-1 text-xs sm:text-sm">
              At the end of the shift, the driver completes the{" "}
              <span className="font-semibold">post-trip</span> checklist. This{" "}
              <span className="font-semibold">
                stops the clock and stores time entries
              </span>{" "}
              for the day and week.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-950/70 p-3">
            <p className="text-xs font-semibold text-emerald-300">
              3. Admin oversight
            </p>
            <p className="mt-1 text-xs sm:text-sm">
              Admins can search inspections,{" "}
              <span className="font-semibold">
                view weekly timecards for each driver
              </span>
              , and export records for audits and payroll.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
