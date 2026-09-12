import type { ReactNode } from "react";
import { cn } from "../cn";

interface DisplayNameProps {
	name: string | null;
	fallback?: string;
	className?: string;
}

export function DisplayName({
	name,
	fallback = "Someone",
	className,
}: DisplayNameProps): ReactNode {
	if (name) {
		return <span className={className}>{name}</span>;
	}
	return (
		<span className={cn("font-normal tracking-tight italic", className)}>
			{fallback}
		</span>
	);
}
