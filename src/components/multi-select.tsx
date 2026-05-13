"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
};

export function MultiSelect({ options, value, onChange, id }: Props) {
  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  return (
    <div id={id} className="flex flex-wrap gap-2" role="group">
      {options.map((opt) => {
        const checked = value.includes(opt);
        const inputId = `tag-${opt.replace(/\W+/g, "-").toLowerCase()}`;
        return (
          <label
            key={opt}
            htmlFor={inputId}
            className={cn(
              "group inline-flex select-none items-center gap-1.5 rounded-full border border-input bg-background px-3.5 py-2 text-sm text-foreground cursor-pointer min-h-11 transition-colors",
              "hover:bg-muted active:bg-muted",
              "has-[input:checked]:border-primary has-[input:checked]:bg-primary has-[input:checked]:text-primary-foreground has-[input:checked]:shadow-sm",
              "has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50 has-[input:focus-visible]:border-ring",
            )}
          >
            <input
              id={inputId}
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={() => toggle(opt)}
            />
            <Check className="h-3.5 w-3.5 hidden group-has-[input:checked]:inline-block" />
            <span>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}
