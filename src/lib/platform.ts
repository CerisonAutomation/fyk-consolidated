/**
 * Web platform capability layer.
 * Everything here is feature-detected and degrades silently. Nothing is claimed
 * as available unless the browser actually exposes it right now.
 */

export type CapId =
	| "webcrypto"
	| "passkeys"
	| "webgpu"
	| "webrtc"
	| "webspeech"
	| "speechsynth"
	| "mediarecorder"
	| "vibration"
	| "wakelock"
	| "idle"
	| "badging"
	| "notifications"
	| "share"
	| "sharefiles"
	| "fsaccess"
	| "opfs"
	| "indexeddb"
	| "compression"
	| "barcode"
	| "nfc"
	| "netinfo"
	| "viewtransitions"
	| "popover"
	| "anchor"
	| "containerq"
	| "scrolltimeline"
	| "mediasession"
	| "broadcast"
	| "contacts"
	| "serviceworker"
	| "offscreen"
	| "webworker"
	| "storagepersist"
	| "eyedropper";

export type Capability = {
	id: CapId;
	label: string;
	group: "Security" | "Compute" | "Media" | "Device" | "Storage" | "Interface";
	detail: string;
	supported: boolean;
	used: string;
};

const has = (fn: () => boolean) => {
	try {
		return fn();
	} catch {
		return false;
	}
};

const cssSupports = (prop: string, value: string) =>
	typeof CSS !== "undefined" && !!CSS.supports && CSS.supports(prop, value);

