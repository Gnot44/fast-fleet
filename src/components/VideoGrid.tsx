import React, { useState } from 'react';
import { VideoCell } from './VideoCell';
import { MOCK_VEHICLES } from '../data/mockData';

export const VideoGrid: React.FC = () => {
  const [gridSize] = useState(2);

  // For demo, just slice mock vehicles based on grid size (which corresponds to number of items: 1x1=1, 2x2=4)
  const itemCount = gridSize * gridSize;
  // Repeat vehicles if needed to fill the grid for demo
  const displayVehicles = Array.from({ length: itemCount }).map((_, i) => MOCK_VEHICLES[i % MOCK_VEHICLES.length]);

  return (
    <div className="flex-1 p-4 overflow-y-auto no-scrollbar workspace-transition" id="workspace-video">
      <div className={`grid gap-4 h-full relative ${gridSize === 1 ? 'grid-cols-1' : gridSize === 2 ? 'grid-cols-1 xl:grid-cols-2' : gridSize === 3 ? 'grid-cols-2 xl:grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'}`}>
        {displayVehicles.map((vehicle, index) => (
          <VideoCell key={`${vehicle.id}-${index}`} vehicle={vehicle} />
        ))}
      </div>
    </div>
  );
};
