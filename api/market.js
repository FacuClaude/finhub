export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const FALLBACK = {
  acciones: [
    { symbol:'GGAL', description:'Grupo Galicia',  closePrice:8420,  changePercent:2.3  },
    { symbol:'YPF',  description:'YPF S.A.',        closePrice:42100, changePercent:-0.8 },
    { symbol:'PAMP', description:'Pampa Energia',   closePrice:3280,  changePercent:1.1  },
    { symbol:'BBAR', description:'BBVA Argentina',  closePrice:6150,  changePercent:0.5  },
    { symbol:'TXAR', description:'Ternium Arg',     closePrice:1890,  changePercent:-1.2 },
    { symbol:'LOMA', description:'Loma Negra',      closePrice:2100,  changePercent:0.9  },
    { symbol:'TECO2',description:'Telecom Arg',     closePrice:1320,  changePercent:0.3  },
    { symbol:'SUPV', description:'Supervielle',     closePrice:980,   changePercent:1.8  },
  ],
  cedears: [
    { symbol:'AAPL',  nombre:'Apple',        precio:213.5, cambio:'0.80'  },
    { symbol:'GOOGL', nombre:'Alphabet',     precio:175.2, cambio:'-0.30' },
    { symbol:'MSFT',  nombre:'Microsoft',    precio:422.1, cambio:'0.50'  },
    { symbol:'AMZN',  nombre:'Amazon',       precio:198.4, cambio:'1.20'  },
    { symbol:'TSLA',  nombre:'Tesla',        precio:248.0, cambio:'-2.10' },
    { symbol:'META',  nombre:'Meta',         precio:585.3, cambio:'0.40'  },
    { symbol:'NVDA',  nombre:'NVIDIA',       precio:875.4, cambio:'3.20'  },
    { symbol:'JPM',   nombre:'JPMorgan',     precio:242.1, cambio:'0.60'  },
  ],
  crypto: [
    { symbol:'BTC', nombre:'Bitcoin',  precio:67500, cambio:'2.40' },
    { symbol:'ETH', nombre:'Ethereum', precio:3420,  cambio:'1.80' },
    { symbol:'SOL', nombre:'Solana',   precio:168.5, cambio:'3.10' },
    { symbol:'BNB', nombre:'BNB',      precio:585.2, cambio:'0.90' },
  ],
};

