import React, { useState } from 'react';
import { TopToolbar } from './TopToolbar';
import { VideoGrid } from './VideoGrid';
import { LiveMap } from './LiveMap';

export const LiveWorkspace: React.FC = () => {
  const [isMapVisible, setIsMapVisible] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-surface-dim z-20 relative">
      <TopToolbar onToggleMap={() => setIsMapVisible(!isMapVisible)} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {isMapVisible && (
          <div className="w-full h-[40%] shrink-0">
            <LiveMap />
          </div>
        )}
        <VideoGrid />
      </div>
    </div>
  );
};
