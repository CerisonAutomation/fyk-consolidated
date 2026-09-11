import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Clock, Loader2, MapPin, Plus, RefreshCw, ShieldAlert, Trash2, Users, Wallet } from "lucide-react";
import { z } from "zod";
import { api } from "#/lib/client";
import type { EventDetail, EventPage, FykEvent } from "#/lib/api-types";
import { cn, timeAgo } from "#/lib/utils";
import { Avatar } from "#/components/ui/Avatar";
import { Chip } from "#/components/ui/Chip";
import { Modal } from "#/components/ui/Modal";
import { StateBlock, describeFailure } from "#/components/ui/StateBlock";
import { ReportDialog } from "#/components/ReportDialog";
import { useShell } from "#/components/AppShell";
import { useToasts } from "#/lib/toast";

export const Route = createFileRoute("/events/")({
	component: EventsPage,
	head: () => ({ meta: [{ title: "Events — FYK" }] }),
});

const createSchema = z
	.object({
		title: z.string().trim().min(4, "Give the event a real title (4+ characters).").max(80),
		description: z.string().trim().max(1200).optional(),
		startsAt: z.string().min(1, "Pick a start time."),
		endsAt: z.string().optional(),
		venue: z.string().trim().max(120).optional(),
		address: z.string().trim().max(200).optional(),
		city: z.string().trim().max(80).optional(),
		capacity: z.number().int().min(2).max(5000).optional(),
		cost: z.string().trim().max(40).optional(),
	})
	.refine((value) => Date.parse(value.startsAt) > Date.now() - 60_000, { message: "The start time must not be in the past.", path: ["startsAt"] })
	.refine((value) => !value.endsAt || Date.parse(value.endsAt) > Date.parse(value.startsAt), { message: "The end time must be after the start.", path: ["endsAt"] });

function EventsPage() {
	const { capable } = useShell();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const push = useToasts((state) => state.push);
	const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
	const [creating, setCreating] = useState(false);
	const [openEvent, setOpenEvent] = useState<string | null>(null);
	const [reportTarget, setReportTarget] = useState<FykEvent | null>(null);

	const { data, isPending, error, refetch, isFetching } = useQuery({
		queryKey: ["events", when],
		queryFn: () => api.get<EventPage>(`events?when=${when}`),
		enabled: capable("events"),
		staleTime: 30_000,
	});

	const rsvp = useMutation({
		mutationFn: ({ eventId, status }: { eventId: string; status: "going" | "maybe" | "declined" }) => api.post<{ attending: string; attendeeCount: number }>(`events/${eventId}/rsvp`, { status }),
		onSuccess: (result) => {
			void queryClient.invalidateQueries({ queryKey: ["events"] });
			void queryClient.invalidateQueries({ queryKey: ["event", openEvent] });
			push(result.attending === "going" ? "You're on the list." : result.attending === "maybe" ? "Marked as maybe." : "Removed from the guest list.", "success");
		},
		onError: (err) => push(err instanceof Error ? err.message : "That did not save.", "error"),
	});

	const cancel = useMutation({
		mutationFn: (eventId: string) => api.del<{ cancelled: boolean }>(`events/${eventId}`),
		onSuccess: () => {
			push("Event cancelled. Guests keep the record but it leaves the list.", "success");
			setOpenEvent(null);
			void queryClient.invalidateQueries({ queryKey: ["events"] });
		},
		onError: (err) => push(err instanceof Error ? err.message : "That did not work.", "error"),
	});

	if (!capable("events")) {
		return <StateBlock kind="disabled" title="Events are unavailable" description="The events table is not readable for your account. Apply supabase/migrations and reload." />;
	}

	const failure = error ? describeFailure(error) : null;
	const events = data?.events ?? [];

	return (
		<>
			<div className="mb-3 flex flex-wrap items-center gap-2">
				<Chip active={when === "upcoming"} onClick={() => setWhen("upcoming")}>Upcoming</Chip>
				<Chip active={when === "past"} onClick={() => setWhen("past")}>Past</Chip>
				<button type="button" onClick={() => void refetch()} className="press ml-auto flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink-2" aria-label="Refresh events">
					<RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
				</button>
				<button type="button" onClick={() => setCreating(true)} className="press flex h-9 items-center gap-1.5 rounded-full bg-gold px-3.5 text-[12.5px] font-bold text-black">
					<Plus className="h-3.5 w-3.5" /> Host
				</button>
			</div>

			{isPending ? (
				<ul className="space-y-3" aria-hidden="true">
					{[0, 1, 2].map((index) => (
						<li key={index} className="skeleton h-32 rounded-2xl" />
					))}
				</ul>
			) : failure ? (
				<StateBlock kind="error" title="Events could not load" description={failure.message} action={<button type="button" onClick={() => void refetch()} className="press h-11 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black">Try again</button>} />
			) : events.length === 0 ? (
				<StateBlock
					kind="empty"
					title={data?.note ?? "Nothing scheduled"}
					description="Events here are made by members, not by us. There is no import from Facebook or Eventbrite — that would be a claim about data we do not have."
					action={<button type="button" onClick={() => setCreating(true)} className="press flex h-11 items-center gap-2 rounded-full bg-gold px-4 text-[13.5px] font-bold text-black"><CalendarDays className="h-4 w-4" /> Create the first one</button>}
				/>
			) : (
				<ul className="grid gap-3 md:grid-cols-2">
					{events.map((event) => (
						<li key={String(event.id)}>
							<EventCard
								event={event}
								onOpen={() => setOpenEvent(String(event.id))}
								onRsvp={(status) => rsvp.mutate({ eventId: String(event.id), status })}
								busy={rsvp.isPending && rsvp.variables?.eventId === String(event.id)}
								onReport={() => setReportTarget(event)}
							/>
						</li>
					))}
				</ul>
			)}

			{creating && (
				<CreateEventForm
					onClose={() => setCreating(false)}
					onCreated={() => {
						setCreating(false);
						void queryClient.invalidateQueries({ queryKey: ["events"] });
					}}
				/>
			)}

			{openEvent && (
				<EventDetailModal
					eventId={openEvent}
					onClose={() => setOpenEvent(null)}
					onRsvp={(status) => rsvp.mutate({ eventId: openEvent, status })}
					onCancel={() => cancel.mutate(openEvent)}
					busy={rsvp.isPending}
					onOpenProfile={(id) => {
						setOpenEvent(null);
						void navigate({ to: "/profile/$profileId", params: { profileId: id } });
					}}
				/>
			)}

			{reportTarget && <ReportDialog targetType="event" targetId={String(reportTarget.id)} targetLabel={reportTarget.title} onClose={() => setReportTarget(null)} />}
		</>
	);
}

