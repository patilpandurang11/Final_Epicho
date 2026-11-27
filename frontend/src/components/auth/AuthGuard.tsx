"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const PRIVATE_PATHS = [
  "/profile",
  "/settings",
  "/notifications",
  "/saved-recipes",
  "/meal-planner",
  "/grocery",
  "/create-recipe",
  "/upload-post",
  "/upload-reel",
  "/creator/dashboard",
  "/business/dashboard",
  "/nutritionist/dashboard",
  "/critic/dashboard",
];

function isPrivatePath(pathname: string): boolean {
  if (pathname.startsWith("/profile/")) return false;
  return (
    PRIVATE_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ||
    (pathname.startsWith("/admin/") && pathname !== "/admin/login")
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const privateRoute = isPrivatePath(pathname);

  useEffect(() => {
    if (!privateRoute || isLoading || user) return;
    const currentPath =
      typeof window === "undefined"
        ? pathname
        : `${window.location.pathname}${window.location.search}`;
    const loginPath = pathname.startsWith("/admin/")
      ? "/admin/login"
      : "/login";
    router.replace(`${loginPath}?next=${encodeURIComponent(currentPath)}`);
  }, [isLoading, pathname, privateRoute, router, user]);

  if (!privateRoute) return children;
  if (isLoading || !user) {
    return (
      <div
        role="status"
        className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-[#475569]"
      >
        {isLoading ? "Restoring your EpiCho session..." : "Redirecting to sign in..."}
      </div>
    );
  }
  return children;
}
