export interface Vehicle {
  id: string;
  plate: string;
  driverName: string;
  driverImage?: string;
  status: 'running' | 'idle' | 'alert' | 'offline';
  statusText: string;
  speed: number;
  location: string;
  alertDetails?: string;
}

export const MOCK_VEHICLES: Vehicle[] = [
  {
    id: 'v1',
    plate: '700-7589 / AA AHP',
    driverName: 'สมชาย ขับดี',
    driverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuARez3I7RvZoCQXRuH7Rqw26pI8k6T9X2CDvSJX8yde5IT58tOlx0wE9f6RjRRIUUMlg3cfQEVvA1ybx2fd5B8ADrSJsV6ROxrN7gVYg1WIagKBG5d1iYJ_QckkZKdQ1EvLvNX-x-RZzK6NuUeY1TfXsvWJsqSVyK7axg517NkiSwQUF75n-Qcqv8WFz4_zNK3WSMP4gNNe5vIUv9dnD-sCAe06FnXrW5DJwS0EOWiWB1oP80NHig_Z',
    status: 'alert',
    statusText: 'FATIGUE DETECTED',
    speed: 85,
    location: 'ถ.สายเอเชีย, พระนครศรีอยุธยา',
    alertDetails: 'Eyes Closed (1.5s)'
  },
  {
    id: 'v2',
    plate: 'TS-02 (Truck 2)',
    driverName: 'กัลยวรรธน์ รักษวิณ',
    driverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuABQW7raUENf1Nx4wBJOVf-L6exRl2GCzp3xrizz336sWJuYcvaISr79a2ew7E9b-NeecowB12OzEoLKSOsVcT4nhsSPifr-WO6n1mSKr7SsPoT9iv40IqX3qi7cZNCE_us9fEPmZUvRV_jaxIJtDgf9G1TTzAZOGSHkNwAhoZ7UFtknFEXPntCpEftVNiVdaIuvoL5Pwyx6t48BHzYlQI2zNpuEZ6N1GTz7TjFePAu6i2S9sGw9Yb6',
    status: 'idle',
    statusText: 'จอดแช่ 45m',
    speed: 0,
    location: 'จุดจอด: คลังสินค้าวังน้อย'
  },
  {
    id: 'v3',
    plate: 'Test13052026',
    driverName: 'Unassigned',
    status: 'running',
    statusText: 'รถวิ่ง',
    speed: 62,
    location: 'ถ.บางนา-ตราด กม.10'
  }
];

export const MOCK_STATS = {
  total: 142,
  running: 42,
  idle: 5,
  alerts: 2
};
