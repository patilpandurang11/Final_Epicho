"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PostData = {
  post_id: string;
  author_id: string;
  author_name: string;
  author_username?: string | null;
  author_avatar?: string | null;
  caption?: string | null;
  dish_name?: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  has_liked: boolean;
  has_saved: boolean;
  media: { media_url: string; media_type: "image" | "video" }[];
};

type CommentData = {
  comment_id: string;
  parent_comment_id?: string | null;
  author_name?: string | null;
  content: string;
};

type SavedCollectionSummary = {
  collection_id: string;
  name: string;
};

type CollectionItemSummary = {
  item_id: string;
  post_id?: string | null;
};

export default function PostDetailPage() {
  const params = useParams();
  const postId = params?.postId as string;
  const { user } = useAuth();
  const [post, setPost] = useState<PostData | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [collections, setCollections] = useState<SavedCollectionSummary[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [collectionItemId, setCollectionItemId] = useState<string | null>(null);
  const [collectionItemLoading, setCollectionItemLoading] = useState(false);

  useEffect(() => {
    if (!postId) return;
    Promise.all([
      apiRequest<PostData>(`/posts/${postId}`),
      apiRequest<CommentData[]>(`/posts/${postId}/comments`),
    ])
      .then(([postData, commentData]) => {
        setPost(postData);
        setComments(commentData);
      })
      .catch((requestError: Error) => setError(requestError.message));
  }, [postId]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    apiRequest<SavedCollectionSummary[]>("/posts/collections")
      .then((result) => {
        if (active) setCollections(result);
      })
      .catch((requestError: Error) => {
        if (active) {
          setFeedback(requestError.message);
          setFeedbackError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const currentPostId = post?.post_id;
  useEffect(() => {
    if (!collectionId || !currentPostId || !user) return;
    let active = true;
    apiRequest<CollectionItemSummary[]>(`/posts/collections/${collectionId}/items`)
      .then((items) => {
        if (!active) return;
        const savedItem = items.find((item) => item.post_id === currentPostId);
        setCollectionItemId(savedItem?.item_id ?? null);
      })
      .catch((requestError: Error) => {
        if (active) {
          setFeedback(requestError.message);
          setFeedbackError(true);
        }
      })
      .finally(() => {
        if (active) setCollectionItemLoading(false);
      });
    return () => {
      active = false;
    };
  }, [collectionId, currentPostId, user]);

  const toggleLike = async () => {
    if (!post) return;
    try {
      const result = await apiRequest<{ liked: boolean; likes_count: number }>(
        `/posts/${post.post_id}/like`,
        { method: "POST" },
      );
      setPost({ ...post, has_liked: result.liked, likes_count: result.likes_count });
      setFeedbackError(false);
    } catch (requestError) {
      setFeedback((requestError as Error).message);
      setFeedbackError(true);
    }
  };

  const toggleCollectionItem = async () => {
    if (!post) return;
    setFeedback(null);
    setFeedbackError(false);
    try {
      if (collectionItemId) {
        await apiRequest(
          `/posts/collections/${collectionId}/items/${collectionItemId}`,
          { method: "DELETE" },
        );
        setCollectionItemId(null);
        setFeedback("Post removed from the collection.");
        return;
      }
      const result = await apiRequest<{ item_id: string; already_saved: boolean }>(
        `/posts/collections/${collectionId}/items`,
        {
          method: "POST",
          body: JSON.stringify({ post_id: post.post_id }),
        },
      );
      setCollectionItemId(result.item_id);
      setFeedback(
        result.already_saved
          ? "This post is already in the selected collection."
          : "Post added to the collection.",
      );
    } catch (requestError) {
      setFeedback((requestError as Error).message);
      setFeedbackError(true);
    }
  };

  const toggleSave = async () => {
    if (!post) return;
    try {
      await apiRequest(`/posts/${post.post_id}/save`, {
        method: post.has_saved ? "DELETE" : "POST",
      });
      setPost({ ...post, has_saved: !post.has_saved });
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!post || !commentText.trim()) return;
    try {
      const comment = await apiRequest<CommentData>(`/posts/${post.post_id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: commentText.trim() }),
      });
      setComments((items) => [...items, comment]);
      setCommentText("");
      setPost({ ...post, comments_count: post.comments_count + 1 });
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  const share = async () => {
    if (!post) return;
    try {
      const result = await apiRequest<{ share_url: string; shares_count: number }>(`/posts/${post.post_id}/share`, {
        method: "POST",
      });
      const url = new URL(result.share_url, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      setPost({ ...post, shares_count: result.shares_count });
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  };

  if (error) return <p role="alert" className="mx-auto max-w-3xl px-4 py-12 text-center text-red-700">{error}</p>;
  if (!post) return <p className="mx-auto max-w-3xl px-4 py-12 text-center">Loading post...</p>;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-10">
      <Card>
        <CardContent className="space-y-4 pt-5">
          <Link
            href={`/profile/${post.author_username || post.author_id}`}
            className="font-semibold hover:underline"
          >
            {post.author_name}
          </Link>
          {post.media.map((item, index) => item.media_type === "video" ? (
            <video key={`${item.media_url}-${index}`} src={item.media_url} controls className="max-h-[70vh] w-full rounded-xl object-contain" />
          ) : (
            <img key={`${item.media_url}-${index}`} src={item.media_url} alt={post.dish_name || "Community food post"} className="max-h-[70vh] w-full rounded-xl object-contain" />
          ))}
          {post.dish_name && <h1 className="text-xl font-bold">{post.dish_name}</h1>}
          {post.caption && <p className="whitespace-pre-wrap">{post.caption}</p>}
          <div className="flex items-center gap-4">
            <Button type="button" variant="outline" onClick={toggleLike} aria-label="Like post">
              <Heart className={post.has_liked ? "fill-red-600 text-red-600" : ""} /> {post.likes_count}
            </Button>
            <span className="inline-flex items-center gap-1 text-sm"><MessageCircle className="h-4 w-4" /> {post.comments_count}</span>
            <Button type="button" variant="outline" onClick={toggleSave} aria-label={post.has_saved ? "Unsave post" : "Save post"}>
              <Bookmark className={post.has_saved ? "fill-emerald-700 text-emerald-700" : ""} />
            </Button>
            <Button type="button" variant="outline" onClick={share} aria-label="Share post">
              <Share2 /> {post.shares_count}
            </Button>
          </div>
          {user && (
            <div className="space-y-2 rounded-xl border border-stone-200 p-3">
              <label htmlFor="post-collection" className="text-xs font-bold">Save to collection</label>
              <div className="flex flex-wrap gap-2">
                <select
                  id="post-collection"
                  aria-label="Select collection"
                  value={collectionId}
                  onChange={(event) => {
                    const selectedId = event.target.value;
                    setCollectionId(selectedId);
                    setCollectionItemId(null);
                    setCollectionItemLoading(Boolean(selectedId));
                    setFeedback(null);
                    setFeedbackError(false);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select a collection</option>
                  {collections.map((collection) => (
                    <option key={collection.collection_id} value={collection.collection_id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!collectionId || collectionItemLoading}
                  onClick={toggleCollectionItem}
                >
                  {collectionItemLoading ? "Checking..." : collectionItemId ? "Remove from collection" : "Add to collection"}
                </Button>
              </div>
              {collections.length === 0 && <p className="text-xs text-stone-600">Create a collection from your profile first.</p>}
              {feedback && (
                <p
                  role={feedbackError ? "alert" : "status"}
                  className={`text-xs ${feedbackError ? "text-red-700" : "text-emerald-800"}`}
                >
                  {feedback}
                </p>
              )}
            </div>
          )}
          {feedback && !user && <p role="status" className="text-sm text-emerald-800">{feedback}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <h2 className="font-bold">Comments</h2>
          {comments.map((comment) => (
            <div key={comment.comment_id} className={comment.parent_comment_id ? "ml-5 border-l pl-3" : ""}>
              <p className="text-xs font-semibold">{comment.author_name || "Community member"}</p>
              <p className="text-sm">{comment.content}</p>
            </div>
          ))}
          {user && (
            <form onSubmit={addComment} className="flex gap-2">
              <input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                maxLength={2000}
                aria-label="Write a comment"
                placeholder="Add a comment..."
                className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
              <Button type="submit" disabled={!commentText.trim()}>Comment</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
