import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';
import ConfirmModal from '../components/ConfirmModal';

export default function TransportTripNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('trip');
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [modality, setModality] = useState('per_ton');
  const [tons, setTons] = useState('');
  const [ratePerTon, setRatePerTon] = useState('');
  const [days, setDays] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [isReceived, setIsReceived] = useState(false);
  const [expenseValue, setExpenseValue] = useState('0');
  const [preview, setPreview] = useState(null);

  const parseMoney = (value) => Number(String(value || '0').replace(',', '.'));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const v = await transportService.getVehicles();
        setVehicles(v.results || v);

        if (tripId) {
          const trip = await transportService.getTrip(tripId);
          setVehicleId(String(trip.vehicle || ''));
          setDate(trip.date || new Date().toISOString().slice(0, 10));
          setModality(trip.modality || 'per_ton');
          setTons(trip.tons != null ? String(trip.tons) : '');
          setRatePerTon(trip.rate_per_ton != null ? String(trip.rate_per_ton) : '');
          setDays(trip.days != null ? String(trip.days) : '');
          setDailyRate(trip.daily_rate != null ? String(trip.daily_rate) : '');
          setDescription(trip.description || '');
          setIsReceived(Boolean(trip.is_received));
          setExpenseValue(trip.expense_value != null ? String(trip.expense_value) : '0');
          setPreview(Number(trip.total_value || 0));
        }
      } catch (err) {
        console.error('Erro carregando veículos', err);
        toast('Erro ao carregar dados da viagem', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tripId]);

  useEffect(() => {
    const vehicleFromQuery = searchParams.get('vehicle');
    if (vehicleFromQuery) {
      setVehicleId(vehicleFromQuery);
    }
  }, [searchParams]);

  const calculate = () => {
    try {
      if (modality === 'per_ton') {
        const t = parseFloat(tons || 0);
        const r = parseMoney(ratePerTon || 0);
        const total = t * r;
        setPreview(total);
      } else {
        const d = parseInt(days || 0, 10);
        const dr = parseMoney(dailyRate || 0);
        const total = d * dr;
        setPreview(total);
      }
    } catch (err) {
      setPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicleId) {
      toast('Selecione um veículo', 'error');
      return;
    }
    const payload = {
      vehicle: vehicleId,
      date,
      modality,
      description,
      is_received: isReceived,
      expense_value: parseMoney(expenseValue || 0),
    };
    if (modality === 'per_ton') {
      payload.tons = tons;
      payload.rate_per_ton = parseMoney(ratePerTon);
    } else {
      payload.days = days;
      payload.daily_rate = parseMoney(dailyRate);
    }

    try {
      setSaving(true);
      if (tripId) {
        await transportService.updateTrip(tripId, payload);
        toast('Viagem atualizada', 'success');
      } else {
        await transportService.createTrip(payload);
        toast('Viagem criada', 'success');
      }
      navigate(`/transport/vehicles/${vehicleId}`);
    } catch (err) {
      console.error('Erro salvando viagem', err);
      toast('Erro ao salvar viagem', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tripId) return;
    try {
      setSaving(true);
      await transportService.deleteTrip(tripId);
      toast('Viagem excluída', 'success');
      if (vehicleId) {
        navigate(`/transport/vehicles/${vehicleId}`);
      } else {
        navigate('/transport/vehicles');
      }
    } catch (err) {
      console.error('Erro ao excluir viagem', err);
      toast('Erro ao excluir viagem', 'error');
    } finally {
      setSaving(false);
      setConfirmDeleteOpen(false);
    }
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Nova Viagem</h1>
      {tripId && <p className="text-sm text-gray-600 mb-3">Modo edição de viagem</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Veículo</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="input-field w-full">
            <option value="">Selecione...</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Modalidade</label>
          <div className="flex gap-4 mt-2">
            <label className="flex items-center gap-2"><input type="radio" checked={modality==='per_ton'} onChange={() => setModality('per_ton')} /> Por Tonelada</label>
            <label className="flex items-center gap-2"><input type="radio" checked={modality==='lease'} onChange={() => setModality('lease')} /> Arrendamento (diárias)</label>
          </div>
        </div>

        {modality === 'per_ton' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Toneladas</label>
              <input className="input-field w-full" value={tons} onChange={e => setTons(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium">Valor por Tonelada</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                <input className="input-field w-full" style={{ paddingLeft: '3rem' }} value={ratePerTon} onChange={e => setRatePerTon(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {modality === 'lease' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Dias</label>
              <input className="input-field w-full" value={days} onChange={e => setDays(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium">Valor Diário</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                <input className="input-field w-full" style={{ paddingLeft: '3rem' }} value={dailyRate} onChange={e => setDailyRate(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium">Data</label>
          <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium">Descrição</label>
          <textarea className="input-field w-full" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Gastos da Viagem</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
              <input className="input-field w-full" style={{ paddingLeft: '3rem' }} value={expenseValue} onChange={e => setExpenseValue(e.target.value)} />
            </div>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={isReceived} onChange={(e) => setIsReceived(e.target.checked)} />
              Valor da viagem já recebido
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={calculate} className="btn btn-secondary">Calcular</button>
          <div className="text-lg font-semibold">Total previsto: {preview != null ? preview.toFixed(2) : '—'}</div>
        </div>

        <div className="flex justify-between items-center">
          {tripId ? (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDeleteOpen(true)} disabled={saving}>
              Excluir Viagem
            </button>
          ) : <div />}
          <button type="submit" className="btn btn-primary" disabled={saving}>{tripId ? 'Salvar Alterações' : 'Salvar Viagem'}</button>
        </div>
      </form>

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Excluir viagem"
        message="Tem certeza que deseja excluir esta viagem?"
        confirmText="Excluir"
        cancelText="Cancelar"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
