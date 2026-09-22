import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, requireCaller, unexpected } from "@/lib/api-helpers";
import { activityDays, ACTIVITY_WINDOW_DAYS } from "@/lib/activity.server";
import { calculateStreak } from "@/lib/growth";
import { json, withSecurity } from "@/middleware";

/**
 * `GET /api/growth/streak` — the consecutive-day counter the welcome, home and
 * notification surfaces show.
 *
 * WHAT CHANGED
 * ------------
 * The handler used to build its own input: an array of three timestamps for today,
 * yesterday and the day before, passed to `calculateStreak` with a comment saying a
 * production build would query `audit_events` or presence logs. Every account
 * therefore had a three-day streak, `celebration` fired "3 day streak!" for everybody
 * on their first request, and `atRisk` was always false because one of the three
 * invented days was always today. The retention surface was describing a habit the
 * user might never have had.
 *
 * It now reads the days this account was actually here (`#/lib/activity.server`:
 * session sign-ins and touches, plus messages sent) and counts them. A new account
 * gets `count: 0` and no celebration, which is the truthful answer and the one that
 * makes the counter worth showing.
 *
 * The response shape is unchanged — `{ streak, celebration, atRiskMessage }` — so the
 * screens that read it did not have to change with it.
 */
export const Route = createFileRoute("/api/growth/streak/")({
	server: {
		handlers: {
			POST: methodNotAllowed("GET"),
			PUT: methodNotAllowed("GET"),
			PATCH: methodNotAllowed("GET"),
			DELETE: methodNotAllowed("GET"),

			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					try {
						const days = await activityDays(user.id);
						const streak = calculateStreak(days);
						streak.userId = user.id;
						streak.type = "login";

						return json({
							streak,
							celebration:
								streak.count >= 7
									? `Week streak — ${streak.count} days`
									: streak.count >= 3
										? `${streak.count} day streak`
										: null,
							atRiskMessage: streak.atRisk
								? "Open FYK today to keep your streak."
								: null,
							windowDays: ACTIVITY_WINDOW_DAYS,
							activeDays: days,
						});
					} catch (error) {
						return unexpected("growth/streak/GET", error);
					}
				},
				{ rateLimit: { limit: 60, key: ({ caller }) => `streak:${caller?.id ?? "anon"}` } },
			),
		},
	},
});
