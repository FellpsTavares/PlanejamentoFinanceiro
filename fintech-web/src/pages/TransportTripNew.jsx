import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { transportService } from '../services/transport';
import { tenantParametersService } from '../services/tenantParameters';
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
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [progressTypeOptions, setProgressTypeOptions] = useState(['Coleta', 'Em trânsito', 'Descarga', 'Retorno']);
  const [progressType, setProgressType] = useState('');
  const [description, setDescription] = useState('');
  const [isReceived, setIsReceived] = useState(false);
  const [baseExpenseValue, setBaseExpenseValue] = useState('0');
  const [fuelExpenseValue, setFuelExpenseValue] = useState('0');
  const [initialKm, setInitialKm] = useState('');
  const [finalKm, setFinalKm] = useState('');
  const [driverPayment, setDriverPayment] = useState('0');
  const [driverReceiveType, setDriverReceiveType] = useState('1');
  const [driverPct, setDriverPct] = useState('10');
  const [driverPctType, setDriverPctType] = useState('bruta');
  const [preview, setPreview] = useState(null);

  const parseMoney = (value) => Number(String(value || '0').replace(',', '.'));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const v = await transportService.getVehicles();
        setVehicles(v.results || v);

        const params = await tenantParametersService.getByModule('transport');
        const map = Object.fromEntries((params || []).map((p) => [p.key, p.value]));
        setDriverReceiveType(String(map.TIPO_RECEBIMENTO_MOTORISTA || '1'));
        setDriverPct(String(map.PORCENTAGEM_MOTORISTA || '10'));
        setDriverPctType(String(map.TIPO_PORCENTAGEM || 'bruta'));
        const progressOptions = String(map.TRIP_PROGRESS_TYPES || 'Coleta,Em trânsito,Descarga,Retorno')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (progressOptions.length > 0) setProgressTypeOptions(progressOptions);

        if (tripId) {
          const trip = await transportService.getTrip(tripId);
          setVehicleId(String(trip.vehicle || ''));
          setStartDate(trip.start_date || trip.date || new Date().toISOString().slice(0, 10));
          setEndDate(trip.end_date || '');
          setProgressType(trip.progress_type || '');
          setModality(trip.modality || 'per_ton');
          setTons(trip.tons != null ? String(trip.tons) : '');
          setRatePerTon(trip.rate_per_ton != null ? String(trip.rate_per_ton) : '');
          setDays(trip.days != null ? String(trip.days) : '');
          setDailyRate(trip.daily_rate != null ? String(trip.daily_rate) : '');
          setDescription(trip.description || '');
          setIsReceived(Boolean(trip.is_received));
          setBaseExpenseValue(trip.base_expense_value != null ? String(trip.base_expense_value) : '0');
          setFuelExpenseValue(trip.fuel_expense_value != null ? String(trip.fuel_expense_value) : '0');
          setInitialKm(trip.initial_km != null ? String(trip.initial_km) : '');
          setFinalKm(trip.final_km != null ? String(trip.final_km) : '');
          setDriverPayment(trip.driver_payment != null ? String(trip.driver_payment) : '0');
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

  const grossTotal = Number(preview || 0);
  const baseExpense = parseMoney(baseExpenseValue || 0);
  const fuelExpense = parseMoney(fuelExpenseValue || 0);
  const manualDriver = parseMoney(driverPayment || 0);
  const pctDriver = (() => {
    const pct = parseMoney(driverPct || 0);
    const calcBase = driverPctType === 'liquida'
      ? Math.max(grossTotal - (baseExpense + fuelExpense), 0)
      : grossTotal;
    return (calcBase * pct) / 100;
  })();
  const driverPaymentPreview = driverReceiveType === '1' ? manualDriver : pctDriver;
  const totalExpensePreview = baseExpense + fuelExpense + driverPaymentPreview;
  const netPreview = grossTotal - totalExpensePreview;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicleId) {
      toast('Selecione um veículo', 'error');
      return;
    }
    const payload = {
      vehicle: vehicleId,
      date: startDate,
      start_date: startDate,
      end_date: endDate || null,
      modality,
      progress_type: progressType,
      description,
      is_received: isReceived,
      base_expense_value: parseMoney(baseExpenseValue || 0),
      fuel_expense_value: parseMoney(fuelExpenseValue || 0),
      initial_km: initialKm === '' ? null : Number(initialKm),
      final_km: finalKm === '' ? null : Number(finalKm),
    };
    if (driverReceiveType === '1') {
      payload.driver_payment = parseMoney(driverPayment || 0);
    }
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
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Cadastro de Viagem</h1>
      {tripId && <p className="text-sm text-gray-600 mb-3">Modo edição completa da viagem</p>}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Data início</label>
            <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Data fim</label>
            <input type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Andamento da viagem</label>
            <select className="input-field" value={progressType} onChange={e => setProgressType(e.target.value)}>
              <option value="">Selecione...</option>
              {progressTypeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Descrição</label>
          <textarea className="input-field w-full" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Outros gastos da Viagem</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
              <input className="input-field w-full" style={{ paddingLeft: '3rem' }} value={baseExpenseValue} onChange={e => setBaseExpenseValue(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Gasto de Combustível</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
              <input className="input-field w-full" style={{ paddingLeft: '3rem' }} value={fuelExpenseValue} onChange={e => setFuelExpenseValue(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Quilometragem inicial</label>
            <input className="input-field w-full" value={initialKm} onChange={e => setInitialKm(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Quilometragem final</label>
            <input className="input-field w-full" value={finalKm} onChange={e => setFinalKm(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={isReceived} onChange={(e) => setIsReceived(e.target.checked)} />
              Valor da viagem já recebido
            </label>
          </div>
        </div>

        {driverReceiveType === '1' ? (
          <div>
            <label className="block text-sm font-medium">Pagamento do Motorista (manual)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
              <input className="input-field w-full" style={{ paddingLeft: '3rem' }} value={driverPayment} onChange={e => setDriverPayment(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-700">
            Pagamento do motorista (automático): <strong>R$ {Number(driverPaymentPreview || 0).toFixed(2)}</strong>
            <div className="text-xs text-gray-500">
              Regra: {driverPct || 0}% sobre base {driverPctType === 'liquida' ? 'líquida' : 'bruta'}.
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button type="button" onClick={calculate} className="btn btn-secondary">Calcular</button>
          <div className="text-lg font-semibold">Total previsto: {preview != null ? preview.toFixed(2) : '—'}</div>
        </div>
        <div className="text-sm text-gray-700">Despesas previstas: R$ {Number(totalExpensePreview || 0).toFixed(2)}</div>
        <div className="text-sm font-semibold text-gray-800">Líquido previsto: R$ {Number(netPreview || 0).toFixed(2)}</div>

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
