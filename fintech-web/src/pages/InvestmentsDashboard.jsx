import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

export default function InvestmentsDashboard() {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/investments/');
        setInvestments(res.data || []);
      } catch (err) {
        console.error('Erro ao carregar dashboard de investimentos', err);
        setError('Erro ao carregar dashboard de investimentos.');
      } finally {
        setLoading(false);
      }
    };

    load();
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

  if (loading) return <div className="p-6">Carregando dashboard de investimentos...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard de Investimentos</h1>

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
