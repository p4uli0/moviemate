// src/api/ukCinema.js

// Call the Netlify function and normalise the data
export async function getShowtimesFromApi() {
  // 1) Call your Netlify function
  const res = await fetch("/.netlify/functions/ukCinema");

  if (!res.ok) {
    const text = await res.text();
    console.error("UK Cinema proxy error:", res.status, text);
    throw new Error(`UK Cinema API failed: ${res.status}`);
  }

  const raw = await res.json();
  console.log("Raw UK Cinema API data:", raw);

  // Safety: make sure it's an array
  const rawArray = Array.isArray(raw) ? raw : [];

  // 2) Turn raw API objects into the shape your app expects:
  // { id, film, cinema, date, time, priceValue, price, lat, lng, bookingUrl }
  const normalised = rawArray.map((item, index) => {
    // Some APIs send nested structures like { showtime, film, cinema }
    const show = item.showtime || item;
    const film = item.film || {};
    const cinema = item.cinema || {};

    // ---- Film / cinema names ----
    const filmTitle =
      film.title ||
      show.film_title ||
      show.filmName ||
      "Unknown film";

    const cinemaName =
      cinema.name ||
      show.cinema_name ||
      show.cinemaName ||
      "Unknown cinema";

    // ---- Date + time ----
    // UK Cinema usually has a single datetime like "showing_at"
    const rawDate =
      show.showing_at ||
      show.showingAt ||
      show.date ||
      show.start_time;

    const dt = rawDate ? new Date(rawDate) : new Date();
    const safeDt = isNaN(dt.getTime()) ? new Date() : dt;

    // Your app uses:
    // - "date" as a Date object
    // - "time" as a "HH:MM" string
    const date = safeDt;
    const time = safeDt.toTimeString().slice(0, 5); // e.g. "11:10"

    // ---- Price ----
    // UK Cinema API doesn’t give price yet, so we fake one for now
    const basePrice =
      typeof show.price === "number"
        ? show.price
        : typeof show.priceValue === "number"
        ? show.priceValue
        : 9.99;

    const priceValue = Number(basePrice.toFixed(2));

    // ---- Location ----
    const lat = show.latitude ?? cinema.latitude ?? null;
    const lng = show.longitude ?? cinema.longitude ?? null;

    // ---- Booking link ----
    const bookingUrl =
      show.booking_link ||
      cinema.link ||
      show.bookingUrl ||
      "#";

    return {
      id: show.id ?? index,
      film: filmTitle,
      cinema: cinemaName,
      date,
      time,
      priceValue,
      price: `£${priceValue.toFixed(2)}`,
      lat,
      lng,
      bookingUrl,
    };
  });

  console.log("Normalised UK Cinema showtimes:", normalised);
  return normalised;
}
