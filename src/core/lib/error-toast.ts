import type { ApiError } from '#/core/api/client/api-error';

/**
 * Error categories for display and retry logic.
 */
export type ErrorCategory = 'network' | 'auth' | 'server' | 'client' | 'unknown';

export interface ErrorToastOptions {
	label: string;
	error: unknown;
	/** Optional callback invoked when the user clicks Retry. */
	onRetry?: () => void | Promise<void>;
}

/**
 * Classify an error into a human-readable category.
 */
export function classifyError(error: unknown): ErrorCategory {
	if (isApiError(error)) {
		if (error.kind === 'NetworkBlocked') return 'network';
		if (
			error.kind === 'Auth' ||
			error.kind === 'Unauthorized' ||
			error.kind === 'NotLoggedIn' ||
			error.kind === 'Banned'
		)
			return 'auth';
		if (error.kind === 'RateLimited' || error.kind === 'RequestBlocked')
			return 'network';
		if (error.response !== null && error.response.status >= 500) return 'server';
		if (error.response !== null && error.response.status >= 400) return 'client';
	}

	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		if (
			msg.includes('network') ||
			msg.includes('fetch') ||
			msg.includes('econnrefused') ||
			msg.includes('timeout')
		)
			return 'network';
	}

	return 'unknown';
}

/**
 * Determine whether an error is retryable.
 */
export function isRetryable(error: unknown): boolean {
	if (isApiError(error)) return error.retryable;
	const category = classifyError(error);
	return category === 'network' || category === 'server';
}

/**
 * Format a user-facing error message from an unknown error value.
 */
export function formatErrorMessage(error: unknown): string {
	if (isApiError(error)) {
		if (error.kind === 'NetworkBlocked') return 'Network request was blocked';
		if (error.kind === 'Auth' || error.kind === 'Unauthorized')
			return 'Authentication failed';
		if (error.kind === 'NotLoggedIn') return 'You are not logged in';
		if (error.kind === 'Banned') return 'Account has been banned';
		if (error.kind === 'RateLimited') return 'Too many requests. Please wait a moment.';
		if (error.kind === 'SessionCleared') return 'Session expired';
		if (error.response !== null) {
			return `Request failed with status ${error.response.status}`;
		}
		return error.message;
	}
	if (error instanceof Error) return error.message;
	return String(error);
}

/**
 * Show an error toast. Supports optional retry for retryable errors.
 * Uses a lightweight DOM-based toast (no external dependencies).
 */
export function showErrorToast({
	label,
	error,
	onRetry,
}: ErrorToastOptions): void {
	console.error(`[toast] ${label}:`, error);

	const category = classifyError(error);
	const message = formatErrorMessage(error);
	const retryable = isRetryable(error);

	const toast = document.createElement('div');
	toast.setAttribute('role', 'alert');
	toast.setAttribute('aria-live', 'assertive');
	toast.className = buildToastClasses(category);

	const content = document.createElement('div');
	content.className = 'error-toast-content';

	const textWrapper = document.createElement('div');
	textWrapper.className = 'error-toast-text';

	const labelEl = document.createElement('strong');
	labelEl.textContent = label;
	labelEl.className = 'error-toast-label';

	const msgEl = document.createElement('span');
	msgEl.textContent = message;
	msgEl.className = 'error-toast-message';

	const categoryEl = document.createElement('span');
	categoryEl.textContent = categoryLabel(category);
	categoryEl.className = 'error-toast-category';

	textWrapper.appendChild(labelEl);
	textWrapper.appendChild(msgEl);
	textWrapper.appendChild(categoryEl);
	content.appendChild(textWrapper);

	if (retryable && onRetry) {
		const retryBtn = document.createElement('button');
		retryBtn.textContent = 'Retry';
		retryBtn.className = 'error-toast-retry';
		retryBtn.setAttribute('aria-label', `Retry: ${label}`);
		retryBtn.addEventListener('click', () => {
			dismiss();
			void onRetry();
		});
		content.appendChild(retryBtn);
	}

	const dismissBtn = document.createElement('button');
	dismissBtn.textContent = '\u00d7';
	dismissBtn.className = 'error-toast-dismiss';
	dismissBtn.setAttribute('aria-label', 'Dismiss error');
	dismissBtn.addEventListener('click', dismiss);
	content.appendChild(dismissBtn);

	toast.appendChild(content);
	ensureContainer().appendChild(toast);

	// Auto-dismiss after 8 seconds
	const timer = setTimeout(dismiss, 8000);

	function dismiss(): void {
		clearTimeout(timer);
		toast.classList.add('error-toast-exit');
		toast.addEventListener('animationend', () => toast.remove(), {
			once: true,
		});
		// Fallback removal if animation doesn't fire
		setTimeout(() => toast.remove(), 500);
	}
}

// ---------- internal helpers ----------

function isApiError(error: unknown): error is ApiError {
	return (
		error instanceof Error &&
		'name' in error &&
		(error as Error).name === 'ApiError'
	);
}

function categoryLabel(category: ErrorCategory): string {
	switch (category) {
		case 'network':
			return 'Network error';
		case 'auth':
			return 'Auth error';
		case 'server':
			return 'Server error';
		case 'client':
			return 'Request error';
		default:
			return 'Error';
	}
}

function buildToastClasses(category: ErrorCategory): string {
	const base = [
		'error-toast',
		'fixed',
		'bottom-4',
		'right-4',
		'z-[9999]',
		'max-w-sm',
		'rounded-lg',
		'border',
		'px-4',
		'py-3',
		'shadow-lg',
		'animate-in',
		'slide-in-from-bottom-5',
		'fade-in',
		'font-sans',
		'text-sm',
	];
	switch (category) {
		case 'network':
			base.push('border-amber-300', 'bg-amber-50', 'text-amber-900', 'dark:bg-amber-950', 'dark:text-amber-200');
			break;
		case 'auth':
			base.push('border-red-300', 'bg-red-50', 'text-red-900', 'dark:bg-red-950', 'dark:text-red-200');
			break;
		case 'server':
			base.push('border-red-300', 'bg-red-50', 'text-red-900', 'dark:bg-red-950', 'dark:text-red-200');
			break;
		default:
			base.push('border-zinc-300', 'bg-zinc-50', 'text-zinc-900', 'dark:bg-zinc-900', 'dark:text-zinc-200');
	}
	return base.join(' ');
}

let container: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
	if (container && document.body.contains(container)) return container;
	container = document.createElement('div');
	container.setAttribute('aria-label', 'Notifications');
	container.setAttribute('role', 'region');
	container.className = 'error-toast-container';
	document.body.appendChild(container);
	return container;
}
