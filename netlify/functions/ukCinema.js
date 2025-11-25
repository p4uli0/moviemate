// netlify/functions/ukCinema.js

export async function handler(event) {
  const API_KEY = process.env.UK_CINEMA_API_KEY;
  const API_BASE = "https://developer.uk-cinema-api.co.uk";

  // read postcode from query string, default HU1 for testing
  const params = event.queryStringParameters || {};
  const postcode = params.postcode || "HU1";

  const url = `${API_BASE}/cinemas?postcode=${encodeURIComponent(postcode)}`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-API-Key": API_KEY,
        Accept: "application/json",
      },
    });

    const text = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (err) {
    console.error("Netlify ukCinema error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Server error calling UK Cinema API",
        details: err.message,
      }),
    };
  }
}
