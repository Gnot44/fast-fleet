import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { MOCK_VEHICLES, MOCK_STATS } from '../data/mockData';
import { VehicleCard } from './VehicleCard';

export interface FleetPanelProps {
  className?: string;
}

export const FleetPanel: React.FC<FleetPanelProps> = ({ className = '' }) => {
  const [filter, setFilter] = useState<'all' | 'running' | 'idle' | 'alert'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVehicles = MOCK_VEHICLES.filter(v => {
    if (filter !== 'all' && v.status !== filter) return false;
    if (searchQuery && !v.plate.toLowerCase().includes(searchQuery.toLowerCase()) && !v.driverName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className={`w-[340px] bg-surface border-r border-outline-variant flex flex-col shrink-0 h-full z-30 ${className}`}>
      <div className="px-5 pt-5 pb-4 border-b border-outline-variant bg-surface-container-lowest shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-jakarta font-bold text-on-surface text-headline-sm">Fleet Status</h2>
          <span className="bg-surface-container text-on-surface-variant text-[11px] px-2.5 py-1 rounded-md font-medium">{MOCK_STATS.total} Vehicles</span>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full text-body-sm bg-surface-container-lowest border border-outline-variant rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/70 text-on-surface"
            placeholder="ค้นหาทะเบียน, ชื่อคนขับ..."
            type="text"
          />
        </div>

        <div className="flex items-center gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setFilter('all')} className={`px-3.5 py-1.5 rounded-full text-[11px] font-medium shrink-0 shadow-sm transition-colors ${filter === 'all' ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
            All
          </button>
          <button onClick={() => setFilter('running')} className={`px-3.5 py-1.5 rounded-full text-[11px] font-medium shrink-0 flex items-center gap-1.5 transition-colors ${filter === 'running' ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
            <span className="w-1.5 h-1.5 bg-status-running rounded-full"></span> วิ่ง ({MOCK_STATS.running})
          </button>
          <button onClick={() => setFilter('idle')} className={`px-3.5 py-1.5 rounded-full text-[11px] font-medium shrink-0 flex items-center gap-1.5 transition-colors ${filter === 'idle' ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
            <span className="w-1.5 h-1.5 bg-status-idle rounded-full"></span> จอดแช่ ({MOCK_STATS.idle})
          </button>
          <button onClick={() => setFilter('alert')} className={`px-3.5 py-1.5 rounded-full text-[11px] font-medium shrink-0 flex items-center gap-1.5 transition-colors ${filter === 'alert' ? 'bg-error-container border border-error-container text-error' : 'bg-error-container/50 border border-error-container text-error hover:bg-error-container'}`}>
            <span className="w-1.5 h-1.5 bg-error rounded-full animate-pulse"></span> Alerts ({MOCK_STATS.alerts})
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3 bg-surface">
        {filteredVehicles.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
    </div>
  );
};
