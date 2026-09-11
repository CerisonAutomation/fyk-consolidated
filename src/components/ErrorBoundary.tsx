import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "#/lib/monitoring";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

/**
 * Global error boundary — catches rendering errors in the component tree
 * and displays a graceful fallback instead of a blank screen.
 *
 * Based on React docs pattern: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		// Dev console output is handled inside reportError (DEV-gated), so the
		// boundary never writes user content to the console in production.
		reportError(error, {
			source: "ErrorBoundary",
			componentStack: (errorInfo.componentStack ?? "").slice(0, 500),
		});
		this.props.onError?.(error, errorInfo);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) return this.props.fallback;

			return (
				<div className="grid min-h-[100svh] place-items-center bg-canvas px-6 text-ink">
					<div className="flex max-w-md flex-col items-center gap-5 text-center">
						<span className="grid h-14 w-14 place-items-center rounded-2xl bg-live/15">
							<svg
								aria-hidden="true"
								focusable={false}
								className="h-7 w-7 text-live"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<circle cx="12" cy="12" r="10" />
								<line x1="12" y1="8" x2="12" y2="12" />
								<line x1="12" y1="16" x2="12.01" y2="16" />
							</svg>
						</span>
						<div>
							<h2 className="text-xl font-bold tracking-tight">
								Something went wrong
							</h2>
							<p className="mt-2 text-sm leading-relaxed text-muted">
								An unexpected error occurred. You can try reloading the page or
								navigating back to the home screen.
							</p>
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={this.handleReset}
								className="press inline-flex h-11 items-center gap-2 rounded-full bg-gold px-5 text-[14px] font-bold text-black hover:bg-gold-2"
							>
								Try again
							</button>
							<a
								href="/"
								className="press inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-[14px] font-semibold text-ink-2 hover:text-ink"
							>
								Go home
							</a>
						</div>
						{import.meta.env.DEV && this.state.error && (
							<pre className="mt-4 max-w-full overflow-auto rounded-xl border border-line bg-surface p-4 text-left text-[12px] text-muted">
								{this.state.error.message}
								{"\n"}
								{this.state.error.stack}
							</pre>
						)}
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
