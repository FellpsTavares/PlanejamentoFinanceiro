import { useEffect, useState } from 'react';
import api from '../services/api';

export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // form state
  const [ticker, setTicker] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyDate, setBuyDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatNumber = (value, minimumFractionDigits = 0, maximumFractionDigits = 4) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits, maximumFractionDigits });
  const parseMoney = (value) => Number(String(value || '0').replace(',', '.'));

  const fetchInvestments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/investments/');
      setInvestments(res.data || res);
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

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const payload = {
        ticker: ticker.trim().toUpperCase(),
        buy_price: parseMoney(buyPrice),
        quantity: quantity,
        buy_date: buyDate || undefined,
      };

      await api.post('/investments/', payload);
      setMessage('Investimento adicionado com sucesso.');
      setTicker('');
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

      <form onSubmit={handleCreate} className="mb-4 bg-white p-4 rounded shadow flex flex-col md:flex-row gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm text-gray-600">Ticker</label>
          <input value={ticker} onChange={(e) => setTicker(e.target.value)} className="w-full p-2 border rounded" required />
        </div>
        <div className="w-40">
          <label className="block text-sm text-gray-600">Preço compra</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
            <input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} className="w-full p-2 border rounded" style={{ paddingLeft: '3rem' }} type="text" placeholder="0,00" required />
          </div>
        </div>
        <div className="w-40">
          <label className="block text-sm text-gray-600">Quantidade</label>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full p-2 border rounded" type="number" step="0.0001" required />
        </div>
        <div className="w-44">
          <label className="block text-sm text-gray-600">Data compra</label>
          <input value={buyDate} onChange={(e) => setBuyDate(e.target.value)} className="w-full p-2 border rounded" type="date" />
        </div>
        <div>
          <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded">{submitting ? 'Salvando...' : 'Adicionar'}</button>
        </div>
      </form>

      {message && <div className="mb-4 text-sm text-green-600">{message}</div>}

      <div className="overflow-x-auto bg-white rounded shadow">
        <table className="w-full table-auto">
          <thead>
            <tr className="text-left">
              <th className="p-3">Ticker</th>
              <th className="p-3">Preço Compra</th>
              <th className="p-3">Preço Atual</th>
              <th className="p-3">Quantidade</th>
              <th className="p-3">PnL</th>
            </tr>
          </thead>
          <tbody>
            {investments.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="p-3 font-mono">{inv.ticker}</td>
                <td className="p-3">{formatBRL(inv.buy_price)}</td>
                <td className="p-3">{inv.current_price ? formatBRL(inv.current_price) : '—'}</td>
                <td className="p-3">{formatNumber(inv.quantity, 0, 4)}</td>
                <td className={`p-3 font-semibold ${inv.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {inv.pnl === null || inv.pnl === undefined ? '—' : formatBRL(inv.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
