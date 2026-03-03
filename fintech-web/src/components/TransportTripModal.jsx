import React, { useEffect, useMemo, useState } from 'react';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';

export default function TransportTripModal({ open, onClose, vehicleId, initial, onSaved }) {
  const [modality, setModality] = useState('per_ton');
  const [tons, setTons] = useState('');
  const [ratePerTon, setRatePerTon] = useState('');
  const [days, setDays] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [isReceived, setIsReceived] = useState(false);
  const [expenseValue, setExpenseValue] = useState('0');
  const [saving, setSaving] = useState(false);

  const parseMoney = (value) => Number(String(value || '0').replace(',', '.'));

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setModality(initial.modality || 'per_ton');
      setTons(initial.tons != null ? String(initial.tons) : '');
      setRatePerTon(initial.rate_per_ton != null ? String(initial.rate_per_ton) : '');
      setDays(initial.days != null ? String(initial.days) : '');
      setDailyRate(initial.daily_rate != null ? String(initial.daily_rate) : '');
      setDate(initial.date || new Date().toISOString().slice(0, 10));
      setDescription(initial.description || '');
      setIsReceived(Boolean(initial.is_received));
      setExpenseValue(initial.expense_value != null ? String(initial.expense_value) : '0');
    } else {
      setModality('per_ton');
      setTons('');
      setRatePerTon('');
      setDays('');
      setDailyRate('');
      setDate(new Date().toISOString().slice(0, 10));
      setDescription('');
      setIsReceived(false);
      setExpenseValue('0');
    }
  }, [open, initial]);

  const preview = useMemo(() => {
    if (modality === 'per_ton') {
      return Number(tons || 0) * parseMoney(ratePerTon || 0);
    }
    return Number(days || 0) * parseMoney(dailyRate || 0);
  }, [modality, tons, ratePerTon, days, dailyRate]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = { vehicle: vehicleId, date, modality, description, is_received: isReceived, expense_value: parseMoney(expenseValue || 0) };
      if (modality === 'per_ton') {
        payload.tons = tons;
        payload.rate_per_ton = parseMoney(ratePerTon);
      } else {
        payload.days = days;
        payload.daily_rate = parseMoney(dailyRate);
      }

      if (initial?.id) {
        await transportService.updateTrip(initial.id, payload);
        toast('Viagem atualizada', 'success');
      } else {
        await transportService.createTrip(payload);
        toast('Viagem criada', 'success');
      }

      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar viagem', err);
      toast('Erro ao salvar viagem', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded shadow-lg w-full max-w-xl p-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{initial?.id ? 'Editar Viagem' : 'Nova Viagem'}</h3>
          <button onClick={onClose} className="text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="block text-sm font-medium">Modalidade</label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2"><input type="radio" checked={modality === 'per_ton'} onChange={() => setModality('per_ton')} /> Por Tonelada</label>
              <label className="flex items-center gap-2"><input type="radio" checked={modality === 'lease'} onChange={() => setModality('lease')} /> Arrendamento (diárias)</label>
            </div>
          </div>

          {modality === 'per_ton' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Toneladas</label>
                <input className="input-field w-full" value={tons} onChange={(e) => setTons(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium">Valor por Tonelada</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                  <input className="input-field w-full" style={{ paddingLeft: '3rem' }} value={ratePerTon} onChange={(e) => setRatePerTon(e.target.value)} required />
                </div>
              </div>
            </div>
          )}

          {modality === 'lease' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">Dias</label>
                <input className="input-field w-full" value={days} onChange={(e) => setDays(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium">Valor Diário</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                  <input className="input-field w-full" style={{ paddingLeft: '3rem' }} value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} required />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium">Data</label>
            <input type="date" className="input-field w-full" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div>
            <label className="block text-sm font-medium">Descrição</label>
            <textarea className="input-field w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Gastos da Viagem</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                <input className="input-field w-full" style={{ paddingLeft: '3rem' }} value={expenseValue} onChange={(e) => setExpenseValue(e.target.value)} />
              </div>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={isReceived} onChange={(e) => setIsReceived(e.target.checked)} />
                Valor da viagem já recebido
              </label>
            </div>
          </div>

          <div className="text-sm text-gray-700">Total previsto: <strong>{Number(preview || 0).toFixed(2)}</strong></div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{initial?.id ? 'Salvar Alterações' : 'Salvar Viagem'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
