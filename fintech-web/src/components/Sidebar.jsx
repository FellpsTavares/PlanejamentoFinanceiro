import React from 'react';
import { Link } from 'react-router-dom';
import { useSidebar } from '../hooks/useSidebar.jsx';

export default function Sidebar() {
  const { open, toggle, close } = useSidebar();

  return (
    <>
      <button
        onClick={toggle}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded shadow"
        aria-label="Abrir menu"
      >
        ☰
      </button>

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-40 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold">FinManager</h2>
        </div>
        <nav className="p-4 flex flex-col gap-2">
          <Link to="/dashboard" onClick={close} className="p-2 hover:bg-gray-100 rounded">Dashboard</Link>
          <Link to="/transactions" onClick={close} className="p-2 hover:bg-gray-100 rounded">Transações</Link>
          <Link to="/transactions/new" onClick={close} className="p-2 hover:bg-gray-100 rounded">Nova Transação</Link>
          <Link to="/investments" onClick={close} className="p-2 hover:bg-gray-100 rounded">Investimentos</Link>
        </nav>
      </aside>
    </>
  );
}
