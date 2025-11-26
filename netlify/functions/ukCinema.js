// netlify/functions/ukCinema.js

const BASE = "https://uk-cinema-api.co.uk/api/v2";

export async function handler() {
  const API_KEY = process.env.VITE_UK_CINEMA_API_TOKEN;

  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing API key" }),
    };
  }

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };

  try {
    // Fetch all data in parallel
    const [showRes, filmRes, cinemaRes] = await Promise.all([
      fetch(`${BASE}/showtimes?items=500`, { headers }),
      fetch(`${BASE}/films?items=500`, { headers }),
      fetch(`${BASE}/cinemas?items=500`, { headers }),
    ]);

    const [rawShowtimes, rawFilms, rawCinemas] = await Promise.all([
      showRes.json(),
      filmRes.json(),
      cinemaRes.json(),
    ]);

    const showArr = Array.isArray(rawShowtimes)
      ? rawShowtimes
      : rawShowtimes.data || [];

    const filmArr = Array.isArray(rawFilms)
      ? rawFilms
      : rawFilms.data || [];

    const cinemaArr = Array.isArray(rawCinemas)
      ? rawCinemas
      : rawCinemas.data || [];

    // Build lookup maps
    const filmMap = Object.fromEntries(filmArr.map(f => [f.id, f]));
    const cinemaMap = Object.fromEntries(cinemaArr.map(c => [c.id, c]));

    // Join the data
    const enriched = showArr.map(st => {
      const film = filmMap[st.film_id] || null;
      const cinema = cinemaMap[st.cinema_id] || null;

      return {
        ...st,
        film,
        cinema,
      };
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(enriched),
    };
  } catch (err) {
    console.error("Netlify ukCinema join error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
