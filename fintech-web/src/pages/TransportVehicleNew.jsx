import React, { useState } from 'react';
import { transportService } from '../services/transport';
import { useNavigate } from 'react-router-dom';

export default function TransportVehicleNew() {
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [capacity, setCapacity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload = { plate, model, year: parseInt(year, 10), capacity };
    try {
      const v = await transportService.createVehicle(payload);
      // navegar somente se id presente
      if (v && v.id) {
        navigate(`/transport/vehicles/${v.id}`);
      } else {
        console.warn('Resposta inesperada ao criar veículo:', v);
        setError('Resposta inesperada do servidor. Verifique o console.');
      }
    } catch (err) {
      console.error('Erro ao criar veículo', err);
      const msg = err?.response?.data || err.message || 'Erro desconhecido';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Cadastrar Veículo</h1>
      <form onSubmit={handleSubmit} className="mt-4 max-w-md space-y-3">
        <input value={plate} onChange={(e)=>setPlate(e.target.value)} placeholder="Placa" className="input" required />
        <input value={model} onChange={(e)=>setModel(e.target.value)} placeholder="Modelo" className="input" required />
        <input value={year} onChange={(e)=>setYear(e.target.value)} placeholder="Ano" className="input" required type="number" />
        <input value={capacity} onChange={(e)=>setCapacity(e.target.value)} placeholder="Capacidade" className="input" required />
        <div className="flex items-center gap-2">
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>
      </form>
    </div>
  );
}
