import { useEffect, useMemo, useRef, useState } from 'react';
import LoadingOverlay from '../components/LoadingOverlay';
import api from '../services/api';
import { investmentsMarketService } from '../services/investmentsMarket';

export default function InvestmentsDashboard() {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [error, setError] = useState('');
  const tickersRef = useRef([]);

  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  useEffect(() => {
    tickersRef.current = (investments || []).map((item) => item.ticker).filter(Boolean);
  }, [investments]);

  useEffect(() => {
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
          return {
            ...inv,
            current_price: current,
            pnl,
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

          return {
            ...inv,
            current_price: current,
            pnl,
          };
        }));
      } catch (err) {
        console.error('Erro ao atualizar cotacoes no painel', err);
      } finally {
        setLoadingQuotes(false);
      }
    };

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/investments/', { params: { include_live: 0 } });
        const base = res.data || [];
        setInvestments(base);
        await fetchLivePrices(base.map((item) => item.ticker));
      } catch (err) {
        console.error('Erro ao carregar painel de investimentos', err);
        setError('Erro ao carregar painel de investimentos.');
      } finally {
        setLoading(false);
      }
    };

    load();

    const intervalId = setInterval(() => {
      fetchLivePrices(tickersRef.current);
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  const metrics = useMemo(() => {
    const totalInvested = (investments || []).reduce(
      (sum, inv) => sum + (Number(inv.buy_price || 0) * Number(inv.quantity || 0)),
      0
    );
    const totalCurrent = (investments || []).reduce(
      (sum, inv) => sum + (Number(inv.current_price || 0) * Number(inv.quantity || 0)),
      0
    );
    const totalPnl = (investments || []).reduce((sum, inv) => sum + Number(inv.pnl || 0), 0);

    return {
      totalInvested,
      totalCurrent,
      totalPnl,
      count: (investments || []).length,
    };
  }, [investments]);

  if (loading) return <LoadingOverlay message="Carregando painel de investimentos..." />;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Painel de Investimentos</h1>
      {loadingQuotes && <p className="mb-3 text-xs text-slate-500">Atualizando cotacoes em tempo real...</p>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-600">Total investido</div>
          <div className="text-xl font-semibold">{formatBRL(metrics.totalInvested)}</div>
        </div>
        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-600">Valor atual</div>
          <div className="text-xl font-semibold">{formatBRL(metrics.totalCurrent)}</div>
        </div>
        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-600">PnL total</div>
          <div className={`text-xl font-semibold ${metrics.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatBRL(metrics.totalPnl)}
          </div>
        </div>
        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-600">Ativos na carteira</div>
          <div className="text-xl font-semibold">{metrics.count}</div>
        </div>
      </div>

      <div className="bg-white border rounded p-4">
        <h2 className="text-lg font-semibold mb-3">Resumo por ativo</h2>
        {investments.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhum investimento cadastrado.</p>
        ) : (
          <ul className="space-y-2">
            {investments.map((inv) => (
              <li key={inv.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-semibold">{inv.ticker}</div>
                  <div className="text-sm text-gray-600">Qtd: {inv.quantity}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">Atual: {inv.current_price ? formatBRL(inv.current_price) : '—'}</div>
                  <div className={`font-semibold ${Number(inv.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatBRL(inv.pnl || 0)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
