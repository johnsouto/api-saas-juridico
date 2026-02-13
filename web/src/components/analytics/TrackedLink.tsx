"use client";

import Link, { type LinkProps } from "next/link";
import { forwardRef, type AnchorHTMLAttributes, type MouseEventHandler } from "react";

import type { DataLayerEventPayload } from "@/lib/gtm";
import { trackEvent } from "@/lib/gtm";

type TrackedLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    eventName?: string;
    eventPayload?: DataLayerEventPayload;
  };

export const TrackedLink = forwardRef<HTMLAnchorElement, TrackedLinkProps>(function TrackedLink(
  { eventName = "ej_link_click", eventPayload, onClick, ...props },
  ref
) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    trackEvent(eventName, eventPayload);
    onClick?.(event);
  };

  return <Link ref={ref} {...props} onClick={handleClick} />;
});
