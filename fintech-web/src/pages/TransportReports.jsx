import React, { useEffect, useState, useCallback } from 'react';
import { reportsService } from '../services/reports';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';

// ─── Configuração por tipo de relatório ───────────────────────────────────────

const REPORT_TYPES = [
  { key: 'movements', label: 'Lançamentos (Gastos/Receitas)' },
  { key: 'trips', label: 'Viagens Detalhadas' },
  { key: 'driver_payments', label: 'Pagamentos ao Motorista' },
  { key: 'by_vehicle', label: 'Resumo por Veículo' },
  { key: 'summary', label: 'Resumo por Categoria' },
];

const COLUMNS = {
  movements: [
    { key: 'date', label: 'Data' },
    { key: 'vehicle', label: 'Veículo' },
    { key: 'movement_type_label', label: 'Tipo' },
    { key: 'expense_category_label', label: 'Categoria' },
    { key: 'amount', label: 'Valor (R$)', align: 'right', currency: true },
    { key: 'description', label: 'Descrição' },
  ],
  trips: [
    { key: 'plate', label: 'Placa' },
    { key: 'start_date', label: 'Início' },
    { key: 'end_date', label: 'Fim' },
    { key: 'modality_label', label: 'Modalidade' },
    { key: 'status_label', label: 'Status' },
    { key: 'total_value', label: 'Bruto (R$)', align: 'right', currency: true },
    { key: 'expense_value', label: 'Despesas (R$)', align: 'right', currency: true },
    { key: 'driver_payment', label: 'Motorista (R$)', align: 'right', currency: true },
    { key: 'net_value', label: 'Líquido (R$)', align: 'right', currency: true },
    { key: 'description', label: 'Descrição' },
  ],
  driver_payments: [
    { key: 'plate', label: 'Placa' },
    { key: 'start_date', label: 'Início' },
    { key: 'end_date', label: 'Fim' },
    { key: 'status_label', label: 'Status' },
    { key: 'total_value', label: 'Valor Viagem (R$)', align: 'right', currency: true },
    { key: 'driver_payment', label: 'Pagamento Motorista (R$)', align: 'right', currency: true },
    { key: 'description', label: 'Descrição' },
  ],
  by_vehicle: [
    { key: 'vehicle', label: 'Veículo' },
    { key: 'trip_count', label: 'Viagens', align: 'right' },
    { key: 'total_value', label: 'Bruto (R$)', align: 'right', currency: true },
    { key: 'expense_value', label: 'Despesas (R$)', align: 'right', currency: true },
    { key: 'driver_payment', label: 'Motorista (R$)', align: 'right', currency: true },
    { key: 'net_value', label: 'Líquido (R$)', align: 'right', currency: true },
  ],
  summary: [
    { key: 'expense_category_label', label: 'Categoria' },
    { key: 'count', label: 'Lançamentos', align: 'right' },
    { key: 'total', label: 'Total (R$)', align: 'right', currency: true },
  ],
};

const ORDER_BY_OPTIONS = {
  movements: [
    { value: 'date', label: 'Data' },
    { value: 'amount', label: 'Valor' },
    { value: 'movement_type', label: 'Tipo' },
    { value: 'expense_category', label: 'Categoria' },
  ],
  trips: [
    { value: 'start_date', label: 'Data Início' },
    { value: 'end_date', label: 'Data Fim' },
    { value: 'total_value', label: 'Valor Total' },
    { value: 'expense_value', label: 'Despesas' },
    { value: 'driver_payment', label: 'Motorista' },
  ],
  driver_payments: [
    { value: 'start_date', label: 'Data Início' },
    { value: 'driver_payment', label: 'Pagamento Motorista' },
  ],
  by_vehicle: [],
  summary: [],
};

// ─── Tradução dos rótulos dos agregados ───────────────────────────────────────

