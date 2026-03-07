from __future__ import annotations

import re
import time
from typing import Any

import requests
import yfinance as yf

SEARCH_URL = 'https://query2.finance.yahoo.com/v1/finance/search'

# Universo enxuto para recomendacoes por momentum de mercado.
RECOMMENDED_UNIVERSE = [
    'PETR4.SA', 'VALE3.SA', 'ITUB4.SA', 'BBDC4.SA', 'BBAS3.SA', 'WEGE3.SA',
    'ABEV3.SA', 'RENT3.SA', 'PRIO3.SA', 'SUZB3.SA', 'BOVA11.SA', 'SMAL11.SA',
    'IVVB11.SA', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN',
    'BTC-USD', 'ETH-USD', 'SOL-USD',
]

_RECOMMENDATION_CACHE: dict[str, Any] = {'ts': 0.0, 'data': []}
_QUOTE_CACHE: dict[str, dict[str, Any]] = {}
QUOTE_TTL_SECONDS = 30


def _fallback_recommendations(limit: int) -> list[dict[str, Any]]:
    # Fallback rapido para evitar tela vazia quando houver indisponibilidade de mercado.
    items: list[dict[str, Any]] = []
    for symbol in RECOMMENDED_UNIVERSE[: max(limit, 8)]:
        items.append({
            'ticker': symbol,
            'name': symbol,
            'exchange': None,
            'currency': None,
            'price': None,
            'change_percent': 0.0,
            'momentum_5d': 0.0,
            'momentum_20d': 0.0,
            'score': 0.0,
            'fallback': True,
        })
    return items[:limit]


def normalize_ticker(ticker: str) -> str:
    symbol = (ticker or '').strip().upper()
    if not symbol:
        return symbol
    if '.' in symbol:
        return symbol
    # B3 comum: PETR4, VALE3 etc.
    if re.fullmatch(r'[A-Z]{4}\d{1,2}', symbol):
        return f'{symbol}.SA'
    return symbol


def _history_last_close(symbol: str) -> float | None:
    try:
        history = yf.Ticker(symbol).history(period='1d', interval='1m')
        if history is not None and not history.empty:
            value = history['Close'].dropna().iloc[-1]
            return float(value)
    except Exception:
        return None
    return None


def _quote_cache_get(symbol: str) -> float | None:
    item = _QUOTE_CACHE.get(symbol)
    if not item:
        return None
    if time.time() - float(item.get('ts') or 0) > QUOTE_TTL_SECONDS:
        return None
    return item.get('price')


def _quote_cache_set(symbol: str, price: float | None) -> None:
    _QUOTE_CACHE[symbol] = {'price': price, 'ts': time.time()}


def get_current_price(ticker: str) -> float | None:
    symbol = normalize_ticker(ticker)
    if not symbol:
        return None

    cached = _quote_cache_get(symbol)
    if cached is not None:
        return cached

    try:
        ticker_obj = yf.Ticker(symbol)
        fast_info = getattr(ticker_obj, 'fast_info', {}) or {}
        price = fast_info.get('last_price') or fast_info.get('regular_market_price')
        if price is not None:
            parsed = float(price)
            _quote_cache_set(symbol, parsed)
            return parsed
    except Exception:
        pass

    fallback = _history_last_close(symbol)
    _quote_cache_set(symbol, fallback)
    return fallback


def get_current_prices_bulk(tickers: list[str]) -> dict[str, float | None]:
    if not tickers:
        return {}

    normalized_map: dict[str, str] = {}
    for ticker in tickers:
        raw = (ticker or '').strip().upper()
        if not raw:
            continue
        normalized_map[raw] = normalize_ticker(raw)

    raw_symbols = list(normalized_map.keys())
    unique_normalized = list({v for v in normalized_map.values() if v})

    resolved_by_normalized: dict[str, float | None] = {}
    misses: list[str] = []

    for symbol in unique_normalized:
        cached = _quote_cache_get(symbol)
        if cached is not None:
            resolved_by_normalized[symbol] = cached
        else:
            misses.append(symbol)

    if misses:
        fetched: dict[str, float | None] = {}
        try:
            frame = yf.download(
                tickers=' '.join(misses),
                period='1d',
                interval='1m',
                group_by='ticker',
                auto_adjust=False,
                progress=False,
                threads=True,
                prepost=True,
            )

            if frame is not None and not frame.empty:
                if len(misses) == 1:
                    close_series = frame['Close'] if 'Close' in frame else None
                    if close_series is not None and not close_series.dropna().empty:
                        fetched[misses[0]] = float(close_series.dropna().iloc[-1])
                else:
                    for symbol in misses:
                        close_series = None
                        if getattr(frame.columns, 'nlevels', 1) > 1:
                            if (symbol, 'Close') in frame.columns:
                                close_series = frame[(symbol, 'Close')]
                            elif ('Close', symbol) in frame.columns:
                                close_series = frame[('Close', symbol)]
                        if close_series is not None and not close_series.dropna().empty:
                            fetched[symbol] = float(close_series.dropna().iloc[-1])
        except Exception:
            fetched = {}

        for symbol in misses:
            price = fetched.get(symbol)
            if price is None:
                price = get_current_price(symbol)
            resolved_by_normalized[symbol] = price
            _quote_cache_set(symbol, price)

    result: dict[str, float | None] = {}
    for raw in raw_symbols:
        result[raw] = resolved_by_normalized.get(normalized_map[raw])

    return result


