import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import RecipeDetailPage from "./page";

const { mockPush, mockUseAuth } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "tomato-soup" }),
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));

const user = { user_id: "member-1" };
const recipe = {
  recipe_id: "recipe-1",
  slug: "tomato-soup",
  title: "Tomato Soup",
  description: "A warm soup.",
  cuisine_type: "Indian",
  diet_type: "veg",
  prep_time_mins: 5,
  cook_time_mins: 15,
  servings: 2,
  ingredients: [{ ingredient_name: "Tomato", quantity: 2, unit: "cups" }],
  steps: [{ step_number: 1, instruction: "Cook tomatoes." }],
};

describe("recipe detail interactions and API states", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user });
    vi.mocked(apiRequest).mockImplementation((path, options) => {
      if (path === "/recipes/tomato-soup") return Promise.resolve(recipe) as never;
      if (path === "/recipes/recipe-1/versions" || path === "/recipes/recipe-1/comments") return Promise.resolve([]) as never;
      if (path === "/recipes/recipe-1/reviews") {
        return Promise.resolve([{
          review_id: "review-1",
          author_name: "Reviewer",
          rating: 5,
          comment: "Lovely.",
          helpful_count: 0,
          unhelpful_count: 0,
        }]) as never;
      }
      if (path === "/posts/collections") {
        return Promise.resolve([{ collection_id: "collection-1", name: "Favorites" }]) as never;
      }
      if (path === "/posts/collections/collection-1/items" && options?.method === "POST") {
        return Promise.resolve({ item_id: "collection-item-1", already_saved: false }) as never;
      }
      if (path === "/posts/collections/collection-1/items") return Promise.resolve([]) as never;
      if (path === "/recipes/recipe-1/adjust-servings?servings=4") {
        return Promise.resolve({
          adjusted_servings: 4,
          ingredients: [{ ingredient_name: "Tomato", quantity: 4, unit: "cups" }],
        }) as never;
      }
      if (path.includes("/feedback?helpful=true")) {
        return Promise.resolve({ helpful_count: 1, unhelpful_count: 0 }) as never;
      }
      if (path === "/posts/collections/collection-1/items/collection-item-1") {
        return Promise.resolve({ message: "removed" }) as never;
      }
      if (path.includes("/report?reason=")) return Promise.resolve({ message: "reported" }) as never;
      return Promise.resolve({ message: "ok" }) as never;
    });
  });

  it("adjusts servings, votes on reviews, reports reviews, and manages collection items", async () => {
    render(<RecipeDetailPage />);
    expect(await screen.findByRole("heading", { name: "Tomato Soup" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "4" }));
    expect(await screen.findByText(/Estimated quantities for 4 servings/)).toBeInTheDocument();
    expect(screen.getByText("4 cups")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Helpful (0)" }));
    expect(await screen.findByRole("button", { name: "Helpful (1)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Report review" }));
    fireEvent.change(screen.getByLabelText("Reason for reporting review"), {
      target: { value: "This review is abusive." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByText("Review report submitted for moderation.")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining("report?reason=This%20review%20is%20abusive."),
      { method: "POST" },
    );

    fireEvent.change(screen.getByLabelText("Select collection"), {
      target: { value: "collection-1" },
    });
    const addButton = await screen.findByRole("button", { name: "Add to collection" });
    fireEvent.click(addButton);
    expect(await screen.findByText("Recipe added to the collection.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove from collection" }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      "/posts/collections/collection-1/items/collection-item-1",
      { method: "DELETE" },
    ));
  });

  it("reports recipe loading failures", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Recipe unavailable"));
    render(<RecipeDetailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Recipe unavailable");
  });
});
