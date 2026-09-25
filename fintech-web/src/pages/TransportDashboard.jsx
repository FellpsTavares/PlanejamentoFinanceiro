import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { startOfWeek, startOfMonth, startOfQuarter, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';
import LoadingOverlay from '../components/LoadingOverlay';
import { formatApiDate } from '../utils/format';

const COLORS = { receita: '#16a34a', despesa: '#b91c1c', lucro: '#2563eb' };
const SERIES_LABELS = { receita: 'Receita', despesa: 'Despesa', lucro: 'Lucro' };

const TruckIcon = (props) => (
  <svg className={props.className || 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 7.5h11v9h-11z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5h4l3 3v3h-7z" />
    <circle cx="6.5" cy="17.5" r="1.7" />
    <circle cx="17" cy="17.5" r="1.7" />
  </svg>
);
const ChevronDownIcon = (props) => (
  <svg className={props.className || 'h-3.5 w-3.5'} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
  </svg>
);
const LineChartIcon = (props) => (
  <svg className={props.className || 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" />
  </svg>
);
const BarChartIcon = (props) => (
  <svg className={props.className || 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" d="M5 20V10M12 20V4M19 20v-7" />
  </svg>
);
const GRANULARITY_OPTIONS = [
  { key: 'week', label: 'Semanal' },
  { key: 'month', label: 'Mensal' },
  { key: 'quarter', label: 'Trimestral' },
];

// Tamanho da janela (nº de períodos mais recentes exibidos) e como agrupar/rotular
// cada granularidade. Datas sempre com ano pra evitar ambiguidade quando a janela
// cruza a virada do ano (ex.: "1º tri" de 2025 e de 2026 não podem se confundir).
const GRANULARITY_CONFIG = {
  week: {
    windowSize: 8,
    bucketStart: (d) => startOfWeek(d, { weekStartsOn: 1 }),
    label: (d) => format(d, 'dd/MM'),
  },
  month: {
    windowSize: 6,
    bucketStart: (d) => startOfMonth(d),
    label: (d) => {
      const m = format(d, 'MMM', { locale: ptBR }).replace('.', '');
      return `${m.charAt(0).toUpperCase()}${m.slice(1)}/${format(d, 'yy')}`;
    },
  },
  quarter: {
    windowSize: 4,
    bucketStart: (d) => startOfQuarter(d),
    label: (d) => `${Math.floor(d.getMonth() / 3) + 1}º tri/${format(d, 'yy')}`,
  },
};

const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatCompactBRL = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n);
  if (abs >= 1000) return `${n < 0 ? '-' : ''}R$ ${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`;
  return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[160px]">
      <div className="font-semibold text-gray-900 mb-1.5">{label}</div>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
              {SERIES_LABELS[p.dataKey] || p.dataKey}
            </span>
            <span className="font-semibold text-gray-900">{formatBRL(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Legenda com conteúdo 100% custom: o Recharts recalcula o `payload` da legenda
// a partir da ordem interna das séries do chart (não da ordem em que os <Line>/
// <Bar> foram declarados), então passar `payload` pronto pra <Legend> não é
// suficiente pra fixar a ordem — só renderizando o conteúdo manualmente.
function ChartLegend() {
  return (
    <ul className="flex items-center justify-center gap-4 pt-2 m-0 list-none">
      {['receita', 'despesa', 'lucro'].map((key) => (
        <li key={key} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[key] }} />
          {SERIES_LABELS[key]}
        </li>
      ))}
    </ul>
  );
}

export default function TransportDashboard() {
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [granularity, setGranularity] = useState('month');
  const [chartType, setChartType] = useState('line');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState([]);
  const [vehicleFilterOpen, setVehicleFilterOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!hasLoadedRef.current) setLoading(true);
      try {
        // dados completos (no_page=1): os totais e o gráfico precisam refletir tudo,
        // não só a primeira página
        const [vehiclesData, tripsData, revenuesData, expensesData] = await Promise.all([
          transportService.getVehicles({ no_page: '1' }),
          transportService.getTrips({ no_page: '1' }),
          transportService.getRevenues({ no_page: '1' }),
          transportService.getExpenses({ no_page: '1' }),
        ]);

        setVehicles(vehiclesData.results || vehiclesData || []);
        setTrips(tripsData.results || tripsData || []);
        setRevenues(revenuesData.results || revenuesData || []);
        setExpenses(expensesData.results || expensesData || []);
      } catch (err) {
        console.error('Erro ao carregar painel de transportes', err);
        toast('Erro ao carregar painel da transportadora', 'error');
      } finally {
        setLoading(false);
        hasLoadedRef.current = true;
      }
    };
    load();
  }, []);

  // ── KPIs globais (mesma conta de sempre: viagens recebidas + lançamentos avulsos) ──
  const { vehiclesCount, tripsCount, revenuesTotal, expensesTotal, netProfit } = useMemo(() => {
    const revTotalManual = revenues.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const expTotalManual = expenses.reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const revTotalTrips = trips.reduce((acc, item) => acc + (item.is_received ? Number(item.total_value || 0) : 0), 0);
    const expTotalTrips = trips.reduce((acc, item) => acc + Number(item.expense_value || 0), 0);
    const revTotal = revTotalManual + revTotalTrips;
    const expTotal = expTotalManual + expTotalTrips;
    return {
      vehiclesCount: vehicles.length,
      tripsCount: trips.length,
      revenuesTotal: revTotal,
      expensesTotal: expTotal,
      netProfit: revTotal - expTotal,
    };
  }, [vehicles, trips, revenues, expenses]);

  // ── Lançamentos financeiros normalizados (viagem + receita/despesa avulsa) ──
  // Mesma fonte de dados dos KPIs acima, só que com data e veículo anexados pra
  // poder agrupar por período e filtrar por veículo no gráfico.
  const financialEntries = useMemo(() => {
    const list = [];
    trips.forEach((t) => {
      const dateStr = t.end_date || t.start_date || t.date;
      if (!dateStr) return;
      if (t.is_received) list.push({ date: dateStr, vehicle: t.vehicle, amount: Number(t.total_value || 0), type: 'revenue' });
      list.push({ date: dateStr, vehicle: t.vehicle, amount: Number(t.expense_value || 0), type: 'expense' });
    });
    revenues.forEach((r) => {
      if (!r.date) return;
      list.push({ date: r.date, vehicle: r.vehicle, amount: Number(r.amount || 0), type: 'revenue' });
    });
    expenses.forEach((e) => {
      if (!e.date) return;
      list.push({ date: e.date, vehicle: e.vehicle, amount: Number(e.amount || 0), type: 'expense' });
    });
    return list;
  }, [trips, revenues, expenses]);

  const chartData = useMemo(() => {
    const cfg = GRANULARITY_CONFIG[granularity];
    const filtered = selectedVehicleIds.length === 0
      ? financialEntries
      : financialEntries.filter((e) => selectedVehicleIds.includes(String(e.vehicle)));

    const buckets = new Map();
    filtered.forEach((entry) => {
      const d = new Date(`${entry.date}T00:00:00`);
      if (Number.isNaN(d.getTime())) return;
      const bucketDate = cfg.bucketStart(d);
      const key = bucketDate.toISOString().slice(0, 10);
      if (!buckets.has(key)) {
        buckets.set(key, { key, sortKey: bucketDate.getTime(), label: cfg.label(bucketDate), receita: 0, despesa: 0 });
      }
      const bucket = buckets.get(key);
      if (entry.type === 'revenue') bucket.receita += entry.amount;
      else bucket.despesa += entry.amount;
    });

    return Array.from(buckets.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(-cfg.windowSize)
      .map((b) => ({ ...b, lucro: b.receita - b.despesa }));
  }, [financialEntries, granularity, selectedVehicleIds]);

  const recentTrips = useMemo(() => {
    return [...trips]
      .sort((a, b) => {
        const da = a.end_date || a.start_date || a.date || '';
        const db = b.end_date || b.start_date || b.date || '';
        return db.localeCompare(da);
      })
      .slice(0, 8);
  }, [trips]);

  const toggleVehicle = (id) => {
    setSelectedVehicleIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const vehicleFilterLabel = useMemo(() => {
    if (selectedVehicleIds.length === 0) return 'Todos os veículos';
    if (selectedVehicleIds.length === 1) {
      const v = vehicles.find((x) => String(x.id) === selectedVehicleIds[0]);
      return v?.plate || '1 veículo';
    }
    return `${selectedVehicleIds.length} veículos`;
  }, [selectedVehicleIds, vehicles]);

  if (loading) return <LoadingOverlay message="Carregando painel..." />;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Painel</h1>
          <p className="mt-1 text-gray-600">Visão geral operacional e financeira.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/transportadora/veiculos" className="btn btn-secondary">Ver Veículos</Link>
          <Link to="/transportadora/viagens" className="btn btn-secondary">Gerenciar Viagens</Link>
          <Link to="/transportadora/relatorios" className="btn btn-secondary">Relatórios</Link>
          <Link to="/transportadora/viagens/nova" className="btn btn-primary">+ Nova Viagem</Link>
        </div>
      </div>

      {/* Faixa fina de indicadores — os mesmos de sempre, sem cards grandes */}
      <div className="card mt-4 p-4 flex flex-wrap items-center">
        <div className="pr-5"><div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Veículos</div><div className="text-lg font-bold text-gray-900 mt-0.5">{vehiclesCount}</div></div>
        <div className="px-5 border-l border-gray-100"><div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Viagens</div><div className="text-lg font-bold text-gray-900 mt-0.5">{tripsCount}</div></div>
        <div className="px-5 border-l border-gray-100"><div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Receitas</div><div className="text-lg font-bold text-green-600 mt-0.5">{formatBRL(revenuesTotal)}</div></div>
        <div className="px-5 border-l border-gray-100"><div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Despesas</div><div className="text-lg font-bold text-red-700 mt-0.5">{formatBRL(expensesTotal)}</div></div>
        <div className="px-5 border-l border-gray-100"><div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lucro líquido</div><div className={`text-lg font-bold mt-0.5 ${netProfit >= 0 ? 'text-blue-600' : 'text-red-700'}`}>{formatBRL(netProfit)}</div></div>
      </div>

      {/* Gráfico de evolução financeira */}
      <div className="card p-5 mt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <div>
            <div className="text-sm font-bold text-gray-900">Evolução financeira</div>
            <div className="text-xs text-gray-500 mt-0.5">Receita, despesa e lucro por {granularity === 'week' ? 'semana' : granularity === 'month' ? 'mês' : 'trimestre'}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white hover:bg-gray-50"
                onClick={() => setVehicleFilterOpen((o) => !o)}
              >
                <TruckIcon className="h-3.5 w-3.5 text-gray-400" />
                {vehicleFilterLabel}
                <ChevronDownIcon className={`h-3 w-3 text-gray-400 transition-transform ${vehicleFilterOpen ? 'rotate-180' : ''}`} />
              </button>
              {vehicleFilterOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setVehicleFilterOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 w-64 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 max-h-72 overflow-y-auto">
                    <label className="flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedVehicleIds.length === 0} onChange={() => setSelectedVehicleIds([])} />
                      <span className="font-medium">Todos os veículos</span>
                    </label>
                    <div className="border-t border-gray-100 my-1" />
                    {vehicles.map((v) => (
                      <label key={v.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-md hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={selectedVehicleIds.includes(String(v.id))} onChange={() => toggleVehicle(String(v.id))} />
                        <span>{v.plate} — {v.model}</span>
                      </label>
                    ))}
                    {vehicles.length === 0 && <div className="px-2.5 py-2 text-sm text-gray-500">Nenhum veículo cadastrado.</div>}
                  </div>
                </>
              )}
            </div>

            <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
              {GRANULARITY_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setGranularity(opt.key)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${granularity === opt.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="inline-flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
              <button
                type="button"
                aria-label="Gráfico de linhas"
                onClick={() => setChartType('line')}
                className={`h-7 w-8 flex items-center justify-center rounded-md transition-colors ${chartType === 'line' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <LineChartIcon />
              </button>
              <button
                type="button"
                aria-label="Gráfico de barras"
                onClick={() => setChartType('bar')}
                className={`h-7 w-8 flex items-center justify-center rounded-md transition-colors ${chartType === 'bar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <BarChartIcon />
              </button>
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-gray-400">
            <svg className="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            <p className="text-sm">Nenhum lançamento financeiro no período para os veículos selecionados.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            {chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef1f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={{ stroke: '#eef1f6' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#98a2b3' }} tickFormatter={formatCompactBRL} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<ChartTooltip />} />
                <Legend content={<ChartLegend />} />
                <Line type="monotone" dataKey="receita" stroke={COLORS.receita} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="despesa" stroke={COLORS.despesa} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="lucro" stroke={COLORS.lucro} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} barGap={3}>
                <CartesianGrid vertical={false} stroke="#eef1f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={{ stroke: '#eef1f6' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#98a2b3' }} tickFormatter={formatCompactBRL} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Legend content={<ChartLegend />} />
                <Bar dataKey="receita" fill={COLORS.receita} radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="despesa" fill={COLORS.despesa} radius={[4, 4, 0, 0]} maxBarSize={26} />
                <Bar dataKey="lucro" fill={COLORS.lucro} radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Viagens recentes — carrossel de cards compactos */}
      <div className="mt-5">
        <h2 className="text-sm font-bold text-gray-900 mb-2">Viagens recentes</h2>
        {recentTrips.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma viagem cadastrada.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recentTrips.map((trip) => (
              <Link
                key={trip.id}
                to={`/transportadora/viagens?trip=${trip.id}`}
                className="shrink-0 text-left w-44 p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm text-gray-900 truncate">{trip.vehicle_plate || '—'}</span>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${trip.status === 'in_progress' ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
                <div className="text-xs text-gray-500 mb-2">{formatApiDate(trip.end_date || trip.start_date || trip.date, '')}</div>
                <div className="text-sm font-bold text-gray-900">{formatBRL(trip.total_value)}</div>
                <span className={`inline-block mt-1.5 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${trip.status === 'in_progress' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {trip.status === 'in_progress' ? 'Em curso' : 'Concluída'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
