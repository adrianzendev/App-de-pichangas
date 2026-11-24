export function trackEvent(name: string, params?: Record<string, unknown>) {
  try {
    if (typeof (window as any).fbq === 'function') {
      (window as any).fbq('track', name, params);
    }
  } catch {}
}
