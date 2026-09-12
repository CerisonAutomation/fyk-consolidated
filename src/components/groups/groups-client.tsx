"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeft,
	Check,
	MessageCircle,
	Plus,
	Send,
	Users,
} from "lucide-react";
import { useState } from "react";
import {
	createGroup,
	type GroupView,
	listGroups,
	loadGroupMessages,
	sendGroupMessage,
	toggleGroupMembership,
} from "#/integrations/supabase/groups";
import { useSupabaseSession } from "#/integrations/supabase/session-provider";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { useAppStore } from "@/lib/store";
import { cn, gradient } from "@/lib/utils";

// ─── Group Messages Panel ────────────────────────────────────────────────────

function GroupMessages({
	group,
	onBack,
}: {
	group: GroupView;
	onBack: () => void;
}) {
	const { user } = useSupabaseSession();
	const qc = useQueryClient();
	const pushToast = useAppStore((s) => s.pushToast);
	const [draft, setDraft] = useState("");

	const { data: messages, isLoading } = useQuery({
		queryKey: ["groupMessages", group.id],
		queryFn: () =>
			user
				? loadGroupMessages(group.id, user.id).then((r) => (r.ok ? r.data : []))
				: Promise.resolve([]),
		refetchInterval: 5000,
	});

	const sendMutation = useMutation({
		mutationFn: (content: string) =>
			user
				? sendGroupMessage(group.id, user.id, content).then((r) => r.ok)
				: Promise.resolve(false),
		onSuccess: (sent) => {
			if (sent) {
				setDraft("");
				qc.invalidateQueries({ queryKey: ["groupMessages", group.id] });
			} else {
				pushToast("Failed to send message", "error");
			}
		},
	});

	const handleSend = () => {
		if (!draft.trim() || sendMutation.isPending) return;
		sendMutation.mutate(draft.trim());
	};

	return (
		<div className="flex flex-col">
			<div className="mb-3 flex items-center gap-3">
				<button
					onClick={onBack}
					className="text-muted hover:text-white transition-colors"
				>
					<ArrowLeft className="h-5 w-5" />
				</button>
				<div
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
					style={{ background: gradient(group.name) }}
				>
					{group.icon || "👥"}
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-sm font-bold text-white">
						{group.name}
					</h2>
					<p className="text-xs text-muted">{group.member_count} members</p>
				</div>
			</div>

			<div className="mb-3 max-h-[50vh] space-y-2 overflow-y-auto rounded-2xl border border-line bg-surface p-3">
				{isLoading ? (
					<div className="space-y-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-10 rounded-xl" />
						))}
					</div>
				) : !messages || messages.length === 0 ? (
					<p className="py-6 text-center text-xs text-muted">
						No messages yet. Start the conversation!
					</p>
				) : (
					[...messages].reverse().map((m) => (
						<div
							key={m.id}
							className={cn(
								"flex gap-2",
								m.sender_id === user?.id ? "flex-row-reverse" : "",
							)}
						>
							<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elevated text-[10px] text-white">
								{(m.sender_name ?? "A")[0]}
							</div>
							<div
								className={cn(
									"max-w-[75%] rounded-xl px-3 py-2 text-xs",
									m.sender_id === user?.id
										? "bg-gold/20 text-white"
										: "bg-elevated text-white",
								)}
							>
								{m.sender_id !== user?.id && (
									<p className="mb-0.5 text-[10px] font-semibold text-gold/70">
										{m.sender_name}
									</p>
								)}
								<p>{m.content}</p>
							</div>
						</div>
					))
				)}
			</div>

			<div className="flex gap-2">
				<input
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleSend()}
					placeholder="Type a message..."
					className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-white placeholder:text-muted focus:border-gold/50 focus:outline-none"
				/>
				<button
					onClick={handleSend}
					disabled={!draft.trim() || sendMutation.isPending}
					className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold text-ink transition-colors hover:bg-gold-soft disabled:opacity-50"
				>
					<Send className="h-4 w-4" />
				</button>
			</div>
		</div>
	);
}

// ─── Create Group Dialog ─────────────────────────────────────────────────────

