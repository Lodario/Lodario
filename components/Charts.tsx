'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts';
import { useData } from '../lib/DataContext';
import { format, subDays } from 'date-fns';
import { calculateSessionLoad } from '../lib/training-load';
import { calculatePlayerReadinessForDate } from '../lib/readiness';

interface ChartProps {
  days: number;
}

function ChartCard({ title, children, legend }: { title: string; children: React.ReactNode; legend?: React.ReactNode }) {
  return (
    <div className="h-64 w-full glass-card p-4 flex flex-col">
      <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider shrink-0">{title}</h3>
      <div className="flex-1 min-h-0 min-w-0">
        {children}
      </div>
      {legend}
    </div>
  );
}

const chartMargin = { top: 5, right: 8, left: -20, bottom: 0 };
const dateAxisProps = {
  dataKey: 'name',
  stroke: 'gray',
  fontSize: 10,
  tickLine: false,
  axisLine: false,
  height: 24,
  minTickGap: 12,
  padding: { left: 10, right: 10 },
} as const;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--background)] border border-[rgba(255,255,255,0.1)] p-3 rounded-lg shadow-xl">
        <p className="text-white font-bold text-sm mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function ReadinessChart({ days }: ChartProps) {
  const { wellnessLogs, trainingLogs } = useData();
  
  const data = Array.from({ length: days }).map((_, i) => {
    const date = subDays(new Date(), days - 1 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const log = wellnessLogs[dateStr];
    
    const score = log
      ? calculatePlayerReadinessForDate(Object.values(wellnessLogs), trainingLogs, date).readiness.score
      : null;
    
    return {
      name: format(date, 'MMM d'),
      score: score ? Math.round(score) : null,
    };
  }).filter(d => d.score !== null);

  if (data.length === 0) return <NoData />;

  return (
    <ChartCard title="Readiness Trend">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={chartMargin}>
          <defs>
            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--metric-readiness)" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="var(--metric-readiness)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis {...dateAxisProps} />
          <YAxis stroke="gray" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="score" name="Score" stroke="var(--metric-readiness)" fillOpacity={1} fill="url(#colorScore)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function LoadChart({ days }: ChartProps) {
  const { trainingLogs } = useData();
  
  const data = Array.from({ length: days }).map((_, i) => {
    const date = subDays(new Date(), days - 1 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const logs = trainingLogs.filter(l => l.date === dateStr);
    const load = logs.reduce((sum, l) => sum + calculateSessionLoad(l), 0);
    
    return {
      name: format(date, 'MMM d'),
      load: load,
    };
  });

  return (
    <ChartCard title="Training Load (Acute)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis {...dateAxisProps} />
          <YAxis stroke="gray" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="load" name="Load (Intensity × Duration)" fill="var(--metric-load)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function FatigueEnergyChart({ days }: ChartProps) {
  const { wellnessLogs } = useData();
  
  const data = Array.from({ length: days }).map((_, i) => {
    const date = subDays(new Date(), days - 1 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const log = wellnessLogs[dateStr];
    
    return {
      name: format(date, 'MMM d'),
      energy: log?.energy || null,
      fatigue: log?.fatigue || null,
    };
  }).filter(d => d.energy !== null);

  if (data.length === 0) return <NoData />;

  return (
    <ChartCard
      title="Energy vs Fatigue"
      legend={
        <div className="flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-[10px]">
          <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--metric-energy)' }}>
            <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />Energy
          </span>
          <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--metric-fatigue)' }}>
            <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />Fatigue
          </span>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis {...dateAxisProps} />
          <YAxis stroke="gray" fontSize={10} tickLine={false} axisLine={false} domain={[0, 10]} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="energy" name="Energy" stroke="var(--metric-energy)" strokeWidth={3} dot={{ r: 3, fill: 'var(--metric-energy)', strokeWidth: 0 }} />
          <Line type="monotone" dataKey="fatigue" name="Fatigue" stroke="var(--metric-fatigue)" strokeWidth={3} dot={{ r: 3, fill: 'var(--metric-fatigue)', strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function NoData() {
  return (
    <div className="h-64 w-full glass-card p-4 flex items-center justify-center flex-col">
      <p className="text-gray-500 font-medium">Not enough data</p>
      <p className="text-xs text-gray-600 mt-1 text-center">Trends appear after you log wellness and training for a few days.</p>
    </div>
  );
}
