import { getSupabase, ok, toFailure, type Result } from "./client";
import type { BoardComment, BoardPost, PostJoin, PostKind, Profile } from "./types";

export type BoardAuthor = Pick<Profile, "id" | "display_name" | "handle" | "avatar_url" | "age" | "city" | "area">;

export type BoardCommentView = BoardComment & { author: BoardAuthor | null };

export type BoardPostView = BoardPost & {
  author: BoardAuthor | null;
  comments: BoardCommentView[];
  joined_by_me: boolean;
};

export type CreateBoardPostInput = {
  kind: Exclude<PostKind, "photo">;
  body: string;
  activityId?: string;
  city?: string;
  area?: string;
  spots?: number;
  expiresInHours: number;
};

const POST_COLUMNS =
  "id,author_id,kind,body,activity_id,storage_path,city,area,spots,join_count,expires_at,created_at";
const COMMENT_COLUMNS = "id,post_id,author_id,body,created_at";
const AUTHOR_COLUMNS = "id,display_name,handle,avatar_url,age,city,area";

export async function loadBoard(userId: string): Promise<Result<BoardPostView[]>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const postsResult = await client
    .from("board_posts")
    .select(POST_COLUMNS)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(60);

  if (postsResult.error) return toFailure(postsResult.error);
  const posts = postsResult.data ?? [];
  if (posts.length === 0) return ok([]);

  const postIds = posts.map((post) => post.id);
  const authorIds = [...new Set(posts.map((post) => post.author_id))];

  const [commentsResult, joinsResult, authorsResult] = await Promise.all([
    client.from("board_comments").select(COMMENT_COLUMNS).in("post_id", postIds).order("created_at"),
    client.from("post_joins").select("post_id,profile_id,created_at").eq("profile_id", userId).in("post_id", postIds),
    client.from("profiles").select(AUTHOR_COLUMNS).in("id", authorIds),
  ]);

  if (commentsResult.error) return toFailure(commentsResult.error);
  if (joinsResult.error) return toFailure(joinsResult.error);
  if (authorsResult.error) return toFailure(authorsResult.error);

  const comments = commentsResult.data ?? [];
  const joins = joinsResult.data ?? [];
  const authors = authorsResult.data ?? [];

  const commentAuthorIds = [...new Set(comments.map((comment) => comment.author_id))].filter(
    (id) => !authorIds.includes(id),
  );
  let commentAuthors: BoardAuthor[] = [];
  if (commentAuthorIds.length > 0) {
    const result = await client.from("profiles").select(AUTHOR_COLUMNS).in("id", commentAuthorIds);
    if (result.error) return toFailure(result.error);
    commentAuthors = result.data ?? [];
  }

  const authorMap = new Map<string, BoardAuthor>(
    [...authors, ...commentAuthors].map((author) => [author.id, author]),
  );

  return ok(
    posts.map((post) => {
      return {
        ...post,
        author: authorMap.get(post.author_id) ?? null,
        comments: comments
          .filter((comment) => comment.post_id === post.id)
          .map((comment) => ({ ...comment, author: authorMap.get(comment.author_id) ?? null })),
        joined_by_me: joins.some((join) => join.post_id === post.id),
      };
    }),
  );
}

export async function createBoardPost(
  userId: string,
  input: CreateBoardPostInput,
): Promise<Result<BoardPost>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const hours = Math.max(1, Math.min(48, Math.floor(input.expiresInHours)));
  const body = input.body.trim();
  if (!body || body.length > 400) {
    return { ok: false, code: "validation", message: "Posts must contain 1–400 characters." };
  }

  const result = await client
    .from("board_posts")
    .insert({
      author_id: userId,
      kind: input.kind,
      body,
      activity_id: input.activityId ?? null,
      storage_path: null,
      city: input.city?.trim() || null,
      area: input.area?.trim() || null,
      spots: input.spots && input.spots > 0 ? Math.min(50, Math.floor(input.spots)) : null,
      expires_at: new Date(Date.now() + hours * 3_600_000).toISOString(),
    })
    .select(POST_COLUMNS)
    .single();

  return result.error ? toFailure(result.error) : ok(result.data);
}

export async function deleteBoardPost(postId: string, userId: string): Promise<Result<null>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const result = await client.from("board_posts").delete().eq("id", postId).eq("author_id", userId);
  return result.error ? toFailure(result.error) : ok(null);
}

export async function addBoardComment(
  postId: string,
  userId: string,
  body: string,
): Promise<Result<BoardComment>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));
  const text = body.trim();
  if (!text || text.length > 500) {
    return { ok: false, code: "validation", message: "Comments must contain 1–500 characters." };
  }

  const result = await client
    .from("board_comments")
    .insert({ post_id: postId, author_id: userId, body: text })
    .select(COMMENT_COLUMNS)
    .single();
  return result.error ? toFailure(result.error) : ok(result.data);
}

export async function setBoardJoin(
  postId: string,
  userId: string,
  joined: boolean,
): Promise<Result<null>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const result = joined
    ? await client.from("post_joins").upsert({ post_id: postId, profile_id: userId })
    : await client.from("post_joins").delete().eq("post_id", postId).eq("profile_id", userId);

  return result.error ? toFailure(result.error) : ok(null);
}

// Keeps the imported row type checked against the table even when the query
// result has no rows in a fresh project.
void ({} as PostJoin);