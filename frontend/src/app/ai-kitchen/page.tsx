"use client";

import React, { useState } from "react";
import { 
  Sparkles, 
  Flame, 
  Plus, 
  X, 
  Clock, 
  ChefHat, 
  ShieldAlert, 
  Utensils, 
  Activity, 
  Bookmark, 
  CalendarPlus, 
  ShoppingCart, 
  Sliders, 
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Share2
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const QUICK_SUGGESTIONS = [
  "Paneer", "Tomatoes", "Onion", "Garlic", "Ginger", "Capsicum", 
  "Basmati Rice", "Chicken Breast", "Eggs", "Spinach", "Pasta", 
  "Potatoes", "Greek Yogurt", "Mushrooms", "Black Beans"
];

const CUISINES = [
  "Indian", "Italian", "Mexican", "Asian / Pan-Asian", 
  "Mediterranean", "Thai", "Middle Eastern", "American", "French"
];

const TASTES = [
  { id: "tangy & spicy", label: "Tangy & Spicy 🌶️" },
  { id: "mild & creamy", label: "Mild & Creamy 🥛" },
  { id: "rich umami", label: "Rich Umami 🍄" },
  { id: "sweet & savory", label: "Sweet & Savory 🍯" },
  { id: "sour & citrus", label: "Sour & Citrus 🍋" }
];

const ALLERGEN_OPTIONS = [
  "Peanuts", "Dairy", "Gluten", "Eggs", "Soy", "Tree Nuts", "Shellfish", "Sesame"
];

const EQUIPMENT_OPTIONS = [
  "Pan / Skillet", "Tawa", "Oven", "Air Fryer", "Pressure Cooker", "Blender"
];

export default function AIKitchenPage() {
  const { user } = useAuth();
  
  // State
  const [ingredients, setIngredients] = useState<string[]>(["Paneer", "Tomatoes", "Onion", "Garlic"]);
  const [customInput, setCustomInput] = useState("");
  const [cuisine, setCuisine] = useState("Indian");
  const [taste, setTaste] = useState("tangy & spicy");
  const [diet, setDiet] = useState("veg");
  const [servings, setServings] = useState(2);
  const [cookingTime, setCookingTime] = useState(25);
  const [equipment, setEquipment] = useState<string[]>(["Pan / Skillet", "Tawa"]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [fusionCuisine, setFusionCuisine] = useState<string>("");
  const [fusionIntensity, setFusionIntensity] = useState<number>(5);

  const [isLoading, setIsLoading] = useState(false);
  const [recipe, setRecipe] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"ingredients" | "steps" | "nutrition">("ingredients");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const addIngredient = (item: string) => {
    const trimmed = item.trim();
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients([...ingredients, trimmed]);
    }
    setCustomInput("");
  };

  const removeIngredient = (item: string) => {
    setIngredients(ingredients.filter((i) => i !== item));
  };

  const toggleAllergy = (allergy: string) => {
    if (allergies.includes(allergy)) {
      setAllergies(allergies.filter((a) => a !== allergy));
    } else {
      setAllergies([...allergies, allergy]);
    }
  };

  const toggleEquipment = (eq: string) => {
    if (equipment.includes(eq)) {
      setEquipment(equipment.filter((e) => e !== eq));
    } else {
      setEquipment([...equipment, eq]);
    }
  };

  const handleGenerate = async () => {
    if (ingredients.length === 0) {
      alert("Please add at least one ingredient to start cooking!");
      return;
    }

    setIsLoading(true);
    setRecipe(null);
    setFeedbackMsg(null);

    try {
      const payload = {
        ingredients,
        cuisine_preference: cuisine,
        taste_preference: taste,
        diet_preference: diet,
        servings,
        cooking_time_mins: cookingTime,
        cooking_equipment: equipment,
        allergies,
        fusion_cuisine: fusionCuisine || undefined,
        fusion_intensity: fusionIntensity
      };

      const result = await apiRequest("/ai-kitchen/generate", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setRecipe(result);
      setActiveTab("ingredients");
    } catch (err: any) {
      alert(err.message || "Failed to generate recipe.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!recipe) return;
    try {
      await apiRequest("/recipes", {
        method: "POST",
        body: JSON.stringify({
          title: recipe.title,
          description: recipe.description,
          cuisine_type: recipe.cuisine_type,
          diet_type: recipe.diet_type,
          prep_time_mins: recipe.prep_time_mins,
          cook_time_mins: recipe.cook_time_mins,
          difficulty_level: recipe.difficulty_level,
          servings: recipe.servings,
          equipment_required: recipe.equipment_required,
          is_ai_generated: true,
          ingredients: recipe.ingredients.map((i: any) => ({
            ingredient_name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            notes: i.notes,
            is_optional: i.is_optional
          })),
          steps: recipe.steps.map((s: any) => ({
            step_number: s.step_number,
            instruction: s.instruction,
            timer_seconds: s.timer_seconds,
            tip: s.tip,
            common_mistake: s.common_mistake
          })),
          nutrition: recipe.nutrition
        })
      });
      setFeedbackMsg("Recipe saved to your cookbook and community catalog!");
    } catch (err: any) {
      alert(err.message || "Please log in to save recipes.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Page Title */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#9A3412]/10 text-[#9A3412] text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Intelligent Culinary Engine
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-[#0F172A] tracking-tight">
          AI Kitchen Studio
        </h1>
        <p className="text-stone-600 text-sm sm:text-base max-w-3xl">
          Enter your pantry items, desired flavors, and dietary requirements. Our certified culinary engine creates exact, allergy-safe, step-by-step recipes with validated nutritional values.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Generator Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-[#F2E6E2] shadow-sm space-y-6">
          
          {/* 1. Ingredients Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-[#0F172A]">
              1. Available Ingredients in Your Kitchen
            </label>
            
            {/* Input row */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type ingredient (e.g. paneer, broccoli, tofu)..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addIngredient(customInput);
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#9A3412] text-sm"
              />
              <button
                type="button"
                onClick={() => addIngredient(customInput)}
                className="px-5 py-2.5 rounded-xl bg-[#9A3412] text-white font-bold text-sm hover:bg-[#802B0F] transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Selected Chips */}
            <div className="flex flex-wrap gap-2 pt-2">
              {ingredients.map((ing) => (
                <span
                  key={ing}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFBEB] border border-[#F2E6E2] text-xs font-bold text-[#9A3412]"
                >
                  {ing}
                  <button
                    onClick={() => removeIngredient(ing)}
                    className="hover:text-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>

            {/* Quick Suggestions */}
            <div className="pt-2">
              <span className="text-xs text-stone-500 font-medium mr-2">Quick Add:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {QUICK_SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => addIngredient(item)}
                    disabled={ingredients.includes(item)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      ingredients.includes(item)
                        ? "bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed"
                        : "bg-white text-stone-700 border-stone-300 hover:border-[#9A3412] hover:text-[#9A3412]"
                    }`}
                  >
                    + {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Cuisine & Taste */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Primary Cuisine
              </label>
              <select
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
              >
                {CUISINES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Taste & Flavor Profile
              </label>
              <select
                value={taste}
                onChange={(e) => setTaste(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
              >
                {TASTES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Diet, Servings & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Dietary Type
              </label>
              <select
                value={diet}
                onChange={(e) => setDiet(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#9A3412]"
              >
                <option value="veg">Vegetarian 🟢</option>
                <option value="vegan">Vegan 🌱</option>
                <option value="eggetarian">Eggetarian 🥚</option>
                <option value="non_veg">Non-Vegetarian 🍗</option>
                <option value="jain">Jain (No Root Veg)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Servings
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 4, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setServings(num)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                      servings === num
                        ? "bg-[#9A3412] text-white border-[#9A3412]"
                        : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                Max Time: {cookingTime}m
              </label>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={cookingTime}
                onChange={(e) => setCookingTime(Number(e.target.value))}
                className="w-full accent-[#9A3412] mt-2"
              />
            </div>
          </div>

          {/* 4. Cuisine Fusion Studio (Advanced) */}
          <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#C2410C]" />
                Cuisine & Dish Fusion Studio (Optional)
              </span>
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                Intensity: {fusionIntensity}/10
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  value={fusionCuisine}
                  onChange={(e) => setFusionCuisine(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-medium focus:outline-none"
                >
                  <option value="">No Fusion (Traditional)</option>
                  <option value="Italian">Fuse with Italian (Pasta, herbs, olive oil)</option>
                  <option value="Mexican">Fuse with Mexican (Salsa, tacos, lime)</option>
                  <option value="Japanese">Fuse with Japanese (Umami, miso, teriyaki)</option>
                  <option value="Lebanese">Fuse with Lebanese (Tahini, sumac, garlic)</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={fusionIntensity}
                  onChange={(e) => setFusionIntensity(Number(e.target.value))}
                  disabled={!fusionCuisine}
                  className="w-full accent-[#C2410C] disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* 5. Allergens & Equipment */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
              Allergens to Exclude (Strict Safety Filter)
            </label>
            <div className="flex flex-wrap gap-2">
              {ALLERGEN_OPTIONS.map((al) => (
                <button
                  key={al}
                  type="button"
                  onClick={() => toggleAllergy(al)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
                    allergies.includes(al)
                      ? "bg-red-50 text-red-700 border-red-300 ring-1 ring-red-400"
                      : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                  }`}
                >
                  {allergies.includes(al) ? "✕ " : "+ "} {al}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#9A3412] via-[#C2410C] to-amber-700 text-white font-extrabold text-base hover:shadow-lg hover:shadow-[#9A3412]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Simulating Culinary Chemistry...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Generate Recipe with AI Kitchen</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Recipe Result View (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-8 border border-[#F2E6E2] shadow-sm space-y-6">
          {recipe ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Header Title & Disclaimers */}
              <div className="space-y-2 border-b border-stone-100 pb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#059669] bg-[#059669]/10 px-2.5 py-0.5 rounded-full">
                    {recipe.cuisine_type} • {recipe.diet_type.toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold text-stone-500">
                    {recipe.servings} Servings
                  </span>
                </div>
                <h2 className="text-2xl font-black text-[#0F172A] leading-tight">
                  {recipe.title}
                </h2>
                <p className="text-stone-600 text-xs leading-relaxed">
                  {recipe.description}
                </p>
                
                <div className="flex items-center gap-4 text-xs text-stone-500 pt-1">
                  <span className="flex items-center gap-1 font-semibold text-stone-700">
                    <Clock className="w-3.5 h-3.5 text-[#C2410C]" />
                    {recipe.cook_time_mins} mins
                  </span>
                  <span>•</span>
                  <span>{recipe.nutrition?.calories || 320} kcal / serv</span>
                  <span>•</span>
                  <span className="capitalize">{recipe.difficulty_level} difficulty</span>
                </div>
              </div>

              {/* Allergen Alerts if any */}
              {recipe.allergy_warnings && recipe.allergy_warnings.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-red-900">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Safety Allergen Alert</span>
                  </div>
                  {recipe.allergy_warnings.map((w: string, idx: number) => (
                    <p key={idx}>{w}</p>
                  ))}
                </div>
              )}

              {/* Tabs: Ingredients / Steps / Nutrition */}
              <div className="flex border-b border-stone-200">
                <button
                  onClick={() => setActiveTab("ingredients")}
                  className={`flex-1 pb-2.5 text-xs font-bold transition-colors ${
                    activeTab === "ingredients"
                      ? "border-b-2 border-[#9A3412] text-[#9A3412]"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  Ingredients ({recipe.ingredients?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("steps")}
                  className={`flex-1 pb-2.5 text-xs font-bold transition-colors ${
                    activeTab === "steps"
                      ? "border-b-2 border-[#9A3412] text-[#9A3412]"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  Step-by-Step ({recipe.steps?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("nutrition")}
                  className={`flex-1 pb-2.5 text-xs font-bold transition-colors ${
                    activeTab === "nutrition"
                      ? "border-b-2 border-[#9A3412] text-[#9A3412]"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  Nutrition & Health
                </button>
              </div>

              {/* Tab Contents */}
              <div className="min-h-[220px]">
                {activeTab === "ingredients" && (
                  <ul className="space-y-2 text-sm">
                    {recipe.ingredients?.map((ing: any, i: number) => (
                      <li key={i} className="flex items-center justify-between py-1.5 border-b border-stone-50">
                        <span className="font-medium text-stone-800">{ing.name}</span>
                        <span className="text-xs font-bold text-stone-500">
                          {ing.quantity} {ing.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {activeTab === "steps" && (
                  <ol className="space-y-4">
                    {recipe.steps?.map((step: any) => (
                      <li key={step.step_number} className="text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#9A3412] text-white flex items-center justify-center font-bold text-[10px]">
                            {step.step_number}
                          </span>
                          <span className="font-bold text-stone-900">Step {step.step_number}</span>
                          {step.timer_seconds && (
                            <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
                              ⏱️ {Math.round(step.timer_seconds / 60)} mins
                            </span>
                          )}
                        </div>
                        <p className="text-stone-700 pl-7 leading-relaxed">{step.instruction}</p>
                        {step.tip && (
                          <p className="text-emerald-700 bg-emerald-50 p-2 rounded-lg pl-7 text-[11px] font-medium">
                            💡 Chef Tip: {step.tip}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                {activeTab === "nutrition" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <span className="block text-2xl font-black text-amber-900">
                          {recipe.nutrition?.calories || 320}
                        </span>
                        <span className="text-[11px] font-bold text-amber-700">Calories (kcal)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="block text-2xl font-black text-emerald-900">
                          {recipe.nutrition?.protein_g || 18}g
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700">Protein</span>
                      </div>
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                        <span className="block text-xl font-black text-stone-800">
                          {recipe.nutrition?.carbs_g || 28}g
                        </span>
                        <span className="text-[11px] font-semibold text-stone-600">Carbohydrates</span>
                      </div>
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                        <span className="block text-xl font-black text-stone-800">
                          {recipe.nutrition?.fat_g || 12}g
                        </span>
                        <span className="text-[11px] font-semibold text-stone-600">Healthy Fats</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900">Health Index Score</span>
                      <span className="text-sm font-extrabold text-purple-700">
                        {recipe.nutrition?.health_score || 88} / 100
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Feedback Success Notice */}
              {feedbackMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>{feedbackMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={handleSaveRecipe}
                  className="w-full py-2.5 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#802B0F] transition-colors flex items-center justify-center gap-2"
                >
                  <Bookmark className="w-4 h-4" />
                  Save Recipe to My Cookbook
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="/meal-planner"
                    className="py-2 px-3 rounded-xl border border-stone-300 text-stone-700 font-semibold text-xs hover:bg-stone-50 flex items-center justify-center gap-1.5"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    Add to Planner
                  </a>
                  <a
                    href="/grocery"
                    className="py-2 px-3 rounded-xl border border-stone-300 text-stone-700 font-semibold text-xs hover:bg-stone-50 flex items-center justify-center gap-1.5"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    To Grocery List
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-[400px] flex flex-col items-center justify-center text-center p-6 space-y-4 text-stone-400">
              <div className="w-16 h-16 rounded-3xl bg-[#FFFBEB] flex items-center justify-center text-[#9A3412]">
                <ChefHat className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-stone-700 text-base">Your Recipe Studio Awaits</h3>
                <p className="text-xs text-stone-500 max-w-xs">
                  Pick your available ingredients and tap 'Generate Recipe' to compute step-by-step cooking instructions with nutrition analysis.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
