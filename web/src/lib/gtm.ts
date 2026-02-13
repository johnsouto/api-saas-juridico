import { readConsent } from "@/lib/consent";

type DataLayerPrimitive = string | number | boolean | null | undefined;
type DataLayerValue = DataLayerPrimitive | DataLayerPrimitive[];

export type DataLayerEventPayload = Record<string, DataLayerValue>;

const isTrackingEnabled = process.env.NODE_ENV === "production" && Boolean(process.env.NEXT_PUBLIC_GTM_ID);

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function pushToDataLayer(event: Record<string, unknown>) {
  if (!isTrackingEnabled || typeof window === "undefined") return;
  const consent = readConsent();
  if (!consent?.analytics) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

export function trackEvent(eventName: string, payload: DataLayerEventPayload = {}) {
  if (!isTrackingEnabled || typeof window === "undefined") return;

  pushToDataLayer({
    event: eventName,
    page_path: window.location.pathname,
    page_location: window.location.href,
    page_title: document.title,
    ...payload
  });
}
