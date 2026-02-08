import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        [
          "flex h-10 w-full rounded-md border border-border/15 bg-card/40 px-3 py-2 text-sm",
          "text-foreground placeholder:text-muted-foreground",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "disabled:cursor-not-allowed disabled:opacity-50"
        ].join(" "),
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";
