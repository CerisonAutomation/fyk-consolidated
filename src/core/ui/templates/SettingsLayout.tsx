import type { ReactNode } from "react";
import { cn } from "../cn";

interface SettingsLayoutProps {
	children: ReactNode;
	/** Optional title for the settings page */
	title?: string;
	/** Back navigation handler */
	onBack?: () => void;
	className?: string;
}

export function SettingsLayout({
	children,
	title,
	onBack,
	className,
}: SettingsLayoutProps): ReactNode {
	return (
		<div className={cn("min-h-screen bg-background", className)}>
			{/* Header */}
			<div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
				<div className="flex items-center gap-3 px-4 py-3">
					{onBack && (
						<button
							type="button"
							onClick={onBack}
							className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted"
							aria-label="Go back"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="size-4"
							>
								<path d="M15 18l-6-6 6-6" />
							</svg>
						</button>
					)}
					{title && <h1 className="text-lg font-semibold">{title}</h1>}
				</div>
			</div>

			{/* Content */}
			<main className="px-4 py-4">{children}</main>
		</div>
	);
}
