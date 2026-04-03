// lib/spotify.ts
// Handles Spotify Client Credentials auth + Nas track fetching

let cachedToken: string | null = null
let tokenExpiry: number = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const clientId = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`)

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken!
}

export interface SpotifyTrack {
  id: string
  name: string
  previewUrl: string
  albumName: string
  albumArt: string
}

// Fetches a random Nas track that has a preview URL
export async function getRandomNasTrack(): Promise<SpotifyTrack> {
  const token = await getAccessToken()

  // Nas's Spotify artist ID
  const NAS_ARTIST_ID = '20qISvAhX20dpIbOOzGK3q'

  // Get albums first (multiple pages for full coverage)
  const albumsRes = await fetch(
    `https://api.spotify.com/v1/artists/${NAS_ARTIST_ID}/albums?include_groups=album,single&market=US&limit=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const albumsData = await albumsRes.json()
  const albums: any[] = albumsData.items || []

  // Shuffle albums and try to find a track with a preview
  const shuffledAlbums = albums.sort(() => Math.random() - 0.5)

  for (const album of shuffledAlbums.slice(0, 10)) {
    const tracksRes = await fetch(
      `https://api.spotify.com/v1/albums/${album.id}/tracks?market=US&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const tracksData = await tracksRes.json()
    const tracks: any[] = (tracksData.items || []).filter(
      (t: any) => t.preview_url
    )

    if (tracks.length > 0) {
      const track = tracks[Math.floor(Math.random() * tracks.length)]
      return {
        id: track.id,
        name: track.name,
        previewUrl: track.preview_url,
        albumName: album.name,
        albumArt: album.images?.[0]?.url || '',
      }
    }
  }

  throw new Error('No tracks with preview URLs found')
}
