import React, { useEffect, useState } from 'react';
import { transportService } from '../services/transport';
import { Link } from 'react-router-dom';

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded shadow-lg w-full max-w-md p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-600">✕</button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export default function TransportVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // 'entry' | 'exit'
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [form, setForm] = useState({ date: '', amount: '', description: '', category: '' });

  useEffect(() => {
    transportService.getVehicles().then((data) => setVehicles(data.results || data));
  }, []);

  const openModal = (type, vehicle) => {
    setModalType(type);
    setSelectedVehicle(vehicle);
    // default date today in dd/MM/yyyy
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    setForm({ date: `${dd}/${mm}/${yyyy}`, amount: '', description: '', category: '' });
    setModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const parseDateToISO = (dateStr) => {
    // expects dd/MM/yyyy -> returns YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  };

  const handleSubmitModal = (e) => {
    e.preventDefault();
    (async () => {
      try {
        if (modalType === 'entry') {
          const payload = {
            vehicle: selectedVehicle.id,
            date: parseDateToISO(form.date),
            amount: parseFloat(form.amount),
            description: form.description,
            type: 'trip',
          };
          await transportService.createRevenue(payload);
        } else {
          const payload = {
            vehicle: selectedVehicle.id,
            date: parseDateToISO(form.date),
            amount: parseFloat(form.amount),
            category: form.category || 'other',
            description: form.description,
          };
          await transportService.createExpense(payload);
        }
        import('../utils/toast').then(({ toast }) => toast('Registro criado com sucesso.', 'success'));
        setModalOpen(false);
      } catch (err) {
        console.error('Erro ao criar registro', err);
        const msg = err?.response?.data || err.message || 'Erro desconhecido';
        import('../utils/toast').then(({ toast }) => toast(typeof msg === 'string' ? `Erro: ${msg}` : `Erro: ${JSON.stringify(msg)}`, 'error'));
      }
    })();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Veículos</h1>
      <div className="mt-4">
        <div className="flex gap-2">
          <Link to="/transport/vehicles/new" className="btn btn-primary">Cadastrar Veículo</Link>
          <Link to="/transport/trips/new" className="btn btn-secondary">Nova Viagem</Link>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {vehicles.map((v) => (
          <li key={v.id} className="p-4 border rounded">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold">{v.plate} — {v.model}</div>
                <div className="text-sm text-gray-600">Ano: {v.year} • Capacidade: {v.capacity}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button onClick={() => openModal('entry', v)} className="btn btn-sm bg-green-100 text-green-700 border-green-200 hover:bg-green-200">Entrada</button>
                <button onClick={() => openModal('exit', v)} className="btn btn-sm btn-danger">Saída</button>
                <Link to={`/transport/trips/new?vehicle=${v.id}`} className="btn btn-sm btn-secondary">Viagem</Link>
                <Link to={`/transport/vehicles/${v.id}`} className="btn btn-sm btn-primary">Abrir</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalType === 'entry' ? 'Nova Entrada' : 'Nova Saída'}>
        {selectedVehicle && (
          <form onSubmit={handleSubmitModal} className="space-y-3">
            <div className="text-sm text-gray-700">Veículo: <strong>{selectedVehicle.plate} — {selectedVehicle.model}</strong></div>
            <input name="date" value={form.date} onChange={handleFormChange} placeholder="YYYY-MM-DD" className="input w-full" required />
            <input name="amount" value={form.amount} onChange={handleFormChange} placeholder="Valor" className="input w-full" required />
            <input name="description" value={form.description} onChange={handleFormChange} placeholder="Descrição" className="input w-full" />
            {modalType === 'exit' && (
              <select name="category" value={form.category} onChange={handleFormChange} className="input w-full">
                <option value="">Selecione categoria</option>
                <option value="fuel">Combustível</option>
                <option value="driver">Motorista</option>
                <option value="parts">Peças</option>
                <option value="maintenance">Manutenção</option>
                <option value="other">Outros</option>
              </select>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn">Cancelar</button>
              <button type="submit" className="btn btn-primary">Salvar</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
