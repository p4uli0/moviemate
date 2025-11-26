// src/api/ukCinema.js

export async function getShowtimesFromApi() {
  const res = await fetch("/.netlify/functions/ukCinema");

  if (!res.ok) {
    const text = await res.text();
    console.error("UK Cinema proxy error:", res.status, text);
    throw new Error(`UK Cinema API failed: ${res.status}`);
  }

  const raw = await res.json();
  console.log("UK CINEMA (joined) RAW:", raw);

  const arr = Array.isArray(raw) ? raw : [];

  const normalised = arr.map((row, idx) => {
    const film = row.film || {};
    const cinema = row.cinema || {};

    const dt = new Date(row.showing_at);
    const safeDate = isNaN(dt.getTime()) ? new Date() : dt;

    let priceValue = 9.99;
    if (typeof row.price === "number") priceValue = row.price;
    if (typeof row.price_pence === "number") priceValue = row.price_pence / 100;

    return {
      id: row.id ?? idx,
      // Film
      filmId: film.id || row.film_id,
      filmTitle: film.title || film.original_title || "Unknown film",
      tmdbId: film.tmdb_id || null,

      // Cinema
      cinemaId: cinema.id || row.cinema_id,
      cinemaName: cinema.name || "Unknown cinema",
      chain: cinema.chain || row.chain || null,
      lat: row.latitude || cinema.latitude || null,
      lng: row.longitude || cinema.longitude || null,

      // Showtimes
      date: safeDate,
      time: safeDate.toTimeString().slice(0, 5),

      // Prices
      priceValue,
      price: `£${priceValue.toFixed(2)}`,

      // Booking
      bookingUrl: row.booking_link || cinema.link || "#",
    };
  });

  console.log("Normalised UK Cinema showtimes:", normalised);
  return normalised;
}
