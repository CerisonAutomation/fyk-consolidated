import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "../cn";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

export function Skeleton({
	className,
	...restProps
}: SkeletonProps): ReactNode {
	return (
		<div
			data-slot="skeleton"
			className={cn("animate-pulse rounded-2xl bg-muted", className)}
			{...restProps}
		/>
	);
}
