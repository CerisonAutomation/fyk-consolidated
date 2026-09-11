-- Enable Realtime on tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.taps;

-- Realtime RLS policies
CREATE POLICY "Users can see their own messages" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id);

CREATE POLICY "Conversation members can see messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Presence for online status
CREATE OR REPLACE FUNCTION public.handle_presence()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users SET online = true, last_seen = now() WHERE id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Typing indicator cleanup (remove stale indicators after 10 seconds)
CREATE OR REPLACE FUNCTION public.cleanup_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM public.typing_indicators WHERE created_at < now() - interval '10 seconds';
END;
$$ LANGUAGE plpgsql;
