import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { EmailVerificationScreen } from './screens/EmailVerificationScreen';
import { MyProfileScreen } from './screens/MyProfileScreen';
import { PublicProfileScreen } from './screens/PublicProfileScreen';
import { TripDetailsScreen } from './screens/TripDetailsScreen';
import { ExploreTripsScreen } from './screens/ExploreTripsScreen';
import { MyTripsScreen } from './screens/MyTripsScreen';
import { CreateTripScreen } from './screens/CreateTripScreen';
import { TripEditorScreen } from './screens/TripEditorScreen';
import { AccessDeniedScreen } from './screens/AccessDeniedScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomeScreen />} />
            <Route path="/explore" element={<ExploreTripsScreen />} />
            <Route path="/trips/:tripId" element={<TripDetailsScreen />} />
            <Route path="/access-denied" element={<AccessDeniedScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/register" element={<RegisterScreen />} />
            <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
            <Route path="/verify-email" element={<EmailVerificationScreen />} />
            <Route path="/traveller/:username" element={<PublicProfileScreen />} />

            {/* Protected Routes */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <MyProfileScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-trips"
              element={
                <ProtectedRoute>
                  <MyTripsScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips/create"
              element={
                <ProtectedRoute>
                  <CreateTripScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trips/:tripId/edit"
              element={
                <ProtectedRoute>
                  <TripEditorScreen />
                </ProtectedRoute>
              }
            />

            {/* 404 Catch-All */}
            <Route path="/404" element={<NotFoundScreen />} />
            <Route path="*" element={<NotFoundScreen />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
