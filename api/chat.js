export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const { system, messages } = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system,
        messages,
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'Error del servidor: ' + response.status, detail: err }), { headers: CORS });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Sin respuesta.';

    return new Response(JSON.stringify({ reply }), { headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
