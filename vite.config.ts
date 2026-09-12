import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const port = Number(process.env.PORT ?? 3000);

/**
 * Host binding.
 *
 * `host: true` (0.0.0.0) so the server is reachable from outside a container —
 * the previous config bound to localhost only, which made `docker run -p` and
 * every tunnel/preview environment silently 502.
 *
 * `allowedHosts` is relaxed **only outside production**: dev servers, tunnels
 * and the sandbox preview legitimately arrive with a foreign `Host` header, and
 * Vite's default host check blocks them (DNS-rebinding protection). In
 * production the check stays on; add the exact domains via
 * `ALLOWED_HOSTS=a.com,b.com` when the app sits behind a proxy that rewrites
 * `Host`.
 */
const relaxedHosts = process.env.NODE_ENV !== "production";
const allowedHosts = relaxedHosts
	? true
	: (process.env.ALLOWED_HOSTS ?? "")
			.split(",")
			.map((entry) => entry.trim())
			.filter(Boolean);

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
		dedupe: ["react", "react-dom", "react/jsx-runtime"],
	},
	plugins: [devtools(), tailwindcss(), tanstackStart({}), viteReact()],
	server: {
		host: true,
		port,
		allowedHosts,
		fs: {
			// The repo root is read for `docs/` assets in dev; `..` keeps Vite from
			// refusing the parent directory while not exposing the filesystem.
			allow: [".."],
		},
	},
	preview: {
		host: true,
		port,
		allowedHosts,
	},
});

export default config;
