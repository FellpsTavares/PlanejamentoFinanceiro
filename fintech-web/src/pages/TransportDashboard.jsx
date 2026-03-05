import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { transportService } from '../services/transport';
import { toast } from '../utils/toast';

export default function TransportDashboard() {
  const [loading, setLoading] = useState(true);
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [tripsCount, setTripsCount] = useState(0);
  const [revenuesTotal, setRevenuesTotal] = useState(0);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [recentTrips, setRecentTrips] = useState([]);

  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [vehiclesData, tripsData, revenuesData, expensesData] = await Promise.all([
          transportService.getVehicles(),
          transportService.getTrips(),
          transportService.getRevenues(),
          transportService.getExpenses(),
        ]);

        const vehicles = vehiclesData.results || vehiclesData || [];
        const trips = tripsData.results || tripsData || [];
        const revenues = revenuesData.results || revenuesData || [];
        const expenses = expensesData.results || expensesData || [];

        setVehiclesCount(vehicles.length);
        setTripsCount(trips.length);
        setRecentTrips(trips.slice(0, 5));

        const revTotalManual = revenues.reduce((acc, item) => acc + Number(item.amount || 0), 0);
        const expTotalManual = expenses.reduce((acc, item) => acc + Number(item.amount || 0), 0);
        const revTotalTrips = trips.reduce((acc, item) => acc + (item.is_received ? Number(item.total_value || 0) : 0), 0);
        const expTotalTrips = trips.reduce((acc, item) => acc + Number(item.expense_value || 0), 0);
        const revTotal = revTotalManual + revTotalTrips;
        const expTotal = expTotalManual + expTotalTrips;
        setRevenuesTotal(revTotal);
        setExpensesTotal(expTotal);
      } catch (err) {
        console.error('Erro ao carregar dashboard de transportes', err);
        toast('Erro ao carregar dashboard da transportadora', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="p-6">Carregando dashboard...</div>;

  const netProfit = revenuesTotal - expensesTotal;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Transportadora - Dashboard</h1>
      <p className="mt-2 text-gray-600">Visão geral operacional e financeira.</p>

      <div className="mt-4 flex gap-2">
        <Link to="/transport/vehicles" className="btn btn-secondary">Ver Veículos</Link>
        <Link to="/transport/trips" className="btn btn-secondary">Gerenciar Viagens</Link>
        <Link to="/transport/trips/new" className="btn btn-primary">Nova Viagem</Link>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 border rounded">
          <div className="text-sm text-gray-600">Veículos</div>
          <div className="text-2xl font-semibold">{vehiclesCount}</div>
        </div>
        <div className="p-4 border rounded">
          <div className="text-sm text-gray-600">Viagens</div>
          <div className="text-2xl font-semibold">{tripsCount}</div>
        </div>
        <div className="p-4 border rounded">
          <div className="text-sm text-gray-600">Receitas</div>
          <div className="text-2xl font-semibold">{formatBRL(revenuesTotal)}</div>
        </div>
        <div className="p-4 border rounded">
          <div className="text-sm text-gray-600">Despesas</div>
          <div className="text-2xl font-semibold">{formatBRL(expensesTotal)}</div>
        </div>
      </div>

      <div className="mt-4 p-4 border rounded">
        <div className="text-sm text-gray-600">Lucro Líquido</div>
        <div className={`text-2xl font-semibold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatBRL(netProfit)}</div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">Viagens Recentes</h2>
        <ul className="mt-3 space-y-2">
          {recentTrips.length === 0 && <li className="text-sm text-gray-500">Nenhuma viagem cadastrada.</li>}
          {recentTrips.map((trip) => (
            <li key={trip.id} className="p-3 border rounded flex justify-between items-center">
              <div>
                <div className="font-semibold">{trip.start_date ? new Date(trip.start_date).toLocaleDateString('pt-BR') : (trip.date ? new Date(trip.date).toLocaleDateString('pt-BR') : '')}</div>
                <div className="text-sm text-gray-600">{trip.modality === 'per_ton' ? 'Por Tonelada' : 'Arrendamento'} • {trip.progress_type || 'Sem andamento'}</div>
                <div className="text-xs text-gray-500">Gastos: {formatBRL(trip.expense_value)}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-semibold">{formatBRL(trip.total_value)}</div>
                <Link to={`/transport/trips?trip=${trip.id}`} className="btn btn-secondary btn-sm">Editar viagem</Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
