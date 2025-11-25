export async function handler(event) {
  // ✅ use the SAME name as Netlify
  const API_KEY = process.env.VITE_UK_CINEMA_API_TOKEN;
  const url = "https://uk-cinema-api.co.uk/api/v2/showtimes?page=1&items=20";

  console.log("ENV KEY EXISTS?", !!API_KEY);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        // Swagger says: Name = Authorization, bearerAuth
        Authorization: `Bearer ${API_KEY}`,
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
