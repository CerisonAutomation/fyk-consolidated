import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	// The dev-only TanStack devtools plugin was removed along with its package: it
	// existed to inspect a store that no longer exists, and a panel that shows
	// nothing is worse than no panel.
	resolve: {
		tsconfigPaths: true,
		dedupe: ["react", "react-dom", "react/jsx-runtime"],
	},
	plugins: [tailwindcss(), tanstackStart({}), viteReact()],
	server: {
		// Bind every interface so the dev server is reachable from outside the
		// sandbox, and pin the port so a second `pnpm dev` fails loudly instead of
		// silently moving to 3001 and leaving a stale preview pointed at nothing.
		host: true,
		port: 3000,
		strictPort: true,
		fs: {
			allow: [".."],
		},
		// Vite rejects unknown Host headers (DNS-rebinding protection). Previews and
		// tunnels reach this server through a generated hostname, so the domain that
		// fronts them has to be allowed explicitly rather than by disabling the check.
		allowedHosts: [".e2b.app"],
	},
});

export default config;
