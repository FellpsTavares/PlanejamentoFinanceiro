import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { transactionService } from '../services/transactions';
import { authService } from '../services/auth';

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    start_date: '',
    end_date: '',
  });
  const [categories, setCategories] = useState([]);
  const [creditCardInvoices, setCreditCardInvoices] = useState([]);

  const formatBRL = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Verificar autenticação
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }

      // Carregar categorias
      const categoriesData = await transactionService.listCategories();
      setCategories(categoriesData.results || categoriesData);

      const invoicesData = await transactionService.listCreditCardInvoices();
      setCreditCardInvoices(invoicesData.results || invoicesData || []);

      // Carregar transações
      await loadTransactions();
    } catch (err) {
      setError('Erro ao carregar dados');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const params = {};
      if (filters.type) params.type = filters.type;
      if (filters.category) params.category = filters.category;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const data = await transactionService.list(params);
      setTransactions(data.results || data);
    } catch (err) {
      setError('Erro ao carregar transações');
      console.error(err);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApplyFilters = () => {
    loadTransactions();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar esta transação?')) {
      try {
        await transactionService.delete(id);
        setTransactions(transactions.filter((t) => t.id !== id));
      } catch (err) {
        setError('Erro ao deletar transação');
      }
    }
  };

  const handleMarkInvoicePaid = async (invoiceId) => {
    const paidAt = new Date().toISOString().split('T')[0];
    if (!window.confirm('Marcar esta fatura como paga hoje?')) return;

    try {
      await transactionService.markCreditCardInvoicePaid(invoiceId, paidAt);
      await loadData();
    } catch (err) {
      setError('Erro ao marcar fatura como paga');
    }
  };

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
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Transações</h1>
          <button
            onClick={() => navigate('/transactions/new')}
            className="btn-primary"
          >
            Nova Transação
          </button>
        </div>
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Filtros */}
        <div className="card mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                name="type"
                value={filters.type}
                onChange={handleFilterChange}
                className="input-field"
              >
                <option value="">Todos</option>
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria
              </label>
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                className="input-field"
              >
                <option value="">Todas</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                name="start_date"
                value={filters.start_date}
                onChange={handleFilterChange}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Final
              </label>
              <input
                type="date"
                name="end_date"
                value={filters.end_date}
                onChange={handleFilterChange}
                className="input-field"
              />
            </div>
          </div>

          <button
            onClick={handleApplyFilters}
            className="mt-4 btn-primary"
          >
            Aplicar Filtros
          </button>
        </div>

        {/* Lista de Transações */}
        <div className="card mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Faturas de Cartão</h2>
          {creditCardInvoices.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhuma fatura de cartão encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Cartão</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Referência</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Vencimento</th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">Total</th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {creditCardInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{invoice.payment_method_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{new Date(invoice.reference_month).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{new Date(invoice.due_date).toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">{formatBRL(invoice.total_amount)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {invoice.status === 'paid' ? 'Paga' : 'Aberta'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {invoice.status === 'open' ? (
                          <button
                            onClick={() => handleMarkInvoicePaid(invoice.id)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Marcar como paga
                          </button>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Transações ({transactions.length})
          </h2>

          {transactions.length === 0 ? (
            <p className="text-gray-600 text-center py-8">Nenhuma transação encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Data
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Descrição
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Categoria
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Tipo
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Pagamento
                    </th>
                    <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700">
                      Valor
                    </th>
                    <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(transaction.transaction_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {transaction.description}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="flex items-center gap-2">
                          <span>{transaction.category_icon || '💰'}</span>
                          {transaction.category_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          transaction.type === 'income'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {transaction.payment_method_name || '—'}
                        {transaction.affects_balance === false && (
                          <div className="text-xs text-amber-700">Não impacta saldo (fatura aberta)</div>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold text-right ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'} {formatBRL(transaction.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Deletar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
