import { useEffect, useState } from 'react';
import api from '../services/api';

export default function InvestmentsRecommendations() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatPct = (value) => `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/investments/recommended-assets/', { params: { limit: 10 } });
      setAssets(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar ativos indicados', err);
      setError('Nao foi possivel carregar os ativos indicados no momento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ativos Indicados</h1>
          <p className="mt-1 text-sm text-gray-600">
            Sugestoes baseadas em momentum recente de mercado (5d e 20d) com cotacoes via Yahoo Finance.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Atualizar
        </button>
      </div>

      {loading && <div className="rounded-lg border bg-white p-4">Carregando ativos indicados...</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      {!loading && !error && (
        assets.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
            Nenhuma recomendacao retornada agora. Clique em "Atualizar" para tentar novamente.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => {
              const isPositive = Number(asset.change_percent || 0) >= 0;
              return (
                <article key={asset.ticker} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-slate-900">{asset.ticker}</h2>
                      <p className="text-xs text-slate-500">{asset.name || 'Ativo de mercado'}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {formatPct(asset.change_percent)}
                    </span>
                  </div>

                  {asset.fallback && (
                    <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                      Dados de mercado temporariamente indisponiveis. Exibindo lista base.
                    </div>
                  )}

                  <div className="mt-4 space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between"><span>Preco</span><span className="font-medium text-slate-800">{asset.price ? formatBRL(asset.price) : 'Indisponivel'}</span></div>
                    <div className="flex justify-between"><span>Momentum 5d</span><span>{formatPct(asset.momentum_5d)}</span></div>
                    <div className="flex justify-between"><span>Momentum 20d</span><span>{formatPct(asset.momentum_20d)}</span></div>
                    <div className="flex justify-between"><span>Score</span><span>{Number(asset.score || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
