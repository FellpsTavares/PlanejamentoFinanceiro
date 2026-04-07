import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { transportService } from '../services/transport';
import LoadingOverlay from '../components/LoadingOverlay';
import { tenantParametersService } from '../services/tenantParameters';
import { toast } from '../utils/toast';
import ConfirmModal from '../components/ConfirmModal';
import { formatDecimalStringToBRL, formatDecimalString, normalizeInputDecimal, formatQuantityDisplay } from '../utils/format';
import { multiplyDecimalStrings, addDecimalStrings, subtractDecimalStrings, divideDecimalStringByInt } from '../utils/decimal';
import CurrencyInput from '../components/CurrencyInput';

export default function TransportTripNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get('trip');
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [driverId, setDriverId] = useState('');
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
  const [fuelLiters, setFuelLiters] = useState('');
  const [initialKm, setInitialKm] = useState('');
  const [finalKm, setFinalKm] = useState('');
  const [driverPayment, setDriverPayment] = useState('0');
  const [driverReceiveType, setDriverReceiveType] = useState('1');
  const [driverPct, setDriverPct] = useState('10');
  const [driverPctType, setDriverPctType] = useState('bruta');
  const [driverIsOwner, setDriverIsOwner] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewRaw, setPreviewRaw] = useState(null);

  const parseMoney = (value) => Number(String(value || '0').replace(',', '.'));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const v = await transportService.getVehicles();
        setVehicles(v.results || v);

        const drv = await transportService.getDrivers({ no_page: 1 });
        setDrivers(drv.results || drv || []);

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
          setTons(trip.tons != null ? formatQuantityDisplay(trip.tons) : '');
          setRatePerTon(trip.rate_per_ton != null ? formatDecimalString(trip.rate_per_ton, 2) : '');
          setDays(trip.days != null ? String(trip.days) : '');
          setDailyRate(trip.daily_rate != null ? formatDecimalString(trip.daily_rate, 2) : '');
          setDescription(trip.description || '');
          setIsReceived(Boolean(trip.is_received));
          setBaseExpenseValue(trip.base_expense_value != null ? formatDecimalString(trip.base_expense_value, 2) : '0,00');
          setFuelExpenseValue(trip.fuel_expense_value != null ? formatDecimalString(trip.fuel_expense_value, 2) : '0,00');
          setInitialKm(trip.initial_km != null ? String(trip.initial_km) : '');
          setFinalKm(trip.final_km != null ? String(trip.final_km) : '');
          setDriverPayment(trip.driver_payment != null ? formatDecimalString(trip.driver_payment, 2) : '0,00');
          setDriverIsOwner(Boolean(trip.driver_is_owner));
          setDriverId(trip.driver != null ? String(trip.driver) : '');
          setFuelLiters(trip.fuel_liters != null ? formatQuantityDisplay(trip.fuel_liters) : '');
          setPreviewRaw(trip.total_value != null ? String(trip.total_value) : null);
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

  // Auto-fill motorista ao selecionar veículo (somente nova viagem)
  // Preenche automaticamente apenas quando o veículo tiver exatamente 1 motorista vinculado
  useEffect(() => {
    if (!vehicleId || tripId) return;
    const vehicle = vehicles.find((v) => String(v.id) === String(vehicleId));
    if (!vehicle) return;
    const vehicleDrivers = vehicle.driver_names || [];
    if (vehicleDrivers.length === 1) {
      const linked = vehicleDrivers[0];
      setDriverId(String(linked.id));
      setDriverIsOwner(Boolean(linked.is_owner));
    } else {
      // mais de um motorista vinculado — deixa o usuário escolher
      setDriverId('');
      setDriverIsOwner(false);
    }
  }, [vehicleId, vehicles, drivers, tripId]);

  const calculate = () => {
    try {
      if (modality === 'per_ton') {
        // use precise decimal multiplication (accept comma decimal)
        const totalStr = multiplyDecimalStrings(tons || '0', ratePerTon || '0');
        setPreview(totalStr);
      } else {
        const totalStr = multiplyDecimalStrings(String(days || '0'), dailyRate || '0');
        setPreview(totalStr);
      }
    } catch (err) {
      setPreview(null);
    }
  };

  // Use decimal string arithmetic for previews to avoid rounding
  const grossTotalStr = preview ? String(preview) : '0';
  const baseExpenseStr = normalizeInputDecimal(baseExpenseValue || '0');
  const fuelExpenseStr = normalizeInputDecimal(fuelExpenseValue || '0');
  const manualDriverStr = normalizeInputDecimal(driverPayment || '0');

  // driver pct calculation: (base * pct) / 100
  const pct = normalizeInputDecimal(driverPct || '0');
  const calcBaseStr = driverPctType === 'liquida'
    ? (() => {
      const diff = subtractDecimalStrings(grossTotalStr, addDecimalStrings(baseExpenseStr, fuelExpenseStr));
      // if negative, use 0
      if (diff.startsWith('-')) return '0';
      return diff;
    })()
    : grossTotalStr;
  const pctMul = multiplyDecimalStrings(calcBaseStr, pct);
  const pctDriverStr = divideDecimalStringByInt(pctMul, 100);
  const driverPaymentPreviewStr = driverReceiveType === '1' ? manualDriverStr : pctDriverStr;
  const totalExpensePreviewStr = addDecimalStrings(addDecimalStrings(baseExpenseStr, fuelExpenseStr), driverPaymentPreviewStr);
  const netPreviewStr = subtractDecimalStrings(grossTotalStr, totalExpensePreviewStr);

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
      fuel_liters: fuelLiters ? normalizeInputDecimal(fuelLiters) : null,
      driver_is_owner: driverIsOwner,
      driver: driverId ? parseInt(driverId, 10) : null,
      initial_km: initialKm === '' ? null : Number(initialKm),
      final_km: finalKm === '' ? null : Number(finalKm),
    };
    if (driverReceiveType === '1') {
      payload.driver_payment = parseMoney(driverPayment || 0);
    }
    if (modality === 'per_ton') {
      // enviar toneladas e rate como string com ponto decimal (ex: '1.5')
      payload.tons = tons ? normalizeInputDecimal(String(tons)).trim() : null;
      payload.rate_per_ton = ratePerTon ? normalizeInputDecimal(String(ratePerTon)).trim() : null;
    } else {
      payload.days = days;
      payload.daily_rate = dailyRate ? normalizeInputDecimal(String(dailyRate)).trim() : null;
    }

    // log payload para depuração
    console.debug('TransportTrip payload', payload);

      try {
      setSaving(true);
      if (tripId) {
        await transportService.updateTrip(tripId, payload);
        toast('Viagem atualizada', 'success');
        navigate(`/transport/trips?trip=${tripId}`);
      } else {
        const created = await transportService.createTrip(payload);
        toast('Viagem criada', 'success');
        // redireciona para a tela de gerenciar viagens com a nova viagem pré-selecionada
        if (created && created.id) {
          navigate(`/transport/trips?trip=${created.id}`);
        } else {
          navigate('/transport/trips');
        }
      }
    } catch (err) {
      console.error('Erro salvando viagem', err);
      let msg = 'Erro ao salvar viagem';
      try {
        const d = err?.response?.data;
        if (d) {
          if (typeof d === 'string') msg = d;
          else if (d.detail) msg = d.detail;
          else msg = JSON.stringify(d);
        }
      } catch (e) {
        // ignore
      }
      toast(msg, 'error');
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

  if (loading) return <LoadingOverlay message="Carregando formulário de viagem..." />;

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
          <label className="block text-sm font-medium">Motorista</label>
          <select value={driverId} onChange={(e) => {
            setDriverId(e.target.value);
            const driverObj = drivers.find((d) => String(d.id) === e.target.value);
            if (driverObj) setDriverIsOwner(Boolean(driverObj.is_owner));
            else if (!e.target.value) setDriverIsOwner(false);
          }} className="input-field w-full">
            <option value="">Nenhum</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}{d.is_owner ? ' (dono)' : ''}{!d.is_active ? ' — Inativo' : ''}
              </option>
            ))}
          </select>
          {driverId && drivers.find((d) => String(d.id) === driverId)?.is_owner && (
            <p className="mt-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
              Motorista é o proprietário — nenhum pagamento de motorista será gerado.
            </p>
          )}
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
                <input className="input-field w-full" inputMode="decimal" pattern="[0-9]+([\.,][0-9]+)?" step="0.001" value={tons} onChange={e => setTons(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium">Valor por Tonelada</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                <CurrencyInput className="input-field w-full" style={{ paddingLeft: '3rem' }} value={ratePerTon} onChange={e => setRatePerTon(e.target.value)} />
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
                <CurrencyInput className="input-field w-full" style={{ paddingLeft: '3rem' }} value={dailyRate} onChange={e => setDailyRate(e.target.value)} />
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
              <CurrencyInput className="input-field w-full" style={{ paddingLeft: '3rem' }} value={baseExpenseValue} onChange={e => setBaseExpenseValue(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Litros abastecidos</label>
                <input
                  className="input-field w-full"
                  inputMode="decimal"
                  pattern="[0-9]+([\.,][0-9]+)?"
                  step="0.001"
                  value={fuelLiters}
                  onChange={e => setFuelLiters(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Consumo (km por litro) — previsto</label>
                <div className="input-field w-full py-2">{(() => {
                  const ik = Number(initialKm || 0);
                  const fk = Number(finalKm || 0);
                  const liters = Number(String(fuelLiters || '0').replace(',', '.'));
                  if (ik && fk && liters > 0 && fk >= ik) {
                    const dist = fk - ik;
                    return (dist / liters).toFixed(3);
                  }
                  return '—';
                })()}</div>
              </div>
            </div>

            <label className="block text-sm font-medium">Gasto de Combustível</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
              <CurrencyInput className="input-field w-full" style={{ paddingLeft: '3rem' }} value={fuelExpenseValue} onChange={e => setFuelExpenseValue(e.target.value)} />
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
              <CurrencyInput className="input-field w-full" style={{ paddingLeft: '3rem' }} value={driverPayment} onChange={e => setDriverPayment(e.target.value)} />
            </div>
            <div className="mt-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={driverIsOwner} onChange={(e) => setDriverIsOwner(e.target.checked)} />
                Motorista é proprietário (sem pagamento ao motorista)
              </label>
            </div>
          </div>
          ) : (
          <div className="text-sm text-gray-700">
            Pagamento do motorista (automático): <strong>{formatDecimalStringToBRL(driverPaymentPreviewStr)}</strong>
            <div className="text-xs text-gray-500">
              Regra: {driverPct || 0}% sobre base {driverPctType === 'liquida' ? 'líquida' : 'bruta'}.
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button type="button" onClick={calculate} className="btn btn-secondary">Calcular</button>
          <div className="text-lg font-semibold">Total previsto: {previewRaw ? formatDecimalStringToBRL(previewRaw) : (preview != null ? formatDecimalStringToBRL(String(preview || 0)) : '—')}</div>
        </div>
        <div className="text-sm text-gray-700">Despesas previstas: {formatDecimalStringToBRL(totalExpensePreviewStr)}</div>
        <div className="text-sm font-semibold text-gray-800">Líquido previsto: {formatDecimalStringToBRL(netPreviewStr)}</div>

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
