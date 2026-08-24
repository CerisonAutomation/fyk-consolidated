export type EventType =
	| "gym"
	| "dinner"
	| "tour"
	| "cwtch"
	| "chill"
	| "brunch"
	| "console"
	| "dogwalk"
	| "bud"
	| "party"
	| "cultural"
	| "networking";

export interface EventItem {
	id: string;
	title: string;
	description: string;
	type: EventType;
	location: string;
	lat?: number;
	lng?: number;
	datetime: string;
	capacity: number;
	attendeeCount: number;
	isFree: boolean;
	hostName: string;
	hostAvatar: string;
	rsvpStatus?: "going" | "interested" | "not_going";
}

export const EVENT_META: Record<
	EventType,
	{ label: string; color: string; icon: string }
> = {
	gym: { label: "Gym Session", color: "#FF4500", icon: "Dumbbell" },
	dinner: { label: "Dinner Date", color: "#D4AF37", icon: "UtensilsCrossed" },
	tour: { label: "City Tour", color: "#0088FF", icon: "MapPin" },
	cwtch: { label: "Cwtch Night", color: "#FF69B4", icon: "Heart" },
	chill: { label: "Chill Hang", color: "#00FF88", icon: "Coffee" },
	brunch: { label: "Brunch Club", color: "#00D4FF", icon: "Egg" },
	console: { label: "Console Night", color: "#7B2FBE", icon: "Gamepad2" },
	dogwalk: { label: "Dog Walk", color: "#FF4500", icon: "PawPrint" },
	bud: { label: "Bud Session", color: "#D4AF37", icon: "Leaf" },
	party: { label: "Party", color: "#FF073A", icon: "Music" },
	cultural: { label: "Cultural Event", color: "#00D4FF", icon: "Palette" },
	networking: { label: "Networking", color: "#00FF88", icon: "Briefcase" },
};

