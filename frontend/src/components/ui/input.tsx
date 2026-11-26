import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#0D1511] px-3.5 py-2 text-sm text-[#0F172A] dark:text-[#F4F1EA] placeholder:text-[#64748B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[96px] w-full rounded-xl border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#0D1511] px-3.5 py-2.5 text-sm text-[#0F172A] dark:text-[#F4F1EA] placeholder:text-[#64748B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
