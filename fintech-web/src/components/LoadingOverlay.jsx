import React from 'react';

export default function LoadingOverlay({ message = 'Carregando...' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="max-w-sm w-full p-6 bg-white rounded-2xl shadow-lg border border-gray-100 text-center">
        <div className="mx-auto mb-4 flex items-center justify-center w-20 h-20 bg-gray-50 rounded-full">
          <img src="/logo/LogoHome.png" alt="logo" className="w-12 h-12 object-contain" />
        </div>
        <div className="mb-4">
          <div className="spinner w-10 h-10 mx-auto" />
        </div>
        <p className="text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  );
}