async function yahooQuote(symbols) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent,regularMarketVolume`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(5000)
  });
  if (!res.ok) throw new Error('Yahoo failed');
  const raw = await res.json();
  return raw?.quoteResponse?.result || [];
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source');

  try {
    let data = {};

    // ── DÓLAR ──────────────────────────────────────────────────────
    if (source === 'dolar') {
      let raw = {};
      try {
        const res = await fetch('https://criptoya.com/api/dolar', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) raw = await res.json();
      } catch(e) {}

      const mepV = raw.mep?.al30?.ci?.ask || raw.mep?.al30?.['24h']?.ask || raw.mep?.ask || null;
      const mepC = raw.mep?.al30?.ci?.bid || raw.mep?.al30?.['24h']?.bid || raw.mep?.bid || null;
      const cclV = raw.ccl?.al30?.ci?.ask || raw.ccl?.al30?.['24h']?.ask || raw.ccl?.ask || null;
      const cclC = raw.ccl?.al30?.ci?.bid || raw.ccl?.al30?.['24h']?.bid || raw.ccl?.bid || null;
      const usdt = raw.usdt?.ask || raw['usdt/ars']?.ask || null;
      const blue = raw.blue?.ask || null;

      data = {
        blue:    { compra: raw.blue?.bid,    venta: raw.blue?.ask },
        oficial: { compra: raw.oficial?.bid, venta: raw.oficial?.ask },
        mep:     { compra: mepC || (blue ? Math.round(blue*0.97) : null), venta: mepV || (blue ? Math.round(blue*0.97) : null) },
        ccl:     { compra: cclC || (blue ? Math.round(blue*1.01) : null), venta: cclV || (blue ? Math.round(blue*1.01) : null) },
        usdt:    { venta: usdt || (blue ? Math.round(blue*0.99) : null) },
        source: raw.blue?.ask ? 'criptoya' : 'fallback'
      };
    }

    // ── ACCIONES MERVAL ────────────────────────────────────────────
    else if (source === 'acciones') {
      let ok = false;
      // Try BYMA first
      try {
        const res = await fetch('https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/index-data/leaders', {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
          const raw = await res.json();
          const items = (raw.data || raw);
          if (Array.isArray(items) && items.length) {
            data = { acciones: items.slice(0, 10), source: 'byma' };
            ok = true;
          }
        }
      } catch(e) {}

      // Try Yahoo .BA as backup
      if (!ok) {
        try {
          const syms = ['GGAL.BA','YPFD.BA','PAMP.BA','BBAR.BA','TXAR.BA','LOMA.BA','TECO2.BA','SUPV.BA'];
          const quotes = await yahooQuote(syms);
          if (quotes.length) {
            data = {
              acciones: quotes.map(q => ({
                symbol: q.symbol.replace('.BA',''),
                description: q.shortName,
                closePrice: q.regularMarketPrice,
                changePercent: q.regularMarketChangePercent
              })),
              source: 'yahoo'
            };
            ok = true;
          }
        } catch(e) {}
      }

      if (!ok) data = { acciones: FALLBACK.acciones, source: 'fallback' };
    }

    // ── CEDEARS ────────────────────────────────────────────────────
    else if (source === 'cedears') {
      try {
        const syms = ['AAPL','GOOGL','MSFT','AMZN','TSLA','META','NVDA','BRK-B','JPM','KO','BABA','MELI'];
        const quotes = await yahooQuote(syms);
        if (quotes.length) {
          data = {
            cedears: quotes.map(q => ({
              symbol: q.symbol,
              nombre: q.shortName,
              precio: q.regularMarketPrice,
              cambio: q.regularMarketChangePercent?.toFixed(2)
            })),
            source: 'yahoo'
          };
        } else throw new Error('no quotes');
      } catch(e) {
        data = { cedears: FALLBACK.cedears, source: 'fallback' };
      }
    }

    // ── BONOS ──────────────────────────────────────────────────────
    else if (source === 'bonos') {
      // Try Yahoo for USD bonds
      try {
        const syms = ['AL30=F','GD30=F'];
        const quotes = await yahooQuote(syms);
        // Yahoo doesn't have Argentine bonds - use BYMA data if available
      } catch(e) {}
      // Bonos are only available through BYMA/IOL which require auth
      // Use reference data with disclaimer
      data = {
        bonos: [
          { ticker:'AL30',  nombre:'AL30 — Bono Soberano USD 2030', precio:68.5,  tir:18.2, moneda:'USD', vence:'Jul 2030' },
          { ticker:'GD30',  nombre:'GD30 — Global USD 2030',        precio:71.2,  tir:16.8, moneda:'USD', vence:'Jul 2030' },
          { ticker:'AE38',  nombre:'AE38 — Bono Soberano USD 2038', precio:55.1,  tir:14.5, moneda:'USD', vence:'Ene 2038' },
          { ticker:'AL35',  nombre:'AL35 — Bono Soberano USD 2035', precio:62.3,  tir:17.1, moneda:'USD', vence:'Jul 2035' },
          { ticker:'GD35',  nombre:'GD35 — Global USD 2035',        precio:63.8,  tir:16.5, moneda:'USD', vence:'Jul 2035' },
          { ticker:'S31E6', nombre:'S31E6 — Lecap Ene 2026',        precio:95.1,  tir:4.2,  moneda:'ARS', vence:'Ene 2026' },
          { ticker:'S28F6', nombre:'S28F6 — Lecap Feb 2026',        precio:93.8,  tir:4.4,  moneda:'ARS', vence:'Feb 2026' },
          { ticker:'TZX26', nombre:'TZX26 — Bono CER 2026',         precio:102.1, tir:2.1,  moneda:'ARS', vence:'Mar 2026' },
        ],
        source: 'reference',
        disclaimer: 'Precios de referencia. Para datos en tiempo real usá IOL o Balanz.'
      };
    }

    // ── CRYPTO ─────────────────────────────────────────────────────
    else if (source === 'crypto') {
      try {
        const syms = ['BTC-USD','ETH-USD','SOL-USD','BNB-USD','ADA-USD','XRP-USD'];
        const quotes = await yahooQuote(syms);
        if (quotes.length) {
          data = {
            crypto: quotes.map(q => ({
              symbol: q.symbol.replace('-USD',''),
              nombre: q.shortName || q.symbol,
              precio: q.regularMarketPrice,
              cambio: q.regularMarketChangePercent?.toFixed(2)
            })),
            source: 'yahoo'
          };
        } else throw new Error('no quotes');
      } catch(e) {
        data = { crypto: FALLBACK.crypto, source: 'fallback' };
      }
    }

    // ── HISTORICAL CHART ───────────────────────────────────────────
    else if (source === 'history') {
      const symbol = searchParams.get('symbol') || 'AAPL';
      const period = searchParams.get('period') || '3mo';
      const interval = (period === '2y' || period === '1y') ? '1wk' : '1d';

      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${period}&interval=${interval}&includePrePost=false`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(7000)
        });
        if (res.ok) {
          const raw = await res.json();
          const result = raw?.chart?.result?.[0];
          if (result) {
            const timestamps = result.timestamp || [];
            const closes  = result.indicators?.quote?.[0]?.close  || [];
            const volumes = result.indicators?.quote?.[0]?.volume || [];
            const meta = result.meta || {};
            data = {
              symbol: meta.symbol,
              currency: meta.currency,
              currentPrice: meta.regularMarketPrice,
              previousClose: meta.chartPreviousClose,
              timestamps,
              closes:  closes.map(v  => v  != null ? Math.round(v  * 100) / 100 : null),
              volumes: volumes.map(v => v || 0),
              source: 'yahoo'
            };
          }
        } else {
          data = { error: 'Yahoo returned ' + res.status, symbol };
        }
      } catch(e) {
        data = { error: e.message, symbol };
      }
    }

    // ── NOTICIAS ───────────────────────────────────────────────────
    else if (source === 'noticias') {
      const feeds = [
        { url: 'https://www.ambito.com/rss/economia.xml',                        fuente: 'Ámbito' },
        { url: 'https://www.cronista.com/arc/outboundfeeds/rss/?outputType=xml', fuente: 'El Cronista' },
        { url: 'https://www.infobae.com/feeds/rss/economia/',                    fuente: 'Infobae Economía' },
      ];

      const allNews = [];
      const RSS2JSON = 'https://api.rss2json.com/v1/api.json?count=10&rss_url=';

      await Promise.allSettled(feeds.map(async ({ url, fuente }) => {
        try {
          // Use rss2json as proxy - handles CORS and XML parsing
          const res = await fetch(RSS2JSON + encodeURIComponent(url), {
            signal: AbortSignal.timeout(6000)
          });
          if (!res.ok) return;
          const raw = await res.json();
          if (raw.status !== 'ok' || !raw.items?.length) return;

          raw.items.forEach(item => {
            if (!item.title || !item.link) return;
            allNews.push({
              titulo: item.title.replace(/<[^>]+>/g, '').trim(),
              link: item.link,
              fuente,
              fecha: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
              descripcion: item.description
                ? item.description.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').substring(0, 200)
                : (item.content || '').replace(/<[^>]+>/g,'').substring(0, 200),
              imagen: item.thumbnail || item.enclosure?.link || null,
            });
          });
        } catch(e) {}
      }));

      allNews.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      data = { noticias: allNews.slice(0, 24), source: allNews.length ? 'rss2json' : 'unavailable' };
    }

        return new Response(JSON.stringify(data), { headers: CORS });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
