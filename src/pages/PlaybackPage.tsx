import React from 'react';

export interface PlaybackPageProps {
  className?: string;
}

export const PlaybackPage: React.FC<PlaybackPageProps> = ({ className = '' }) => {
  return (
    <div className={`flex flex-col h-full overflow-hidden flex-1 ${className}`}>
      {/* Top App Bar Area */}
      <header className="h-16 bg-surface-container-lowest border-b border-outline-variant/50 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">videocam</span>
          </div>
          <h1 className="text-headline-sm font-jakarta text-on-surface tracking-tight">Server Playback</h1>
          <div className="flex items-center text-label-sm font-medium text-on-surface-variant mx-4 tracking-wider">
            <span>PLAYBACK</span>
            <span className="material-symbols-outlined mx-2 text-[16px]">chevron_right</span>
            <span className="text-primary font-semibold">SERVER PLAYBACK</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Vehicle Selector */}
          <div className="flex items-center gap-2">
            <select className="bg-surface border border-outline-variant rounded-lg text-sm text-on-surface px-3 py-1.5 focus:ring-primary focus:border-primary w-48 shadow-sm">
              <option>Express Logistics Group</option>
            </select>
            <select className="bg-surface border border-outline-variant rounded-lg text-sm text-on-surface px-3 py-1.5 focus:ring-primary focus:border-primary w-48 shadow-sm">
              <option>70-1234 BKK</option>
            </select>
            <div className="bg-surface-variant border border-outline-variant rounded text-[10px] px-2 py-0.5 text-on-surface-variant font-bold">
              GMS
            </div>
          </div>
          {/* Date Selector */}
          <div className="relative">
            <input
              className="bg-surface border border-outline-variant rounded-lg text-sm text-on-surface px-3 py-1.5 focus:ring-primary focus:border-primary w-40 shadow-sm"
              type="date"
              defaultValue="2026-08-07"
            />
          </div>
          <button className="w-8 h-8 rounded-lg bg-surface border border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:text-primary flex items-center justify-center transition-colors shadow-sm">
            <span className="material-symbols-outlined text-[18px]">filter_alt</span>
          </button>
        </div>
      </header>

      {/* Vehicle Status Header */}
      <div className="bg-surface-container-lowest border-b border-outline-variant/50 px-6 py-3 flex items-center gap-6 shrink-0 shadow-sm z-0">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-status-running text-[20px]">directions_car</span>
          <span className="text-label-md text-on-surface font-semibold tracking-tight">70-1234 BKK</span>
        </div>
        <div className="h-4 w-px bg-outline-variant/50"></div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-status-running"></div>
          <span className="text-body-sm text-on-surface-variant font-medium">Engine ON</span>
        </div>
        <div className="h-4 w-px bg-outline-variant/50"></div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">person</span>
          <span className="text-body-sm text-on-surface-variant font-medium">Driver: John Doe</span>
        </div>
        <div className="h-4 w-px bg-outline-variant/50"></div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-status-running text-[18px]">signal_cellular_4_bar</span>
          <span className="text-body-sm text-on-surface-variant font-medium">Strong Signal</span>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 overflow-y-auto flex flex-col p-4 gap-4 bg-surface-container-lowest">
        {/* Top Section: Video/Map + Event Log */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-[400px] shrink-0">
          {/* Video & Map Row (Takes 3 columns) */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Map Area */}
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 overflow-hidden relative shadow-sm h-full">
              <div className="absolute top-3 right-3 z-10 flex bg-surface-container-lowest rounded-lg border border-outline-variant/50 text-xs shadow-sm overflow-hidden font-medium">
                <button className="px-3 py-1.5 text-on-surface-variant hover:bg-surface-container-low transition-colors">
                  OSM
                </button>
                <button className="px-3 py-1.5 bg-primary/10 text-primary font-semibold border-l border-outline-variant/50">
                  Deemap
                </button>
              </div>
              <div
                className="w-full h-full bg-cover bg-center"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCNq2PiDGP_v5Gw-YrHTWvBZVCMEJp4o89_XL4Y4rxg5VjgIgAbgtya02lHh0sSr0qVUeMhmAI2BtvMWoUWTrE2Dnc83OZ0A7I7_6004KHYwV2-6tyO-fHDv3s3muNbcEUH66Hw35TDVla9hqDouctUZG8helJUeInzU-MQOX77xNruDhPQMujeAMTzkFWLiCcp4XlExo26kxJA8NNCtDeN5A5Xalf9YqoolsNacebfI9cucmg-RtKu')",
                }}
              ></div>
            </div>

            {/* Video Areas */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4 h-full">
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 overflow-hidden relative shadow-sm aspect-video">
                <div className="absolute top-2 left-2 z-10 bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface text-[10px] px-2 py-1 rounded-md font-semibold border border-outline-variant/50 shadow-sm tracking-wide">
                  CH1 (Front)
                </div>
                <div
                  className="w-full h-full bg-cover bg-center bg-surface-container-high"
                  style={{
                    backgroundImage:
                      "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDMZ3PscnjH4cu9Q57eXpxF0GSfGuex4V3GVsjanyH3oVyWLB_d3WiCg2zHSRAcPqfvNU3ngu0lg7G5yVc8nk7WuxmjDvE4IRe8QU50_x2wkpnYZdycp9mDcIjFY_0RReATYBwGdBpb8hoRYGlQvCumlS1jOH-llvonDqpSCNrX5Rbnk62gtTqEyX82Uck1M7QvOEubFthr2NdkBCaMGYqFJog9CQHPWxS49GPf8QsdWZc7AT3AMNOx')",
                  }}
                ></div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 overflow-hidden relative shadow-sm aspect-video">
                <div className="absolute top-2 left-2 z-10 bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface text-[10px] px-2 py-1 rounded-md font-semibold border border-outline-variant/50 shadow-sm tracking-wide">
                  CH2 (Cargo)
                </div>
                <div
                  className="w-full h-full bg-cover bg-center bg-surface-container-high"
                  style={{
                    backgroundImage:
                      "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCOb-XPwGjSAz_-F6qpsARpFFTev9EIMAFyNbf8cVs47Asea-fqz8gSjf0oX7WDKq0CboZJQuyAXWkSshLZtxmDay6pdTfFeiHYI4YwLqADT5tlpHIcJF1qx8FB8f6BkAs9VbhNBxbiWjwQHsbfApA8Lu5Mw8Z-8iToj8dwGi8Xn-DKbFNgai_y_4md4PZ50deJK7NGMeu5tBBaFQS7Xq-BZVqzpxMUDjB9rgAI8Mwz2f-LsjZ2A9XI')",
                  }}
                ></div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 overflow-hidden relative shadow-sm aspect-video">
                <div className="absolute top-2 left-2 z-10 bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface text-[10px] px-2 py-1 rounded-md font-semibold border border-outline-variant/50 shadow-sm tracking-wide">
                  CH3 (Left)
                </div>
                <div className="w-full h-full bg-surface-container flex items-center justify-center text-on-surface-variant/50">
                  <span className="material-symbols-outlined text-[32px]">videocam_off</span>
                </div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 overflow-hidden relative shadow-sm aspect-video">
                <div className="absolute top-2 left-2 z-10 bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface text-[10px] px-2 py-1 rounded-md font-semibold border border-outline-variant/50 shadow-sm tracking-wide">
                  CH4 (Right)
                </div>
                <div className="w-full h-full bg-surface-container flex items-center justify-center text-on-surface-variant/50">
                  <span className="material-symbols-outlined text-[32px]">videocam_off</span>
                </div>
              </div>
            </div>
          </div>

          {/* Event Log Sidebar */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 flex flex-col shadow-sm h-[400px] lg:col-span-1">
            <div className="p-4 border-b border-outline-variant/50 flex items-center justify-between bg-surface-container-low/30 rounded-t-xl">
              <h3 className="text-label-md font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">list_alt</span> Event Log
              </h3>
              <div className="text-xs text-on-surface-variant font-medium bg-surface px-2.5 py-1 rounded-md border border-outline-variant/50 shadow-sm">
                Today
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {/* Event Items */}
              <button className="w-full text-left p-3 rounded-xl hover:bg-surface-container-low transition-colors flex items-start gap-3 group border border-transparent hover:border-outline-variant/30">
                <div className="w-8 h-8 rounded-full bg-status-alert/10 text-status-alert flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[16px]">speed</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-on-surface flex justify-between tracking-tight">
                    <span className="truncate">Over Speed</span>
                    <span className="text-xs text-on-surface-variant font-medium">10:45:22</span>
                  </div>
                  <div className="text-xs text-on-surface-variant truncate mt-0.5">Speed: 95 km/h (Limit: 90)</div>
                </div>
              </button>
              <button className="w-full text-left p-3 rounded-xl transition-colors flex items-start gap-3 group bg-primary/5 border border-primary/20 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-status-idle/10 text-status-idle flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-primary flex justify-between tracking-tight">
                    <span className="truncate">Harsh Braking</span>
                    <span className="text-xs text-primary font-medium">08:12:05</span>
                  </div>
                  <div className="text-xs text-on-surface-variant truncate mt-0.5">Deceleration: &gt; 10km/h/s</div>
                </div>
              </button>
              <button className="w-full text-left p-3 rounded-xl hover:bg-surface-container-low transition-colors flex items-start gap-3 group border border-transparent hover:border-outline-variant/30">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[16px]">map</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-on-surface flex justify-between tracking-tight">
                    <span className="truncate">Geofence Exit</span>
                    <span className="text-xs text-on-surface-variant font-medium">07:30:00</span>
                  </div>
                  <div className="text-xs text-on-surface-variant truncate mt-0.5">Zone: Distribution Center</div>
                </div>
              </button>
              <button className="w-full text-left p-3 rounded-xl hover:bg-surface-container-low transition-colors flex items-start gap-3 group border border-transparent hover:border-outline-variant/30">
                <div className="w-8 h-8 rounded-full bg-status-stopped/10 text-status-stopped flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-on-surface flex justify-between tracking-tight">
                    <span className="truncate">Engine Start</span>
                    <span className="text-xs text-on-surface-variant font-medium">06:05:12</span>
                  </div>
                  <div className="text-xs text-on-surface-variant truncate mt-0.5">Ignition ON</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 p-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex items-center justify-center transition-all hover:shadow-sm">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
            <button className="w-10 h-10 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex items-center justify-center transition-all hover:shadow-sm">
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
            </button>
          </div>
          <div className="flex items-center gap-6">
            <button className="text-on-surface-variant hover:text-primary transition-colors hover:scale-110 transform">
              <span className="material-symbols-outlined text-[28px]">skip_previous</span>
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-colors hover:scale-110 transform">
              <span className="material-symbols-outlined text-[28px]">fast_rewind</span>
            </button>
            <button className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all focus:ring-4 focus:ring-primary/30 hover:scale-105 transform">
              <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                play_arrow
              </span>
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-colors hover:scale-110 transform">
              <span className="material-symbols-outlined text-[28px]">fast_forward</span>
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-colors hover:scale-110 transform">
              <span className="material-symbols-outlined text-[28px]">skip_next</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-surface border border-outline-variant/50 rounded-lg p-1 shadow-sm">
              <button className="px-3 py-1.5 rounded-md text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors">
                0.5x
              </button>
              <button className="px-3 py-1.5 rounded-md bg-surface-container-high text-xs font-bold text-on-surface shadow-sm">
                1x
              </button>
              <button className="px-3 py-1.5 rounded-md text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors">
                2x
              </button>
              <button className="px-3 py-1.5 rounded-md text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors">
                4x
              </button>
            </div>
            <button className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors bg-surface rounded-lg border border-outline-variant/50 shadow-sm hover:bg-surface-container-low">
              <span className="material-symbols-outlined text-[20px]">volume_up</span>
            </button>
            <button className="px-5 py-2.5 bg-surface border border-outline-variant hover:bg-surface-container-low text-on-surface rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm">
              <span className="material-symbols-outlined text-[18px]">download</span> Export
            </button>
          </div>
        </div>

        {/* Compact Timeline Selection */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 p-5 shrink-0 flex flex-col gap-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-outline-variant/30 pb-4">
            <div className="flex items-center gap-4">
              <span className="text-label-md font-bold text-on-surface">Channels:</span>
              <div className="flex bg-surface-container-low rounded-lg p-1 border border-outline-variant/50 shadow-inner">
                <button className="px-5 py-1.5 rounded-md bg-white shadow-sm text-primary text-xs font-bold border border-outline-variant/30">
                  CH1
                </button>
                <button className="px-5 py-1.5 rounded-md text-on-surface-variant text-xs font-semibold hover:bg-white/50 transition-colors">
                  CH2
                </button>
                <button className="px-5 py-1.5 rounded-md text-on-surface-variant text-xs font-semibold hover:bg-white/50 transition-colors">
                  CH3
                </button>
                <button className="px-5 py-1.5 rounded-md text-on-surface-variant text-xs font-semibold hover:bg-white/50 transition-colors">
                  CH4
                </button>
              </div>
            </div>
            <div className="text-sm font-mono bg-surface-container px-4 py-1.5 rounded-lg border border-outline-variant/50 text-on-surface font-bold shadow-sm tracking-wider">
              08:12:05
            </div>
          </div>
          {/* Hour Grid */}
          <div>
            <div className="text-label-sm font-semibold text-on-surface-variant mb-3 tracking-wide">
              Hour (Recorded segments highlighted):
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide">
              {[...Array(24)].map((_, i) => {
                const hour = i.toString().padStart(2, '0');
                const isPrimary = i >= 4 && i <= 10;
                const isSelected = i === 6;
                const isCurrent = i === 8;
                
                let className = "w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-[11px] relative transition-colors shadow-sm ";
                if (isSelected) {
                  className += "bg-primary border border-primary text-white font-bold shadow-md";
                } else if (isCurrent) {
                  className += "bg-primary text-white font-bold border border-primary shadow-md";
                } else if (isPrimary) {
                  className += "bg-primary/10 border border-primary/20 text-primary font-semibold hover:bg-primary/20 cursor-pointer";
                } else {
                  className += "bg-surface border border-outline-variant/50 text-on-surface-variant opacity-60 hover:opacity-100 cursor-pointer";
                }

                return (
                  <div key={hour} className={className}>
                    {hour}
                    {isCurrent && <div className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-status-idle"></div>}
                    {i === 10 && <div className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-status-alert"></div>}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Minute Scrubber */}
          <div>
            <div className="text-label-sm font-semibold text-on-surface-variant mb-3 tracking-wide">Minute (08:xx):</div>
            <div className="relative h-12 bg-surface-container-low rounded-xl border border-outline-variant/50 flex items-center px-3 shadow-inner">
              {/* Timeline Base */}
              <div className="absolute left-5 right-5 h-2.5 bg-surface-variant rounded-full overflow-hidden shadow-inner">
                {/* Recorded Segment Indicator */}
                <div className="absolute left-0 w-1/3 h-full bg-primary/40"></div>
                <div className="absolute left-1/3 w-1/4 h-full bg-primary/70"></div>
                <div className="absolute left-7/12 w-1/5 h-full bg-primary/40"></div>
                <div className="absolute left-[20%] top-0 bottom-0 w-0.5 bg-status-idle z-20"></div>
                <div className="absolute left-[65%] top-0 bottom-0 w-0.5 bg-status-alert z-20"></div>
              </div>
              {/* Scrubber Handle */}
              <div className="absolute left-[20%] w-5 h-9 bg-surface border-2 border-primary rounded-md shadow-md cursor-ew-resize z-10 flex items-center justify-center -translate-x-1/2 hover:scale-105 transition-transform">
                <div className="w-0.5 h-4 bg-primary/60 rounded-full"></div>
              </div>
              {/* Minute Markers */}
              <div className="w-full flex justify-between px-2 text-[10px] text-on-surface-variant mt-7 relative z-0 pointer-events-none font-medium">
                <span>00</span>
                <span>10</span>
                <span>20</span>
                <span>30</span>
                <span>40</span>
                <span>50</span>
                <span>60</span>
              </div>
            </div>
          </div>
        </div>

        {/* Telemetry Graph */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 p-5 min-h-[220px] flex flex-col shadow-sm mb-4">
          <div className="flex justify-between items-center mb-5">
            <div className="text-sm font-bold text-on-surface">ความเร็ว (km/h)</div>
            <div className="flex items-center gap-5 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-primary rounded-full"></div>
                <span className="text-on-surface-variant font-medium">Speed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-status-alert border border-status-alert border-dashed"></div>
                <span className="text-on-surface-variant font-medium">Limit (90)</span>
              </div>
            </div>
          </div>
          <div className="relative flex-1 w-full border-l border-b border-outline-variant/50 ml-7 mb-5">
            {/* Graph Grid */}
            <div className="absolute inset-0 grid grid-rows-4 grid-cols-6 pointer-events-none">
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-r border-surface-variant/50"></div>
              <div className="border-b border-surface-variant/50"></div>
              <div className="border-r border-surface-variant/50"></div>
              <div className="border-r border-surface-variant/50"></div>
              <div className="border-r border-surface-variant/50"></div>
              <div className="border-r border-surface-variant/50"></div>
              <div className="border-r border-surface-variant/50"></div>
              <div></div>
            </div>
            {/* Y Axis Labels */}
            <div className="absolute -left-8 top-0 bottom-0 flex flex-col justify-between text-[10px] text-on-surface-variant pb-1 font-mono font-medium">
              <span>120</span>
              <span>90</span>
              <span>60</span>
              <span>30</span>
              <span>0</span>
            </div>
            {/* X Axis Labels */}
            <div className="absolute left-0 right-0 -bottom-6 flex justify-between text-[10px] text-on-surface-variant px-1 font-mono font-medium">
              <span>04:00</span>
              <span>05:00</span>
              <span>06:00</span>
              <span>07:00</span>
              <span>08:00</span>
              <span>09:00</span>
              <span>10:00</span>
            </div>
            {/* Limit Line */}
            <div className="absolute left-0 right-0 top-1/4 border-t border-dashed border-status-alert/70 z-10"></div>
            {/* Current Time Indicator */}
            <div className="absolute top-0 bottom-0 left-[65%] border-l-2 border-status-idle z-20">
              <div className="absolute -top-3 -translate-x-1/2 bg-status-idle text-white text-[10px] px-1.5 py-0.5 rounded shadow-md font-bold tracking-wider">
                08:12
              </div>
            </div>
            {/* Simulated Graph Line */}
            <svg className="absolute inset-0 h-full w-full z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
              <polygon fill="rgba(37, 99, 235, 0.1)" points="0,100 10,100 15,80 20,85 25,70 30,75 35,60 40,65 45,50 50,55 55,40 60,45 65,25 70,30 75,100 100,100" />
              <polyline fill="none" points="0,100 10,100 15,80 20,85 25,70 30,75 35,60 40,65 45,50 50,55 55,40 60,45 65,25 70,30 75,100 100,100" stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              <circle cx="65" cy="25" fill="#EF4444" r="3" className="shadow-sm" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
