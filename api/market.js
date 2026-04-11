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

    if (source === 'dolar') {
      let raw = {};
      try {
        const res = await fetch('https://criptoya.com/api/dolar', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) raw = await res.json();
      } catch(e) { raw = {}; }

      // Try every possible path for MEP and CCL
      const mepVenta  = raw.mep?.al30?.ci?.ask   || raw.mep?.al30?.['24h']?.ask  || raw.mep?.al30d?.ask  || raw.mep?.ask  || null;
      const mepCompra = raw.mep?.al30?.ci?.bid   || raw.mep?.al30?.['24h']?.bid  || raw.mep?.al30d?.bid  || raw.mep?.bid  || null;
      const cclVenta  = raw.ccl?.al30?.ci?.ask   || raw.ccl?.al30?.['24h']?.ask  || raw.ccl?.al30d?.ask  || raw.ccl?.ask  || null;
      const cclCompra = raw.ccl?.al30?.ci?.bid   || raw.ccl?.al30?.['24h']?.bid  || raw.ccl?.al30d?.bid  || raw.ccl?.bid  || null;
      const usdtVal   = raw.usdt?.ask || raw.usdt?.bid || raw['usdt/ars']?.ask || null;

      // If MEP/CCL still null, estimate from blue (approximate)
      const blueAsk = raw.blue?.ask || null;
      const mepFallback  = blueAsk ? Math.round(blueAsk * 0.97) : null;
      const cclFallback  = blueAsk ? Math.round(blueAsk * 1.01) : null;
      const usdtFallback = blueAsk ? Math.round(blueAsk * 0.99) : null;

      // Also return raw mep/ccl keys for debugging
      data = {
        blue:    { compra: raw.blue?.bid,    venta: raw.blue?.ask },
        oficial: { compra: raw.oficial?.bid, venta: raw.oficial?.ask },
        mep:     { compra: mepCompra  || mepFallback,  venta: mepVenta  || mepFallback  },
        ccl:     { compra: cclCompra  || cclFallback,  venta: cclVenta  || cclFallback  },
        cripto:  { usdt: usdtVal || usdtFallback },
        _debug:  { mepKeys: raw.mep ? Object.keys(raw.mep) : [], cclKeys: raw.ccl ? Object.keys(raw.ccl) : [] }
      };
    }

    else if (source === 'acciones') {
      let accionesOk = false;
      try {
        const res = await fetch('https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/index-data/leaders', {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
          const raw = await res.json();
          if ((raw.data || raw)?.length) {
            data = { acciones: (raw.data || raw).slice(0, 10) };
            accionesOk = true;
          }
        }
      } catch(e) {}
      if (!accionesOk) {
        data = { acciones: [
          { symbol:'GGAL', description:'Grupo Galicia',  closePrice:8420,  changePercent:2.3  },
          { symbol:'YPF',  description:'YPF S.A.',       closePrice:42100, changePercent:-0.8 },
          { symbol:'PAMP', description:'Pampa Energia',  closePrice:3280,  changePercent:1.1  },
          { symbol:'BBAR', description:'BBVA Argentina', closePrice:6150,  changePercent:0.5  },
          { symbol:'TXAR', description:'Ternium Arg',    closePrice:1890,  changePercent:-1.2 },
          { symbol:'LOMA', description:'Loma Negra',     closePrice:2100,  changePercent:0.9  },
          { symbol:'TECO2',description:'Telecom Arg',    closePrice:1320,  changePercent:0.3  },
          { symbol:'SUPV', description:'Supervielle',    closePrice:980,   changePercent:1.8  },
        ], source:'fallback' };
      }
    }

    else if (source === 'cedears') {
      const symbols = ['AAPL','GOOGL','MSFT','AMZN','TSLA','META','NVDA','BRK-B','JPM','KO'];
      const res = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const raw = await res.json();
        const quotes = raw?.quoteResponse?.result || [];
        data = { cedears: quotes.map(q => ({
          symbol: q.symbol,
          nombre: q.shortName,
          precio: q.regularMarketPrice,
          cambio: q.regularMarketChangePercent?.toFixed(2)
        })) };
      } else {
        data = { cedears: [
          { symbol:'AAPL',  nombre:'Apple Inc.',    precio:213.5, cambio:'0.80'  },
          { symbol:'GOOGL', nombre:'Alphabet Inc.',  precio:175.2, cambio:'-0.30' },
          { symbol:'MSFT',  nombre:'Microsoft',      precio:422.1, cambio:'0.50'  },
          { symbol:'AMZN',  nombre:'Amazon',         precio:198.4, cambio:'1.20'  },
          { symbol:'TSLA',  nombre:'Tesla',          precio:248.0, cambio:'-2.10' },
          { symbol:'META',  nombre:'Meta Platforms', precio:585.3, cambio:'0.40'  },
          { symbol:'NVDA',  nombre:'NVIDIA Corp.',   precio:875.4, cambio:'3.20'  },
          { symbol:'JPM',   nombre:'JPMorgan Chase', precio:242.1, cambio:'0.60'  },
        ], source:'fallback' };
      }
    }

    else if (source === 'bonos') {
      data = { bonos: [
        { ticker:'AL30',  nombre:'Bono AL 2030',      precio:68.5,  tir:18.2, moneda:'USD', vence:'Jul 2030' },
        { ticker:'GD30',  nombre:'Bono GD 2030',      precio:71.2,  tir:16.8, moneda:'USD', vence:'Jul 2030' },
        { ticker:'AE38',  nombre:'Bono AE 2038',      precio:55.1,  tir:14.5, moneda:'USD', vence:'Ene 2038' },
        { ticker:'AL35',  nombre:'Bono AL 2035',      precio:62.3,  tir:17.1, moneda:'USD', vence:'Jul 2035' },
        { ticker:'T2X5',  nombre:'Lecap Jun 2025',    precio:98.2,  tir:3.8,  moneda:'ARS', vence:'Jun 2025' },
        { ticker:'S31E6', nombre:'Lecap Ene 2026',    precio:95.1,  tir:4.2,  moneda:'ARS', vence:'Ene 2026' },
        { ticker:'S28F6', nombre:'Lecap Feb 2026',    precio:93.8,  tir:4.4,  moneda:'ARS', vence:'Feb 2026' },
        { ticker:'TZX25', nombre:'Bono CER Mar 2025', precio:102.1, tir:2.1,  moneda:'ARS', vence:'Mar 2025' },
      ] };
    }

    else if (source === 'crypto') {
      const symbols = ['BTC-USD','ETH-USD','SOL-USD','BNB-USD'];
      const res = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const raw = await res.json();
        const quotes = raw?.quoteResponse?.result || [];
        data = { crypto: quotes.map(q => ({
          symbol: q.symbol.replace('-USD',''),
          nombre: q.shortName || q.symbol,
          precio: q.regularMarketPrice,
          cambio: q.regularMarketChangePercent?.toFixed(2)
        })) };
      } else {
        data = { crypto: [
          { symbol:'BTC',  nombre:'Bitcoin',  precio:67500, cambio:'2.40' },
          { symbol:'ETH',  nombre:'Ethereum', precio:3420,  cambio:'1.80' },
          { symbol:'SOL',  nombre:'Solana',   precio:168.5, cambio:'3.10' },
          { symbol:'BNB',  nombre:'BNB',      precio:585.2, cambio:'0.90' },
        ], source:'fallback' };
      }
    }

    return new Response(JSON.stringify(data), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
