

// Simple in-memory cache for latest rates
const latestRates = {};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    // Accept either symbol (e.g., BTCUSDT) or from/to (e.g., USDT,THB)
    const symbolParam = searchParams.get('symbol');
    let symbol = symbolParam;

    const from = (searchParams.get('from') || '').toUpperCase();
    const to = (searchParams.get('to') || '').toUpperCase();

    if (!symbol) {
      if (!from || !to) {
        return new Response(JSON.stringify({ error: 'Provide symbol or from and to params' }), { status: 400 });
      }
      // Many fiat pairs on Binance are quoted as XXXUSDT or XXXBUSD. If user wants USDT->THB we'll use THBUSDT? Instead, when converting between two currencies like USDT->THB,
      // We will request a pair where base is target+base? Simpler: if either side is USDT, use pair BASEUSDT or USDTBASE. For demo, if user requests from=USDT&to=THB, we'll try THBUSDT then THBUSDT etc.
      // For simplicity, when from is USDT and to is THB, we'll use symbol = TOUSDT (THBUSDT) which may not exist; fallback handled below.
      symbol = `${from}${to}`;
    }

    // Try common variants
    const candidates = [symbol, `${symbol}USDT`, `${symbol}BUSD`, symbol.replace('USDT', ''), symbol.replace('BUSD', '')];

    let data = null;
    for (const cand of candidates) {
      if (!cand) continue;
      try {
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${cand}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json && json.price) {
            data = { symbol: json.symbol, price: json.price };
            break;
          }
        }
      } catch (e) {
        // ignore and try next
      }
    }

    if (!data) {
      return new Response(JSON.stringify({ error: 'Price not found for symbol' }), { status: 404 });
    }

    // Save latest rate in cache
    latestRates[data.symbol] = { price: data.price, timestamp: Date.now() };

    // Set CORS headers so frontend can call easily (though Next.js API routes already run server-side)
    const headers = new Headers({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });

    return new Response(JSON.stringify({ symbol: data.symbol, price: data.price }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
