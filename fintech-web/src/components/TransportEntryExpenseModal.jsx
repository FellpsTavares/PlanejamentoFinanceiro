import React, { useState, useEffect } from 'react';
import { transportService } from '../services/transport';

function formatDateDDMMYYYY(dateStr) {
  // dateStr in YYYY-MM-DD -> dd/MM/yyyy
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[0]}`;
}

export default function TransportEntryExpenseModal({ open, onClose, type, initial, vehicleId, onSaved }) {
  const [form, setForm] = useState({ date: '', amount: '', description: '', category: '' });

  const parseMoney = (value) => Number(String(value || '0').replace(',', '.'));
  useEffect(() => {
    if (initial) {
      setForm({
        date: initial.date ? formatDateDDMMYYYY(initial.date) : (new Date()).toLocaleDateString('pt-BR').replaceAll('-', '/'),
        amount: initial.amount || '',
        description: initial.description || '',
        category: initial.category || '',
      });
    } else if (open) {
      // default today
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      setForm({ date: `${dd}/${mm}/${yyyy}`, amount: '', description: '', category: '' });
    }
  }, [initial, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const toISO = (date) => {
    const p = date.split('/');
    if (p.length !== 3) return date;
    return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (initial && initial.id) {
        // update
        const payload = {
          date: toISO(form.date),
          amount: parseMoney(form.amount),
          description: form.description,
        };
        if (type === 'exit') payload.category = form.category || 'other';
        if (type === 'entry') {
          await transportService.updateRevenue(initial.id, payload);
        } else {
          await transportService.updateExpense(initial.id, payload);
        }
      } else {
        // create
        if (type === 'entry') {
          await transportService.createRevenue({ vehicle: vehicleId, date: toISO(form.date), amount: parseMoney(form.amount), description: form.description, type: 'trip' });
        } else {
          await transportService.createExpense({ vehicle: vehicleId, date: toISO(form.date), amount: parseMoney(form.amount), description: form.description, category: form.category || 'other' });
        }
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data || err.message || '';
      import('../utils/toast').then(({ toast }) => toast('Erro ao salvar: ' + (typeof msg === 'string' ? msg : JSON.stringify(msg)), 'error'));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded shadow-lg w-full max-w-md p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{initial ? 'Editar' : 'Nova'} {type === 'entry' ? 'Entrada' : 'Saída'}</h3>
          <button onClick={onClose} className="text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div className="text-sm text-gray-700">Veículo: <strong>{vehicleId}</strong></div>
          <input name="date" value={form.date} onChange={handleChange} placeholder="dd/MM/yyyy" className="input w-full" required />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
            <input name="amount" value={form.amount} onChange={handleChange} placeholder="0,00" className="input w-full" style={{ paddingLeft: '3rem' }} required />
          </div>
          <input name="description" value={form.description} onChange={handleChange} placeholder="Descrição" className="input w-full" />
          {type === 'exit' && (
            <select name="category" value={form.category} onChange={handleChange} className="input w-full">
              <option value="">Selecione categoria</option>
              <option value="fuel">Combustível</option>
              <option value="driver">Motorista</option>
              <option value="parts">Peças</option>
              <option value="maintenance">Manutenção</option>
              <option value="other">Outros</option>
            </select>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn">Cancelar</button>
            <button type="submit" className="btn btn-primary">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
