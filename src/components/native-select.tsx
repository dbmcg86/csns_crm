"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  placeholder?: string;
};

// Native <select> styled to match the rest of the form. Using the native
// element so iOS / Android open their built-in pickers — far more reliable on
// mobile than any JS-driven custom dropdown.
export const NativeSelect = React.forwardRef<HTMLSelectElement, Props>(
  function NativeSelect(
    { className, placeholder, children, ...rest },
    ref,
  ) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "h-11 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-base outline-none transition-colors",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[&:invalid]:text-muted-foreground",
            className,
          )}
          {...rest}
        >
          {placeholder !== undefined && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>
    );
  },
);
