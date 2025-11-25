export async function handler(event) {
  const API_KEY = process.env.VITE_UK_CINEMA_API_TOKEN;

  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing API key" }),
    };
  }

  // Read lat/lng from the frontend request
  const params = event.queryStringParameters || {};
  const lat = params.lat;
  const lng = params.lng;

  if (!lat || !lng) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing lat/lng parameters" }),
    };
  }

  // Build URL for nearby showtimes only
  const url = `https://uk-cinema-api.co.uk/api/v2/showtimes?latitude=${lat}&longitude=${lng}&radius=25&items=200`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: `Upstream error: ${response.status}`,
          payload: text,
        }),
      };
    }

    const json = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(json),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
