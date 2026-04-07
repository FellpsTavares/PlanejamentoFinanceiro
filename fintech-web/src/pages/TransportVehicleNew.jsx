import React, { useState, useEffect } from 'react';
import { transportService } from '../services/transport';
import { useNavigate } from 'react-router-dom';

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

export default function TransportVehicleNew() {
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [capacity, setCapacity] = useState('');
  const [initialKm, setInitialKm] = useState('');
  const [isDualWheel, setIsDualWheel] = useState(false);
  const [numberOfAxles, setNumberOfAxles] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState('');
  const [nextReviewKm, setNextReviewKm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload = {
      plate,
      model,
      year: parseInt(year, 10),
      capacity,
      initial_km: parseInt(initialKm || '0', 10),
      is_dual_wheel: Boolean(isDualWheel),
      number_of_axles: numberOfAxles ? Math.min(MAX_AXLES_ALLOWED, Math.max(1, parseInt(numberOfAxles, 10))) : null,
      next_review_date: nextReviewDate || null,
      next_review_km: nextReviewKm ? parseInt(nextReviewKm, 10) : null,
    };
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
        <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2">
          <span className="text-sm font-medium text-gray-700">Rodagem dupla (4 pneus por eixo)</span>
          <button
            type="button"
            onClick={() => setIsDualWheel((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${isDualWheel ? 'bg-blue-600' : 'bg-gray-300'}`}
            aria-pressed={isDualWheel}
            aria-label="Alternar rodagem dupla"
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isDualWheel ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </label>
        <input value={initialKm} onChange={(e)=>setInitialKm(sanitizeIntegerInput(e.target.value, { min: 0, max: 999999999, allowEmpty: true }))} placeholder="KM inicial do cadastro" className="input" type="number" min="0" />
        <input value={numberOfAxles} onChange={(e)=>setNumberOfAxles(sanitizeIntegerInput(e.target.value, { min: 1, max: MAX_AXLES_ALLOWED, allowEmpty: true }))} placeholder={`Número de eixos (máx. ${MAX_AXLES_ALLOWED})`} className="input" type="number" min="1" max={MAX_AXLES_ALLOWED} />
        <div>
          <label className="text-xs text-gray-600">Data prevista da próxima revisão</label>
          <input value={nextReviewDate} onChange={(e)=>setNextReviewDate(e.target.value)} className="input" type="date" />
        </div>
        <input value={nextReviewKm} onChange={(e)=>setNextReviewKm(sanitizeIntegerInput(e.target.value, { min: 0, max: 999999999, allowEmpty: true }))} placeholder="KM previsto para próxima revisão" className="input" type="number" min="0" />
        <p className="text-xs text-gray-500">Os motoristas podem ser vinculados na página de perfil do veículo após o cadastro.</p>
        <div className="flex items-center gap-2">
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</button>
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>
      </form>
    </div>
  );
}
