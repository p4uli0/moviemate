// src/api/ukCinema.js

// Map chain codes to friendly labels
const CHAIN_LABELS = {
  odeon_gb: "ODEON",
  reel: "REEL Cinemas",
  cineworld_uk: "Cineworld",
  vue_uk: "Vue",
  showcase_cinemas_uk: "Showcase Cinemas",
};

// Generic helper: find first string field whose key matches any pattern
function findStringField(obj, patterns) {
  if (!obj || typeof obj !== "object") return null;
  const keys = Object.keys(obj);
  for (const key of keys) {
    const val = obj[key];
    if (typeof val !== "string") continue;
    if (!patterns || patterns.length === 0) return val;
    for (const p of patterns) {
      if (p.test(key)) {
        return val;
      }
    }
  }
  return null;
}

// Generic helper: find first numeric field
function findNumberField(obj, patterns) {
  if (!obj || typeof obj !== "object") return null;
  const keys = Object.keys(obj);
  for (const key of keys) {
    const val = obj[key];
    if (typeof val !== "number") continue;
    if (!patterns || patterns.length === 0) return val;
    for (const p of patterns) {
      if (p.test(key)) {
        return val;
      }
    }
  }
  return null;
}

export async function getShowtimesFromApi() {
  // Netlify function (server-side call to UK Cinema API)
  const res = await fetch("/.netlify/functions/ukCinema");

  if (!res.ok) {
    const text = await res.text();
    console.error("UK Cinema proxy error:", res.status, text);
    throw new Error(`UK Cinema API failed: ${res.status}`);
  }

  let raw;
  try {
    raw = await res.json();
  } catch (e) {
    console.error(
      "Failed to parse JSON from Netlify ukCinema function:",
      e
    );
    throw new Error("Invalid JSON from ukCinema function");
  }

  const rawArray = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
    ? raw.data
    : [];

  console.log("UK Cinema: received rows:", rawArray.length);

  const normalised = rawArray.map((item, index) => {
    const show = item.showtime || item;

    // -------- FILM (use heuristics) --------
    let filmTitle = null;
    let filmId = null;
    let tmdbId = null;

    // If there's a nested film object, inspect it
    const filmObj =
      (item.film && typeof item.film === "object" && item.film) ||
      (show.film && typeof show.film === "object" && show.film) ||
      null;

    if (filmObj) {
      filmTitle =
        filmObj.title ||
        filmObj.original_title ||
        filmObj.name ||
        findStringField(filmObj, [/title/i, /name/i, /film/i]) ||
        null;

      filmId = filmObj.id ?? null;
      tmdbId =
        filmObj.tmdb_id ??
        filmObj.tmdbId ??
        null;
    }

    // If no title yet, try string film fields on show/item
    if (!filmTitle) {
      const filmString =
        (typeof show.film === "string" && show.film) ||
        (typeof item.film === "string" && item.film) ||
        show.film_title ||
        show.filmTitle ||
        show.title ||
        item.title ||
        null;

      if (filmString) {
        filmTitle = filmString;
      }
    }

    // Last resort: scan show object for any reasonable string key
    if (!filmTitle) {
      filmTitle =
        findStringField(show, [/film/i, /title/i, /name/i]) ||
        findStringField(item, [/film/i, /title/i, /name/i]) ||
        "Unknown film";
    }

    // If we still don't have IDs, try generic numeric fields
    if (filmId == null) {
      filmId =
        show.film_id ??
        findNumberField(show, [/film.*id/i]) ??
        null;
    }

    if (tmdbId == null) {
      tmdbId =
        show.tmdb_id ??
        show.tmdbId ??
        findNumberField(show, [/tmdb/i]) ??
        null;
    }

    // -------- CINEMA --------
    const cinemaObj = item.cinema || show.cinema || {};
    let cinemaName =
      cinemaObj.name ||
      findStringField(cinemaObj, [/name/i, /cinema/i, /venue/i]) ||
      show.cinema_name ||
      show.cinemaName ||
      findStringField(show, [/cinema/i, /venue/i]) ||
      CHAIN_LABELS[show.chain] ||
      show.chain ||
      null;

    if (!cinemaName) {
      if (show.cinema_id) {
        cinemaName = `Cinema #${show.cinema_id}`;
      } else {
        cinemaName = "Unknown cinema";
      }
    }

    // -------- DATE & TIME --------
    const rawDate =
      show.showing_at ||
      show.showingAt ||
      show.startsAt ||
      show.start_time ||
      show.startTime ||
      show.datetime ||
      show.date ||
      null;

    const dt = rawDate ? new Date(rawDate) : new Date();
    const safeDt = isNaN(dt.getTime()) ? new Date() : dt;

    const date = safeDt;
    const time = safeDt.toTimeString().slice(0, 5); // "HH:MM"

    // -------- PRICE --------
    const priceRaw =
      show.price ??
      show.min_price ??
      show.minPrice ??
      show.fromPrice ??
      show.priceText ??
      show.ticketPrice ??
      findNumberField(show, [/price/i, /cost/i, /amount/i]);

    let priceValue = null;
    if (typeof priceRaw === "number") {
      priceValue = priceRaw;
    } else if (typeof priceRaw === "string") {
      const m = priceRaw.match(/([\d,.]+)/);
      if (m) {
        priceValue = parseFloat(m[1].replace(",", ""));
      }
    }

    if (priceValue == null || Number.isNaN(priceValue)) {
      priceValue = 9.99; // default
    }

    const price = `£${priceValue.toFixed(2)}`;

    // -------- LOCATION --------
    const latShow =
      typeof show.latitude === "number"
        ? show.latitude
        : typeof cinemaObj.latitude === "number"
        ? cinemaObj.latitude
        : null;

    const lngShow =
      typeof show.longitude === "number"
        ? show.longitude
        : typeof cinemaObj.longitude === "number"
        ? cinemaObj.longitude
        : null;

    // -------- BOOKING URL --------
    const bookingUrl =
      show.booking_link ||
      show.bookingUrl ||
      show.ticket_url ||
      show.ticketUrl ||
      findStringField(show, [/book/i, /ticket/i, /url/i, /link/i]) ||
      cinemaObj.link ||
      "#";

    return {
      id: show.id ?? item.id ?? index,
      film: filmTitle,
      filmId,
      tmdbId, // used later to decorate with TMDB
      cinema: cinemaName,
      date,
      time,
      priceValue,
      price,
      lat: latShow,
      lng: lngShow,
      bookingUrl,
    };
  });

  return normalised;
}
