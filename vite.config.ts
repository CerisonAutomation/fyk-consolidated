import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
		dedupe: ["react", "react-dom", "react/jsx-runtime"],
	},
	plugins: [
		devtools(),
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
