import React, { useEffect, useState } from 'react';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';
import LoadingOverlay from '../components/LoadingOverlay';

const COMPONENT_OPTIONS = [
  { value: 'engine', label: 'Motor' },
  { value: 'cooling', label: 'Arrefecimento' },
  { value: 'transmission', label: 'Transmissão' },
  { value: 'lubrication', label: 'Lubrificação' },
];

const INTERVENTION_OPTIONS = [
  { value: 'oil_change', label: 'Troca de Óleo' },
  { value: 'oil_filter', label: 'Filtro de Óleo' },
  { value: 'fuel_filter', label: 'Filtro de Combustível' },
  { value: 'air_filter', label: 'Filtro de Ar' },
  { value: 'belts', label: 'Correias' },
  { value: 'radiator_clean', label: 'Limpeza do Radiador' },
  { value: 'coolant', label: 'Troca de Líquido de Arrefecimento' },
  { value: 'gearbox_oil', label: 'Óleo da Caixa de Câmbio' },
  { value: 'differential_oil', label: 'Óleo do Diferencial' },
  { value: 'fifth_wheel', label: 'Quinta Roda' },
  { value: 'king_pin', label: 'Pino Mestre' },
  { value: 'joints', label: 'Articulações' },
];

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
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
  component_type: 'engine',
  intervention_type: 'oil_change',
  trigger: 'both',
  trigger_km_interval: '',
  trigger_date_interval: '',
  last_done_km: '',
  last_done_date: '',
  next_due_km: '',
  next_due_date: '',
  status: 'pending',
  notes: '',
};

