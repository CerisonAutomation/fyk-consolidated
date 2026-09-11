import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
	// The dev-only TanStack devtools plugin was removed along with its package: it
	// existed to inspect a store that no longer exists, and a panel that shows
	// nothing is worse than no panel.
	resolve: {
		tsconfigPaths: true,
		dedupe: ["react", "react-dom", "react/jsx-runtime"],
	},
	plugins: [
		tailwindcss(),
		tanstackStart({}),
		viteReact(),
	],
	server: {
		fs: {
			allow: [".."],
		},
	},
});

export default config;
