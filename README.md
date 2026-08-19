# 🚀 FastFleet - Field Marketing & Dynamic Route Fleet Management System

A production-ready Enterprise Field Marketing & Fleet Telemetry System built with React (Web Management Console), React Native / Expo (Mobile Field Specialist App), and Supabase (PostgreSQL, Realtime Presence, Storage & Auth).

---

## 🏗️ Architecture & Project Structure

```
fleet-manage/
├── apps/
│   ├── web/                     # Web Management Console (React 19, Vite, Tailwind CSS, Leaflet)
│   │   ├── src/
│   │   │   ├── pages/           # Dashboard, LiveMap, Calendar, Approvals, Analytics, Drivers
│   │   │   ├── components/      # Navigation, Telemetry Cards, Modals
│   │   │   ├── context/         # ThemeContext, LanguageContext (TH/EN)
│   │   │   └── lib/             # Supabase Client & Utilities
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── mobile/                  # Field Specialist Mobile App (React Native, Expo, Lucide)
│       ├── src/
│       │   ├── screens/         # Dashboard, Active Tracker, Drop Reporting, Schedule, History
│       │   ├── components/      # Floating Bottom Nav, Sliders, Dropdowns
│       │   ├── lib/             # Location & Presence Service, Supabase Client, Themes
│       │   └── types/
│       ├── .env.example
│       └── package.json
│
├── supabase/                    # Database Migrations & SQL Schemas
├── .gitignore                   # Monorepo Security & Ignore Rules
└── README.md
```

---

## 🔒 Security Best Practices & Environment Configuration

1. **Environment Files (`.env`) are strictly ignored** by `.gitignore` and must never be committed to source control.
2. Only `.env.example` templates are tracked in Git.
3. Database credentials and Supabase service role keys are kept securely in private cloud vault environments.
4. User passwords are encrypted with bcrypt via Supabase Authentication.

### Quick Start Setup

#### 1. Configure Web Console
```bash
cd apps/web
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

#### 2. Configure Mobile App
```bash
cd apps/mobile
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start
```

---

## 🌟 Key Features

- 📍 **Live Telemetry & GPS Tracking**: Real-time position, speed, and online/offline status.
- 🏢 **Client Drop Management**: Multi-stop journey planning, check-in timestamps, notes, and photo proofs.
- 💵 **Field Expense Tracking**: Receipt slip upload and automatic categorization (Fuel, Tolls, Hospitality, Parking).
- 📋 **Manager Approval Hub**: Multi-level review, approval, and revision request workflows.
- 🌐 **Full Dual-Language Support**: Complete Thai (TH) and English (EN) localization across Web & Mobile.
