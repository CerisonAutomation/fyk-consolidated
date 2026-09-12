import { cn } from "#/utils/cn";

export function Switch({
	checked,
	onChange,
	label,
	tone = "gold",
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
	label: string;
	tone?: "gold" | "live";
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className={cn(
				"press relative h-[26px] w-[46px] shrink-0 rounded-full border transition-colors",
				checked
					? tone === "live"
						? "border-live bg-live"
						: "border-gold bg-gold"
					: "border-line bg-surface-3",
			)}
		>
			<span
				className={cn(
					"absolute top-[2px] h-[20px] w-[20px] rounded-full bg-white shadow-sm transition-[left] duration-200",
					checked ? "left-[23px]" : "left-[2px]",
				)}
			/>
		</button>
	);
}
