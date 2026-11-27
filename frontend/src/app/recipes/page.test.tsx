import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import RecipesCatalogPage from "./page";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));

describe("recipe discovery", () => {
  it("loads recipes and submits search filters through the API client", async () => {
    vi.mocked(apiRequest).mockResolvedValue([{
      recipe_id: "recipe-1",
      slug: "tomato-soup",
      title: "Tomato Soup",
      cuisine_type: "Indian",
      servings: 2,
      cook_time_mins: 20,
      prep_time_mins: 5,
    }] as never);
    render(<RecipesCatalogPage />);

    expect(await screen.findByText("Tomato Soup")).toBeInTheDocument();
    const search = screen.getByPlaceholderText("Search recipes, ingredients, dish names...");
    fireEvent.change(search, { target: { value: "tomato" } });
    fireEvent.submit(search.closest("form")!);

    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith(
      expect.stringContaining("search=tomato"),
    ));
  });

  it("shows empty and failed API states", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce([] as never);
    const view = render(<RecipesCatalogPage />);
    expect(await screen.findByText("No recipes match your criteria")).toBeInTheDocument();
    view.unmount();

    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Recipe service unavailable"));
    render(<RecipesCatalogPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Recipe service unavailable");
  });

  it("shows a loading state while the API request is pending", async () => {
    let resolveRecipes!: (value: never) => void;
    vi.mocked(apiRequest).mockReturnValue(new Promise((resolve) => {
      resolveRecipes = resolve;
    }) as never);
    render(<RecipesCatalogPage />);
    expect(screen.getByText("Loading delicious recipes...")).toBeInTheDocument();
    resolveRecipes([] as never);
    expect(await screen.findByText("No recipes match your criteria")).toBeInTheDocument();
  });
});
