"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Clock, User, Sparkles, ArrowRight, Tag } from "lucide-react";

export default function BlogsPage() {
  const blogs = [
    {
      id: "1",
      title: "The Alchemy of Slow Dum Cooking: Science Behind the Sealed Handi",
      excerpt: "Discover why dough-sealed cooking traps 94% of volatile organic aromatics and how gentle steam pressure tenderizes spices.",
      author: "Pandurang Kulkarni",
      role: "Culinary Historian",
      readTime: "6 min read",
      category: "Culinary Science",
      date: "Nov 24, 2026",
      cover: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: "2",
      title: "Ancient Grains Revival: How Millets Are Transforming Modern Gastronomy",
      excerpt: "From Ragi sourdough to Foxtail risotto, chefs across Mumbai and Bangalore are redefining sustainable, low-glycemic indulgence.",
      author: "Dr. Anita Roy",
      role: "Clinical Nutritionist",
      readTime: "8 min read",
      category: "Nutrition & Health",
      date: "Nov 22, 2026",
      cover: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: "3",
      title: "Demystifying Bayesian Food Critic Rankings: Why Raw Averages Lie",
      excerpt: "Why EpiCho uses Dirichlet-multinomial Bayesian scoring with exposure-ratio penalties to unearth true neighborhood Hidden Gems.",
      author: "EpiCho Engineering",
      role: "Platform Tech",
      readTime: "5 min read",
      category: "Platform Tech",
      date: "Nov 20, 2026",
      cover: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full inline-block mb-3">
          The EpiCho Culinary Gazette
        </span>
        <h1 className="text-4xl font-black text-stone-900 font-serif tracking-tight">
          Food Stories, Science & Heritage
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Deep-dives into cooking techniques, clinical nutrition research, regional heritage stories, and platform tech.
        </p>
      </div>

      {/* Featured Blog */}
      <div className="bg-white rounded-3xl border border-border overflow-hidden shadow-sm hover:shadow-md transition mb-12 grid grid-cols-1 md:grid-cols-2">
        <div className="relative aspect-video md:aspect-auto h-full min-h-[300px]">
          <img
            src={blogs[0].cover}
            alt={blogs[0].title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 left-4">
            <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
              Featured Story
            </span>
          </div>
        </div>
        <div className="p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
              <span className="font-semibold text-primary">{blogs[0].category}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {blogs[0].readTime}</span>
              <span>•</span>
              <span>{blogs[0].date}</span>
            </div>
            <h2 className="text-2xl font-black text-stone-900 font-serif mb-3 leading-snug">
              {blogs[0].title}
            </h2>
            <p className="text-stone-600 text-sm leading-relaxed mb-6">
              {blogs[0].excerpt}
            </p>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs">
                PK
              </div>
              <div>
                <span className="text-xs font-bold text-stone-900 block">{blogs[0].author}</span>
                <span className="text-[11px] text-muted-foreground">{blogs[0].role}</span>
              </div>
            </div>
            <button
              onClick={() => alert(`Reading: ${blogs[0].title}`)}
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
            >
              Read Article <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Blog Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {blogs.slice(1).map((blog) => (
          <div key={blog.id} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm hover:border-primary/50 transition flex flex-col justify-between">
            <div className="relative aspect-video">
              <img
                src={blog.cover}
                alt={blog.title}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-stone-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {blog.category}
              </span>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span>{blog.date}</span>
                  <span>•</span>
                  <span>{blog.readTime}</span>
                </div>
                <h3 className="text-lg font-bold text-stone-900 font-serif mb-2 leading-snug">
                  {blog.title}
                </h3>
                <p className="text-xs text-stone-600 line-clamp-3 mb-4 leading-relaxed">
                  {blog.excerpt}
                </p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs font-semibold text-stone-700">By {blog.author}</span>
                <button
                  onClick={() => alert(`Reading: ${blog.title}`)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Read More →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
