import React from 'react';
import { TabType } from '../types';
import { Lock, RefreshCw, CheckCircle2, HardDrive } from 'lucide-react';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  selectedModuleTitle?: string;
  onClearModuleFilter?: () => void;
  onTriggerDriveSync?: () => void;
  isSyncingDrive?: boolean;
  syncedDriveCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  selectedModuleTitle,
  onClearModuleFilter,
  onTriggerDriveSync,
  isSyncingDrive = false,
  syncedDriveCount = 0,
}) => {
  const tabs: { id: TabType; label: string }[] = [
    { id: 'modules', label: 'Modules' },
    { id: 'cours', label: 'Cours' },
    { id: 'td', label: 'Travaux Dirigés' },
    { id: 'tp', label: 'Travaux Pratiques' },
    { id: 'video', label: 'Vidéothèque' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          
          {/* Zone 1: Wordmark */}
          <button
            onClick={() => onTabChange('modules')}
            className="text-lg font-black tracking-widest text-zinc-100 hover:text-white transition-colors cursor-pointer uppercase shrink-0"
          >
            CP2
          </button>

          {/* Zone 2: Minimal Navigation tabs */}
          <nav className="flex items-center gap-4 sm:gap-7 overflow-x-auto no-scrollbar py-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`text-xs sm:text-sm font-medium tracking-wide transition-colors whitespace-nowrap cursor-pointer shrink-0 relative py-2 ${
                    isActive
                      ? 'text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1-Click Drive Sync & Filter & Admin button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Quick 1-click Google Drive S3 Sync button */}
            {onTriggerDriveSync && (
              <button
                onClick={onTriggerDriveSync}
                disabled={isSyncingDrive}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                  syncedDriveCount > 0
                    ? 'bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-emerald-900/60'
                    : 'bg-zinc-100 hover:bg-white text-zinc-950 font-bold'
                }`}
                title="Synchroniser directement avec le dossier S3 Google Drive"
              >
                {isSyncingDrive ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : syncedDriveCount > 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <HardDrive className="w-3.5 h-3.5 text-zinc-950" />
                )}
                <span className="hidden sm:inline">
                  {isSyncingDrive
                    ? 'Sync...'
                    : syncedDriveCount > 0
                    ? `Dossier S3 (${syncedDriveCount})`
                    : 'Sync Drive S3'}
                </span>
              </button>
            )}

            {selectedModuleTitle && (
              <button
                onClick={onClearModuleFilter}
                className="text-[11px] font-mono text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 bg-zinc-900/80 px-2.5 py-1 rounded transition-colors cursor-pointer truncate max-w-[130px] hidden md:block"
                title="Afficher tous les modules"
              >
                {selectedModuleTitle} ✕
              </button>
            )}

            <button
              onClick={() => onTabChange('admin')}
              className={`p-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
              title="Espace Administrateur"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono uppercase tracking-wider hidden lg:inline">
                Admin
              </span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
