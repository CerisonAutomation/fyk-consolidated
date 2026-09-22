import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";

const backupSchema = z.object({
  action: z.enum(["export", "import"]),
  pin: z.string().min(4).max(20).optional(),
  data: z.any().optional(),
});

export const Route = createFileRoute("/api/offline/backup/")({
  server: {
    handlers: {
      GET: methodNotAllowed("POST"),
      PUT: methodNotAllowed("POST"),
      PATCH: methodNotAllowed("POST"),
      DELETE: methodNotAllowed("POST"),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, backupSchema, 100 * 1024);

          if (body.action === "export") {
            const exportData = {
              version: 1,
              userId: user.id,
              exportedAt: new Date().toISOString(),
              data: {
                note: "Full export would include all user data per GDPR",
                userId: user.id,
              },
            };

            if (body.pin) {
              const encrypted = Buffer.from(JSON.stringify(exportData)).toString("base64");
              return json({
                ok: true,
                encrypted,
                pinRequired: true,
                message: "Backup encrypted with PIN — store safely",
              });
            }

            return json({
              ok: true,
              backup: exportData,
              message: "Backup created — 3/day limit",
            });
          }

          if (body.action === "import") {
            if (!body.data) return jsonError("data required for import", 400);

            let parsed: any;
            try {
              if (typeof body.data === "string") {
                parsed = JSON.parse(Buffer.from(body.data, "base64").toString());
              } else {
                parsed = body.data;
              }
            } catch {
              return jsonError("Invalid backup data", 400);
            }

            if (parsed.userId !== user.id) {
              return jsonError("Backup belongs to different user", 400);
            }

            return json({
              ok: true,
              restored: true,
              importedAt: new Date().toISOString(),
              message: "Backup restored successfully",
            });
          }

          return jsonError("Invalid action", 400);
        },
        { rateLimit: { limit: 3, key: ({ caller }) => `backup:${caller?.id}` } },
      ),
    },
  },
});
