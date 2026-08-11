import React, { useState } from 'react';
import { LayoutDashboard, MapPin, Monitor, PlayCircle, Truck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(true);

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/map', label: 'Live Map', icon: MapPin },
    { path: '/', label: 'Live Monitor', icon: Monitor },
    { path: '/playback', label: 'Playback', icon: PlayCircle },
    { path: '/vehicles', label: 'Vehicles', icon: Truck },
  ];

  return (
    <div className={`bg-surface-container-lowest border-r border-outline-variant flex flex-col shrink-0 h-full z-40 shadow-sm transition-all duration-300 relative ${isExpanded ? 'w-[240px]' : 'w-[72px]'} ${className}`}>
      
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-6 w-6 h-6 bg-surface-container-highest border border-outline-variant rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary z-50 shadow-sm"
      >
        {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <div className="p-5 flex items-center justify-center lg:justify-start gap-3 h-16 shrink-0 border-b border-outline-variant/50 overflow-hidden">
        <Link to="/" className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-on-primary shrink-0 shadow-sm">
          <Monitor className="w-4 h-4" />
        </Link>
        {isExpanded && (
          <Link to="/">
            <h1 className="font-jakarta font-bold text-on-surface text-label-md leading-tight tracking-tight whitespace-nowrap">Logistics Pro</h1>
          </Link>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-label-md text-on-surface-variant no-scrollbar">
        {isExpanded && (
          <div className="text-[10px] font-bold text-outline uppercase tracking-widest px-3 py-2 mb-1">
            Operations
          </div>
        )}
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              className={`flex items-center ${isExpanded ? 'justify-start' : 'justify-center'} gap-3 px-3 py-2.5 rounded-lg transition-colors group ${isActive ? 'bg-primary-container text-on-primary-container font-medium' : 'hover:bg-surface-container'}`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? '' : 'group-hover:text-primary transition-colors'}`} />
              {isExpanded && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
