import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-[#EA580C]/12 text-[#9A3412] dark:text-[#FDBA74]",
        emerald: "bg-[#059669]/12 text-[#047857] dark:text-[#6EE7B7]",
        amber: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
        destructive: "bg-red-500/15 text-red-700 dark:text-red-300",
        outline: "border border-[#E7DFD3] dark:border-[#253D31] text-[#475569] dark:text-[#A7B8AE]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