def get_asset_quote(ticker: str) -> dict[str, Any]:
    symbol = normalize_ticker(ticker)
    if not symbol:
        return {}

    price = get_current_price(symbol)
    previous_close = None
    name = symbol
    exchange = None
    currency = None

    try:
        ticker_obj = yf.Ticker(symbol)
        fast_info = getattr(ticker_obj, 'fast_info', {}) or {}
        info = getattr(ticker_obj, 'info', {}) or {}

        previous_close = fast_info.get('previous_close') or info.get('previousClose')
        exchange = info.get('exchange') or info.get('fullExchangeName')
        currency = fast_info.get('currency') or info.get('currency')
        name = info.get('shortName') or info.get('longName') or symbol
    except Exception:
        pass

    change_percent = None
    try:
        if price is not None and previous_close not in (None, 0):
            change_percent = ((float(price) - float(previous_close)) / float(previous_close)) * 100.0
    except Exception:
        change_percent = None

    return {
        'ticker': symbol,
        'price': float(price) if price is not None else None,
        'previous_close': float(previous_close) if previous_close is not None else None,
        'change_percent': change_percent,
        'name': name,
        'exchange': exchange,
        'currency': currency,
        'as_of': int(time.time()),
    }


def search_assets(query: str, limit: int = 8) -> list[dict[str, Any]]:
    term = (query or '').strip()
    if len(term) < 2:
        return []

    suggestions: list[dict[str, Any]] = []

    # Preferencia: funcionalidade de busca do yfinance.
    try:
        search_cls = getattr(yf, 'Search', None)
        if search_cls is not None:
            result = search_cls(term, max_results=limit, news_count=0, enable_fuzzy_query=True)
            for item in (getattr(result, 'quotes', None) or []):
                symbol = normalize_ticker(item.get('symbol') or '')
                if not symbol:
                    continue
                suggestions.append({
                    'symbol': symbol,
                    'name': item.get('shortname') or item.get('longname') or symbol,
                    'exchange': item.get('exchange') or item.get('exchDisp') or '',
                    'type': item.get('quoteType') or '',
                    'currency': item.get('currency') or '',
                })
    except Exception:
        pass

    # Fallback para endpoint publico do Yahoo caso Search nao esteja disponivel.
    if not suggestions:
        try:
            response = requests.get(
                SEARCH_URL,
                params={'q': term, 'quotesCount': max(5, limit), 'newsCount': 0},
                timeout=5,
            )
            response.raise_for_status()
            payload = response.json() or {}
            for item in payload.get('quotes') or []:
                quote_type = (item.get('quoteType') or '').upper()
                if quote_type and quote_type not in {'EQUITY', 'ETF', 'MUTUALFUND', 'INDEX', 'CRYPTOCURRENCY', 'CRYPTO'}:
                    continue
                symbol = normalize_ticker(item.get('symbol') or '')
                if not symbol:
                    continue
                suggestions.append({
                    'symbol': symbol,
                    'name': item.get('shortname') or item.get('longname') or symbol,
                    'exchange': item.get('exchange') or item.get('exchDisp') or '',
                    'type': item.get('quoteType') or '',
                    'currency': item.get('currency') or '',
                })
        except Exception:
            return []

    # Remover duplicados mantendo ordem.
    dedup: dict[str, dict[str, Any]] = {}
    for item in suggestions:
        dedup.setdefault(item['symbol'], item)

    return list(dedup.values())[:limit]


def _momentum_for_symbol(symbol: str) -> dict[str, Any] | None:
    quote = get_asset_quote(symbol)
    price = quote.get('price')

    try:
        history = yf.Ticker(symbol).history(period='1mo', interval='1d')
        if history is None or history.empty:
            return None

        close = history['Close'].dropna()
        if close.empty:
            return None

        latest = float(close.iloc[-1])
        close_5d = float(close.iloc[-5]) if len(close) >= 5 else float(close.iloc[0])
        close_20d = float(close.iloc[-20]) if len(close) >= 20 else float(close.iloc[0])

        change_5d = ((latest - close_5d) / close_5d) * 100.0 if close_5d else 0.0
        change_20d = ((latest - close_20d) / close_20d) * 100.0 if close_20d else 0.0

        score = (change_5d * 0.7) + (change_20d * 0.3)

        return {
            'ticker': quote.get('ticker') or symbol,
            'name': quote.get('name') or symbol,
            'exchange': quote.get('exchange'),
            'currency': quote.get('currency'),
            'price': price if price is not None else latest,
            'change_percent': quote.get('change_percent'),
            'momentum_5d': round(change_5d, 2),
            'momentum_20d': round(change_20d, 2),
            'score': round(score, 2),
        }
    except Exception:
        return None


def get_recommended_assets(limit: int = 8) -> list[dict[str, Any]]:
    now = time.time()
    cache_age = now - float(_RECOMMENDATION_CACHE.get('ts') or 0)
    if cache_age < 300 and _RECOMMENDATION_CACHE.get('data'):
        return list(_RECOMMENDATION_CACHE['data'])[:limit]

    ranked: list[dict[str, Any]] = []
    for symbol in RECOMMENDED_UNIVERSE:
        item = _momentum_for_symbol(symbol)
        if item:
            ranked.append(item)

    ranked.sort(key=lambda x: x.get('score') or -9999, reverse=True)

    data = ranked[: max(limit, 8)] if ranked else _fallback_recommendations(max(limit, 8))
    _RECOMMENDATION_CACHE['ts'] = now
    _RECOMMENDATION_CACHE['data'] = data

    return data[:limit]
