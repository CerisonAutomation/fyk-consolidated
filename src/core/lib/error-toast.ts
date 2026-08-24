export function showErrorToast({
	label,
	error,
}: {
	label: string;
	error: unknown;
}): void {
	console.error(`[toast] ${label}:`, error);
}
