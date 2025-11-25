// netlify/functions/ukCinema.js

export async function handler(event) {
  const API_KEY = process.env.VITE_UK_CINEMA_API_TOKEN;

  if (!API_KEY) {
    console.error("Missing VITE_UK_CINEMA_API_TOKEN");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing API key" }),
    };
  }

  const params = event.queryStringParameters || {};
  const lat = params.lat;
  const lng = params.lng;

  if (!lat || !lng) {
    console.error("Missing lat/lng parameters");
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing lat/lng parameters" }),
    };
  }

  // Location-aware showtimes – radius + item count you can tweak later
  const url = `https://uk-cinema-api.co.uk/api/v2/showtimes?latitude=${lat}&longitude=${lng}&radius=25&items=200`;

  console.log("Calling UK Cinema API:", url);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    const text = await response.text();
    console.log("Upstream status:", response.status);
    console.log("Sample payload:", text.slice(0, 200));

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: text,
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (err) {
    console.error("Netlify ukCinema function error:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: err.message }),
    };
  }
}
