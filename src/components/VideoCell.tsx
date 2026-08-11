import React from 'react';
import { User, TriangleAlert } from 'lucide-react';
import type { Vehicle } from '../data/mockData';

export interface VideoCellProps {
  vehicle: Vehicle;
}

export const VideoCell: React.FC<VideoCellProps> = ({ vehicle }) => {
  const isAlert = vehicle.status === 'alert';

  return (
    <div className={`video-cell bg-on-background rounded-xl relative overflow-hidden flex flex-col min-h-[280px] group ${isAlert ? 'border-error ring-2 ring-error/50 ring-offset-2 ring-offset-surface-dim' : ''}`}>
      <img 
        className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-lighten"
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuBwXI6xU6P8gA6e3hny5cFqKRkFB6RJO53Yt9EEtl-9qbjFkbs-lQUaq7L4eMSgMLg17CJ_i3xKphuBn3ytKxwx8BftBYcRgYz2i-VSnzGxx-HgKy_fTIG-hKx5XQZGiXiNNuozuauGiP5alMLjIQlmd9khB5KEuqrRBA7sZ-VFEHw_Wjs1UWaj2CzTUlcYJpgc966sJO9v6IEqvLohBRDu8Ux0NccX-dkZnKLt1olmUW4rxaEg9Pzi"
        alt="Video feed"
      />
      
      {isAlert && <div className="absolute inset-0 bg-error/10 alert-flash pointer-events-none"></div>}

      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-start z-10">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className={`${isAlert ? 'bg-error text-on-error' : 'bg-surface-container text-on-surface-variant'} text-[10px] font-bold px-2 py-0.5 rounded shadow-sm`}>
              CH 2 (DMS)
            </span>
            <span className="text-white font-jakarta font-bold text-body-md shadow-sm">{vehicle.plate}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-surface-container-highest font-medium">
            <User className="w-3.5 h-3.5 text-primary-fixed-dim" /> {vehicle.driverName}
          </div>
        </div>
        {isAlert && (
          <div className="flex flex-col items-end gap-1">
            <span className="flex items-center gap-1.5 bg-error text-on-error px-2.5 py-1 rounded-md text-[10px] font-bold shadow-md animate-pulse border border-error-container">
              <TriangleAlert className="w-3 h-3" /> {vehicle.statusText}
            </span>
          </div>
        )}
      </div>

      {isAlert && (
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 pointer-events-none">
          <div className="w-32 h-32 border-2 border-error rounded-lg absolute shadow-[0_0_15px_rgba(186,26,26,0.5)]">
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-error text-on-error text-[10px] px-2 py-0.5 rounded-sm font-bold whitespace-nowrap shadow-sm">
              {vehicle.alertDetails}
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex justify-between items-end z-10">
        <div className="flex flex-col gap-2 w-2/3">
          <div className="flex items-center gap-2 text-surface-container-highest text-[11px] truncate font-medium">
            <span className="text-primary-fixed-dim">{vehicle.speed} km/h</span>
            <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span className="truncate">{vehicle.location}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
