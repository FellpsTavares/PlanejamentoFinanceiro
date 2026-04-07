import React, { useEffect, useState } from 'react';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';
import ConfirmModal from '../components/ConfirmModal';

const EMPTY_FORM = {
  name: '',
  start_date: '',
  end_date: '',
  age: '',
  is_owner: false,
};

function formatDate(val) {
  if (!val) return '—';
  const [y, m, d] = val.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return val;
}

export default function TransportDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await transportService.getDrivers({ no_page: 1 });
      setDrivers(data.results || data || []);
    } catch (err) {
      console.error(err);
      toast('Erro ao carregar motoristas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (driver) => {
    setEditingId(driver.id);
    setForm({
      name: driver.name || '',
      start_date: driver.start_date || '',
      end_date: driver.end_date || '',
      age: driver.age != null ? String(driver.age) : '',
      is_owner: Boolean(driver.is_owner),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast('Informe o nome do motorista', 'error'); return; }
    if (!form.start_date) { toast('Informe a data de início', 'error'); return; }

    const payload = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date || null,
      age: form.age !== '' ? parseInt(form.age, 10) : null,
      is_owner: form.is_owner,
    };

    setSaving(true);
    try {
      if (editingId) {
        await transportService.updateDriver(editingId, payload);
        toast('Motorista atualizado', 'success');
      } else {
        await transportService.createDriver(payload);
        toast('Motorista cadastrado', 'success');
      }
      closeModal();
      load();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data;
      toast(typeof msg === 'string' ? msg : msg?.detail || JSON.stringify(msg) || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await transportService.deleteDriver(deleteTarget.id);
      toast('Motorista excluído', 'success');
      setDeleteTarget(null);
      load();
    } catch (err) {
      console.error(err);
      toast('Erro ao excluir motorista', 'error');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Motoristas</h1>
        <button onClick={openNew} className="btn btn-primary">+ Novo Motorista</button>
      </div>

      {loading ? (
        <div className="text-gray-500">Carregando...</div>
      ) : drivers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
          Nenhum motorista cadastrado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Início</th>
                <th className="px-4 py-3 text-left font-medium">Saída</th>
                <th className="px-4 py-3 text-left font-medium">Idade</th>
                <th className="px-4 py-3 text-left font-medium">Dono?</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drivers.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{d.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(d.start_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(d.end_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{d.age ?? '—'}</td>
                  <td className="px-4 py-3">
                    {d.is_owner ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Sim</span>
                    ) : (
                      <span className="text-gray-400">Não</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {d.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Ativo</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(d)} className="text-blue-600 hover:underline text-sm">Editar</button>
                      <button onClick={() => setDeleteTarget(d)} className="text-red-500 hover:underline text-sm">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de criação/edição */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">{editingId ? 'Editar Motorista' : 'Novo Motorista'}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="Nome completo"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de início *</label>
                  <input
                    name="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={handleChange}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de saída</label>
                  <input
                    name="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={handleChange}
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Idade</label>
                <input
                  name="age"
                  type="number"
                  min="16"
                  max="99"
                  value={form.age}
                  onChange={handleChange}
                  className="input w-full"
                  placeholder="Opcional"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="is_owner"
                  checked={form.is_owner}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span>É o proprietário do veículo (sem pagamento de motorista)</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Excluir motorista"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
