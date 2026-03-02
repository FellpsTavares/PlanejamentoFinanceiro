import requests

BRAPI_URL = 'https://brapi.dev/api/quote'


def get_current_price(ticker: str):
    """Busca o preço atual do ativo via brapi.dev.
    Retorna float price ou None.
    """
    try:
        url = f"{BRAPI_URL}/{ticker}"
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        results = data.get('results') or []
        if not results:
            return None
        price = results[0].get('regularMarketPrice')
        if price is None:
            # tentar outras chaves
            price = results[0].get('close')
        return float(price) if price is not None else None
    except Exception:
        return None
