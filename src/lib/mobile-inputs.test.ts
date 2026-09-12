import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Mobile input hygiene on the forms a phone actually has to fill in.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * "Mobile first" is usually spent on layout, and the defect that survives it is a
 * keyboard: an email field that offers the letters-and-symbols layout, a password
 * field no manager will fill (no `autocomplete`, so the OS treats it as a text box),
 * a "Next" key that submits instead of advancing, autocorrect rewriting a handle into
 * a dictionary word. None of that fails a test, a typecheck, or a screenshot — it
 * fails the one-handed signup on a train.
 *
 * So the rules here are on the four surfaces where typing is unavoidable: auth,
 * profile edit, the safety contacts (typed in a panic, which is the worst time to
 * fight a keyboard), and chat. They are static because the app has no browser
 * harness — `e2e/` covers the shell, not a soft keyboard.
 *
 * The last test is the one that caught a real bug while this file was being written:
 * a JSX tag with the same attribute twice. TypeScript rejects it, but only once the
 * duplicate is in the *same* tag, which is exactly what an in-place edit produces when
 * a field already carried `inputMode` and a patch adds another.
 */
const ROOT = resolve(__dirname, "../..");
const FORMS = [
	"src/routes/auth/sign-in/index.tsx",
	"src/routes/auth/sign-up/index.tsx",
	"src/components/profile/profile-client.tsx",
	"src/components/safety/safety-client.tsx",
	"src/components/chat/chat-view.tsx",
	"src/components/chat/messages-client.tsx",
] as const;

type Tag = { file: string; kind: string; body: string; line: number };

/**
 * Every `<input>`/`<textarea>` opening tag in the listed files.
 *
 * Scanning to the next `/>` rather than to the next `>` matters: `onChange={(e) => …}`
 * contains `>`, so the naive terminator stops inside the tag and every rule below
 * quietly checks a fragment.
 */
function tags(): Tag[] {
	const found: Tag[] = [];
	for (const file of FORMS) {
		const src = readFileSync(resolve(ROOT, file), "utf8");
		for (const match of src.matchAll(/<(input|textarea)\b([\s\S]*?)\/>/g)) {
			found.push({
				file,
				kind: match[1],
				body: match[2],
				line: src.slice(0, match.index).split("\n").length,
			});
		}
	}
	return found;
}

/**
 * Fails with the reason instead of failing with `!`.
 *
 * The alternative is a non-null assertion, which in a test is the same trick that made
 * the inbox bug invisible: `api<ConversationWithMeta[]>()` asserted a shape and nobody
 * checked it. A helper that throws when the field is missing means "the form moved"
 * reads as that, rather than as a type error swallowed by a `!`.
 */
function mustFind<T>(value: T | undefined, label: string): T {
	if (value === undefined) {
		throw new Error(
			`${label}: not found — the guard is checking a form that moved`,
		);
	}
	return value;
}

const attr = (tag: Tag, name: string): string | null => {
	const m = new RegExp(`\\b${name}=(?:"([^"]*)"|\\{([^}]*)\\})`).exec(tag.body);
	// Bare value, always: the tests compare against `tel`, not `"tel"`, and an
	// expression attribute (`type={showPassword ? …}`) keeps its source text.
	return m ? (m[1] ?? m[2].trim()) : null;
};

describe("mobile input hygiene", () => {
	const all = tags();

	it("reads the forms it claims to cover", () => {
		// Non-vacuity. `expect(all.length).toBeGreaterThan(0)` would pass on a repo
		// where every path had been renamed.
		expect(all.length).toBeGreaterThanOrEqual(20);
		const byFile = new Set(all.map((tag) => tag.file));
		for (const file of FORMS) expect(byFile.has(file), file).toBe(true);
	});

	it("gives every email field the address keyboard and the credential hint", () => {
		for (const tag of all) {
			const type = attr(tag, "type");
			if (type !== "email" && !/inputMode="email"/.test(tag.body)) continue;
			expect(attr(tag, "inputMode"), `${tag.file}:${tag.line}`).toBe("email");
			expect(
				["email", "username"],
				`${tag.file}:${tag.line} — a password manager keys on this`,
			).toContain(attr(tag, "autoComplete") ?? "");
			expect(
				tag.body,
				`${tag.file}:${tag.line} — autocorrect turns handles into words`,
			).toMatch(/autoCorrect="off"/);
			expect(tag.body, `${tag.file}:${tag.line}`).toMatch(
				/autoCapitalize="none"/,
			);
		}
	});

	it("labels passwords so a manager can offer them", () => {
		const passwords = all.filter((tag) =>
			/type=\{[^}]*"password"|type="password"/.test(tag.body),
		);
		expect(passwords.length).toBeGreaterThanOrEqual(4);
		for (const tag of passwords) {
			const value = attr(tag, "autoComplete") ?? "";
			expect(
				["current-password", "new-password"],
				`${tag.file}:${tag.line} — got ${value || "(nothing)"}`,
			).toContain(value);
			// `new-password` is the token that makes a manager *generate* one, and a
			// generator needs the field to say which credential it is.
			if (value === "new-password")
				expect(attr(tag, "name"), tag.file).not.toBeNull();
		}
	});

	it("names every auth field, or autofill cannot tell them apart", () => {
		for (const tag of all.filter((t) => t.file.startsWith("src/routes/auth"))) {
			expect(attr(tag, "name"), `${tag.file}:${tag.line}`).not.toBeNull();
			expect(
				attr(tag, "autoComplete"),
				`${tag.file}:${tag.line}`,
			).not.toBeNull();
		}
	});

	it("gives the safety contact form the keyboards a panic needs", () => {
		const safety = all.filter((tag) => tag.file.endsWith("safety-client.tsx"));
		const phone = mustFind(
			safety.find((tag) => /contactForm\.phone/.test(tag.body)),
			"the safety contact phone field",
		);
		expect(attr(phone, "type")).toBe("tel");
		expect(attr(phone, "inputMode")).toBe("tel");
		const email = mustFind(
			safety.find((tag) => /contactForm\.email/.test(tag.body)),
			"the safety contact email field",
		);
		expect(attr(email, "type")).toBe("email");
	});

	it("makes the composer's Enter key send", () => {
		const composer = mustFind(
			all.find(
				(tag) =>
					tag.file.endsWith("chat-view.tsx") &&
					/value=\{input\}/.test(tag.body),
			),
			"the chat composer",
		);
		expect(attr(composer, "enterKeyHint")).toBe("send");
		// A chat message is prose: sentence caps, spelling checked.
		expect(attr(composer, "autoCapitalize")).toBe("sentences");
	});

	it("never repeats an attribute in one tag", () => {
		for (const tag of all) {
			const names = [...tag.body.matchAll(/^\s*([a-zA-Z][a-zA-Z0-9]*)=/gm)].map(
				(m) => m[1],
			);
			const duplicates = names.filter(
				(name, index) => names.indexOf(name) !== index,
			);
			expect(
				duplicates,
				`${tag.file}:${tag.line} repeats ${duplicates.join(", ")}`,
			).toEqual([]);
		}
	});
});
