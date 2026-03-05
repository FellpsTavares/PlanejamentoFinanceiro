import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { transactionService } from '../services/transactions';
import { authService } from '../services/auth';

export default function NewTransaction() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    type: 'expense',
    category: '',
    transaction_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const parseMoney = (value) => Number(String(value || '0').replace(',', '.'));

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      if (!authService.isAuthenticated()) {
        navigate('/login');
        return;
      }

      const data = await transactionService.listCategories();
      setCategories(data.results || data);
    } catch (err) {
      setError('Erro ao carregar categorias');
      console.error(err);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName) return;
    try {
      const payload = { name: newCategoryName, type: formData.type };
      const created = await transactionService.createCategory(payload);
      setCategories((prev) => [...prev, created]);
      setNewCategoryName('');
    } catch (err) {
      setError('Erro ao criar categoria');
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validar campos obrigatórios
      if (!formData.description || !formData.amount || !formData.category) {
        setError('Preencha todos os campos obrigatórios');
        setLoading(false);
        return;
      }

      // Criar transação
      await transactionService.create({
        description: formData.description,
        amount: parseMoney(formData.amount),
        type: formData.type,
        category: formData.category,
        transaction_date: formData.transaction_date,
        notes: formData.notes,
      });

      // Redirecionar para transações
      navigate('/transactions');
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao criar transação');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar categorias por tipo
  const filteredCategories = categories.filter((cat) => cat.type === formData.type);

  return (
    <div className="min-h-screen bg-white">
      {/* Conteúdo */}
      <main className="w-full px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Nova Transação</h1>
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tipo de Transação */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Transação *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="income"
                    checked={formData.type === 'income'}
                    onChange={handleChange}
                  />
                  <span className="text-green-600 font-medium">📈 Receita</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="expense"
                    checked={formData.type === 'expense'}
                    onChange={handleChange}
                  />
                  <span className="text-red-600 font-medium">📉 Despesa</span>
                </label>
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição *
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="input-field"
                placeholder="Ex: Salário, Compras no supermercado..."
                required
              />
            </div>

            {/* Valor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none select-none">R$</span>
                <input
                  type="text"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  className="input-field"
                  style={{ paddingLeft: '3rem' }}
                  placeholder="0,00"
                  required
                />
              </div>
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="input-field"
                required
              >
                <option value="">Selecione uma categoria</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>

              {/* Criar nova categoria rapidamente */}
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Nova categoria"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="input-field flex-1"
                />
                <button type="button" onClick={handleCreateCategory} className="btn-secondary">
                  Criar
                </button>
              </div>
            </div>

            {/* Data */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data da Transação
              </label>
              <input
                type="date"
                name="transaction_date"
                value={formData.transaction_date}
                onChange={handleChange}
                className="input-field"
              />
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="input-field"
                placeholder="Adicione notas sobre esta transação..."
                rows="4"
              />
            </div>

            {/* Botões */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <span className="spinner"></span>}
                {loading ? 'Salvando...' : 'Salvar Transação'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/transactions')}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
