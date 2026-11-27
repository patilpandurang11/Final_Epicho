import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiRequest authentication lifecycle", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes once after 401 and retries with the new access token", async () => {
    window.sessionStorage.setItem("epicho_access_token", "old-access");
    window.sessionStorage.setItem("epicho_refresh_token", "old-refresh");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ detail: "Expired" }, 401))
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "new-access", refresh_token: "new-refresh" }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/protected")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/refresh");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      refresh_token: "old-refresh",
    });
    expect(
      new Headers(fetchMock.mock.calls[2][1]?.headers).get("Authorization"),
    ).toBe("Bearer new-access");
    expect(window.sessionStorage.getItem("epicho_refresh_token")).toBe("new-refresh");
  });

  it("clears credentials when refresh is rejected", async () => {
    window.sessionStorage.setItem("epicho_access_token", "expired-access");
    window.sessionStorage.setItem("epicho_refresh_token", "expired-refresh");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ detail: "Expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ detail: "Invalid refresh" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/protected")).rejects.toMatchObject({
      status: 401,
    });
    expect(window.sessionStorage.getItem("epicho_access_token")).toBeNull();
    expect(window.sessionStorage.getItem("epicho_refresh_token")).toBeNull();
  });

  it("preserves credentials when the service is unreachable", async () => {
    window.sessionStorage.setItem("epicho_access_token", "access");
    window.sessionStorage.setItem("epicho_refresh_token", "refresh");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")));

    await expect(apiRequest("/protected")).rejects.toMatchObject({ status: 0 });
    expect(window.sessionStorage.getItem("epicho_access_token")).toBe("access");
    expect(window.sessionStorage.getItem("epicho_refresh_token")).toBe("refresh");
  });
});
