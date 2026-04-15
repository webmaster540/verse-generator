import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SEEN_ID_LIMIT = 200;

export async function GET(request: Request) {
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
      // Try to get the next track after lastId, excluding seen
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

          return NextResponse.json({
            trackName: resetData.track_name,
            albumName: resetData.album_name,
            albumArt: resetData.album_art,
            previewUrl: resetData.audio_url,
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
          albumArt: wrapData.album_art,
          previewUrl: wrapData.audio_url,
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
        albumArt: data.album_art,
        previewUrl: data.audio_url,
        startTime: data.start_time,
        endTime: data.end_time,
        verse: data.verse,
        trackId: String(data.id),
        wasReset: false,
      });
    }

    // ── SHUFFLE MODE (existing logic) ──
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

      return NextResponse.json({
        trackName: data.track_name,
        albumName: data.album_name,
        albumArt: data.album_art,
        previewUrl: data.audio_url,
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
      albumArt: data.album_art,
      previewUrl: data.audio_url,
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
