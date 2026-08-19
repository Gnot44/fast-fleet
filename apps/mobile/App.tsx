import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LanguageProvider } from './src/lib/LanguageContext';
import { ThemeProvider } from './src/lib/ThemeContext';

import LoginScreen from './src/screens/LoginScreen';
import PrivacyConsentScreen from './src/screens/PrivacyConsentScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import NewAppointmentScreen from './src/screens/NewAppointmentScreen';
import AddNewDropScreen from './src/screens/AddNewDropScreen';
import RoutePreviewScreen from './src/screens/RoutePreviewScreen';
import ActiveTrackerScreen from './src/screens/ActiveTrackerScreen';
import EditTripItineraryScreen from './src/screens/EditTripItineraryScreen';
import DropReportingScreen from './src/screens/DropReportingScreen';
import TripSummaryScreen from './src/screens/TripSummaryScreen';
import TripScheduleScreen from './src/screens/TripScheduleScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          {/* M1. Mobile Login */}
          <Stack.Screen name="Login" component={LoginScreen} />

          {/* M2. Privacy & GPS Consent */}
          <Stack.Screen name="PrivacyConsent" component={PrivacyConsentScreen} />

          {/* M3. Main Dashboard */}
          <Stack.Screen name="Dashboard" component={DashboardScreen} />

          {/* M4. Create Trip (Start Now / Plan Later) */}
          <Stack.Screen name="NewAppointment" component={NewAppointmentScreen} />

          {/* M5. Add New Drop (Map & Details) */}
          <Stack.Screen name="AddNewDrop" component={AddNewDropScreen} />

          {/* M6. Optimized Route Preview */}
          <Stack.Screen name="RoutePreview" component={RoutePreviewScreen} />

          {/* M7. Active Tracking */}
          <Stack.Screen name="ActiveTracker" component={ActiveTrackerScreen} />

          {/* M8. Edit Itinerary Mid-Trip */}
          <Stack.Screen name="EditTripItinerary" component={EditTripItineraryScreen} />

          {/* M9. Drop Reporting (Confirmation Toggle, Odometer, Expenses & Photos) */}
          <Stack.Screen name="DropReporting" component={DropReportingScreen} />

          {/* M10. Trip Summary (4-KPI Grid, Per-Drop Reports & Submit) */}
          <Stack.Screen name="TripSummary" component={TripSummaryScreen} />

          {/* Calendar / Schedule */}
          <Stack.Screen name="TripSchedule" component={TripScheduleScreen} />

          {/* User Profile */}
          <Stack.Screen name="UserProfile" component={UserProfileScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </LanguageProvider>
  </ThemeProvider>
  );
}