function EventCard({
	event,
	onOpen,
	onRsvp,
	busy,
	onReport,
}: {
	event: FykEvent;
	onOpen: () => void;
	onRsvp: (status: "going" | "maybe" | "declined") => void;
	busy: boolean;
	onReport: () => void;
}) {
	const starts = Date.parse(String(event.startsAt));
	const isPast = Number.isFinite(starts) && starts < Date.now();
	return (
		<article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4">
			<button type="button" onClick={onOpen} className="text-left">
				<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
					{isPast ? "Past" : formatWhen(starts)}
				</p>
				<h3 className="mt-1.5 text-[17px] font-bold leading-snug">{event.title}</h3>
			</button>
			{event.description && <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted">{event.description}</p>}

			<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted">
				{event.venue && (
					<span className="inline-flex items-center gap-1">
						<MapPin className="h-3.5 w-3.5 text-gold" /> {event.venue}
					</span>
				)}
				{event.cost && (
					<span className="inline-flex items-center gap-1">
						<Wallet className="h-3.5 w-3.5" /> {event.cost}
					</span>
				)}
				<span className="inline-flex items-center gap-1">
					<Users className="h-3.5 w-3.5" /> {event.attendeeCount}
					{event.capacity ? `/${event.capacity}` : ""} going
				</span>
			</div>

			{event.host && (
				<button type="button" onClick={onOpen} className="mt-3 flex items-center gap-2 self-start rounded-full border border-line bg-surface-2 py-1 pl-1 pr-2.5">
					<Avatar name={event.host.displayName ?? "Host"} photoUrl={event.host.avatarUrl} size={22} />
					<span className="text-[11.5px] text-ink-2">Hosted by {event.host.displayName ?? "a member"}</span>
				</button>
			)}

			<div className="mt-auto flex items-center gap-2 pt-4">
				{isPast ? (
					<span className="text-[12px] text-faint">This one already happened {timeAgo(event.startsAt)}</span>
				) : event.isHost ? (
					<span className="rounded-full border border-gold/40 bg-gold-ghost px-2.5 py-1 text-[11.5px] font-semibold text-gold">You are hosting</span>
				) : (
					<>
						<button
							type="button"
							disabled={busy}
							onClick={() => onRsvp(event.attending === "going" ? "declined" : "going")}
							className={cn("press flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold disabled:opacity-60", event.attending === "going" ? "border border-gold/50 bg-gold-ghost text-gold" : "bg-gold text-black")}
						>
							{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
							{event.attending === "going" ? "Going ✓" : "I'm going"}
						</button>
						<button type="button" disabled={busy} onClick={() => onRsvp("maybe")} className={cn("press h-9 rounded-full border px-3 text-[12.5px] font-semibold", event.attending === "maybe" ? "border-gold/50 text-gold" : "border-line text-muted hover:text-ink")}>
							Maybe
						</button>
					</>
				)}
				<button type="button" onClick={onReport} className="press ml-auto grid h-9 w-9 place-items-center rounded-full text-faint hover:text-live" aria-label="Report this event">
					<ShieldAlert className="h-4 w-4" />
				</button>
			</div>
		</article>
	);
}

function formatWhen(starts: number): string {
	const date = new Date(starts);
	const sameDay = date.toDateString() === new Date().toDateString();
	const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
	if (sameDay) return `Today · ${time}`;
	return `${date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · ${time}`;
}

function CreateEventForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
	const push = useToasts((state) => state.push);
	const [form, setForm] = useState({ title: "", description: "", startsAt: defaultStart(), endsAt: "", venue: "", address: "", city: "", capacity: "", cost: "" });
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: event.target.value });

	const submit = async () => {
		setError("");
		const parsed = createSchema.safeParse({
			title: form.title.trim(),
			description: form.description.trim() || undefined,
			startsAt: new Date(form.startsAt).toISOString(),
			endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
			venue: form.venue.trim() || undefined,
			address: form.address.trim() || undefined,
			city: form.city.trim() || undefined,
			capacity: form.capacity ? Number(form.capacity) : undefined,
			cost: form.cost.trim() || undefined,
		});
		if (!parsed.success) return setError(parsed.error.issues[0].message);
		setBusy(true);
		try {
			await api.post<{ event: FykEvent }>("events", parsed.data);
			push("Published. Everyone nearby can see it now.", "success");
			onCreated();
		} catch (err) {
			setError(err instanceof Error ? err.message : "That did not save.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal open onClose={onClose} labelledBy="create-event" wide>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void submit();
				}}
				className="p-5 sm:p-6"
			>
				<h2 id="create-event" className="text-[18px] font-bold">Host an event</h2>
				<p className="mt-1 text-[13px] text-muted">Anything members organize is fair: a walk, a drink, a match screening. Keep it legal and it stays up.</p>

				<div className="mt-4 grid gap-3.5 sm:grid-cols-2">
					<label className="block sm:col-span-2">
						<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Title</span>
						<input value={form.title} onChange={set("title")} placeholder="Rooftop pre-drinks" maxLength={80} className="entry-input" />
					</label>
					<label className="block sm:col-span-2">
						<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">What is it? (optional)</span>
						<textarea value={form.description} onChange={set("description")} rows={3} maxLength={1200} placeholder="Who it's for, what happens, how to spot us." className="entry-input resize-none" />
					</label>
					<label className="block">
						<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Starts</span>
						<input type="datetime-local" value={form.startsAt} onChange={set("startsAt")} className="entry-input" />
					</label>
					<label className="block">
						<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Ends (optional)</span>
						<input type="datetime-local" value={form.endsAt} onChange={set("endsAt")} className="entry-input" />
					</label>
					<label className="block">
						<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Venue</span>
						<input value={form.venue} onChange={set("venue")} placeholder="Sky Bar" maxLength={120} className="entry-input" />
					</label>
					<label className="block">
						<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Address / meeting point</span>
						<input value={form.address} onChange={set("address")} placeholder="Outside the main entrance" maxLength={200} className="entry-input" />
					</label>
					<label className="block">
						<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">City</span>
						<input value={form.city} onChange={set("city")} placeholder="Sliema" maxLength={80} className="entry-input" />
					</label>
					<label className="block">
						<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Capacity (optional)</span>
						<input type="number" min={2} max={5000} value={form.capacity} onChange={set("capacity")} placeholder="20" className="entry-input" />
					</label>
					<label className="block sm:col-span-2">
						<span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Cost (optional)</span>
						<input value={form.cost} onChange={set("cost")} placeholder="Free · €10 door · split the table" maxLength={40} className="entry-input" />
						<span className="mt-1 block text-[11.5px] leading-snug text-faint">
							FYK does not take payments, so this is text only — no tickets, no wallet, no purchase protection.
						</span>
					</label>
				</div>

				{error && <p role="alert" className="mt-3 text-[13px] text-live">{error}</p>}

				<div className="mt-5 flex gap-2">
					<button type="button" onClick={onClose} className="press h-12 rounded-full border border-line px-5 text-[14px] font-semibold text-ink-2">
						Cancel
					</button>
					<button type="submit" disabled={busy} className="press flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gold text-[14.5px] font-bold text-black disabled:opacity-60">
						{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />} Publish event
					</button>
				</div>
			</form>
		</Modal>
	);
}

