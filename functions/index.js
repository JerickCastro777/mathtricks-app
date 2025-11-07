// functions/index.js
const functions = require("firebase-functions");
const cors = require("cors");

const corsHandler = cors({ origin: true });

// ⚠️ Puedes dejar esto así temporalmente si no usas secrets:
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "TU_API_KEY_AQUI";

exports.chat = functions
  .region("us-central1")
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      try {
        if (req.method === "OPTIONS") {
          res.set("Access-Control-Allow-Origin", "*");
          res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
          res.set("Access-Control-Allow-Headers", "Content-Type");
          return res.status(204).send("");
        }

        if (req.method !== "POST") {
          return res.status(405).send({ error: "Only POST allowed" });
        }

        if (!OPENAI_API_KEY) {
          throw new Error("OPENAI_API_KEY not set");
        }

        const { messages, model = "gpt-4o-mini", temperature = 0.4 } = req.body || {};
        if (!Array.isArray(messages) || messages.length === 0) {
          return res.status(400).send({ error: "Missing messages array" });
        }

        const fetch = (await import("node-fetch")).default;
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ model, temperature, messages })
        });

        const data = await r.json();
        res.set("Access-Control-Allow-Origin", "*");
        res.status(r.ok ? 200 : 500).send(data);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: err.message });
      }
    });
  });
