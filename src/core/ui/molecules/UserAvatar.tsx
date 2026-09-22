import { User } from "lucide-react";
import type { ReactNode } from "react";
import { resolveMediaUrl } from "@/integrations/supabase/media";
import { cn } from "../cn";
import { MediaImage } from "./MediaImage";

interface UserAvatarProps {
	/**
	 * A stored photo reference: a path in the `media` bucket or a public URL.
	 * The name is kept because every caller passes it, and `resolveMediaUrl`
	 * accepts both shapes.
	 */
	mediaHash: string | null;
	className?: string;
	size?: "md" | "lg" | "xl";
}

const iconSizeClasses = {
	md: "size-1/2",
	lg: "size-3/5",
	xl: "size-3/4",
} as const;

function profileMediaUrl(opts: {
	mediaHash: string;
	size: "thumb" | "full";
}): string | null {
	// `size` is deliberately unused: the `media` bucket serves one object per
	// upload and no transform variants exist yet, so pretending otherwise would
	// mean a URL that 404s on the thumb.
	return resolveMediaUrl(opts.mediaHash);
}

export function UserAvatar({
	mediaHash,
	className = "size-80",
	size = "md",
}: UserAvatarProps): ReactNode {
	return (
		<div className={cn(className)}>
			{mediaHash ? (
				<MediaImage
					src={profileMediaUrl({ mediaHash, size: "thumb" }) ?? ""}
					className="h-full w-full"
					imgClassName="bg-neutral-600 blur-2xl"
					tone="photo"
					size={size}
					loading="lazy"
				/>
			) : (
				<div className="flex size-full items-center justify-center bg-neutral-700">
					<User
						fill="var(--color-stone-400, #a8a29e)"
						className={cn("m-auto", iconSizeClasses[size])}
					/>
				</div>
			)}
		</div>
	);
}
