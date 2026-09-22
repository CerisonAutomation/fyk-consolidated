import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

serve(async (req) => {
  const traceId = crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "X-Trace-Id": traceId } });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const url = new URL(req.url);
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lng = parseFloat(url.searchParams.get('lng') || '0');
    const geohash = url.searchParams.get('geohash');
    const maxDistance = parseInt(url.searchParams.get('maxDistance') || '5000');
    const filters = JSON.parse(url.searchParams.get('filters') || '{}');

    let query = supabase.from('profiles').select('*').limit(50);

    if (geohash) {
      query = query.eq('geohash', geohash);
    }

    // Apply filters
    if (filters.minAge) query = query.gte('age', filters.minAge);
    if (filters.maxAge) query = query.lte('age', filters.maxAge);
    if (filters.verifiedOnly) query = query.eq('verified', true);
    if (filters.withPhotoOnly) query = query.eq('has_photo', true);
    if (filters.onlineOnly) query = query.gt('online_until', new Date().toISOString());

    const { data: profiles } = await query;

    // Calculate distance Haversine if lat/lng provided
    let results = (profiles || []).map(p => {
      let distance = p.distance || 0;
      if (lat && lng && p.lat && p.lng) {
        distance = Math.round(haversine(lat, lng, p.lat, p.lng));
      }
      return { ...p, distance, distance_m: distance };
    }).filter(p => p.distance <= maxDistance).sort((a,b) => a.distance - b.distance);

    // RLS: filter blocked users
    const userId = req.headers.get('x-user-id');
    if (userId) {
      const { data: blocked } = await supabase.from('blocked_users').select('blocked_id').eq('user_id', userId);
      const blockedIds = new Set(blocked?.map(b => b.blocked_id) || []);
      results = results.filter(p => !blockedIds.has(p.user_id));
    }

    return new Response(JSON.stringify({ profiles: results, count: results.length, total: results.length, traceId, predictive: { autoInfer: `Found ${results.length} nearby profiles, auto-infer preferences`, recognizePatterns: ['geohash', 'distance', 'filters'] } }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "X-Trace-Id": traceId } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, traceId }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});