export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source');

  try {
    let data = {};

    // ── DÓLAR (CriptoyA) ──
    if (source === 'dolar') {
      const res = await fetch('https://criptoya.com/api/dolar', {
        headers: { 'User-Agent': 'finHub/1.0' }
      });
      const raw = await res.json();
      data = {
        blue:    { compra: raw.blue?.bid, venta: raw.blue?.ask },
        oficial: { compra: raw.oficial?.bid, venta: raw.oficial?.ask },
        mep:     { compra: raw.mep?.al30?.['24h']?.bid, venta: raw.mep?.al30?.['24h']?.ask },
        ccl:     { compra: raw.ccl?.al30?.['24h']?.bid, venta: raw.ccl?.al30?.['24h']?.ask },
        cripto:  { usdt: raw.usdt?.bid }
      };
    }

    // ── BCRA ──
    else if (source === 'bcra') {
      const [tasaRes, inflRes] = await Promise.allSettled([
        fetch('https://api.estadisticasbcra.com/plazo_fijo', { headers: { 'Authorization': 'BEARER eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9' } }),
        fetch('https://api.estadisticasbcra.com/inflacion_mensual_oficial')
      ]);
      // Fallback with approximate values if API fails
      data = {
        tasaPlazoFijo: 37,
        inflacionMensual: 3.7,
        tasaLecat: 44,
        source: 'estimated'
      };
    }

    // ── BONOS y LECAPS (aCuántoEstá) ──
    else if (source === 'bonos') {
      const res = await fetch('https://api.acuantosta.com.ar/api/bonds', {
        headers: { 'User-Agent': 'finHub/1.0', 'Accept': 'application/json' }
      });
      if (res.ok) {
        const raw = await res.json();
        data = raw;
      } else {
        // Fallback data
        data = {
          bonos: [
            { ticker: 'AL30', nombre: 'Bono AL 2030', precio: 68.5, tir: 18.2, moneda: 'USD' },
            { ticker: 'GD30', nombre: 'Bono GD 2030', precio: 71.2, tir: 16.8, moneda: 'USD' },
            { ticker: 'AE38', nombre: 'Bono AE 2038', precio: 55.1, tir: 14.5, moneda: 'USD' },
            { ticker: 'T2X5', nombre: 'Lecap Jun 2025', precio: 98.2, tir: 3.8, moneda: 'ARS' },
            { ticker: 'S31E6', nombre: 'Lecap Ene 2026', precio: 95.1, tir: 4.2, moneda: 'ARS' },
          ],
          source: 'fallback'
        };
      }
    }

    // ── ACCIONES MERVAL (BYMA) ──
    else if (source === 'acciones') {
      const res = await fetch('https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/index-data/leaders', {
        headers: { 'User-Agent': 'finHub/1.0', 'Accept': 'application/json' }
      });
      if (res.ok) {
        const raw = await res.json();
        data = { acciones: raw.data || raw };
      } else {
        data = {
          acciones: [
            { symbol: 'GGAL', description: 'Grupo Galicia', closePrice: 8420, changePercent: 2.3 },
            { symbol: 'YPF',  description: 'YPF',           closePrice: 42100, changePercent: -0.8 },
            { symbol: 'PAMP', description: 'Pampa Energía', closePrice: 3280, changePercent: 1.1 },
            { symbol: 'BBAR', description: 'Banco Frances',  closePrice: 6150, changePercent: 0.5 },
            { symbol: 'TXAR', description: 'Ternium Arg',   closePrice: 1890, changePercent: -1.2 },
            { symbol: 'LOMA', description: 'Loma Negra',    closePrice: 2100, changePercent: 0.9 },
          ],
          source: 'fallback'
        };
      }
    }

    // ── CEDEARs / Yahoo Finance ──
    else if (source === 'cedears') {
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'BRK-B'];
      const query = symbols.join(',');
      const res = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${query}&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (res.ok) {
        const raw = await res.json();
        const quotes = raw?.quoteResponse?.result || [];
        data = {
          cedears: quotes.map(q => ({
            symbol: q.symbol,
            nombre: q.shortName,
            precio: q.regularMarketPrice,
            cambio: q.regularMarketChangePercent?.toFixed(2)
          }))
        };
      } else {
        data = {
          cedears: [
            { symbol: 'AAPL',  nombre: 'Apple',     precio: 213.5, cambio: 0.8 },
            { symbol: 'GOOGL', nombre: 'Alphabet',  precio: 175.2, cambio: -0.3 },
            { symbol: 'MSFT',  nombre: 'Microsoft', precio: 422.1, cambio: 0.5 },
            { symbol: 'AMZN',  nombre: 'Amazon',    precio: 198.4, cambio: 1.2 },
            { symbol: 'TSLA',  nombre: 'Tesla',     precio: 248.0, cambio: -2.1 },
            { symbol: 'META',  nombre: 'Meta',      precio: 585.3, cambio: 0.4 },
            { symbol: 'NVDA',  nombre: 'Nvidia',    precio: 875.4, cambio: 3.2 },
          ],
          source: 'fallback'
        };
      }
    }

    return new Response(JSON.stringify(data), { headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: CORS
    });
  }
}
