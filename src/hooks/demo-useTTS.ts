import { useCallback, useRef, useState } from "react";

/**
 * Hook for text-to-speech playback using the browser's built-in SpeechSynthesis API.
 *
 * No server round-trip required -- the OS synthesises speech locally.
 */
export function useTTS() {
	const [playingId, setPlayingId] = useState<string | null>(null);
	const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

	const synth =
		typeof window !== "undefined" ? window.speechSynthesis : null;

	const speak = useCallback(
		async (text: string, id: string) => {
			if (!synth) {
				console.warn("SpeechSynthesis is not supported in this browser.");
				return;
			}

			// Cancel any in-progress utterance
			synth.cancel();

			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang = "en-US";
			utterance.rate = 1;
			utterance.pitch = 1;

			// Prefer a natural-sounding voice when available
			const voices = synth.getVoices();
			const preferred =
				voices.find(
					(v) =>
						v.lang.startsWith("en") &&
						(v.name.includes("Samantha") ||
							v.name.includes("Google") ||
							v.name.includes("Microsoft") ||
							v.name.includes("Enhanced")),
				) ?? voices.find((v) => v.lang.startsWith("en"));
			if (preferred) {
				utterance.voice = preferred;
			}

			utterance.onend = () => {
				setPlayingId(null);
				utteranceRef.current = null;
			};

			utterance.onerror = () => {
				setPlayingId(null);
				utteranceRef.current = null;
			};

			utteranceRef.current = utterance;
			setPlayingId(id);
			synth.speak(utterance);
		},
		[synth],
	);

	const stop = useCallback(() => {
		if (synth) {
			synth.cancel();
		}
		utteranceRef.current = null;
		setPlayingId(null);
	}, [synth]);

	return { playingId, speak, stop };
}
