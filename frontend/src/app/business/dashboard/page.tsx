"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { 
  Building2, UtensilsCrossed, Star, TrendingUp, Clock, MapPin, 
  PlusCircle, CheckCircle2, MessageSquare, AlertCircle, ShieldCheck
} from "lucide-react";

export default function BusinessDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"menu" | "reviews" | "analytics" | "profile">("menu");

  const [menuItems, setMenuItems] = useState([
    { id: "1", name: "Truffle Butter Dal Makhani", category: "Mains", price: 380, isVeg: true, inStock: true },
    { id: "2", name: "Smoked Galouti Kebabs (6 pcs)", category: "Starters", price: 440, isVeg: false, inStock: true },
    { id: "3", name: "Saffron Khameeri Roti", category: "Breads", price: 95, isVeg: true, inStock: true },
    { id: "4", name: "Rose Kulfi Falooda", category: "Desserts", price: 210, isVeg: true, inStock: false },
  ]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Mains");
  const [newItemVeg, setNewItemVeg] = useState(true);

  const handleAddMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice) return;
    const item = {
      id: Date.now().toString(),
      name: newItemName,
      category: newItemCategory,
      price: parseFloat(newItemPrice),
      isVeg: newItemVeg,
      inStock: true
    };
    setMenuItems([item, ...menuItems]);
    setNewItemName("");
    setNewItemPrice("");
  };

  const toggleStock = (id: string) => {
    setMenuItems(menuItems.map(item => item.id === id ? { ...item, inStock: !item.inStock } : item));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight font-serif">Restaurant & Business Suite</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> FSSAI Verified
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Managing <span className="font-semibold text-stone-800">Bukhara Heritage Bistro</span> • License: #10023022001942
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/restaurants"
            className="inline-flex items-center gap-2 border border-border bg-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-stone-50 transition shadow-sm"
          >
            View Public Profile
          </Link>
          <span className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
            <Clock className="w-4 h-4" /> Open Now (12:00 PM – 11:30 PM)
          </span>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Profile Views (30D)</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-stone-900">28,940</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">+18.2% from rankings</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Average Rating</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-2xl font-black text-stone-900">4.8 / 5.0</div>
          <div className="text-xs text-muted-foreground mt-1">From 342 verified diners</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Menu Items</span>
            <UtensilsCrossed className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-stone-900">{menuItems.length} Dishes</div>
          <div className="text-xs text-muted-foreground mt-1">3 seasonal specials active</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Table Queries</span>
            <MessageSquare className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-stone-900">64</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">100% response rate</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {[
          { id: "menu", label: "Menu Management", icon: UtensilsCrossed },
          { id: "reviews", label: "Guest Reviews & Critic Notes", icon: Star },
          { id: "analytics", label: "Diner Traffic Analytics", icon: TrendingUp },
          { id: "profile", label: "Operating Hours & Location", icon: MapPin },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-stone-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "menu" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Menu Items Table */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900 font-serif">Live Digital Menu</h3>
              <span className="text-xs text-muted-foreground">{menuItems.length} items listed</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground font-bold uppercase">
                    <th className="py-3 px-2">Dish</th>
                    <th className="py-3 px-2">Category</th>
                    <th className="py-3 px-2">Price</th>
                    <th className="py-3 px-2">Availability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {menuItems.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-rose-600"}`} />
                          <span className="font-semibold text-stone-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-stone-600">{item.category}</td>
                      <td className="py-3 px-2 font-bold text-stone-900">₹{item.price}</td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => toggleStock(item.id)}
                          className={`text-xs px-2.5 py-1 rounded-full font-bold transition ${
                            item.inStock
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-rose-100 text-rose-800 hover:bg-rose-200"
                          }`}
                        >
                          {item.inStock ? "In Stock" : "Sold Out"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Menu Item Card */}
          <div className="bg-white p-6 rounded-2xl border border-border shadow-sm h-fit">
            <h3 className="text-base font-bold text-stone-900 mb-4 font-serif flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-primary" /> Add New Dish
            </h3>
            <form onSubmit={handleAddMenuItem} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">Dish Name</label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Kashmiri Kahwa Chai"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="250"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                  >
                    <option value="Starters">Starters</option>
                    <option value="Mains">Mains</option>
                    <option value="Breads">Breads</option>
                    <option value="Desserts">Desserts</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="diet"
                    checked={newItemVeg}
                    onChange={() => setNewItemVeg(true)}
                    className="text-primary"
                  />
                  <span className="text-xs font-semibold text-emerald-700">Vegetarian</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="diet"
                    checked={!newItemVeg}
                    onChange={() => setNewItemVeg(false)}
                    className="text-primary"
                  />
                  <span className="text-xs font-semibold text-rose-700">Non-Veg</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/95 transition shadow-sm mt-2"
              >
                Publish to Menu
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "reviews" && (
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-stone-900 font-serif">Customer Feedback & Critic Reviews</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-900 text-sm">Aditi Sharma</span>
                  <span className="text-xs text-amber-500 font-bold">★★★★★</span>
                </div>
                <span className="text-xs text-muted-foreground">Yesterday</span>
              </div>
              <p className="text-sm text-stone-700">
                “The Truffle Butter Dal Makhani has a silky, velvety texture that pairs unbelievably well with the khameeri roti. Outstanding hospitality!”
              </p>
              <div className="mt-3 pl-4 border-l-2 border-primary">
                <span className="text-xs font-bold text-stone-900 block">Owner Response:</span>
                <p className="text-xs text-stone-600">Thank you so much Aditi! We slow-cook our lentils for 18 hours over charcoal. Glad you loved it!</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {(activeTab === "analytics" || activeTab === "profile") && (
        <div className="bg-white p-12 text-center rounded-2xl border border-border shadow-sm">
          <Building2 className="w-10 h-10 text-primary mx-auto mb-3" />
          <h3 className="text-lg font-bold text-stone-900 capitalize mb-1">{activeTab} Hub</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Manage your operating timings, geo-coordinates for delivery integrations, and dine-in peak hours telemetry.
          </p>
        </div>
      )}
    </div>
  );
}
