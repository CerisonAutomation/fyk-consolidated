import { useCallback, useRef, useState } from "react";

/**
 * Minimal interface for the Web Speech API's SpeechRecognition.
 *
 * The DOM lib included in this project does not ship SpeechRecognition types,
 * so we declare just the subset we need rather than pulling in a full
 * @types/web-speech-api dependency.
 */
interface SpeechRecognitionLike {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onstart: (() => void) | null;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

interface SpeechRecognitionConstructor {
	new (): SpeechRecognitionLike;
}

/**
 * Hook for recording audio and transcribing it via the browser's Web Speech API.
 *
 * Uses SpeechRecognition for real-time speech-to-text. Falls back to a silent
 * no-op when the browser does not support the API (e.g. Firefox on desktop).
 */
export function useAudioRecorder() {
	const [isRecording, setIsRecording] = useState(false);
	const [isTranscribing, setIsTranscribing] = useState(false);
	const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
	const finalTranscriptRef = useRef<string>("");
	const resolveRef = useRef<((text: string | null) => void) | null>(null);

	const SpeechRecognitionCtor: SpeechRecognitionConstructor | null =
		typeof window !== "undefined"
			? (window as unknown as Record<string, unknown>)
					.SpeechRecognition as SpeechRecognitionConstructor | undefined ??
				(window as unknown as Record<string, unknown>)
					.webkitSpeechRecognition as SpeechRecognitionConstructor | undefined ??
				null
			: null;

	const startRecording = useCallback(async () => {
		if (!SpeechRecognitionCtor) {
			alert(
				"Speech recognition is not supported in this browser. Please try Chrome or Edge.",
			);
			return;
		}

		const recognition = new SpeechRecognitionCtor();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = "en-US";

		recognition.onstart = () => {
			setIsRecording(true);
		};

		recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			console.error("Speech recognition error:", event.error);
			setIsRecording(false);
			setIsTranscribing(false);
			if (resolveRef.current) {
				resolveRef.current(null);
				resolveRef.current = null;
			}
		};

		recognition.onend = () => {
			// Only clear recording state if we didn't already stop via stopRecording.
			// The onend fires after stop() is called.
			setIsRecording(false);
		};

		recognitionRef.current = recognition;
		finalTranscriptRef.current = "";

		try {
			recognition.start();
		} catch (error) {
			console.error("Failed to start speech recognition:", error);
			setIsRecording(false);
		}
	}, [SpeechRecognitionCtor]);

	const stopRecording = useCallback(async (): Promise<string | null> => {
		const recognition = recognitionRef.current;
		if (!recognition) {
			return null;
		}

		return new Promise<string | null>((resolve) => {
			resolveRef.current = resolve;
			setIsRecording(false);
			setIsTranscribing(true);

			// Collect final transcript once recognition stops
			recognition.onresult = (event: SpeechRecognitionEvent) => {
				for (let i = event.resultIndex; i < event.results.length; i++) {
					const transcript = event.results[i][0].transcript;
					if (event.results[i].isFinal) {
						finalTranscriptRef.current += transcript;
					}
				}
			};

			recognition.onend = () => {
				setIsRecording(false);
				setIsTranscribing(false);
				const text = finalTranscriptRef.current.trim() || null;
				resolveRef.current?.(text);
				resolveRef.current = null;
				recognitionRef.current = null;
			};

			recognition.stop();
		});
	}, []);

	return { isRecording, isTranscribing, startRecording, stopRecording };
}
