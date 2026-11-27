import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AuthProvider } from "@/lib/auth";

const navigation = vi.hoisted(() => ({
  pathname: "/profile/public-chef",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    navigation.replace.mockClear();
    window.sessionStorage.clear();
  });

  it("keeps public profiles accessible to guests", () => {
    navigation.pathname = "/profile/public-chef";
    window.history.replaceState({}, "", "/profile/public-chef");
    render(
      <AuthProvider>
        <AuthGuard>
          <div>Public profile</div>
        </AuthGuard>
      </AuthProvider>,
    );

    expect(screen.getByText("Public profile")).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("redirects guests from private routes to login", async () => {
    navigation.pathname = "/meal-planner";
    window.history.replaceState({}, "", "/meal-planner");
    render(
      <AuthProvider>
        <AuthGuard>
          <div>Private planner</div>
        </AuthGuard>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        "/login?next=%2Fmeal-planner",
      );
    });
    expect(screen.queryByText("Private planner")).not.toBeInTheDocument();
  });
});
