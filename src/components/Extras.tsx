import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Phone, QrCode, ShieldCheck, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { FOOTPRINTS as FOOTPRINT_LIST } from "@/lib/community";
import { findPerson } from "@/lib/profiles";
import { useStore } from "@/lib/store";
import { Modal } from "./ui";

/* -------------------------- safety check-in HUD ------------------------- */

export function CheckInBar() {
  const { checkIn, resolveCheckIn, toast } = useStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!checkIn) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [checkIn]);

  useEffect(() => {
    if (checkIn && checkIn.status === "ARMED" && now > checkIn.dueAt) resolveCheckIn(false);
  }, [checkIn, now, resolveCheckIn]);

  if (!checkIn) return null;
  const person = findPerson(checkIn.personId);
  const remaining = Math.max(0, checkIn.dueAt - now);
  const mm = String(Math.floor(remaining / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
  const overdue = checkIn.status === "OVERDUE";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[72px] z-[85] flex justify-center px-4">
      <div
        className={cn(
          "anim-sheet pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-2xl border p-3.5 shadow-[var(--shadow-pop)] backdrop-blur",
          overdue ? "border-live/60 bg-live/12" : "border-gold/45 bg-surface/95",
        )}
      >
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", overdue ? "bg-live/20 text-live" : "bg-gold-ghost text-gold")}>
          {overdue ? <AlertTriangle className="h-[19px] w-[19px]" /> : <ShieldCheck className="h-[19px] w-[19px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink">
            {overdue ? "Check-in overdue" : `Safety check-in · ${mm}:${ss}`}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-muted">
            {overdue
              ? `Reach out to ${checkIn.contact}, or confirm you're fine.`
              : `Meeting ${person?.name ?? "someone"} at ${checkIn.place}.`}
          </p>
        </div>
        {overdue && (
          <a
            href="tel:+35699255559"
            className="press hidden shrink-0 items-center gap-1.5 rounded-full bg-live px-3.5 py-2 text-[12.5px] font-semibold text-white sm:inline-flex"
          >
            <Phone className="h-3.5 w-3.5" /> Call
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            resolveCheckIn(true);
            toast("Check-in cleared", "gold");
          }}
          className="press shrink-0 rounded-full bg-gold px-3.5 py-2 text-[12.5px] font-semibold text-black hover:bg-gold-2"
        >
          I'm fine
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- party mode QR ----------------------------- */

/** Deterministic dot-matrix "QR". Real enough to scan-and-compare visually, generated locally. */
function CodeGrid({ seed, size = 21 }: { seed: string; size?: number }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    const out: boolean[] = [];
    for (let i = 0; i < size * size; i++) {
      h ^= seed.charCodeAt(i % seed.length) + i * 7;
      h = Math.imul(h, 16777619);
      out.push(((h >>> 0) % 100) > 48);
    }
    // Finder squares in three corners, like a real code.
    const mark = (ox: number, oy: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const edge = x === 0 || y === 0 || x === 6 || y === 6;
          const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          out[(oy + y) * size + (ox + x)] = edge || core;
        }
      }
    };
    mark(0, 0);
    mark(size - 7, 0);
    mark(0, size - 7);
    return out;
  }, [seed, size]);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="img" aria-label="Your rotating profile code">
      <rect width={size} height={size} fill="#fff" />
      {cells.map((on, i) =>
        on ? <rect key={i} x={i % size} y={Math.floor(i / size)} width="1" height="1" fill="#0a0b0d" /> : null,
      )}
    </svg>
  );
}

export function PartyModeSheet() {
  const { qrOpen, setQrOpen, toast } = useStore();
  const [tick, setTick] = useState(0);
  const [seconds, setSeconds] = useState(600);

  useEffect(() => {
    if (!qrOpen) return;
    setSeconds(600);
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setTick((k) => k + 1);
          return 600;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [qrOpen]);

  if (!qrOpen) return null;
  const seed = `fyk-party-${tick}-dario`;

  return (
    <Modal open onClose={() => setQrOpen(false)} labelledBy="party-title">
      <div className="p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gold-ghost text-gold">
          <QrCode className="h-6 w-6" />
        </span>
        <h2 id="party-title" className="mt-4 text-[21px] font-bold tracking-[-0.01em] text-ink">
          Party mode
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-muted">
          Swap profiles in person without handing over a phone number. The code rotates every ten minutes and
          nothing about it touches a server.
        </p>
        <div className="mx-auto mt-5 h-[210px] w-[210px] overflow-hidden rounded-2xl border border-line bg-white p-3">
          <CodeGrid seed={seed} />
        </div>
        <p className="mt-3 text-[12.5px] font-medium text-gold">
          Rotates in {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setTick((k) => k + 1);
              setSeconds(600);
              toast("New code generated", "gold");
            }}
            className="press flex-1 rounded-full border border-line bg-surface-2 py-3 text-[14.5px] font-semibold text-ink-2 hover:text-ink"
          >
            Rotate now
          </button>
          <button
            type="button"
            onClick={() => setQrOpen(false)}
            className="press flex-1 rounded-full bg-gold py-3 text-[14.5px] font-semibold text-black hover:bg-gold-2"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------- footprint picker --------------------------- */

export function FootprintPicker({
  personId,
  name,
  onClose,
}: {
  personId: string;
  name: string;
  onClose: () => void;
}) {
  const { leaveFootprint, footprints } = useStore();
  const current = (footprints as any)[personId];

  return (
    <div className="anim-pop rounded-xl border border-line bg-surface-2 p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <p className="text-[12px] font-bold uppercase tracking-wide text-faint">Leave a footprint</p>
        <button type="button" onClick={onClose} aria-label="Close" className="press ml-auto text-faint hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FOOTPRINT_LIST.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              leaveFootprint({ personId, footprintId: f.id, name });
              onClose();
            }}
            className={cn(
              "press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium",
              current === f.id ? "border-violet bg-violet text-white" : "border-line bg-surface text-ink-2 hover:border-violet/50 hover:text-violet",
            )}
          >
            <span aria-hidden="true">{f.emoji}</span>
            {f.label}
            {current === f.id && <Check className="h-3 w-3" />}
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-[11.5px] text-faint">Compliments only — FYK has no body ranking or scoring.</p>
    </div>
  );
}
