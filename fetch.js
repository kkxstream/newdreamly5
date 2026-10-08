/*
|--------------------------------------------------------------------------
| JioSaavn API
|--------------------------------------------------------------------------
| All search functions automatically paginate through ALL available
| results instead of stopping at 150.
|--------------------------------------------------------------------------
*/

const API_URL = "https://jiosaavndev.vercel.app/api/";

const PAGE_SIZE = 150;
const DEFAULT_PAGE = 0;

/*
|--------------------------------------------------------------------------
| URL Builder
|--------------------------------------------------------------------------
*/

const buildUrl = (endpoint, params = {}) => {
  const cleanEndpoint = String(endpoint || "").replace(/^\/+/, "");

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

    return data;
  } catch (error) {
    console.error("JioSaavn API Error:", error);
    console.error("Request URL:", url);

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Validation
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

/*
|--------------------------------------------------------------------------
| Extract Results
|--------------------------------------------------------------------------
*/

const extractResults = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.results)) {
    return response.data.results;
  }

  if (Array.isArray(response?.results)) {
    return response.results;
  }

  return [];
};

/*
|--------------------------------------------------------------------------
| Extract Total
|--------------------------------------------------------------------------
*/

const extractTotal = (response) => {
  const possibleTotals = [
    response?.data?.total,
    response?.total,
  ];

  for (const value of possibleTotals) {
    const total = Number(value);

    if (
      Number.isFinite(total) &&
      total >= 0
    ) {
      return total;
    }
  }

  return null;
};

/*
|--------------------------------------------------------------------------
| Fetch ALL Pages
|--------------------------------------------------------------------------
|
| This is the important part.
|
| The API may return only 150 results per request.
| We automatically continue:
|
| page=0
| page=1
| page=2
| page=3
| ...
|
| until there are no more results.
|--------------------------------------------------------------------------
*/

const fetchAllPages = async (
  endpoint,
  params = {},
  pageSize = PAGE_SIZE
) => {
  const allResults = [];

  let page = DEFAULT_PAGE;
  let total = null;

  while (true) {
    const response = await apiRequest(endpoint, {
      ...params,
      page,
      limit: pageSize,
    });

    const results = extractResults(response);

    if (page === DEFAULT_PAGE) {
      total = extractTotal(response);
    }

    if (!results.length) {
      break;
    }

    allResults.push(...results);

    /*
    |--------------------------------------------------------------------------
    | Stop when API tells us the total
    |--------------------------------------------------------------------------
    */

    if (
      total !== null &&
      allResults.length >= total
    ) {
      break;
    }

    /*
    |--------------------------------------------------------------------------
    | If less than requested page size was returned,
    | normally this is the final page.
    |--------------------------------------------------------------------------
    */

    if (results.length < pageSize) {
      break;
    }

    /*
    |--------------------------------------------------------------------------
    | Safety protection against an API repeatedly returning
    | exactly the same page forever.
    |--------------------------------------------------------------------------
    */

    if (page > 10000) {
      console.warn(
        "JioSaavn pagination stopped after 10,000 pages."
      );
      break;
    }

    page += 1;
  }

  /*
  |--------------------------------------------------------------------------
  | Remove duplicate IDs
  |--------------------------------------------------------------------------
  */

  const uniqueResults = [];
  const seen = new Set();

  for (const item of allResults) {
    const id =
      item?.id ??
      item?.albumId ??
      item?.artistId ??
      item?.playlistId;

    if (id !== undefined && id !== null) {
      const key = String(id);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
    }

    uniqueResults.push(item);
  }

  return uniqueResults;
};

/*
|--------------------------------------------------------------------------
| Build Combined Response
|--------------------------------------------------------------------------
|
| Existing components expect:
|
| response.data.results
|
| So we preserve that structure.
|--------------------------------------------------------------------------
*/

