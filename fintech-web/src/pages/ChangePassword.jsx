import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { authService } from '../services/auth';
import { toast } from '../utils/toast';

export default function ChangePassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 8) {
      toast('A senha deve ter pelo menos 8 caracteres.', 'error');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      toast('As senhas não coincidem.', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/users/change-password/', form);

      // Atualiza usuário no localStorage para refletir must_change_password = false
      const stored = localStorage.getItem('user');
      if (stored) {
        try {
          const user = JSON.parse(stored);
          user.must_change_password = false;
          localStorage.setItem('user', JSON.stringify(user));
          window.dispatchEvent(new Event('auth:userChanged'));
        } catch {
          // ignora erros de parse
        }
      }

      // Buscar /users/me/ para sincronizar token atualizado
      try {
        await authService.getMe();
      } catch {
        // ignora
      }

      toast('Senha alterada com sucesso!', 'success');
      navigate('/home');
    } catch (err) {
      const data = err?.response?.data;
      const detail =
        data?.new_password?.[0] ||
        data?.confirm_password?.[0] ||
        data?.detail ||
        'Erro ao alterar senha.';
      toast(detail, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900">Alterar senha</h1>
          <p className="text-sm text-gray-500 mt-1">
            Por segurança, você precisa definir uma nova senha antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
            <div className="relative">
              <input
                className="input w-full pr-10"
                type={showNew ? 'text' : 'password'}
                name="new_password"
                value={form.new_password}
                onChange={handleChange}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                onClick={() => setShowNew((v) => !v)}
              >
                {showNew ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha</label>
            <div className="relative">
              <input
                className="input w-full pr-10"
                type={showConfirm ? 'text' : 'password'}
                name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange}
                placeholder="Repita a senha"
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Salvando…' : 'Definir nova senha'}
          </button>
        </form>

        <p className="text-xs text-center text-gray-400 mt-4">
          Entre em contato com o suporte se tiver dificuldades.
        </p>
      </div>
    </div>
  );
}
