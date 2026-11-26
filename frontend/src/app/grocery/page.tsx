"use client";

import React, { useState, useEffect } from "react";
import { 
  ShoppingCart, 
  Check, 
  ExternalLink, 
  Trash2, 
  Package, 
  Sparkles, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function GroceryPage() {
  const [groceryList, setGroceryList] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchGrocery = async () => {
    try {
      const data = await apiRequest("/grocery/current");
      setGroceryList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrocery();
  }, []);

  const handleToggleItem = async (itemId: string) => {
    try {
      const res = await apiRequest(`/grocery/items/${itemId}/toggle`, { method: "PATCH" });
      setGroceryList({
        ...groceryList,
        items: groceryList.items.map((it: any) => it.item_id === itemId ? { ...it, purchased: res.purchased } : it)
      });
    } catch {
      alert("Failed to toggle item.");
    }
  };

  // Group items by category
  const categories = groceryList?.items?.reduce((acc: any, it: any) => {
    const cat = it.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(it);
    return acc;
  }, {}) || {};

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#F2E6E2]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#059669]">
            Zero-Waste Smart Cart
          </span>
          <h1 className="text-3xl font-black text-[#0F172A] tracking-tight">
            Smart Grocery Management
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Aggregated from your weekly meals. Duplicate ingredients combined & pantry items automatically deducted.
          </p>
        </div>

        {/* Quick Shopping Delivery Links */}
        <div className="flex items-center gap-2">
          {groceryList?.shopping_partners?.map((p: any) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-bold text-stone-700 flex items-center gap-1 shadow-sm transition-colors"
            >
              <span>{p.name}</span>
              <span className="text-[10px] text-[#059669]">({p.delivery_mins}m)</span>
              <ExternalLink className="w-3 h-3 text-stone-400" />
            </a>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-stone-400 font-medium">Aggregating smart grocery list...</div>
      ) : !groceryList || groceryList.items?.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#F2E6E2] space-y-4">
          <ShoppingCart className="w-12 h-12 text-stone-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-bold text-stone-800 text-lg">Your Grocery List is Empty</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Plan meals in your weekly planner or tap 'Add to Grocery' from any recipe to generate a consolidated shopping cart.
            </p>
          </div>
          <a
            href="/meal-planner"
            className="inline-block px-5 py-2.5 rounded-xl bg-[#9A3412] text-white font-bold text-xs hover:bg-[#802B0F]"
          >
            Go to Meal Planner
          </a>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Categorized Grocery Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(categories).map(([catName, items]: [string, any]) => (
              <div key={catName} className="bg-white rounded-3xl p-6 border border-[#F2E6E2] shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <h3 className="font-black text-sm uppercase tracking-wider text-[#0F172A]">
                    {catName}
                  </h3>
                  <span className="text-xs font-semibold text-stone-400">{items.length} items</span>
                </div>

                <ul className="space-y-2 text-xs">
                  {items.map((it: any) => (
                    <li
                      key={it.item_id}
                      onClick={() => handleToggleItem(it.item_id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        it.purchased
                          ? "bg-stone-50 border-stone-200 text-stone-400 line-through"
                          : "bg-white border-stone-200/80 hover:border-[#9A3412]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                          it.purchased ? "bg-[#059669] border-[#059669] text-white" : "border-stone-300"
                        }`}>
                          {it.purchased && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="font-semibold">{it.ingredient_name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {it.in_pantry && (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Pantry Subtracted
                          </span>
                        )}
                        <span className="font-bold text-stone-600">
                          {it.quantity} {it.unit}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
