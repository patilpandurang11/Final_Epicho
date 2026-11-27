import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth, type AuthUser } from "@/lib/auth";

const user: AuthUser = {
  user_id: "user-1",
  email: "member@example.com",
  full_name: "Test Member",
  account_tier: "registered",
  roles: ["registered"],
  is_verified: true,
  mfa_enabled: false,
};

function AuthProbe() {
  const { user: currentUser, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span>{isLoading ? "Loading" : currentUser?.email ?? "Signed out"}</span>
      <button onClick={() => login("access-token", "refresh-token", user)}>Log in</button>
      <button onClick={() => void logout()}>Log out</button>
    </div>
  );
}

describe("AuthProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("restores the authenticated user from the current-user endpoint", async () => {
    window.sessionStorage.setItem("epicho_access_token", "access-token");
    window.sessionStorage.setItem("epicho_refresh_token", "refresh-token");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(user), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText("member@example.com")).toBeInTheDocument();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toContain("/auth/me");
    expect(new Headers(request?.headers).get("Authorization")).toBe(
      "Bearer access-token",
    );
  });

  it("stores tokens on login and clears them after server logout", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(window.sessionStorage.getItem("epicho_access_token")).toBe("access-token");
    expect(window.sessionStorage.getItem("epicho_refresh_token")).toBe("refresh-token");
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(screen.getByText("Signed out")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh_token: "refresh-token" }),
      }),
    );
    expect(window.sessionStorage.getItem("epicho_access_token")).toBeNull();
    expect(window.sessionStorage.getItem("epicho_refresh_token")).toBeNull();
  });
});