const createResultsResponse = (
  results,
  originalResponse = {}
) => {
  const originalData =
    originalResponse?.data &&
    typeof originalResponse.data === "object" &&
    !Array.isArray(originalResponse.data)
      ? originalResponse.data
      : {};

  return {
    ...originalResponse,

    success:
      originalResponse?.success !== undefined
        ? originalResponse.success
        : true,

    data: {
      ...originalData,
      results,
      total: results.length,
      start: 0,
      count: results.length,
    },
  };
};

/*
|--------------------------------------------------------------------------
| GENERAL SEARCH
|--------------------------------------------------------------------------
|
| General search is kept as a single request because this endpoint
| returns multiple categories together.
|--------------------------------------------------------------------------
*/

export const getSearchData = async (query) => {
  const searchQuery = requireQuery(query);

  return apiRequest("search", {
    query: searchQuery,
  });
};

/*
|--------------------------------------------------------------------------
| SONG SEARCH - ALL SONGS
|--------------------------------------------------------------------------
*/

export const getSongbyQuery = async (query) => {
  const searchQuery = requireQuery(
    query,
    "Song search"
  );

  let firstResponse = null;

  const results = [];

  let page = DEFAULT_PAGE;
  let total = null;

  while (true) {
    const response = await apiRequest(
      "search/songs",
      {
        query: searchQuery,
        page,
        limit: PAGE_SIZE,
      }
    );

    if (!firstResponse) {
      firstResponse = response;
      total = extractTotal(response);
    }

    const pageResults = extractResults(response);

    if (!pageResults.length) {
      break;
    }

    results.push(...pageResults);

    if (
      total !== null &&
      results.length >= total
    ) {
      break;
    }

    if (pageResults.length < PAGE_SIZE) {
      break;
    }

    if (page > 10000) {
      break;
    }

    page += 1;
  }

  return createResultsResponse(
    results,
    firstResponse
  );
};

export const searchSongByQuery =
  getSongbyQuery;

/*
|--------------------------------------------------------------------------
| SONG BY ID
|--------------------------------------------------------------------------
*/

export const getSongById = async (songId) => {
  const id = requireId(songId, "Song ID");

  return apiRequest("songs", {
    id,
  });
};

export const fetchSongByID =
  getSongById;

/*
|--------------------------------------------------------------------------
| SONG SUGGESTIONS - ALL
|--------------------------------------------------------------------------
*/

export const getSuggestionSong = async (
  songId
) => {
  const id = requireId(
    songId,
    "Song ID"
  );

  return fetchAllPages(
    `songs/${encodeURIComponent(id)}/suggestions`
  ).then((results) => ({
    success: true,
    data: {
      results,
      total: results.length,
      start: 0,
      count: results.length,
    },
  }));
};

export const fetchSongSuggestionsByID =
  getSuggestionSong;

/*
|--------------------------------------------------------------------------
| LYRICS
|--------------------------------------------------------------------------
*/

export const LyricsByID = async (songId) => {
  const id = requireId(
    songId,
    "Song ID"
  );

  return apiRequest("lyrics", {
    id,
  });
};

export const getLyricsById =
  LyricsByID;

/*
|--------------------------------------------------------------------------
| ARTIST SEARCH - ALL ARTISTS
|--------------------------------------------------------------------------
*/

export const getArtistbyQuery = async (
  query
) => {
  const searchQuery = requireQuery(
    query,
    "Artist search"
  );

  let firstResponse = null;

  const results = [];

  let page = DEFAULT_PAGE;
  let total = null;

  while (true) {
    const response = await apiRequest(
      "search/artists",
      {
        query: searchQuery,
        page,
        limit: PAGE_SIZE,
      }
    );

    if (!firstResponse) {
      firstResponse = response;
      total = extractTotal(response);
    }

    const pageResults =
      extractResults(response);

    if (!pageResults.length) {
      break;
    }

    results.push(...pageResults);

    if (
      total !== null &&
      results.length >= total
    ) {
      break;
    }

    if (pageResults.length < PAGE_SIZE) {
      break;
    }

    if (page > 10000) {
      break;
    }

    page += 1;
  }

  return createResultsResponse(
    results,
    firstResponse
  );
};

