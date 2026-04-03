import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Get total count of tracks
    const { count, error: countError } = await supabase
      .from("tracks")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;
    if (!count || count === 0) {
      return NextResponse.json({ error: "No tracks found" }, { status: 404 });
    }

    // Pick a random offset and fetch that single row
    const randomOffset = Math.floor(Math.random() * count);

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
    });
  } catch (err) {
    console.error("API route error:", err);
    return NextResponse.json(
      { error: "Failed to fetch track" },
      { status: 500 },
    );
  }
}
