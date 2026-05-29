import { useState } from "react";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AvisoIngreso from './pages/AvisoIngreso';
import ReservasIngreso from './pages/ReservasIngreso';
import FacturasIngreso from './pages/FacturasIngreso';
import AppHeader from './components/aviso/AppHeader';
import MainNav from './components/aviso/MainNav';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const [activeTab, setActiveTab] = useState('avisos');

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <MainNav active={activeTab} onChange={setActiveTab} />
      {activeTab === 'avisos' && <AvisoIngreso />}
      {activeTab === 'reservas' && <ReservasIngreso />}
      {activeTab === 'facturas' && <FacturasIngreso />}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
