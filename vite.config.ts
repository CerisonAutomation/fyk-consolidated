import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
	esbuild: {
		target: "es2022",
		banner: "(()=>{if(typeof PerformanceMark==='function'){performance.mark('app-hydration-start');}})();",
	},
	build: {
		target: "es2022",
		modulePreload: { polyfill: true },
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules")) {
						if (id.includes("@tanstack/react-router") || id.includes("@tanstack/react-start"))
							return "vendor-tanstack-router";
						if (id.includes("@tanstack/react-query"))
							return "vendor-tanstack-query";
						if (id.includes("@tanstack/ai") || id.includes("@tanstack/ai-react"))
							return "vendor-tanstack-ai";
						if (id.includes("react-dom") || id.includes("react/"))
							return "vendor-react";
						if (id.includes("zod") || id.includes("zod/"))
							return "vendor-zod";
						if (id.includes("prisma") || id.includes("@prisma"))
							return "vendor-prisma";
						if (id.includes("better-auth"))
							return "vendor-auth";
						if (id.includes("supabase"))
							return "vendor-supabase";
						if (id.includes("lucide-react"))
							return "vendor-icons";
						return "vendor-misc";
					}
				},
			},
		},
		chunkSizeWarningLimit: 1000,
		cssCodeSplit: true,
	},
	server: {
		hmr: {
			overlay: true,
		},
	},
	optimizeDeps: {
		include: [
			"react",
			"react-dom",
			"@tanstack/react-router",
			"@tanstack/react-query",
			"zod",
		],
	},
});

export default config;
