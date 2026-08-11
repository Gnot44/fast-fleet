import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MOCK_VEHICLES, MOCK_STATS } from '../data/mockData';
import L from 'leaflet';

// Fix default icon path issues with Leaflet in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Basic map center somewhere in central Thailand
const center: [number, number] = [14.35, 100.5];

export const LiveMap: React.FC = () => {
  return (
    <div className="w-full h-full bg-surface-container-highest border-b border-outline-variant relative z-10 shadow-sm">
      <MapContainer center={center} zoom={9} className="w-full h-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* Plot mock vehicles roughly around the center */}
        <Marker position={[14.35, 100.5]}>
          <Popup>
            <b>{MOCK_VEHICLES[0].plate}</b><br/>
            {MOCK_VEHICLES[0].location}
          </Popup>
        </Marker>
        <Marker position={[14.2, 100.7]}>
           <Popup>
            <b>{MOCK_VEHICLES[1].plate}</b><br/>
            {MOCK_VEHICLES[1].location}
          </Popup>
        </Marker>
        <Marker position={[13.7, 100.75]}>
           <Popup>
            <b>{MOCK_VEHICLES[2].plate}</b><br/>
            {MOCK_VEHICLES[2].location}
          </Popup>
        </Marker>

        {/* Simulated alert zones */}
        <Circle center={[14.35, 100.5]} radius={5000} pathOptions={{ color: '#ba1a1a', fillColor: '#ba1a1a', fillOpacity: 0.2 }} />
      </MapContainer>

      {/* Floating Map Info */}
      <div className="absolute bottom-4 left-4 z-[500] bg-surface-container-lowest/95 backdrop-blur-sm rounded-lg py-2 px-3 shadow-md border border-outline-variant flex items-center gap-3 text-[11px] font-medium">
        <div className="flex items-center gap-1.5 text-status-running">
          <span className="w-2 h-2 bg-status-running rounded-full"></span> วิ่ง {MOCK_STATS.running}
        </div>
        <div className="w-px h-3 bg-outline-variant"></div>
        <div className="flex items-center gap-1.5 text-status-idle">
          <span className="w-2 h-2 bg-status-idle rounded-full"></span> จอด {MOCK_STATS.idle}
        </div>
        <div className="w-px h-3 bg-outline-variant"></div>
        <div className="flex items-center gap-1.5 text-error">
          <span className="w-2 h-2 bg-error rounded-full animate-pulse"></span> Alert {MOCK_STATS.alerts}
        </div>
      </div>
    </div>
  );
};
