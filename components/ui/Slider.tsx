import React from 'react';

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChangeValue: (val: number) => void;
}

export function Slider({ label, value, min = 1, max = 10, onChangeValue, ...rest }: SliderProps) {
  return (
    <div className="flex flex-col space-y-2 mb-4">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-200">{label}</label>
        <span className="text-lg font-bold text-[var(--accent-primary)]">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChangeValue(Number(e.target.value))}
        className="w-full"
        {...rest}
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
