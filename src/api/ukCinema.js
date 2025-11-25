// src/api/ukCinema.js

// Call the Netlify function, NOT the UK Cinema API directly
export async function getCinemasByPostcode(postcode) {
  const qs = new URLSearchParams({ postcode }).toString();
  const res = await fetch(`/.netlify/functions/ukCinema?${qs}`);

  if (!res.ok) {
    const text = await res.text();
    console.error("UK Cinema proxy error:", res.status, text);
    throw new Error(`UK Cinema API failed: ${res.status}`);
  }

  return res.json();
}
