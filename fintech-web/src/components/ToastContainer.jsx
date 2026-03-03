import React, { useEffect, useState } from 'react';

function Toast({ id, message, type, onClose }) {
  const bg = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-gray-800';
  return (
    <div className={`${bg} text-white px-4 py-2 rounded shadow-md`}>
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm">{message}</div>
        <button onClick={() => onClose(id)} className="ml-2 text-white opacity-80">✕</button>
      </div>
    </div>
  );
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const { message, type, ttl } = e.detail || {};
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, type, ttl }]);
      if (ttl && ttl > 0) {
        setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), ttl);
      }
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  const remove = (id) => setToasts((t) => t.filter(x => x.id !== id));

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onClose={remove} />
      ))}
    </div>
  );
}
