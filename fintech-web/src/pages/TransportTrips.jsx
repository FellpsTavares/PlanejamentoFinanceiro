import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { transportService } from '../services/transport';
import LoadingOverlay from '../components/LoadingOverlay';
import { tenantParametersService } from '../services/tenantParameters';
import { transactionService } from '../services/transactions';
import { toast, extractApiError } from '../utils/toast';
import CurrencyInput from '../components/CurrencyInput';
import ConfirmModal from '../components/ConfirmModal';
import ToggleSwitch from '../components/ToggleSwitch';
import { formatDecimalString, formatQuantityDisplay, normalizeInputDecimal, formatApiDate, todayLocalISO } from '../utils/format';
import { multiplyDecimalStrings, subtractDecimalStrings } from '../utils/decimal';

const SearchIcon = (props) => (
  <svg className={props.className || 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0a7.5 7.5 0 10-10.607 0 7.5 7.5 0 0010.607 0z" />
  </svg>
);

const FilterIcon = (props) => (
  <svg className={props.className || 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5l-6.25 7.5v5.5l-4 2v-7.5l-6.25-7.5z" />
  </svg>
);

const ClearIcon = (props) => (
  <svg className={props.className || 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PencilIcon = (props) => (
  <svg className={props.className || 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.06 2.06 0 112.914 2.914L7.5 19.677l-4 1 1-4L16.862 4.487z" />
  </svg>
);

const TrashIcon = (props) => (
  <svg className={props.className || 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9.5 7V5a1 1 0 011-1h3a1 1 0 011 1v2m-7 0l.75 12.5a1 1 0 001 .95h5.5a1 1 0 001-.95L17 7" />
  </svg>
);

const FuelIcon = (props) => (
  <svg className={props.className || 'h-3.5 w-3.5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V5a1 1 0 011-1h6a1 1 0 011 1v16M4 21h8m0 0h4m-4 0v-8h2.5l2.85 2.85A1 1 0 0120 16.56V19a2 2 0 01-2 2h-1M6.5 8h4" />
  </svg>
);

const RefreshIcon = (props) => (
  <svg className={props.className || 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M19.5 9.5A7.5 7.5 0 106.34 15.66M4.5 14.5A7.5 7.5 0 0017.66 8.34" />
  </svg>
);

const CheckIcon = (props) => (
  <svg className={props.className || 'h-4 w-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const EMPTY_FUEL_FORM = {
  date: '',
  fuel_type: 'diesel',
  odometer_km: '',
  liters: '',
  price_per_liter: '',
  discount: '',
  paid_value: '',
  autoCalcPaidValue: true,
};

export default function TransportTrips() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const hasLoadedTripsRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');

  const [tripMovements, setTripMovements] = useState([]);
  const [progressTypeOptions, setProgressTypeOptions] = useState(['Coleta', 'Em trânsito', 'Descarga', 'Retorno']);

  const [movementDate, setMovementDate] = useState('');
  const [movementType, setMovementType] = useState('expense');
  // Categoria configurável (finance.Category) escolhida para o lançamento —
  // substituiu o enum fixo fuel/other. O padrão é a categoria "Outros Gastos"
  // (ver applyDefaultMovementCategory), não mais Combustível.
  const [movementCategoryId, setMovementCategoryId] = useState('');
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [editingMovementId, setEditingMovementId] = useState('');
  const [movementTab, setMovementTab] = useState('manual'); // 'manual' | 'fuel'
  const [fuelForm, setFuelForm] = useState(EMPTY_FUEL_FORM);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmDeleteMovement, setConfirmDeleteMovement] = useState(null);
  const [confirmReopenOpen, setConfirmReopenOpen] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [progressType, setProgressType] = useState('');
  const [initialKm, setInitialKm] = useState('');
  const [finalKm, setFinalKm] = useState('');
  const [description, setDescription] = useState('');
  const [isReceived, setIsReceived] = useState(false);
  const [filterReceived, setFilterReceived] = useState('all'); // 'all' | 'received' | 'not_received'
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [searching, setSearching] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const parseMoney = (value) => {
    if (!value) return 0;
    const str = String(value).trim();
    // Remove separadores de milhar (pontos) e converte vírgula decimal para ponto
    // Suporta: "2.155,00" → 2155.00, "2155,00" → 2155.00, "2155.5" → 2155.5
    return Number(str.replace(/\./g, '').replace(',', '.')) || 0;
  };
  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const tripDateForFilter = (trip) => {
    const d = trip.start_date || trip.date || trip.end_date || '';
    return String(d).slice(0, 10);
  };

  const tripInDateRange = (trip) => {
    if (!filterStartDate && !filterEndDate) return true;
    const d = tripDateForFilter(trip);
    if (!d) return false;
    const start = filterStartDate || filterEndDate || '';
    const end = filterEndDate || filterStartDate || '';
    if (!start || !end) return true;
    return d >= start && d <= end;
  };

  const tripMatchesSearch = (trip) => {
    // Filtro por veículo selecionado (a busca por texto/placa foi removida:
    // a seleção de veículo já cobre esse caso e evita erro de digitação na placa).
    if (!selectedVehicle || !String(selectedVehicle).trim()) return true;
    const sel = String(selectedVehicle).trim();
    const vehicleId = String(trip.vehicle_id || trip.vehicle || '').trim();
    const plate = String(trip.vehicle_plate || '').trim();
    return vehicleId === sel || plate === sel;
  };

  const loadTrips = async (params = {}) => {
    // Só mostra o overlay de página inteira no primeiro carregamento — chamadas
    // subsequentes (filtros, refresh após criar/editar lançamento) atualizam a
    // lista sem sumir com a tela.
    if (!hasLoadedTripsRef.current) setLoading(true);
    try {
      // garantir que, por padrão nesta UI, solicitemos a lista completa (no_page=1)
      const _params = { ...(params || {}) };
      if (!('no_page' in _params)) _params.no_page = '1';
      const data = await transportService.getTrips(_params);
      const items = data?.results || data || [];
      setTrips(items);
      const tripFromQuery = searchParams.get('trip');
      if (tripFromQuery && items.some((trip) => String(trip.id) === String(tripFromQuery))) {
        setSelectedTripId(String(tripFromQuery));
      } else if (!selectedTripId && items.length > 0) {
        const firstInProgress = items.find((trip) => trip.status === 'in_progress');
        const fallback = firstInProgress || items[0];
        setSelectedTripId(String(fallback.id));
      }
    } catch (err) {
      console.error('Erro ao carregar viagens', err);
      toast('Erro ao carregar viagens', 'error');
    } finally {
      setLoading(false);
      hasLoadedTripsRef.current = true;
    }
  };

  const loadVehicles = async () => {
    try {
      const data = await transportService.getVehicles();
      const items = data?.results || data || [];
      setVehicles(items);
    } catch (err) {
      console.error('Erro ao carregar veículos', err);
    }
  };

  const loadTransportSettings = async () => {
    try {
      const params = await tenantParametersService.getByModule('transport');
      const map = Object.fromEntries((params || []).map((p) => [p.key, p.value]));
      const parsed = String(map.TRIP_PROGRESS_TYPES || 'Coleta,Em trânsito,Descarga,Retorno')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parsed.length > 0) setProgressTypeOptions(parsed);
    } catch (err) {
      console.error('Erro ao carregar tipos de andamento', err);
    }
  };

  // Categorias de despesa configuráveis em Configurações > Categorias (usadas nos
  // lançamentos da viagem). Semeadas automaticamente por tenant: Combustível,
  // Outros Gastos e Salário/Comissão, mais quaisquer categorias personalizadas.
  const loadExpenseCategories = async () => {
    try {
      const data = await transactionService.getCategoriesByType();
      setExpenseCategories(data?.expense || []);
    } catch (err) {
      console.error('Erro ao carregar categorias de despesa', err);
    }
  };

  const findCategoryBySystemKey = (key) => expenseCategories.find((c) => c.system_key === key);

  // Categoria padrão do lançamento manual: "Outros Gastos" (não mais Combustível).
  // Se, por algum motivo, essa categoria padrão ainda não tiver sido carregada,
  // cai para a primeira categoria de despesa disponível.
  const defaultMovementCategoryId = () => {
    const other = findCategoryBySystemKey('other');
    if (other) return String(other.id);
    return expenseCategories[0] ? String(expenseCategories[0].id) : '';
  };

  const loadTripMovements = async (tripId) => {
    if (!tripId) {
      setTripMovements([]);
      return;
    }
    try {
      const data = await transportService.getTripMovements(tripId);
      setTripMovements(data || []);
    } catch (err) {
      console.error('Erro ao carregar lançamentos da viagem', err);
      toast('Erro ao carregar lançamentos da viagem', 'error');
    }
  };

  useEffect(() => {
    loadTrips();
    loadTransportSettings();
    loadVehicles();
    loadExpenseCategories();
  }, [searchParams]);

  // Preenche a categoria padrão assim que as categorias carregarem, caso nenhuma
  // já tenha sido escolhida (cobre o caso de a lista de categorias chegar depois
  // da seleção da viagem).
  useEffect(() => {
    if (!movementCategoryId && expenseCategories.length > 0) {
      setMovementCategoryId(defaultMovementCategoryId());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseCategories]);

  const runFilterSearch = async () => {
    try {
      setSearching(true);
      const params = {};
      if (selectedVehicle) params.vehicle = selectedVehicle;
      if (filterStartDate) params.start = filterStartDate;
      if (filterEndDate) params.end = filterEndDate;
      if (filterReceived && filterReceived !== 'all') params.is_received = filterReceived === 'received' ? '1' : '0';
      await loadTrips(params);
    } finally {
      setSearching(false);
    }
  };

  // auto-run search when selected vehicle or received filter changes
  useEffect(() => {
    runFilterSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle, filterReceived]);

  const selectedTrip = useMemo(() => {
    return trips.find((trip) => String(trip.id) === String(selectedTripId));
  }, [trips, selectedTripId]);

  const vehicleOptions = useMemo(() => {
    return (vehicles || []).map((v) => v.plate || v.registration || v.name || String(v.id));
  }, [vehicles]);

  // Mantém a última lista de viagens acessível sem forçar o efeito abaixo a
  // re-rodar toda vez que `trips`/`selectedTrip` mudam de referência (ex: após
  // adicionar/editar/excluir um lançamento). Sem isso, qualquer refresh da lista
  // reaplicava os valores salvos no servidor por cima de edições locais ainda
  // não salvas (ex: o toggle "já recebido" voltava a desmarcar sozinho).
  const tripsRef = useRef(trips);
  useEffect(() => { tripsRef.current = trips; }, [trips]);

  useEffect(() => {
    const trip = tripsRef.current.find((t) => String(t.id) === String(selectedTripId));
    if (!trip) return;
    setStartDate(trip.start_date || trip.date || '');
    setEndDate(trip.end_date || '');
    setProgressType(trip.progress_type || progressTypeOptions[0] || '');
    setInitialKm(trip.initial_km != null ? String(trip.initial_km) : '');
    setFinalKm(trip.final_km != null ? String(trip.final_km) : '');
    setDescription(trip.description || '');
    setIsReceived(Boolean(trip.is_received));
    setMovementDate(trip.start_date || trip.date || '');
    setMovementType('expense');
    setMovementCategoryId(defaultMovementCategoryId());
    setMovementAmount('');
    setMovementDescription('');
    setEditingMovementId('');
    setMovementTab('manual');
    setFuelForm({ ...EMPTY_FUEL_FORM, date: trip.start_date || trip.date || '' });
    loadTripMovements(trip.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTripId, progressTypeOptions]);

  const inProgressTrips = trips.filter((trip) => trip.status === 'in_progress');
  const completedTrips = trips.filter((trip) => trip.status === 'completed');

  const handleSaveProgress = async () => {
    if (!selectedTrip) return;
    try {
      setSaving(true);
      const payload = {
        start_date: startDate || null,
        end_date: endDate || null,
        progress_type: progressType || '',
        initial_km: initialKm === '' ? null : Number(initialKm),
        final_km: finalKm === '' ? null : Number(finalKm),
        description,
        is_received: isReceived,
      };
      await transportService.updateTrip(selectedTrip.id, payload);
      toast('Andamento da viagem atualizado', 'success');
      await loadTrips();
    } catch (err) {
      console.error('Erro ao salvar andamento', err);
      toast('Erro ao salvar andamento da viagem', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTrip = async () => {
    if (!selectedTrip) return;
    // Final KM is optional for closing a trip. If not provided, we keep it null.

    try {
      setSaving(true);
      const payload = {
        start_date: startDate || null,
        // Se a data final não foi informada, considera igual à data de início
        // (o backend também garante essa regra, mas replicamos aqui para refletir
        // o valor correto imediatamente na tela sem esperar o reload).
        end_date: endDate || startDate || todayLocalISO(),
        progress_type: progressType || '',
        initial_km: initialKm === '' ? null : Number(initialKm),
        final_km: finalKm === '' ? null : Number(finalKm),
        description,
        is_received: isReceived,
        status: 'completed',
      };
      await transportService.updateTrip(selectedTrip.id, payload);
      toast('Viagem encerrada com sucesso', 'success');
      await loadTrips();
    } catch (err) {
      console.error('Erro ao encerrar viagem', err);
      toast('Erro ao encerrar viagem', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReopenTrip = async () => {
    if (!selectedTrip) return;

    try {
      setSaving(true);
      const payload = {
        status: 'in_progress',
      };
      await transportService.updateTrip(selectedTrip.id, payload);
      toast('Viagem reaberta com sucesso', 'success');
      await loadTrips();
    } catch (err) {
      console.error('Erro ao reabrir viagem', err);
      toast('Erro ao reabrir viagem', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMovement = async () => {
    if (!selectedTrip) return;
    const selectedCategory = expenseCategories.find((c) => String(c.id) === String(movementCategoryId));
    // Descrição é obrigatória, exceto para combustível ou categorias que já têm
    // uma descrição padrão configurada (Configurações > Categorias) — mesma regra
    // aplicada no backend (TripMovementSerializer.validate).
    const requiresDescription = !(
      movementType === 'expense'
      && (selectedCategory?.system_key === 'fuel' || Boolean(selectedCategory?.default_entry_description))
    );

    if (!movementDate || !movementAmount || (movementType === 'expense' && !movementCategoryId) || (requiresDescription && !movementDescription.trim())) {
      toast('Informe data, categoria e valor. Descrição é obrigatória, exceto quando a categoria já tem uma padrão.', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        date: movementDate,
        movement_type: movementType,
        category: movementType === 'expense' ? movementCategoryId : null,
        amount: parseMoney(movementAmount),
        description: movementDescription.trim(),
      };

      if (editingMovementId) {
        await transportService.updateTripMovement(selectedTrip.id, editingMovementId, payload);
        toast('Lançamento atualizado', 'success');
      } else {
        await transportService.createTripMovement(selectedTrip.id, payload);
        toast('Lançamento adicionado', 'success');
      }

      setMovementAmount('');
      setMovementDescription('');
      setMovementDate(selectedTrip.start_date || selectedTrip.date || '');
      setMovementType('expense');
      setMovementCategoryId(defaultMovementCategoryId());
      setEditingMovementId('');
      await loadTripMovements(selectedTrip.id);
      const refreshedTrip = await transportService.getTrip(selectedTrip.id);
      setTrips((prev) => prev.map((item) => (String(item.id) === String(refreshedTrip.id) ? refreshedTrip : item)));
    } catch (err) {
      console.error('Erro ao adicionar lançamento', err);
      toast('Erro ao adicionar lançamento', 'error');
    } finally {
      setSaving(false);
    }
  };

  const fuelPreviewPaidValue = (() => {
    if (!fuelForm.autoCalcPaidValue) return fuelForm.paid_value;
    const gross = multiplyDecimalStrings(fuelForm.liters || '0', fuelForm.price_per_liter || '0');
    const net = subtractDecimalStrings(gross, fuelForm.discount || '0');
    // CurrencyInput (Cleave) espera formato BR (vírgula); as funções de decimal.js
    // retornam ponto decimal cru.
    return formatDecimalString(net, 2);
  })();

  // Registra o abastecimento (histórico do veículo, conta pra média de consumo) e já
  // lança o valor pago como despesa de combustível nesta viagem — um envio só, dois
  // registros independentes (editar o abastecimento depois não altera a despesa já
  // lançada, e vice-versa).
  const handleAddFuelMovement = async (e) => {
    e.preventDefault();
    if (!selectedTrip) return;
    if (!fuelForm.date) { toast('Informe a data do abastecimento', 'error'); return; }
    if (!fuelForm.liters) { toast('Informe a quantidade de litros', 'error'); return; }
    if (!fuelForm.odometer_km) { toast('Informe a quilometragem atual', 'error'); return; }

    try {
      setSaving(true);
      const liters = normalizeInputDecimal(fuelForm.liters || '0');
      const pricePerLiter = normalizeInputDecimal(fuelForm.price_per_liter || '0');
      const discount = normalizeInputDecimal(fuelForm.discount || '0');

      const fuelPayload = {
        vehicle: selectedTrip.vehicle_id || selectedTrip.vehicle,
        date: fuelForm.date,
        fuel_type: fuelForm.fuel_type,
        odometer_km: Number(fuelForm.odometer_km || 0),
        liters,
        price_per_liter: pricePerLiter || null,
        discount,
      };
      if (!fuelForm.autoCalcPaidValue) {
        fuelPayload.paid_value = normalizeInputDecimal(fuelForm.paid_value || '0');
      }

      const createdFuelLog = await transportService.createFuelLog(fuelPayload);
      const expenseAmount = createdFuelLog.paid_value != null
        ? Number(createdFuelLog.paid_value)
        : Number(subtractDecimalStrings(multiplyDecimalStrings(liters, pricePerLiter), discount));

      await transportService.createTripMovement(selectedTrip.id, {
        date: fuelForm.date,
        movement_type: 'expense',
        category: findCategoryBySystemKey('fuel')?.id,
        amount: expenseAmount,
        description: `Abastecimento (${fuelForm.fuel_type === 'diesel' ? 'Diesel' : 'Arla'}) — ${formatQuantityDisplay(liters)} L`,
      });

      toast('Abastecimento registrado e despesa lançada na viagem', 'success');
      setFuelForm({ ...EMPTY_FUEL_FORM, date: selectedTrip.start_date || selectedTrip.date || '' });
      await loadTripMovements(selectedTrip.id);
      const refreshedTrip = await transportService.getTrip(selectedTrip.id);
      setTrips((prev) => prev.map((item) => (String(item.id) === String(refreshedTrip.id) ? refreshedTrip : item)));
    } catch (err) {
      console.error('Erro ao registrar abastecimento', err);
      toast(extractApiError(err, 'Erro ao registrar abastecimento'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditMovement = (movement) => {
    setEditingMovementId(String(movement.id));
    setMovementDate(movement.date);
    setMovementType(movement.movement_type);
    setMovementCategoryId(movement.category ? String(movement.category) : defaultMovementCategoryId());
    // CurrencyInput (Cleave) espera vírgula decimal/ponto de milhar (formato BR);
    // a API retorna o valor com ponto decimal cru.
    setMovementAmount(movement.amount != null ? formatDecimalString(movement.amount, 2) : '');
    setMovementDescription(movement.description || '');
  };

  const handleDeleteMovement = async (movement) => {
    if (!selectedTrip) return;

    try {
      setSaving(true);
      await transportService.deleteTripMovement(selectedTrip.id, movement.id);
      toast('Lançamento excluído', 'success');
      if (String(editingMovementId) === String(movement.id)) {
        setEditingMovementId('');
        setMovementDate(selectedTrip.start_date || selectedTrip.date || '');
        setMovementType('expense');
        setMovementCategoryId(defaultMovementCategoryId());
        setMovementAmount('');
        setMovementDescription('');
      }
      await loadTripMovements(selectedTrip.id);
      const refreshedTrip = await transportService.getTrip(selectedTrip.id);
      setTrips((prev) => prev.map((item) => (String(item.id) === String(refreshedTrip.id) ? refreshedTrip : item)));
    } catch (err) {
      console.error('Erro ao excluir lançamento', err);
      toast('Erro ao excluir lançamento', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="Carregando viagens..." />;
  }

  const inProgressFiltered = inProgressTrips.filter((t) => tripInDateRange(t) && tripMatchesSearch(t));
  const completedFiltered = completedTrips.filter((t) => tripInDateRange(t) && tripMatchesSearch(t));
  const carouselTrips = showCompleted ? completedFiltered : inProgressFiltered;

  const renderTripCard = (trip) => {
    const isSelected = String(selectedTripId) === String(trip.id);
    const isCompleted = trip.status === 'completed';
    const stageIndex = progressTypeOptions.indexOf(trip.progress_type);
    const progressPct = isCompleted
      ? 100
      : (stageIndex >= 0 ? Math.round(((stageIndex + 1) / progressTypeOptions.length) * 100) : 0);
    const cardDate = isCompleted ? (trip.end_date || trip.date) : (trip.start_date || trip.date);
    return (
      <button
        key={trip.id}
        type="button"
        onClick={() => setSelectedTripId(String(trip.id))}
        className={`shrink-0 text-left w-44 p-3 rounded-lg border transition-colors ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-semibold text-sm text-gray-900 truncate">{trip.vehicle_plate || '—'}</span>
          <span className={`h-2 w-2 rounded-full shrink-0 ${trip.status === 'in_progress' ? 'bg-green-500' : 'bg-gray-400'}`} />
        </div>
        <div className="text-xs text-gray-500 mb-2 truncate">
          {formatApiDate(cardDate)} · {trip.modality === 'per_ton' ? 'Por Tonelada' : 'Arrendamento'}
        </div>
        <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progressPct}%` }} />
        </div>
      </button>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gerenciar Viagens</h1>
          <p className="text-sm text-gray-600">Acompanhe viagens em andamento e faça lançamentos enquanto estão em curso.</p>
        </div>
        <Link to="/transportadora/viagens/nova" className="btn btn-primary">Nova Viagem</Link>
      </div>

      <div className="card p-3 relative z-20">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-sm font-semibold text-gray-700">
            {showCompleted ? `Concluídas · ${completedFiltered.length}` : `Em andamento · ${inProgressFiltered.length}`}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
              onClick={() => setShowCompleted((s) => !s)}
            >
              {showCompleted ? '← Ver em andamento' : `Ver concluídas (${completedFiltered.length}) →`}
            </button>

            <div className="h-5 w-px bg-gray-200" />

            <div className="relative">
              <button
                type="button"
                aria-label="Buscar viagem"
                className={`h-9 w-9 rounded-md border flex items-center justify-center ${searchOpen ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white hover:bg-gray-50 text-gray-600'}`}
                onClick={() => { setSearchOpen((o) => !o); setFiltersOpen(false); }}
              >
                <SearchIcon />
              </button>
              {searchOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setSearchOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 w-72 max-w-[90vw] bg-white border rounded-lg shadow-lg p-3">
                    <label className="text-xs text-gray-600 font-medium">Filtrar por veículo</label>
                    <select
                      aria-label="Selecionar veículo"
                      className="input input-sm w-full mt-1"
                      value={selectedVehicle}
                      onChange={(e) => setSelectedVehicle(e.target.value)}
                      autoFocus
                    >
                      <option value="">Todos os veículos</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.plate || v.name || `#${v.id}`}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                aria-label="Filtros"
                className={`h-9 w-9 rounded-md border flex items-center justify-center ${filtersOpen ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white hover:bg-gray-50 text-gray-600'}`}
                onClick={() => { setFiltersOpen((o) => !o); setSearchOpen(false); }}
              >
                <FilterIcon />
              </button>
              {filtersOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setFiltersOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-40 w-80 max-w-[90vw] bg-white border rounded-lg shadow-lg p-3 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:gap-3 gap-2">
                      <div className="flex flex-col flex-1">
                        <label className="text-xs text-gray-600">Data início</label>
                        <input
                          type="date"
                          aria-label="Data início"
                          className="input input-sm w-full"
                          value={filterStartDate}
                          onChange={(e) => setFilterStartDate(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col flex-1">
                        <label className="text-xs text-gray-600">Data fim</label>
                        <input
                          type="date"
                          aria-label="Data fim"
                          className="input input-sm w-full"
                          value={filterEndDate}
                          onChange={(e) => setFilterEndDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Filtrar por recebido"
                        className="input input-sm flex-1"
                        value={filterReceived}
                        onChange={(e) => setFilterReceived(e.target.value)}
                      >
                        <option value="all">Todos</option>
                        <option value="received">Recebidas</option>
                        <option value="not_received">Não recebidas</option>
                      </select>
                      <button
                        type="button"
                        aria-label="Pesquisar"
                        className="h-9 px-3 rounded-md bg-white border hover:bg-gray-50 flex items-center justify-center"
                        onClick={runFilterSearch}
                        disabled={searching}
                      >
                        {searching ? (
                          <svg className="animate-spin h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                          </svg>
                        ) : (
                          <SearchIcon className="h-4 w-4 text-gray-600" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label="Limpar filtros"
                        className="h-9 px-2 rounded-md bg-white border hover:bg-gray-50 flex items-center justify-center"
                        onClick={async () => {
                          setSelectedVehicle('');
                          setFilterStartDate('');
                          setFilterEndDate('');
                          setFilterReceived('all');
                          await loadTrips();
                        }}
                      >
                        <ClearIcon className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto flex-nowrap pb-1">
          {carouselTrips.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              {showCompleted ? 'Nenhuma viagem encerrada.' : 'Nenhuma viagem em andamento.'}
            </p>
          ) : carouselTrips.map((trip) => renderTripCard(trip))}
        </div>
      </div>

      {!selectedTrip ? (
        <div className="card p-6 text-center text-sm text-gray-500">Selecione uma viagem para gerenciar.</div>
      ) : (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Veículo</div>
                <div className="text-lg font-bold text-gray-900">{selectedTrip.vehicle_plate || '—'}</div>
                {selectedTrip.vehicle_model && (
                  <div className="text-sm text-gray-600">{selectedTrip.vehicle_model}</div>
                )}
              </div>
              {selectedTrip.status === 'in_progress' ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Em curso</span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">Encerrada</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {selectedTrip.modality === 'per_ton' && (
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Valor por tonelada</div>
                  <div className="text-base font-bold text-gray-900">{formatBRL(selectedTrip.rate_per_ton)}</div>
                  <div className="text-xs text-gray-500">{formatQuantityDisplay(selectedTrip.tons)} ton informadas</div>
                </div>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => navigate(`/transportadora/viagens/nova?trip=${selectedTrip.id}`)}
              >
                Abrir edição completa
              </button>
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Andamento da viagem</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium">Data início</label>
                <input type="date" className="input-field w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} />
              </div>
              <div>
                <label className="block text-sm font-medium">Data fim</label>
                <input type="date" className="input-field w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} />
              </div>
              <div>
                <label className="block text-sm font-medium">Andamento da viagem</label>
                <select className="input-field w-full" value={progressType} onChange={(e) => setProgressType(e.target.value)} disabled={selectedTrip.status !== 'in_progress'}>
                  <option value="">Selecione...</option>
                  {progressTypeOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-sm font-medium">KM inicial</label>
                <input className="input-field w-full" value={initialKm} onChange={(e) => setInitialKm(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} />
              </div>
              <div>
                <label className="block text-sm font-medium">KM final</label>
                <input className="input-field w-full" value={finalKm} onChange={(e) => setFinalKm(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} />
              </div>
              <div className="pb-2">
                <ToggleSwitch
                  checked={isReceived}
                  onChange={setIsReceived}
                  label="Valor da viagem já recebido"
                  disabled={selectedTrip.status !== 'in_progress'}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Observações da viagem</label>
              <textarea className="input-field w-full" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} />
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              {selectedTrip.status === 'in_progress' ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={handleSaveProgress} disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar andamento'}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleCompleteTrip} disabled={saving}>
                    Encerrar viagem
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-gray-600">Esta viagem já foi encerrada.</p>
                  <button type="button" className="btn btn-secondary" onClick={() => setConfirmReopenOpen(true)} disabled={saving}>
                    <RefreshIcon className="h-4 w-4" />
                    {saving ? 'Reabrindo...' : 'Reabrir viagem'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 space-y-4">
              <div className="card border-t-4 border-t-blue-600 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">Novo Lançamento</h3>
                  {selectedTrip.status === 'in_progress' && (
                    <div className="inline-flex border rounded-md p-0.5 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => setMovementTab('manual')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded ${movementTab === 'manual' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        Gasto / Receita
                      </button>
                      <button
                        type="button"
                        onClick={() => setMovementTab('fuel')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded inline-flex items-center gap-1 ${movementTab === 'fuel' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        <FuelIcon />
                        Abastecimento
                      </button>
                    </div>
                  )}
                </div>

                {(movementTab === 'manual' || selectedTrip.status !== 'in_progress') && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-sm font-medium">Data</label>
                        <input type="date" className="input-field w-full" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Tipo</label>
                        <select className="input-field w-full" value={movementType} onChange={(e) => setMovementType(e.target.value)} disabled={selectedTrip.status !== 'in_progress'}>
                          <option value="expense">Gasto</option>
                          <option value="revenue">Recebimento</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Categoria</label>
                        <select
                          className="input-field w-full"
                          value={movementCategoryId}
                          onChange={(e) => {
                            const categoryId = e.target.value;
                            setMovementCategoryId(categoryId);
                            // Categorias de preço fixo (ex.: pedágio) podem trazer valor e
                            // descrição padrão configurados em Configurações > Categorias;
                            // preenchemos automaticamente, mas o usuário ainda pode ajustar.
                            const category = expenseCategories.find((c) => String(c.id) === String(categoryId));
                            if (category?.default_amount != null) {
                              setMovementAmount(formatDecimalString(category.default_amount, 2));
                            }
                            if (category?.default_entry_description) {
                              setMovementDescription(category.default_entry_description);
                            }
                          }}
                          disabled={selectedTrip.status !== 'in_progress' || movementType !== 'expense'}
                        >
                          <option value="">Selecione...</option>
                          {expenseCategories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Valor (R$)</label>
                        <CurrencyInput className="input-field w-full" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium">Descrição do gasto/recebimento</label>
                      <input className="input-field w-full" value={movementDescription} onChange={(e) => setMovementDescription(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} placeholder="Opcional para combustível ou categorias com descrição padrão. Obrigatória para os demais." />
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end">
                      {editingMovementId && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditingMovementId('');
                            setMovementDate(selectedTrip.start_date || selectedTrip.date || '');
                            setMovementType('expense');
                            setMovementCategoryId(defaultMovementCategoryId());
                            setMovementAmount('');
                            setMovementDescription('');
                          }}
                          disabled={saving || selectedTrip.status !== 'in_progress'}
                        >
                          Cancelar edição
                        </button>
                      )}
                      <button type="button" className="btn btn-primary" onClick={handleAddMovement} disabled={saving || selectedTrip.status !== 'in_progress'}>
                        {editingMovementId ? 'Salvar edição do lançamento' : 'Adicionar Lançamento'}
                      </button>
                    </div>
                  </>
                )}

                {movementTab === 'fuel' && selectedTrip.status === 'in_progress' && (
                  <form onSubmit={handleAddFuelMovement} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-sm font-medium">Data</label>
                        <input type="date" className="input-field w-full" value={fuelForm.date} onChange={(e) => setFuelForm((p) => ({ ...p, date: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Tipo de combustível</label>
                        <select className="input-field w-full" value={fuelForm.fuel_type} onChange={(e) => setFuelForm((p) => ({ ...p, fuel_type: e.target.value }))}>
                          <option value="diesel">Diesel</option>
                          <option value="arla">Arla</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Litros</label>
                        <input className="input-field w-full" inputMode="decimal" pattern="[0-9]+([\.,][0-9]+)?" step="0.001" value={fuelForm.liters} onChange={(e) => setFuelForm((p) => ({ ...p, liters: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">KM atual</label>
                        <input type="number" min="0" className="input-field w-full" value={fuelForm.odometer_km} onChange={(e) => setFuelForm((p) => ({ ...p, odometer_km: e.target.value }))} required />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium">Valor por litro</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                          <CurrencyInput className="input-field w-full" style={{ paddingLeft: '2.75rem' }} value={fuelForm.price_per_liter} onChange={(e) => setFuelForm((p) => ({ ...p, price_per_liter: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Desconto</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                          <CurrencyInput className="input-field w-full" style={{ paddingLeft: '2.75rem' }} value={fuelForm.discount} onChange={(e) => setFuelForm((p) => ({ ...p, discount: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Valor pago</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                          <CurrencyInput
                            className="input-field w-full"
                            style={{ paddingLeft: '2.75rem' }}
                            value={fuelPreviewPaidValue}
                            disabled={fuelForm.autoCalcPaidValue}
                            onChange={(e) => setFuelForm((p) => ({ ...p, paid_value: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <ToggleSwitch
                      checked={fuelForm.autoCalcPaidValue}
                      onChange={(checked) => setFuelForm((p) => ({ ...p, autoCalcPaidValue: checked }))}
                      label="Calcular valor pago automaticamente"
                    />

                    <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 flex items-start gap-1.5">
                      <CheckIcon className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>Isso registra o abastecimento no histórico do veículo (conta pra média de consumo) e já lança o valor pago como despesa "Combustível" nesta viagem.</span>
                    </p>

                    <button type="submit" className="btn btn-secondary" disabled={saving}>
                      {saving ? 'Registrando...' : 'Registrar abastecimento e lançar despesa'}
                    </button>
                  </form>
                )}
              </div>

              <div className="card p-4">
                <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
                  <div className="px-2">
                    <div className="text-xs text-gray-500 font-medium">Bruto</div>
                    <div className="text-lg font-bold text-gray-900">{formatBRL(selectedTrip.total_value)}</div>
                  </div>
                  <div className="px-2">
                    <div className="text-xs text-gray-500 font-medium">Despesas</div>
                    <div className="text-lg font-bold text-red-600">{formatBRL(selectedTrip.expense_value)}</div>
                  </div>
                  <div className="px-2">
                    <div className="text-xs text-gray-500 font-medium">Líquido</div>
                    <div className="text-lg font-bold text-green-600">{formatBRL(selectedTrip.net_value)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 card p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Lançamentos recentes</h3>
              <div className="max-h-[560px] overflow-y-auto">
                {tripMovements.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhum lançamento para esta viagem.</p>
                ) : tripMovements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {movement.description || (movement.movement_type === 'expense' ? 'Gasto' : 'Recebimento')}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {movement.category_name ? `${movement.category_name} · ` : ''}{formatApiDate(movement.date, '')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-sm font-semibold ${movement.movement_type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                        {movement.movement_type === 'expense' ? '-' : '+'} {formatBRL(movement.amount)}
                      </span>
                      {selectedTrip.status === 'in_progress' && (
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            aria-label="Editar lançamento"
                            className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
                            onClick={() => handleEditMovement(movement)}
                            disabled={saving}
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            aria-label="Excluir lançamento"
                            className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                            onClick={() => setConfirmDeleteMovement(movement)}
                            disabled={saving}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmDeleteMovement)}
        title="Excluir lançamento"
        message="Deseja excluir este lançamento? Essa ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        onCancel={() => setConfirmDeleteMovement(null)}
        onConfirm={async () => {
          const movement = confirmDeleteMovement;
          setConfirmDeleteMovement(null);
          if (movement) await handleDeleteMovement(movement);
        }}
      />

      <ConfirmModal
        open={confirmReopenOpen}
        title="Reabrir viagem"
        message='Ela voltará ao status "Em curso" e poderá receber novos lançamentos.'
        confirmText="Reabrir"
        cancelText="Cancelar"
        variant="info"
        onCancel={() => setConfirmReopenOpen(false)}
        onConfirm={async () => {
          setConfirmReopenOpen(false);
          await handleReopenTrip();
        }}
      />
    </div>
  );
}
