export async function handler(event) {
  const API_KEY = process.env.VITE_UK_CINEMA_API_TOKEN;

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };

  let page = 1;
  let all = [];
  let keepGoing = true;

  while (keepGoing) {
    const url = `https://uk-cinema-api.co.uk/api/v2/showtimes?page=${page}&items=500`;
    const response = await fetch(url, { headers });

    const json = await response.json();

    if (Array.isArray(json) && json.length > 0) {
      all = all.concat(json);
      page++;
    } else {
      keepGoing = false;
    }
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(all),
  };
}
