import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { users } from "@/schema";

type Call = { id: string; fromId: string; toId: string; type: "voice"|"video"; status: "ringing"|"active"|"ended"|"declined"; startedAt: string; endedAt?: string; durationSec?: number; };

const callLog: Call[] = []; // In production: Redis + DB call_sessions table, this is ephemeral log for MVP

const createSchema = z.object({ toId: z.string().uuid(), type: z.enum(["voice","video"]).default("voice") });
const actionSchema = z.object({ callId: z.string().uuid(), action: z.enum(["accept","decline","end"]) });

export const Route = createFileRoute("/api/calls/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const callId = url.searchParams.get("callId");
        if (callId) {
          const call = callLog.find(c => c.id === callId && (c.fromId === user.id || c.toId === user.id));
          return json({ call: call ?? null });
        }
        const myCalls = callLog.filter(c => c.fromId === user.id || c.toId === user.id).sort((a,b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0,20);
        return json({ calls: myCalls, count: myCalls.length, active: myCalls.find(c => c.status === "active" || c.status === "ringing") ?? null });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `calls:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "create";

        if (action === "create") {
          const body = await readJson(request, createSchema, 2*1024);
          if (body.toId === user.id) return jsonError("Cannot call self", 400);
          const [target] = await db.select().from(users).where(eq(users.id, body.toId)).limit(1);
          if (!target) return jsonError("User not found", 404);
          if (target.isSuspended) return jsonError("User unavailable", 400);

          const call: Call = { id: crypto.randomUUID(), fromId: user.id, toId: body.toId, type: body.type, status: "ringing", startedAt: new Date().toISOString() };
          callLog.push(call);
          if (callLog.length > 100) callLog.shift();

          // Production: create WebRTC signaling room, push notification to callee
          return json({ ok: true, call, signaling: { roomId: `call_${call.id}`, token: `tok_${call.id.slice(0,8)}` }, message: `${body.type} call ringing` }, { status: 201 });
        }

        const body = await readJson(request, actionSchema, 2*1024);
        const call = callLog.find(c => c.id === body.callId);
        if (!call) return jsonError("Call not found", 404);
        if (call.toId !== user.id && call.fromId !== user.id) return jsonError("Not your call", 403);

        if (body.action === "accept" && call.toId === user.id && call.status === "ringing") {
          call.status = "active";
          return json({ ok: true, call, message: "Call accepted, WebRTC connecting" });
        }
        if (body.action === "decline" && call.toId === user.id) {
          call.status = "declined"; call.endedAt = new Date().toISOString();
          return json({ ok: true, call, message: "Call declined" });
        }
        if (body.action === "end") {
          call.status = "ended"; call.endedAt = new Date().toISOString();
          if (call.startedAt) call.durationSec = Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime())/1000);
          return json({ ok: true, call, message: `Call ended, ${call.durationSec ?? 0}s` });
        }

        return jsonError("Invalid action", 400);
      }, { rateLimit: { limit: 20, key: ({ caller }) => `calls:POST:${caller?.id}` } }),

      DELETE: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const callId = url.searchParams.get("callId");
        if (!callId) return jsonError("callId required", 400);
        const call = callLog.find(c => c.id === callId);
        if (!call) return jsonError("Not found", 404);
        call.status = "ended"; call.endedAt = new Date().toISOString();
        return json({ ok: true, ended: callId });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `calls:DELETE:${caller?.id}` } }),
    },
  },
});
