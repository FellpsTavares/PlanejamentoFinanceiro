import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { transactionService } from '../services/transactions';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  useEffect(() => {
    const loadData = async () => {
      try {
        // Obter usuário atual
        const currentUser = authService.getCurrentUser();
        if (!currentUser) {
          navigate('/login');
          return;
        }
        setUser(currentUser);

        // Obter resumo de transações
        const summaryData = await transactionService.getSummary();
        setSummary(summaryData);
      } catch (err) {
        setError('Erro ao carregar dados');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Conteúdo */}
      <main className="w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Kaptal Pro</h1>
          <p className="text-gray-600">Bem-vindo, {user?.first_name || user?.email}!</p>
        </div>
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Card de Receitas */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Receitas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatBRL(summary.total_income)}
                  </p>
                </div>
                <div className="text-4xl">📈</div>
              </div>
            </div>

            {/* Card de Despesas */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Despesas</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatBRL(summary.total_expense)}
                  </p>
                </div>
                <div className="text-4xl">📉</div>
              </div>
            </div>

            {/* Card de Saldo */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Saldo</p>
                  <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatBRL(summary.balance)}
                  </p>
                </div>
                <div className="text-4xl">💰</div>
              </div>
            </div>
          </div>
        )}

        {/* Seção de Categorias */}
        {summary && summary.by_category && summary.by_category.length > 0 && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Principais Categorias</h2>
            <div className="space-y-3">
              {summary.by_category.map((category) => (
                <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon || '💰'}</span>
                    <div>
                      <p className="font-medium text-gray-900">{category.name}</p>
                      <p className="text-sm text-gray-600">{category.type === 'income' ? 'Receita' : 'Despesa'}</p>
                    </div>
                  </div>
                  <p className="font-bold text-gray-900">{formatBRL(category.total)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/transactions')}
            className="btn-primary"
          >
            Ver Transações
          </button>
          <button
            onClick={() => navigate('/transactions/new')}
            className="btn-primary"
          >
            Nova Transação
          </button>
        </div>
      </main>
    </div>
  );
}
