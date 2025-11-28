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
            and{" "}
            <span className="font-semibold">
              automatic driver time tracking
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
                  Inspections + live time clock
                </p>
                <p className="text-sm text-slate-300">
                  Select your name and vehicle, complete the required checklist,
                  and start / stop your workday clock automatically with
                  pre-trip and post-trip submissions.
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
                  Inspections, fleet, and timecards
                </p>
                <p className="text-sm text-slate-300">
                  Manage drivers and vehicles, review up to 90 days of
                  inspections, and view export-ready weekly timecards for each
                  driver (Mon–Fri).
                </p>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-200 group-hover:text-emerald-200">
                Go to Admin Portal →
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* Clean “How the portal works” section */}
      <section className="card space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
          How the portal works
        </h2>

        <p className="text-sm text-slate-200/90">
          Drivers complete daily 7D inspections and their hours are tracked
          automatically. Admins get clean records and weekly timecards without
          extra data entry.
        </p>

        {/* Two-column summary: Drivers vs Admins */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Drivers */}
          <div className="rounded-2xl bg-slate-950/60 p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-300">
              For drivers
            </p>
            <ul className="space-y-1.5 text-sm text-slate-200">
              <li>• Sign in with your name and assigned vehicle.</li>
              <li>• Submit a <span className="font-semibold">pre-trip</span> to start the clock.</li>
              <li>• Submit a <span className="font-semibold">post-trip</span> to stop the clock.</li>
              <li>• See today&apos;s hours and weekly total on the Driver Portal.</li>
              <li>• Use the Time Log to review hours for each weekday (Mon–Fri).</li>
            </ul>
          </div>

          {/* Admins */}
          <div className="rounded-2xl bg-slate-950/60 p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-300">
              For admins
            </p>
            <ul className="space-y-1.5 text-sm text-slate-200">
              <li>• View and search 7D inspection history (last 90 days).</li>
              <li>• See live weekly hours for each driver in the Timecards tab.</li>
              <li>• Open a weekly timecard (Mon–Fri) per driver with one click.</li>
              <li>• Print or save timecards as PDF with Transafe branding.</li>
            </ul>
          </div>
        </div>

        {/* Optional deeper details, but hidden by default */}
        <details className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
          <summary className="cursor-pointer text-sm font-semibold text-emerald-300">
            Time clock details
          </summary>
          <div className="mt-3 space-y-2 text-[13px] text-slate-300">
            <p>
              • The clock starts when a driver submits a <strong>pre-trip inspection</strong> and
              stops when they submit a <strong>post-trip inspection</strong>.
            </p>
            <p>
              • The clock keeps running in the background even if the driver logs out
              or closes the browser. It only stops when a post-trip is submitted.
            </p>
            <p>
              • Multiple shifts in the same day are supported. A second pre-trip on the
              same date resumes the clock and adds to that day&apos;s total.
            </p>
            <p>
              • <strong>Today&apos;s clock</strong> resets at <strong>9:00 PM EST</strong> daily,
                and the <strong>Weekly total</strong> resets at <strong>9:00 PM EST each Friday</strong>.
                All underlying entries remain available in the Time Log and Admin Timecards.
            </p>
          </div>
        </details>
      </section>
    </div>
  );
}
