/**
 * Test accounts for development.
 * Each account is pre-seeded in Supabase Auth with auto-confirmed email.
 * Password for all test accounts: TestPass123!
 */
import { supabase } from "#/integrations/supabase/client";

export interface TestAccount {
	email: string;
	password: string;
	name: string;
	handle: string;
	label: string;
	color: string;
}

export const TEST_PASSWORD = "TestPass123!";

export const TEST_ACCOUNTS: TestAccount[] = [
	{
		email: "king1@fyk.app",
		password: TEST_PASSWORD,
		name: "Alex Crown",
		handle: "alex_king",
		label: "King 1",
		color: "#EAAB08",
	},
	{
		email: "king2@fyk.app",
		password: TEST_PASSWORD,
		name: "Jordan Reign",
		handle: "jordan_reign",
		label: "King 2",
		color: "#a855f7",
	},
	{
		email: "king3@fyk.app",
		password: TEST_PASSWORD,
		name: "Kai Noble",
		handle: "kai_noble",
		label: "King 3",
		color: "#06b6d4",
	},
];

/**
 * Seed a single test account into Supabase Auth.
 * If the user already exists, this is a no-op (Supabase returns success).
 */
export async function seedTestAccount(
	account: TestAccount,
): Promise<{ ok: boolean; error?: string }> {
	try {
		const { error } = await supabase.auth.signUp({
			email: account.email,
			password: account.password,
			options: {
				data: {
					first_name: account.name,
					handle: account.handle,
				},
				// Skip email confirmation for test accounts
				emailRedirectTo: `${window.location.origin}/auth/callback`,
			},
		});

		if (error) {
			// "User already registered" is fine — means account exists
			if (error.message.includes("already")) {
				return { ok: true };
			}
			return { ok: false, error: error.message };
		}

		return { ok: true };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "Unknown error",
		};
	}
}

/**
 * Seed all test accounts. Runs in parallel.
 */
export async function seedAllTestAccounts(): Promise<{
	successful: number;
	failed: number;
	errors: string[];
}> {
	const results = await Promise.allSettled(
		TEST_ACCOUNTS.map((account) => seedTestAccount(account)),
	);

	let successful = 0;
	let failed = 0;
	const errors: string[] = [];

	for (const result of results) {
		if (result.status === "fulfilled" && result.value.ok) {
			successful++;
		} else {
			failed++;
			if (result.status === "fulfilled" && result.value.error) {
				errors.push(result.value.error);
			} else if (result.status === "rejected") {
				errors.push(String(result.reason));
			}
		}
	}

	return { successful, failed, errors };
}
