import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link, useParams } from "react-router-dom";

import Navbar from "../components/Navbar";
import SongsList from "../components/SongsList";
import Navigator from "../components/Navigator";
import Footer from "../components/footer";
import SongGrid from "../components/SongGrid";

import {
  fetchAlbumByID,
  getSuggestionSong,
} from "../../fetch";

import { FaHeart, FaRegHeart } from "react-icons/fa6";

import {
  MdOutlineKeyboardArrowLeft,
  MdOutlineKeyboardArrowRight,
} from "react-icons/md";

import { IoShareSocial } from "react-icons/io5";

/* =========================================================
   CONSTANTS
========================================================= */

const FALLBACK_IMAGE = "/Unknown.png";

/* =========================================================
   SAFE HELPERS
========================================================= */

const safeString = (value, fallback = "") => {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
};

/* =========================================================
   IMAGE HELPER
========================================================= */

const getImageUrl = (image) => {
  if (!image) return "";

  if (typeof image === "string") {
    return image.trim();
  }

  if (Array.isArray(image)) {
    for (const item of image) {
      if (typeof item === "string" && item.trim()) {
        return item.trim();
      }

      if (
        item &&
        typeof item === "object" &&
        typeof item.url === "string" &&
        item.url.trim()
      ) {
        return item.url.trim();
      }

      if (
        item &&
        typeof item === "object" &&
        typeof item.link === "string" &&
        item.link.trim()
      ) {
        return item.link.trim();
      }
    }

    return "";
  }

  if (typeof image === "object") {
    return (
      image?.url ||
      image?.link ||
      image?.src ||
      image?.medium ||
      image?.large ||
      ""
    );
  }

  return "";
};

/* =========================================================
   ID HELPERS
========================================================= */

const getAlbumId = (album, fallbackId = null) => {
  if (!album) {
    return fallbackId;
  }

  return (
    album?.id ||
    album?.albumId ||
    album?.album_id ||
    album?.more_info?.album_id ||
    album?.more_info?.albumId ||
    fallbackId ||
    null
  );
};

const getSongId = (song) => {
  if (!song) return null;

  return (
    song?.id ||
    song?.songId ||
    song?.song_id ||
    song?.more_info?.song_id ||
    song?.more_info?.songId ||
    null
  );
};

/* =========================================================
   ALBUM RESPONSE PARSER
========================================================= */

const extractAlbum = (response, fallbackId = null) => {
  if (!response) {
    return null;
  }

  const candidates = [
    response?.data?.album,

    Array.isArray(response?.data?.results)
      ? response.data.results[0]
      : null,

    Array.isArray(response?.data?.albums)
      ? response.data.albums[0]
      : null,

    Array.isArray(response?.data)
      ? response.data[0]
      : null,

    response?.data,

    response?.album,

    Array.isArray(response?.results)
      ? response.results[0]
      : null,

    Array.isArray(response?.albums)
      ? response.albums[0]
      : null,

    response,
  ];

  for (const candidate of candidates) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      continue;
    }

    const candidateId = getAlbumId(
      candidate,
      fallbackId
    );

    if (
      candidateId ||
      candidate?.name ||
      candidate?.title ||
      Array.isArray(candidate?.songs)
    ) {
      return candidate;
    }
  }

  return null;
};

/* =========================================================
   ALBUM SONGS PARSER
========================================================= */

const extractAlbumSongs = (
  response,
  album
) => {
  const candidates = [
    album?.songs,

    response?.data?.songs,

    response?.data?.results,

    response?.songs,

    response?.results,

    Array.isArray(response?.data)
      ? response.data
      : null,

    Array.isArray(response)
      ? response
      : null,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(Boolean);
    }
  }

  return [];
};

/* =========================================================
   SUGGESTIONS PARSER
========================================================= */

const extractSuggestions = (response) => {
  if (!response) {
    return [];
  }

  const candidates = [
    Array.isArray(response)
      ? response
      : null,

    response?.data?.results,

    response?.data?.songs,

    response?.results,

    response?.songs,

    Array.isArray(response?.data)
      ? response.data
      : null,

    response?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(Boolean);
    }
  }

  return [];
};

/* =========================================================
   ARTIST PARSER
========================================================= */

const extractArtists = (album) => {
  if (!album) {
    return [];
  }

  if (
    Array.isArray(album?.artists?.primary)
  ) {
    return album.artists.primary;
  }

  if (
    Array.isArray(album?.artists)
  ) {
    return album.artists;
  }

  if (
    Array.isArray(album?.artist)
  ) {
    return album.artist;
  }

  if (
    album?.artist &&
    typeof album.artist === "object"
  ) {
    return [album.artist];
  }

  return [];
};

/* =========================================================
   COMPONENT
========================================================= */

