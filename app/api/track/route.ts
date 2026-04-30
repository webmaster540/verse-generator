import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { LRUCache } from "lru-cache";

const SEEN_ID_LIMIT = 200;

// ── S3 CLIENT ──
const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ── RATE LIMITER ──
// 30 requests per IP per minute
const rateLimit = new LRUCache<string, number[]>({
  max: 500, // track up to 500 unique IPs
  ttl: 60 * 1000, // 1 minute window
});

const RATE_LIMIT_MAX = 30;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = rateLimit.get(ip) ?? [];

  // Keep only timestamps within the current window
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= RATE_LIMIT_MAX) return true;

  rateLimit.set(ip, [...recent, now]);
  return false;
}

// ── SIGN S3 URL ──
async function signS3Url(rawUrl: string): Promise<string> {
  const url = new URL(rawUrl);
  const key = url.pathname.slice(1);

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn: 300 });
}

export async function GET(request: Request) {
  // ── RATE LIMIT CHECK ──
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

    // Sanitize
    seenIds = seenIds.filter((id) => /^\d+$/.test(id)).slice(0, SEEN_ID_LIMIT);

    const supabase = await createClient();

    // ── SEQUENTIAL MODE ──
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

      // If nothing found after lastId, wrap around from the beginning
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

        // All tracks seen — full reset
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

          const [previewUrl, albumArt] = await Promise.all([
            signS3Url(resetData.audio_url),
            signS3Url(resetData.album_art),
          ]);

          return NextResponse.json({
            trackName: resetData.track_name,
            albumName: resetData.album_name,
            albumArt,
            previewUrl,
            startTime: resetData.start_time,
            endTime: resetData.end_time,
            verse: resetData.verse,
            trackId: String(resetData.id),
            wasReset: true,
          });
        }

        const [previewUrl, albumArt] = await Promise.all([
          signS3Url(wrapData.audio_url),
          signS3Url(wrapData.album_art),
        ]);

        return NextResponse.json({
          trackName: wrapData.track_name,
          albumName: wrapData.album_name,
          albumArt,
          previewUrl,
          startTime: wrapData.start_time,
          endTime: wrapData.end_time,
          verse: wrapData.verse,
          trackId: String(wrapData.id),
          wasReset: false,
        });
      }

      const [previewUrl, albumArt] = await Promise.all([
        signS3Url(data.audio_url),
        signS3Url(data.album_art),
      ]);

      return NextResponse.json({
        trackName: data.track_name,
        albumName: data.album_name,
        albumArt,
        previewUrl,
        startTime: data.start_time,
        endTime: data.end_time,
        verse: data.verse,
        trackId: String(data.id),
        wasReset: false,
      });
    }

    // ── SHUFFLE MODE ──
    let countQuery = supabase
      .from("tracks")
      .select("*", { count: "exact", head: true });
    if (seenIds.length > 0) {
      countQuery = countQuery.not("id", "in", `(${seenIds.join(",")})`);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

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

      const [previewUrl, albumArt] = await Promise.all([
        signS3Url(data.audio_url),
        signS3Url(data.album_art),
      ]);

      return NextResponse.json({
        trackName: data.track_name,
        albumName: data.album_name,
        albumArt,
        previewUrl,
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

    const [previewUrl, albumArt] = await Promise.all([
      signS3Url(data.audio_url),
      signS3Url(data.album_art),
    ]);

    return NextResponse.json({
      trackName: data.track_name,
      albumName: data.album_name,
      albumArt,
      previewUrl,
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
