import React, { useEffect, useState } from 'react';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';
import LoadingOverlay from '../components/LoadingOverlay';

const TYPE_OPTIONS = [
  { value: 'tachograph', label: 'Cronotacógrafo (aferição)' },
  { value: 'lighting', label: 'Iluminação (faróis, setas, freio)' },
  { value: 'extinguisher', label: 'Extintor de Incêndio' },
  { value: 'equipment', label: 'Equipamentos (macaco, triângulo, cintos)' },
];

const STATUS_COLORS = {
  ok: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
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
  checklist_type: 'tachograph',
  checked_at: '',
  next_due_date: '',
  status: 'ok',
  notes: '',
  checked_by: '',
};

export default function TransportMaintenanceChecklist() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
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
      const [itemsData, vehiclesData] = await Promise.all([
        transportService.getSafetyChecklists({ ...params, no_page: '1' }),
        transportService.getVehicles({ no_page: '1' }),
      ]);
      setItems(itemsData.results || itemsData || []);
      setVehicles(vehiclesData.results || vehiclesData || []);
    } catch {
      toast('Erro ao carregar checklists de segurança', 'error');
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

  const openEdit = (item) => {
    setEditing(item.id);
    setForm({
      vehicle: String(item.vehicle),
      checklist_type: item.checklist_type,
      checked_at: item.checked_at ? formatDate(item.checked_at) : '',
      next_due_date: item.next_due_date ? formatDate(item.next_due_date) : '',
      status: item.status,
      notes: item.notes || '',
      checked_by: item.checked_by || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.vehicle || !form.checked_at || !form.next_due_date) {
      toast('Preencha veículo, data de verificação e próximo vencimento', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vehicle: Number(form.vehicle),
        checklist_type: form.checklist_type,
        checked_at: parseDateToISO(form.checked_at),
        next_due_date: parseDateToISO(form.next_due_date),
        status: form.status,
        notes: form.notes,
        checked_by: form.checked_by,
      };
      if (editing) {
        await transportService.updateSafetyChecklist(editing, payload);
        toast('Checklist atualizado', 'success');
      } else {
        await transportService.createSafetyChecklist(payload);
        toast('Checklist registrado', 'success');
      }
      setShowModal(false);
      load();
    } catch {
      toast('Erro ao salvar checklist', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este checklist?')) return;
    try {
      await transportService.deleteSafetyChecklist(id);
      toast('Checklist excluído', 'success');
      load();
    } catch {
      toast('Erro ao excluir', 'error');
    }
  };

  if (loading) return <LoadingOverlay message="Carregando checklists..." />;

  const expiredCount = items.filter((i) => i.status === 'expired').length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Checklist de Segurança</h1>
      <p className="mt-1 text-gray-500">Documentação e equipamentos obrigatórios para circulação legal.</p>

      {expiredCount > 0 && (
        <div className="mt-4 p-3 border border-red-300 rounded bg-red-50 text-sm text-red-700 font-medium">
          ⚠ {expiredCount} item(s) vencido(s) exigem atenção imediata.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <select className="border rounded px-3 py-1.5 text-sm" value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
          <option value="">Todos os veículos</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
        </select>
        <select className="border rounded px-3 py-1.5 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="ok">Em dia</option>
          <option value="pending">Pendente</option>
          <option value="expired">Vencido</option>
        </select>
        <button className="btn btn-primary btn-sm ml-auto" onClick={openNew}>+ Novo Checklist</button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {items.length === 0 ? (
          <div className="p-4 border rounded text-gray-500">Nenhum checklist registrado.</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 border-b font-medium">Veículo</th>
                <th className="px-3 py-2 border-b font-medium">Item</th>
                <th className="px-3 py-2 border-b font-medium">Verificado em</th>
                <th className="px-3 py-2 border-b font-medium">Próximo Vcto.</th>
                <th className="px-3 py-2 border-b font-medium">Verificado por</th>
                <th className="px-3 py-2 border-b font-medium">Status</th>
                <th className="px-3 py-2 border-b font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border-b font-mono font-semibold">{item.vehicle_plate}</td>
                  <td className="px-3 py-2 border-b">{item.checklist_type_display}</td>
                  <td className="px-3 py-2 border-b">{formatDate(item.checked_at)}</td>
                  <td className="px-3 py-2 border-b">{formatDate(item.next_due_date)}</td>
                  <td className="px-3 py-2 border-b">{item.checked_by || '—'}</td>
                  <td className="px-3 py-2 border-b">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status] || ''}`}>
                      {item.status_display}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-b">
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>Excluir</button>
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
            <h2 className="text-lg font-semibold">{editing ? 'Editar Checklist' : 'Novo Checklist de Segurança'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Veículo *</label>
                <select className="border rounded w-full px-3 py-2 text-sm" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })}>
                  <option value="">Selecione...</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Item</label>
                <select className="border rounded w-full px-3 py-2 text-sm" value={form.checklist_type} onChange={(e) => setForm({ ...form, checklist_type: e.target.value })}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Data de verificação *</label>
                <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.checked_at} onChange={(e) => setForm({ ...form, checked_at: e.target.value })} placeholder="dd/mm/aaaa" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Próximo vencimento *</label>
                <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} placeholder="dd/mm/aaaa" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select className="border rounded w-full px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="ok">Em dia</option>
                  <option value="pending">Pendente</option>
                  <option value="expired">Vencido</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Verificado por</label>
                <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.checked_by} onChange={(e) => setForm({ ...form, checked_by: e.target.value })} placeholder="Nome do responsável" />
              </div>
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
