import React from 'react';

export default function ToggleChip({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange && onChange()}
      aria-pressed={checked}
      className={`inline-flex items-center gap-3 text-sm px-4 py-2 rounded-full transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
        checked
          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md border-transparent'
          : 'bg-white text-gray-700 border border-gray-200 hover:shadow-sm'
      }`}
    >
      <span className={`w-4 h-4 rounded-full flex items-center justify-center ${checked ? 'bg-white' : 'bg-gray-200'}`}>
        {checked ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17l-5-5" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="5" fill="#E5E7EB" />
          </svg>
        )}
      </span>
      <span className="whitespace-nowrap font-medium">{label}</span>
    </button>
  );
}
