"use client";

import React, { useState, useEffect } from "react";
import { 
  CalendarDays, 
  Plus, 
  Trash2, 
  ChefHat, 
  ShoppingCart, 
  Sparkles, 
  CheckCircle,
  Clock
} from "lucide-react";
import { apiRequest } from "@/lib/api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"];

export default function MealPlannerPage() {
  const [mealPlan, setMealPlan] = useState<any>(null);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal for adding a meal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState("dinner");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [servings, setServings] = useState(2);

  const fetchPlanAndRecipes = async () => {
    try {
      const plan = await apiRequest("/meal-plans/current");
      setMealPlan(plan);
      const recs = await apiRequest("/recipes?limit=20");
      setRecipes(recs);
      if (recs.length > 0) setSelectedRecipeId(recs[0].recipe_id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanAndRecipes();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeId || !mealPlan) return;

    try {
      const startDate = new Date(mealPlan.start_date);
      startDate.setDate(startDate.getDate() + selectedDayOffset);
      const plannedDateStr = startDate.toISOString().split("T")[0];

      await apiRequest("/meal-plans/items", {
        method: "POST",
        body: JSON.stringify({
          recipe_id: selectedRecipeId,
          meal_date: plannedDateStr,
          meal_type: selectedSlot,
          servings: servings
        })
      });

      setModalOpen(false);
      fetchPlanAndRecipes();
    } catch (err: any) {
      alert(err.message || "Failed to schedule meal.");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await apiRequest(`/meal-plans/items/${itemId}`, { method: "DELETE" });
      fetchPlanAndRecipes();
    } catch (err: any) {
      alert(err.message || "Could not delete item.");
    }
  };

  const handleGenerateGroceryList = async () => {
    if (!mealPlan) return;
    try {
      await apiRequest(`/grocery/generate-from-plan/${mealPlan.plan_id}?subtract_pantry=true`, {
        method: "POST"
      });
      window.location.href = "/grocery";
    } catch (err: any) {
      alert(err.message || "Failed to generate grocery list.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#F2E6E2]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#9A3412]">
            Smart Scheduling
          </span>
          <h1 className="text-3xl font-black text-[#0F172A] tracking-tight">
            Personalized Weekly Meal Planner
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Organize breakfasts, lunches, and dinners. Automatically generate grocery lists with pantry deductions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#802B0F] transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Planned Meal
          </button>
          <button
            onClick={handleGenerateGroceryList}
            className="px-4 py-2.5 rounded-xl bg-[#059669] text-white font-bold text-xs hover:bg-emerald-800 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" /> Generate Grocery List
          </button>
        </div>
      </div>

      {/* Weekly Schedule Grid */}
      {loading ? (
        <div className="text-center py-20 text-stone-400 font-medium">Loading meal schedule...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {DAYS.map((dayName, dayIdx) => {
            // Find items for this relative day
            const dayItems = mealPlan?.items?.filter((it: any) => {
              const itemDate = new Date(it.meal_date);
              const planStart = new Date(mealPlan.start_date);
              const diffDays = Math.round((itemDate.getTime() - planStart.getTime()) / (1000 * 3600 * 24));
              return diffDays === dayIdx;
            }) || [];

            return (
              <div key={dayName} className="bg-white rounded-3xl p-4 border border-[#F2E6E2] shadow-sm flex flex-col justify-between min-h-[380px]">
                <div className="space-y-3">
                  <div className="border-b border-stone-100 pb-2">
                    <span className="font-extrabold text-xs text-[#9A3412] uppercase tracking-wider">
                      {dayName}
                    </span>
                    <span className="block text-xs font-semibold text-stone-400">Day {dayIdx + 1}</span>
                  </div>

                  {dayItems.length === 0 ? (
                    <div className="py-12 text-center text-stone-300 text-xs">
                      No meals planned
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayItems.map((item: any) => (
                        <div
                          key={item.item_id}
                          className="p-2.5 rounded-xl bg-[#FFFBEB] border border-amber-200/60 text-xs space-y-1 relative group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C2410C]">
                              {item.meal_type}
                            </span>
                            <button
                              onClick={() => handleDeleteItem(item.item_id)}
                              className="text-stone-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="font-bold text-stone-900 block truncate">
                            {item.recipe_title}
                          </span>
                          <span className="text-[10px] text-stone-500 block">
                            {item.servings} servings • {item.cook_time_mins}m cook
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedDayOffset(dayIdx);
                    setModalOpen(true);
                  }}
                  className="w-full mt-3 py-1.5 rounded-xl border border-dashed border-stone-300 text-stone-500 hover:border-[#9A3412] hover:text-[#9A3412] text-xs font-bold transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Schedule Meal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-900 text-base">Schedule Planned Meal</h3>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Select Day</label>
                <select
                  value={selectedDayOffset}
                  onChange={(e) => setSelectedDayOffset(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none"
                >
                  {DAYS.map((d, idx) => (
                    <option key={d} value={idx}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Meal Slot</label>
                <select
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none"
                >
                  {MEAL_SLOTS.map((s) => (
                    <option key={s} value={s}>{s.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Select Recipe</label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none"
                >
                  {recipes.map((r) => (
                    <option key={r.recipe_id} value={r.recipe_id}>{r.title} ({r.cuisine_type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">Servings</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#802B0F]"
                >
                  Confirm Meal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
