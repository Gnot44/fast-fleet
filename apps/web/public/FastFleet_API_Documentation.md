# FastFleet Enterprise Telemetry & Real-Time GPS API
### Official Developer Integration Guide & Reference (v1.4)

---

## 1. Overview
The **FastFleet Telemetry & Field Marketing API** enables enterprise developers to seamlessly integrate real-time GPS coordinates, vehicle telemetry, specialist attendance, and trip drop-off events into external Command Centers, ERPs (e.g., SAP, Oracle), CRMs (Salesforce), and Transportation Management Systems (TMS).

### Base URLs
* **REST API Gateway**: `https://api.fastfleet.io/v1`
* **WebSocket Stream**: `wss://api.fastfleet.io/v1/telemetry/stream`

---

## 2. Authentication
All API requests and WebSocket handshakes require a valid **Production Secret API Key**.

### Authorization Header (Recommended)
Include your API Key in the `Authorization` header as a Bearer token:
```http
Authorization: Bearer flt_live_mkt_your_secret_api_key_here
```

### URL Query Parameter (For WebSockets)
```text
wss://api.fastfleet.io/v1/telemetry/stream?token=flt_live_mkt_your_secret_api_key_here
```

> **Security Note:** Keep your Production Secret API Key confidential. Never expose it in client-side public web code without token proxying.

---

## 3. REST API Endpoints

### 3.1 Get Live Specialist Telemetry Feed
Retrieve real-time GPS fixes, motion states, speed, battery, and current assigned trip details for all field specialists.

* **Method:** `GET`
* **Endpoint:** `/telemetry/live`
* **Query Parameters:**
  * `status` (optional): `online` | `moving` | `stationary` | `offline`
  * `department` (optional): Filter by department name (e.g., `Key Accounts & Enterprise`)

#### Sample Request (cURL)
```bash
curl -X GET "https://api.fastfleet.io/v1/telemetry/live?status=online" \
  -H "Authorization: Bearer flt_live_mkt_99a8b7c6d5e4f3a2b1c0987654321" \
  -H "Content-Type: application/json"
```

#### Sample Response (`200 OK`)
```json
{
  "success": true,
  "timestamp": "2026-08-20T06:05:00.000Z",
  "count": 2,
  "data": [
    {
      "id": "c1f7a8b9-0001-4444-9999-000000000001",
      "employeeId": "AITS10002772",
      "fullName": "Somchai Rakdee",
      "nickname": "Somchai",
      "department": "Key Accounts & Enterprise",
      "territory": "Bangkok Central",
      "vehiclePlate": "1กก-4452 กทม.",
      "isOnline": true,
      "motionStatus": "Running",
      "telemetry": {
        "latitude": 13.7462,
        "longitude": 100.5347,
        "speedKmH": 28.5,
        "batteryPercent": 85,
        "lastPing": "2026-08-20T06:04:52.000Z",
        "currentAddress": "Rama I Rd, Pathum Wan, Bangkok 10330"
      },
      "activeTrip": {
        "tripCode": "TRP-20260820-001",
        "title": "B2B Key Account Visit",
        "totalDrops": 4,
        "completedDrops": 1,
        "currentDrop": {
          "dropNumber": 2,
          "clientName": "Siam Paragon Cineplex",
          "address": "991 Rama I Rd, Pathum Wan, Bangkok",
          "status": "In Progress"
        }
      }
    }
  ]
}
```

---

### 3.2 List All Marketing Specialists
Retrieve directory metadata of all registered marketing staff, vehicles, and assigned territory.

* **Method:** `GET`
* **Endpoint:** `/specialists`

