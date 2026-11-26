"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (val: string) => void;
}
const TabsContext = React.createContext<TabsContextValue>({ value: "", onValueChange: () => {} });

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [internal, setInternal] = React.useState(defaultValue || "");
  const val = controlledValue !== undefined ? controlledValue : internal;
  const setVal = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };
  return (
    <TabsContext.Provider value={{ value: val, onValueChange: setVal }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#F5F0E6] dark:bg-[#1A2D24] p-1",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  value,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const ctx = React.useContext(TabsContext);
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]",
        active
          ? "bg-white dark:bg-[#13211A] text-[#0F172A] dark:text-white shadow-sm"
          : "text-[#475569] dark:text-[#A7B8AE] hover:text-[#0F172A]",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return (
    <div role="tabpanel" className={cn("mt-4", className)}>
      {children}
    </div>
  );
}
