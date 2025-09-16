"use client";
import { useEffect, useState } from 'react';

const COMMON = ['USD', 'USDT', 'EUR', 'THB', 'BTC', 'ETH'];

// Provided symbols (only the `symbol` strings)
const SYMBOLS = [
  'ETHBTC', 'LTCBTC', 'BNBBTC', 'NEOBTC', 'QTUMETH', 'EOSETH', 'SNTETH', 'BNTETH', 'BCCBTC', 'GASBTC', 'BNBETH'
];

function getBaseQuote(sym) {
  const quotes = ['USDT','BUSD','BTC','ETH','BNB','USD','THB','EUR'];
  for (const q of quotes) {
    if (sym.endsWith(q)) {
      return { base: sym.slice(0, sym.length - q.length), quote: q };
    }
  }
  // fallback: last 3 chars as quote
  return { base: sym.slice(0, -3), quote: sym.slice(-3) };
}

function formatNumber(n) {
  if (!isFinite(n)) return String(n);
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export default function Home() {
  // Simplified: only symbol + amount
  const [symbol, setSymbol] = useState('LTCBTC');
  const [amount, setAmount] = useState('1');
  const [perUnit, setPerUnit] = useState('');
  const [result, setResult] = useState('');
  // Initialize offline as false so SSR and initial client render match
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function handler() {
      setOffline(!navigator.onLine);
    }
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);
    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('offline', handler);
    };
  }, []);

  useEffect(() => {
    // On mount, check online status and load cached data if offline
    const isOffline = !navigator.onLine;
    setOffline(isOffline);

    if (isOffline) {
      const key = `rate:${symbol}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw);
          const price = parseFloat(data.price);
          const { base, quote } = getBaseQuote(symbol);
          setPerUnit(`1 ${base} = ${formatNumber(price)} ${quote}`);
          setResult(`${amount} ${base} = ${formatNumber(parseFloat(amount) * price)} ${quote}`);
        }
      } catch (e) {
        // ignore localStorage errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function convert() {
    setLoading(true);
    setResult('');
    
    try {
      // Attempt to fetch price for the selected symbol
      const resp = await fetch(`/api/price?symbol=${symbol}`);
      if (resp.ok) {
        const data = await resp.json();
        const price = parseFloat(data.price);
        const total = (parseFloat(amount) * price) || 0;
        const { base, quote } = getBaseQuote(symbol);
        setPerUnit(`1 ${base} = ${formatNumber(price)} ${quote}`);
        setResult(`${amount} ${base} = ${formatNumber(total)} ${quote}`);
        // cache
        const key = `rate:${symbol}`;
        localStorage.setItem(key, JSON.stringify({ price, timestamp: Date.now() }));
      } else {
        // fallback to cached value
        const key = `rate:${symbol}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw);
          const price = parseFloat(data.price);
          const total = (parseFloat(amount) * price) || 0;
          const { base, quote } = getBaseQuote(symbol);
          setPerUnit(`1 ${base} = ${formatNumber(price)} ${quote} (Offline data)`);
          setResult(`${amount} ${base} = ${formatNumber(total)} ${quote} (Offline data)`);
          setOffline(true);
        } else {
          const err = await resp.json();
          setResult('Error: ' + (err.error || 'Unable to fetch rate'));
        }
      }
    } catch (e) {
      // Network error: try cached
      const key = `rate:${symbol}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        const price = parseFloat(data.price);
        const total = (parseFloat(amount) * price) || 0;
        const { base, quote } = getBaseQuote(symbol);
        setPerUnit(`1 ${base} = ${formatNumber(price)} ${quote} (Offline data)`);
        setResult(`${amount} ${base} = ${formatNumber(total)} ${quote} (Offline data)`);
        setOffline(true);
      } else {
        setResult('Network error and no cached data');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/80 dark:bg-black/60 rounded-lg p-6 shadow">
        <h1 className="text-2xl font-semibold mb-4">PWA Currency Exchange</h1>

        {offline && (
          <div className="mb-3 text-sm text-yellow-700">Offline Mode – ข้อมูลล่าสุด</div>
        )}

        <label className="block text-sm">Symbol (e.g., LTCBTC)</label>
        <select className="w-full mb-3 p-2 border rounded" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {SYMBOLS.map(s => <option className='text-black' key={s} value={s}>{s}</option>)}
        </select>

        <label className="block text-sm">Amount (in base currency)</label>
        <input className="w-full mb-4 p-2 border rounded" value={amount} onChange={(e) => setAmount(e.target.value)} />

        <button className="w-full bg-teal-500 text-white p-2 rounded" onClick={convert} disabled={loading}>
          {loading ? 'Converting...' : 'Convert'}
        </button>

        {result && (
          <div className="mt-4 p-3 bg-gray-100 rounded text-sm text-black">
            <div className="font-medium">Per unit</div>
            <div className="text-sm">{perUnit}</div>
            <div className="font-medium mt-2">Total</div>
            <div className="text-sm">{result}</div>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500">Online → สดจากอินเทอร์เน็ต (Binance API ผ่าน Backend ของเรา). Offline → ข้อมูลล่าสุดที่เราเคยใช้.</div>
      </div>
    </main>
  );
}