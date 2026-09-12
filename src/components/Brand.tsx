import { cn } from "#/lib/utils";

/**
 * FY KING. brand marks — rebuilt from the supplied artwork.
 * "F" solid white, "Y" white outline, "KING" red, a white full-stop, a gold
 * outline crown and a white rule. Drawn as inline SVG so it stays crisp at any
 * size, themes correctly, and needs no asset request.
 */

const RED = "#E8121B";
const GOLD = "#EDB219";

function Crown({
	stroke = GOLD,
	width = 26,
}: {
	stroke?: string;
	width?: number;
}) {
	return (
		<path
			d="M6 62 L2.5 20.5 L26 40.5 L44 6 L62 40.5 L85.5 20.5 L82 62 Z M6 62 L82 62 L82 76 L6 76 Z"
			fill="none"
			stroke={stroke}
			strokeWidth={width}
			strokeLinejoin="round"
			strokeLinecap="round"
		/>
	);
}

/** Horizontal lockup: FY KING. 👑 with the underline rule. */
export function LogoHorizontal({
	className,
	showRule = true,
}: {
	className?: string;
	showRule?: boolean;
}) {
	return (
		<svg
			viewBox="0 0 660 150"
			className={className}
			role="img"
			aria-label="FY KING"
		>
			<title>FY KING</title>
			<g
				fontFamily="Inter, system-ui, sans-serif"
				fontWeight="900"
				fontSize="118"
				letterSpacing="-2"
			>
				{/* F — solid white */}
				<text x="0" y="112" fill="#FFFFFF">
					F
				</text>
				{/* Y — outlined white */}
				<text x="72" y="112" fill="none" stroke="#FFFFFF" strokeWidth="7">
					Y
				</text>
				{/* KING — red */}
				<text x="176" y="112" fill={RED}>
					KING
				</text>
			</g>
			{/* the full stop */}
			<circle cx="508" cy="100" r="15" fill="#FFFFFF" />
			{/* gold crown */}
			<g transform="translate(538 34) scale(1.06)">
				<Crown />
			</g>
			{showRule && (
				<rect x="0" y="138" width="644" height="8" rx="4" fill="#FFFFFF" />
			)}
		</svg>
	);
}

/** Stacked lockup: FY + crown over KING. with the rule beneath. */
export function LogoStacked({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 420 300"
			className={className}
			role="img"
			aria-label="FY KING"
		>
			<title>FY KING</title>
			<g
				fontFamily="Inter, system-ui, sans-serif"
				fontWeight="900"
				fontSize="132"
				letterSpacing="-3"
			>
				<text x="6" y="122" fill="#FFFFFF">
					F
				</text>
				<text x="86" y="122" fill="none" stroke="#FFFFFF" strokeWidth="8">
					Y
				</text>
			</g>
			<g transform="translate(232 22) scale(1.5)">
				<Crown />
			</g>
			<g
				fontFamily="Inter, system-ui, sans-serif"
				fontWeight="900"
				fontSize="132"
				letterSpacing="-3"
			>
				<text x="6" y="258" fill={RED}>
					KING
				</text>
			</g>
			<circle cx="368" cy="244" r="17" fill="#FFFFFF" />
			<rect x="6" y="278" width="380" height="9" rx="4.5" fill="#FFFFFF" />
		</svg>
	);
}

/** Crown-only glyph for tight spaces, tabs and the lock screen. */
export function CrownMark({
	className,
	tone = GOLD,
}: {
	className?: string;
	tone?: string;
}) {
	return (
		<svg
			viewBox="0 0 92 88"
			className={className}
			role="img"
			aria-label="FY KING"
		>
			<title>FY KING</title>
			<Crown stroke={tone} width={13} />
		</svg>
	);
}

/** Compact horizontal mark for the top bar of small screens. */
export function LogoCompact({ className }: { className?: string }) {
	return (
		<span className={cn("inline-flex items-center gap-1.5", className)}>
			<span className="text-[17px] font-black leading-none tracking-tight text-ink">
				F
				<span className="text-transparent [-webkit-text-stroke:1.1px_var(--c-ink)]">
					Y
				</span>
			</span>
			<span
				className="text-[17px] font-black leading-none tracking-tight"
				style={{ color: RED }}
			>
				KING<span className="text-ink">.</span>
			</span>
			<CrownMark className="h-[13px] w-[14px]" />
		</span>
	);
}

export const BRAND = { red: RED, gold: GOLD };
