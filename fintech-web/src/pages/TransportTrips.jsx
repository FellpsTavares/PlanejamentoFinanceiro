import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { transportService } from '../services/transport';
import { tenantParametersService } from '../services/tenantParameters';
import { toast } from '../utils/toast';

export default function TransportTrips() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');

  const [tripMovements, setTripMovements] = useState([]);
  const [progressTypeOptions, setProgressTypeOptions] = useState(['Coleta', 'Em trânsito', 'Descarga', 'Retorno']);

  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [movementType, setMovementType] = useState('expense');
  const [movementExpenseCategory, setMovementExpenseCategory] = useState('fuel');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [editingMovementId, setEditingMovementId] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [progressType, setProgressType] = useState('');
  const [initialKm, setInitialKm] = useState('');
  const [finalKm, setFinalKm] = useState('');
  const [description, setDescription] = useState('');
  const [isReceived, setIsReceived] = useState(false);

  const parseMoney = (value) => Number(String(value || '0').replace(',', '.'));
  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const loadTrips = async () => {
    setLoading(true);
    try {
      const data = await transportService.getTrips();
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
  }, [searchParams]);

  const selectedTrip = useMemo(() => {
    return trips.find((trip) => String(trip.id) === String(selectedTripId));
  }, [trips, selectedTripId]);

  useEffect(() => {
    if (!selectedTrip) return;
    setStartDate(selectedTrip.start_date || selectedTrip.date || '');
    setEndDate(selectedTrip.end_date || '');
    setProgressType(selectedTrip.progress_type || progressTypeOptions[0] || '');
    setInitialKm(selectedTrip.initial_km != null ? String(selectedTrip.initial_km) : '');
    setFinalKm(selectedTrip.final_km != null ? String(selectedTrip.final_km) : '');
    setDescription(selectedTrip.description || '');
    setIsReceived(Boolean(selectedTrip.is_received));
    setMovementDate(new Date().toISOString().slice(0, 10));
    setMovementType('expense');
    setMovementExpenseCategory('fuel');
    setMovementAmount('');
    setMovementDescription('');
    setEditingMovementId('');
    loadTripMovements(selectedTrip.id);
  }, [selectedTripId, selectedTrip, progressTypeOptions]);

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
    if (finalKm === '') {
      toast('Informe a quilometragem final para encerrar a viagem', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        start_date: startDate || null,
        end_date: endDate || new Date().toISOString().slice(0, 10),
        progress_type: progressType || '',
        initial_km: initialKm === '' ? null : Number(initialKm),
        final_km: Number(finalKm),
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

  const handleAddMovement = async () => {
    if (!selectedTrip) return;
    const requiresDescription = !(movementType === 'expense' && movementExpenseCategory === 'fuel');

    if (!movementDate || !movementAmount || (requiresDescription && !movementDescription.trim())) {
      toast('Informe data e valor. Descrição é obrigatória exceto para combustível.', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        date: movementDate,
        movement_type: movementType,
        expense_category: movementType === 'expense' ? movementExpenseCategory : '',
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
      setMovementDate(new Date().toISOString().slice(0, 10));
      setMovementType('expense');
      setMovementExpenseCategory('fuel');
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

  const handleEditMovement = (movement) => {
    setEditingMovementId(String(movement.id));
    setMovementDate(movement.date);
    setMovementType(movement.movement_type);
    setMovementExpenseCategory(movement.expense_category || 'fuel');
    setMovementAmount(String(movement.amount));
    setMovementDescription(movement.description || '');
  };

  const handleDeleteMovement = async (movement) => {
    if (!selectedTrip) return;
    if (!window.confirm('Deseja excluir este lançamento?')) return;

    try {
      setSaving(true);
      await transportService.deleteTripMovement(selectedTrip.id, movement.id);
      toast('Lançamento excluído', 'success');
      if (String(editingMovementId) === String(movement.id)) {
        setEditingMovementId('');
        setMovementDate(new Date().toISOString().slice(0, 10));
        setMovementType('expense');
        setMovementExpenseCategory('fuel');
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
    return <div className="p-6">Carregando viagens...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gerenciar Viagens</h1>
          <p className="text-sm text-gray-600">Acompanhe viagens em andamento e faça lançamentos enquanto estão em curso.</p>
        </div>
        <Link to="/transport/trips/new" className="btn btn-primary">Nova Viagem</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 border rounded lg:col-span-1">
          <h2 className="text-base font-semibold mb-3">Em curso ({inProgressTrips.length})</h2>
          <div className="space-y-2">
            {inProgressTrips.length === 0 && <p className="text-sm text-gray-500">Nenhuma viagem em andamento.</p>}
            {inProgressTrips.map((trip) => (
              <button
                key={trip.id}
                type="button"
                onClick={() => setSelectedTripId(String(trip.id))}
                className={`w-full text-left p-3 rounded border ${String(selectedTripId) === String(trip.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="font-medium">{trip.modality === 'per_ton' ? 'Por Tonelada' : 'Arrendamento'}</div>
                <div className="text-xs text-gray-600">Data: {trip.date ? new Date(trip.date).toLocaleDateString('pt-BR') : '—'}</div>
                <div className="text-xs text-gray-600">Início: {trip.start_date ? new Date(trip.start_date).toLocaleDateString('pt-BR') : '—'}</div>
                <div className="text-xs text-gray-600">Total: {formatBRL(trip.total_value)}</div>
              </button>
            ))}
          </div>

          <h2 className="text-base font-semibold mt-5 mb-3">Encerradas ({completedTrips.length})</h2>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {completedTrips.length === 0 && <p className="text-sm text-gray-500">Nenhuma viagem encerrada.</p>}
            {completedTrips.map((trip) => (
              <button
                key={trip.id}
                type="button"
                onClick={() => setSelectedTripId(String(trip.id))}
                className={`w-full text-left p-3 rounded border ${String(selectedTripId) === String(trip.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="font-medium">{trip.modality === 'per_ton' ? 'Por Tonelada' : 'Arrendamento'}</div>
                <div className="text-xs text-gray-600">Data: {trip.date ? new Date(trip.date).toLocaleDateString('pt-BR') : '—'}</div>
                <div className="text-xs text-gray-600">Fim: {trip.end_date ? new Date(trip.end_date).toLocaleDateString('pt-BR') : '—'}</div>
                <div className="text-xs text-gray-600">Líquido: {formatBRL(trip.net_value)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 border rounded lg:col-span-2">
          {!selectedTrip ? (
            <p className="text-sm text-gray-500">Selecione uma viagem para gerenciar.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Viagem {selectedTrip.status === 'in_progress' ? 'em curso' : 'encerrada'}
                </h2>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate(`/transport/trips/new?trip=${selectedTrip.id}`)}
                >
                  Abrir edição completa
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="p-3 border rounded">
                  <div className="text-gray-500">Receita</div>
                  <div className="font-semibold">{formatBRL(selectedTrip.total_value)}</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-gray-500">Despesa acumulada</div>
                  <div className="font-semibold">{formatBRL(selectedTrip.expense_value)}</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-gray-500">Valor líquido da viagem</div>
                  <div className="font-semibold">{formatBRL(selectedTrip.net_value)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">KM inicial</label>
                  <input className="input-field w-full" value={initialKm} onChange={(e) => setInitialKm(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} />
                </div>
                <div>
                  <label className="block text-sm font-medium">KM final</label>
                  <input className="input-field w-full" value={finalKm} onChange={(e) => setFinalKm(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={isReceived} onChange={(e) => setIsReceived(e.target.checked)} disabled={selectedTrip.status !== 'in_progress'} />
                    Valor da viagem já recebido
                  </label>
                </div>
              </div>

              <div className="border rounded p-3 space-y-3">
                <h3 className="font-semibold">Lançar movimentação da viagem</h3>
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
                    <select className="input-field w-full" value={movementExpenseCategory} onChange={(e) => setMovementExpenseCategory(e.target.value)} disabled={selectedTrip.status !== 'in_progress' || movementType !== 'expense'}>
                      <option value="fuel">Combustível</option>
                      <option value="other">Outros gastos</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Valor (R$)</label>
                    <input className="input-field w-full" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium">Descrição do gasto/recebimento</label>
                  <input className="input-field w-full" value={movementDescription} onChange={(e) => setMovementDescription(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} placeholder="Opcional para combustível. Obrigatória para os demais." />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-secondary" onClick={handleAddMovement} disabled={saving || selectedTrip.status !== 'in_progress'}>
                    {editingMovementId ? 'Salvar edição do lançamento' : 'Adicionar lançamento'}
                  </button>
                  {editingMovementId && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditingMovementId('');
                        setMovementDate(new Date().toISOString().slice(0, 10));
                        setMovementType('expense');
                        setMovementExpenseCategory('fuel');
                        setMovementAmount('');
                        setMovementDescription('');
                      }}
                      disabled={saving || selectedTrip.status !== 'in_progress'}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {tripMovements.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum lançamento para esta viagem.</p>
                  ) : tripMovements.map((movement) => (
                    <div key={movement.id} className="border rounded p-2 text-sm flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{movement.movement_type === 'expense' ? 'Gasto' : 'Recebimento'} {movement.expense_category === 'fuel' ? '• Combustível' : movement.expense_category === 'other' ? '• Outros' : ''}</div>
                        <div className="text-gray-600">{movement.description || 'Sem descrição'}</div>
                        <div className="text-xs text-gray-500">{new Date(movement.date).toLocaleDateString('pt-BR')}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`font-semibold ${movement.movement_type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                          {movement.movement_type === 'expense' ? '-' : '+'} {formatBRL(movement.amount)}
                        </div>
                        {selectedTrip.status === 'in_progress' && (
                          <>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleEditMovement(movement)} disabled={saving}>Editar</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDeleteMovement(movement)} disabled={saving}>Excluir</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Observações da viagem</label>
                <textarea className="input-field w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={selectedTrip.status !== 'in_progress'} />
              </div>

              <div className="flex flex-wrap gap-2">
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
                  <p className="text-sm text-gray-600">Esta viagem já foi encerrada.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
