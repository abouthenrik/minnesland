// Cloudflare Pages Function: POST /api/transcribe
// Body: { audio: base64WavData, mimeType: 'audio/wav' }
// Kräver miljövariabeln GEMINI_API_KEY (sätts som secret i Cloudflare Pages).
// GEMINI_MODEL kan sättas för att byta modell, annars används gemini-3.6-flash.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ogiltig begäran.' }, 400);
  }

  const { audio, mimeType } = body || {};
  if (!audio) {
    return json({ error: 'Inget ljud skickades.' }, 400);
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: 'GEMINI_API_KEY saknas i Cloudflare Pages miljövariabler.' }, 500);
  }

  const model = env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text:
              'Transkribera det som sägs i den här ljudinspelningen ordagrant, på svenska, ' +
              'med normal skiljetecken och styckeindelning. Skriv bara ut den transkriberade ' +
              'texten — inga rubriker, kommentarer eller sammanfattningar.',
          },
          {
            inlineData: {
              mimeType: mimeType || 'audio/wav',
              data: audio,
            },
          },
        ],
      },
    ],
  };

  let geminiRes;
  try {
    geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return json({ error: 'Kunde inte nå Gemini: ' + String(err) }, 502);
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return json({ error: `Gemini-fel (${geminiRes.status}): ${errText}` }, 502);
  }

  const data = await geminiRes.json();
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

  return json({ text });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
