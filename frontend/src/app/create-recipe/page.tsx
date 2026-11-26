"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, Trash2, Clock, Users, Flame, Sparkles, ChefHat, 
  ArrowLeft, CheckCircle2, Image as ImageIcon, AlertCircle
} from "lucide-react";
import { api } from "@/lib/api";

export default function CreateRecipePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("North Indian");
  const [dietType, setDietType] = useState("vegetarian");
  const [prepTime, setPrepTime] = useState(20);
  const [cookTime, setCookTime] = useState(30);
  const [servings, setServings] = useState(4);
  const [difficulty, setDifficulty] = useState("medium");
  
  // Ingredients list
  const [ingredients, setIngredients] = useState([
    { name: "Paneer (Cottage Cheese)", quantity: "300", unit: "g" },
    { name: "Butter", quantity: "2", unit: "tbsp" },
    { name: "Kashmiri Red Chilli Powder", quantity: "1", unit: "tsp" },
  ]);

  // Steps list
  const [steps, setSteps] = useState([
    { instruction: "Heat butter in a heavy-bottomed pan and lightly sear the paneer cubes.", duration: 5 },
    { instruction: "Add pureed tomatoes and simmer over low flame until oil separates.", duration: 15 },
  ]);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const addIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: "", unit: "g" }]);
  };

  const removeIngredient = (idx: number) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  const updateIngredient = (idx: number, field: string, value: string) => {
    const updated = [...ingredients];
    (updated[idx] as any)[field] = value;
    setIngredients(updated);
  };

  const addStep = () => {
    setSteps([...steps, { instruction: "", duration: 5 }]);
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, field: string, value: any) => {
    const updated = [...steps];
    (updated[idx] as any)[field] = value;
    setSteps(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        title,
        description,
        cuisine,
        diet_type: dietType,
        prep_time_minutes: prepTime,
        cook_time_minutes: cookTime,
        servings,
        difficulty,
        is_published: true,
        ingredients: ingredients.filter(i => i.name.trim()).map((i, idx) => ({
          name: i.name,
          quantity: parseFloat(i.quantity) || 1,
          unit: i.unit,
          display_order: idx + 1
        })),
        steps: steps.filter(s => s.instruction.trim()).map((s, idx) => ({
          step_number: idx + 1,
          instruction: s.instruction,
          timer_seconds: (s.duration || 0) * 60
        }))
      };

      const res = await api.createRecipe(payload);
      setSuccess(true);
      setTimeout(() => {
        router.push("/recipes");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to publish recipe. Please ensure you are logged in.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/recipes" className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 mb-6 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to Recipes
      </Link>

      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
        <div>
          <h1 className="text-3xl font-extrabold text-stone-900 font-serif">Publish Culinary Recipe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Share your masterpiece with the EpiCho community with verified measurements and timers.
          </p>
        </div>
        <Link
          href="/ai-kitchen"
          className="inline-flex items-center gap-2 text-xs font-bold text-primary bg-primary/10 px-3.5 py-2 rounded-xl hover:bg-primary/20 transition"
        >
          <Sparkles className="w-4 h-4" /> Generate with AI Kitchen
        </Link>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 mb-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Recipe published successfully! Redirecting...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Core Info */}
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-stone-900 font-serif">Recipe Essentials</h2>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Recipe Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Royal Shahi Paneer with Saffron Cream"
              className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Culinary Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Tell the story behind this dish, its aroma, texture, and flavor profile..."
              className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Cuisine</label>
              <input
                type="text"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Diet Type</label>
              <select
                value={dietType}
                onChange={(e) => setDietType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm bg-white"
              >
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="non-vegetarian">Non-Vegetarian</option>
                <option value="eggetarian">Eggetarian</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Prep Time (min)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Cook Time (min)</label>
              <input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-border text-sm"
              />
            </div>
          </div>
        </div>

        {/* Ingredients Section */}
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900 font-serif">Ingredients & Measurements</h2>
            <button
              type="button"
              onClick={addIngredient}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80"
            >
              <Plus className="w-4 h-4" /> Add Ingredient
            </button>
          </div>

          <div className="space-y-3">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Ingredient name (e.g. Kasuri Methi)"
                  value={ing.name}
                  onChange={(e) => updateIngredient(idx, "name", e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-border text-sm"
                  required
                />
                <input
                  type="text"
                  placeholder="Qty"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(idx, "quantity", e.target.value)}
                  className="w-20 px-3 py-2 rounded-xl border border-border text-sm text-center"
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(idx, "unit", e.target.value)}
                  className="w-24 px-3 py-2 rounded-xl border border-border text-sm text-center"
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(idx)}
                  className="p-2 text-stone-400 hover:text-rose-600 transition"
                  disabled={ingredients.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Steps Section */}
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900 font-serif">Step-by-Step Cooking Guide</h2>
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80"
            >
              <Plus className="w-4 h-4" /> Add Step
            </button>
          </div>

          <div className="space-y-4">
            {steps.map((st, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Step {idx + 1}</span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-stone-600">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>Timer (min):</span>
                      <input
                        type="number"
                        value={st.duration}
                        onChange={(e) => updateStep(idx, "duration", parseInt(e.target.value) || 0)}
                        className="w-14 px-2 py-0.5 border border-border rounded text-center text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      className="text-stone-400 hover:text-rose-600 transition"
                      disabled={steps.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <textarea
                  placeholder={`Describe step ${idx + 1} in detail...`}
                  value={st.instruction}
                  onChange={(e) => updateStep(idx, "instruction", e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <Link
            href="/recipes"
            className="px-5 py-2.5 rounded-xl border border-border text-stone-700 text-sm font-semibold hover:bg-stone-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white text-sm font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <ChefHat className="w-4 h-4" /> Publish Recipe
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