function defaultStart(): string {
	const date = new Date();
	date.setDate(date.getDate() + 1);
	date.setMinutes(0, 0, 0);
	return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function EventDetailModal({
	eventId,
	onClose,
	onRsvp,
	onCancel,
	busy,
	onOpenProfile,
}: {
	eventId: string;
	onClose: () => void;
	onRsvp: (status: "going" | "maybe" | "declined") => void;
	onCancel: () => void;
	busy: boolean;
	onOpenProfile: (id: string) => void;
}) {
	const { data, isPending, error } = useQuery({
		queryKey: ["event", eventId],
		queryFn: () => api.get<EventDetail>(`events/${eventId}`),
	});
	const failure = error ? describeFailure(error) : null;
	const event = data?.event;

	return (
		<Modal open onClose={onClose} labelledBy="event-detail" wide>
			{isPending ? (
				<div className="p-6">
					<StateBlock kind="loading" title="Loading event" />
				</div>
			) : failure || !event ? (
				<div className="p-6">
					<StateBlock kind="error" title="That event could not open" description={failure?.message} />
				</div>
			) : (
				<div className="p-5 sm:p-6">
					<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gold">{formatWhen(Date.parse(String(event.startsAt)))}</p>
					<h2 id="event-detail" className="mt-1.5 text-[22px] font-bold leading-tight">
						{event.title}
					</h2>
					{event.description && <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{event.description}</p>}

					<dl className="mt-4 grid gap-2.5 text-[13px] sm:grid-cols-2">
						{event.venue ? (
							<div className="flex items-start gap-2">
								<dt className="text-muted">
									<MapPin className="mt-0.5 h-4 w-4 text-gold" />
								</dt>
								<dd>
									<span className="font-semibold text-ink">{event.venue}</span>
									{event.address ? <span className="block text-muted">{event.address}</span> : null}
								</dd>
							</div>
						) : null}
						{event.endsAt ? (
							<div className="flex items-center gap-2">
								<dt className="text-muted">
									<Clock className="h-4 w-4 text-gold" />
								</dt>
								<dd>Ends {new Date(String(event.endsAt)).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</dd>
							</div>
						) : null}
						{event.cost ? (
							<div className="flex items-center gap-2">
								<dt className="text-muted">
									<Wallet className="h-4 w-4 text-gold" />
								</dt>
								<dd>{event.cost}</dd>
							</div>
						) : null}
						<div className="flex items-center gap-2">
							<dt className="text-muted">
								<Users className="h-4 w-4 text-gold" />
							</dt>
							<dd>
								{data.attendeeCount} going{event.capacity ? ` · ${event.capacity} max` : ""}
							</dd>
						</div>
					</dl>

					{data.attendees.length > 0 && (
						<div className="mt-5">
							<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Who's going</p>
							<ul className="mt-2 flex flex-wrap gap-1.5">
								{data.attendees.map((attendee) => (
									<li key={attendee.id}>
										<button type="button" onClick={() => onOpenProfile(attendee.id)} className="press flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-2.5">
											<Avatar name={attendee.displayName} photoUrl={attendee.avatarUrl} size={22} online={attendee.presence === "online"} />
											<span className="text-[12px] text-ink-2">{attendee.displayName}</span>
										</button>
									</li>
								))}
							</ul>
							<p className="mt-2 text-[11.5px] text-faint">Attendance is public to guests of the event. Nobody is shown a count of who viewed this page.</p>
						</div>
					)}

					<div className="mt-6 flex flex-wrap gap-2">
						{data.isHost ? (
							<>
								<span className="flex h-11 items-center rounded-full border border-gold/40 bg-gold-ghost px-3.5 text-[13px] font-semibold text-gold">You are hosting this</span>
								<button
									type="button"
									onClick={() => {
										if (window.confirm("Cancel this event? Guests keep the record, but it leaves the list.")) onCancel();
									}}
									className="press ml-auto flex h-11 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-semibold text-live"
								>
									<Trash2 className="h-4 w-4" /> Cancel event
								</button>
							</>
						) : (
							<>
								<button type="button" disabled={busy} onClick={() => onRsvp(data.attending === "going" ? "declined" : "going")} className={cn("press flex h-11 items-center gap-2 rounded-full px-4 text-[13.5px] font-bold disabled:opacity-60", data.attending === "going" ? "border border-gold/50 bg-gold-ghost text-gold" : "bg-gold text-black")}>
									{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
									{data.attending === "going" ? "Cancel my spot" : "I'm going"}
								</button>
								<button type="button" disabled={busy} onClick={() => onRsvp("maybe")} className={cn("press h-11 rounded-full border px-4 text-[13.5px] font-semibold", data.attending === "maybe" ? "border-gold/50 text-gold" : "border-line text-muted hover:text-ink")}>
									Maybe
								</button>
							</>
						)}
					</div>

					<p className="mt-4 text-[11.5px] leading-relaxed text-faint">
						FYK does not verify that an event happens, sell tickets, or take payment. Meet in a public place and tell someone where you are going.
					</p>
				</div>
			)}
		</Modal>
	);
}
