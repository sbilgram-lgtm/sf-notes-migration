import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { getAuthStatus } from './services/api';
import { AuthStatus } from './types/assessment';

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getAuthStatus()
      .then(setAuthStatus)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#7f8c8d' }}>Loading…</div>;
  }

  const authenticated = !!(authStatus?.authenticated);

  return (
    <Router>
      <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8' }}>
        <Header authenticated={authenticated} orgName={authStatus?.orgName} isSandbox={authStatus?.isSandbox} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={authenticated ? <DashboardPage /> : <Navigate to="/login" replace />} />
          <Route path="/" element={<Navigate to={authenticated ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
