import React, { useEffect, useState } from 'react';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';
import LoadingOverlay from '../components/LoadingOverlay';

const TYPE_COLORS = {
  emergency: 'bg-red-100 text-red-700',
  palliative: 'bg-orange-100 text-orange-700',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const parts = String(dateStr).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
};

const parseDatetimeToISO = (str) => {
  // Aceita dd/mm/aaaa HH:MM → YYYY-MM-DDTHH:MM:00
  if (!str) return null;
  const [datePart, timePart] = str.split(' ');
  if (!datePart) return null;
  const [d, m, y] = datePart.split('/');
  if (!y) return str;
  const time = timePart || '00:00';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${time}:00`;
};

const datetimeToDisplay = (isoStr) => {
  if (!isoStr) return '';
  const dt = new Date(isoStr);
  if (isNaN(dt)) return isoStr;
  const d = String(dt.getDate()).padStart(2, '0');
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const y = dt.getFullYear();
  const h = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return `${d}/${mo}/${y} ${h}:${mi}`;
};

const EMPTY_FORM = {
  vehicle: '',
  type: 'emergency',
  description: '',
  occurred_date: '',
  occurred_time: '',
  repaired_date: '',
  repaired_time: '',
  repair_cost: '',
  supplier: '',
  notes: '',
};

export default function TransportMaintenanceCorrective() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterVehicle) params.vehicle = filterVehicle;
      if (filterType) params.type = filterType;
      const [itemsData, vehiclesData] = await Promise.all([
        transportService.getCorrectiveMaintenances({ ...params, no_page: '1' }),
        transportService.getVehicles({ no_page: '1' }),
      ]);
      setItems(itemsData.results || itemsData || []);
      setVehicles(vehiclesData.results || vehiclesData || []);
    } catch {
      toast('Erro ao carregar manutenções corretivas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterVehicle, filterType]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item.id);
    const occ = item.occurred_at ? datetimeToDisplay(item.occurred_at) : '';
    const rep = item.repaired_at ? datetimeToDisplay(item.repaired_at) : '';
    const [occDate, occTime] = occ ? occ.split(' ') : ['', ''];
    const [repDate, repTime] = rep ? rep.split(' ') : ['', ''];
    setForm({
      vehicle: String(item.vehicle),
      type: item.type,
      description: item.description,
      occurred_date: occDate || '',
      occurred_time: occTime || '',
      repaired_date: repDate || '',
      repaired_time: repTime || '',
      repair_cost: item.repair_cost ?? '',
      supplier: item.supplier || '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const maskDate = (v) => {
    const digits = String(v || '').replace(/\D/g, '').slice(0,8);
    const d = digits.slice(0,2);
    const m = digits.slice(2,4);
    const y = digits.slice(4,8);
    let out = d;
    if (m) out += '/' + m;
    if (y) out += '/' + y;
    return out;
  };

  const maskTime = (v) => {
    const digits = String(v || '').replace(/\D/g, '').slice(0,4);
    const h = digits.slice(0,2);
    const mi = digits.slice(2,4);
    let out = h;
    if (mi) out += ':' + mi;
    return out;
  };

  const handleSave = async () => {
    if (!form.vehicle || !form.description || !form.occurred_date) {
      toast('Preencha veículo, descrição e data de ocorrência', 'error');
      return;
    }
    setSaving(true);
    try {
      const occurredRaw = `${form.occurred_date}${form.occurred_time ? ' ' + form.occurred_time : ''}`.trim();
      const repairedRaw = form.repaired_date ? `${form.repaired_date}${form.repaired_time ? ' ' + form.repaired_time : ''}`.trim() : '';
      const payload = {
        vehicle: Number(form.vehicle),
        type: form.type,
        description: form.description,
        occurred_at: parseDatetimeToISO(occurredRaw),
        repaired_at: repairedRaw ? parseDatetimeToISO(repairedRaw) : null,
        repair_cost: form.repair_cost !== '' ? form.repair_cost : '0',
        supplier: form.supplier,
        notes: form.notes,
      };
      if (editing) {
        await transportService.updateCorrectiveMaintenance(editing, payload);
        toast('Corretiva atualizada', 'success');
      } else {
        await transportService.createCorrectiveMaintenance(payload);
        toast('Corretiva registrada', 'success');
      }
      setShowModal(false);
      load();
    } catch {
      toast('Erro ao salvar corretiva', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir esta manutenção corretiva?')) return;
    try {
      await transportService.deleteCorrectiveMaintenance(id);
      toast('Registro excluído', 'success');
      load();
    } catch {
      toast('Erro ao excluir', 'error');
    }
  };

  if (loading) return <LoadingOverlay message="Carregando manutenções corretivas..." />;

  const totalCost = items.reduce((acc, i) => acc + Number(i.repair_cost || 0), 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Manutenção Corretiva</h1>
      <p className="mt-1 text-gray-500">Registro de falhas e reparos. Monitore MTTR e custo não planejado.</p>

      {items.length > 0 && (
        <div className="mt-4 p-3 border rounded bg-red-50 text-sm text-red-700 font-medium">
          Custo total no período filtrado: {totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <select className="border rounded px-3 py-1.5 text-sm" value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
          <option value="">Todos os veículos</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
        </select>
        <select className="border rounded px-3 py-1.5 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="emergency">Emergencial</option>
          <option value="palliative">Paliativa</option>
        </select>
        <button className="btn btn-primary btn-sm ml-auto" onClick={openNew}>+ Registrar Corretiva</button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {items.length === 0 ? (
          <div className="p-4 border rounded text-gray-500">Nenhuma manutenção corretiva registrada.</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 border-b font-medium">Veículo</th>
                <th className="px-3 py-2 border-b font-medium">Tipo</th>
                <th className="px-3 py-2 border-b font-medium">Descrição</th>
                <th className="px-3 py-2 border-b font-medium">Ocorrência</th>
                <th className="px-3 py-2 border-b font-medium">Reparo</th>
                <th className="px-3 py-2 border-b font-medium">Downtime</th>
                <th className="px-3 py-2 border-b font-medium">Custo</th>
                <th className="px-3 py-2 border-b font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border-b font-mono font-semibold">{item.vehicle_plate}</td>
                  <td className="px-3 py-2 border-b">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[item.type] || ''}`}>
                      {item.type_display}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-b max-w-xs truncate">{item.description}</td>
                  <td className="px-3 py-2 border-b whitespace-nowrap">{formatDate(item.occurred_at)}</td>
                  <td className="px-3 py-2 border-b whitespace-nowrap">{item.repaired_at ? formatDate(item.repaired_at) : '—'}</td>
                  <td className="px-3 py-2 border-b whitespace-nowrap">{item.downtime_hours != null ? `${item.downtime_hours}h` : '—'}</td>
                  <td className="px-3 py-2 border-b whitespace-nowrap">{Number(item.repair_cost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">{editing ? 'Editar Corretiva' : 'Registrar Manutenção Corretiva'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Veículo *</label>
                <select className="border rounded w-full px-3 py-2 text-sm" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })}>
                  <option value="">Selecione...</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select className="border rounded w-full px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="emergency">Emergencial</option>
                  <option value="palliative">Paliativa</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Descrição da falha *</label>
              <textarea rows={3} className="border rounded w-full px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Data ocorrência *</label>
                <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.occurred_date} onChange={(e) => setForm({ ...form, occurred_date: maskDate(e.target.value) })} placeholder="dd/mm/aaaa" />
                <label className="block text-sm font-medium mb-1 mt-2">Hora</label>
                <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.occurred_time} onChange={(e) => setForm({ ...form, occurred_time: maskTime(e.target.value) })} placeholder="HH:MM" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data reparo</label>
                <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.repaired_date} onChange={(e) => setForm({ ...form, repaired_date: maskDate(e.target.value) })} placeholder="dd/mm/aaaa" />
                <label className="block text-sm font-medium mb-1 mt-2">Hora</label>
                <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.repaired_time} onChange={(e) => setForm({ ...form, repaired_time: maskTime(e.target.value) })} placeholder="HH:MM" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Custo do reparo (R$)</label>
                <input type="number" step="0.01" className="border rounded w-full px-3 py-2 text-sm" value={form.repair_cost} onChange={(e) => setForm({ ...form, repair_cost: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Oficina / Fornecedor</label>
                <input type="text" className="border rounded w-full px-3 py-2 text-sm" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
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
