import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function timeAgo(date: string | Date): string {
	const now = new Date();
	const then = new Date(date);
	const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return then.toLocaleDateString();
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
	return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function avatarColor(name: string): string {
	const colors = [
		"#E8121B",
		"#EDB219",
		"#1DB954",
		"#9B59B6",
		"#3498DB",
		"#E67E22",
		"#1ABC9C",
		"#E74C3C",
	];
	let hash = 0;
	for (let i = 0; i < name.length; i++)
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	return colors[Math.abs(hash) % colors.length];
}

export function initials(name: string): string {
	return name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

export function gradient(seed: string): string {
	const colors = [
		"from-rose-500 to-purple-500",
		"from-blue-500 to-cyan-500",
		"from-amber-500 to-orange-500",
		"from-emerald-500 to-teal-500",
		"from-violet-500 to-pink-500",
		"from-indigo-500 to-blue-500",
	];
	let hash = 0;
	for (let i = 0; i < seed.length; i++)
		hash = seed.charCodeAt(i) + ((hash << 5) - hash);
	return colors[Math.abs(hash) % colors.length];
}
