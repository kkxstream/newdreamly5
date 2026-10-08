const API_URL = "https://jiosaavndev.vercel.app/api/";

const DEFAULT_LIMIT = 150;
const DEFAULT_PAGE = 0;

/*
|--------------------------------------------------------------------------
| URL Builder
|--------------------------------------------------------------------------
*/

const buildUrl = (endpoint, params = {}) => {
  const cleanEndpoint = String(endpoint || "")
    .replace(/^\/+/, "");

  const url = new URL(cleanEndpoint, API_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
};

/*
|--------------------------------------------------------------------------
| Common API Request
|--------------------------------------------------------------------------
*/

const apiRequest = async (endpoint, params = {}) => {
  const url = buildUrl(endpoint, params);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const contentType =
      response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();

      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        data?.data?.message ||
        `Request failed: ${response.status} ${response.statusText}`;

      throw new Error(message);
    }

    /*
     * Some API versions return:
     *
     * {
     *   success: true,
     *   data: {...}
     * }
     *
     * Keep the complete response because existing
     * components expect response.data.
     */

    return data;
  } catch (error) {
    console.error("JioSaavn API Error:", error);
    console.error("Request URL:", url);

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Query Validation
|--------------------------------------------------------------------------
*/

const requireQuery = (query, name = "Search") => {
  const value = String(query ?? "").trim();

  if (!value) {
    throw new Error(`${name} query is required`);
  }

  return value;
};

const requireId = (id, name = "ID") => {
  const value = String(id ?? "").trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
};

const normalizeLimit = (limit) => {
  const value = Number(limit);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(value), 150);
};

/*
|--------------------------------------------------------------------------
| GENERAL SEARCH
|--------------------------------------------------------------------------
*/

/**
 * Search songs, albums, artists and playlists.
 *
 * GET /api/search?query=...
 */
export const getSearchData = async (
  query,
  limit = DEFAULT_LIMIT
) => {
  const searchQuery = requireQuery(query);
  const safeLimit = normalizeLimit(limit);

  return apiRequest("search", {
    query: searchQuery,
    limit: safeLimit,
  });
};

/*
|--------------------------------------------------------------------------
| SONGS
|--------------------------------------------------------------------------
*/

/**
 * Search songs.
 *
 * GET /api/search/songs
 */
export const getSongbyQuery = async (
  query,
  limit = DEFAULT_LIMIT
) => {
  const searchQuery = requireQuery(
    query,
    "Song search"
  );

  return apiRequest("search/songs", {
    query: searchQuery,
    page: DEFAULT_PAGE,
    limit: normalizeLimit(limit),
  });
};

/**
 * Alias.
 */
export const searchSongByQuery = getSongbyQuery;

/**
 * Get song by ID.
 *
 * GET /api/songs?id=...
 */
export const getSongById = async (songId) => {
  const id = requireId(songId, "Song ID");

  return apiRequest("songs", {
    id,
  });
};

/**
 * Alias used by some older components.
 */
export const fetchSongByID = getSongById;

/**
 * Get song suggestions.
 *
 * GET /api/songs/:id/suggestions
 */
export const getSuggestionSong = async (
  songId,
  limit = DEFAULT_LIMIT
) => {
  const id = requireId(songId, "Song ID");

  return apiRequest(
    `songs/${encodeURIComponent(id)}/suggestions`,
    {
      limit: normalizeLimit(limit),
    }
  );
};

/**
 * Alias.
 */
export const fetchSongSuggestionsByID =
  getSuggestionSong;

/*
|--------------------------------------------------------------------------
| LYRICS
|--------------------------------------------------------------------------
*/

/**
 * Get lyrics by song ID.
 *
 * GET /api/lyrics?id=...
 */
export const LyricsByID = async (songId) => {
  const id = requireId(songId, "Song ID");

  return apiRequest("lyrics", {
    id,
  });
};

/**
 * More readable alias.
 */
export const getLyricsById = LyricsByID;

/*
|--------------------------------------------------------------------------
| ARTISTS
|--------------------------------------------------------------------------
*/

/**
 * Search artists.
 *
 * GET /api/search/artists
 */
export const getArtistbyQuery = async (
  query,
  limit = DEFAULT_LIMIT
) => {
  const searchQuery = requireQuery(
    query,
    "Artist search"
  );

  return apiRequest("search/artists", {
    query: searchQuery,
    page: DEFAULT_PAGE,
    limit: normalizeLimit(limit),
  });
};

/**
 * Alias.
 */
export const searchArtistByQuery =
  getArtistbyQuery;

/**
 * Get artist by ID.
 *
 * GET /api/artists?id=...
 */
export const fetchArtistByID = async (
  artistId
) => {
  const id = requireId(artistId, "Artist ID");

  return apiRequest("artists", {
    id,
  });
};

/*
|--------------------------------------------------------------------------
| ALBUMS
|--------------------------------------------------------------------------
*/

/**
 * Search albums.
 *
 * GET /api/search/albums
 */
export const searchAlbumByQuery = async (
  query,
  limit = DEFAULT_LIMIT
) => {
  const searchQuery = requireQuery(
    query,
    "Album search"
  );

  return apiRequest("search/albums", {
    query: searchQuery,
    page: DEFAULT_PAGE,
    limit: normalizeLimit(limit),
  });
};

/**
 * Alias.
 */
export const getAlbumbyQuery =
  searchAlbumByQuery;

/**
 * Get album by ID.
 *
 * GET /api/albums?id=...
 */
export const fetchAlbumByID = async (
  albumId
) => {
  const id = requireId(albumId, "Album ID");

  return apiRequest("albums", {
    id,
  });
};

/*
|--------------------------------------------------------------------------
| PLAYLISTS
|--------------------------------------------------------------------------
*/

/**
 * Search playlists.
 *
 * GET /api/search/playlists
 */
export const searchPlayListByQuery = async (
  query,
  limit = DEFAULT_LIMIT
) => {
  const searchQuery = requireQuery(
    query,
    "Playlist search"
  );

  return apiRequest("search/playlists", {
    query: searchQuery,
    page: DEFAULT_PAGE,
    limit: normalizeLimit(limit),
  });
};

/**
 * Alias with standard spelling.
 */
export const searchPlaylistByQuery =
  searchPlayListByQuery;

/**
 * Get playlist by ID.
 *
 * GET /api/playlists?id=...
 */
export const fetchplaylistsByID = async (
  playlistId
) => {
  const id = requireId(
    playlistId,
    "Playlist ID"
  );

  return apiRequest("playlists", {
    id,
  });
};

/**
 * Alias with standard naming.
 */
export const fetchPlaylistsByID =
  fetchplaylistsByID;

/*
|--------------------------------------------------------------------------
| DEFAULT EXPORT
|--------------------------------------------------------------------------
*/

export default {
  // General search
  getSearchData,

  // Songs
  getSongbyQuery,
  searchSongByQuery,
  getSongById,
  fetchSongByID,
  getSuggestionSong,
  fetchSongSuggestionsByID,

  // Lyrics
  LyricsByID,
  getLyricsById,

  // Artists
  getArtistbyQuery,
  searchArtistByQuery,
  fetchArtistByID,

  // Albums
  searchAlbumByQuery,
  getAlbumbyQuery,
  fetchAlbumByID,

  // Playlists
  searchPlayListByQuery,
  searchPlaylistByQuery,
  fetchplaylistsByID,
  fetchPlaylistsByID,
};