export const searchArtistByQuery =
  getArtistbyQuery;

/*
|--------------------------------------------------------------------------
| ARTIST BY ID
|--------------------------------------------------------------------------
*/

export const fetchArtistByID = async (
  artistId
) => {
  const id = requireId(
    artistId,
    "Artist ID"
  );

  return apiRequest("artists", {
    id,
  });
};

/*
|--------------------------------------------------------------------------
| ALBUM SEARCH - ALL ALBUMS
|--------------------------------------------------------------------------
*/

export const searchAlbumByQuery = async (
  query
) => {
  const searchQuery = requireQuery(
    query,
    "Album search"
  );

  let firstResponse = null;

  const results = [];

  let page = DEFAULT_PAGE;
  let total = null;

  while (true) {
    const response = await apiRequest(
      "search/albums",
      {
        query: searchQuery,
        page,
        limit: PAGE_SIZE,
      }
    );

    if (!firstResponse) {
      firstResponse = response;
      total = extractTotal(response);
    }

    const pageResults =
      extractResults(response);

    if (!pageResults.length) {
      break;
    }

    results.push(...pageResults);

    if (
      total !== null &&
      results.length >= total
    ) {
      break;
    }

    if (pageResults.length < PAGE_SIZE) {
      break;
    }

    if (page > 10000) {
      break;
    }

    page += 1;
  }

  return createResultsResponse(
    results,
    firstResponse
  );
};

export const getAlbumbyQuery =
  searchAlbumByQuery;

/*
|--------------------------------------------------------------------------
| ALBUM BY ID
|--------------------------------------------------------------------------
*/

export const fetchAlbumByID = async (
  albumId
) => {
  const id = requireId(
    albumId,
    "Album ID"
  );

  return apiRequest("albums", {
    id,
  });
};

/*
|--------------------------------------------------------------------------
| PLAYLIST SEARCH - ALL PLAYLISTS
|--------------------------------------------------------------------------
*/

export const searchPlayListByQuery = async (
  query
) => {
  const searchQuery = requireQuery(
    query,
    "Playlist search"
  );

  let firstResponse = null;

  const results = [];

  let page = DEFAULT_PAGE;
  let total = null;

  while (true) {
    const response = await apiRequest(
      "search/playlists",
      {
        query: searchQuery,
        page,
        limit: PAGE_SIZE,
      }
    );

    if (!firstResponse) {
      firstResponse = response;
      total = extractTotal(response);
    }

    const pageResults =
      extractResults(response);

    if (!pageResults.length) {
      break;
    }

    results.push(...pageResults);

    if (
      total !== null &&
      results.length >= total
    ) {
      break;
    }

    if (pageResults.length < PAGE_SIZE) {
      break;
    }

    if (page > 10000) {
      break;
    }

    page += 1;
  }

  return createResultsResponse(
    results,
    firstResponse
  );
};

export const searchPlaylistByQuery =
  searchPlayListByQuery;

/*
|--------------------------------------------------------------------------
| PLAYLIST BY ID
|--------------------------------------------------------------------------
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

export const fetchPlaylistsByID =
  fetchplaylistsByID;

/*
|--------------------------------------------------------------------------
| DEFAULT EXPORT
|--------------------------------------------------------------------------
*/

export default {
  /*
  | General
  */
  getSearchData,

  /*
  | Songs
  */
  getSongbyQuery,
  searchSongByQuery,
  getSongById,
  fetchSongByID,
  getSuggestionSong,
  fetchSongSuggestionsByID,

  /*
  | Lyrics
  */
  LyricsByID,
  getLyricsById,

  /*
  | Artists
  */
  getArtistbyQuery,
  searchArtistByQuery,
  fetchArtistByID,

  /*
  | Albums
  */
  searchAlbumByQuery,
  getAlbumbyQuery,
  fetchAlbumByID,

  /*
  | Playlists
  */
  searchPlayListByQuery,
  searchPlaylistByQuery,
  fetchplaylistsByID,
  fetchPlaylistsByID,
};