export const MOCK_EVENTS: EventItem[] = [
	{
		id: "e-1",
		title: "Sunset Yoga at Sliema",
		description:
			"Join us for a chill sunset yoga session right by the Sliema promenade. All levels welcome. Bring your mat and good vibes.",
		type: "chill",
		location: "Sliema Promenade, Malta",
		lat: 35.9122,
		lng: 14.5068,
		datetime: new Date(Date.now() + 2 * 86400000).toISOString(),
		capacity: 30,
		attendeeCount: 18,
		isFree: true,
		hostName: "Alex M.",
		hostAvatar: "AM",
		rsvpStatus: "going",
	},
	{
		id: "e-2",
		title: "Rooftop Dinner in Valletta",
		description:
			"A curated rooftop dinner experience overlooking the Grand Harbour. 3-course meal, great wine, better company.",
		type: "dinner",
		location: "Rooftop Lounge, Valletta",
		lat: 35.8989,
		lng: 14.5146,
		datetime: new Date(Date.now() + 5 * 86400000).toISOString(),
		capacity: 20,
		attendeeCount: 14,
		isFree: false,
		hostName: "Jordan K.",
		hostAvatar: "JK",
		rsvpStatus: "interested",
	},
	{
		id: "e-3",
		title: "Pump & Grind — Morning Gym Sesh",
		description:
			"Early morning gym session at Bodycraft. We'll hit chest & triceps. Partners encouraged but not required.",
		type: "gym",
		location: "Bodycraft Gym, St Julians",
		lat: 35.9185,
		lng: 14.4873,
		datetime: new Date(Date.now() + 1 * 86400000).toISOString(),
		capacity: 12,
		attendeeCount: 8,
		isFree: true,
		hostName: "Ryan D.",
		hostAvatar: "RD",
	},
	{
		id: "e-4",
		title: "Mdina Night Walk",
		description:
			"Walking tour through the silent city at dusk. Historic streets, atmospheric lighting, and good conversation.",
		type: "tour",
		location: "Mdina Gate, Malta",
		lat: 35.8861,
		lng: 14.4033,
		datetime: new Date(Date.now() + 3 * 86400000).toISOString(),
		capacity: 15,
		attendeeCount: 11,
		isFree: true,
		hostName: "Sam B.",
		hostAvatar: "SB",
	},
	{
		id: "e-5",
		title: "Cwtch & Chill Movie Night",
		description:
			"Cozy movie night at someone's place in St Julians. We're watching a classic rom-com. Snacks provided, bring yourself.",
		type: "cwtch",
		location: "St Julians, Malta",
		lat: 35.9192,
		lng: 14.4894,
		datetime: new Date(Date.now() + 4 * 86400000).toISOString(),
		capacity: 10,
		attendeeCount: 7,
		isFree: true,
		hostName: "Luke T.",
		hostAvatar: "LT",
	},
	{
		id: "e-6",
		title: "Sunday Brunch Club",
		description:
			"Weekly brunch gathering at a secret Valletta location. Eggs, avocado, coffee, and community.",
		type: "brunch",
		location: "Valletta, Malta",
		lat: 35.8997,
		lng: 14.5146,
		datetime: new Date(Date.now() + 7 * 86400000).toISOString(),
		capacity: 25,
		attendeeCount: 19,
		isFree: false,
		hostName: "Marco V.",
		hostAvatar: "MV",
	},
	{
		id: "e-7",
		title: "PlayStation Tournament Night",
		description:
			"FIFA & Tekken tournament at the club. Winner gets bragging rights and a free drink. BYO controller.",
		type: "console",
		location: "GameZone, Bugibba",
		lat: 35.9714,
		lng: 14.4068,
		datetime: new Date(Date.now() + 6 * 86400000).toISOString(),
		capacity: 16,
		attendeeCount: 12,
		isFree: true,
		hostName: "Dean C.",
		hostAvatar: "DC",
	},
	{
		id: "e-8",
		title: "FREYJ Party — Bass & Beats",
		description:
			"Monthly dance party at our favourite venue. DJs spinning house & techno. Strictly good vibes only.",
		type: "party",
		location: "FREYJ Club, Paceville",
		lat: 35.9284,
		lng: 14.4793,
		datetime: new Date(Date.now() + 10 * 86400000).toISOString(),
		capacity: 120,
		attendeeCount: 74,
		isFree: false,
		hostName: "FYK Events",
		hostAvatar: "FK",
	},
	{
		id: "e-9",
		title: "Art Walk — Contemporary Art Scene",
		description:
			"Guided walk through Valletta's contemporary art galleries. Meet at the National Library and explore together.",
		type: "cultural",
		location: "National Library, Valletta",
		lat: 35.8994,
		lng: 14.5144,
		datetime: new Date(Date.now() + 8 * 86400000).toISOString(),
		capacity: 12,
		attendeeCount: 6,
		isFree: true,
		hostName: "Nina P.",
		hostAvatar: "NP",
	},
	{
		id: "e-10",
		title: "Dog Walk — Pembroke Trails",
		description:
			"Casual dog walk through the Pembroke nature trails. Dogs of all sizes welcome. Water stops provided.",
		type: "dogwalk",
		location: "Pembroke, Malta",
		lat: 35.9365,
		lng: 14.4782,
		datetime: new Date(Date.now() + 2.5 * 86400000).toISOString(),
		capacity: 20,
		attendeeCount: 9,
		isFree: true,
		hostName: "Chris A.",
		hostAvatar: "CA",
	},
	{
		id: "e-11",
		title: "Tech & Networking Mixer",
		description:
			"Monthly tech networking event. Meet founders, developers, and creatives over craft beer.",
		type: "networking",
		location: "Hub Malta, Birkirkara",
		lat: 35.8917,
		lng: 14.4636,
		datetime: new Date(Date.now() + 9 * 86400000).toISOString(),
		capacity: 40,
		attendeeCount: 22,
		isFree: false,
		hostName: "FYK Events",
		hostAvatar: "FK",
	},
	{
		id: "e-12",
		title: "Chill Park Session",
		description:
			"Bring a blanket, some drinks, and let's hang out at the park. No agenda, just good company.",
		type: "chill",
		location: "Upper Barrakka Gardens, Valletta",
		lat: 35.8958,
		lng: 14.5119,
		datetime: new Date(Date.now() + 11 * 86400000).toISOString(),
		capacity: 20,
		attendeeCount: 5,
		isFree: true,
		hostName: "Jamie L.",
		hostAvatar: "JL",
	},
];

export type EventTab = "list" | "grid" | "calendar";
