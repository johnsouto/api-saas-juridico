import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        [
          "flex min-h-[80px] w-full rounded-md border border-border/15 bg-card/40 px-3 py-2 text-sm",
          "text-foreground placeholder:text-muted-foreground",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50"
        ].join(" "),
        className
      )}
      {...props}
    />
  );
});
