import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import PublicProfilePage from "./page";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ username: "cook" }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

describe("public profile visibility", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null });
  });

  it("shows a private-profile notice without private posts or recipes", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      user_id: "private-user",
      username: "cook",
      full_name: "Private Cook",
      is_private: true,
      can_view_content: false,
      bio: "Visible bio",
      posts: [],
      recipes: [],
      followers_count: 3,
      following_count: 1,
    } as never);

    render(<PublicProfilePage />);
    expect(await screen.findByText(/This profile is private/)).toBeInTheDocument();
    expect(screen.queryByText("Secret recipe")).not.toBeInTheDocument();
    expect(screen.queryByText("Secret post")).not.toBeInTheDocument();
  });

  it("renders public recipes and profile details when content is visible", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      user_id: "public-user",
      username: "cook",
      full_name: "Public Cook",
      is_private: false,
      can_view_content: true,
      bio: "A public profile",
      posts: [{ post_id: "post-1", dish_name: "Public post", caption: "Fresh food" }],
      recipes: [{
        recipe_id: "recipe-1",
        slug: "public-soup",
        image_url: "",
        title: "Public Soup",
        cuisine_type: "Indian",
        cook_time_mins: 20,
      }],
      followers_count: 3,
      following_count: 1,
    } as never);

    render(<PublicProfilePage />);
    expect(await screen.findByText("Public Soup")).toBeInTheDocument();
    expect(screen.getByText("Public post")).toBeInTheDocument();
  });
});
