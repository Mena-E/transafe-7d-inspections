import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import type { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

// In .env.local or hosting env, you can set:
// NEXT_PUBLIC_APP_ENV=development | staging | production
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? "development";

function EnvBanner() {
  const env = APP_ENV.toLowerCase();

  // Hide banner completely in production
  if (env === "production") {
    return null;
  }

  let label = "TEST / DEVELOPMENT ENVIRONMENT";
  let subLabel =
    "For training and testing only. Do not use for live 7D compliance.";
  let classes =
    "bg-amber-500 text-slate-950 border-b border-amber-700/60";

  if (env === "staging") {
    label = "STAGING ENVIRONMENT";
    subLabel = "Pre-production testing. Data may be reset.";
    classes =
      "bg-sky-500 text-slate-950 border-b border-sky-700/60";
  }

  return (
    <div className={classes}>
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-1 px-4 py-1.5 text-xs sm:flex-row sm:items-center">
        <span className="font-semibold tracking-[0.14em]">
          {label}
        </span>
        <span className="text-[11px] opacity-90">{subLabel}</span>
      </div>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Transafe 7D Inspections",
  description:
    "Daily pre-trip and post-trip 7D inspection app for Transafe Transportation drivers and admins.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-slate-950 text-slate-50 antialiased`}
      >
        {/* Only shows in dev/staging */}
        <EnvBanner />

        <div className="min-h-screen">
          {/* App header with logo */}
          <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                {/* LOGO: plain image, no extra container styling */}
                <Image
                  src="/logo.png" // make sure public/logo.png exists
                  alt="Transafe logo"
                  width={220}
                  height={60}
                  className="h-10 w-auto sm:h-12"
                  priority
                />
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-50">
                    Transafe Transportation
                  </p>
                  <p className="text-[11px] text-slate-400">
                    7D Daily Inspection Portal
                  </p>
                </div>
              </div>
              {/* Navigation removed: driver/admin buttons are now only on home page */}
            </div>
          </header>

          {/* Page content */}
          <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