export function detectCapabilities(): Capability[] {
	const nav = navigator as unknown as Record<string, unknown>;
	const win = window as unknown as Record<string, unknown>;

	return [
		{
			id: "webcrypto",
			label: "Web Crypto (AES-GCM + ECDH)",
			group: "Security",
			detail: "Authenticated encryption and key agreement in the browser.",
			supported: has(() => !!crypto.subtle?.deriveKey),
			used: "E2E message encryption via ChatCrypto (AES-GCM-256 + ECDH key agreement)",
		},
		{
			id: "passkeys",
			label: "WebAuthn passkeys",
			group: "Security",
			detail: "Platform authenticator — Face ID, Touch ID, Windows Hello.",
			supported: has(() => typeof PublicKeyCredential !== "undefined"),
			used: "Passwordless sign-in and app unlock",
		},
		{
			id: "webgpu",
			label: "WebGPU",
			group: "Compute",
			detail: "GPU compute shaders via the modern graphics stack.",
			supported: has(() => "gpu" in nav),
			used: "Parallel similarity search over profile embeddings",
		},
		{
			id: "webworker",
			label: "Web Workers",
			group: "Compute",
			detail: "Background threads that keep the main thread responsive.",
			supported: has(() => typeof Worker !== "undefined"),
			used: "Image processing off the UI thread",
		},
		{
			id: "offscreen",
			label: "OffscreenCanvas",
			group: "Compute",
			detail: "Canvas rendering inside a worker.",
			supported: has(() => typeof OffscreenCanvas !== "undefined"),
			used: "Photo re-encode without dropping frames",
		},
		{
			id: "webrtc",
			label: "WebRTC",
			group: "Media",
			detail: "Peer-to-peer audio and video with real media tracks.",
			supported: has(() => typeof RTCPeerConnection !== "undefined"),
			used: "Voice and video calling with WebRTC + Supabase Realtime signalling",
		},
		{
			id: "mediarecorder",
			label: "MediaRecorder",
			group: "Media",
			detail: "Encode microphone audio in the browser.",
			supported: has(() => typeof MediaRecorder !== "undefined"),
			used: "Voice messages with live waveforms",
		},
		{
			id: "webspeech",
			label: "Speech recognition",
			group: "Media",
			detail: "Platform speech-to-text.",
			supported: has(
				() => "SpeechRecognition" in win || "webkitSpeechRecognition" in win,
			),
			used: "Voice navigation and dictation",
		},
		{
			id: "speechsynth",
			label: "Speech synthesis",
			group: "Media",
			detail: "Text-to-speech read-back.",
			supported: has(() => typeof speechSynthesis !== "undefined"),
			used: "Reading conversations aloud",
		},
		{
			id: "mediasession",
			label: "Media Session",
			group: "Media",
			detail: "Lock-screen and hardware media controls.",
			supported: has(() => "mediaSession" in nav),
			used: "Voice-note playback controls",
		},
		{
			id: "vibration",
			label: "Vibration",
			group: "Device",
			detail: "Haptic feedback patterns.",
			supported: has(() => "vibrate" in nav),
			used: "Distinct haptics for Like, Tap and Woof",
		},
		{
			id: "wakelock",
			label: "Screen Wake Lock",
			group: "Device",
			detail: "Keeps the display awake.",
			supported: has(() => "wakeLock" in nav),
			used: "Holds the screen on during a safety check-in",
		},
		{
			id: "idle",
			label: "Idle Detection",
			group: "Device",
			detail: "Reports when the user steps away.",
			supported: has(() => "IdleDetector" in win),
			used: "Automatic app lock",
		},
		{
			id: "barcode",
			label: "Barcode Detector",
			group: "Device",
			detail: "Native code scanning without a library.",
			supported: has(() => "BarcodeDetector" in win),
			used: "Scanning a party-mode code",
		},
		{
			id: "nfc",
			label: "Web NFC",
			group: "Device",
			detail: "Read and write NFC tags.",
			supported: has(() => "NDEFReader" in win),
			used: "Tap-to-swap profiles in person",
		},
		{
			id: "netinfo",
			label: "Network Information",
			group: "Device",
			detail: "Effective connection type and data-saver preference.",
			supported: has(() => "connection" in nav),
			used: "Drops image quality on slow links",
		},
		{
			id: "contacts",
			label: "Contact Picker",
			group: "Device",
			detail: "Pick a contact without reading the address book.",
			supported: has(() => "contacts" in nav),
			used: "Choosing a trusted contact for check-ins",
		},
		{
			id: "notifications",
			label: "Notifications",
			group: "Device",
			detail: "System notifications.",
			supported: has(() => "Notification" in win),
			used: "Match and message alerts",
		},
		{
			id: "badging",
			label: "App Badging",
			group: "Device",
			detail: "Unread count on the installed app icon.",
			supported: has(() => "setAppBadge" in nav),
			used: "Unread badge on the home screen",
		},
		{
			id: "share",
			label: "Web Share",
			group: "Device",
			detail: "Native share sheet.",
			supported: has(() => "share" in nav),
			used: "Sharing events and profiles",
		},
		{
			id: "sharefiles",
			label: "Web Share (files)",
			group: "Device",
			detail: "Share generated files, not just links.",
			supported: has(() => "canShare" in nav),
			used: "Sharing calendar invites and exports",
		},
		{
			id: "indexeddb",
			label: "IndexedDB",
			group: "Storage",
			detail: "Structured local database.",
			supported: has(() => "indexedDB" in win),
			used: "Local-first persistence for every screen",
		},
		{
			id: "opfs",
			label: "Origin Private File System",
			group: "Storage",
			detail: "Fast sandboxed file storage.",
			supported: has(() => !!navigator.storage?.getDirectory),
			used: "Encrypted blobs for photos and voice notes",
		},
		{
			id: "storagepersist",
			label: "Persistent Storage",
			group: "Storage",
			detail: "Asks the browser not to evict your data.",
			supported: has(() => !!navigator.storage?.persist),
			used: "Keeping your data through storage pressure",
		},
		{
			id: "fsaccess",
			label: "File System Access",
			group: "Storage",
			detail: "Write directly to a file the user picks.",
			supported: has(() => "showSaveFilePicker" in win),
			used: "Saving your data export where you choose",
		},
		{
			id: "compression",
			label: "CompressionStream",
			group: "Storage",
			detail: "Native gzip, no library.",
			supported: has(() => typeof CompressionStream !== "undefined"),
			used: "Compressing local diagnostic exports",
		},
		{
			id: "serviceworker",
			label: "Service Worker",
			group: "Storage",
			detail: "Offline shell and background sync.",
			supported: has(() => "serviceWorker" in nav),
			used: "Working with no connection",
		},
		{
			id: "broadcast",
			label: "Broadcast Channel",
			group: "Storage",
			detail: "Messaging between tabs of the same app.",
			supported: has(() => typeof BroadcastChannel !== "undefined"),
			used: "Keeping multiple tabs in sync",
		},
		{
			id: "viewtransitions",
			label: "View Transitions",
			group: "Interface",
			detail: "Browser-native morphing between states.",
			supported: has(() => "startViewTransition" in document),
			used: "Screen and card transitions",
		},
		{
			id: "popover",
			label: "Popover API",
			group: "Interface",
			detail: "Top-layer popovers with native light dismiss.",
			supported: has(() => Object.hasOwn(HTMLElement.prototype, "popover")),
			used: "Menus and pickers",
		},
		{
			id: "anchor",
			label: "CSS Anchor Positioning",
			group: "Interface",
			detail: "Anchor a popover to its trigger without JavaScript.",
			supported: cssSupports("anchor-name", "--a"),
			used: "Menu placement",
		},
		{
			id: "containerq",
			label: "Container Queries",
			group: "Interface",
			detail: "Components that respond to their own width.",
			supported: cssSupports("container-type", "inline-size"),
			used: "Cards that adapt to their column",
		},
		{
			id: "scrolltimeline",
			label: "Scroll-driven Animations",
			group: "Interface",
			detail: "Animation driven by scroll position, off the main thread.",
			supported: cssSupports("animation-timeline", "view()"),
			used: "Reveal animations with zero JS cost",
		},
		{
			id: "eyedropper",
			label: "EyeDropper",
			group: "Interface",
			detail: "Sample a colour from anywhere on screen.",
			supported: has(() => "EyeDropper" in win),
			used: "Accent colour picker",
		},
	];
}

