/**
 * Format media duration in MM:SS or HH:MM:SS format.
 * Extracted from open-grind and converted for React/TypeScript.
 */
export function formatMediaDuration(seconds: number): string {
	const total =
		Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
	const minutes = Math.floor(total / 60);
	const paddedSeconds = String(total % 60).padStart(2, '0');
	if (minutes < 60) return `${minutes}:${paddedSeconds}`;
	const paddedMinutes = String(minutes % 60).padStart(2, '0');
	return `${Math.floor(minutes / 60)}:${paddedMinutes}:${paddedSeconds}`;
}

/**
 * Format a timestamp as a human-readable relative time string.
 * Shows "Just now", "X mins", "X hrs", "Yesterday", weekday name, or "MMM d".
 */
export function formatTimeRelative(date: number): string {
	if (date < 0) return '';
	const diff = Date.now() - date;
	const MINUTE = 60 * 1000;
	const HOUR = 60 * MINUTE;
	const DAY = 24 * HOUR;

	if (diff < MINUTE) return 'Just now';
	if (diff < HOUR) {
		const mins = Math.floor(diff / MINUTE);
		return `${mins} min${mins > 1 ? 's' : ''}`;
	}
	if (diff < DAY) {
		const hrs = Math.floor(diff / HOUR);
		return `${hrs} hr${hrs > 1 ? 's' : ''}`;
	}
	if (diff < 2 * DAY) return 'Yesterday';
	if (diff < 7 * DAY) {
		return new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
	}
	return new Date(date).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
	});
}

/**
 * Format a timestamp for chat message display.
 * Today: "HH:MM", yesterday: "Yesterday HH:MM", this year: "MMM d HH:MM", else: "MM/dd/yy HH:MM"
 */
export function formatMessageTime(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	const time = `${hours}:${minutes}`;

	const isToday =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();

	if (isToday) return time;

	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const isYesterday =
		date.getFullYear() === yesterday.getFullYear() &&
		date.getMonth() === yesterday.getMonth() &&
		date.getDate() === yesterday.getDate();

	if (isYesterday) return `Yesterday ${time}`;

	if (date.getFullYear() === now.getFullYear()) {
		return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
	}

	return `${date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })} ${time}`;
}

/**
 * Format a timestamp for conversation list display.
 * Similar to formatTimeRelative but optimized for inbox rows.
 */
export function formatConversationTime(timestamp: number): string {
	return formatTimeRelative(timestamp);
}
