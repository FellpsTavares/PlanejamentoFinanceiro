import React, { useEffect, useState } from 'react';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';
import LoadingOverlay from '../components/LoadingOverlay';

const COMPONENT_OPTIONS = [
  { value: 'tires', label: 'Pneus' },
  { value: 'oil_analysis', label: 'Análise de Óleo' },
  { value: 'brakes', label: 'Freios' },
  { value: 'battery', label: 'Bateria' },
];

const ALERT_COLORS = {
  ok: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const parts = String(dateStr).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
};

const parseDateToISO = (str) => {
  if (!str) return '';
  const [d, m, y] = str.split('/');
  if (!y) return str;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const EMPTY_FORM = {
  vehicle: '',
  component_type: 'tires',
  metric_name: '',
  value: '',
  unit: '',
  read_at: '',
  alert_level: 'ok',
  notes: '',
};

export default function TransportMaintenancePredictive() {
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterVehicle) params.vehicle = filterVehicle;
      if (filterLevel) params.alert_level = filterLevel;
      const [readingsData, vehiclesData] = await Promise.all([
        transportService.getPredictiveReadings({ ...params, no_page: '1' }),
        transportService.getVehicles({ no_page: '1' }),
      ]);
      setReadings(readingsData.results || readingsData || []);
      setVehicles(vehiclesData.results || vehiclesData || []);
    } catch {
      toast('Erro ao carregar leituras preditivas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterVehicle, filterLevel]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item.id);
    setForm({
      vehicle: String(item.vehicle),
      component_type: item.component_type,
      metric_name: item.metric_name,
      value: item.value,
      unit: item.unit,
      read_at: item.read_at ? formatDate(item.read_at) : '',
      alert_level: item.alert_level,
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.vehicle || !form.metric_name || !form.value || !form.read_at) {
      toast('Preencha veículo, métrica, valor e data', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        vehicle: Number(form.vehicle),
        value: form.value,
        read_at: parseDateToISO(form.read_at),
      };
      if (editing) {
        await transportService.updatePredictiveReading(editing, payload);
        toast('Leitura atualizada', 'success');
      } else {
        await transportService.createPredictiveReading(payload);
        toast('Leitura registrada', 'success');
      }
      setShowModal(false);
      load();
    } catch {
      toast('Erro ao salvar leitura', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta leitura preditiva?')) return;
    try {
      await transportService.deletePredictiveReading(id);
      toast('Leitura excluída', 'success');
      load();
    } catch {
      toast('Erro ao excluir', 'error');
    }
  };

  if (loading) return <LoadingOverlay message="Carregando leituras preditivas..." />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Manutenção Preditiva</h1>
      <p className="mt-1 text-gray-500">Monitoramento de condição para prever falhas por componente.</p>

      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <select className="border rounded px-3 py-1.5 text-sm" value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
          <option value="">Todos os veículos</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
        </select>
        <select className="border rounded px-3 py-1.5 text-sm" value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)}>
          <option value="">Todos os níveis</option>
          <option value="ok">Normal</option>
          <option value="warning">Atenção</option>
          <option value="critical">Crítico</option>
        </select>
        <button className="btn btn-primary btn-sm ml-auto" onClick={openNew}>+ Nova Leitura</button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {readings.length === 0 ? (
          <div className="p-4 border rounded text-gray-500">Nenhuma leitura preditiva registrada.</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 border-b font-medium">Veículo</th>
                <th className="px-3 py-2 border-b font-medium">Componente</th>
                <th className="px-3 py-2 border-b font-medium">Métrica</th>
                <th className="px-3 py-2 border-b font-medium">Valor</th>
                <th className="px-3 py-2 border-b font-medium">Data</th>
                <th className="px-3 py-2 border-b font-medium">Nível</th>
                <th className="px-3 py-2 border-b font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border-b font-mono font-semibold">{r.vehicle_plate}</td>
                  <td className="px-3 py-2 border-b">{r.component_type_display}</td>
                  <td className="px-3 py-2 border-b">{r.metric_name}</td>
                  <td className="px-3 py-2 border-b">{r.value} {r.unit}</td>
                  <td className="px-3 py-2 border-b">{formatDate(r.read_at)}</td>
                  <td className="px-3 py-2 border-b">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ALERT_COLORS[r.alert_level] || ''}`}>
                      {r.alert_level_display}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-b">
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(r)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">{editing ? 'Editar Leitura Preditiva' : 'Nova Leitura Preditiva'}</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Veículo *</label>
              <select className="border rounded w-full px-3 py-2 text-sm" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })}>
                <option value="">Selecione...</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Componente</label>
                <select className="border rounded w-full px-3 py-2 text-sm" value={form.component_type} onChange={(e) => setForm({ ...form, component_type: e.target.value })}>
                  {COMPONENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nível de Alerta</label>
                <select className="border rounded w-full px-3 py-2 text-sm" value={form.alert_level} onChange={(e) => setForm({ ...form, alert_level: e.target.value })}>
                  <option value="ok">Normal</option>
                  <option value="warning">Atenção</option>
                  <option value="critical">Crítico</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Métrica *</label>
              <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.metric_name} onChange={(e) => setForm({ ...form, metric_name: e.target.value })} placeholder="ex: Sulco do pneu, CCA da bateria..." />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Valor *</label>
                <input type="number" step="0.001" className="border rounded w-full px-3 py-2 text-sm" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Unidade</label>
                <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="mm, PSI, A..." />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Data da Leitura *</label>
              <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.read_at} onChange={(e) => setForm({ ...form, read_at: e.target.value })} placeholder="dd/mm/aaaa" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Observações</label>
              <textarea rows={2} className="border rounded w-full px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
