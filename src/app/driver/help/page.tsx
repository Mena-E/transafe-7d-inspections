// src/app/driver/help/page.tsx
"use client";

import Link from "next/link";

export default function DriverHelpPage() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <section className="card space-y-2">
        <h1 className="text-lg font-semibold sm:text-xl">Driver Help</h1>
        <p className="text-sm text-slate-200/80">
          If you are having trouble with the Driver Portal, inspections, or
          time log, use the steps below or contact the office.
        </p>
      </section>

      <section className="card space-y-3 text-sm text-slate-200/90">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Common issues
          </h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px]">
            <li>Make sure you are connected to the internet.</li>
            <li>
              If your name does not appear, contact the office so an admin can
              add you as a driver.
            </li>
            <li>
              If your PIN is not working, ask the office to reset your PIN.
            </li>
            <li>
              If the vehicle list is empty, confirm that your assigned vehicle
              is active in the system.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Contact Transafe
          </h2>
          <p className="mt-1 text-[13px] text-slate-200">
            Call the office or send a text/email to report any issues with the
            app or your inspections.
          </p>
          <ul className="mt-1 space-y-1 text-[13px]">
            <li>Phone: (617) 991-9152</li>
            <li>Email: info@transafetransport.com</li>
          </ul>
        </div>
      </section>

      <section className="card">
        <Link
          href="/driver"
          className="btn-ghost w-full text-center text-xs sm:text-sm"
        >
          ← Back to Driver Portal
        </Link>
      </section>
    </div>
  );
}
