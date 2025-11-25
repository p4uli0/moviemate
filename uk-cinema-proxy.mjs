// uk-cinema-proxy.mjs
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 5174;

const API_TOKEN = process.env.VITE_UK_CINEMA_API_TOKEN;
if (!API_TOKEN) {
  console.error("❌ Missing VITE_UK_CINEMA_API_TOKEN in .env.local");
  process.exit(1);
}

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  next();
});

// full-path proxy
app.use("/uk-cinema", async (req, res) => {
  const fullPath = req.originalUrl.replace("/uk-cinema/", "");
  const forwardURL = `https://uk-cinema-api.co.uk/api/v2/${fullPath}`;

  console.log("🔁 Proxy →", forwardURL);

  try {
    const upstream = await fetch(forwardURL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
    });

    const text = await upstream.text();

    try {
      res.status(upstream.status).json(JSON.parse(text));
    } catch {
      res.status(upstream.status).send(text);
    }
  } catch (err) {
    console.error("❌ Proxy Exception:", err);
    res.status(500).json({ error: "Proxy failed" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 UK Cinema proxy running on http://localhost:${PORT}`);
});