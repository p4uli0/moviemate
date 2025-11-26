// src/api/ukCinema.js

// Map chain codes to friendly labels
const CHAIN_LABELS = {
  odeon_gb: "ODEON",
  reel: "REEL Cinemas",
  cineworld_uk: "Cineworld",
  vue_uk: "Vue",
  showcase_cinemas_uk: "Showcase Cinemas",
};

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

  // 🔍 Log ONE sample raw item so we can see the real shape
  const sampleRaw =
    rawArray.find((x) => x && Object.keys(x).length > 0) || null;

  if (sampleRaw) {
    console.log(
      "UKC SAMPLE RAW ITEM:",
      JSON.stringify(sampleRaw, null, 2)
    );
  } else {
    console.log("UKC SAMPLE RAW ITEM: <none>");
  }

  const normalised = rawArray.map((item, index) => {
    const show = item.showtime || item;

    // -------- FILM --------
    const filmRaw =
      item.film ??
      show.film ??
      show.film_title ??
      show.filmTitle ??
      show.title ??
      null;

    let filmTitle;
    let filmId = null;
    let tmdbId = null;

    if (filmRaw && typeof filmRaw === "object") {
      filmTitle =
        filmRaw.title ||
        filmRaw.original_title ||
        filmRaw.name ||
        show.film_title ||
        show.filmName ||
        show.title ||
        "Unknown film";

      filmId = filmRaw.id ?? show.film_id ?? null;
      tmdbId =
        filmRaw.tmdb_id ??
        filmRaw.tmdbId ??
        show.tmdb_id ??
        show.tmdbId ??
        null;
    } else {
      // filmRaw is string or null
      filmTitle =
        (typeof filmRaw === "string" && filmRaw) ||
        show.film_title ||
        show.filmName ||
        show.title ||
        "Unknown film";

      filmId = show.film_id ?? null;
      tmdbId = show.tmdb_id ?? show.tmdbId ?? null;
    }

    // -------- CINEMA --------
    const cinemaObj = item.cinema || show.cinema || {};
    let cinemaName =
      cinemaObj.name ||
      show.cinema_name ||
      show.cinemaName ||
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
      show.ticketPrice;

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
      cinemaObj.link ||
      "#";

    const normalisedItem = {
      id: show.id ?? item.id ?? index,
      film: filmTitle,
      filmId,
      tmdbId,
      cinema: cinemaName,
      date,
      time,
      priceValue,
      price,
      lat: latShow,
      lng: lngShow,
      bookingUrl,
    };

    // 🔍 Log ONE sample normalised item too (index 0 only)
    if (index === 0) {
      console.log(
        "UKC SAMPLE NORMALISED ITEM:",
        JSON.stringify(normalisedItem, null, 2)
      );
    }

    return normalisedItem;
  });

  return normalised;
}
