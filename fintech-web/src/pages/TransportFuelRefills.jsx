import React, { useEffect, useState } from 'react';
import { transportService } from '../services/transport';
import { toast, extractApiError } from '../utils/toast';
import LoadingOverlay from '../components/LoadingOverlay';
import CurrencyInput from '../components/CurrencyInput';
import { formatDecimalStringToBRL, formatDecimalString, formatQuantityDisplay, normalizeInputDecimal } from '../utils/format';
import { multiplyDecimalStrings, subtractDecimalStrings } from '../utils/decimal';

const formatBRL = (value) => formatDecimalStringToBRL(value, 2);
const formatNumber = (value, decimals = 0) => formatDecimalString(value, decimals);

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const parts = String(dateStr).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
};

const EMPTY_FORM = {
  vehicle: '',
  date: '',
  fuel_type: 'diesel',
  odometer_km: '',
  liters: '',
  price_per_liter: '',
  discount: '',
  paid_value: '',
  autoCalcPaidValue: true,
};

export default function TransportFuelRefills() {
  const [loading, setLoading] = useState(true);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterFuelType, setFilterFuelType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterVehicle) params.vehicle = filterVehicle;
      if (filterFuelType) params.fuel_type = filterFuelType;
      const [fuelData, vehiclesData] = await Promise.all([
        transportService.getFuelLogs({ ...params, no_page: '1' }),
        transportService.getVehicles({ no_page: '1' }),
      ]);
      setFuelLogs(fuelData.results || fuelData || []);
      setVehicles(vehiclesData.results || vehiclesData || []);
    } catch {
      toast('Erro ao carregar abastecimentos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterVehicle, filterFuelType]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (log) => {
    setEditing(log.id);
    setForm({
      vehicle: String(log.vehicle),
      date: log.date || '',
      fuel_type: log.fuel_type,
      odometer_km: String(log.odometer_km ?? ''),
      // A API retorna liters com 3 casas decimais (ex: "629.590"). Se essa string cair
      // crua num input de texto, normalizeInputDecimal() a interpreta erroneamente como
      // separador de milhar BR (heurística: ponto + exatamente 3 dígitos após) e multiplica
      // o valor por 1000 ao salvar sem o campo ser reescrito. formatQuantityDisplay converte
      // para o formato BR correto (vírgula) e remove zeros à direita.
      liters: log.liters != null ? formatQuantityDisplay(log.liters) : '',
      // CurrencyInput (Cleave) espera formato BR (vírgula decimal); a API retorna ponto decimal.
      price_per_liter: log.price_per_liter != null ? formatDecimalString(log.price_per_liter, 2) : '',
      discount: log.discount != null ? formatDecimalString(log.discount, 2) : '',
      paid_value: log.paid_value != null ? formatDecimalString(log.paid_value, 2) : '',
      autoCalcPaidValue: false,
    });
    setShowModal(true);
  };

  const previewPaidValue = (() => {
    if (!form.autoCalcPaidValue) return form.paid_value;
    const gross = multiplyDecimalStrings(form.liters || '0', form.price_per_liter || '0');
    const net = subtractDecimalStrings(gross, form.discount || '0');
    // CurrencyInput (Cleave) espera vírgula decimal/ponto de milhar (formato BR);
    // multiplyDecimalStrings/subtractDecimalStrings retornam ponto decimal cru.
    return formatDecimalString(net, 2);
  })();

  const handleSave = async () => {
    if (!form.vehicle) { toast('Selecione um veículo', 'error'); return; }
    if (!form.date) { toast('Informe a data do abastecimento', 'error'); return; }
    if (!form.liters) { toast('Informe a quantidade de litros', 'error'); return; }
    if (!form.odometer_km) { toast('Informe a quilometragem atual', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        vehicle: Number(form.vehicle),
        date: form.date,
        fuel_type: form.fuel_type,
        odometer_km: Number(form.odometer_km || 0),
        liters: normalizeInputDecimal(form.liters || '0'),
        price_per_liter: normalizeInputDecimal(form.price_per_liter || '0') || null,
        discount: normalizeInputDecimal(form.discount || '0'),
      };
      if (!form.autoCalcPaidValue) {
        payload.paid_value = normalizeInputDecimal(form.paid_value || '0');
      }
      if (editing) {
        await transportService.updateFuelLog(editing, payload);
        toast('Abastecimento atualizado', 'success');
      } else {
        await transportService.createFuelLog(payload);
        toast('Abastecimento registrado', 'success');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast(extractApiError(err, 'Erro ao salvar abastecimento'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este abastecimento?')) return;
    try {
      await transportService.deleteFuelLog(id);
      toast('Abastecimento excluído', 'success');
      load();
    } catch {
      toast('Erro ao excluir abastecimento', 'error');
    }
  };

  if (loading) return <LoadingOverlay message="Carregando abastecimentos..." />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Abastecimento</h1>
      <p className="mt-1 text-gray-500">Histórico de abastecimentos da frota (Diesel e Arla).</p>

      {/* Filtros */}
      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <select className="border rounded px-3 py-1.5 text-sm" value={filterVehicle} onChange={(e) => setFilterVehicle(e.target.value)}>
          <option value="">Todos os veículos</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
        </select>
        <select className="border rounded px-3 py-1.5 text-sm" value={filterFuelType} onChange={(e) => setFilterFuelType(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="diesel">Diesel</option>
          <option value="arla">Arla</option>
        </select>
        <button className="btn btn-primary btn-sm ml-auto" onClick={openNew}>+ Novo Abastecimento</button>
      </div>

      {/* Tabela */}
      <div className="mt-4 overflow-x-auto">
        {fuelLogs.length === 0 ? (
          <div className="p-4 border rounded text-gray-500">Nenhum abastecimento cadastrado.</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 border-b font-medium">Data</th>
                <th className="px-3 py-2 border-b font-medium">Veículo</th>
                <th className="px-3 py-2 border-b font-medium">Tipo</th>
                <th className="px-3 py-2 border-b font-medium">Litros</th>
                <th className="px-3 py-2 border-b font-medium">Valor/Litro</th>
                <th className="px-3 py-2 border-b font-medium">Desconto</th>
                <th className="px-3 py-2 border-b font-medium">Valor Pago</th>
                <th className="px-3 py-2 border-b font-medium">KM</th>
                <th className="px-3 py-2 border-b font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {fuelLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border-b">{formatDate(log.date)}</td>
                  <td className="px-3 py-2 border-b font-mono font-semibold">{log.vehicle_plate}</td>
                  <td className="px-3 py-2 border-b">{log.fuel_type_display}</td>
                  <td className="px-3 py-2 border-b">{formatNumber(log.liters, 3)} L</td>
                  <td className="px-3 py-2 border-b">{log.price_per_liter ? formatBRL(log.price_per_liter) : '—'}</td>
                  <td className="px-3 py-2 border-b">{Number(log.discount) > 0 ? formatBRL(log.discount) : '—'}</td>
                  <td className="px-3 py-2 border-b">{formatBRL(log.paid_value)}</td>
                  <td className="px-3 py-2 border-b">{formatNumber(log.odometer_km, 0)} km</td>
                  <td className="px-3 py-2 border-b">
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(log)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(log.id)}>Excluir</button>
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
            <h2 className="text-lg font-semibold">{editing ? 'Editar Abastecimento' : 'Novo Abastecimento'}</h2>

            <div>
              <label className="block text-sm font-medium mb-1">Veículo *</label>
              <select className="border rounded w-full px-3 py-2 text-sm" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })}>
                <option value="">Selecione...</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Data *</label>
                <input type="date" className="border rounded w-full px-3 py-2 text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de combustível</label>
                <select className="border rounded w-full px-3 py-2 text-sm" value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}>
                  <option value="diesel">Diesel</option>
                  <option value="arla">Arla</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Litros</label>
                <input
                  className="border rounded w-full px-3 py-2 text-sm"
                  inputMode="decimal"
                  pattern="[0-9]+([\.,][0-9]+)?"
                  step="0.001"
                  value={form.liters}
                  onChange={(e) => setForm({ ...form, liters: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quilometragem atual</label>
                <input type="number" min="0" className="border rounded w-full px-3 py-2 text-sm" value={form.odometer_km} onChange={(e) => setForm({ ...form, odometer_km: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Valor por litro</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                  <CurrencyInput className="border rounded w-full px-3 py-2 text-sm" style={{ paddingLeft: '2.75rem' }} value={form.price_per_liter} onChange={(e) => setForm({ ...form, price_per_liter: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Desconto</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                  <CurrencyInput className="border rounded w-full px-3 py-2 text-sm" style={{ paddingLeft: '2.75rem' }} value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Valor pago</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                <CurrencyInput
                  className="border rounded w-full px-3 py-2 text-sm"
                  style={{ paddingLeft: '2.75rem' }}
                  value={previewPaidValue}
                  disabled={form.autoCalcPaidValue}
                  onChange={(e) => setForm({ ...form, paid_value: e.target.value })}
                />
              </div>
              <label className="text-sm flex items-center gap-2 mt-2">
                <input type="checkbox" checked={form.autoCalcPaidValue} onChange={(e) => setForm({ ...form, autoCalcPaidValue: e.target.checked })} />
                Calcular valor pago automaticamente (litros × valor/litro − desconto)
              </label>
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
