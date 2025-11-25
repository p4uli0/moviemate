// src/api/ukCinema.js

// Call the Netlify function that proxies UK Cinema API
export async function getTestShowtimes() {
  const res = await fetch("/.netlify/functions/ukCinema");

  if (!res.ok) {
    const text = await res.text();
    console.error("UK Cinema proxy error:", res.status, text);
    throw new Error(`UK Cinema API failed: ${res.status}`);
  }

  return res.json();
}
