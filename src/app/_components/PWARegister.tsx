"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    // Only run in the browser
    if (typeof window === "undefined") return;

    // Service workers are not supported everywhere
    if (!("serviceWorker" in navigator)) return;

    // Only register in production (not during `npm run dev`)
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // You can log this if you want to debug:
        // console.log("Service worker registered:", registration);
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  }, []);

  // This component doesn't render anything visible
  return null;
}
