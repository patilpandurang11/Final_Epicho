"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Bookmark,
  ChefHat,
  Clock,
  Download,
  Flag,
  Globe,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Upload,
} from "lucide-react";

export default function AIKitchenResultsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [targetLang, setTargetLang] = useState("Hindi");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const cached = sessionStorage.getItem("epicho_latest_ai_recipe");
    if (cached) {
      try {
        setRecipe(JSON.parse(cached));
      } catch {}
    }
    if (user) {
      apiRequest("/ai-kitchen/history")
        .then((items) => {
          setHistory(items);
          if (!cached && items.length > 0 && items[0].recipe) {
            setRecipe(items[0].recipe);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleCustomize = async () => {
    if (!recipe || !customPrompt.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const adapted = await apiRequest("/ai-kitchen/modify", {
        method: "POST",
        body: JSON.stringify({ original_recipe: recipe, modification_prompt: customPrompt }),
      });
      setRecipe(adapted);
      sessionStorage.setItem("epicho_latest_ai_recipe", JSON.stringify(adapted));
      setCustomPrompt("");
      setMsg("Recipe customized and allergens re-validated.");
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleTranslate = async () => {
    if (!recipe) return;
    setBusy(true);
    try {
      const tr = await apiRequest("/ai-kitchen/translate", {
        method: "POST",
        body: JSON.stringify({ recipe, target_language: targetLang }),
      });
      setRecipe(tr);
      setMsg(`Translated instructions to ${targetLang}.`);
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!user) return router.push("/login");
    if (!recipe) return;
    const created = await apiRequest("/recipes", {
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
        })),
        steps: recipe.steps,
        nutrition: recipe.nutrition,
      }),
    });
    router.push(`/recipes/${created.slug}`);
  };

  const handleReportUnsafe = async () => {
    if (!user || !recipe?.request_id) return setMsg("Sign in with an active generation ID to report.");
    await apiRequest(`/ai-kitchen/${recipe.request_id}/report`, {
      method: "POST",
      body: JSON.stringify({ reason: "User flagged potential dietary/allergen safety concern" }),
    });
    setMsg("Unsafe AI output reported to moderation staff.");
  };

  const handleDownload = () => {
    if (!recipe) return;
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "epicho-ai-recipe.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge variant="amber">
            <Sparkles className="w-3.5 h-3.5" /> AI Kitchen Results Studio
          </Badge>
          <h1 className="text-3xl font-bold mt-2">Structured Culinary Output</h1>
        </div>
        <Link href="/ai-kitchen">
          <Button variant="outline">
            <RefreshCw className="w-4 h-4" /> New Generation
          </Button>
        </Link>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
          {msg}
        </div>
      )}

      {!recipe ? (
        <Card className="p-10 text-center space-y-4">
          <ChefHat className="w-12 h-12 mx-auto text-[#EA580C]" />
          <h2 className="text-xl font-bold">No AI Recipe Loaded Yet</h2>
          <p className="text-sm text-[#475569]">Generate a dish in AI Kitchen first to customize, translate, or publish it here.</p>
          <Link href="/ai-kitchen">
            <Button>Open AI Kitchen</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="emerald">{recipe.cuisine_type}</Badge>
                  <Badge variant="outline">{recipe.diet_type}</Badge>
                  <Badge variant="amber">AI-Generated</Badge>
                </div>
                <CardTitle className="text-2xl">{recipe.title}</CardTitle>
                <p className="text-sm text-[#475569] dark:text-[#A7B8AE]">{recipe.description}</p>
                <div className="flex flex-wrap gap-4 text-xs text-[#475569] pt-2">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Prep {recipe.prep_time_mins}m + Cook {recipe.cook_time_mins}m</span>
                  <span>{recipe.servings} servings</span>
                  <span>Difficulty: {recipe.difficulty_level}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {recipe.allergen_warnings?.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs text-red-800 dark:text-red-200 space-y-1">
                    <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Allergen Safety Guard</p>
                    {recipe.allergen_warnings.map((w: string, i: number) => <p key={i}>{w}</p>)}
                  </div>
                )}

                <div>
                  <h3 className="font-bold text-sm mb-2">Ingredients</h3>
                  <ul className="space-y-1.5 text-sm">
                    {recipe.ingredients?.map((i: any, idx: number) => (
                      <li key={idx} className="flex justify-between py-1 border-b border-[#E7DFD3]/60 dark:border-[#253D31]">
                        <span>{i.name}</span>
                        <span className="font-semibold text-xs text-[#475569]">{i.quantity} {i.unit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-sm mb-2">Instructions</h3>
                  <ol className="space-y-3 text-sm">
                    {recipe.steps?.map((s: any) => (
                      <li key={s.step_number} className="p-3 rounded-xl bg-[#F5F0E6]/60 dark:bg-[#1A2D24]">
                        <p className="font-bold text-xs text-[#9A3412]">Step {s.step_number}</p>
                        <p className="mt-1">{s.instruction}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="p-3 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] text-[11px] text-[#475569] space-y-1">
                  <p className="font-bold flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5 text-[#059669]" /> Safety & Medical Disclaimer</p>
                  <p>{recipe.food_safety_guidance}</p>
                  <p>{recipe.medical_disclaimer}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-5">
            <Card>
              <CardHeader><CardTitle className="text-base">Nutrition Per Serving</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between"><span>Calories</span><strong>{recipe.nutrition?.calories} kcal</strong></div>
                <div className="flex justify-between"><span>Protein</span><strong>{recipe.nutrition?.protein_g} g</strong></div>
                <div className="flex justify-between"><span>Carbs</span><strong>{recipe.nutrition?.carbs_g} g</strong></div>
                <div className="flex justify-between"><span>Fat</span><strong>{recipe.nutrition?.fat_g} g</strong></div>
                <div className="flex justify-between"><span>Fiber</span><strong>{recipe.nutrition?.fiber_g} g</strong></div>
                <div className="flex justify-between"><span>Health Index</span><strong>{recipe.nutrition?.health_score}/100</strong></div>
                <p className="text-[11px] text-[#475569] pt-2">Source: {recipe.nutrition?.data_source}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Customize & Translate</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g., Make vegan, high protein, keto"
                />
                <Button onClick={handleCustomize} disabled={busy} className="w-full" variant="primary" size="sm">
                  Apply AI Customization
                </Button>
                <div className="flex gap-2">
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="flex-1 h-9 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#0D1511] px-2 text-xs"
                  >
                    {["Hindi", "Tamil", "Bengali", "Spanish", "French"].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <Button onClick={handleTranslate} disabled={busy} variant="outline" size="sm">
                    <Globe className="w-3.5 h-3.5" /> Translate
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 space-y-2">
                <Button onClick={handlePublish} variant="emerald" className="w-full" size="sm">
                  <Upload className="w-4 h-4" /> Publish Recipe
                </Button>
                <Button onClick={handleDownload} variant="outline" className="w-full" size="sm">
                  <Download className="w-4 h-4" /> Download JSON
                </Button>
                <Button onClick={handleReportUnsafe} variant="ghost" className="w-full text-red-600" size="sm">
                  <Flag className="w-4 h-4" /> Report Unsafe Output
                </Button>
              </CardContent>
            </Card>

            {history.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Recent AI History</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {history.slice(0, 5).map((h) => (
                    <button
                      key={h.request_id}
                      type="button"
                      onClick={() => h.recipe && setRecipe(h.recipe)}
                      className="w-full text-left p-2 rounded-lg hover:bg-[#F5F0E6] dark:hover:bg-[#1A2D24] text-xs"
                    >
                      <p className="font-bold truncate">{h.recipe?.title || h.prompt}</p>
                      <p className="text-[11px] text-[#475569]">{new Date(h.created_at).toLocaleDateString()}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
