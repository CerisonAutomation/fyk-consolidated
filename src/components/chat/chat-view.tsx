"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Send, Sparkles, ShieldAlert, Pin, Pencil, Trash2,
  Mic, Timer, X, Smile, Search, Activity, TrendingUp, TrendingDown, MapPin,
} from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/lib/store";
import { useRealtimeChat } from "@/hooks/use-realtime-chat";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton, Spinner } from "@/components/ui/primitives";
import { cn, timeAgo } from "@/lib/utils";
import { MESSAGE_EMOJIS, EMOJI_TO_REACTION, REACTION_TO_EMOJI } from "@/lib/constants";
import type { Message, ConversationWithMeta } from "@/lib/types";
import { ShareLocationSheet } from "#/components/chat/ShareLocationSheet";
import { PickLocationSheet } from "#/components/chat/PickLocationSheet";
import { LiveLocationPreview } from "#/components/chat/LiveLocationPreview";

export function ChatView({
  conversationId, onBack,
}: { conversationId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const pushToast = useAppStore((s) => s.pushToast);
  const me = useAppStore((s) => s.user);
  const [input, setInput] = useState("");
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [aiPanel, setAiPanel] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState("");
  const [locationSheet, setLocationSheet] = useState<"share" | "pick" | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, number>>(new Map());
  const typingTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Realtime: subscribe to new messages + typing indicators ---
  const handleRealtimeMessage = useCallback(() => {
    // Any INSERT event in this conversation -- re-fetch messages
    qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }, [conversationId, qc]);

  const handleTyping = useCallback((userId: string, isTyping: boolean) => {
    if (userId === me?.id) return; // ignore own typing
    setTypingUsers((prev) => {
      const next = new Map(prev);
      if (isTyping) {
        next.set(userId, Date.now());
      } else {
        next.delete(userId);
      }
      return next;
    });
    // Auto-clear after 5 seconds in case the STOP event is missed
    if (isTyping) {
      const existing = typingTimeoutRef.current.get(userId);
      if (existing) clearTimeout(existing);
      const timeout = setTimeout(() => {
        setTypingUsers((p) => { const n = new Map(p); n.delete(userId); return n; });
        typingTimeoutRef.current.delete(userId);
      }, 5000);
      typingTimeoutRef.current.set(userId, timeout);
    }
  }, [me?.id]);

  const { sendTyping } = useRealtimeChat(conversationId, handleRealtimeMessage, handleTyping);

  // Broadcast typing indicator when user is typing
  const lastTypingBroadcast = useRef(0);
  function broadcastTypingState(isTyping: boolean) {
    if (!me?.id) return;
    const now = Date.now();
    // Throttle: broadcast at most once per 2 seconds
    if (isTyping && now - lastTypingBroadcast.current < 2000) return;
    lastTypingBroadcast.current = now;
    sendTyping(me.id, isTyping);
  }

  // Cleanup typing timeouts on unmount
  useEffect(() => {
    return () => {
      typingTimeoutRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const { data: convs } = useQuery({
    queryKey: ["conversations"],
    queryFn: () =>
      api<{ conversations: ConversationWithMeta[] }>("/api/conversations").then((r) => r.conversations),
  });
  const conv = convs?.find((c) => c.id === conversationId);

  const { data, isLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () =>
      api<{ messages: Message[] }>(`/api/conversations/${conversationId}/messages`).then((r) => r.messages),
    refetchInterval: 4000,
  });
  const messages = data ?? [];

  const { data: aiHealth } = useQuery({
    queryKey: ["chatHealth", conversationId],
    queryFn: () =>
      api<{
        health: number; trend: string; flags: string[]; suggestions: string[];
        churn: { risk: number; reason: string; intervention: string };
        otherName: string;
      }>("/api/ai", { method: "POST", body: { action: "chatHealth", conversationId } }),
    enabled: aiPanel,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: (payload: { content: string; ephemeral?: number }) =>
      api<{ moderation?: { verdict: string } }>(`/api/conversations/${conversationId}/messages`, {
        method: "POST", body: payload,
      }),
    onMutate: async (payload) => {
      // Cancel outgoing refetches so they don't overwrite the optimistic update
      await qc.cancelQueries({ queryKey: ["messages", conversationId] });

      // Snapshot the previous messages
      const previous = qc.getQueryData<Message[]>(["messages", conversationId]);

      // Optimistically add the new message
      if (previous && me?.id) {
        const optimistic: Message = {
          id: `optimistic-${Date.now()}`,
          conversation_id: conversationId,
          sender_id: me.id,
          type: "text",
          content: payload.content,
          is_edited: false,
          is_pinned: false,
          is_recalled: false,
          is_ephemeral: !!payload.ephemeral,
          ephemeral_expires_at: payload.ephemeral
            ? new Date(Date.now() + payload.ephemeral * 1000).toISOString()
            : undefined,
          created_at: new Date().toISOString(),
          reactions: [],
        };
        qc.setQueryData<Message[]>(["messages", conversationId], [...previous, optimistic]);
      }

      return { previous };
    },
    onError: (_err, _payload, context) => {
      // Roll back to the snapshot on error
      if (context?.previous) {
        qc.setQueryData(["messages", conversationId], context.previous);
      }
    },
    onSuccess: (res: { moderation?: { verdict: string } }) => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (res.moderation?.verdict === "ambiguous")
        pushToast("Heads up: that message reads as heated.", "info");
    },
  });

  const act = useMutation({
    mutationFn: ({ id, action, value }: { id: string; action: string; value?: string }) =>
      api(`/api/messages/${id}`, { method: "PATCH", body: { action, value } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const react = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const reactionName = EMOJI_TO_REACTION[emoji] ?? emoji;
      return api(`/api/messages/${messageId}/react`, { method: "POST", body: { emoji: reactionName } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", conversationId] }),
  });

  async function loadAI() {
    if (messages.length === 0) return;
    setAiLoading(true);
    try {
      const last = [...messages].reverse().find((m) => m.sender_id !== me?.id) ?? messages[messages.length - 1];
      const r = await api<{ replies: string[]; intent: { label: string } }>("/api/ai", {
        method: "POST", body: { action: "replies", message: last?.content ?? "" },
      });
      setAiSuggestions(r.replies);
      pushToast(`Intent detected: ${r.intent.label}`, "info");
    } catch { pushToast("AI unavailable", "error"); }
    finally { setAiLoading(false); }
  }

  function submit() {
    const content = input.trim();
    if (!content) return;
    setInput("");
    setAiSuggestions(null);
    send.mutate({ content });
  }

  if (isLoading || !conv) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-line pb-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1"><Skeleton className="mb-1.5 h-4 w-28" /><Skeleton className="h-3 w-20" /></div>
        </div>
        <div className="flex-1 space-y-3 py-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className={cn("h-16 rounded-2xl", i % 2 ? "ml-auto w-3/4" : "w-3/4")} />)}
        </div>
      </div>
    );
  }

  const other = conv.otherUser;
  const isGroup = conv.type === "group";
  const filtered = search.trim()
    ? messages.filter((m) => (m.content ?? "").toLowerCase().includes(search.toLowerCase()))
    : messages;
  const pinned = messages.filter((m) => m.is_pinned);

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-line pb-3">
        <button onClick={onBack} className="text-muted transition-colors hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={isGroup ? conv.name ?? "Group" : other?.pseudo ?? ""} photoUrl={isGroup ? null : other?.photos?.[0]} size={40} online={!isGroup && other?.online} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{isGroup ? conv.name : other?.pseudo}</p>
          <p className="text-xs text-muted">
            {typingUsers.size > 0 ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="flex gap-0.5">
                  <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-400 [animation-delay:0ms]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-400 [animation-delay:150ms]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-emerald-400 [animation-delay:300ms]" />
                </span>
                typing
              </span>
            ) : isGroup ? `${conv.memberCount} members` : other?.online ? (
              <span className="text-emerald-400">● Online</span>
            ) : "Offline"}
            {!isGroup && other?.verified && " · ✓ Verified"}
          </p>
        </div>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setAiPanel((s) => !s)}
            className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors", aiPanel ? "bg-gold/15 text-gold" : "text-muted hover:bg-white/5 hover:text-foreground")}
            title="Conversation AI"
          >
            <Activity className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowSearch((s) => !s)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* search bar */}
      {showSearch && (
        <div className="border-b border-line py-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            placeholder="Search this conversation…"
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
          />
          {search.trim() && (
            <p className="mt-1.5 px-1 text-[11px] text-muted">{filtered.length} matching messages</p>
          )}
        </div>
      )}

      {/* AI health panel */}
      {aiPanel && (
        <div className="border-b border-line bg-surface-2/60 p-3">
          {!aiHealth ? (
            <div className="flex justify-center py-3"><Spinner /></div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted">Conversation health</span>
                    <span className="font-semibold text-gold-soft">{aiHealth.health}/100</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={cn(
                      "h-full rounded-full",
                      aiHealth.health > 60 ? "bg-emerald-500" : aiHealth.health > 35 ? "bg-amber-500" : "bg-rose-500"
                    )} style={{ width: `${aiHealth.health}%` }} />
                  </div>
                </div>
                <span className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium",
                  aiHealth.trend === "improving" ? "bg-emerald-500/15 text-emerald-400" :
                  aiHealth.trend === "declining" ? "bg-rose-500/15 text-rose-400" : "bg-white/5 text-muted"
                )}>
                  {aiHealth.trend === "improving" ? <TrendingUp className="h-3 w-3" /> :
                   aiHealth.trend === "declining" ? <TrendingDown className="h-3 w-3" /> : null}
                  {aiHealth.trend}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted">Ghosting risk</span>
                    <span className="font-semibold text-rose-300">{aiHealth.churn.risk}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${aiHealth.churn.risk}%` }} />
                  </div>
                </div>
              </div>

              {aiHealth.flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {aiHealth.flags.map((f) => (
                    <span key={f} className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300">⚠ {f}</span>
                  ))}
                </div>
              )}
              {aiHealth.suggestions.length > 0 && (
                <div className="space-y-1">
                  {aiHealth.suggestions.map((s) => (
                    <p key={s} className="flex items-start gap-1.5 text-[11px] text-foreground/80">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-gold" /> {s}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* pinned banner */}
      {pinned.length > 0 && !showSearch && (
        <div className="flex items-start gap-2 border-b border-line bg-gold/[0.06] px-3 py-2">
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
          <p className="line-clamp-1 flex-1 text-[11px] text-foreground/85">
            {pinned[pinned.length - 1].content}
          </p>
          <button
            onClick={() => act.mutate({ id: pinned[pinned.length - 1].id, action: "unpin" })}
            className="text-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* messages */}
      <div className="flex-1 space-y-2 overflow-y-auto py-4 pr-1">
        {filtered.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted">
              {search.trim() ? "No matching messages" : "No messages yet. Break the ice 👋"}
            </p>
          </div>
        )}
        {filtered.map((m, idx) => {
          const isMe = m.sender_id === me?.id;
          const prev = filtered[idx - 1];
          const showHeader = !prev || prev.sender_id !== m.sender_id;
          const isEditing = editing === m.id;

          if (m.is_recalled) {
            return (
              <div key={m.id} className="flex justify-center">
                <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] italic text-muted">
                  Message recalled
                </span>
              </div>
            );
          }

          return (
            <div key={m.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
              {!isMe && isGroup && showHeader && (
                <p className="mb-0.5 w-full pl-10 text-[10px] text-gold/70">
                  {/* sender name resolved from conv members not available; show generic */}
                </p>
              )}
              <div className={cn("flex max-w-[80%] items-end gap-1.5", isMe && "flex-row-reverse")}>
                {!isMe && (
                  <div className="mb-1">
                    {showHeader && !isGroup && (
                      <Avatar name={other?.pseudo ?? ""} photoUrl={other?.photos?.[0]} size={26} />
                    )}
                  </div>
                )}

                <div className="group relative">
                  {isEditing ? (
                    <div className="rounded-2xl border border-gold/40 bg-surface p-2">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editText.trim()) {
                            act.mutate({ id: m.id, action: "edit", value: editText.trim() });
                            setEditing(null);
                          }
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="w-full rounded-lg bg-surface-2 px-2 py-1 text-sm text-foreground focus:outline-none"
                      />
                      <div className="mt-1.5 flex gap-1">
                        <button
                          onClick={() => { act.mutate({ id: m.id, action: "edit", value: editText.trim() }); setEditing(null); }}
                          className="rounded-md bg-gold px-2 py-0.5 text-[10px] font-semibold text-ink"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditing(null)} className="rounded-md px-2 py-0.5 text-[10px] text-muted">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "relative rounded-2xl px-3.5 py-2 text-sm",
                        isMe ? "rounded-br-sm bg-gold/90 text-ink" : "rounded-bl-sm bg-surface-2 text-foreground",
                        m.is_ephemeral && "border border-rose-400/40"
                      )}
                    >
                      {m.type === "voice" ? (
                        <div className="flex items-center gap-2 py-0.5">
                          <Mic className="h-4 w-4" />
                          <div className="flex items-end gap-0.5">
                            {[3, 8, 5, 12, 7, 14, 9, 4, 11, 6].map((h, i) => (
                              <span key={i} className="w-0.5 rounded-full bg-current opacity-60" style={{ height: h }} />
                            ))}
                          </div>
                          <span className="text-[10px] opacity-70">{m.media_duration ?? 12}s</span>
                        </div>
                      ) : m.type === "location" ? (
                        <LiveLocationPreview
                          lat={m.lat ?? 0}
                          lng={m.lon ?? 0}
                          isLive={!!m.live}
                          expiresAt={m.live?.expiresAt}
                        />
                      ) : (
                        m.content
                      )}

                      {m.is_ephemeral && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-[10px] opacity-70">
                          <Timer className="h-3 w-3" />
                        </span>
                      )}
                      {m.is_edited && <span className="ml-1 text-[10px] opacity-50">(edited)</span>}
                      {m.toxicity_score != null && m.toxicity_score < 0.7 && m.toxicity_score > 0.5 && (
                        <ShieldAlert className="ml-1 inline h-3 w-3 text-amber-500" />
                      )}

                      <div className={cn("mt-0.5 text-[10px]", isMe ? "text-ink/60" : "text-muted/60")}>
                        {timeAgo(m.created_at)}
                      </div>

                      {m.reactions && m.reactions.length > 0 && (
                        <div className="absolute -bottom-2.5 left-1 flex gap-0.5 rounded-full border border-line bg-surface px-1.5 py-0.5">
                          {m.reactions.map((r, i) => (
                            <span key={i} className="text-[11px]">{REACTION_TO_EMOJI[r.emoji as keyof typeof REACTION_TO_EMOJI] ?? r.emoji}</span>
                          ))}
                        </div>
                      )}

                      {/* hover actions */}
                      <div className={cn(
                        "absolute -top-3 hidden items-center gap-0.5 rounded-full border border-line bg-surface p-0.5 shadow-lg group-hover:flex",
                        isMe ? "right-0" : "left-0"
                      )}>
                        <button
                          onClick={() => setShowReactions(showReactions === m.id ? null : m.id)}
                          className="rounded-full p-1 text-[11px] hover:bg-white/10"
                        >
                          <Smile className="h-3.5 w-3.5 text-muted" />
                        </button>
                        {isMe && (
                          <>
                            <button onClick={() => { setEditing(m.id); setEditText(m.content ?? ""); }} className="rounded-full p-1 hover:bg-white/10">
                              <Pencil className="h-3 w-3 text-muted" />
                            </button>
                            <button onClick={() => act.mutate({ id: m.id, action: "recall" })} className="rounded-full p-1 hover:bg-white/10">
                              <Trash2 className="h-3 w-3 text-muted" />
                            </button>
                          </>
                        )}
                        <button onClick={() => act.mutate({ id: m.id, action: m.is_pinned ? "unpin" : "pin" })} className="rounded-full p-1 hover:bg-white/10">
                          <Pin className={cn("h-3 w-3", m.is_pinned ? "text-gold" : "text-muted")} />
                        </button>
                      </div>

                      {showReactions === m.id && (
                        <div className={cn(
                          "absolute -top-10 z-10 flex gap-0.5 rounded-full border border-line bg-surface p-1 shadow-xl",
                          isMe ? "right-0" : "left-0"
                        )}>
                          {MESSAGE_EMOJIS.map((e) => (
                            <button
                              key={e}
                              onClick={() => { react.mutate({ messageId: m.id, emoji: e }); setShowReactions(null); }}
                              className="rounded-full p-1 text-sm transition-transform hover:scale-125"
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* AI suggestions */}
      {aiLoading && (
        <div className="mb-2 space-y-1.5">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-8 rounded-xl" />)}
        </div>
      )}
      {aiSuggestions && !aiLoading && (
        <div className="mb-2 rounded-xl border border-gold/20 bg-gold/5 p-2">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-gold-soft">
            <Sparkles className="h-3 w-3" /> AI replies — tap to use
          </p>
          <div className="flex flex-wrap gap-1.5">
            {aiSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => { setInput(s); setAiSuggestions(null); inputRef.current?.focus(); }}
                className="rounded-full border border-gold/20 bg-white/5 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-white/10"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* input */}
      <div className="flex items-center gap-2 border-t border-line pt-3">
        <button
          onClick={loadAI}
          disabled={messages.length === 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gold transition-colors hover:bg-gold/10 disabled:opacity-40"
          title="AI replies"
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <button
          disabled
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors opacity-40 cursor-not-allowed"
          title="Voice recording coming soon"
        >
          <Mic className="h-4 w-4" />
        </button>
        <button
          onClick={() => setLocationSheet("share")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-foreground"
          title="Share location"
        >
          <MapPin className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            broadcastTypingState(e.target.value.length > 0);
          }}
          onBlur={() => broadcastTypingState(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              broadcastTypingState(false);
              submit();
            }
          }}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-line bg-surface-2 px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-gold/50 focus:outline-none"
        />
        <button
          onClick={() => send.mutate({ content: input.trim(), ephemeral: 60 })}
          disabled={!input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:text-rose-300 disabled:opacity-40"
          title="Send disappearing"
        >
          <Timer className="h-4 w-4" />
        </button>
        <button
          onClick={submit}
          disabled={!input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-ink transition-colors hover:bg-gold-soft disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Location sheets */}
      {locationSheet === "share" && (
        <ShareLocationSheet
          onShare={(lat, lng) => {
            send.mutate({ content: JSON.stringify({ type: "Location", lat, lon: lng }) });
            setLocationSheet(null);
          }}
          onClose={() => setLocationSheet(null)}
        />
      )}
      {locationSheet === "pick" && (
        <PickLocationSheet
          onShare={(lat, lng, label) => {
            send.mutate({ content: JSON.stringify({ type: "Location", lat, lon: lng, label }) });
            setLocationSheet(null);
          }}
          onClose={() => setLocationSheet(null)}
        />
      )}
    </div>
  );
}
