import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revealLoginPassword, setRevealLoginPassword] = useState(false);
  const [revealSignupPassword, setRevealSignupPassword] = useState(false);
  const [revealSignupPasswordConfirm, setRevealSignupPasswordConfirm] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [signupData, setSignupData] = useState({
    tenantName: '',
    tenantSlug: '',
    tenantEmail: '',
    tenantPhone: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });

  const suggestSlug = (name) =>
    String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

  useEffect(() => {
    const t = setTimeout(() => setCardVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const passwordStrength = useMemo(() => {
    const value = signupData.password || '';
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;

    const palette = [
      { label: 'Muito fraca', color: 'bg-rose-500', text: 'text-rose-600' },
      { label: 'Fraca', color: 'bg-orange-500', text: 'text-orange-600' },
      { label: 'Media', color: 'bg-amber-500', text: 'text-amber-600' },
      { label: 'Boa', color: 'bg-emerald-500', text: 'text-emerald-600' },
      { label: 'Forte', color: 'bg-emerald-600', text: 'text-emerald-700' },
    ];

    return {
      score,
      ...palette[score],
      widthClass: ['w-0', 'w-1/4', 'w-2/4', 'w-3/4', 'w-full'][score],
    };
  }, [signupData.password]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTenantNameBlur = () => {
    if (!signupData.tenantSlug && signupData.tenantName) {
      setSignupData((prev) => ({
        ...prev,
        tenantSlug: suggestSlug(prev.tenantName),
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authService.login(formData.email, formData.password);
      if (result?.user?.must_change_password) {
        navigate('/change-password');
      } else {
        navigate('/home');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authService.registerAccount(signupData);
      await authService.login(signupData.email, signupData.password);
      navigate('/home');
    } catch (err) {
      const payload = err?.response?.data;
      if (typeof payload === 'string') {
        setError(payload);
      } else if (payload?.detail) {
        setError(payload.detail);
      } else {
        setError(`Erro ao criar conta: ${JSON.stringify(payload || {})}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-2xl border border-white/60 bg-white/85 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100';

  const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600';

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage: 'url("/Plano%20de%20fundo%20Login.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: '"Sora", "Manrope", sans-serif',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.24),transparent_45%),linear-gradient(130deg,rgba(2,6,23,0.8),rgba(15,23,42,0.55))]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <section
            className={`hidden rounded-3xl border border-white/20 bg-white/10 p-8 text-white shadow-2xl backdrop-blur-sm transition-all duration-700 ease-out lg:flex lg:flex-col lg:justify-between ${cardVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          >
            <div>
              <p className="inline-flex rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/90">
                Plataforma Financeira
              </p>
              <h1 className="mt-5 max-w-md text-4xl font-semibold leading-tight">
                Elo Financeiro
              </h1>
              <p className="mt-4 max-w-md text-base text-white/85">
                Conectando a sua empresa a eficiencia, com controle financeiro, operacao e crescimento no mesmo lugar.
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-slate-950/20 p-4 text-sm text-white/85">
              Acesse sua conta para visualizar indicadores, transacoes e configuracoes do seu negocio em tempo real.
            </div>
          </section>

          <section
            className={`w-full rounded-3xl border border-white/40 bg-white/80 p-6 shadow-2xl backdrop-blur-xl transition-all duration-700 ease-out sm:p-8 ${cardVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
          >
            <div className="mb-6 text-center lg:text-left">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{mode === 'login' ? 'Entrar' : 'Criar Conta'}</h2>
              <p className="mt-2 text-sm text-slate-600">Gestao completa para empresas que precisam de visao e velocidade.</p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1.5">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Criar Conta
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Senha</label>
                  <div className="relative">
                    <input
                      type={revealLoginPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`${inputClass} pr-12`}
                      placeholder="Digite sua senha"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setRevealLoginPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 my-auto h-8 rounded-md px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      {revealLoginPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && <span className="spinner"></span>}
                  {loading ? 'Entrando...' : 'Acessar painel'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignupSubmit} className="space-y-3">
                <div>
                  <label className={labelClass}>Nome da empresa *</label>
                  <input
                    name="tenantName"
                    value={signupData.tenantName}
                    onChange={handleSignupChange}
                    onBlur={handleTenantNameBlur}
                    className={inputClass}
                    placeholder="Ex.: Elo Logistica"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Slug da conta *</label>
                  <input
                    name="tenantSlug"
                    value={signupData.tenantSlug}
                    onChange={handleSignupChange}
                    className={inputClass}
                    placeholder="elo-logistica"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Email da empresa *</label>
                    <input
                      type="email"
                      name="tenantEmail"
                      value={signupData.tenantEmail}
                      onChange={handleSignupChange}
                      className={inputClass}
                      placeholder="financeiro@empresa.com"
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Telefone da empresa</label>
                    <input
                      name="tenantPhone"
                      value={signupData.tenantPhone}
                      onChange={handleSignupChange}
                      className={inputClass}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Seu nome</label>
                    <input
                      name="firstName"
                      value={signupData.firstName}
                      onChange={handleSignupChange}
                      className={inputClass}
                      placeholder="Nome"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Seu sobrenome</label>
                    <input
                      name="lastName"
                      value={signupData.lastName}
                      onChange={handleSignupChange}
                      className={inputClass}
                      placeholder="Sobrenome"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Seu email de acesso *</label>
                  <input
                    type="email"
                    name="email"
                    value={signupData.email}
                    onChange={handleSignupChange}
                    className={inputClass}
                    placeholder="admin@empresa.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Senha *</label>
                    <div className="relative">
                      <input
                        type={revealSignupPassword ? 'text' : 'password'}
                        name="password"
                        value={signupData.password}
                        onChange={handleSignupChange}
                        className={`${inputClass} pr-12`}
                        placeholder="Crie uma senha"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setRevealSignupPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-3 my-auto h-8 rounded-md px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        {revealSignupPassword ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    {signupData.password && (
                      <div className="mt-2">
                        <div className="h-2 rounded-full bg-slate-200">
                          <div className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color} ${passwordStrength.widthClass}`} />
                        </div>
                        <p className={`mt-1 text-xs font-semibold ${passwordStrength.text}`}>
                          Forca da senha: {passwordStrength.label}
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Confirmar senha *</label>
                    <div className="relative">
                      <input
                        type={revealSignupPasswordConfirm ? 'text' : 'password'}
                        name="passwordConfirm"
                        value={signupData.passwordConfirm}
                        onChange={handleSignupChange}
                        className={`${inputClass} pr-12`}
                        placeholder="Repita a senha"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setRevealSignupPasswordConfirm((prev) => !prev)}
                        className="absolute inset-y-0 right-3 my-auto h-8 rounded-md px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        {revealSignupPasswordConfirm ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    {!!signupData.passwordConfirm && (
                      <p
                        className={`mt-1 text-xs font-semibold ${
                          signupData.password === signupData.passwordConfirm ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {signupData.password === signupData.passwordConfirm ? 'Senhas conferem' : 'Senhas diferentes'}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-700/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && <span className="spinner"></span>}
                  {loading ? 'Criando conta...' : 'Criar conta e entrar'}
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-xs text-slate-500">© 2026 Elo Financeiro. Todos os direitos reservados.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
