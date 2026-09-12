import { Store } from "@tanstack/store";

/**
 * Application user store backed by real Supabase session data.
 *
 * Starts with empty values and should be hydrated via `hydrateFromUser()`
 * once the authenticated user is available.
 */
export const store = new Store({
	firstName: "",
	lastName: "",
});

export const fullName = new Store(
	`${store.state.firstName} ${store.state.lastName}`.trim() || "Guest",
);

store.subscribe(() => {
	const first = store.state.firstName;
	const last = store.state.lastName;
	const combined = `${first} ${last}`.trim();
	fullName.setState(() => combined || "Guest");
});

/**
 * Hydrate the store from a real Supabase User object.
 *
 * Reads `first_name` / `last_name` from `user_metadata`, which are set
 * during sign-up and profile editing.  Falls back to deriving a first
 * name from the email address when metadata is missing.
 */
export function hydrateFromUser(
	user: { email?: string | null; user_metadata?: Record<string, unknown> } | null,
) {
	if (!user) {
		store.setState(() => ({ firstName: "", lastName: "" }));
		return;
	}

	const meta = user.user_metadata as Record<string, string> | undefined;
	const firstName =
		meta?.first_name ||
		meta?.name ||
		user.email?.split("@")[0] ||
		"";
	const lastName = meta?.last_name || "";

	store.setState(() => ({ firstName, lastName }));
}
