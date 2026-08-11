import React from 'react';

import { FleetPanel } from '../components/FleetPanel';
import { LiveWorkspace } from '../components/LiveWorkspace';

export const LiveMonitorPage: React.FC = () => {
  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <FleetPanel />
      <LiveWorkspace />
    </div>
  );
};