/* -------------------------------- haptics ------------------------------- */

const PATTERNS: Record<string, number[]> = {
	tap: [8],
	like: [12, 28, 12],
	woof: [22, 40, 22, 40, 30],
	match: [18, 50, 18, 50, 60],
	error: [50, 30, 50],
	success: [10, 24, 14],
};

export function haptic(kind: keyof typeof PATTERNS | number[]) {
	if (!("vibrate" in navigator)) return false;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
		return false;
	const pattern = Array.isArray(kind)
		? kind
		: (PATTERNS[kind] ?? PATTERNS.tap!);
	try {
		return navigator.vibrate(pattern);
	} catch {
		return false;
	}
}

/* ------------------------------- wake lock ------------------------------ */

let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<boolean> {
	if (!("wakeLock" in navigator)) return false;
	try {
		wakeLock = await navigator.wakeLock.request("screen");
		wakeLock.addEventListener("release", () => {
			wakeLock = null;
		});
		return true;
	} catch {
		return false;
	}
}

export function releaseWakeLock() {
	void wakeLock?.release();
	wakeLock = null;
}

/* -------------------------------- badging ------------------------------- */

export function setBadge(count: number) {
	const n = navigator as Navigator & {
		setAppBadge?: (c?: number) => Promise<void>;
		clearAppBadge?: () => Promise<void>;
	};
	try {
		if (count > 0) void n.setAppBadge?.(count);
		else void n.clearAppBadge?.();
	} catch {
		/* not installed */
	}
}

/* ----------------------------- notifications ---------------------------- */

export async function requestNotifications(): Promise<NotificationPermission> {
	if (!("Notification" in window)) return "denied";
	if (Notification.permission !== "default") return Notification.permission;
	try {
		return await Notification.requestPermission();
	} catch {
		return "denied";
	}
}

export function notify(title: string, body: string) {
	if (!("Notification" in window) || Notification.permission !== "granted")
		return false;
	try {
		new Notification(title, { body, tag: "fyk", icon: undefined });
		return true;
	} catch {
		return false;
	}
}

/* --------------------------------- share -------------------------------- */

export async function shareContent(data: {
	title: string;
	text: string;
	url?: string;
	files?: File[];
}) {
	if (!navigator.share) return false;
	try {
		if (data.files?.length && navigator.canShare?.({ files: data.files })) {
			await navigator.share({
				title: data.title,
				text: data.text,
				files: data.files,
			});
		} else {
			await navigator.share({
				title: data.title,
				text: data.text,
				url: data.url,
			});
		}
		return true;
	} catch {
		return false;
	}
}

/* ------------------------------ file saving ----------------------------- */

