import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';
import LoadingOverlay from '../components/LoadingOverlay';

const PRIORITY_LABEL = {
  predictive_critical: { label: 'Preditivo Crítico', color: 'bg-red-100 text-red-700' },
  preventive_overdue: { label: 'Preventiva Vencida', color: 'bg-orange-100 text-orange-700' },
  checklist_expired: { label: 'Checklist Vencido', color: 'bg-yellow-100 text-yellow-700' },
  corrective_palliative: { label: 'Corretiva Paliativa', color: 'bg-blue-100 text-blue-700' },
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const parts = String(dateStr).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
};

export default function TransportMaintenance() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await transportService.getMaintenanceDashboard();
        setKpis(data);
      } catch (err) {
        console.error('Erro ao carregar dashboard de manutenção', err);
        toast('Erro ao carregar painel de manutenção', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingOverlay message="Carregando manutenção..." />;

  const urgentAlerts = kpis?.urgent_alerts || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Manutenção de Frota</h1>
      <p className="mt-2 text-gray-600">Visão geral dos indicadores de manutenção preventiva, preditiva, corretiva e checklists.</p>

      {/* KPI Cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-500">Conformidade de Plano</div>
          <div className={`text-2xl font-semibold mt-1 ${(kpis?.plan_compliance ?? 100) < 80 ? 'text-red-600' : 'text-green-600'}`}>
            {kpis?.plan_compliance ?? '—'}%
          </div>
          <div className="text-xs text-gray-400 mt-1">Preventivas no prazo (30 dias)</div>
        </div>

        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-500">Alertas Preditivos Ativos</div>
          <div className={`text-2xl font-semibold mt-1 ${(kpis?.active_alerts ?? 0) > 0 ? 'text-red-600' : 'text-gray-700'}`}>
            {kpis?.active_alerts ?? '—'}
          </div>
          <div className="text-xs text-gray-400 mt-1">Atenção ou Crítico</div>
        </div>

        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-500">MTTR Médio</div>
          <div className="text-2xl font-semibold mt-1 text-gray-700">
            {kpis?.avg_mttr_hours != null ? `${kpis.avg_mttr_hours}h` : '—'}
          </div>
          <div className="text-xs text-gray-400 mt-1">Tempo médio de reparo (mês)</div>
        </div>

        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-500">Custo Não Planejado</div>
          <div className={`text-2xl font-semibold mt-1 ${(kpis?.unplanned_cost ?? 0) > 0 ? 'text-red-600' : 'text-gray-700'}`}>
            {Number(kpis?.unplanned_cost ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <div className="text-xs text-gray-400 mt-1">Corretivas no mês</div>
        </div>

        <div className="p-4 border rounded bg-white">
          <div className="text-sm text-gray-500">Checklists em Dia</div>
          <div className={`text-2xl font-semibold mt-1 ${(kpis?.checklist_ok_pct ?? 100) < 80 ? 'text-red-600' : 'text-green-600'}`}>
            {kpis?.checklist_ok_pct ?? '—'}%
          </div>
          <div className="text-xs text-gray-400 mt-1">Veículos com segurança ok</div>
        </div>
      </div>

      {/* Navegação para sub-seções */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/transport/maintenance/preventive" className="p-5 border rounded bg-white hover:border-blue-400 hover:shadow transition-shadow">
          <div className="text-lg font-semibold text-blue-700">🔧 Preventiva</div>
          <div className="text-sm text-gray-500 mt-1">Planos por tempo/km: óleo, filtros, correias, radiador e mais.</div>
        </Link>
        <Link to="/transport/maintenance/predictive" className="p-5 border rounded bg-white hover:border-orange-400 hover:shadow transition-shadow">
          <div className="text-lg font-semibold text-orange-600">📊 Preditiva</div>
          <div className="text-sm text-gray-500 mt-1">Monitoramento de condição: pneus, freios, bateria e análise de óleo.</div>
        </Link>
        <Link to="/transport/maintenance/corrective" className="p-5 border rounded bg-white hover:border-red-400 hover:shadow transition-shadow">
          <div className="text-lg font-semibold text-red-600">🚨 Corretiva</div>
          <div className="text-sm text-gray-500 mt-1">Falhas e reparos: emergências, paliativas, MTTR e custo.</div>
        </Link>
        <Link to="/transport/maintenance/checklist" className="p-5 border rounded bg-white hover:border-green-400 hover:shadow transition-shadow">
          <div className="text-lg font-semibold text-green-700">✅ Checklist</div>
          <div className="text-sm text-gray-500 mt-1">Cronotacógrafo, iluminação, extintor e equipamentos de segurança.</div>
        </Link>
      </div>

      {/* Alertas de Urgência */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Alertas de Urgência</h2>
        {urgentAlerts.length === 0 ? (
          <div className="p-4 border rounded text-gray-500 bg-white">Nenhum alerta de urgência no momento.</div>
        ) : (
          <ul className="space-y-2">
            {urgentAlerts.map((alert, idx) => {
              const meta = PRIORITY_LABEL[alert.type] || { label: alert.type, color: 'bg-gray-100 text-gray-700' };
              return (
                <li key={idx} className="p-3 border rounded bg-white flex flex-col md:flex-row md:items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="font-mono text-sm font-semibold text-gray-700">{alert.vehicle_plate}</span>
                  <span className="text-sm text-gray-600 flex-1">{alert.description}</span>
                  {alert.date && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(alert.date)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
