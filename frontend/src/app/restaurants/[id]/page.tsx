"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { BadgeCheck, Clock, MapPin, Phone, Star, Tag, Utensils } from "lucide-react";

export default function RestaurantDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  const [biz, setBiz] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  useEffect(() => {
    if (!id) return;
    apiRequest(`/restaurants/${id}`).then(setBiz).catch(() => {});
    apiRequest(`/restaurants/${id}/reviews`).then(setReviews).catch(() => {});
    apiRequest(`/restaurants/${id}/promotions`).then(setPromos).catch(() => {});
  }, [id]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest(`/restaurants/${id}/reviews`, {
      method: "POST",
      body: JSON.stringify({ rating, review_text: reviewText }),
    });
    setReviewText("");
    const updated = await apiRequest(`/restaurants/${id}/reviews`);
    setReviews(updated);
  };

  if (!biz) return <div className="max-w-5xl mx-auto px-4 py-20 text-center text-sm">Loading restaurant profile...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold">{biz.business_name}</h1>
              {biz.verification_status === "verified" && (
                <Badge variant="emerald">
                  <BadgeCheck className="w-3.5 h-3.5" /> Verified Business
                </Badge>
              )}
            </div>
            <Badge variant="outline">{biz.cuisine_type}</Badge>
          </div>
          <div className="flex flex-wrap gap-5 text-xs text-[#475569] dark:text-[#A7B8AE]">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-[#EA580C]" /> {biz.address}</span>
            <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-[#059669]" /> {biz.contact_info?.timings || "11:00 AM - 11:00 PM"}</span>
            <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {biz.contact_info?.phone || "+91 98765 43210"}</span>
          </div>
          <p className="text-xs text-[#475569]">FSSAI License: {biz.fssai_license_no}</p>
        </CardContent>
      </Card>

      {promos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {promos.map((p) => (
            <Card key={p.promotion_id} className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/30">
              <CardContent className="pt-5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-[#EA580C]" /> {p.title}
                  </p>
                  <p className="text-xs text-[#475569] mt-1">{p.description}</p>
                </div>
                <Badge variant="amber">{p.discount_percent}% OFF</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-[#9A3412]" /> Menu & Pricing
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {biz.menu_items?.length === 0 && <p className="text-sm text-[#475569]">Menu items coming soon.</p>}
          {biz.menu_items?.map((m: any) => (
            <div key={m.item_id} className="p-4 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] flex justify-between items-start">
              <div>
                <h3 className="font-bold text-sm">{m.name}</h3>
                <p className="text-xs text-[#475569] mt-0.5">{m.description}</p>
              </div>
              <span className="font-bold text-sm text-[#059669]">₹{m.price}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" /> Diner & Critic Reviews ({reviews.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user && (
            <form onSubmit={submitReview} className="space-y-3">
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="h-9 rounded-lg border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#0D1511] px-2 text-sm"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} Stars</option>
                ))}
              </select>
              <Textarea required value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Write your dining review..." />
              <Button type="submit" size="sm">Submit Review</Button>
            </form>
          )}
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.review_id} className="p-3.5 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="flex items-center gap-2">
                    {r.author_name}
                    {r.is_critic_review && <Badge variant="amber">Verified Critic</Badge>}
                  </span>
                  <span>{r.rating}/5</span>
                </div>
                <p className="text-sm">{r.review_text}</p>
                {r.owner_reply && (
                  <p className="text-xs bg-[#F5F0E6] dark:bg-[#1A2D24] p-2.5 rounded-lg">
                    <strong>Owner Reply:</strong> {r.owner_reply}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
