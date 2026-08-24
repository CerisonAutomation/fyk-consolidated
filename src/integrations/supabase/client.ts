import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qebgamfpguacwmpxevvb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
	"sb_publishable_EfvCnCvJrZGfLE0pgeDKeA_C8P4UpWB";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
