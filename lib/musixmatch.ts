// lib/musixmatch.ts
// Fetches lyrics from Musixmatch and extracts a random verse

// Simple in-memory cache to avoid burning API calls (50/day free tier)
const lyricsCache = new Map<string, string>()

async function fetchLyrics(
  trackName: string,
  artistName: string
): Promise<string | null> {
  const cacheKey = `${trackName}::${artistName}`
  if (lyricsCache.has(cacheKey)) return lyricsCache.get(cacheKey)!

  const apiKey = process.env.MUSIXMATCH_API_KEY!

  // Search for the track
  const searchRes = await fetch(
    `https://api.musixmatch.com/ws/1.1/track.search?q_track=${encodeURIComponent(trackName)}&q_artist=${encodeURIComponent(artistName)}&page_size=1&page=1&s_track_rating=desc&apikey=${apiKey}`
  )
  const searchData = await searchRes.json()

  const trackList =
    searchData?.message?.body?.track_list
  if (!trackList || trackList.length === 0) return null

  const trackId = trackList[0]?.track?.track_id
  if (!trackId) return null

  // Fetch lyrics for that track ID
  const lyricsRes = await fetch(
    `https://api.musixmatch.com/ws/1.1/track.lyrics.get?track_id=${trackId}&apikey=${apiKey}`
  )
  const lyricsData = await lyricsRes.json()

  const lyricsBody =
    lyricsData?.message?.body?.lyrics?.lyrics_body
  if (!lyricsBody) return null

  // Musixmatch appends a copyright footer — strip it
  const cleaned = lyricsBody
    .replace(/\*{3,}.*$/s, '')
    .trim()

  lyricsCache.set(cacheKey, cleaned)
  return cleaned
}

// Splits raw lyrics into verses (separated by blank lines)
// and returns a random one with at least 4 lines
function extractRandomVerse(lyrics: string): string {
  const verses = lyrics
    .split(/\n{2,}/)
    .map((v) => v.trim())
    .filter((v) => {
      const lines = v.split('\n').filter((l) => l.trim())
      return lines.length >= 4
    })

  if (verses.length === 0) {
    // Fallback: just take first 8 non-empty lines
    const lines = lyrics
      .split('\n')
      .filter((l) => l.trim())
      .slice(0, 8)
    return lines.join('\n')
  }

  return verses[Math.floor(Math.random() * verses.length)]
}

export async function getVerseForTrack(
  trackName: string,
  artistName: string = 'Nas'
): Promise<string | null> {
  try {
    const lyrics = await fetchLyrics(trackName, artistName)
    if (!lyrics) return null
    return extractRandomVerse(lyrics)
  } catch (err) {
    console.error('Musixmatch error:', err)
    return null
  }
}
