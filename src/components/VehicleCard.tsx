import React from 'react';
import { MapPin, PhoneCall, TriangleAlert } from 'lucide-react';
import type { Vehicle } from '../data/mockData';

export interface VehicleCardProps {
  vehicle: Vehicle;
  onClick?: () => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, onClick }) => {
  const isAlert = vehicle.status === 'alert';
  const isIdle = vehicle.status === 'idle';
  
  const borderClass = isAlert ? 'border-2 border-error ring-2 ring-error/20 ring-offset-2 ring-offset-surface alert-flash' 
    : isIdle ? 'border border-outline-variant hover:border-status-idle hover:shadow-md' 
    : 'border border-outline-variant hover:border-primary hover:shadow-md opacity-80 hover:opacity-100';

  return (
    <div onClick={onClick} className={`bg-surface-container-lowest rounded-xl p-4 shadow-sm relative cursor-pointer transition-all ${borderClass}`}>
      {isAlert && (
        <div className="absolute top-0 right-0 bg-error text-on-error text-[10px] font-bold px-2.5 py-1 rounded-bl-lg rounded-tr-lg flex items-center gap-1.5 shadow-sm">
          <TriangleAlert className="w-3 h-3" /> {vehicle.statusText}
        </div>
      )}
      
      <div className="flex justify-between items-start mt-1">
        <div>
          <h3 className="font-jakarta font-bold text-on-surface text-body-lg">{vehicle.plate}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-6 h-6 bg-surface-container-highest rounded-full overflow-hidden shrink-0 ring-1 ring-outline-variant flex items-center justify-center text-[10px] font-bold text-on-surface-variant">
              {vehicle.driverImage ? (
                <img className="w-full h-full object-cover" src={vehicle.driverImage} alt={vehicle.driverName} />
              ) : (
                vehicle.driverName.charAt(0).toUpperCase()
              )}
            </div>
            <p className={`text-body-sm font-medium ${vehicle.driverName === 'Unassigned' ? 'text-outline italic' : 'text-on-surface-variant'}`}>
              {vehicle.driverName}
            </p>
            {vehicle.driverName !== 'Unassigned' && (
              <button className="ml-1 text-primary hover:bg-primary-container hover:text-on-primary-container p-1.5 rounded-md transition-colors" title="โทรหาคนขับ">
                <PhoneCall className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 mt-3">
        <button className="flex-1 py-1 px-1.5 bg-surface-container border border-outline-variant/50 rounded-md text-[9px] font-bold text-on-surface-variant hover:bg-primary hover:text-on-primary hover:border-primary transition-colors" title="CH 1: Front">CH 1</button>
        <button className={`flex-1 py-1 px-1.5 rounded-md text-[9px] font-bold transition-colors ${isAlert ? 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-on-primary' : 'bg-surface-container border border-outline-variant/50 text-on-surface-variant hover:bg-primary hover:text-on-primary hover:border-primary'}`} title="CH 2: DMS">CH 2</button>
        <button className="flex-1 py-1 px-1.5 bg-surface-container border border-outline-variant/50 rounded-md text-[9px] font-bold text-on-surface-variant hover:bg-primary hover:text-on-primary hover:border-primary transition-colors" title="CH 3: Cargo">CH 3</button>
        <button className="flex-1 py-1 px-1.5 bg-surface-container border border-outline-variant/50 rounded-md text-[9px] font-bold text-on-surface-variant hover:bg-primary hover:text-on-primary hover:border-primary transition-colors" title="CH 4: Rear">CH 4</button>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className={`${isAlert ? 'bg-error-container/30 border border-error-container' : 'bg-surface-container border border-outline-variant'} rounded-lg p-2.5 flex flex-col`}>
          <span className="text-[10px] text-on-surface-variant mb-0.5">ความเร็ว</span>
          <span className={`text-label-md font-bold ${isAlert ? 'text-error' : 'text-on-surface'}`}>
            {vehicle.speed} <span className={`text-[10px] font-normal ${isAlert ? 'opacity-80' : 'text-on-surface-variant'}`}>km/h</span>
          </span>
        </div>
        <div className={`${isIdle ? 'bg-surface-container border-status-idle/30' : 'bg-surface-container border-outline-variant'} rounded-lg p-2.5 border flex flex-col`}>
          <span className="text-[10px] text-on-surface-variant mb-0.5">สถานะ</span>
          <span className={`text-label-md font-bold flex items-center gap-1.5 ${isAlert || vehicle.status === 'running' ? 'text-status-running' : isIdle ? 'text-status-idle' : 'text-on-surface'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isIdle ? 'bg-status-idle' : 'bg-status-running'}`}></span>
            {vehicle.statusText}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2 mt-3 pt-3 border-t border-outline-variant text-[11px] text-on-surface-variant">
        <MapPin className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isIdle ? 'text-primary' : 'text-outline'}`} /> 
        <span className={`${isIdle ? 'font-medium text-primary' : 'truncate'}`}>{vehicle.location}</span>
      </div>
    </div>
  );
};
