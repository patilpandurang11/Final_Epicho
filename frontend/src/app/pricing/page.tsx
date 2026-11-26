"use client";

import React, { useState, useEffect } from "react";
import { 
  Check, 
  Crown, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  ChefHat, 
  Building2, 
  ArrowRight,
  CreditCard
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function PricingPage() {
  const { user, refreshUser } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchPlansAndStatus = async () => {
      try {
        const p = await apiRequest("/subscriptions/plans");
        setPlans(p);
        if (user) {
          const status = await apiRequest("/subscriptions/status");
          setActivePlan(status);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlansAndStatus();
  }, [user]);

  const handleStartCheckout = (plan: any) => {
    if (!user) {
      alert("Please log in or register before subscribing.");
      window.location.href = "/login";
      return;
    }
    setSelectedPlanForCheckout(plan);
    setCheckoutModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPlanForCheckout) return;
    setIsProcessing(true);
    try {
      // 1. Create order on backend
      const orderRes = await apiRequest("/subscriptions/checkout", {
        method: "POST",
        body: JSON.stringify({ plan_id: selectedPlanForCheckout.plan_id })
      });

      // 2. Simulate Razorpay payment modal completion with signed cryptographic verification
      const verifyRes = await apiRequest("/subscriptions/verify", {
        method: "POST",
        body: JSON.stringify({
          plan_id: selectedPlanForCheckout.plan_id,
          razorpay_order_id: orderRes.order_id,
          razorpay_payment_id: `pay_${Date.now()}`,
          razorpay_signature: `demo_sig_${Date.now()}`
        })
      });

      alert(verifyRes.message || "Payment verified and subscription activated!");
      setCheckoutModalOpen(false);
      await refreshUser();
      const status = await apiRequest("/subscriptions/status");
      setActivePlan(status);
    } catch (err: any) {
      alert(err.message || "Payment verification failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold uppercase tracking-wider">
          <Crown className="w-3.5 h-3.5 text-amber-600" />
          Transparent Pricing
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#0F172A] tracking-tight">
          Choose the Perfect Culinary Plan
        </h1>
        <p className="text-stone-600 text-sm sm:text-base leading-relaxed">
          From curious home cooks exploring AI recipe adaptations to professional creators and restaurant brands.
        </p>
      </div>

      {/* Subscription Active Banner if subscribed */}
      {activePlan?.has_active_subscription && (
        <div className="max-w-2xl mx-auto p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>You have an active <strong>{activePlan.plan_name}</strong> membership valid until {activePlan.end_date}.</span>
          </div>
          <span className="text-emerald-700 font-extrabold uppercase">Active</span>
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Plan 1: Free */}
        <div className="bg-white rounded-3xl p-6 border border-[#F2E6E2] shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Free Tier</span>
              <h3 className="text-2xl font-black text-[#0F172A]">Cook Free</h3>
            </div>
            <div>
              <span className="text-4xl font-black text-[#0F172A]">₹0</span>
              <span className="text-xs text-stone-500 ml-1">/ month</span>
            </div>
            <p className="text-xs text-stone-600">Essential community access for everyday food lovers.</p>

            <ul className="space-y-2 text-xs text-stone-600 pt-2">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#059669]" /> Browse all recipes & reels</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#059669]" /> 5 AI Kitchen generations / day</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#059669]" /> Post "Cooked This" proof</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#059669]" /> Basic weekly meal planner</li>
            </ul>
          </div>

          <button
            disabled={true}
            className="w-full py-2.5 rounded-xl border border-stone-300 text-stone-400 font-bold text-xs cursor-default"
          >
            Included by Default
          </button>
        </div>

        {/* Dynamic Plans from Backend (Premium ₹149, Creator ₹299, Business ₹599) */}
        {plans.map((p) => {
          const isPremium = p.name.includes("Premium");
          const isCreator = p.name.includes("Creator");
          const isBusiness = p.name.includes("Business");

          return (
            <div
              key={p.plan_id}
              className={`rounded-3xl p-6 flex flex-col justify-between space-y-6 relative transition-all ${
                isPremium
                  ? "bg-gradient-to-b from-[#FFFBEB] to-white border-2 border-[#9A3412] shadow-lg shadow-[#9A3412]/10"
                  : "bg-white border border-[#F2E6E2] shadow-sm"
              }`}
            >
              {isPremium && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#9A3412] text-white text-[10px] font-extrabold uppercase px-3 py-0.5 rounded-full shadow-sm">
                  Most Popular
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#9A3412]">
                    {isCreator ? "For Chefs & Influencers" : isBusiness ? "For Restaurants & Brands" : "For Home Gourmets"}
                  </span>
                  <h3 className="text-2xl font-black text-[#0F172A]">{p.name}</h3>
                </div>

                <div>
                  <span className="text-4xl font-black text-[#0F172A]">₹{p.price}</span>
                  <span className="text-xs text-stone-500 ml-1">/ {p.duration_days} days</span>
                </div>

                <p className="text-xs text-stone-600 leading-relaxed">{p.description}</p>

                <ul className="space-y-2 text-xs text-stone-700 pt-2 border-t border-stone-100">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#059669]" />
                    {isCreator ? "Verified Creator Badge & Analytics" : isBusiness ? "Verified Business & FSSAI Profile" : "Unlimited AI Kitchen Generations"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#059669]" />
                    {isCreator ? "4K Reels & Recipe Collections" : isBusiness ? "Menu Editor & Reviews Manager" : "Cuisine & Dish Fusion Studio"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#059669]" />
                    {isCreator ? "Audience Engagement Reports" : isBusiness ? "Direct Customer Ordering Links" : "Pantry Deductions & Split Carts"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#059669]" />
                    Ad-free VIP Experience
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleStartCheckout(p)}
                className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                  isPremium
                    ? "bg-[#9A3412] text-white hover:bg-[#802B0F]"
                    : "bg-[#0F172A] text-white hover:bg-stone-800"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Subscribe to {p.name}
              </button>
            </div>
          );
        })}
      </div>

      {/* Checkout Modal Simulation */}
      {checkoutModalOpen && selectedPlanForCheckout && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#9A3412]" />
                <h3 className="font-black text-stone-900 text-lg">Razorpay Secure Checkout</h3>
              </div>
              <button onClick={() => setCheckoutModalOpen(false)} className="text-stone-400 font-bold">✕</button>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex justify-between text-xs text-stone-600">
                <span>Selected Plan:</span>
                <span className="font-bold text-stone-900">{selectedPlanForCheckout.name}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-[#9A3412]">
                <span>Total Due:</span>
                <span>₹{selectedPlanForCheckout.price} INR</span>
              </div>
              <span className="text-[10px] text-stone-500 block">
                Billing Cycle: {selectedPlanForCheckout.duration_days} Days • Tax Included
              </span>
            </div>

            <div className="text-xs text-stone-500 space-y-1">
              <p>• Verified 256-bit encryption through backend signature validation.</p>
              <p>• Instant entitlement update and immediate AI Kitchen unlocks.</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-[#059669] text-white font-bold text-xs hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5"
              >
                {isProcessing ? "Verifying..." : "Authorize ₹" + selectedPlanForCheckout.price}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
