import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LRUCache } from "lru-cache";

// ── CONFIGURATION ──
const SEEN_ID_LIMIT = 200;
const RATE_LIMIT_MAX = 30;

// ── RATE LIMITER ──
// Tracks up to 500 unique IPs for 1 minute
const rateLimit = new LRUCache<string, number[]>({
  max: 500,
  ttl: 60 * 1000,
});

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = rateLimit.get(ip) ?? [];

  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= RATE_LIMIT_MAX) return true;

  rateLimit.set(ip, [...recent, now]);
  return false;
}

// ── CLOUDFRONT URL GENERATOR ──
function getMediaUrl(pathFromDb: string): string {
  const cfBase = process.env.CLOUDFRONT_URL;

  if (!cfBase) return pathFromDb;

  // This ensures there is exactly one slash between the domain and the path
  const cleanBase = cfBase.endsWith("/") ? cfBase.slice(0, -1) : cfBase;
  const cleanPath = pathFromDb.startsWith("/") ? pathFromDb : `/${pathFromDb}`;

  return `${cleanBase}${cleanPath}`;
}

export async function GET(request: Request) {
  // ── 1. RATE LIMIT CHECK ──
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") ?? "shuffle";
    const lastId = parseInt(searchParams.get("lastId") ?? "0");
    const seenParam = searchParams.get("seen");

    let seenIds: string[] = seenParam
      ? seenParam.split(",").filter(Boolean)
      : [];

    // Sanitize seen IDs
    seenIds = seenIds.filter((id) => /^\d+$/.test(id)).slice(0, SEEN_ID_LIMIT);

    const supabase = await createClient();

    // ── 2. SEQUENTIAL MODE ──
    if (mode === "sequential") {
      let query = supabase
        .from("tracks")
        .select("*")
        .gt("id", lastId)
        .order("id", { ascending: true })
        .limit(1);

      if (seenIds.length > 0) {
        query = query.not("id", "in", `(${seenIds.join(",")})`);
      }

      const { data, error } = await query.single();

      // Wrap around logic
      if (error || !data) {
        let wrapQuery = supabase
          .from("tracks")
          .select("*")
          .order("id", { ascending: true })
          .limit(1);

        if (seenIds.length > 0) {
          wrapQuery = wrapQuery.not("id", "in", `(${seenIds.join(",")})`);
        }

        const { data: wrapData, error: wrapError } = await wrapQuery.single();

        // Full reset if everything is seen
        if (wrapError || !wrapData) {
          const { data: resetData, error: resetError } = await supabase
            .from("tracks")
            .select("*")
            .order("id", { ascending: true })
            .limit(1)
            .single();

          if (resetError || !resetData)
            return NextResponse.json(
              { error: "No tracks found" },
              { status: 404 },
            );

          return NextResponse.json({
            trackName: resetData.track_name,
            albumName: resetData.album_name,
            albumArt: getMediaUrl(resetData.album_art),
            previewUrl: getMediaUrl(resetData.audio_url),
            startTime: resetData.start_time,
            endTime: resetData.end_time,
            verse: resetData.verse,
            trackId: String(resetData.id),
            wasReset: true,
          });
        }

        return NextResponse.json({
          trackName: wrapData.track_name,
          albumName: wrapData.album_name,
          albumArt: getMediaUrl(wrapData.album_art),
          previewUrl: getMediaUrl(wrapData.audio_url),
          startTime: wrapData.start_time,
          endTime: wrapData.end_time,
          verse: wrapData.verse,
          trackId: String(wrapData.id),
          wasReset: false,
        });
      }

      return NextResponse.json({
        trackName: data.track_name,
        albumName: data.album_name,
        albumArt: getMediaUrl(data.album_art),
        previewUrl: getMediaUrl(data.audio_url),
        startTime: data.start_time,
        endTime: data.end_time,
        verse: data.verse,
        trackId: String(data.id),
        wasReset: false,
      });
    }

    // ── 3. SHUFFLE MODE ──
    let countQuery = supabase
      .from("tracks")
      .select("*", { count: "exact", head: true });

    if (seenIds.length > 0) {
      countQuery = countQuery.not("id", "in", `(${seenIds.join(",")})`);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    // Handle case where all available tracks are seen
    if (!count || count === 0) {
      const { count: totalCount } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true });

      if (!totalCount)
        return NextResponse.json({ error: "No tracks found" }, { status: 404 });

      const randomOffset = Math.floor(Math.random() * totalCount);
      const { data, error } = await supabase
        .from("tracks")
        .select("*")
        .range(randomOffset, randomOffset)
        .single();

      if (error) throw error;

      return NextResponse.json({
        trackName: data.track_name,
        albumName: data.album_name,
        albumArt: getMediaUrl(data.album_art),
        previewUrl: getMediaUrl(data.audio_url),
        startTime: data.start_time,
        endTime: data.end_time,
        verse: data.verse,
        trackId: String(data.id),
        wasReset: true,
      });
    }

    const randomOffset = Math.floor(Math.random() * count);
    let dataQuery = supabase
      .from("tracks")
      .select("*")
      .range(randomOffset, randomOffset);

    if (seenIds.length > 0) {
      dataQuery = dataQuery.not("id", "in", `(${seenIds.join(",")})`);
    }

    const { data, error } = await dataQuery.single();
    if (error) throw error;

    return NextResponse.json({
      trackName: data.track_name,
      albumName: data.album_name,
      albumArt: getMediaUrl(data.album_art),
      previewUrl: getMediaUrl(data.audio_url),
      startTime: data.start_time,
      endTime: data.end_time,
      verse: data.verse,
      trackId: String(data.id),
      wasReset: false,
    });
  } catch (err) {
    console.error("API route error:", err);
    return NextResponse.json(
      { error: "Failed to fetch track" },
      { status: 500 },
    );
  }
}
