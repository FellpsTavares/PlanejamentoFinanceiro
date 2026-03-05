import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/auth';

export default function Home() {
  const user = useMemo(() => authService.getCurrentUser(), []);

  const modules = [
    {
      title: 'Inicial',
      description: 'Acesse transações e visão financeira principal.',
      links: [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/transactions', label: 'Transações' },
        { to: '/transactions/new', label: 'Nova Transação' },
      ],
      enabled: true,
    },
    {
      title: 'Transportadora',
      description: 'Gerencie veículos e viagens em andamento.',
      links: [
        { to: '/transport/dashboard', label: 'Dashboard' },
        { to: '/transport/trips', label: 'Gerenciar Viagens' },
        { to: '/transport/vehicles', label: 'Veículos' },
      ],
      enabled: Boolean(user?.tenant?.has_module_transport),
    },
    {
      title: 'Investimentos',
      description: 'Acompanhe carteira e indicadores de ativos.',
      links: [
        { to: '/investments/dashboard', label: 'Dashboard' },
        { to: '/investments', label: 'Ativos' },
      ],
      enabled: Boolean(user?.tenant?.has_module_investments),
    },
    {
      title: 'Configurações',
      description: 'Ajuste parâmetros gerais e por módulo.',
      links: [
        { to: '/settings/modules', label: 'Configurações' },
      ],
      enabled: true,
    },
  ];

  const visibleModules = modules.filter((module) => module.enabled);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Home</h1>
      <p className="text-gray-600 mb-6">Escolha um módulo para continuar.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleModules.map((module) => (
          <section key={module.title} className="card border rounded p-5">
            <h2 className="text-xl font-semibold text-gray-900">{module.title}</h2>
            <p className="text-sm text-gray-600 mt-1 mb-4">{module.description}</p>
            <div className="flex flex-wrap gap-2">
              {module.links.map((item) => (
                <Link key={item.to} to={item.to} className="btn btn-secondary btn-sm">
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
