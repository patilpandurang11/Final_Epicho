"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  FileText,
  Flag,
  Gem,
  KeyRound,
  LayoutDashboard,
  Server,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users & Staff", icon: Users },
  { href: "/admin/verifications", label: "Verifications", icon: BadgeCheck },
  { href: "/admin/moderation", label: "Moderation", icon: Flag },
  { href: "/admin/rankings", label: "Rankings Audit", icon: Trophy },
  { href: "/admin/hidden-gems", label: "Hidden Gems", icon: Gem },
  { href: "/admin/finance", label: "Finance & Plans", icon: Wallet },
  { href: "/admin/technical", label: "Technical & AI", icon: Server },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/roles", label: "Roles & RBAC", icon: KeyRound },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileText },
];

export function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-[#475569]">
        Verifying administrative clearance...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-red-100 text-red-700 flex items-center justify-center">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold">Administrative Access Required</h1>
        <p className="text-sm text-[#475569] dark:text-[#A7B8AE]">
          Sign in with an authorized EpiCho staff account (MFA supported) to access governance consoles.
        </p>
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-bold"
        >
          Go to Admin Login
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3 space-y-2">
          <div className="p-4 rounded-2xl bg-[#14281D] text-white space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <Activity className="w-3.5 h-3.5" />
              EpiCho Governance
            </div>
            <p className="font-bold text-sm truncate">{user.full_name}</p>
            <p className="text-[11px] text-emerald-200/80 truncate">{user.roles.join(", ")}</p>
          </div>
          <nav aria-label="Admin Navigation" className="rounded-2xl border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#13211A] p-2 space-y-1">
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors",
                    active
                      ? "bg-[#059669] text-white"
                      : "text-[#475569] dark:text-[#A7B8AE] hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24]"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="lg:col-span-9 space-y-6">
          <div className="border-b border-[#E7DFD3] dark:border-[#253D31] pb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] dark:text-white">{title}</h1>
            {subtitle && <p className="text-sm text-[#475569] dark:text-[#A7B8AE] mt-1">{subtitle}</p>}
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