function CreateGroupForm({ onDone }: { onDone: () => void }) {
	const { user } = useSupabaseSession();
	const qc = useQueryClient();
	const pushToast = useAppStore((s) => s.pushToast);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [icon, setIcon] = useState("👥");

	const createMutation = useMutation({
		mutationFn: () =>
			createGroup(user?.id, {
				name,
				description: description || undefined,
				icon,
			}),
		onSuccess: (result) => {
			if (result.ok) {
				pushToast("Group created!", "success");
				qc.invalidateQueries({ queryKey: ["groups"] });
				onDone();
			} else {
				pushToast(result.message, "error");
			}
		},
	});

	return (
		<div className="rounded-2xl border border-line bg-surface p-4">
			<h3 className="mb-3 text-sm font-bold text-white">Create a Group</h3>
			<div className="space-y-2">
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Group name"
					className="w-full rounded-xl border border-line bg-elevated px-3 py-2 text-xs text-white placeholder:text-muted focus:border-gold/50 focus:outline-none"
				/>
				<input
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Description (optional)"
					className="w-full rounded-xl border border-line bg-elevated px-3 py-2 text-xs text-white placeholder:text-muted focus:border-gold/50 focus:outline-none"
				/>
				<input
					value={icon}
					onChange={(e) => setIcon(e.target.value)}
					placeholder="Icon emoji"
					className="w-20 rounded-xl border border-line bg-elevated px-3 py-2 text-center text-xs text-white placeholder:text-muted focus:border-gold/50 focus:outline-none"
				/>
			</div>
			<div className="mt-3 flex gap-2">
				<button
					onClick={onDone}
					className="rounded-xl border border-line px-3 py-2 text-xs text-muted hover:text-white"
				>
					Cancel
				</button>
				<button
					onClick={() => createMutation.mutate()}
					disabled={!name.trim() || createMutation.isPending}
					className="rounded-xl bg-gold px-3 py-2 text-xs font-semibold text-ink hover:bg-gold-soft disabled:opacity-50"
				>
					{createMutation.isPending ? "Creating..." : "Create Group"}
				</button>
			</div>
		</div>
	);
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function GroupsClient() {
	const { user } = useSupabaseSession();
	const qc = useQueryClient();
	const pushToast = useAppStore((s) => s.pushToast);
	const [showCreate, setShowCreate] = useState(false);
	const [activeGroup, setActiveGroup] = useState<GroupView | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: ["groups"],
		queryFn: () => listGroups(user?.id).then((r) => (r.ok ? r.data : [])),
		enabled: !!user,
	});

	const joinMutation = useMutation({
		mutationFn: ({ groupId, join }: { groupId: string; join: boolean }) =>
			toggleGroupMembership(groupId, user?.id, join),
		onSuccess: (result) => {
			if (result.ok) {
				pushToast(
					result.data.joined ? "Joined group!" : "Left group",
					result.data.joined ? "success" : "info",
				);
			} else {
				pushToast(result.message, "error");
			}
			qc.invalidateQueries({ queryKey: ["groups"] });
		},
	});

	const groups = data || [];

	// If viewing a group's messages
	if (activeGroup) {
		return (
			<GroupMessages group={activeGroup} onBack={() => setActiveGroup(null)} />
		);
	}

	return (
		<div>
			<div className="mb-2 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Users className="h-5 w-5 text-gold" />
					<h1 className="text-xl font-bold text-white">Groups</h1>
				</div>
				<button
					onClick={() => setShowCreate(!showCreate)}
					className="flex items-center gap-1 rounded-xl bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 transition-colors"
				>
					<Plus className="h-3.5 w-3.5" />
					New Group
				</button>
			</div>
			<p className="mb-5 text-sm text-muted">
				Find your tribe. Join communities based on shared interests.
			</p>

			{showCreate && (
				<div className="mb-4">
					<CreateGroupForm onDone={() => setShowCreate(false)} />
				</div>
			)}

			{isLoading ? (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-24 rounded-2xl" />
					))}
				</div>
			) : groups.length === 0 ? (
				<EmptyState
					icon="👥"
					title="No groups yet"
					description="Be the first to start a community."
				/>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{groups.map((g) => (
						<div
							key={g.id}
							className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-gold/30"
						>
							<div
								className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
								style={{ background: gradient(g.name) }}
							>
								{g.icon || "👥"}
							</div>
							<div className="min-w-0 flex-1">
								<h3 className="truncate text-sm font-semibold text-white">
									{g.name}
								</h3>
								<p className="line-clamp-1 text-xs text-muted">
									{g.description}
								</p>
								<p className="mt-1 flex items-center gap-1 text-xs text-muted">
									<Users className="h-3 w-3" />
									{(g.member_count || 0).toLocaleString()} members
								</p>
							</div>
							<div className="flex shrink-0 flex-col gap-1">
								{g.joined && (
									<button
										onClick={() => setActiveGroup(g)}
										className="flex h-8 items-center gap-1 rounded-xl bg-gold/10 px-2 text-[10px] font-semibold text-gold hover:bg-gold/20"
									>
										<MessageCircle className="h-3 w-3" /> Chat
									</button>
								)}
								<button
									onClick={() =>
										joinMutation.mutate({
											groupId: g.id,
											join: !g.joined,
										})
									}
									className={cn(
										"flex h-8 items-center gap-1 rounded-xl px-2 text-[10px] font-semibold transition-colors",
										g.joined
											? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
											: "bg-gold text-ink hover:bg-gold-soft",
									)}
								>
									{g.joined ? (
										<>
											<Check className="h-3 w-3" /> Joined
										</>
									) : (
										<>
											<Plus className="h-3 w-3" /> Join
										</>
									)}
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
