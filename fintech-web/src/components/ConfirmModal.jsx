import React from 'react';

const VARIANTS = {
  danger: {
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    confirmClass: 'btn-danger',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  },
  info: {
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    confirmClass: 'btn-primary',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export default function ConfirmModal({
  open,
  title = 'Confirmação',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  const v = VARIANTS[variant] || VARIANTS.danger;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 z-10 max-w-sm w-full p-6 text-center">
        <div className={`mx-auto mb-4 flex items-center justify-center w-14 h-14 rounded-full ${v.iconBg} ${v.iconColor}`}>
          {v.icon}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
        {message && <div className="text-sm text-gray-600 mb-6">{message}</div>}
        <div className="flex justify-center gap-3">
          <button className="btn btn-secondary flex-1" onClick={onCancel}>{cancelText}</button>
          <button className={`btn ${v.confirmClass} flex-1`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
