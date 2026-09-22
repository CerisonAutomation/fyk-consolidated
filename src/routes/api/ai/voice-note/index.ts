import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { generateVoiceNote, VOICE_TONES, estimateDuration } from "#/domains/ai/heuristic/voice-note";

const schema = z.object({ text: z.string().min(1).max(500), tone: z.enum(["warm","casual","flirty","friendly"]).default("warm") });

export const Route = createFileRoute("/api/ai/voice-note/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        requireCaller(caller);
        return json({ tones: VOICE_TONES, explainability: "Pick suggested reply + tap read it to them — generates warm voice note in users tone, receiver sees transcript+audio", maxChars: 500 });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `vn:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const body = await readJson(request, schema, 4*1024);
        const voiceNote = generateVoiceNote(body.text, body.tone);
        const duration = estimateDuration(body.text);
        return json({ voiceNote, duration, transcript: body.text, explainability: `Tone: ${body.tone}, ${duration}s estimated at 150 wpm, production uses ElevenLabs voice cloning` });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `vn:POST:${caller?.id}` } }),
    },
  },
});

