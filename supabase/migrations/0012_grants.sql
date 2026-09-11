-- Grant permissions for Prisma-created tables
-- Per docs: "Never expose service_role key to clients" and
-- "audit_events: NO grant to authenticated — cannot be read or written by clients"
-- Per docs: "premium_entitlements has NO client write policy — Plus cannot be self-granted"

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.taps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.conversation_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_reads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tribes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.story_views TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shouts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shout_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fansites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meetnow_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.king_pet TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wallet TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wallet_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.consumables_inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.site_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_memory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_match_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_safety_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_chat_health TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_suggestions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.footprints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saved_filters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.typing_indicators TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saved_phrases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pet_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pet_adventures TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_waitlist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_rate_limits TO authenticated;
-- premium_entitlements: SELECT only — cannot be self-granted by clients
GRANT SELECT ON TABLE public.premium_entitlements TO authenticated;
-- audit_events: NO grant to authenticated — the log cannot be forged or read by clients
-- audit_events: only accessible by service_role (which bypasses RLS)
-- Allow anon to read tribes and events
GRANT SELECT ON TABLE public.tribes TO anon;
GRANT SELECT ON TABLE public.events TO anon;
GRANT SELECT ON TABLE public.site_config TO anon;
