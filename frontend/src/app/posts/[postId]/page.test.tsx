import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import PostDetailPage from "./page";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ postId: "post-1" }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

describe("post detail collection workflow", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { user_id: "member-1" } });
    vi.mocked(apiRequest).mockImplementation((path, options) => {
      if (path === "/posts/post-1") {
        return Promise.resolve({
          post_id: "post-1",
          author_id: "author-1",
          author_name: "Cook",
          caption: "A community meal",
          likes_count: 0,
          comments_count: 0,
          shares_count: 0,
          has_liked: false,
          has_saved: false,
          media: [],
        }) as never;
      }
      if (path === "/posts/post-1/comments") return Promise.resolve([]) as never;
      if (path === "/posts/collections") {
        return Promise.resolve([{ collection_id: "collection-1", name: "Favorites" }]) as never;
      }
      if (path === "/posts/collections/collection-1/items" && options?.method === "POST") {
        return Promise.resolve({ item_id: "item-1", already_saved: false }) as never;
      }
      if (path === "/posts/collections/collection-1/items") return Promise.resolve([]) as never;
      return Promise.resolve({ message: "removed" }) as never;
    });
  });

  it("adds and removes a post from the selected collection with feedback", async () => {
    render(<PostDetailPage />);
    expect(await screen.findByText("A community meal")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Select collection"), {
      target: { value: "collection-1" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Add to collection" }));
    expect(await screen.findByText("Post added to the collection.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove from collection" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/posts/collections/collection-1/items/item-1",
      { method: "DELETE" },
    ));
    expect(await screen.findByText("Post removed from the collection.")).toBeInTheDocument();
  });
});
