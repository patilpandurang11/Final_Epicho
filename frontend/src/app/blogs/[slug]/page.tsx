"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Calendar } from "lucide-react";

export default function BlogDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [blog, setBlog] = useState<any>(null);

  useEffect(() => {
    if (!slug) return;
    apiRequest(`/blogs/${encodeURIComponent(slug)}`).then(setBlog).catch(() => {});
  }, [slug]);

  if (!blog) return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-sm">Loading article...</div>;

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <Link href="/blogs" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#059669] hover:underline">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Culinary Blogs
      </Link>
      <div className="space-y-3">
        <Badge variant="emerald">
          <BookOpen className="w-3 h-3" /> {blog.category}
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{blog.title}</h1>
        <div className="flex items-center gap-4 text-xs text-[#475569] dark:text-[#A7B8AE]">
          <span>By {blog.author_name}</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> {new Date(blog.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {blog.cover_image_url && (
        <img src={blog.cover_image_url} alt={blog.title} className="w-full h-72 object-cover rounded-3xl" />
      )}

      <Card>
        <CardContent className="pt-6 prose dark:prose-invert max-w-none whitespace-pre-line text-sm leading-7">
          {blog.content_markdown}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {blog.tags?.map((t: string) => (
          <Badge key={t} variant="outline">#{t}</Badge>
        ))}
      </div>
    </article>
  );
}
