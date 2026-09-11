import { memo } from "react";

interface LoadingSpinnerProps {
	size?: "sm" | "md" | "lg";
	className?: string;
}

const sizes = {
	sm: "w-4 h-4",
	md: "w-8 h-8",
	lg: "w-12 h-12",
};

/**
 * React.memo prevents re-renders when props haven't changed.
 * Per the performance docs: "Use when component receives the same props frequently".
 */
export const LoadingSpinner = memo(function LoadingSpinner({
	size = "md",
	className = "",
}: LoadingSpinnerProps) {
	return (
		<div className={`flex items-center justify-center ${className}`}>
			<div
				className={`${sizes[size]} rounded-full border-2 border-transparent border-t-primary animate-spin`}
			/>
		</div>
	);
});
