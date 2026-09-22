import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed } from "@/lib/api-helpers";
import { json, withSecurity } from "@/middleware";

/**
 * Blog & FAQ — 8.2
 * Server-managed content sections: listing pages and individual article/FAQ load.
 */

const BLOG_POSTS = [
  {
    id: "1",
    slug: "welcome-to-fyk",
    title: "Welcome to Find Your King",
    excerpt: "Premium LGBTQ+ dating platform with AI-powered matching",
    body: "FYK is built for authentic connections...",
    category: "announcement",
    author: "FYK Team",
    publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    readTime: 3,
  },
  {
    id: "2",
    slug: "safety-tips",
    title: "Safety Tips for Meeting IRL",
    excerpt: "How to stay safe when meeting someone from the app",
    body: "Always meet in public, share your location with a trusted contact...",
    category: "safety",
    author: "Safety Team",
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    readTime: 5,
  },
  {
    id: "3",
    slug: "ai-features",
    title: "How AI Enhances Your Dating Experience",
    excerpt: "From smart replies to date planning, AI helps you connect",
    body: "Our AI features are designed to assist, not replace...",
    category: "features",
    author: "Product Team",
    publishedAt: new Date().toISOString(),
    readTime: 4,
  },
];

const FAQS = [
  { id: "1", question: "Is FYK free?", answer: "FYK offers free tier with 50 taps/day. Premium unlocks unlimited.", category: "billing" },
  { id: "2", question: "How does verification work?", answer: "Take a selfie matching a pose challenge. Admin reviews within 24h.", category: "verification" },
  { id: "3", question: "How to stay safe?", answer: "Use our Safety Center, share location with emergency contacts, and use check-in feature.", category: "safety" },
  { id: "4", question: "What is Boost?", answer: "Boost puts you at top of nearby grid for 60 minutes.", category: "features" },
];

export const Route = createFileRoute("/api/blog/")({
  server: {
    handlers: {
      POST: methodNotAllowed("GET"),
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),

      GET: withSecurity(
        async ({ request }) => {
          const url = new URL(request.url);
          const type = url.searchParams.get("type") ?? "posts"; // posts, faqs, single
          const slug = url.searchParams.get("slug");
          const category = url.searchParams.get("category");

          if (type === "faqs") {
            const filtered = category ? FAQS.filter((f) => f.category === category) : FAQS;
            return json({ faqs: filtered, count: filtered.length });
          }

          if (type === "single" && slug) {
            const post = BLOG_POSTS.find((p) => p.slug === slug || p.id === slug);
            if (!post) return json({ error: "Post not found" }, { status: 404 });
            return json({ post });
          }

          // Default: posts listing
          const filtered = category ? BLOG_POSTS.filter((p) => p.category === category) : BLOG_POSTS;
          return json({
            posts: filtered,
            count: filtered.length,
            categories: [...new Set(BLOG_POSTS.map((p) => p.category))],
          });
        },
        { auth: "optional", rateLimit: { limit: 60, key: ({ ip }) => `blog:${ip}` } },
      ),
    },
  },
});
