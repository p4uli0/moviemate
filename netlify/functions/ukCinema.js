export async function handler(event) {
  const url = "https://uk-cinema-api.co.uk/api/v2/showtimes?page=1&items=20";

  try {
    const response = await fetch(url, {
      headers: {
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
