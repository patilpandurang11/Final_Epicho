import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import FollowersPage from "./page";
import FollowingPage from "../following/page";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ username: "cook" }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

describe("follower and following pages", () => {
  it("loads follower profiles and displays an empty following state", async () => {
    vi.mocked(apiRequest).mockImplementation((path) => {
      if (path === "/posts/profile/cook") return Promise.resolve({ user_id: "user-1" }) as never;
      if (path === "/posts/followers/user-1?limit=20&offset=0") {
        return Promise.resolve([{ user_id: "follower-1", full_name: "Follower One", username: "one" }]) as never;
      }
      if (path === "/posts/following/user-1?limit=20&offset=0") return Promise.resolve([]) as never;
      return Promise.resolve([]) as never;
    });

    const followers = render(<FollowersPage />);
    expect(await screen.findByText("Follower One")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Follower One/ })).toHaveAttribute(
      "href",
      "/profile/one",
    );
    followers.unmount();

    render(<FollowingPage />);
    expect(await screen.findByText("Not following any accounts yet.")).toBeInTheDocument();
  });

  it("shows API failures accessibly", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("Private profile"));
    render(<FollowersPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Private profile");
  });

  it("requests subsequent pages and enables returning to the prior page", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => ({
      user_id: `follower-${index}`,
      full_name: `Follower ${index}`,
      username: `follower${index}`,
    }));
    vi.mocked(apiRequest).mockImplementation((path) => {
      if (path === "/posts/profile/cook") return Promise.resolve({ user_id: "user-1" }) as never;
      if (path === "/posts/followers/user-1?limit=20&offset=0") {
        return Promise.resolve(firstPage) as never;
      }
      if (path === "/posts/followers/user-1?limit=20&offset=20") {
        return Promise.resolve([{ user_id: "follower-next", full_name: "Next Follower", username: "next" }]) as never;
      }
      return Promise.resolve([]) as never;
    });

    render(<FollowersPage />);
    expect(await screen.findByText("Follower 0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Next Follower")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/posts/followers/user-1?limit=20&offset=20");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Follower 0")).toBeInTheDocument();
  });
});
