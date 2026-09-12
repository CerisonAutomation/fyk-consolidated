import { createFileRoute } from '@tanstack/react-router'
function LandingPage() {
	return (
		<div className="min-h-screen bg-[#0B0D11] text-white">
			<section className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
				<div className="mb-6 text-6xl">👑</div>
				<h1 className="text-5xl md:text-7xl font-bold mb-4" style={{ fontFamily: "Bebas Neue" }}>
					FIND YOUR KING
				</h1>
				<p className="text-xl text-gray-400 mb-8 max-w-md">
					Premium LGBTQ+ dating platform. AI-powered matching, real-time chat, and curated IRL events.
				</p>
				<div className="flex gap-4">
					<a href="/auth/sign-in" className="px-8 py-3 bg-[#EDB219] text-black font-semibold rounded-lg hover:bg-[#d4a017] transition">
						Sign In
					</a>
					<a href="/auth/sign-up" className="px-8 py-3 border border-[#EDB219] text-[#EDB219] font-semibold rounded-lg hover:bg-[#EDB219]/10 transition">
						Create Account
					</a>
				</div>
			</section>
			<section className="py-20 px-4 max-w-6xl mx-auto">
				<h2 className="text-3xl font-bold text-center mb-12" style={{ fontFamily: "Bebas Neue" }}>Why FYK?</h2>
				<div className="grid md:grid-cols-3 gap-8">
					<div className="p-6 rounded-xl bg-[#16181D] border border-[#2A2D35]">
						<div className="text-3xl mb-4">🧠</div>
						<h3 className="text-xl font-semibold mb-2">AI Matching</h3>
						<p className="text-gray-400">5-dimension compatibility scoring powered by on-device ML.</p>
					</div>
					<div className="p-6 rounded-xl bg-[#16181D] border border-[#2A2D35]">
						<div className="text-3xl mb-4">💬</div>
						<h3 className="text-xl font-semibold mb-2">Real-time Chat</h3>
						<p className="text-gray-400">Instant messaging with smart replies, reactions, and voice notes.</p>
					</div>
					<div className="p-6 rounded-xl bg-[#16181D] border border-[#2A2D35]">
						<div className="text-3xl mb-4">📍</div>
						<h3 className="text-xl font-semibold mb-2">Right Now</h3>
						<p className="text-gray-400">See who's nearby and available for spontaneous meetups.</p>
					</div>
				</div>
			</section>
			<footer className="py-8 text-center text-gray-500 text-sm">
				© 2024 FYK — Find Your King. All rights reserved.
			</footer>
		</div>
	);
}

export const Route = createFileRoute("/")({
	component: LandingPage,
});
