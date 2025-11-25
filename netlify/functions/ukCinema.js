// netlify/functions/ukCinema.js

export async function handler(event) {
  const API_KEY = process.env.UK_CINEMA_API_KEY;
  const url = "https://uk-cinema-api.co.uk/api/v2/showtimes?page=1&items=20";

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${API_KEY}`, // IMPORTANT
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
