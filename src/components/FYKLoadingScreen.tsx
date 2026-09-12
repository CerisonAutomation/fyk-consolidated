/**
 * Premium loading screen with the FYKING logo.
 * Designed to feel like a native app splash screen.
 *
 * Uses CSS animations for smooth GPU-accelerated transitions.
 * Per the performance docs: "Prefer will-change: transform for GPU-accelerated animations"
 */
export function FYKLoadingScreen() {
	return (
		<div
			className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
			style={{
				background:
					"linear-gradient(160deg, #0a0014 0%, #110022 25%, #000000 50%, #0a0a0a 70%, #110808 100%)",
			}}
		>
			{/* Radial glow behind logo */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						"radial-gradient(ellipse 60% 40% at 50% 45%, rgba(234,179,8,0.08) 0%, transparent 60%)",
				}}
			/>

			{/* Top gold line */}
			<div
				className="absolute top-0 left-0 right-0 h-px"
				style={{
					background:
						"linear-gradient(90deg, transparent, rgba(234,179,8,0.3), transparent)",
				}}
			/>

			{/* Logo container */}
			<div className="relative z-10 flex flex-col items-center gap-8">
				{/* Crown glow */}
				<div
					className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full pointer-events-none"
					style={{
						background:
							"radial-gradient(circle, rgba(234,179,8,0.15) 0%, transparent 70%)",
						filter: "blur(30px)",
						animation: "loader-crownPulse 2.5s ease-in-out infinite",
					}}
				/>

				{/* Square logo */}
				<div
					className="relative will-change-transform"
					style={{
						animation: "loader-float 3s ease-in-out infinite",
					}}
				>
					<img
						src="/logo-square.svg"
						alt="FYKING"
						className="w-24 h-24 sm:w-28 sm:h-28"
						style={{
							filter: "drop-shadow(0 0 30px rgba(234,179,8,0.2))",
						}}
					/>
				</div>

				{/* Horizontal logo text */}
				<div style={{ animation: "loader-fadeIn 0.8s ease-out 0.3s both" }}>
					<img
						src="/logo-horizontal.svg"
						alt="FYKING"
						className="h-6 sm:h-7 w-auto"
						style={{
							filter: "drop-shadow(0 0 20px rgba(234,179,8,0.15))",
						}}
					/>
				</div>

				{/* Loading indicator */}
				<div
					className="flex flex-col items-center gap-3"
					style={{ animation: "loader-fadeIn 0.6s ease-out 0.6s both" }}
				>
					{/* Premium spinner — thin gold ring */}
					<div className="relative w-8 h-8">
						<div
							className="absolute inset-0 rounded-full"
							style={{
								border: "1.5px solid rgba(234,179,8,0.1)",
							}}
						/>
						<div
							className="absolute inset-0 rounded-full will-change-transform"
							style={{
								border: "1.5px solid transparent",
								borderTopColor: "#EAAB08",
								borderRightColor: "rgba(234,179,8,0.4)",
								animation: "loader-spin 1.2s linear infinite",
							}}
						/>
						{/* Inner dot */}
						<div
							className="absolute inset-0 m-auto w-1.5 h-1.5 rounded-full"
							style={{
								background: "#EAAB08",
								animation: "loader-pulse 1.5s ease-in-out infinite",
							}}
						/>
					</div>

					<span
						className="font-mono text-[10px] uppercase tracking-[0.35em]"
						style={{ color: "rgba(234,179,8,0.5)" }}
					>
						Loading
					</span>
				</div>
			</div>

			{/* Bottom version */}
			<div
				className="absolute bottom-8 left-0 right-0 text-center"
				style={{ animation: "loader-fadeIn 0.6s ease-out 1s both" }}
			>
				<span
					className="font-mono text-[9px] uppercase tracking-[0.3em]"
					style={{ color: "rgba(255,255,255,0.15)" }}
				>
					FYK v1.0
				</span>
			</div>

			{/* Keyframes — GPU-accelerated with transform and opacity only */}
			<style>{`
				@keyframes loader-float {
					0%, 100% { transform: translateY(0); }
					50% { transform: translateY(-6px); }
				}
				@keyframes loader-fadeIn {
					from { opacity: 0; transform: translateY(8px); }
					to { opacity: 1; transform: translateY(0); }
				}
				@keyframes loader-spin {
					to { transform: rotate(360deg); }
				}
				@keyframes loader-pulse {
					0%, 100% { opacity: 0.4; transform: scale(0.8); }
					50% { opacity: 1; transform: scale(1.2); }
				}
				@keyframes loader-crownPulse {
					0%, 100% { opacity: 0.5; transform: translate(-50%, 0) scale(1); }
					50% { opacity: 1; transform: translate(-50%, 0) scale(1.1); }
				}
			`}</style>
		</div>
	);
}
