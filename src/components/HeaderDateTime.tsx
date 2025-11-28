"use client";

import { useEffect, useState } from "react";

type HeaderDateTimeProps = {
  timezoneLabel?: string; // e.g. "ET" (optional)
};

function getParts(d: Date) {
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" }); // Fri
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }); // Nov 28, 2025
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }); // 3:42 PM
  return { weekday, date, time };
}

export default function HeaderDateTime({
  timezoneLabel,
}: HeaderDateTimeProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update(); // set immediately
    const id = setInterval(update, 30_000); // update every 30 seconds
    return () => clearInterval(id);
  }, []);

  if (!now) return null; // avoid hydration mismatch

  const { weekday, date, time } = getParts(now);

  return (
    <div className="text-right text-[11px] leading-tight text-slate-300 sm:text-xs">
      <div className="font-medium text-slate-50">
        {weekday} • {time}
        {timezoneLabel ? ` ${timezoneLabel}` : ""}
      </div>
      <div className="opacity-80">{date}</div>
    </div>
  );
}
