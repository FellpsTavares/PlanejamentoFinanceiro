import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { transportService } from '../services/transport';
import api from '../services/api';
import TransportEntryExpenseModal from '../components/TransportEntryExpenseModal';
import ConfirmModal from '../components/ConfirmModal';
import TransportTripModal from '../components/TransportTripModal';
import { toast } from '../utils/toast';

export default function TransportVehicleProfile() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revenues, setRevenues] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [trips, setTrips] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [modalInitial, setModalInitial] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null);
  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [tripModalInitial, setTripModalInitial] = useState(null);

  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatNumber = (value, minimumFractionDigits = 0, maximumFractionDigits = 3) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits, maximumFractionDigits });

  const refreshTrips = async () => {
    const tripData = await transportService.getTrips({ vehicle: id });
    setTrips(tripData.results || tripData);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/transport/vehicles/${id}/`);
        setVehicle(res.data);
        const s = await transportService.getVehicleSummary(id);
        setSummary(s);
        const rev = await transportService.getRevenues(id);
        setRevenues(rev.results || rev);
        const exp = await transportService.getExpenses(id);
        setExpenses(exp.results || exp);
        await refreshTrips();
      } catch (err) {
        console.error('Erro carregando veículo', err);
        setError(err?.response?.data || err.message || 'Erro ao carregar veículo.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <div className="p-6">Carregando...</div>;
  if (error) return <div className="p-6 text-red-600">Erro: {typeof error === 'string' ? error : JSON.stringify(error)}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{vehicle.plate} — {vehicle.model}</h1>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="p-4 border rounded">
          <div className="text-sm text-gray-600">Média de Consumo</div>
          <div className="text-xl font-semibold">{vehicle.avg_consumption ? `${vehicle.avg_consumption} km/l` : '—'}</div>
        </div>

        <div className="p-4 border rounded">
          <div className="text-sm text-gray-600">Rentabilidade (Periodo selecionado)</div>
          <div className="text-xl font-semibold">{summary ? formatBRL(summary.net_profit) : '—'}</div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-semibold">Resumo</h2>
        <div className="mt-2">Receitas: {summary ? formatBRL(summary.revenues_total) : '—'}</div>
        <div>Despesas: {summary ? formatBRL(summary.expenses_total) : '—'}</div>
        <div className="mt-3">
          <button className="btn btn-sm btn-secondary" onClick={() => { setTripModalInitial(null); setTripModalOpen(true); }}>Nova Viagem</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Receitas</h3>
            <button className="btn btn-sm btn-primary" onClick={() => { setModalType('entry'); setModalInitial(null); setModalOpen(true); }}>Nova Entrada</button>
          </div>
          <ul className="mt-3 space-y-2">
            {revenues.map(r => (
              <li key={r.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-semibold">{r.date ? (new Date(r.date)).toLocaleDateString('pt-BR') : ''} — {formatBRL(r.amount)}</div>
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
            {expenses.map(r => (
              <li key={r.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <div className="font-semibold">{r.date ? (new Date(r.date)).toLocaleDateString('pt-BR') : ''} — {formatBRL(r.amount)}</div>
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
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Viagens</h3>
          <button className="btn btn-sm btn-secondary" onClick={() => { setTripModalInitial(null); setTripModalOpen(true); }}>Adicionar Viagem</button>
        </div>
        <ul className="mt-3 space-y-2">
          {trips.length === 0 && <li className="text-sm text-gray-500">Nenhuma viagem registrada.</li>}
          {trips.map((t) => (
            <li key={t.id} className="p-3 border rounded flex justify-between items-center">
              <div>
                <div className="font-semibold">
                  {t.date ? new Date(t.date).toLocaleDateString('pt-BR') : ''} — {formatBRL(t.total_value)}
                </div>
                <div className="text-sm text-gray-600">
                  {t.modality === 'per_ton'
                    ? `Por tonelada${t.tons ? ` • ${formatNumber(t.tons, 0, 3)} t` : ''}${t.rate_per_ton ? ` • ${formatBRL(t.rate_per_ton)}/t` : ''}`
                    : `Arrendamento${t.days ? ` • ${formatNumber(t.days, 0, 0)} dias` : ''}${t.daily_rate ? ` • ${formatBRL(t.daily_rate)}/dia` : ''}`}
                </div>
                <div className="text-sm text-gray-600">
                  {t.is_received ? 'Recebida' : 'Não recebida'} • Gastos: {formatBRL(t.expense_value)}
                </div>
                <div className="text-sm text-gray-600">
                  Outros: {formatBRL(t.base_expense_value)} • Combustível: {formatBRL(t.fuel_expense_value)} • Motorista: {formatBRL(t.driver_payment)}
                </div>
                <div className="text-sm text-gray-600">
                  KM inicial: {t.initial_km ?? '—'} • KM final: {t.final_km ?? '—'}
                </div>
                {t.description && <div className="text-sm text-gray-500">{t.description}</div>}
              </div>
              <div className="flex items-center gap-3">
                <button className="text-blue-600" onClick={() => { setTripModalInitial(t); setTripModalOpen(true); }}>Editar</button>
                <button className="text-red-600" onClick={() => { setConfirmPayload({ kind: 'trip', id: t.id }); setConfirmOpen(true); }}>Excluir</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <TransportEntryExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        initial={modalInitial}
        vehicleId={vehicle.id}
        onSaved={async () => {
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
        message={confirmPayload ? (confirmPayload.kind === 'revenue' ? 'Deseja excluir esta entrada?' : 'Deseja excluir esta despesa?') : ''}
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
          await refreshTrips();
          const s = await transportService.getVehicleSummary(id);
          setSummary(s);
        }}
      />
    </div>
  );
}
