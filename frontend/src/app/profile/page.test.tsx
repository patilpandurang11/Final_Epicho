import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import ProfilePage from "./page";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

const user = {
  user_id: "member-1",
  email: "member@example.test",
  full_name: "Test Cook",
  username: "testcook",
  account_tier: "registered",
  tier: "registered",
  roles: ["community"],
  is_verified: false,
  profile: {
    bio: "Home cook",
    city: "Pune",
    is_private: false,
    cuisine_interests: [],
    dietary_restrictions: [],
    allergies: [],
    dislikes: [],
    social_links: {},
  },
};

describe("community profile editing and saved collections", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockImplementation((path, options) => {
      if (path === "/recipes/saved" || path === "/posts/saved" || path === "/posts/follow-requests") {
        return Promise.resolve([]) as never;
      }
      if (path === "/auth/me" && options?.method === "PUT") return Promise.resolve(user) as never;
      if (path === "/posts/collections" && options?.method === "POST") {
        return Promise.resolve({ collection_id: "collection-2", name: "Weeknight" }) as never;
      }
      if (path === "/posts/collections") {
        return Promise.resolve([{ collection_id: "collection-1", name: "Favorites", items_count: 1 }]) as never;
      }
      if (path === "/posts/collections/collection-1/items") {
        return Promise.resolve([{ item_id: "item-1", recipe_id: "recipe-1" }]) as never;
      }
      if (path === "/posts/collections/collection-1") {
        if (options?.method === "PATCH") return Promise.resolve({ collection_id: "collection-1", name: "Renamed" }) as never;
        if (options?.method === "DELETE") return Promise.resolve({ message: "deleted" }) as never;
      }
      return Promise.resolve({ message: "ok" }) as never;
    });
    mockUseAuth.mockReturnValue({ user, isLoading: false, refreshUser: vi.fn() });
  });

  it("saves editable profile fields including private visibility", async () => {
    render(<ProfilePage />);
    const privateToggle = await screen.findByLabelText(/Private profile/);
    fireEvent.click(privateToggle);
    fireEvent.change(screen.getByPlaceholderText("Indian, Italian, Mediterranean"), {
      target: { value: "Thai, Indian" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    await screen.findByText("Profile and dietary preferences saved.");
    const updateCall = vi.mocked(apiRequest).mock.calls.find(
      ([path, options]) => path === "/auth/me" && options?.method === "PUT",
    );
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({
      is_private: true,
      cuisine_interests: ["Thai", "Indian"],
    });
  });

  it("creates, renames, deletes collections and removes an assigned item", async () => {
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("Renamed");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ProfilePage />);

    await screen.findByText("Favorites");
    fireEvent.change(screen.getByRole("textbox", { name: "New collection name" }), {
      target: { value: "Weeknight" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await screen.findByText("Weeknight");
    expect(apiRequest).toHaveBeenCalledWith(
      "/posts/collections",
      expect.objectContaining({ method: "POST" }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/posts/collections/collection-2",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
      }),
    ));

    fireEvent.click(screen.getAllByRole("button", { name: "View saved items" })[1]);
    await screen.findByText("Recipe recipe-1");
    fireEvent.click(screen.getByRole("button", { name: "Remove item item-1" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/posts/collections/collection-1/items/item-1",
      { method: "DELETE" },
    ));

    fireEvent.click(screen.getByRole("button", { name: "Delete Favorites" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/posts/collections/collection-1",
      { method: "DELETE" },
    ));
    expect(prompt).toHaveBeenCalled();
    expect(confirm).toHaveBeenCalled();
  });
});