#### Sample Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "c1f7a8b9-0001-4444-9999-000000000001",
      "employeeId": "AITS10002772",
      "fullName": "Somchai Rakdee",
      "phone": "081-445-9988",
      "position": "Senior Marketing Specialist",
      "department": "Key Accounts & Enterprise",
      "assignedVehicle": {
        "plate": "1กก-4452 กทม.",
        "model": "Isuzu D-Max SpaceCab 1.9",
        "type": "Pickup Truck"
      },
      "drivingLicense": {
        "licenseNo": "DL-9948201",
        "type": "ใบอนุญาตขับรถยนต์ส่วนบุคคล (ชั่วคราว/5 ปี)",
        "expiryDate": "2029-12-31"
      }
    }
  ]
}
```

---

### 3.3 Query Trip Schedules & Visit History
* **Method:** `GET`
* **Endpoint:** `/trips`
* **Query Parameters:** `from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&staff_id=UUID`

---

## 4. Real-Time WebSocket Telemetry Stream

Connect to the WebSocket gateway for low-latency live map streaming and instant drop check-in notifications.

### 4.1 Connection
```text
wss://api.fastfleet.io/v1/telemetry/stream?token=YOUR_API_KEY
```

### 4.2 Stream Event Types
* `telemetry.gps_update`: Dispatched whenever a phone transmits a filtered, anti-drift-verified coordinate.
* `appointment.checkin`: Dispatched when a specialist confirms arrival at a client drop location.
* `trip.status_change`: Dispatched when a trip begins, completes, or submits for approval.
* `alert.anti_drift_filtered`: Dispatched when GPS jitter or spoofed indoor displacement is filtered.

#### Sample WebSocket Message (`telemetry.gps_update`)
```json
{
  "event": "telemetry.gps_update",
  "timestamp": 1755670800120,
  "payload": {
    "specialistId": "c1f7a8b9-0001-4444-9999-000000000001",
    "employeeId": "AITS10002772",
    "lat": 13.74681,
    "lng": 100.53502,
    "speed": 34.2,
    "heading": 182.5,
    "accuracyMeters": 4.8,
    "battery": 84,
    "status": "Running"
  }
}
```

---

## 5. Code Integration Examples

### 5.1 Node.js / TypeScript (WebSocket Listener)
```typescript
import WebSocket from 'ws';

const API_KEY = 'flt_live_mkt_99a8b7c6d5e4f3a2b1c0987654321';
const ws = new WebSocket(`wss://api.fastfleet.io/v1/telemetry/stream?token=${API_KEY}`);

ws.on('open', () => {
  console.log('✓ Connected to FastFleet Telemetry Stream');
});

ws.on('message', (data: string) => {
  const event = JSON.parse(data);
  if (event.event === 'telemetry.gps_update') {
    console.log(`[GPS] Staff ${event.payload.employeeId} at ${event.payload.lat}, ${event.payload.lng} (${event.payload.speed} km/h)`);
  }
});

ws.on('error', (err) => console.error('WS Error:', err));
```

### 5.2 Python (REST Telemetry Polling)
```python
import requests

API_KEY = "flt_live_mkt_99a8b7c6d5e4f3a2b1c0987654321"
headers = {"Authorization": f"Bearer {API_KEY}"}

response = requests.get("https://api.fastfleet.io/v1/telemetry/live", headers=headers)

if response.status_code == 200:
    telemetry_data = response.json()
    for spec in telemetry_data.get("data", []):
        print(f"Specialist: {spec['fullName']} | Speed: {spec['telemetry']['speedKmH']} km/h | Status: {spec['motionStatus']}")
else:
    print(f"Error {response.status_code}: {response.text}")
```

---

## 6. HTTP Status & Error Codes

| Status Code | Description | Resolution |
| :--- | :--- | :--- |
| **`200 OK`** | Request succeeded | Normal operation. |
| **`401 Unauthorized`** | Missing or invalid API Key | Verify `Authorization: Bearer <key>` header in System Settings. |
| **`403 Forbidden`** | Insufficient permissions | Contact your Organization Administrator. |
| **`429 Too Many Requests`** | Rate limit exceeded (> 120 req/min) | Implement backoff or switch to the WebSocket Stream. |
| **`500 Internal Error`** | Server-side processing issue | Contact FastFleet Enterprise Support. |

---
*FastFleet Field Marketing Platform © 2026. All rights reserved.*
