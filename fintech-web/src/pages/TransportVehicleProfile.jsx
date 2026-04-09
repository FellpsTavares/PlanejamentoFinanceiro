import React, { useEffect, useMemo, useState } from 'react';
import LoadingOverlay from '../components/LoadingOverlay';
import { useParams } from 'react-router-dom';
import { transportService } from '../services/transport';
import api from '../services/api';
import TransportEntryExpenseModal from '../components/TransportEntryExpenseModal';
import ConfirmModal from '../components/ConfirmModal';
import TransportTripModal from '../components/TransportTripModal';
import { toast } from '../utils/toast';
import { formatDecimalStringToBRL, formatDecimalString } from '../utils/format';

const MAX_AXLES_ALLOWED = 12;

function sanitizeIntegerInput(value, { min = 0, max = Number.MAX_SAFE_INTEGER, allowEmpty = true } = {}) {
  const raw = String(value ?? '');
  if (!raw.trim()) return allowEmpty ? '' : String(min);
  const digits = raw.replace(/\D/g, '');
  if (!digits) return allowEmpty ? '' : String(min);
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return allowEmpty ? '' : String(min);
  return String(Math.min(max, Math.max(min, parsed)));
}

function slotKey(axle, side, position) {
  return `${axle}-${side}-${position}`;
}

function parseSlotKey(value) {
  const [axle, side, position] = String(value || '').split('-');
  if (!axle || !side || !position) return null;
  return { axle_number: Number(axle), side, position };
}

