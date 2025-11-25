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

  let url;

  if (lat && lng) {
    // Location-aware query (mobile, when we have geolocation)
    url = `https://uk-cinema-api.co.uk/api/v2/showtimes?latitude=${lat}&longitude=${lng}&radius=25&items=200`;
  } else {
    // Fallback if no location: big UK-wide chunk so desktop still gets something
    url = "https://uk-cinema-api.co.uk/api/v2/showtimes?items=500";
  }

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
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: `Upstream error: ${response.status}`,
          payload: text,
        }),
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
