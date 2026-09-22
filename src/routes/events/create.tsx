import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/client";

/**
 * `/events/create` — publish an event through `#/routes/api/events`.
 *
 * The generated screen listed `/api/events` as a grid of cards and posted its button
 * to `/api/events/{id}/action`, a path nothing serves: there was no way to create
 * anything from here, and the grid it showed was the public feed with the create form
 * missing entirely.
 *
 * The fields are the route's own schema — `title` (3–120, a database check the route
 * mirrors so the answer is a 400 rather than a 500), `startsAt` and `endsAt` as
 * ISO-8601, `scale` as `casual|big`, `capacity` 1–10 000 — and the route refuses an
 * event that starts in the past or ends before it begins, so those checks happen here
 * too and the person hears the sentence before the round trip.
 */

interface CreateResult {
	ok: boolean;
	eventId: string;
}

const inputClass =
	"w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-black";

export const Route = createFileRoute("/events/create")({
	component: EventCreateScreen,
});

function EventCreateScreen() {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [venue, setVenue] = useState("");
	const [address, setAddress] = useState("");
	const [city, setCity] = useState("");
	const [startsAt, setStartsAt] = useState("");
	const [endsAt, setEndsAt] = useState("");
	const [capacity, setCapacity] = useState("");
	const [cost, setCost] = useState("");
	const [scale, setScale] = useState<"casual" | "big">("casual");
	const [note, setNote] = useState<string | null>(null);
	const [created, setCreated] = useState<CreateResult | null>(null);

	const create = useMutation({
		mutationFn: () =>
			api<CreateResult>("/api/events", {
				method: "POST",
				body: {
					action: "create",
					title: title.trim(),
					description: description.trim() || undefined,
					venue: venue.trim() || undefined,
					address: address.trim() || undefined,
					city: city.trim() || undefined,
					startsAt: new Date(startsAt).toISOString(),
					endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
					capacity: capacity ? Number(capacity) : undefined,
					cost: cost.trim() || undefined,
					scale,
				},
			}),
		onSuccess: (result) => setCreated(result),
		onError: (error) =>
			setNote(
				error instanceof ApiError || error instanceof Error
					? error.message
					: "That did not go through. Try again.",
			),
	});

	const start = startsAt ? new Date(startsAt) : null;
	const end = endsAt ? new Date(endsAt) : null;
	const problems: string[] = [];
	if (title.trim().length < 3) problems.push("A title needs at least 3 characters.");
	if (!start || Number.isNaN(start.getTime())) problems.push("Pick when it starts.");
	else if (start.getTime() < Date.now() - 60 * 60 * 1000)
		problems.push("That start is more than an hour in the past.");
	if (start && end && end <= start) problems.push("It has to end after it starts.");
	if (capacity && (!Number.isInteger(Number(capacity)) || Number(capacity) < 1))
		problems.push("Capacity is a whole number of people, at least 1.");

	if (created) {
		return (
			<div className="mx-auto max-w-md p-4 pb-24">
				<div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-6 text-center">
					<CalendarPlus className="mx-auto h-8 w-8 text-emerald-700" />
					<h1 className="font-display mt-3 text-[20px] font-bold text-emerald-900">
						Published
					</h1>
					<p className="mt-1 text-[13px] text-emerald-800">
						You are on the guest list as host.
					</p>
					<div className="mt-4 flex justify-center gap-2">
						<Link
							to="/events/$eventId"
							params={{ eventId: created.eventId }}
							className="rounded-full bg-black px-4 py-2 text-[13px] text-white"
						>
							Open the event
						</Link>
						<Link
							to="/events"
							className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-[13px] text-emerald-800"
						>
							All events
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-md p-4 pb-24">
			<div className="rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-sm">
				<h1 className="font-display text-[22px] font-bold tracking-tight text-black">
					Create an event
				</h1>
				<p className="mt-1 text-[13px] text-zinc-500">
					Published to the city feed, with you as the first RSVP.
				</p>

				{note && (
					<output className="mt-4 block rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
						{note}
					</output>
				)}

				<div className="mt-5 space-y-4">
					<Field label="Title" htmlFor="title">
						<input
							id="title"
							value={title}
							maxLength={120}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="Sunday beach clean-up"
							className={inputClass}
						/>
					</Field>

					<Field label="What is it" htmlFor="description">
						<textarea
							id="description"
							value={description}
							maxLength={2000}
							rows={3}
							onChange={(event) => setDescription(event.target.value)}
							className={inputClass}
						/>
					</Field>

					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Venue" htmlFor="venue">
							<input
								id="venue"
								value={venue}
								maxLength={200}
								onChange={(event) => setVenue(event.target.value)}
								className={inputClass}
							/>
						</Field>
						<Field label="City" htmlFor="city">
							<input
								id="city"
								value={city}
								maxLength={120}
								onChange={(event) => setCity(event.target.value)}
								className={inputClass}
							/>
						</Field>
					</div>

					<Field label="Address" htmlFor="address">
						<input
							id="address"
							value={address}
							maxLength={300}
							onChange={(event) => setAddress(event.target.value)}
							className={inputClass}
						/>
					</Field>

					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Starts" htmlFor="startsAt">
							<input
								id="startsAt"
								type="datetime-local"
								value={startsAt}
								onChange={(event) => setStartsAt(event.target.value)}
								className={inputClass}
							/>
						</Field>
						<Field label="Ends" htmlFor="endsAt">
							<input
								id="endsAt"
								type="datetime-local"
								value={endsAt}
								onChange={(event) => setEndsAt(event.target.value)}
								className={inputClass}
							/>
						</Field>
					</div>

					<div className="grid gap-4 sm:grid-cols-3">
						<Field label="Capacity" htmlFor="capacity">
							<input
								id="capacity"
								type="number"
								min={1}
								max={10000}
								value={capacity}
								onChange={(event) => setCapacity(event.target.value)}
								className={inputClass}
							/>
						</Field>
						<Field label="Cost" htmlFor="cost">
							<input
								id="cost"
								value={cost}
								maxLength={50}
								placeholder="Free"
								onChange={(event) => setCost(event.target.value)}
								className={inputClass}
							/>
						</Field>
						<Field label="Scale" htmlFor="scale">
							<select
								id="scale"
								value={scale}
								onChange={(event) => setScale(event.target.value as "casual" | "big")}
								className={inputClass}
							>
								<option value="casual">Casual</option>
								<option value="big">Big</option>
							</select>
						</Field>
					</div>

					{problems.length > 0 && (
						<ul className="rounded-[12px] border border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
							{problems.map((problem) => (
								<li key={problem}>{problem}</li>
							))}
						</ul>
					)}

					<Button
						type="button"
						onClick={() => create.mutate()}
						disabled={create.isPending || problems.length > 0}
						className="w-full rounded-[12px] bg-black text-white disabled:opacity-60"
					>
						{create.isPending ? "Publishing…" : "Publish event"}
					</Button>
				</div>
			</div>

			<p className="mt-4 text-[11px] text-zinc-500">
				Writes <code>POST /api/events</code> with <code>action: "create"</code>.
				Dates are stored in UTC and shown in the viewer's own zone.
			</p>
		</div>
	);
}

function Field({
	label,
	htmlFor,
	children,
}: {
	label: string;
	htmlFor: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<label className="block text-[12px] font-medium text-zinc-600" htmlFor={htmlFor}>
				{label}
			</label>
			<div className="mt-1">{children}</div>
		</div>
	);
}