export default function TransportVehicleProfile() {
  const { id } = useParams();

  const [vehicle, setVehicle] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({
    plate: '',
    model: '',
    capacity: '',
    year: '',
    initial_km: '',
    is_dual_wheel: false,
    number_of_axles: '',
    next_review_date: '',
    next_review_km: '',
  });
  const [linkedDrivers, setLinkedDrivers] = useState([]); // [{id, name, is_owner, is_active}]
  const [allDrivers, setAllDrivers] = useState([]);       // todos os motoristas do tenant
  const [driverToAdd, setDriverToAdd] = useState('');

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revenues, setRevenues] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [trips, setTrips] = useState([]);
  const [tires, setTires] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);

  const [activeAccordion, setActiveAccordion] = useState({ tires: false, maintenance: false, edit: false });

  const [tireForm, setTireForm] = useState({
    brand: '',
    serial_number: '',
    purchase_date: '',
    status: 'stock',
    condition: 'good',
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    date: '',
    odometer_at_maintenance: '',
    description: '',
    is_oil_change: false,
    oil_brand: '',
    quantity_liters: '',
    type: 'full_change',
    next_change_km_interval: '',
    next_change_date_interval: '',
  });

  const [slotRegistrationDate, setSlotRegistrationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currentTireMap, setCurrentTireMap] = useState({});
  const [rotateSource, setRotateSource] = useState('');
  const [rotateTarget, setRotateTarget] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [modalInitial, setModalInitial] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null);
  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [tripModalInitial, setTripModalInitial] = useState(null);

  const formatBRL = (value) => formatDecimalStringToBRL(value, 2);
  const formatNumber = (value, minimumFractionDigits = 0, maximumFractionDigits = 3) => formatDecimalString(value, Math.max(minimumFractionDigits, 0));

  const rawAxleCount = Number(vehicleForm.number_of_axles || vehicle?.number_of_axles || 2);
  const axleCount = Number.isFinite(rawAxleCount) ? Math.min(MAX_AXLES_ALLOWED, Math.max(1, rawAxleCount)) : 2;

  const slotDefinitions = useMemo(() => {
    if (vehicleForm.is_dual_wheel) {
      return [
        { side: 'left', position: 'inside', label: 'Esquerdo - Dentro' },
        { side: 'left', position: 'outside', label: 'Esquerdo - Fora' },
        { side: 'right', position: 'inside', label: 'Direito - Dentro' },
        { side: 'right', position: 'outside', label: 'Direito - Fora' },
      ];
    }
    return [
      { side: 'left', position: 'outside', label: 'Esquerdo' },
      { side: 'right', position: 'outside', label: 'Direito' },
    ];
  }, [vehicleForm.is_dual_wheel]);

  const selectableTires = tires.filter((t) => t.status === 'stock' || t.status === 'in_use');
  const activePlacements = placements.filter((p) => !p.removal_date);

  useEffect(() => {
    const map = {};
    activePlacements.forEach((placement) => {
      map[slotKey(placement.axle_number, placement.side, placement.position || 'outside')] = String(placement.tire);
    });
    setCurrentTireMap(map);
  }, [placements]);

  const refreshVehicle = async () => {
    const res = await api.get(`/transport/vehicles/${id}/`);
    const data = res.data;
    setVehicle(data);
    setLinkedDrivers(data.driver_names || []);
    setVehicleForm({
      plate: data.plate || '',
      model: data.model || '',
      capacity: data.capacity || '',
      year: data.year || '',
      initial_km: Number(data.initial_km || 0) > 0 ? String(data.initial_km) : '',
      is_dual_wheel: Boolean(data.is_dual_wheel),
      number_of_axles: data.number_of_axles ? String(Math.min(MAX_AXLES_ALLOWED, Number(data.number_of_axles))) : '',
      next_review_date: data.next_review_date || '',
      next_review_km: data.next_review_km ? String(data.next_review_km) : '',
    });
  };

  const refreshTransportAssets = async () => {
    const [tireData, placementData, maintenanceData] = await Promise.all([
      transportService.getTires(),
      transportService.getTirePlacements({ vehicle: id }),
      transportService.getMaintenanceLogs({ vehicle: id }),
    ]);
    setTires(tireData.results || tireData);
    setPlacements(placementData.results || placementData);
    setMaintenanceLogs(maintenanceData.results || maintenanceData);
  };

  const refreshTrips = async () => {
    const tripData = await transportService.getTrips({ vehicle: id });
    setTrips(tripData.results || tripData);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshVehicle();
        const [s, rev, exp, driversData] = await Promise.all([
          transportService.getVehicleSummary(id),
          transportService.getRevenues(id),
          transportService.getExpenses(id),
          transportService.getDrivers({ no_page: 1 }),
        ]);
        setSummary(s);
        setRevenues(rev.results || rev);
        setExpenses(exp.results || exp);
        setAllDrivers(Array.isArray(driversData) ? driversData : (driversData.results || []));
        await Promise.all([refreshTrips(), refreshTransportAssets()]);
      } catch (err) {
        console.error('Erro carregando veículo', err);
        setError(err?.response?.data || err.message || 'Erro ao carregar veículo.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleAddDriver = async () => {
    if (!driverToAdd) return;
    const currentIds = linkedDrivers.map((d) => d.id);
    if (currentIds.includes(Number(driverToAdd))) return;
    const newIds = [...currentIds, Number(driverToAdd)];
    try {
      await transportService.updateVehicle(id, { drivers: newIds });
      await refreshVehicle();
      setDriverToAdd('');
      toast('Motorista vinculado', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao vincular motorista', 'error');
    }
  };

  const handleRemoveDriver = async (driverId) => {
    const newIds = linkedDrivers.map((d) => d.id).filter((i) => i !== driverId);
    try {
      await transportService.updateVehicle(id, { drivers: newIds });
      await refreshVehicle();
      toast('Motorista removido', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao remover motorista', 'error');
    }
  };

  const handleSaveVehicle = async () => {
    try {
      await transportService.updateVehicle(id, {
        plate: (vehicleForm.plate || '').trim(),
        model: vehicleForm.model,
        capacity: vehicleForm.capacity,
        year: Number(vehicleForm.year),
        initial_km: Number(vehicleForm.initial_km || 0),
        is_dual_wheel: Boolean(vehicleForm.is_dual_wheel),
        number_of_axles: vehicleForm.number_of_axles
          ? Math.min(MAX_AXLES_ALLOWED, Math.max(1, Number(vehicleForm.number_of_axles)))
          : null,
        next_review_date: vehicleForm.next_review_date || null,
        next_review_km: vehicleForm.next_review_km ? Number(vehicleForm.next_review_km) : null,
      });
      await refreshVehicle();
      toast('Veículo atualizado', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao atualizar veículo', 'error');
    }
  };

  const handleCreateTire = async (e) => {
    e.preventDefault();
    try {
      await transportService.createTire(tireForm);
      setTireForm({ brand: '', serial_number: '', purchase_date: '', status: 'stock', condition: 'good' });
      await refreshTransportAssets();
      toast('Pneu cadastrado', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao cadastrar pneu', 'error');
    }
  };

  const handleSaveCurrentTires = async () => {
    const selectedPlacements = Object.entries(currentTireMap)
      .filter(([, tireId]) => !!tireId)
      .map(([key, tireId]) => {
        const parsed = parseSlotKey(key);
        return {
          tire: tireId,
          axle_number: parsed.axle_number,
          side: parsed.side,
          position: parsed.position,
        };
      });

    const selectedIds = selectedPlacements.map((item) => String(item.tire));
    if (selectedIds.length !== new Set(selectedIds).size) {
      toast('O mesmo pneu não pode ser vinculado em duas posições ao mesmo tempo', 'warning');
      return;
    }

    if (!selectedPlacements.length) {
      toast('Selecione ao menos um pneu para registrar', 'warning');
      return;
    }

    try {
      await transportService.setCurrentTires(id, {
        installation_date: slotRegistrationDate,
        placements: selectedPlacements,
      });
      toast('Pneus atuais registrados com sucesso', 'success');
      await refreshTransportAssets();
    } catch (err) {
      console.error(err);
      toast('Erro ao registrar pneus atuais', 'error');
    }
  };

  const handleRotateTires = async () => {
    const source = parseSlotKey(rotateSource);
    const target = parseSlotKey(rotateTarget);
    if (!source || !target) {
      toast('Selecione origem e destino', 'warning');
      return;
    }
    try {
      await transportService.rotateTires(id, {
        rotation_date: slotRegistrationDate,
        source,
        target,
      });
      toast('Rodízio executado com sucesso', 'success');
      setRotateSource('');
      setRotateTarget('');
      await refreshTransportAssets();
    } catch (err) {
      console.error(err);
      toast('Erro ao executar rodízio', 'error');
    }
  };

  const handleCreateMaintenance = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        vehicle: id,
        date: maintenanceForm.date,
        odometer_at_maintenance: Number(maintenanceForm.odometer_at_maintenance || 0),
        description: maintenanceForm.description,
      };
      if (maintenanceForm.is_oil_change) {
        payload.oil_change = {
          oil_brand: maintenanceForm.oil_brand,
          quantity_liters: Number(maintenanceForm.quantity_liters || 0),
          type: maintenanceForm.type,
          next_change_km_interval: maintenanceForm.next_change_km_interval ? Number(maintenanceForm.next_change_km_interval) : null,
          next_change_date_interval: maintenanceForm.next_change_date_interval ? Number(maintenanceForm.next_change_date_interval) : null,
        };
      }
      await transportService.createMaintenanceLog(payload);
      setMaintenanceForm({
        date: '',
        odometer_at_maintenance: '',
        description: '',
        is_oil_change: false,
        oil_brand: '',
        quantity_liters: '',
        type: 'full_change',
        next_change_km_interval: '',
        next_change_date_interval: '',
      });
      await refreshTransportAssets();
      toast('Manutenção registrada', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao registrar manutenção', 'error');
    }
  };

  if (loading) return <LoadingOverlay message="Carregando veículo..." />;
  if (error) return <div className="p-6 text-red-600">Erro: {typeof error === 'string' ? error : JSON.stringify(error)}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{vehicle.plate} — {vehicle.model}</h1>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded">
          <div className="text-sm text-gray-600">Média de Consumo</div>
          <div className="text-xl font-semibold">{vehicle.avg_consumption ? `${vehicle.avg_consumption} km/l` : '—'}</div>
        </div>
        <div className="p-4 border rounded">
          <div className="text-sm text-gray-600">KM Atual (calculado)</div>
          <div className="text-xl font-semibold">{formatNumber(vehicle.current_km, 0, 0)} km</div>
        </div>
        <div className="p-4 border rounded">
          <div className="text-sm text-gray-600">Rentabilidade (Período selecionado)</div>
          <div className="text-xl font-semibold">{summary ? formatBRL(summary.net_profit) : '—'}</div>
        </div>
      </div>

      <div className="mt-6 p-4 border rounded bg-gray-50">
        <h2 className="font-semibold">Resumo</h2>
        <div className="mt-2">Receitas: {summary ? formatBRL(summary.revenues_total) : '—'}</div>
        <div>Despesas: {summary ? formatBRL(summary.expenses_total) : '—'}</div>
        <div className="mt-3">
          {/* Removido botão de criar/visualizar viagens no perfil do veículo */}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Receitas</h3>
            <button className="btn btn-sm btn-primary" onClick={() => { setModalType('entry'); setModalInitial(null); setModalOpen(true); }}>Nova Entrada</button>
          </div>
          <ul className="mt-3 space-y-2">
            {revenues.map((r) => (
              <li key={r.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-semibold">{r.date ? new Date(r.date).toLocaleDateString('pt-BR') : ''} — {formatBRL(r.amount)}</div>
                  <div className="text-sm text-gray-600">{r.description}</div>
                </div>
                <div>
                  <button className="text-blue-600 mr-3" onClick={() => { setModalType('entry'); setModalInitial(r); setModalOpen(true); }}>Editar</button>
                  <button className="text-red-600" onClick={() => { setConfirmPayload({ kind: 'revenue', id: r.id }); setConfirmOpen(true); }}>Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Despesas</h3>
            <button className="btn btn-sm btn-primary" onClick={() => { setModalType('exit'); setModalInitial(null); setModalOpen(true); }}>Nova Saída</button>
          </div>
          <ul className="mt-3 space-y-2">
            {expenses.map((r) => (
              <li key={r.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-semibold">{r.date ? new Date(r.date).toLocaleDateString('pt-BR') : ''} — {formatBRL(r.amount)}</div>
                  <div className="text-sm text-gray-600">{r.description} {r.category ? `• ${r.category}` : ''}</div>
                </div>
                <div>
                  <button className="text-blue-600 mr-3" onClick={() => { setModalType('exit'); setModalInitial(r); setModalOpen(true); }}>Editar</button>
                  <button className="text-red-600" onClick={() => { setConfirmPayload({ kind: 'expense', id: r.id }); setConfirmOpen(true); }}>Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <div className="border rounded">
          <button className="w-full text-left px-4 py-3 font-semibold bg-gray-50" onClick={() => setActiveAccordion((p) => ({ ...p, edit: !p.edit }))}>
            Editar veículo
          </button>
          {activeAccordion.edit && (
            <div className="p-4 border-t bg-gray-50">
              <h2 className="font-semibold mb-3">Editar veículo</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-600">Placa</label>
                  <input className="input" value={vehicleForm.plate} onChange={(e) => setVehicleForm((p) => ({ ...p, plate: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Modelo</label>
                  <input className="input" value={vehicleForm.model} onChange={(e) => setVehicleForm((p) => ({ ...p, model: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Ano</label>
                  <input className="input" type="number" value={vehicleForm.year} onChange={(e) => setVehicleForm((p) => ({ ...p, year: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Capacidade</label>
                  <input className="input" value={vehicleForm.capacity} onChange={(e) => setVehicleForm((p) => ({ ...p, capacity: e.target.value }))} />
                </div>

                <label className="flex items-center gap-2 md:col-span-3 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={Boolean(vehicleForm.is_dual_wheel)}
                    onChange={(e) => setVehicleForm((p) => ({ ...p, is_dual_wheel: e.target.checked }))}
                  />
                  Rodagem dupla (4 pneus por eixo)
                </label>

                <div>
                  <label className="text-xs text-gray-600">KM inicial do veículo</label>
                  <input
                    className="input"
                    type="number"
              min="0"
              value={vehicleForm.initial_km}
              onChange={(e) => setVehicleForm((p) => ({ ...p, initial_km: sanitizeIntegerInput(e.target.value, { min: 0, max: 999999999, allowEmpty: true }) }))}
            />
          </div>

                <div>
                  <label className="text-xs text-gray-600">Número de eixos (máx. {MAX_AXLES_ALLOWED})</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max={MAX_AXLES_ALLOWED}
                    value={vehicleForm.number_of_axles}
                    onChange={(e) => setVehicleForm((p) => ({ ...p, number_of_axles: sanitizeIntegerInput(e.target.value, { min: 1, max: MAX_AXLES_ALLOWED, allowEmpty: true }) }))}
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-600">Data da próxima revisão</label>
                  <input className="input" type="date" value={vehicleForm.next_review_date} onChange={(e) => setVehicleForm((p) => ({ ...p, next_review_date: e.target.value }))} />
                </div>

                <div>
                  <label className="text-xs text-gray-600">KM previsto para próxima revisão</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={vehicleForm.next_review_km}
                    onChange={(e) => setVehicleForm((p) => ({ ...p, next_review_km: sanitizeIntegerInput(e.target.value, { min: 0, max: 999999999, allowEmpty: true }) }))}
                  />
                </div>
              </div>
              <div className="mt-3">
                <button className="btn btn-primary" onClick={handleSaveVehicle}>Salvar dados do veículo</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Motoristas vinculados */}
      <div className="mt-4">
        <div className="border rounded">
          <button
            className="w-full text-left px-4 py-3 font-semibold bg-gray-50"
            onClick={() => setActiveAccordion((p) => ({ ...p, drivers: !p.drivers }))}
          >
            Motoristas vinculados ({linkedDrivers.length})
          </button>
          {activeAccordion.drivers && (
            <div className="p-4 border-t bg-gray-50 space-y-4">
              {linkedDrivers.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum motorista vinculado a este veículo.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="pb-1">Nome</th>
                      <th className="pb-1">Tipo</th>
                      <th className="pb-1">Status</th>
                      <th className="pb-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedDrivers.map((d) => (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="py-1">{d.name}</td>
                        <td className="py-1">{d.is_owner ? 'Proprietário' : 'Motorista'}</td>
                        <td className="py-1">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {d.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="py-1 text-right">
                          <button
                            className="text-red-500 hover:underline text-xs"
                            onClick={() => handleRemoveDriver(d.id)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="flex gap-2 items-center pt-2">
                <select
                  className="input flex-1"
                  value={driverToAdd}
                  onChange={(e) => setDriverToAdd(e.target.value)}
                >
                  <option value="">Selecionar motorista para vincular...</option>
                  {allDrivers
                    .filter((d) => !linkedDrivers.find((l) => l.id === d.id))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}{d.is_owner ? ' (Proprietário)' : ''}
                      </option>
                    ))}
                </select>
                <button className="btn btn-primary" onClick={handleAddDriver} disabled={!driverToAdd}>
                  Vincular
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="border rounded">
          <button className="w-full text-left px-4 py-3 font-semibold bg-gray-50" onClick={() => setActiveAccordion((p) => ({ ...p, tires: !p.tires }))}>
            Gerenciamento de Pneus
          </button>
          {activeAccordion.tires && (
            <div className="p-4 space-y-4">
              <form className="grid grid-cols-1 md:grid-cols-5 gap-3" onSubmit={handleCreateTire}>
                <input className="input" placeholder="Marca" value={tireForm.brand} onChange={(e) => setTireForm((p) => ({ ...p, brand: e.target.value }))} required />
                <input className="input" placeholder="Número de série" value={tireForm.serial_number} onChange={(e) => setTireForm((p) => ({ ...p, serial_number: e.target.value }))} />
                <input className="input" type="date" value={tireForm.purchase_date} onChange={(e) => setTireForm((p) => ({ ...p, purchase_date: e.target.value }))} required />
                <select className="input" value={tireForm.status} onChange={(e) => setTireForm((p) => ({ ...p, status: e.target.value }))}>
                  <option value="stock">Estoque</option>
                  <option value="in_use">Em uso</option>
                  <option value="discarded">Descartado</option>
                </select>
                <select className="input" value={tireForm.condition} onChange={(e) => setTireForm((p) => ({ ...p, condition: e.target.value }))}>
                  <option value="good">Bom</option>
                  <option value="medium">Médio</option>
                  <option value="bad">Ruim</option>
                </select>
                <button type="submit" className="btn btn-primary md:col-span-5">Cadastrar pneu</button>
              </form>

              <details className="border rounded bg-white">
                <summary className="cursor-pointer px-3 py-2 font-semibold">Registrar pneus atuais por posição</summary>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <label className="text-sm">Data de registro:</label>
                    <input className="input max-w-xs" type="date" value={slotRegistrationDate} onChange={(e) => setSlotRegistrationDate(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Array.from({ length: axleCount }).map((_, index) => {
                      const axle = index + 1;
                      return (
                        <div key={axle} className="border rounded p-3 bg-gray-50">
                          <div className="font-medium mb-2">Eixo {axle}</div>
                          <div className="grid grid-cols-1 gap-2">
                            {slotDefinitions.map((slot) => {
                              const key = slotKey(axle, slot.side, slot.position);
                              const currentValue = currentTireMap[key] || '';
                              return (
                                <div key={key}>
                                  <label className="text-xs text-gray-600">{slot.label}</label>
                                  <select
                                    className="input"
                                    value={currentValue}
                                    onChange={(e) => setCurrentTireMap((p) => ({ ...p, [key]: e.target.value }))}
                                  >
                                    <option value="">Sem pneu nessa posição</option>
                                    {selectableTires.map((t) => {
                                      const isUsedSomewhereElse = Object.entries(currentTireMap).some(([slotKeyValue, tireId]) => {
                                        if (slotKeyValue === key) return false;
                                        return String(tireId) === String(t.id);
                                      });
                                      return (
                                        <option key={`${key}-${t.id}`} value={t.id} disabled={isUsedSomewhereElse}>
                                          {t.brand} ({t.serial_number || 'sem série'})
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Atual: {currentValue ? (tires.find((t) => String(t.id) === String(currentValue))?.brand || 'pneu selecionado') : 'vazio'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button className="btn btn-primary mt-3" onClick={handleSaveCurrentTires}>Salvar posições atuais</button>
                </div>
              </details>

              <details className="border rounded bg-white">
                <summary className="cursor-pointer px-3 py-2 font-semibold">Rodízio (trocar 2 pneus de posição)</summary>
                <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Origem</label>
                    <select className="input" value={rotateSource} onChange={(e) => setRotateSource(e.target.value)}>
                      <option value="">Selecione origem</option>
                      {activePlacements.map((p) => (
                        <option key={`src-${p.id}`} value={slotKey(p.axle_number, p.side, p.position || 'outside')}>
                          Eixo {p.axle_number} • {p.side === 'left' ? 'Esquerdo' : 'Direito'} • {p.position === 'inside' ? 'Dentro' : 'Fora'} • {p.tire_brand}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Destino</label>
                    <select className="input" value={rotateTarget} onChange={(e) => setRotateTarget(e.target.value)}>
                      <option value="">Selecione destino</option>
                      {activePlacements.map((p) => (
                        <option key={`dst-${p.id}`} value={slotKey(p.axle_number, p.side, p.position || 'outside')}>
                          Eixo {p.axle_number} • {p.side === 'left' ? 'Esquerdo' : 'Direito'} • {p.position === 'inside' ? 'Dentro' : 'Fora'} • {p.tire_brand}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button className="btn btn-secondary w-full" onClick={handleRotateTires}>Executar rodízio</button>
                  </div>
                </div>
              </details>

              <div>
                <h4 className="font-semibold mb-2">Pneus cadastrados</h4>
                <ul className="space-y-2">
                  {tires.map((t) => (
                    <li key={t.id} className="border rounded p-2 text-sm bg-white">
                      <div className="font-semibold">{t.brand} ({t.serial_number || 'sem série'})</div>
                      <div>Status: {t.status === 'stock' ? 'Estoque' : t.status === 'in_use' ? 'Em uso' : 'Descartado'} • Estado: {t.condition === 'good' ? 'Bom' : t.condition === 'medium' ? 'Médio' : 'Ruim'}</div>
                      <div>KM rodado: {formatNumber(t.total_km_run, 0, 0)} km</div>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          )}
        </div>

        <div className="border rounded">
          <button className="w-full text-left px-4 py-3 font-semibold bg-gray-50" onClick={() => setActiveAccordion((p) => ({ ...p, maintenance: !p.maintenance }))}>
            Histórico de Óleo/Manutenção
          </button>
          {activeAccordion.maintenance && (
            <div className="p-4 space-y-4">
              <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={handleCreateMaintenance}>
                <div>
                  <label className="text-xs text-gray-600">Data da manutenção</label>
                  <input className="input" type="date" value={maintenanceForm.date} onChange={(e) => setMaintenanceForm((p) => ({ ...p, date: e.target.value }))} required />
                </div>
                <input className="input" type="number" min="0" placeholder="KM no momento" value={maintenanceForm.odometer_at_maintenance} onChange={(e) => setMaintenanceForm((p) => ({ ...p, odometer_at_maintenance: sanitizeIntegerInput(e.target.value, { min: 0, max: 999999999, allowEmpty: true }) }))} required />
                <input className="input md:col-span-2" placeholder="Descrição" value={maintenanceForm.description} onChange={(e) => setMaintenanceForm((p) => ({ ...p, description: e.target.value }))} required />

                <label className="text-sm md:col-span-4 flex items-center gap-2">
                  <input type="checkbox" checked={maintenanceForm.is_oil_change} onChange={(e) => setMaintenanceForm((p) => ({ ...p, is_oil_change: e.target.checked }))} />
                  Esta manutenção inclui troca/complemento de óleo
                </label>

                {maintenanceForm.is_oil_change && (
                  <>
                    <input className="input" placeholder="Marca do óleo" value={maintenanceForm.oil_brand} onChange={(e) => setMaintenanceForm((p) => ({ ...p, oil_brand: e.target.value }))} required />
                    <input className="input" type="number" step="0.1" min="0" placeholder="Litros" value={maintenanceForm.quantity_liters} onChange={(e) => setMaintenanceForm((p) => ({ ...p, quantity_liters: e.target.value }))} required />
                    <select className="input" value={maintenanceForm.type} onChange={(e) => setMaintenanceForm((p) => ({ ...p, type: e.target.value }))}>
                      <option value="full_change">Troca completa</option>
                      <option value="top_up">Completar nível</option>
                    </select>
                    <input className="input" type="number" min="0" placeholder="Próxima troca (intervalo km)" value={maintenanceForm.next_change_km_interval} onChange={(e) => setMaintenanceForm((p) => ({ ...p, next_change_km_interval: sanitizeIntegerInput(e.target.value, { min: 0, max: 999999999, allowEmpty: true }) }))} />
                    <input className="input md:col-span-4" type="number" min="0" placeholder="Próxima troca (intervalo dias)" value={maintenanceForm.next_change_date_interval} onChange={(e) => setMaintenanceForm((p) => ({ ...p, next_change_date_interval: sanitizeIntegerInput(e.target.value, { min: 0, max: 99999, allowEmpty: true }) }))} />
                  </>
                )}

                <button type="submit" className="btn btn-primary md:col-span-4">Registrar manutenção</button>
              </form>

              <ul className="space-y-2">
                {maintenanceLogs.map((m) => (
                  <li key={m.id} className="border rounded p-3">
                    <div className="font-semibold">{new Date(m.date).toLocaleDateString('pt-BR')} • KM {formatNumber(m.odometer_at_maintenance, 0, 0)}</div>
                    <div className="text-sm text-gray-600">{m.description}</div>
                    {m.oil_change && (
                      <div className="text-sm text-blue-700 mt-1">
                        Óleo: {m.oil_change.oil_brand} • {m.oil_change.quantity_liters}L • {m.oil_change.type === 'full_change' ? 'Troca completa' : 'Completar nível'}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Seção de Viagens removida conforme solicitado */}

      <TransportEntryExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        initial={modalInitial}
        vehicleId={vehicle.id}
        onSaved={async () => {
          await refreshVehicle();
          const rev = await transportService.getRevenues(id);
          setRevenues(rev.results || rev);
          const exp = await transportService.getExpenses(id);
          setExpenses(exp.results || exp);
          const s = await transportService.getVehicleSummary(id);
          setSummary(s);
        }}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Confirma exclusão"
        message={confirmPayload ? (confirmPayload.kind === 'trip' ? 'Deseja excluir esta viagem?' : confirmPayload.kind === 'revenue' ? 'Deseja excluir esta entrada?' : 'Deseja excluir esta despesa?') : ''}
        confirmText="Excluir"
        cancelText="Cancelar"
        onCancel={() => { setConfirmOpen(false); setConfirmPayload(null); }}
        onConfirm={async () => {
          if (!confirmPayload) return;
          try {
            if (confirmPayload.kind === 'revenue') {
              await transportService.deleteRevenue(confirmPayload.id);
              const rev = await transportService.getRevenues(id);
              setRevenues(rev.results || rev);
            } else if (confirmPayload.kind === 'trip') {
              await transportService.deleteTrip(confirmPayload.id);
              await refreshTrips();
            } else {
              await transportService.deleteExpense(confirmPayload.id);
              const exp = await transportService.getExpenses(id);
              setExpenses(exp.results || exp);
            }
            const s = await transportService.getVehicleSummary(id);
            setSummary(s);
            toast('Registro removido', 'success');
          } catch (err) {
            console.error('Erro ao deletar registro', err);
            toast('Erro ao deletar registro', 'error');
          } finally {
            setConfirmOpen(false);
            setConfirmPayload(null);
          }
        }}
      />

      <TransportTripModal
        open={tripModalOpen}
        onClose={() => setTripModalOpen(false)}
        vehicleId={vehicle.id}
        initial={tripModalInitial}
        onSaved={async () => {
          await refreshVehicle();
          await refreshTrips();
          const s = await transportService.getVehicleSummary(id);
          setSummary(s);
        }}
      />
    </div>
  );
}
