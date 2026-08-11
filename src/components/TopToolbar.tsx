import React, { useState } from 'react';
import { Map, Shuffle, Grid2X2, ChevronDown, Maximize } from 'lucide-react';

export interface TopToolbarProps {
  onToggleMap?: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({ onToggleMap }) => {
  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<'all' | 1 | 2 | 3>('all');

  return (
    <div className="h-16 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-6 shrink-0 z-40 relative shadow-sm">
      <div className="flex items-center gap-3">
        <button onClick={onToggleMap} className="flex items-center gap-2 bg-surface-container text-on-surface-variant border border-outline-variant px-4 py-2 rounded-lg text-label-sm font-medium hover:bg-surface-container-highest transition-colors">
          <Map className="w-4 h-4" /> <span>Show Map View</span>
        </button>
        <button className="flex items-center gap-2 bg-surface-container text-on-surface-variant border border-outline-variant px-4 py-2 rounded-lg text-label-sm font-medium hover:bg-surface-container-highest transition-colors ml-2">
          <Shuffle className="w-4 h-4" /> <span>Random</span>
        </button>
        <div className="h-6 w-px bg-outline-variant mx-1"></div>
        <h2 className="font-jakarta font-bold text-on-surface text-body-lg">Live Workspace</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="relative group" onMouseEnter={() => setIsGridMenuOpen(true)} onMouseLeave={() => setIsGridMenuOpen(false)}>
            <button className="flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-highest transition-colors text-label-sm font-medium">
              <Grid2X2 className="w-4 h-4" /> <span>Grid Size</span> <ChevronDown className="w-3 h-3" />
            </button>
            {isGridMenuOpen && (
              <div className="absolute top-full right-0 mt-1 w-32 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-xl z-50 overflow-hidden">
                <button className="w-full text-left px-4 py-2 hover:bg-surface-container text-body-sm">1x1 View</button>
                <button className="w-full text-left px-4 py-2 hover:bg-surface-container text-body-sm">2x2 View</button>
                <button className="w-full text-left px-4 py-2 hover:bg-surface-container text-body-sm">3x3 View</button>
                <button className="w-full text-left px-4 py-2 hover:bg-surface-container text-body-sm">4x4 View</button>
              </div>
            )}
          </div>
          <div className="h-6 w-px bg-outline-variant"></div>
          <div className="flex bg-surface-container p-1 rounded-lg border border-outline-variant">
            <button onClick={() => setActiveChannel('all')} className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${activeChannel === 'all' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>ALL</button>
            <button onClick={() => setActiveChannel(1)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${activeChannel === 1 ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>CH1</button>
            <button onClick={() => setActiveChannel(2)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${activeChannel === 2 ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>CH2</button>
            <button onClick={() => setActiveChannel(3)} className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${activeChannel === 3 ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}>CH3</button>
          </div>
        </div>
        <button className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded-lg transition-colors bg-surface-container" title="Fullscreen">
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
