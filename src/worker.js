export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/transcribe") {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, 405);
      }
      if (!env.GEMINI_API_KEY) {
        return json({ error: "GEMINI_API_KEY saknas i miljövariablerna" }, 500);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Ogiltig JSON i förfrågan" }, 400);
      }

      const { audio, mimeType } = body || {};
      if (!audio) return json({ error: "Ingen ljuddata skickades" }, 400);

      const model = "gemini-3.6-flash";
      const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

      const prompt =
        "Transkribera det som sägs i den här ljudinspelningen. Svara med enbart den transkriberade texten på svenska, utan inledning, kommentarer eller formatering.";

      let res;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: mimeType || "audio/wav", data: audio } }
                ]
              }
            ]
          })
        });
      } catch (e) {
        return json({ error: "Kunde inte nå Gemini: " + e.message }, 502);
      }

      const raw = await res.text();
      if (!res.ok) {
        return json({ error: "Gemini svarade med fel " + res.status, detail: raw.slice(0, 500) }, 502);
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return json({ error: "Kunde inte tolka svaret från Gemini" }, 502);
      }

      const text = data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim();

      if (!text) return json({ error: "Gemini returnerade ingen text" }, 502);

      return json({ text });
    }

    return env.ASSETS.fetch(request);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
