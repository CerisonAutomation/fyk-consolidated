"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings as SettingsIcon, Bell, Palette, Shield, Crown, Check,
  Sparkles, Globe, Smartphone, Ban,
  Accessibility, Download, Trash2, ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { getSupabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { LANGUAGES } from "@/lib/constants";
import { Button } from "@/components/ui/primitives";
import { useRouter } from "next/navigation";

function Toggle({ label, description, value, onChange }: {
  label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!value)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-[11px] text-muted">{description}</p>}
      </div>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", value ? "bg-gold" : "bg-white/10")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", value ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

const ACCENTS = [
  { id: "gold", label: "Gold", color: "#D4AF37" },
  { id: "blue", label: "Blue", color: "#3B82F6" },
  { id: "green", label: "Emerald", color: "#10B981" },
  { id: "purple", label: "Violet", color: "#8B5CF6" },
  { id: "red", label: "Rose", color: "#F43F5E" },
];

const FONT_SIZES = [
  { id: "small", label: "Small", cls: "text-xs" },
  { id: "medium", label: "Medium", cls: "text-sm" },
  { id: "large", label: "Large", cls: "text-base" },
  { id: "xl", label: "XL", cls: "text-lg" },
];

const COLORBLIND = [
  { id: "off", label: "Off" },
  { id: "protanopia", label: "Protanopia" },
  { id: "deuteranopia", label: "Deuteranopia" },
  { id: "tritanopia", label: "Tritanopia" },
];

export function SettingsClient() {
  const me = useAppStore((s) => s.user);
  const pushToast = useAppStore((s) => s.pushToast);
  const router = useRouter();
  const [open, setOpen] = useState<string | null>("account");
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [prefs, setPrefs] = useState({
    pushNotifications: true, matchNotifications: true, messageNotifications: true,
    eventNotifications: true, aiSuggestions: true, smartNotifications: true,
    aiTranslation: true, aiModeration: true, aiMemory: true, autoReply: false,
    showOnlineStatus: true, readReceipts: true, incognito: false,
    discreetMode: false, offlineMode: true, voiceCommands: false, reduceMotion: false,
  });
  const [accent, setAccent] = useState("gold");
  const [fontSize, setFontSize] = useState("medium");
  const [language, setLanguage] = useState("English");
  const [colorblind, setColorblind] = useState("off");
  const [dnd, setDnd] = useState("off");

  // ── Load preferences from Supabase on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = getSupabase();
      if (!supabase) { setLoadingPrefs(false); return; }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || cancelled) { setLoadingPrefs(false); return; }

      const { data, error } = await supabase
        .from("users")
        .select("notif_prefs, ai_prefs, accent, font_size, language, colorblind_mode, dnd_mode, theme, incognito, hide_distance, hide_online, hide_online")
        .eq("id", authUser.id)
        .single();

      if (error || !data || cancelled) { setLoadingPrefs(false); return; }

      // Merge stored notif_prefs
      const storedNotifs = (data.notif_prefs as Record<string, boolean>) ?? {};
      const storedAi = (data.ai_prefs as Record<string, boolean>) ?? {};

      setPrefs({
        pushNotifications: storedNotifs.pushNotifications ?? true,
        matchNotifications: storedNotifs.matchNotifications ?? true,
        messageNotifications: storedNotifs.messageNotifications ?? true,
        eventNotifications: storedNotifs.eventNotifications ?? true,
        smartNotifications: storedNotifs.smartNotifications ?? true,
        aiSuggestions: storedAi.aiSuggestions ?? true,
        aiTranslation: storedAi.aiTranslation ?? true,
        aiModeration: storedAi.aiModeration ?? true,
        aiMemory: storedAi.aiMemory ?? true,
        autoReply: storedAi.autoReply ?? false,
        showOnlineStatus: !data.hide_online,
        readReceipts: storedNotifs.readReceipts ?? true,
        incognito: data.incognito ?? false,
        discreetMode: storedNotifs.discreetMode ?? false,
        offlineMode: storedNotifs.offlineMode ?? true,
        voiceCommands: storedNotifs.voiceCommands ?? false,
        reduceMotion: storedNotifs.reduceMotion ?? false,
      });

      if (data.accent) setAccent(data.accent);
      if (data.font_size) setFontSize(String(data.font_size));
      if (data.language) setLanguage(data.language);
      if (data.colorblind_mode) setColorblind(data.colorblind_mode === true ? "off" : data.colorblind_mode ?? "off");
      if (data.dnd_mode) setDnd("always");
      setLoadingPrefs(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Persist helper: writes a partial update to the users table ────────────
  const persistUpdate = useCallback(async (patch: Record<string, unknown>) => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { error } = await supabase
      .from("users")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", authUser.id);

    if (error) {
      pushToast(`Save failed: ${error.message}`, "error");
    }
  }, [pushToast]);

  // ── Toggle a preference, persist to Supabase ──────────────────────────────
  const flip = useCallback(async (key: keyof typeof prefs) => {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    pushToast(`${key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())} ${next ? "on" : "off"}`, "info");

    if (key === "incognito" && next && me?.tier === "free") {
      pushToast("Incognito requires Gold — upgrade in Premium.", "info");
      return;
    }

    // Build the patch depending on which category this key belongs to
    if (key === "incognito") {
      await persistUpdate({ incognito: next });
    } else if (key === "showOnlineStatus") {
      await persistUpdate({ hide_online: !next });
    } else {
      // Determine which JSON column to update
      const notifKeys = ["pushNotifications", "matchNotifications", "messageNotifications",
        "eventNotifications", "smartNotifications", "readReceipts", "discreetMode",
        "offlineMode", "voiceCommands", "reduceMotion"];
      const aiKeys = ["aiSuggestions", "aiTranslation", "aiModeration", "aiMemory", "autoReply"];

      const updatedPrefs = { ...prefs, [key]: next };

      if (notifKeys.includes(key)) {
        await persistUpdate({
          notif_prefs: {
            pushNotifications: updatedPrefs.pushNotifications,
            matchNotifications: updatedPrefs.matchNotifications,
            messageNotifications: updatedPrefs.messageNotifications,
            eventNotifications: updatedPrefs.eventNotifications,
            smartNotifications: updatedPrefs.smartNotifications,
            readReceipts: updatedPrefs.readReceipts,
            discreetMode: updatedPrefs.discreetMode,
            offlineMode: updatedPrefs.offlineMode,
            voiceCommands: updatedPrefs.voiceCommands,
            reduceMotion: updatedPrefs.reduceMotion,
          },
        });
      } else if (aiKeys.includes(key)) {
        await persistUpdate({
          ai_prefs: {
            aiSuggestions: updatedPrefs.aiSuggestions,
            aiTranslation: updatedPrefs.aiTranslation,
            aiModeration: updatedPrefs.aiModeration,
            aiMemory: updatedPrefs.aiMemory,
            autoReply: updatedPrefs.autoReply,
          },
        });
      }
    }
  }, [prefs, me, pushToast, persistUpdate]);

  // ── Appearance handlers ───────────────────────────────────────────────────
  const handleAccent = useCallback((id: string) => {
    setAccent(id);
    persistUpdate({ accent: id });
    pushToast(`Accent: ${ACCENTS.find((a) => a.id === id)?.label ?? id}`, "info");
  }, [persistUpdate, pushToast]);

  const handleFontSize = useCallback((id: string) => {
    setFontSize(id);
    const sizeMap: Record<string, number> = { small: 12, medium: 14, large: 16, xl: 18 };
    persistUpdate({ font_size: sizeMap[id] ?? 14 });
    pushToast(`Font: ${FONT_SIZES.find((f) => f.id === id)?.label ?? id}`, "info");
  }, [persistUpdate, pushToast]);

  const handleColorblind = useCallback((id: string) => {
    setColorblind(id);
    persistUpdate({ colorblind_mode: id === "off" ? false : id });
    pushToast(`Colour-blind: ${COLORBLIND.find((c) => c.id === id)?.label ?? id}`, "info");
  }, [persistUpdate, pushToast]);

  const handleDnd = useCallback((mode: string) => {
    setDnd(mode);
    persistUpdate({ dnd_mode: mode !== "off" });
    pushToast(`DND: ${mode}`, "info");
  }, [persistUpdate, pushToast]);

  const handleLanguage = useCallback((lang: string) => {
    setLanguage(lang);
    persistUpdate({ language: lang });
    pushToast(`Language: ${lang}`, "info");
  }, [persistUpdate, pushToast]);

  // ── Account deletion ──────────────────────────────────────────────────────
  const handleDeleteAccount = useCallback(async () => {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;

    setDeleting(true);
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Supabase is not configured");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");

      // Delete user data from the users table
      const { error: deleteError } = await supabase
        .from("users")
        .delete()
        .eq("id", authUser.id);

      if (deleteError) throw deleteError;

      // Sign out the user
      await supabase.auth.signOut();

      pushToast("Account deleted. We're sorry to see you go.");
      router.push("/");
    } catch (err) {
      pushToast(`Deletion failed: ${(err as Error).message}. Contact support for help.`, "error");
    } finally {
      setDeleting(false);
    }
  }, [pushToast, router]);

  const SECTIONS: {
    id: string; title: string; icon: typeof Bell; items: {
      key?: keyof typeof prefs; label: string; desc?: string;
      custom?: "accent" | "fontSize" | "language" | "colorblind" | "dnd" | "account";
    }[];
  }[] = [
    {
      id: "account", title: "Account", icon: Crown,
      items: [
        { label: "Email", custom: "account" },
        { label: "Membership tier", custom: "account" },
      ],
    },
    {
      id: "ai", title: "AI Features", icon: Sparkles,
      items: [
        { key: "aiSuggestions", label: "Reply suggestions", desc: "Intent-based replies in chat" },
        { key: "aiTranslation", label: "Auto-translation", desc: "Translate messages to your language" },
        { key: "aiModeration", label: "Safety moderation", desc: "Auto-flag harassment, NSFW and scams" },
        { key: "aiMemory", label: "Conversation memory", desc: "AI remembers context across chats" },
        { key: "autoReply", label: "Auto-reply", desc: "AI replies when you're away (Gold)" },
      ],
    },
    {
      id: "notifications", title: "Notifications", icon: Bell,
      items: [
        { key: "pushNotifications", label: "Push notifications" },
        { key: "matchNotifications", label: "New matches & taps" },
        { key: "messageNotifications", label: "Messages" },
        { key: "eventNotifications", label: "Event reminders" },
        { key: "smartNotifications", label: "Smart timing", desc: "Deliver at moments you actually reply" },
        { label: "Do Not Disturb", custom: "dnd" },
      ],
    },
    {
      id: "appearance", title: "Appearance", icon: Palette,
      items: [
        { label: "Accent colour", custom: "accent" },
        { label: "Font size", custom: "fontSize" },
        { label: "Colour-blind mode", custom: "colorblind" },
        { key: "reduceMotion", label: "Reduce motion", desc: "Minimise animations" },
      ],
    },
    {
      id: "privacy", title: "Privacy", icon: Shield,
      items: [
        { key: "showOnlineStatus", label: "Show online status" },
        { key: "readReceipts", label: "Read receipts" },
        { key: "incognito", label: "Incognito mode", desc: "Browse without being seen (Gold)" },
        { key: "discreetMode", label: "Discreet app icon", desc: "Neutral icon and name on home screen" },
      ],
    },
    {
      id: "language", title: "Language & Region", icon: Globe,
      items: [{ label: "App language", custom: "language" }],
    },
    {
      id: "accessibility", title: "Accessibility", icon: Accessibility,
      items: [
        { key: "voiceCommands", label: "Voice control", desc: "Navigate and compose by voice" },
        { key: "reduceMotion", label: "Reduce motion" },
      ],
    },
    {
      id: "platform", title: "Platform", icon: Smartphone,
      items: [
        { key: "offlineMode", label: "Offline mode", desc: "Queue actions when connection drops" },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2">
        <SettingsIcon className="h-5 w-5 text-gold" />
        <h1 className="text-xl font-bold text-white">Settings</h1>
      </div>
      <p className="mb-5 text-sm text-muted">Every preference, in one place.</p>

      {/* membership banner */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/12 to-transparent p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold text-ink">
          <Crown className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold capitalize text-white">{me?.tier ?? "free"} membership</h2>
          <p className="text-[11px] text-muted">
            {me?.tier === "free" ? "Upgrade for unlimited taps, incognito and all 48 AI features." : "Thanks for supporting FYK"}
          </p>
        </div>
        <Button size="sm" onClick={() => router.push("/premium")}>
          {me?.tier === "free" ? "Upgrade" : "Manage"}
        </Button>
      </div>

      {loadingPrefs && (
        <div className="mb-4 rounded-2xl border border-line bg-surface p-4 text-center text-xs text-muted">
          Loading preferences…
        </div>
      )}

      <div className="space-y-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const isOpen = open === s.id;
          return (
            <div key={s.id} className={cn("overflow-hidden rounded-2xl border transition-colors", isOpen ? "border-gold/30 bg-gold/[0.04]" : "border-line bg-surface")}>
              <button onClick={() => setOpen(isOpen ? null : s.id)} className="flex w-full items-center gap-3 p-4">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", isOpen ? "bg-gold text-ink" : "bg-white/5 text-gold")}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-left text-sm font-semibold text-white">{s.title}</span>
                <ChevronRight className={cn("h-4 w-4 text-muted transition-transform", isOpen && "rotate-90")} />
              </button>

              {isOpen && (
                <div className="divide-y divide-line/60 border-t border-line/60 px-4">
                  {s.items.map((item) => {
                    if (item.custom === "account") {
                      return (
                        <div key={item.label} className="flex items-center justify-between py-3">
                          <p className="text-sm text-white">{item.label}</p>
                          <p className="text-xs text-muted">
                            {item.label === "Email" ? me?.email : me?.tier}
                          </p>
                        </div>
                      );
                    }
                    if (item.custom === "accent") {
                      return (
                        <div key={item.label} className="py-3">
                          <p className="mb-2 text-sm text-white">{item.label}</p>
                          <div className="flex gap-2.5">
                            {ACCENTS.map((a) => (
                              <button
                                key={a.id}
                                onClick={() => handleAccent(a.id)}
                                className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110"
                                style={{ background: a.color }}
                                title={a.label}
                              >
                                {accent === a.id && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (item.custom === "fontSize") {
                      return (
                        <div key={item.label} className="py-3">
                          <p className="mb-2 text-sm text-white">{item.label}</p>
                          <div className="flex gap-1.5">
                            {FONT_SIZES.map((f) => (
                              <button
                                key={f.id}
                                onClick={() => handleFontSize(f.id)}
                                className={cn(
                                  "flex-1 rounded-xl border py-2 transition-colors",
                                  fontSize === f.id ? "border-gold/50 bg-gold/15 text-gold-soft" : "border-line bg-surface-2 text-muted"
                                )}
                              >
                                <span className={f.cls}>{f.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (item.custom === "colorblind") {
                      return (
                        <div key={item.label} className="py-3">
                          <p className="mb-2 text-sm text-white">{item.label}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {COLORBLIND.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => handleColorblind(c.id)}
                                className={cn(
                                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                                  colorblind === c.id ? "border-gold/50 bg-gold/15 text-gold-soft" : "border-line bg-surface-2 text-muted"
                                )}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (item.custom === "dnd") {
                      return (
                        <div key={item.label} className="py-3">
                          <p className="mb-2 text-sm text-white">{item.label}</p>
                          <div className="flex gap-1.5">
                            {(["off", "scheduled", "always"] as const).map((m) => (
                              <button
                                key={m}
                                onClick={() => handleDnd(m)}
                                className={cn(
                                  "flex-1 rounded-xl border py-2 text-xs capitalize transition-colors",
                                  dnd === m ? "border-gold/50 bg-gold/15 text-gold-soft" : "border-line bg-surface-2 text-muted"
                                )}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    if (item.custom === "language") {
                      return (
                        <div key={item.label} className="py-3">
                          <p className="mb-2 text-sm text-white">{item.label}</p>
                          <select
                            value={language}
                            onChange={(e) => handleLanguage(e.target.value)}
                            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-white focus:border-gold/50 focus:outline-none"
                          >
                            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                      );
                    }
                    return (
                      <Toggle
                        key={item.key}
                        label={item.label}
                        description={item.desc}
                        value={item.key ? prefs[item.key] : false}
                        onChange={() => item.key && flip(item.key)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* data & account actions */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Data & account</h3>
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={async () => {
              const supabase = getSupabase();
              if (!supabase) { pushToast("Supabase is not configured", "error"); return; }
              const { data: { user: authUser } } = await supabase.auth.getUser();
              if (!authUser) { pushToast("Not authenticated", "error"); return; }

              // Fetch all user data for export
              const { data } = await supabase.from("users").select("*").eq("id", authUser.id).single();
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `fyk-data-export-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              pushToast("Data export downloaded.");
            }}
          >
            <Download className="h-4 w-4" /> Export my data (GDPR)
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => router.push("/safety")}
          >
            <Ban className="h-4 w-4" /> Blocked users & notes
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start text-rose-300 hover:bg-rose-500/10"
            disabled={deleting}
            onClick={handleDeleteAccount}
          >
            <Trash2 className="h-4 w-4" /> {deleting ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-muted/60">
        FYK v1.0 · Find Your King · Privacy-first, on-device AI
      </p>
    </div>
  );
}
