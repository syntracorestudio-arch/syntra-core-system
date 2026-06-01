"use client";

import * as React from "react";

import { track, type EventProps } from "@/lib/analytics";

interface TrackedLinkProps extends React.ComponentPropsWithoutRef<"a"> {
  /** Datos del evento cta_click (ej. location, target) */
  trackProps?: EventProps;
}

/**
 * TrackedLink — anchor que registra un evento `cta_click` al hacer click.
 * Compatible con <Button asChild> (reenvía ref y props vía Slot).
 */
const TrackedLink = React.forwardRef<HTMLAnchorElement, TrackedLinkProps>(
  function TrackedLink({ trackProps, onClick, ...props }, ref) {
    return (
      <a
        ref={ref}
        onClick={(e) => {
          track("cta_click", trackProps);
          onClick?.(e);
        }}
        {...props}
      />
    );
  },
);

export { TrackedLink };
