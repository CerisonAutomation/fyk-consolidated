import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Crown,
	Shield,
	BrainCircuit,
	Heart,
	Mic,
	Star,
	ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/about")({
	component: About,
});

function About() {
	return (
		<main className="screen-nav-host">
			<div className="h-full w-full overflow-y-auto overscroll-none">
				<div className="mx-auto max-w-2xl px-4 py-8 pb-24">
					{/* ── Hero ── */}
					<div className="text-center mb-12">
						<div className="mb-6 inline-flex">
							<div
								className="w-20 h-20 rounded-2xl flex items-center justify-center"
								style={{
									background:
										"linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.05))",
									border: "1px solid rgba(234,179,8,0.25)",
									boxShadow: "0 0 40px rgba(234,179,8,0.15)",
								}}
							>
								<Crown className="w-10 h-10 text-amber-400" />
							</div>
						</div>
						<h1
							className="text-4xl sm:text-5xl tracking-wider mb-3"
							style={{
								fontFamily:
									"'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
								color: "rgba(255,255,255,0.9)",
							}}
						>
							About{" "}
							<span
								style={{
									background: "linear-gradient(135deg, #EAAB08, #F5D76E)",
									WebkitBackgroundClip: "text",
									backgroundClip: "text",
									WebkitTextFillColor: "transparent",
								}}
							>
								FYK
							</span>
						</h1>
						<p
							className="max-w-lg mx-auto text-sm leading-relaxed"
							style={{ color: "rgba(255,255,255,0.5)" }}
						>
							The premium geosocial discovery platform for men who refuse to
							settle. Built with obsessive attention to detail, powered by AI,
							and designed for real connections.
						</p>
					</div>

					{/* ── Mission ── */}
					<div className="glass-card rounded-2xl p-6 mb-6">
						<p
							className="font-mono uppercase tracking-[0.25em] mb-3"
							style={{ fontSize: "10px", color: "rgba(234,179,8,0.7)" }}
						>
							Mission
						</p>
						<h2
							className="text-xl tracking-wide mb-3"
							style={{
								fontFamily:
									"'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
								color: "rgba(255,255,255,0.9)",
							}}
						>
							Find Your King
						</h2>
						<p
							className="text-sm leading-relaxed"
							style={{ color: "rgba(255,255,255,0.5)" }}
						>
							FYK was born from a simple belief: dating apps should work for
							you, not against you. We built an AI-powered platform that
							understands what you're looking for, connects you with compatible
							men in your area, and gives you the tools to build genuine
							relationships — whether that's a lifetime partner or a new best
							friend.
						</p>
					</div>

					{/* ── Values Grid ── */}
					<p
						className="font-mono uppercase tracking-[0.25em] mb-4 text-center"
						style={{ fontSize: "10px", color: "rgba(234,179,8,0.7)" }}
					>
						What We Stand For
					</p>
					<div className="grid sm:grid-cols-2 gap-4 mb-8">
						{[
							{
								icon: Shield,
								title: "Safety First",
								desc: "Every profile is verified. Every interaction is protected. Your privacy is non-negotiable.",
								color: "#22c55e",
							},
							{
								icon: BrainCircuit,
								title: "AI-Powered",
								desc: "Smart matching, conversation coaching, and compatibility scoring — all powered by cutting-edge AI.",
								color: "#a855f7",
							},
							{
								icon: Heart,
								title: "Real Connections",
								desc: "No endless swiping. Our grid and compatibility system surface the men who truly match your vibe.",
								color: "#f43f5e",
							},
							{
								icon: Mic,
								title: "Voice Control",
								desc: "Navigate hands-free with natural language. Your personal wingman that's always ready.",
								color: "#06b6d4",
							},
						].map((v) => (
							<div key={v.title} className="glass-card rounded-2xl p-5">
								<div
									className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
									style={{ background: `${v.color}15` }}
								>
									<v.icon className="w-5 h-5" style={{ color: v.color }} />
								</div>
								<h3
									className="text-lg tracking-wide mb-2"
									style={{
										fontFamily:
											"'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
										color: "rgba(255,255,255,0.9)",
									}}
								>
									{v.title}
								</h3>
								<p
									className="text-xs leading-relaxed"
									style={{ color: "rgba(255,255,255,0.45)" }}
								>
									{v.desc}
								</p>
							</div>
						))}
					</div>

					{/* ── Stats ── */}
					<div className="grid grid-cols-3 gap-3 mb-8">
						{[
							{ value: "89K+", label: "Active Users", color: "#EAAB08" },
							{ value: "12K+", label: "Matches Daily", color: "#22c55e" },
							{ value: "4.9★", label: "App Rating", color: "#a855f7" },
						].map((s) => (
							<div
								key={s.label}
								className="glass-card rounded-xl p-4 text-center"
							>
								<p
									className="text-2xl mb-1"
									style={{
										color: s.color,
										fontFamily:
											"'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
									}}
								>
									{s.value}
								</p>
								<p
									className="font-mono uppercase tracking-wider"
									style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)" }}
								>
									{s.label}
								</p>
							</div>
						))}
					</div>

					{/* ── Tech Stack ── */}
					<div className="glass-card rounded-2xl p-6 mb-8">
						<p
							className="font-mono uppercase tracking-[0.25em] mb-3"
							style={{ fontSize: "10px", color: "rgba(234,179,8,0.7)" }}
						>
							Built With
						</p>
						<div className="flex flex-wrap gap-2">
							{[
								"React 19",
								"TanStack Start",
								"Supabase",
								"TypeScript",
								"Tailwind CSS",
								"AI/ML",
							].map((tech) => (
								<span
									key={tech}
									className="px-3 py-1.5 rounded-full text-xs font-mono"
									style={{
										background: "rgba(234,179,8,0.08)",
										border: "1px solid rgba(234,179,8,0.2)",
										color: "rgba(234,179,8,0.7)",
									}}
								>
									{tech}
								</span>
							))}
						</div>
					</div>

					{/* ── CTA ── */}
					<div className="text-center">
						<Link
							to="/grid"
							className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm tracking-widest uppercase transition-all duration-300 hover:scale-105 no-underline"
							style={{
								fontFamily:
									"'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif",
								background:
									"linear-gradient(135deg, #EAAB08, #F5D76E, #D4AF37)",
								color: "#000",
								boxShadow: "0 0 30px rgba(234,179,8,0.3)",
							}}
						>
							<Star className="w-4 h-4" />
							JOIN FYK
							<ArrowRight className="w-4 h-4" />
						</Link>
						<p
							className="mt-4 font-mono uppercase tracking-widest"
							style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}
						>
							Free to join &middot; Premium features available
						</p>
					</div>
				</div>
			</div>
		</main>
	);
}
