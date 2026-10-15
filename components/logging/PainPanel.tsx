'use client';

import { useEffect, useId, useState } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import { Rating } from './Rating';
import { InjuryStatusToggle } from '@/components/InjuryStatusToggle';
import { isAutomaticInjuryPainLevel } from '@/lib/injury-status';

interface PainPanelProps {
  level: number;
  onLevelChange: (value: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  injury: boolean;
  onInjuryChange: (value: boolean) => void;
}

export function PainPanel({ level, onLevelChange, notes, onNotesChange, injury, onInjuryChange }: PainPanelProps) {
  const [open, setOpen] = useState(level > 0);
  const id = useId();
  useEffect(() => { if (level > 0) setOpen(true); }, [level]);
  const automaticInjury = level > 0 && isAutomaticInjuryPainLevel(level);
  return (
    <section className="log-card log-pain-panel">
      <button type="button" className="log-pain-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
        {open ? <Minus size={23} /> : <Plus size={23} />}
        <span>Any pain?</span>
        {!open && level > 0 && <span className="log-pain-summary">{level}/10</span>}
        <ChevronDown size={21} className={open ? 'is-open' : ''} />
      </button>
      <div id={id} hidden={!open} className="log-pain-content">
        <Rating label="Pain level" value={level} onChange={value => {
          onLevelChange(value);
          if (value === 0) onInjuryChange(false);
        }} color="#ff4d78" lowLabel="0 · No pain" highLabel="10 · Severe pain" />
        {level > 0 && <div className="log-pain-details">
          <InjuryStatusToggle checked={injury || automaticInjury} automaticallyEnabled={automaticInjury} onChange={onInjuryChange} />
          <label className="log-field-label" htmlFor={`${id}-notes`}>Pain location & description</label>
          <textarea id={`${id}-notes`} value={notes} onChange={event => onNotesChange(event.target.value)} rows={2} placeholder="Where does it hurt?" className="log-input" />
        </div>}
      </div>
    </section>
  );
}
