import { ANALYTICS } from "./config";

export function track(eventName, params = {}) {
  try {
    // Google Analytics 4 (gtag)
    if (typeof window !== "undefined" && ANALYTICS.gaId && window.gtag) {
      window.gtag("event", eventName, params);
    }
  } catch {
    // ignore
  }

  // Always log in dev so you can confirm events
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log(`[track] ${eventName}`, params);
  }
}
