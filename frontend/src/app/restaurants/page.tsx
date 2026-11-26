"use client";

import React, { useState, useEffect } from "react";
import { 
  UtensilsCrossed, 
  MapPin, 
  Phone, 
  Clock, 
  ShieldCheck, 
  Star, 
  Search, 
  ChevronRight,
  Sparkles
} from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("All");

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const url = cityFilter === "All" ? "/restaurants" : `/restaurants?city=${encodeURIComponent(cityFilter)}`;
        const data = await apiRequest(url);
        setRestaurants(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurants();
  }, [cityFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#F2E6E2]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#9A3412]">
            Culinary Establishments
          </span>
          <h1 className="text-3xl font-black text-[#0F172A] tracking-tight">
            Restaurant & Chef Discovery
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Explore authentic kitchens, verified menus, chef profiles, and curated dining spots.
          </p>
        </div>

        {/* City Filter Pills */}
        <div className="flex items-center gap-2">
          {["All", "Mumbai", "Delhi", "Bangalore"].map((city) => (
            <button
              key={city}
              onClick={() => setCityFilter(city)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                cityFilter === city
                  ? "bg-[#9A3412] text-white shadow-sm"
                  : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
              }`}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Restaurant List */}
      {loading ? (
        <div className="text-center py-20 text-stone-400 font-medium">Finding verified restaurants...</div>
      ) : restaurants.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#F2E6E2] space-y-3">
          <UtensilsCrossed className="w-12 h-12 text-stone-300 mx-auto" />
          <h3 className="font-bold text-stone-800 text-lg">No restaurants registered in this region yet</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {restaurants.map((res) => (
            <div
              key={res.business_id}
              className="bg-white rounded-3xl border border-[#F2E6E2] p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between space-y-5"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                    {res.business_type}
                  </span>
                  {res.verification_status === "verified" && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      FSSAI Verified
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-[#0F172A]">{res.business_name}</h3>
                  <span className="text-xs font-semibold text-stone-500 block">{res.cuisine_type}</span>
                </div>

                <div className="space-y-1.5 text-xs text-stone-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
                    <span className="truncate">{res.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-stone-400 shrink-0" />
                    <span>{res.contact_info?.timings || "11:00 AM – 11:00 PM"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                    <span>{res.contact_info?.phone || "+91 98765 43210"}</span>
                  </div>
                </div>

                {/* Menu Highlights */}
                {res.menu_items && res.menu_items.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                      Signature Specialties:
                    </span>
                    <div className="space-y-1 text-xs">
                      {res.menu_items.slice(0, 3).map((item: any) => (
                        <div key={item.item_id} className="flex justify-between text-stone-700">
                          <span className="font-medium truncate">{item.name}</span>
                          <span className="font-bold text-[#9A3412]">₹{item.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                  4.8 Rating
                </span>
                <button
                  onClick={() => alert(`Contacting ${res.business_name}`)}
                  className="px-4 py-2 rounded-xl bg-[#0F172A] text-white font-bold text-xs hover:bg-stone-800 transition-colors"
                >
                  View Details & Order
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
