
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5 ml-1">
        {label}
      </label>
      <input
        {...props}
        className={`bg-slate-900/40 border ${error ? 'border-red-500/50' : 'border-slate-800/80'} text-white rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-700 text-sm font-medium shadow-inner`}
      />
      {error && <span className="text-[10px] text-red-500 font-bold mt-1 ml-1">{error}</span>}
    </div>
  );
};

export default Input;
