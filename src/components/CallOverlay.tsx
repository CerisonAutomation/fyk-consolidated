import {
	Mic,
	MicOff,
	MonitorUp,
	PhoneOff,
	RefreshCw,
	ShieldCheck,
	Video as VideoIcon,
	VideoOff,
	Volume2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { px } from "@/lib/data";
import { findPerson } from "@/lib/profiles";
import { useStore } from "@/lib/store";
import {
	DEFAULT_ICE_SERVERS,
	joinCallChannel,
	type SignalCallbacks,
} from "@/lib/webrtc-signaling";
import { cn } from "@/utils/cn";

/**
 * Real WebRTC calling with Supabase Realtime broadcast signalling.
 *
 * Caller flow:
 *   1. Mount -> getUserMedia -> create RTCPeerConnection -> create offer
 *   2. Join signalling channel, broadcast "ringing" + SDP offer
 *   3. Receive SDP answer from callee, set remote description
 *   4. Exchange ICE candidates through the channel
 *   5. Remote stream arrives -> render in the remote tile
 *
 * Callee flow (handled when an "offer" event arrives from another tab/device):
 *   1. Receive SDP offer on the channel -> create RTCPeerConnection -> set remote desc
 *   2. Create answer, broadcast it back
 *   3. Exchange ICE candidates
 *   4. Remote stream arrives -> render in the remote tile
 *
 * Cleanup: all tracks are stopped and the peer connection + channel are closed
 * when the call ends or the component unmounts.
 */
export function CallOverlay() {
	const { call, endCall, toast } = useStore();
	const person = findPerson(call?.personId);
	const localVideo = useRef<HTMLVideoElement>(null);
	const remoteVideo = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const pcRef = useRef<RTCPeerConnection | null>(null);
	const signalRef = useRef<{
		send: (e: any) => void;
		leave: () => void;
	} | null>(null);
	const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

	const [micOn, setMicOn] = useState(true);
	const [camOn, setCamOn] = useState(true);
	const [speaker, setSpeaker] = useState(true);
	const [seconds, setSeconds] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [facing, setFacing] = useState<"user" | "environment">("user");
	const [callStatus, setCallStatus] = useState<
		"ringing" | "connected" | "ended"
	>(call?.status ?? "ringing");

	const wantsVideo = call?.mode === "video";

	// ── Helper: tear down everything ──────────────────────────────────────
	const cleanup = useCallback(() => {
		streamRef.current?.getTracks().forEach((t) => t.stop());
		streamRef.current = null;
		pcRef.current?.close();
		pcRef.current = null;
		signalRef.current?.leave();
		signalRef.current = null;
		pendingCandidatesRef.current = [];
	}, []);

	// ── Main effect: media + peer connection + signalling ─────────────────
	useEffect(() => {
		if (!call) return;
		let cancelled = false;

		(async () => {
			try {
				// 1. Acquire local media.
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
					video: wantsVideo
						? { facingMode: facing, width: { ideal: 1280 } }
						: false,
				});
				if (cancelled) {
					stream.getTracks().forEach((t) => t.stop());
					return;
				}
				streamRef.current = stream;
				if (localVideo.current) localVideo.current.srcObject = stream;

				// 2. Create a single RTCPeerConnection (not a loopback pair).
				const pc = new RTCPeerConnection(DEFAULT_ICE_SERVERS);
				pcRef.current = pc;

				// Add local tracks to the peer connection.
				stream.getTracks().forEach((track) => pc.addTrack(track, stream));

				// When we receive the remote stream, display it.
				pc.ontrack = (e) => {
					if (!cancelled && remoteVideo.current && e.streams[0]) {
						remoteVideo.current.srcObject = e.streams[0];
						setCallStatus("connected");
					}
				};

				// Buffer ICE candidates that arrive before the remote description is set.
				pc.onicecandidate = (e) => {
					if (e.candidate && signalRef.current) {
						signalRef.current.send({
							type: "ice-candidate",
							candidate: e.candidate.toJSON(),
							senderId: call.userId,
						});
					}
				};

				pc.oniceconnectionstatechange = () => {
					const state = pc.iceConnectionState;
					if (state === "failed" || state === "disconnected") {
						if (!cancelled) {
							setCallStatus("ended");
							endCall();
						}
					}
				};

				// 3. Join the signalling channel.
				const signalCallbacks: SignalCallbacks = {
					onOffer: async (sdp, _senderId) => {
						// Callee receives the offer.
						if (cancelled || !pcRef.current) return;
						try {
							const offer = new RTCSessionDescription({ type: "offer", sdp });
							await pcRef.current.setRemoteDescription(offer);
							// Flush any buffered ICE candidates.
							for (const c of pendingCandidatesRef.current) {
								await pcRef.current.addIceCandidate(c).catch(() => {});
							}
							pendingCandidatesRef.current = [];
							// Create and send the answer.
							const answer = await pcRef.current.createAnswer();
							await pcRef.current.setLocalDescription(answer);
							signalRef.current?.send({
								type: "answer",
								sdp: answer.sdp ?? "",
								senderId: call.userId,
							});
							setCallStatus("connected");
						} catch (err) {
							console.error("Failed to handle offer:", err);
						}
					},
					onAnswer: async (sdp, _senderId) => {
						// Caller receives the answer.
						if (cancelled || !pcRef.current) return;
						try {
							const answer = new RTCSessionDescription({ type: "answer", sdp });
							await pcRef.current.setRemoteDescription(answer);
							// Flush any buffered ICE candidates.
							for (const c of pendingCandidatesRef.current) {
								await pcRef.current.addIceCandidate(c).catch(() => {});
							}
							pendingCandidatesRef.current = [];
						} catch (err) {
							console.error("Failed to handle answer:", err);
						}
					},
					onIceCandidate: async (candidate) => {
						if (cancelled || !pcRef.current) return;
						try {
							if (pcRef.current.remoteDescription) {
								await pcRef.current.addIceCandidate(candidate);
							} else {
								pendingCandidatesRef.current.push(candidate);
							}
						} catch {
							// Candidate may be stale; ignore.
						}
					},
					onHangup: () => {
						if (!cancelled) {
							setCallStatus("ended");
							endCall();
						}
					},
				};

				const signalling = joinCallChannel(
					call.conversationId,
					call.userId,
					signalCallbacks,
				);
				signalRef.current = signalling;

				// 4. Caller: create offer and broadcast it.
				const offer = await pc.createOffer();
				await pc.setLocalDescription(offer);
				signalling.send({
					type: "offer",
					sdp: offer.sdp ?? "",
					senderId: call.userId,
				});
			} catch (e) {
				if (cancelled) return;
				const name = (e as DOMException)?.name;
				setError(
					name === "NotAllowedError"
						? "Camera and microphone permission was declined. You can still take the call with media off."
						: "No camera or microphone was found on this device.",
				);
			}
		})();

		return () => {
			cancelled = true;
			cleanup();
		};
	}, [
		call?.personId,
		call?.conversationId,
		call?.userId,
		wantsVideo,
		facing,
		call,
		cleanup,
		endCall,
	]);

	// ── Timer: count seconds while connected ──────────────────────────────
	useEffect(() => {
		if (callStatus !== "connected") return;
		const t = setInterval(() => setSeconds((s) => s + 1), 1000);
		return () => clearInterval(t);
	}, [callStatus]);

	if (!call || !person) return null;

	const toggleMic = () => {
		const track = streamRef.current?.getAudioTracks()[0];
		if (track) track.enabled = !track.enabled;
		setMicOn((v) => !v);
	};

	const toggleCam = () => {
		const track = streamRef.current?.getVideoTracks()[0];
		if (track) track.enabled = !track.enabled;
		setCamOn((v) => !v);
	};

	const shareScreen = async () => {
		try {
			const display = await navigator.mediaDevices.getDisplayMedia({
				video: true,
			});
			const sender = pcRef.current
				?.getSenders()
				.find((s) => s.track?.kind === "video");
			const track = display.getVideoTracks()[0];
			if (sender && track) {
				await sender.replaceTrack(track);
				track.onended = () => {
					const cam = streamRef.current?.getVideoTracks()[0];
					if (cam) void sender.replaceTrack(cam);
				};
				toast(
					"Screen sharing started: Stop it from your browser bar at any time.",
					"gold",
				);
			}
		} catch {
			toast("Screen share cancelled", "violet");
		}
	};

	const hangUp = () => {
		// Notify the remote peer before tearing down.
		signalRef.current?.send({
			type: "hangup",
			senderId: call.userId,
		});
		setCallStatus("ended");
		endCall();
	};

	const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label={`Call with ${person.name}`}
			className="fixed inset-0 z-[130] flex flex-col bg-[#05060a]"
		>
			<div className="anim-fade relative flex-1 overflow-hidden">
				{wantsVideo ? (
					<>
						<video
							ref={remoteVideo}
							autoPlay
							playsInline
							muted={!speaker}
							className="h-full w-full bg-black object-cover"
						/>
						<img
							src={px(person.photo, 900, 1200)}
							alt=""
							aria-hidden="true"
							className={cn(
								"absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
								callStatus === "connected" ? "opacity-0" : "opacity-100",
							)}
						/>
						<video
							ref={localVideo}
							autoPlay
							playsInline
							muted
							className="absolute bottom-4 right-4 h-[190px] w-[130px] rounded-2xl border border-white/15 object-cover shadow-2xl sm:h-[220px] sm:w-[150px]"
						/>
					</>
				) : (
					<div className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-[#12141b] to-[#05060a]">
						<span className="relative">
							<span className="anim-ping absolute inset-0 rounded-full bg-gold/25" />
							<img
								src={px(person.photo, 320, 320)}
								alt=""
								aria-hidden="true"
								className="relative h-[150px] w-[150px] rounded-full object-cover ring-4 ring-gold/35"
							/>
						</span>
						<video
							ref={remoteVideo}
							autoPlay
							playsInline
							muted={!speaker}
							className="hidden"
						/>
						<video
							ref={localVideo}
							autoPlay
							playsInline
							muted
							className="hidden"
						/>
					</div>
				)}

				<div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/75 to-transparent p-5">
					<div>
						<h2 className="text-[24px] font-semibold text-white">
							{person.name}, {person.age}
						</h2>
						<p className="mt-1 text-[13.5px] text-white/70">
							{callStatus === "ringing"
								? "Calling\u2026"
								: callStatus === "ended"
									? "Call ended"
									: `Connected \u00B7 ${mmss}`}
						</p>
					</div>
					<span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11.5px] font-medium text-white/80 backdrop-blur">
						<ShieldCheck className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
						End-to-end encrypted
					</span>
				</div>

				{error && (
					<p
						role="alert"
						className="absolute inset-x-4 bottom-28 rounded-xl border border-white/10 bg-black/70 p-3.5 text-center text-[13px] text-white/85 backdrop-blur"
					>
						{error}
					</p>
				)}
				{!error && callStatus === "ringing" && (
					<p className="absolute inset-x-4 bottom-28 text-center text-[11.5px] text-white/45">
						Waiting for peer to answer&hellip;
					</p>
				)}
			</div>

			<div className="safe-b flex items-center justify-center gap-3 border-t border-white/10 bg-black/85 px-4 py-5 backdrop-blur">
				<CallButton
					active={micOn}
					onClick={toggleMic}
					label={micOn ? "Mute microphone" : "Unmute microphone"}
				>
					{micOn ? (
						<Mic className="h-[21px] w-[21px]" />
					) : (
						<MicOff className="h-[21px] w-[21px]" />
					)}
				</CallButton>
				{wantsVideo && (
					<CallButton
						active={camOn}
						onClick={toggleCam}
						label={camOn ? "Turn camera off" : "Turn camera on"}
					>
						{camOn ? (
							<VideoIcon className="h-[21px] w-[21px]" />
						) : (
							<VideoOff className="h-[21px] w-[21px]" />
						)}
					</CallButton>
				)}
				<CallButton
					active={speaker}
					onClick={() => setSpeaker((v) => !v)}
					label="Toggle speaker"
				>
					<Volume2 className="h-[21px] w-[21px]" />
				</CallButton>
				{wantsVideo && (
					<>
						<CallButton
							active
							onClick={() =>
								setFacing((f) => (f === "user" ? "environment" : "user"))
							}
							label="Flip camera"
						>
							<RefreshCw className="h-[21px] w-[21px]" />
						</CallButton>
						<CallButton active onClick={shareScreen} label="Share your screen">
							<MonitorUp className="h-[21px] w-[21px]" />
						</CallButton>
					</>
				)}
				<button
					type="button"
					onClick={hangUp}
					aria-label="End call"
					className="press ml-2 grid h-[58px] w-[58px] place-items-center rounded-full bg-live text-white hover:brightness-110"
				>
					<PhoneOff className="h-[23px] w-[23px]" />
				</button>
			</div>
		</div>
	);
}

function CallButton({
	children,
	active,
	onClick,
	label,
}: {
	children: React.ReactNode;
	active: boolean;
	onClick: () => void;
	label: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			aria-pressed={active}
			className={cn(
				"press grid h-[52px] w-[52px] place-items-center rounded-full border transition-colors",
				active
					? "border-white/15 bg-white/12 text-white"
					: "border-white/10 bg-white/5 text-white/45",
			)}
		>
			{children}
		</button>
	);
}
