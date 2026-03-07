import api from './api';

const CACHE_KEY = 'investments_live_prices_v1';
const DEFAULT_STALE_MS = 30 * 1000;

let inMemoryCache = {
  ts: 0,
  prices: {},
};

const normalizeTicker = (ticker) => String(ticker || '').trim().toUpperCase();

const readLocalCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ts: Number(parsed.ts || 0),
      prices: parsed.prices || {},
    };
  } catch (err) {
    return null;
  }
};

const writeLocalCache = (data) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    // ignore quota errors
  }
};

const getMergedCache = () => {
  const local = readLocalCache();
  if (!local) return inMemoryCache;

  if (local.ts > inMemoryCache.ts) {
    inMemoryCache = local;
    return local;
  }

  if (inMemoryCache.ts > local.ts) {
    writeLocalCache(inMemoryCache);
    return inMemoryCache;
  }

  return inMemoryCache;
};

const updateCache = (newPrices) => {
  const merged = getMergedCache();
  const next = {
    ts: Date.now(),
    prices: {
      ...merged.prices,
      ...newPrices,
    },
  };
  inMemoryCache = next;
  writeLocalCache(next);
  return next;
};

const mapRowsToPrices = (rows) => {
  const result = {};
  (rows || []).forEach((row) => {
    const ticker = normalizeTicker(row?.ticker);
    if (!ticker) return;
    result[ticker] = row.current_price;
  });
  return result;
};

export const investmentsMarketService = {
  getCachedPrices(tickers, staleMs = DEFAULT_STALE_MS) {
    const symbols = Array.from(new Set((tickers || []).map(normalizeTicker).filter(Boolean)));
    if (symbols.length === 0) return {};

    const cache = getMergedCache();
    if (!cache.ts || (Date.now() - cache.ts) > staleMs) return {};

    const result = {};
    symbols.forEach((ticker) => {
      if (Object.prototype.hasOwnProperty.call(cache.prices, ticker)) {
        result[ticker] = cache.prices[ticker];
      }
    });
    return result;
  },

  async fetchLivePrices(tickers) {
    const symbols = Array.from(new Set((tickers || []).map(normalizeTicker).filter(Boolean)));
    if (symbols.length === 0) return {};

    const res = await api.get('/investments/live-prices/', {
      params: { tickers: symbols.join(',') },
    });

    const rows = Array.isArray(res.data) ? res.data : [];
    const mapped = mapRowsToPrices(rows);
    updateCache(mapped);
    return mapped;
  },

  async warmForCurrentPortfolio() {
    const baseRes = await api.get('/investments/', { params: { include_live: 0 } });
    const base = baseRes.data || [];
    const tickers = (base || []).map((item) => item.ticker);
    if (tickers.length > 0) {
      await this.fetchLivePrices(tickers);
    }
    return { base, tickers };
  },
};
