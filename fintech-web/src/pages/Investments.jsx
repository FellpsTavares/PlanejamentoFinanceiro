import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { investmentsMarketService } from '../services/investmentsMarket';

export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [error, setError] = useState('');

  // form state
  const [ticker, setTicker] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [liveQuote, setLiveQuote] = useState(null);
  const [currentPriceInput, setCurrentPriceInput] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyDate, setBuyDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const tickersRef = useRef([]);

  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatNumber = (value, minimumFractionDigits = 0, maximumFractionDigits = 4) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits, maximumFractionDigits });
  const formatPct = (value) => `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const parseMoney = (value) => Number(String(value || '0').replace(',', '.'));

  const fetchInvestments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/investments/', { params: { include_live: 0 } });
      const base = res.data || res;
      setInvestments(base);
      const tickers = (base || []).map((inv) => inv.ticker).filter(Boolean);
      if (tickers.length > 0) {
        await fetchLivePrices(tickers);
      }
    } catch (err) {
      setError('Erro ao carregar investimentos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvestments();
  }, []);

  useEffect(() => {
    tickersRef.current = investments.map((inv) => inv.ticker).filter(Boolean);
  }, [investments]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const tickers = tickersRef.current;
      if (tickers.length > 0) {
        fetchLivePrices(tickers);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const fetchLivePrices = async (tickers) => {
    const dedup = Array.from(new Set((tickers || []).map((item) => String(item).trim().toUpperCase()).filter(Boolean)));
    if (dedup.length === 0) return;

    const cached = investmentsMarketService.getCachedPrices(dedup);
    if (Object.keys(cached).length > 0) {
      setInvestments((prev) => prev.map((inv) => {
        const key = String(inv.ticker || '').toUpperCase();
        if (!Object.prototype.hasOwnProperty.call(cached, key)) return inv;
        const current = cached[key];
        const buyPrice = Number(inv.buy_price || 0);
        const qty = Number(inv.quantity || 0);
        const pnl = current === null || current === undefined ? null : (Number(current) - buyPrice) * qty;
        const pnlPercent = current === null || current === undefined || buyPrice <= 0
          ? null
          : ((Number(current) / buyPrice) - 1) * 100;

        return {
          ...inv,
          current_price: current,
          pnl,
          pnl_percent: pnlPercent,
        };
      }));
    }

    setLoadingQuotes(true);
    try {
      const quoteMap = await investmentsMarketService.fetchLivePrices(dedup);

      setInvestments((prev) => prev.map((inv) => {
        const key = String(inv.ticker || '').toUpperCase();
        const current = quoteMap[key];
        const buyPrice = Number(inv.buy_price || 0);
        const qty = Number(inv.quantity || 0);
        const pnl = current === null || current === undefined ? null : (Number(current) - buyPrice) * qty;
        const pnlPercent = current === null || current === undefined || buyPrice <= 0
          ? null
          : ((Number(current) / buyPrice) - 1) * 100;

        return {
          ...inv,
          current_price: current,
          pnl,
          pnl_percent: pnlPercent,
        };
      }));
    } catch (err) {
      console.error('Erro ao atualizar cotacoes em lote', err);
    } finally {
      setLoadingQuotes(false);
    }
  };

  useEffect(() => {
    const term = (ticker || '').trim();
    if (term.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const res = await api.get('/investments/asset-search/', { params: { q: term } });
        setSuggestions(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Erro ao buscar ativos', err);
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [ticker]);

  useEffect(() => {
    const symbol = selectedAsset?.symbol || ticker?.trim();
    if (!symbol) {
      setLiveQuote(null);
      return;
    }

    let cancelled = false;
    const loadQuote = async () => {
      try {
        const res = await api.get('/investments/quote/', { params: { ticker: symbol } });
        if (!cancelled) {
          setLiveQuote(res.data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setLiveQuote(null);
        }
      }
    };

    loadQuote();
    const intervalId = setInterval(loadQuote, 30000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [selectedAsset, ticker]);

  const quotedOrTypedCurrentPrice = (() => {
    const manual = parseMoney(currentPriceInput);
    if (manual > 0) return manual;
    return Number(liveQuote?.price || 0);
  })();

  const previewPnl = (() => {
    const buy = parseMoney(buyPrice);
    const qty = Number(quantity || 0);
    if (buy <= 0 || qty <= 0 || quotedOrTypedCurrentPrice <= 0) return null;
    return (quotedOrTypedCurrentPrice - buy) * qty;
  })();

  const previewPnlPercent = (() => {
    const buy = parseMoney(buyPrice);
    if (buy <= 0 || quotedOrTypedCurrentPrice <= 0) return null;
    return ((quotedOrTypedCurrentPrice / buy) - 1) * 100;
  })();

  const handleSelectSuggestion = (asset) => {
    setSelectedAsset(asset);
    setTicker(asset.symbol);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const payload = {
        ticker: (selectedAsset?.symbol || ticker).trim().toUpperCase(),
        buy_price: parseMoney(buyPrice),
        quantity: quantity,
        buy_date: buyDate || new Date().toISOString().slice(0, 10),
      };

      await api.post('/investments/', payload);
      setMessage('Investimento adicionado com sucesso.');
      setTicker('');
      setSelectedAsset(null);
      setSuggestions([]);
      setCurrentPriceInput('');
      setLiveQuote(null);
      setBuyPrice('');
      setQuantity('');
      setBuyDate('');
      await fetchInvestments();
    } catch (err) {
      console.error(err);
      setMessage('Erro ao adicionar investimento');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-4">Carregando...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Investimentos</h1>

      <form onSubmit={handleCreate} className="mb-4 bg-white p-4 rounded shadow grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-4 relative">
          <label className="block text-sm text-gray-600">Ativo ou Cripto (busca inteligente)</label>
          <input
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value.toUpperCase());
              setSelectedAsset(null);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className="w-full p-2 border rounded"
            placeholder="Ex.: PETR4, VALE3, AAPL, BTC-USD"
            required
          />
          {showSuggestions && ticker.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-[72px] z-20 max-h-64 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {suggestionsLoading && <div className="p-2 text-sm text-slate-500">Buscando ativos...</div>}
              {!suggestionsLoading && suggestions.length === 0 && <div className="p-2 text-sm text-slate-500">Nenhuma sugestao encontrada.</div>}
              {!suggestionsLoading && suggestions.map((asset) => (
                <button
                  key={asset.symbol}
                  type="button"
                  onClick={() => handleSelectSuggestion(asset)}
                  className="w-full border-b px-3 py-2 text-left hover:bg-slate-50"
                >
                  <div className="font-medium text-slate-900">{asset.symbol}</div>
                  <div className="text-xs text-slate-500">{asset.name} {asset.exchange ? `- ${asset.exchange}` : ''}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600">Preço compra</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
            <input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} className="w-full p-2 border rounded" style={{ paddingLeft: '3rem' }} type="text" placeholder="0,00" required />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600">Preço atual (manual)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
            <input
              value={currentPriceInput}
              onChange={(e) => setCurrentPriceInput(e.target.value)}
              className="w-full p-2 border rounded"
              style={{ paddingLeft: '3rem' }}
              type="text"
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600">Quantidade</label>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full p-2 border rounded" type="number" step="0.0001" required />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600">Data compra</label>
          <input value={buyDate} onChange={(e) => setBuyDate(e.target.value)} className="w-full p-2 border rounded" type="date" />
        </div>

        <div className="md:col-span-12 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <span>
              Cotacao ao vivo: <strong className="text-slate-900">{liveQuote?.price ? formatBRL(liveQuote.price) : 'indisponivel'}</strong>
            </span>
            {liveQuote?.change_percent !== null && liveQuote?.change_percent !== undefined && (
              <span className={Number(liveQuote.change_percent) >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                Variacao dia: {formatPct(liveQuote.change_percent)}
              </span>
            )}
            {selectedAsset?.name && <span>Ativo: <strong className="text-slate-900">{selectedAsset.name}</strong></span>}
          </div>
          <div className="mt-2">
            {previewPnl === null ? (
              <span className="text-slate-500">Preencha preco de compra, quantidade e cotacao para visualizar lucro/prejuizo atual.</span>
            ) : (
              <span className={previewPnl >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                Resultado atual estimado: {formatBRL(previewPnl)} ({formatPct(previewPnlPercent)})
              </span>
            )}
          </div>
        </div>

        <div className="md:col-span-12">
          <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded">{submitting ? 'Salvando...' : 'Adicionar'}</button>
          {loadingQuotes && <span className="ml-3 text-xs text-slate-500">Atualizando cotacoes...</span>}
        </div>
      </form>

      {message && <div className="mb-4 text-sm text-green-600">{message}</div>}

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="w-full table-auto">
          <thead>
            <tr className="text-left">
              <th className="p-3">Ticker</th>
              <th className="p-3">Ativo</th>
              <th className="p-3">Preço Compra</th>
              <th className="p-3">Preço Atual</th>
              <th className="p-3">Quantidade</th>
              <th className="p-3">PnL</th>
              <th className="p-3">Rentab.</th>
            </tr>
          </thead>
          <tbody>
            {investments.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="p-3 font-mono">{inv.ticker}</td>
                <td className="p-3">{inv.asset_name || '—'}</td>
                <td className="p-3">{formatBRL(inv.buy_price)}</td>
                <td className="p-3">{inv.current_price ? formatBRL(inv.current_price) : '—'}</td>
                <td className="p-3">{formatNumber(inv.quantity, 0, 4)}</td>
                <td className={`p-3 font-semibold ${inv.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {inv.pnl === null || inv.pnl === undefined ? '—' : formatBRL(inv.pnl)}
                </td>
                <td className={`p-3 font-semibold ${inv.pnl_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {inv.pnl_percent === null || inv.pnl_percent === undefined ? '—' : formatPct(inv.pnl_percent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
