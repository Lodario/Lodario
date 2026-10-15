'use client';

import React, { useId } from 'react';

interface RatingProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  color?: string;
  numbered?: boolean;
  lowLabel?: string;
  highLabel?: string;
}

export function Rating({ label, value, onChange, color = '#ffd43b', numbered = false, lowLabel, highLabel }: RatingProps) {
  const id = useId();
  const style = { '--rating-color': color } as React.CSSProperties;
  const selectSegment = (event: React.PointerEvent<HTMLInputElement>) => {
    const segments = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('.log-segments span');
    if (!segments?.length) return;
    // Match the visible segment, rather than the native range's 11 stop positions.
    let nearest = 0;
    let nearestDistance = Infinity;
    segments.forEach((segment, index) => {
      const bounds = segment.getBoundingClientRect();
      const distance = Math.abs(event.clientX - (bounds.left + bounds.width / 2));
      if (distance < nearestDistance) { nearest = index; nearestDistance = distance; }
    });
    onChange(nearest + 1);
  };
  return (
    <div className={`log-rating ${numbered ? 'log-rating-numbered' : ''}`} style={style}>
      <div className="log-rating-heading">
        <label id={id} htmlFor={numbered ? undefined : `${id}-input`}>{label}</label>
        <span className="log-rating-value"><strong>{value}</strong><span> / 10</span></span>
      </div>
      {numbered ? (
        <div className="log-number-options" role="radiogroup" aria-labelledby={id}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map(number => (
            <button type="button" role="radio" aria-checked={value === number} tabIndex={value === number ? 0 : -1}
              key={number} onClick={() => onChange(number)} onKeyDown={event => {
                const direction = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 0;
                if (!direction && event.key !== 'Home' && event.key !== 'End') return;
                event.preventDefault();
                const next = event.key === 'Home' ? 1 : event.key === 'End' ? 10 : ((number - 1 + direction + 10) % 10) + 1;
                onChange(next);
                const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button');
                buttons?.[next - 1].focus();
              }}>{number}</button>
          ))}
        </div>
      ) : (
        <div className="log-segment-track">
          <div className="log-segments" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => <span key={index} className={index < value ? 'is-filled' : ''} />)}
          </div>
          <input id={`${id}-input`} type="range" min={0} max={10} step={1} value={value}
            aria-labelledby={id} aria-valuetext={`${value} out of 10`} onChange={event => onChange(Number(event.target.value))}
            onPointerDown={event => {
              if (event.button !== 0 || event.currentTarget.matches(':disabled')) return;
              event.preventDefault();
              event.currentTarget.focus({ preventScroll: true });
              event.currentTarget.setPointerCapture(event.pointerId);
              selectSegment(event);
            }}
            onPointerMove={event => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              event.preventDefault();
              selectSegment(event);
            }}
            onPointerUp={event => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }} />
        </div>
      )}
      <div className="log-rating-endpoints">
        {numbered ? <span>{lowLabel}</span> : <button type="button" aria-label={`Set ${label.toLowerCase()} to zero`} onClick={() => onChange(0)}>{lowLabel || '0'}</button>}
        <span>{highLabel || '10'}</span>
      </div>
    </div>
  );
}
