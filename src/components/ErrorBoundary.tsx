import React, { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
	children: ReactNode;
	/** Optional fallback UI. If omitted, a default error UI is shown. */
	fallback?: ReactNode;
	/** Called when an error is caught. */
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

/**
 * React error boundary that catches rendering errors in its subtree.
 * Displays a user-friendly error UI with a retry button.
 */
export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		console.error("[ErrorBoundary]", error, errorInfo);
		this.props.onError?.(error, errorInfo);
	}

	private handleRetry = (): void => {
		this.setState({ hasError: false, error: null });
	};

	render(): ReactNode {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div
					role="alert"
					className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950"
				>
					<div className="text-red-600 dark:text-red-400">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							className="mx-auto h-12 w-12"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
							/>
						</svg>
					</div>
					<h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
						Something went wrong
					</h2>
					<p className="max-w-md text-sm text-red-600 dark:text-red-400">
						{this.state.error?.message ?? "An unexpected error occurred."}
					</p>
					<button
						onClick={this.handleRetry}
						className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
						type="button"
					>
						Try again
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}
