'use client';

import React, { useState, useEffect } from 'react';
import { useData } from '../lib/DataContext';
import { UserProfile, Position, Priority } from '../lib/types';
import { Save } from 'lucide-react';

export function ProfileForm() {
  const { profile, saveProfile } = useData();

  const [age, setAge] = useState<number>(18);
  const [positions, setPositions] = useState<Position[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);

  const availablePositions: Position[] = ['GK', 'CB', 'FB', 'CM', 'AM', 'W', 'ST'];
  const availablePriorities: Priority[] = [
    'Speed', 'Acceleration', 'Finishing', 'Dribbling', 'Control', 
    'Passing', 'Reflexes', 'Decision-making', 'Stamina', 'Strength'
  ];

  useEffect(() => {
    if (profile) {
      setAge(profile.age);
      setPositions(profile.positions);
      setPriorities(profile.priorities);
    }
  }, [profile]);

  const togglePosition = (pos: Position) => {
    if (positions.includes(pos)) {
      setPositions(positions.filter(p => p !== pos));
    } else {
      setPositions([...positions, pos]);
    }
  };

  const togglePriority = (pri: Priority) => {
    if (priorities.includes(pri)) {
      setPriorities(priorities.filter(p => p !== pri));
    } else {
      setPriorities([...priorities, pri]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveProfile({ age, positions, priorities });
    alert('Profile saved successfully');
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-5 mt-6 animate-slide-up">
      <h3 className="text-[var(--accent-primary)] font-bold uppercase tracking-wider text-xs mb-4">Player Profile</h3>
      
      <div className="mb-6">
        <label className="block text-xs font-medium text-gray-400 mb-2">Age</label>
        <input 
          type="number" 
          min={1} 
          max={99} 
          value={age}
          onChange={(e) => setAge(Number(e.target.value))}
          className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg p-3 text-white touch-target"
        />
      </div>

      <div className="mb-6">
        <label className="block text-xs font-medium text-gray-400 mb-2">Positions Played</label>
        <div className="flex flex-wrap gap-2">
          {availablePositions.map(pos => (
            <button
              type="button"
              key={pos}
              onClick={() => togglePosition(pos)}
              className={`px-3 py-2 rounded-full text-xs font-bold transition-all touch-target ${
                positions.includes(pos)
                  ? 'bg-[var(--accent-secondary)] text-white shadow-md'
                  : 'bg-[rgba(255,255,255,0.05)] text-gray-400 hover:text-gray-200'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-medium text-gray-400 mb-2">Development Priorities</label>
        <div className="flex flex-wrap gap-2">
          {availablePriorities.map(pri => (
            <button
              type="button"
              key={pri}
              onClick={() => togglePriority(pri)}
              className={`px-3 py-2 rounded-full text-xs font-bold transition-all touch-target ${
                priorities.includes(pri)
                  ? 'bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 text-black shadow-md'
                  : 'bg-[rgba(255,255,255,0.05)] text-gray-400 hover:text-gray-200'
              }`}
            >
              {pri}
            </button>
          ))}
        </div>
      </div>

      <button 
        type="submit" 
        className="w-full bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 text-black font-bold py-4 rounded-xl shadow-lg flex items-center justify-center touch-target transition-transform active:scale-95"
      >
        <Save className="mr-2" size={20} /> Save Profile
      </button>
    </form>
  );
}