/** Uses the File System Access API when present so the user picks the destination. */
export async function saveFile(
	filename: string,
	blob: Blob,
): Promise<"picker" | "download"> {
	const w = window as unknown as {
		showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle>;
	};
	if (w.showSaveFilePicker) {
		try {
			const handle = await w.showSaveFilePicker({
				suggestedName: filename,
				types: [
					{
						description: "FYK export",
						accept: {
							[blob.type || "application/octet-stream"]: [
								`.${filename.split(".").pop()}`,
							],
						},
					},
				],
			});
			const writable = await handle.createWritable();
			await writable.write(blob);
			await writable.close();
			return "picker";
		} catch {
			/* user cancelled — fall through to download */
		}
	}
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 2000);
	return "download";
}

/* ------------------------------ network info ---------------------------- */

export type NetInfo = {
	effectiveType: string;
	downlink: number;
	saveData: boolean;
	slow: boolean;
};

export function networkInfo(): NetInfo {
	const c = (
		navigator as Navigator & {
			connection?: {
				effectiveType?: string;
				downlink?: number;
				saveData?: boolean;
			};
		}
	).connection;
	const effectiveType = c?.effectiveType ?? "unknown";
	return {
		effectiveType,
		downlink: c?.downlink ?? 0,
		saveData: !!c?.saveData,
		slow:
			effectiveType === "slow-2g" || effectiveType === "2g" || !!c?.saveData,
	};
}

/* ---------------------------- view transitions -------------------------- */

/** Wraps a state update in a native View Transition when the browser supports it. */
export function withViewTransition(update: () => void) {
	const d = document as Document & {
		startViewTransition?: (cb: () => void) => { finished: Promise<void> };
	};
	if (
		!d.startViewTransition ||
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	) {
		update();
		return;
	}
	d.startViewTransition(update);
}

/* ------------------------------ idle detection -------------------------- */

export async function startIdleWatch(
	onIdle: () => void,
	threshold = 300_000,
): Promise<() => void> {
	const W = window as unknown as {
		IdleDetector?: new () => EventTarget & {
			start: (o: unknown) => Promise<void>;
			userState: string;
			screenState: string;
		};
	};
	if (W.IdleDetector) {
		try {
			const permission = await (
				W.IdleDetector as unknown as {
					requestPermission: () => Promise<string>;
				}
			).requestPermission();
			if (permission === "granted") {
				const detector = new W.IdleDetector();
				const handler = () => {
					if (
						detector.userState === "idle" ||
						detector.screenState === "locked"
					)
						onIdle();
				};
				detector.addEventListener("change", handler);
				await detector.start({ threshold });
				return () => detector.removeEventListener("change", handler);
			}
		} catch {
			/* fall through to the timer */
		}
	}
	// Fallback: activity timer, which works everywhere.
	let timer = window.setTimeout(onIdle, threshold);
	const reset = () => {
		clearTimeout(timer);
		timer = window.setTimeout(onIdle, threshold);
	};
	const events = ["pointerdown", "keydown", "scroll", "visibilitychange"];
	events.forEach((e) => {
		document.addEventListener(e, reset, { passive: true });
	});
	return () => {
		clearTimeout(timer);
		events.forEach((e) => {
			document.removeEventListener(e, reset);
		});
	};
}

/* ------------------------------ media session --------------------------- */

export function setMediaSession(
	title: string,
	artist: string,
	handlers: { play?: () => void; pause?: () => void },
) {
	if (!("mediaSession" in navigator)) return;
	try {
		navigator.mediaSession.metadata = new MediaMetadata({
			title,
			artist,
			album: "FYK",
		});
		if (handlers.play)
			navigator.mediaSession.setActionHandler("play", handlers.play);
		if (handlers.pause)
			navigator.mediaSession.setActionHandler("pause", handlers.pause);
	} catch {
		/* unsupported action */
	}
}

/* ----------------------------- persistent storage ----------------------- */

export async function requestPersistentStorage(): Promise<{
	persisted: boolean;
	quotaMb: number;
	usedMb: number;
}> {
	let persisted = false;
	let quotaMb = 0;
	let usedMb = 0;
	try {
		persisted = (await navigator.storage?.persisted?.()) ?? false;
		if (!persisted) persisted = (await navigator.storage?.persist?.()) ?? false;
		const est = await navigator.storage?.estimate?.();
		quotaMb = Math.round((est?.quota ?? 0) / 1_048_576);
		usedMb = Math.round(((est?.usage ?? 0) / 1_048_576) * 10) / 10;
	} catch {
		/* unavailable */
	}
	return { persisted, quotaMb, usedMb };
}