const AGGREGATE_LABELS = {
  total_expense: 'Total Despesas',
  total_revenue: 'Total Receitas',
  balance: 'Saldo',
  total_value: 'Valor Bruto',
  total_driver: 'Total Motorista',
  total_net: 'Líquido',
  total_driver_payments: 'Total Pagamentos ao Motorista',
  grand_total_value: 'Valor Bruto Total',
  grand_expense_value: 'Despesas Total',
  grand_net_value: 'Líquido Total',
  grand_total: 'Total Geral',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatBRL = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (val) => {
  if (!val) return '—';
  const [y, m, d] = val.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return val;
};

const MOVEMENT_TYPE_COLORS = {
  expense: 'text-red-700',
  revenue: 'text-green-700',
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TransportReports() {
  const [reportType, setReportType] = useState('movements');
  const [vehicles, setVehicles] = useState([]);
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    vehicle_id: '',
    category: '',
    movement_type: '',
    status: '',
    modality: '',
    order_by: 'date',
    order_dir: 'desc',
  });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Carregar lista de veículos para o filtro
  useEffect(() => {
    transportService.getVehicles({ no_page: '1' })
      .then((data) => setVehicles(data.results || data || []))
      .catch(() => {});
  }, []);

  // Resetar order_by ao trocar tipo (evitar campo inválido no backend)
  useEffect(() => {
    const opts = ORDER_BY_OPTIONS[reportType] || [];
    const defaultOb = opts[0]?.value || 'date';
    setFilters((prev) => ({ ...prev, order_by: defaultOb }));
    setRows([]);
    setMeta(null);
    setSearched(false);
  }, [reportType]);

  const handleFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const buildParams = useCallback(() => {
    const p = { report_type: reportType };
    if (filters.start_date) p.start_date = filters.start_date;
    if (filters.end_date) p.end_date = filters.end_date;
    if (filters.vehicle_id) p.vehicle_id = filters.vehicle_id;
    if (filters.category) p.category = filters.category;
    if (filters.movement_type) p.movement_type = filters.movement_type;
    if (filters.status) p.status = filters.status;
    if (filters.modality) p.modality = filters.modality;
    if (filters.order_by) p.order_by = filters.order_by;
    if (filters.order_dir) p.order_dir = filters.order_dir;
    return p;
  }, [reportType, filters]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const data = await reportsService.fetchTransportReport(buildParams());
      setRows(data.rows || []);
      setMeta(data.meta || null);
      setSearched(true);
    } catch (err) {
      console.error(err);
      toast('Erro ao buscar relatório', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    if (!searched || rows.length === 0) {
      toast('Pesquise primeiro para exportar.', 'warning');
      return;
    }
    try {
      await reportsService.downloadTransportReportCsv(
        buildParams(),
        `relatorio_transporte_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      toast('CSV exportado com sucesso.', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao exportar CSV.', 'error');
    }
  };

  const handleExportPdf = async () => {
    if (!searched || rows.length === 0) {
      toast('Pesquise primeiro para exportar.', 'warning');
      return;
    }
    try {
      await reportsService.downloadTransportReportPdf(
        buildParams(),
        `relatorio_transporte_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`
      );
      toast('PDF exportado com sucesso.', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao exportar PDF.', 'error');
    }
  };

  const columns = COLUMNS[reportType] || [];
  const orderOptions = ORDER_BY_OPTIONS[reportType] || [];
  const showMovementTypeFilter = reportType === 'movements';
  const showCategoryFilter = reportType === 'movements' || reportType === 'summary';
  const showStatusFilter = reportType === 'trips' || reportType === 'driver_payments';
  const showModalityFilter = reportType === 'trips';
  const showVehicleFilter = ['movements', 'trips', 'driver_payments', 'summary'].includes(reportType);
  const showOrderBy = orderOptions.length > 0;

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Relatórios · Transportadora</h1>
          <p className="text-sm text-gray-500 mt-1">Filtre e visualize os dados diretamente na tela. Exporte para CSV ou PDF quando necessário.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={handleExportCsv}
            disabled={!searched || rows.length === 0}
          >
            Exportar CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExportPdf}
            disabled={!searched || rows.length === 0}
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* Seletor de tipo de relatório */}
      <div className="flex flex-wrap gap-2 mb-4">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.key}
            onClick={() => setReportType(rt.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              reportType === rt.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {rt.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Período */}
          <div>
            <label className="block text-xs text-gray-600 mb-1">Data início</label>
            <input
              type="date"
              className="input-field w-full"
              value={filters.start_date}
              onChange={(e) => handleFilter('start_date', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Data fim</label>
            <input
              type="date"
              className="input-field w-full"
              value={filters.end_date}
              onChange={(e) => handleFilter('end_date', e.target.value)}
            />
          </div>

          {/* Veículo */}
          {showVehicleFilter && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Veículo</label>
              <select
                className="input-field w-full"
                value={filters.vehicle_id}
                onChange={(e) => handleFilter('vehicle_id', e.target.value)}
              >
                <option value="">Todos</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tipo de movimento */}
          {showMovementTypeFilter && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tipo de lançamento</label>
              <select
                className="input-field w-full"
                value={filters.movement_type}
                onChange={(e) => handleFilter('movement_type', e.target.value)}
              >
                <option value="">Todos</option>
                <option value="expense">Gasto</option>
                <option value="revenue">Receita</option>
              </select>
            </div>
          )}

          {/* Categoria */}
          {showCategoryFilter && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Categoria de despesa</label>
              <select
                className="input-field w-full"
                value={filters.category}
                onChange={(e) => handleFilter('category', e.target.value)}
              >
                <option value="">Todas</option>
                <option value="fuel">Combustível</option>
                <option value="other">Outros gastos</option>
              </select>
            </div>
          )}

          {/* Status */}
          {showStatusFilter && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Status da viagem</label>
              <select
                className="input-field w-full"
                value={filters.status}
                onChange={(e) => handleFilter('status', e.target.value)}
              >
                <option value="">Todos</option>
                <option value="in_progress">Em curso</option>
                <option value="completed">Encerrada</option>
              </select>
            </div>
          )}

          {/* Modalidade */}
          {showModalityFilter && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Modalidade</label>
              <select
                className="input-field w-full"
                value={filters.modality}
                onChange={(e) => handleFilter('modality', e.target.value)}
              >
                <option value="">Todas</option>
                <option value="per_ton">Por Tonelada</option>
                <option value="lease">Arrendamento</option>
              </select>
            </div>
          )}

          {/* Ordenação */}
          {showOrderBy && (
            <>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Ordenar por</label>
                <select
                  className="input-field w-full"
                  value={filters.order_by}
                  onChange={(e) => handleFilter('order_by', e.target.value)}
                >
                  {orderOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Direção</label>
                <select
                  className="input-field w-full"
                  value={filters.order_dir}
                  onChange={(e) => handleFilter('order_dir', e.target.value)}
                >
                  <option value="desc">Decrescente</option>
                  <option value="asc">Crescente</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            className="btn btn-primary min-w-[120px]"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Buscando…
              </span>
            ) : 'Pesquisar'}
          </button>
        </div>
      </div>

      {/* Agregados */}
      {searched && meta?.aggregates && (
        <div className="flex flex-wrap gap-3 mb-4">
          {Object.entries(meta.aggregates).map(([key, val]) => {
            const label = AGGREGATE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b(\w)/g, (c) => c.toUpperCase());
            const isValue = !isNaN(val) && val !== '';
            return (
              <div key={key} className="px-4 py-2 bg-white border rounded shadow-sm text-center min-w-[130px]">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-base font-semibold text-gray-800">
                  {isValue ? formatBRL(val) : val}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabela de resultados */}
      {searched && (
        <div className="bg-white rounded border shadow-sm overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Nenhum resultado encontrado para os filtros selecionados.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
                <span className="text-xs text-gray-500">{rows.length} {rows.length === 1 ? 'registro' : 'registros'}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          className={`px-4 py-2 font-medium text-gray-600 whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        {columns.map((col) => {
                          let value = row[col.key];
                          let className = `px-4 py-2 whitespace-nowrap ${col.align === 'right' ? 'text-right' : ''}`;

                          if (col.currency) {
                            value = formatBRL(value);
                            // Colorir valores negativos
                            const num = Number(row[col.key]);
                            if (num < 0) className += ' text-red-600';
                          } else if (col.key === 'date' || col.key === 'start_date' || col.key === 'end_date') {
                            value = formatDate(value);
                          } else if (col.key === 'movement_type_label') {
                            const typeClass = MOVEMENT_TYPE_COLORS[row.movement_type] || '';
                            className += ` font-medium ${typeClass}`;
                          }

                          if (value === null || value === undefined || value === '') value = '—';

                          return (
                            <td key={col.key} className={className}>
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {!searched && !loading && (
        <div className="mt-8 flex flex-col items-center text-gray-400">
          <svg className="w-12 h-12 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">Selecione o tipo de relatório e clique em <span className="font-medium">Pesquisar</span>.</p>
        </div>
      )}
    </div>
  );
}
