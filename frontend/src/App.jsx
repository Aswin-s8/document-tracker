import React, { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { api } from './utils/api';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(api.isAuthenticated());

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  return (
    <>
      {isAuthenticated ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}
