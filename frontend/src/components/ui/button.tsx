import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[#EA580C] text-white hover:bg-[#C2410C] shadow-sm",
        primary: "bg-[#9A3412] text-white hover:bg-[#7C2D12] shadow-sm",
        emerald: "bg-[#059669] text-white hover:bg-[#047857] shadow-sm",
        outline:
          "border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#13211A] text-[#0F172A] dark:text-[#F4F1EA] hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24]",
        ghost: "hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] text-[#0F172A] dark:text-[#F4F1EA]",
        destructive: "bg-[#DC2626] text-white hover:bg-[#B91C1C]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
);
Button.displayName = "Button";
