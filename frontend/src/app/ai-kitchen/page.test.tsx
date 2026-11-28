import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api";
import AIKitchenPage from "./page";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: null }) }));

const generatedRecipe = {
  title: "Tomato Lunch Bowl",
  description: "A quick tomato recipe.",
  cuisine_type: "Indian",
  category: "Lunch",
  diet_type: "veg",
  prep_time_mins: 10,
  cook_time_mins: 15,
  servings: 2,
  difficulty_level: "easy",
  equipment_required: ["Pan"],
  ingredients: [{ name: "Tomato", quantity: 1, unit: "cup" }],
  steps: [{ step_number: 1, instruction: "Cook the tomato." }],
  nutrition: { calories: 100, protein_g: 3, carbs_g: 12, fat_g: 4, fiber_g: 2 },
};

describe("AI Kitchen page", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockImplementation((path) => {
      if (path === "/ai-kitchen/quota") {
        return Promise.resolve({
          tier: "guest",
          daily_limit: 3,
          remaining: 3,
          is_unlimited: false,
        }) as never;
      }
      return Promise.resolve(generatedRecipe) as never;
    });
  });

  it("sends selected dish type and excluded ingredients to the real API client", async () => {
    render(<AIKitchenPage />);
    fireEvent.change(screen.getByPlaceholderText("Separate ingredients with commas"), {
      target: { value: "Paneer" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "Lunch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate Recipe with AI Kitchen" }));

    await screen.findByRole("heading", { name: "Tomato Lunch Bowl" });
    const request = vi.mocked(apiRequest).mock.calls.find(
      ([path]) => path === "/ai-kitchen/generate",
    );
    expect(request).toBeDefined();
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      excluded_ingredients: ["Paneer"],
      dish_type: "Lunch",
    });
  });

  it("shows a clear failure and restores the generate button", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.mocked(apiRequest).mockImplementation((path) => {
      if (path === "/ai-kitchen/quota") return Promise.resolve({}) as never;
      return Promise.reject(new Error("Provider unavailable")) as never;
    });
    render(<AIKitchenPage />);
    fireEvent.click(screen.getByRole("button", { name: "Generate Recipe with AI Kitchen" }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith("Provider unavailable"));
    expect(screen.getByRole("button", { name: "Generate Recipe with AI Kitchen" })).toBeEnabled();
  });
});
