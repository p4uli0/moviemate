// netlify/functions/ukCinema.js

export async function handler(event) {
  const API_KEY = process.env.UK_CINEMA_API_KEY;
  const API_BASE = "https://uk-cinema-api.co.uk";

  // we’re not using postcode yet – just hitting the example URL from the docs
  const url = `${API_BASE}/api/v2/showtimes?page=1&items=20`;

  console.log("Calling UK Cinema URL:", url);

  try {
    const response = await fetch(url, {
      headers: {
        // keep this if your API key is required, otherwise remove this line:
        "X-API-Key": API_KEY,
        Accept: "application/json",
      },
    });

    const text = await response.text();
    console.log("UK Cinema status:", response.status);

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
