'use client';

import React from 'react';
import { ProfileForm } from '@/components/ProfileForm';
import { InjuryTracker } from '@/components/InjuryTracker';
import { useData } from '@/lib/DataContext';
import { useAuth } from '@/lib/AuthContext';
import { LogOut, Mail } from 'lucide-react';

export default function ProfilePage() {
  const { profile } = useData();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="px-4 py-8 max-w-md mx-auto h-full flex flex-col pb-20">
      <header className="mb-2 pl-1 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">Athlete Profile</h1>
      </header>
      
      {!profile && (
        <div className="mt-4 mb-2 p-4 bg-[rgba(255,255,255,0.05)] rounded-2xl border border-[rgba(255,255,255,0.2)]">
          <p className="text-sm text-gray-300">
            Welcome to Prolaesio! Let&apos;s set up your profile so the AI guide can properly contextualize your training load and development.
          </p>
        </div>
      )}

      {/* Tabs / sections */}
      <div className="space-y-8">
        <ProfileForm />
        
        {/* We only show injury tracker once profile setup is done or if injuries exist */}
        {profile && (
          <InjuryTracker />
        )}

        {/* Account Section */}
        <div className="glass-card p-5 animate-slide-up">
          <h3 className="text-[var(--accent-primary)] font-bold uppercase tracking-wider text-xs mb-4">Account</h3>
          
          {user && (
            <div className="flex items-center space-x-3 mb-4 p-3 rounded-xl bg-[rgba(255,255,255,0.03)]">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center flex-shrink-0">
                <Mail size={18} className="text-black" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400">Signed in as</p>
                <p className="text-sm text-white font-medium truncate">{user.email}</p>
              </div>
            </div>
          )}

          <button
            id="sign-out-button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-xl border border-[rgba(255,107,107,0.3)] text-[#ff6b6b] font-bold text-sm hover:bg-[rgba(255,107,107,0.1)] transition-colors touch-target"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
