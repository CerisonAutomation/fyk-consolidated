import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/client";

/**
 * `/phone-login` — OTP against `#/routes/api/auth/phone`.
 *
 * The generated screen fetched `/api/phone-login` and posted to
 * `/api/phone-login/{id}/action`; neither exists, so the list was empty and the
 * button always failed. The real route takes `{action:"send", phone, country}` and
 * then `{action:"verify", phone, code, country}`, hashes the code at rest, allows five
 * attempts, and rate-limits by IP.
 *
 * WHAT VERIFICATION IS AND IS NOT
 * -------------------------------
 * Verifying a phone number proves the person holds it. It does not create a session:
 * Supabase Auth owns credentials, and this route's own answer says so — "Phone
 * verified — proceed to create session". So the screen ends by sending the person to
 * sign-up/sign-in rather than pretending they are logged in, which is what a screen
 * that set a token in localStorage would have been doing.
 *
 * In `DEV_MODE=1` the route returns the code it generated, because there is no SMS
 * provider to deliver it; that field is rendered only when present, so a production
 * response cannot leak it into the UI.
 */

interface SendResult {
	ok: boolean;
	message?: string;
	debugCode?: string;
}
interface VerifyResult {
	ok: boolean;
	verified: boolean;
	phone: string;
	message?: string;
}

export const Route = createFileRoute("/phone-login/")({
	component: PhoneLoginScreen,
});

function PhoneLoginScreen() {
	const [country, setCountry] = useState("+356");
	const [phone, setPhone] = useState("");
	const [code, setCode] = useState("");
	const [sent, setSent] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const [debugCode, setDebugCode] = useState<string | null>(null);

	const send = useMutation({
		mutationFn: () =>
			api<SendResult>("/api/auth/phone", {
				method: "POST",
				body: { action: "send", phone, country },
			}),
		onSuccess: (result) => {
			setSent(true);
			setNote(result.message ?? "Code sent.");
			setDebugCode(result.debugCode ?? null);
		},
		onError: (error) => setNote(message(error)),
	});

	const verify = useMutation({
		mutationFn: () =>
			api<VerifyResult>("/api/auth/phone", {
				method: "POST",
				body: { action: "verify", phone, code, country },
			}),
		onSuccess: (result) => setNote(result.message ?? "Phone verified."),
		onError: (error) => setNote(message(error)),
	});

	const phoneValid = phone.replace(/\D/g, "").length >= 8;
	const codeValid = code.trim().length === 6;

	return (
		<div className="mx-auto max-w-md p-4 pb-24">
			<div className="rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
						<MessageSquare className="h-5 w-5" />
					</div>
					<div>
						<h1 className="font-display text-[22px] font-bold tracking-tight text-black">
							Phone verification
						</h1>
						<p className="mt-1 text-[13px] text-zinc-500">
							Six digits, five attempts, ten codes an hour per connection.
						</p>
					</div>
				</div>

				{note && (
					<output className="mt-4 block rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
						{note}
					</output>
				)}

				<div className="mt-5 space-y-3">
					<label className="block text-[12px] font-medium text-zinc-600" htmlFor="country">
						Country code
					</label>
					<input
						id="country"
						value={country}
						onChange={(event) => setCountry(event.target.value)}
						placeholder="+356"
						maxLength={4}
						className="w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-black"
					/>

					<label className="block text-[12px] font-medium text-zinc-600" htmlFor="phone">
						Phone number
					</label>
					<input
						id="phone"
						type="tel"
						inputMode="tel"
						value={phone}
						onChange={(event) => setPhone(event.target.value)}
						placeholder="79 123 456"
						className="w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[14px] outline-none focus:border-black"
					/>

					<Button
						type="button"
						onClick={() => send.mutate()}
						disabled={!phoneValid || send.isPending}
						className="w-full rounded-[12px] bg-black text-white disabled:opacity-60"
					>
						{send.isPending ? "Sending…" : sent ? "Send another code" : "Send code"}
					</Button>

					{sent && (
						<>
							<label className="block text-[12px] font-medium text-zinc-600" htmlFor="code">
								Code
							</label>
							<input
								id="code"
								inputMode="numeric"
								autoComplete="one-time-code"
								value={code}
								onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
								placeholder="123456"
								className="w-full rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[16px] tracking-[0.4em] outline-none focus:border-black"
							/>
							<Button
								type="button"
								onClick={() => verify.mutate()}
								disabled={!codeValid || verify.isPending}
								className="w-full rounded-[12px] bg-black text-white disabled:opacity-60"
							>
								{verify.isPending ? "Checking…" : "Verify"}
							</Button>
						</>
					)}

					{debugCode && (
						<p className="rounded-[10px] border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600">
							Development mode: the code is {debugCode}. No SMS provider is
							configured, so the server returned it instead of sending it.
						</p>
					)}

					{verify.data?.verified && (
						<div className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-3">
							<p className="flex items-center gap-2 text-[13px] font-medium text-emerald-800">
								<ShieldCheck className="h-4 w-4" /> {verify.data.phone} is verified
							</p>
							<p className="mt-1 text-[12px] text-emerald-700">
								Verification is not a session. Finish signing in, or create the
								account, and this number stays attached to it.
							</p>
							<div className="mt-3 flex gap-2">
								<Link
									to="/auth/sign-in"
									className="rounded-full bg-black px-3 py-1.5 text-[12px] text-white"
								>
									Sign in
								</Link>
								<Link
									to="/auth/sign-in"
									search={{ mode: "signup" }}
									className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-[12px] text-zinc-700"
								>
									Create account
								</Link>
							</div>
						</div>
					)}
				</div>
			</div>

			<p className="mt-4 text-[11px] text-zinc-500">
				Reads and writes <code>/api/auth/phone</code>. Codes are hashed at rest
				and expire; after five wrong attempts the route asks you to request a new
				one.
			</p>
		</div>
	);
}

function message(error: unknown): string {
	if (error instanceof ApiError) return error.message;
	if (error instanceof Error && error.message) return error.message;
	return "That did not go through. Try again.";
}
