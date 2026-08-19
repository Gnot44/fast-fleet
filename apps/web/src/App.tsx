import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './layouts/AdminLayout';

import VisitHistory from './pages/VisitHistory';
import DriverManagement from './pages/DriverManagement';
import Dashboard from './pages/Dashboard';
import SystemSettings from './pages/SystemSettings';
import ReportsAnalytics from './pages/ReportsAnalytics';
import SpecialistScheduleCalendar from './pages/SpecialistScheduleCalendar';
import AdminProfile from './pages/AdminProfile';

function App() {
  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-inter">
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="schedule" element={<SpecialistScheduleCalendar />} />
          <Route path="history" element={<VisitHistory />} />
          <Route path="drivers" element={<DriverManagement />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="reports" element={<ReportsAnalytics />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