export default function TransportMaintenancePreventive() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterVehicle) params.vehicle = filterVehicle;
      if (filterStatus) params.status = filterStatus;
      const [plansData, vehiclesData] = await Promise.all([
        transportService.getPreventivePlans({ ...params, no_page: '1' }),
        transportService.getVehicles({ no_page: '1' }),
      ]);
      setPlans(plansData.results || plansData || []);
      setVehicles(vehiclesData.results || vehiclesData || []);
    } catch {
      toast('Erro ao carregar planos preventivos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterVehicle, filterStatus]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (plan) => {
    setEditing(plan.id);
    setForm({
      vehicle: String(plan.vehicle),
      component_type: plan.component_type,
      intervention_type: plan.intervention_type,
      trigger: plan.trigger,
      trigger_km_interval: plan.trigger_km_interval ?? '',
      trigger_date_interval: plan.trigger_date_interval ?? '',
      last_done_km: plan.last_done_km ?? '',
      last_done_date: plan.last_done_date ? formatDate(plan.last_done_date) : '',
      next_due_km: plan.next_due_km ?? '',
      next_due_date: plan.next_due_date ? formatDate(plan.next_due_date) : '',
      status: plan.status,
      notes: plan.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.vehicle) { toast('Selecione um veículo', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        vehicle: Number(form.vehicle),
        trigger_km_interval: form.trigger_km_interval !== '' ? Number(form.trigger_km_interval) : null,
        trigger_date_interval: form.trigger_date_interval !== '' ? Number(form.trigger_date_interval) : null,
        last_done_km: form.last_done_km !== '' ? Number(form.last_done_km) : null,
        last_done_date: parseDateToISO(form.last_done_date) || null,
        next_due_km: form.next_due_km !== '' ? Number(form.next_due_km) : null,
        next_due_date: parseDateToISO(form.next_due_date) || null,
      };
      if (editing) {
        await transportService.updatePreventivePlan(editing, payload);
        toast('Plano atualizado', 'success');
      } else {
        await transportService.createPreventivePlan(payload);
        toast('Plano criado', 'success');
      }
      setShowModal(false);
      load();
    } catch {
      toast('Erro ao salvar plano', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este plano preventivo?')) return;
    try {
      await transportService.deletePreventivePlan(id);
      toast('Plano excluído', 'success');
      load();
    } catch {
      toast('Erro ao excluir plano', 'error');
    }
  };

  if (loading) return <LoadingOverlay message="Carregando planos preventivos..." />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Manutenção Preventiva</h1>
      <p className="mt-1 text-gray-500">Intervenções programadas por tempo ou quilometragem.</p>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <select className="border rounded px-3 py-1.5 text-sm" value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
          <option value="">Todos os veículos</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
        </select>
        <select className="border rounded px-3 py-1.5 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="done">Concluído</option>
          <option value="overdue">Vencido</option>
        </select>
        <button className="btn btn-primary btn-sm ml-auto" onClick={openNew}>+ Novo Plano</button>
      </div>

      {/* Tabela */}
      <div className="mt-4 overflow-x-auto">
        {plans.length === 0 ? (
          <div className="p-4 border rounded text-gray-500">Nenhum plano preventivo cadastrado.</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 border-b font-medium">Veículo</th>
                <th className="px-3 py-2 border-b font-medium">Componente</th>
                <th className="px-3 py-2 border-b font-medium">Intervenção</th>
                <th className="px-3 py-2 border-b font-medium">Próx. Vcto. Data</th>
                <th className="px-3 py-2 border-b font-medium">Próx. Vcto. KM</th>
                <th className="px-3 py-2 border-b font-medium">Status</th>
                <th className="px-3 py-2 border-b font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border-b font-mono font-semibold">{plan.vehicle_plate}</td>
                  <td className="px-3 py-2 border-b">{plan.component_type_display}</td>
                  <td className="px-3 py-2 border-b">{plan.intervention_type_display}</td>
                  <td className="px-3 py-2 border-b">{formatDate(plan.next_due_date)}</td>
                  <td className="px-3 py-2 border-b">{plan.next_due_km ? `${plan.next_due_km.toLocaleString('pt-BR')} km` : '—'}</td>
                  <td className="px-3 py-2 border-b">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[plan.status] || ''}`}>
                      {plan.status_display}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-b">
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(plan)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(plan.id)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">{editing ? 'Editar Plano Preventivo' : 'Novo Plano Preventivo'}</h2>

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
                <label className="block text-sm font-medium mb-1">Intervenção</label>
                <select className="border rounded w-full px-3 py-2 text-sm" value={form.intervention_type} onChange={(e) => setForm({ ...form, intervention_type: e.target.value })}>
                  {INTERVENTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Gatilho</label>
                <select className="border rounded w-full px-3 py-2 text-sm" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })}>
                  <option value="km">KM</option>
                  <option value="date">Data</option>
                  <option value="both">KM e Data</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Intervalo KM</label>
                <input type="number" className="border rounded w-full px-3 py-2 text-sm" value={form.trigger_km_interval} onChange={(e) => setForm({ ...form, trigger_km_interval: e.target.value })} placeholder="ex: 10000" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Intervalo (dias)</label>
                <input type="number" className="border rounded w-full px-3 py-2 text-sm" value={form.trigger_date_interval} onChange={(e) => setForm({ ...form, trigger_date_interval: e.target.value })} placeholder="ex: 180" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Última Exec. (data)</label>
                <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.last_done_date} onChange={(e) => setForm({ ...form, last_done_date: e.target.value })} placeholder="dd/mm/aaaa" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Última Exec. (KM)</label>
                <input type="number" className="border rounded w-full px-3 py-2 text-sm" value={form.last_done_km} onChange={(e) => setForm({ ...form, last_done_km: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Próx. Vcto. (data)</label>
                <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} placeholder="dd/mm/aaaa" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Próx. Vcto. (KM)</label>
                <input type="number" className="border rounded w-full px-3 py-2 text-sm" value={form.next_due_km} onChange={(e) => setForm({ ...form, next_due_km: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select className="border rounded w-full px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">Pendente</option>
                <option value="done">Concluído</option>
                <option value="overdue">Vencido</option>
              </select>
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
