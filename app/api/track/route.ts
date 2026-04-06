import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seenParam = searchParams.get("seen");
    let seenIds: string[] = seenParam
      ? seenParam.split(",").filter(Boolean)
      : [];

    const supabase = await createClient();

    // Count only unseen tracks
    let countQuery = supabase
      .from("tracks")
      .select("*", { count: "exact", head: true });
    if (seenIds.length > 0) {
      countQuery = countQuery.not("id", "in", `(${seenIds.join(",")})`);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    // All tracks played — reset and start over
    let wasReset = false;
    if (!count || count === 0) {
      seenIds = [];
      wasReset = true;
      const { count: totalCount } = await supabase
        .from("tracks")
        .select("*", { count: "exact", head: true });
      if (!totalCount)
        return NextResponse.json({ error: "No tracks found" }, { status: 404 });
      // Re-run with full pool
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
      trackId: data.id,
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
