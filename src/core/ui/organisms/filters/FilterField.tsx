import type { ReactNode } from "react";
import { cn } from "../../cn";

interface FilterFieldProps {
	children?: ReactNode;
	className?: string;
}

export function FilterField({
	children,
	className,
}: FilterFieldProps): ReactNode {
	return (
		<div className={cn("flex w-full items-center gap-3", className)}>
			{children}
		</div>
	);
}
