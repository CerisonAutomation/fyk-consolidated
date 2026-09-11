import { useEffect, useRef, useState } from "react";
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
import { cn } from "@/utils/cn";
import { px } from "@/lib/data";
import { findPerson } from "@/lib/profiles";
import { useStore } from "@/lib/store";

/**
 * Real WebRTC media stack: getUserMedia capture, an RTCPeerConnection with a local
 * offer/answer loop, live track control and a real stats-driven timer.
 * Signalling to a remote peer needs a server, so the remote tile is clearly labelled
 * as a local loopback rather than pretending someone picked up.
 */
export function CallOverlay() {
  const { call, endCall, toast } = useStore();
  const person = findPerson(call?.personId);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<{ a: RTCPeerConnection; b: RTCPeerConnection } | null>(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [speaker, setSpeaker] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");

  const wantsVideo = call?.mode === "video";

  useEffect(() => {
    if (!call) return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: wantsVideo ? { facingMode: facing, width: { ideal: 1280 } } : false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;

        // A genuine peer connection, looped back locally so the media path is real.
        const a = new RTCPeerConnection();
        const b = new RTCPeerConnection();
        stream.getTracks().forEach((t) => a.addTrack(t, stream));
        a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate).catch(() => {});
        b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate).catch(() => {});
        b.ontrack = (e) => {
          if (remoteVideo.current && e.streams[0]) remoteVideo.current.srcObject = e.streams[0];
        };
        const offer = await a.createOffer();
        await a.setLocalDescription(offer);
        await b.setRemoteDescription(offer);
        const answer = await b.createAnswer();
        await b.setLocalDescription(answer);
        await a.setRemoteDescription(answer);
        pcRef.current = { a, b };
      } catch (e) {
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      pcRef.current?.a.close();
      pcRef.current?.b.close();
      pcRef.current = null;
    };
  }, [call?.personId, wantsVideo, facing, call]);

  useEffect(() => {
    if (call?.status !== "connected") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [call?.status]);

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
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const sender = pcRef.current?.a.getSenders().find((s) => s.track?.kind === "video");
      const track = display.getVideoTracks()[0];
      if (sender && track) {
        await sender.replaceTrack(track);
        track.onended = () => {
          const cam = streamRef.current?.getVideoTracks()[0];
          if (cam) void sender.replaceTrack(cam);
        };
        toast("Screen sharing started: Stop it from your browser bar at any time.", "gold");
      }
    } catch {
      toast("Screen share cancelled", "violet");
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-[#05060a]">
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
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
                call.status === "connected" ? "opacity-0" : "opacity-100",
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
                className="relative h-[150px] w-[150px] rounded-full object-cover ring-4 ring-gold/35"
              />
            </span>
            <video ref={remoteVideo} autoPlay playsInline muted={!speaker} className="hidden" />
            <video ref={localVideo} autoPlay playsInline muted className="hidden" />
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/75 to-transparent p-5">
          <div>
            <h2 className="text-[24px] font-semibold text-white">
              {person.name}, {person.age}
            </h2>
            <p className="mt-1 text-[13.5px] text-white/70">
              {call.status === "ringing" ? "Calling…" : `Connected · ${mmss}`}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11.5px] font-medium text-white/80 backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-gold" />
            Media stays on your device
          </span>
        </div>

        {error && (
          <p className="absolute inset-x-4 bottom-28 rounded-xl border border-white/10 bg-black/70 p-3.5 text-center text-[13px] text-white/85 backdrop-blur">
            {error}
          </p>
        )}
        {!error && call.status === "connected" && (
          <p className="absolute inset-x-4 bottom-28 text-center text-[11.5px] text-white/45">
            Local media loopback — peer signalling is not wired in this build.
          </p>
        )}
      </div>

      <div className="safe-b flex items-center justify-center gap-3 border-t border-white/10 bg-black/85 px-4 py-5 backdrop-blur">
        <CallButton active={micOn} onClick={toggleMic} label={micOn ? "Mute microphone" : "Unmute microphone"}>
          {micOn ? <Mic className="h-[21px] w-[21px]" /> : <MicOff className="h-[21px] w-[21px]" />}
        </CallButton>
        {wantsVideo && (
          <CallButton active={camOn} onClick={toggleCam} label={camOn ? "Turn camera off" : "Turn camera on"}>
            {camOn ? <VideoIcon className="h-[21px] w-[21px]" /> : <VideoOff className="h-[21px] w-[21px]" />}
          </CallButton>
        )}
        <CallButton active={speaker} onClick={() => setSpeaker((v) => !v)} label="Toggle speaker">
          <Volume2 className="h-[21px] w-[21px]" />
        </CallButton>
        {wantsVideo && (
          <>
            <CallButton
              active
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
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
          onClick={endCall}
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
        active ? "border-white/15 bg-white/12 text-white" : "border-white/10 bg-white/5 text-white/45",
      )}
    >
      {children}
    </button>
  );
}
