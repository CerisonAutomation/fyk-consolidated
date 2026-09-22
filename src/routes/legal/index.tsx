import { createFileRoute } from "@tanstack/react-router";
import { LEGAL_DOCUMENTS, OPERATOR_NOTICE } from "@/lib/legal-content";

/**
 * `/legal` — privacy, terms and cookie summaries, read from this build.
 *
 * The generated screen fetched `/api/legal` and posted to `/api/legal/{id}/action`.
 * Neither exists, and a legal notice behind an API is worse than one that ships with the
 * app: the page exists so somebody can read it before deciding to trust the service,
 * including on a day the API is down.
 *
 * The text is `#/lib/legal-content`, written against what this codebase does — which
 * tables hold what, which endpoint exports or deletes an account, what a third party
 * receives. Each document carries the date it was last reconciled with the code.
 */
export const Route = createFileRoute("/legal/")({
	component: LegalScreen,
});

function LegalScreen() {
	return (
		<div className="mx-auto max-w-2xl p-4 pb-24">
			<h1 className="font-display text-[24px] font-bold tracking-tight text-black">
				Legal
			</h1>
			<p className="mt-1 text-[14px] text-zinc-500">
				Written against this build, not filed with a regulator.
			</p>

			<nav className="mt-4 flex flex-wrap gap-2">
				{LEGAL_DOCUMENTS.map((doc) => (
					<a
						key={doc.slug}
						href={`#${doc.slug}`}
						className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[12px] text-zinc-700"
					>
						{doc.title}
					</a>
				))}
			</nav>

			<div className="mt-6 space-y-4">
				{LEGAL_DOCUMENTS.map((doc) => (
					<section
						key={doc.slug}
						id={doc.slug}
						className="rounded-[20px] border border-black/[0.06] bg-white p-5 shadow-sm"
					>
						<h2 className="font-display text-[18px] font-bold text-black">
							{doc.title}
						</h2>
						<p className="mt-1 text-[12px] text-zinc-500">{doc.summary}</p>
						<dl className="mt-4 space-y-3">
							{doc.sections.map((section) => (
								<div key={section.heading}>
									<dt className="text-[13px] font-medium text-black">
										{section.heading}
									</dt>
									<dd className="mt-1 text-[13px] leading-relaxed text-zinc-600">
										{section.body}
									</dd>
								</div>
							))}
						</dl>
						<p className="mt-3 text-[11px] text-zinc-400">
							Reconciled with the code on {doc.updated}.
						</p>
					</section>
				))}
			</div>

			<p className="mt-6 rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-[12px] text-amber-900">
				{OPERATOR_NOTICE}
			</p>
		</div>
	);
}