const AlbumDetail = () => {
  const { id } = useParams();

  const [details, setDetails] = useState(null);

  const [suggestions, setSuggestions] =
    useState([]);

  const [list, setList] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [likedAlbums, setLikedAlbums] =
    useState(() => {
      try {
        const saved =
          localStorage.getItem(
            "likedAlbums"
          );

        if (!saved) {
          return [];
        }

        const parsed =
          JSON.parse(saved);

        return Array.isArray(parsed)
          ? parsed
          : [];
      } catch {
        return [];
      }
    });

  const scrollRef = useRef(null);

  /* =======================================================
     LOAD ALBUM
  ======================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadAlbum = async () => {
      if (!id) {
        setLoading(false);
        setError("Album ID is missing.");
        return;
      }

      setLoading(true);
      setError("");
      setDetails(null);
      setList([]);
      setSuggestions([]);

      try {
        console.log(
          "[AlbumDetail] Loading album:",
          id
        );

        const response =
          await fetchAlbumByID(id);

        if (cancelled) {
          return;
        }

        console.log(
          "[AlbumDetail] API response:",
          response
        );

        const album =
          extractAlbum(
            response,
            id
          );

        const albumSongs =
          extractAlbumSongs(
            response,
            album
          );

        if (
          !album &&
          albumSongs.length === 0
        ) {
          throw new Error(
            "Album data was not returned by the API."
          );
        }

        const normalizedAlbum = {
          ...(album || {}),

          id: getAlbumId(
            album,
            id
          ),

          name:
            album?.name ||
            album?.title ||
            "Unknown Album",

          title:
            album?.title ||
            album?.name ||
            "Unknown Album",

          image:
            album?.image ||
            album?.images ||
            [],

          images:
            album?.images ||
            album?.image ||
            [],

          songs: albumSongs,

          artists:
            album?.artists ||
            album?.artist ||
            {
              primary: [],
            },

          songCount:
            album?.songCount ||
            album?.song_count ||
            albumSongs.length,
        };

        setDetails(
          normalizedAlbum
        );

        setList(albumSongs);

        /* =================================================
           LOAD SUGGESTIONS
        ================================================= */

        const firstSong =
          albumSongs[0];

        const firstSongId =
          getSongId(firstSong);

        if (firstSongId) {
          try {
            const suggestionResponse =
              await getSuggestionSong(
                firstSongId
              );

            if (cancelled) {
              return;
            }

            const rawSuggestions =
              extractSuggestions(
                suggestionResponse
              );

            const albumSongIds =
              new Set(
                albumSongs
                  .map(getSongId)
                  .filter(Boolean)
                  .map(String)
              );

            const seen =
              new Set();

            const cleanedSuggestions =
              rawSuggestions.filter(
                (song) => {
                  const songId =
                    getSongId(song);

                  if (!songId) {
                    return true;
                  }

                  const stringId =
                    String(songId);

                  if (
                    albumSongIds.has(
                      stringId
                    )
                  ) {
                    return false;
                  }

                  if (
                    seen.has(
                      stringId
                    )
                  ) {
                    return false;
                  }

                  seen.add(
                    stringId
                  );

                  return true;
                }
              );

            setSuggestions(
              cleanedSuggestions
            );
          } catch (
            suggestionError
          ) {
            console.warn(
              "[AlbumDetail] Suggestions error:",
              suggestionError
            );

            if (!cancelled) {
              setSuggestions([]);
            }
          }
        }
      } catch (err) {
        console.error(
          "[AlbumDetail] Error:",
          err
        );

        if (!cancelled) {
          setError(
            err?.message ||
              "Error fetching album details."
          );

          setDetails(null);
          setList([]);
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAlbum();

    return () => {
      cancelled = true;
    };
  }, [id]);

  /* =======================================================
     ALBUM DATA
  ======================================================= */

  const albumId = useMemo(() => {
    return getAlbumId(
      details,
      id
    );
  }, [details, id]);

  const albumName = useMemo(() => {
    return (
      details?.name ||
      details?.title ||
      "Unknown Album"
    );
  }, [details]);

  const albumImage = useMemo(() => {
    return (
      getImageUrl(
        details?.image
      ) ||
      getImageUrl(
        details?.images
      ) ||
      FALLBACK_IMAGE
    );
  }, [details]);

  /* =======================================================
     ARTISTS
  ======================================================= */

  const primaryArtists =
    useMemo(() => {
      return extractArtists(
        details
      );
    }, [details]);

  const artist =
    primaryArtists[0] || null;

  const artistId =
    artist?.id ||
    artist?.artistId ||
    artist?.artist_id ||
    null;

  const artistName =
    artist?.name ||
    artist?.title ||
    "Unknown Artist";

  /* =======================================================
     LIKE STATUS
  ======================================================= */

  const isLiked = useMemo(() => {
    if (!albumId) {
      return false;
    }

    return likedAlbums.some(
      (album) => {
        const savedId =
          album?.id ||
          album?.albumId ||
          album?.album_id ||
          "";

        return (
          String(savedId) ===
          String(albumId)
        );
      }
    );
  }, [
    likedAlbums,
    albumId,
  ]);

  /* =======================================================
     TOGGLE FAVOURITE
  ======================================================= */

  const toggleLikeAlbum =
    useCallback(() => {
      if (
        !details ||
        !albumId
      ) {
        return;
      }

      try {
        const saved =
          localStorage.getItem(
            "likedAlbums"
          );

        let albums = [];

        try {
          const parsed =
            saved
              ? JSON.parse(saved)
              : [];

          albums =
            Array.isArray(parsed)
              ? parsed
              : [];
        } catch {
          albums = [];
        }

        const exists =
          albums.some(
            (album) => {
              const savedId =
                album?.id ||
                album?.albumId ||
                album?.album_id ||
                "";

              return (
                String(savedId) ===
                String(albumId)
              );
            }
          );

        if (exists) {
          albums =
            albums.filter(
              (album) => {
                const savedId =
                  album?.id ||
                  album?.albumId ||
                  album?.album_id ||
                  "";

                return (
                  String(savedId) !==
                  String(albumId)
                );
              }
            );
        } else {
          albums.push({
            id: albumId,

            name: albumName,

            title: albumName,

            image: albumImage,

            artists:
              details?.artists ||
              primaryArtists,
          });
        }

        localStorage.setItem(
          "likedAlbums",
          JSON.stringify(
            albums
          )
        );

        setLikedAlbums(
          albums
        );

        window.dispatchEvent(
          new Event(
            "favouritesUpdated"
          )
        );
      } catch (err) {
        console.error(
          "Like album error:",
          err
        );
      }
    }, [
      details,
      albumId,
      albumName,
      albumImage,
      primaryArtists,
    ]);

  /* =======================================================
     SHARE ALBUM
  ======================================================= */

  const shareAlbum =
    useCallback(async () => {
      const shareUrl =
        `${window.location.origin}/albums/${encodeURIComponent(
          safeString(
            albumId || id
          )
        )}`;

      const shareData = {
        title: albumName,
        text:
          `Listen to ${albumName}`,
        url: shareUrl,
      };

      try {
        if (
          typeof navigator !==
            "undefined" &&
          typeof navigator.share ===
            "function"
        ) {
          await navigator.share(
            shareData
          );

          return;
        }

        if (
          navigator.clipboard &&
          typeof navigator
            .clipboard
            .writeText ===
            "function"
        ) {
          await navigator.clipboard.writeText(
            shareUrl
          );

          alert(
            "Album link copied!"
          );

          return;
        }

        window.prompt(
          "Copy album link:",
          shareUrl
        );
      } catch (err) {
        if (
          err?.name !==
          "AbortError"
        ) {
          console.error(
            "Share error:",
            err
          );
        }
      }
    }, [
      albumId,
      id,
      albumName,
    ]);

  /* =======================================================
     SUGGESTION SCROLL
  ======================================================= */

  const scrollSuggestionsLeft =
    useCallback(() => {
      if (
        !scrollRef.current
      ) {
        return;
      }

      scrollRef.current.scrollBy({
        left: -700,
        behavior: "smooth",
      });
    }, []);

  const scrollSuggestionsRight =
    useCallback(() => {
      if (
        !scrollRef.current
      ) {
        return;
      }

      scrollRef.current.scrollBy({
        left: 700,
        behavior: "smooth",
      });
    }, []);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[var(--background)] text-[var(--text-primary)]">
        <Navbar />

        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4">
            <img
              src="/Loading.gif"
              alt="Loading"
              className="h-16 w-16 object-contain"
              onError={(event) => {
                event.currentTarget.style.display =
                  "none";
              }}
            />

            <p className="text-sm opacity-70">
              Loading album...
            </p>
          </div>
        </main>

        <Navigator />
      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (
    error ||
    !details
  ) {
    return (
      <div className="min-h-screen w-full bg-[var(--background)] text-[var(--text-primary)]">
        <Navbar />

        <main className="flex min-h-[70vh] items-center justify-center px-4 pb-24 pt-28">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 text-center shadow-xl">
            <h1 className="mb-3 text-2xl font-bold">
              Album not found
            </h1>

            <p className="mb-6 text-sm opacity-70">
              {error ||
                "This album could not be loaded."}
            </p>

            <p className="mb-6 break-all text-xs opacity-50">
              Album ID:{" "}
              {id ||
                "Unknown"}
            </p>

            <Link
              to="/"
              className="inline-flex rounded-full border border-[var(--card-border)] px-6 py-3 text-sm font-medium transition hover:opacity-80"
            >
              Go Home
            </Link>
          </div>
        </main>

        <Navigator />
      </div>
    );
  }

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[var(--background)] text-[var(--text-primary)]">
      <Navbar />

      <main className="w-full px-3 pb-28 pt-[9rem] sm:px-5 lg:px-8 lg:pt-[7rem]">
        {/* =================================================
            ALBUM HEADER
        ================================================= */}

        <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 sm:flex-row sm:items-center">
          <img
            src={albumImage}
            alt={albumName}
            className="h-40 w-40 shrink-0 rounded-2xl object-cover shadow-2xl sm:h-48 sm:w-48 lg:h-56 lg:w-56"
            onError={(event) => {
              event.currentTarget.onerror =
                null;

              event.currentTarget.src =
                FALLBACK_IMAGE;
            }}
          />

          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider opacity-50">
              Album
            </p>

            <h1 className="break-words text-2xl font-bold sm:text-3xl lg:text-4xl">
              {albumName}
            </h1>

            <p className="mt-2 text-sm font-medium opacity-70 sm:text-base">
              {details?.songCount ||
                list.length ||
                0}{" "}
              Songs
              {" by "}

              {artistId ? (
                <Link
                  to={`/artists/${encodeURIComponent(
                    safeString(
                      artistId
                    )
                  )}`}
                  className="font-semibold hover:underline"
                >
                  {artistName}
                </Link>
              ) : (
                <span className="font-semibold">
                  {artistName}
                </span>
              )}
            </p>

            {/* =================================================
                ACTIONS
            ================================================= */}

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={
                  toggleLikeAlbum
                }
                title={
                  isLiked
                    ? "Remove from favourites"
                    : "Add to favourites"
                }
                aria-label={
                  isLiked
                    ? "Remove album from favourites"
                    : "Add album to favourites"
                }
                className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--secondary-bg)] transition hover:scale-105"
              >
                {isLiked ? (
                  <FaHeart className="text-xl text-red-500" />
                ) : (
                  <FaRegHeart className="text-xl" />
                )}
              </button>

              <button
                type="button"
                onClick={
                  shareAlbum
                }
                title="Share Album"
                aria-label="Share Album"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--secondary-bg)] transition hover:scale-105"
              >
                <IoShareSocial className="text-xl" />
              </button>
            </div>
          </div>
        </section>

        {/* =================================================
            SONGS
        ================================================= */}

        <section className="mx-auto mt-8 w-full max-w-7xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold sm:text-2xl">
              Songs
            </h2>

            <span className="text-sm opacity-60">
              {list.length}{" "}
              tracks
            </span>
          </div>

          {list.length > 0 ? (
            <div className="w-full overflow-hidden">
              {list.map(
                (
                  song,
                  index
                ) => (
                  <SongsList
                    key={
                      getSongId(
                        song
                      ) ||
                      `album-song-${index}`
                    }
                    {...song}
                    song={song}
                    songs={list}
                  />
                )
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 text-center">
              <p className="text-sm opacity-60">
                No songs found in
                this album.
              </p>
            </div>
          )}
        </section>

        {/* =================================================
            SUGGESTIONS
        ================================================= */}

        {suggestions.length >
          0 && (
          <section className="mx-auto mt-10 w-full max-w-7xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold sm:text-2xl">
                You Might Like
              </h2>

              <div className="hidden items-center gap-2 lg:flex">
                <button
                  type="button"
                  onClick={
                    scrollSuggestionsLeft
                  }
                  aria-label="Previous songs"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--secondary-bg)] transition hover:scale-105"
                >
                  <MdOutlineKeyboardArrowLeft className="text-2xl" />
                </button>

                <button
                  type="button"
                  onClick={
                    scrollSuggestionsRight
                  }
                  aria-label="Next songs"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--secondary-bg)] transition hover:scale-105"
                >
                  <MdOutlineKeyboardArrowRight className="text-2xl" />
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="grid auto-cols-max grid-flow-col grid-rows-1 gap-3 overflow-x-auto scroll-smooth px-1 pb-3"
              style={{
                scrollbarWidth:
                  "none",
              }}
            >
              {suggestions.map(
                (
                  song,
                  index
                ) => (
                  <SongGrid
                    key={
                      getSongId(
                        song
                      ) ||
                      `suggestion-${index}`
                    }
                    {...song}
                    song={song}
                    songs={list}
                  />
                )
              )}
            </div>
          </section>
        )}
      </main>

      <Footer />

      <Navigator />
    </div>
  );
};

export default AlbumDetail;
