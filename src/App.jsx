import { MachineProvider, ErrorBoundary } from './context/MachineContext';
import { useState } from 'react';
import { useMachine } from './context/MachineContext';
import Sidebar from './components/Sidebar';
import InitModal from './components/InitModal';
import Dashboard from './pages/Dashboard';
import Performance from './pages/Performance';
import Inventory from './pages/Inventory';
import AlertsPage from './pages/Alerts';
import Records from './pages/Records';
import SettingsPage from './pages/Settings';
import AiPredictor from './pages/AiPredictor';
import Chatbot from './pages/Chatbot';
import SensorReadings from './pages/SensorReadings';
import DamagePrevention from './pages/DamagePrevention';

function AppShell() {
  const { initialized } = useMachine();
  const [page, setPage] = useState('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard':   return <Dashboard />;
      case 'performance': return <Performance />;
      case 'inventory':   return <Inventory />;
      case 'damage':      return <DamagePrevention />;
      case 'alerts':      return <AlertsPage />;
      case 'records':     return <Records />;
      case 'settings':    return <SettingsPage />;
      case 'predictor':   return <AiPredictor />;
      case 'chatbot':     return <Chatbot />;
      case 'readings':    return <SensorReadings />;
      default:            return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-[#10141a] text-[#dfe2eb] overflow-hidden">
      {!initialized && <InitModal />}
      <Sidebar current={page} onChange={setPage} />
      <main className="flex-1 overflow-y-auto">
        <ErrorBoundary>
          {renderPage()}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MachineProvider>
        <AppShell />
      </MachineProvider>
    </ErrorBoundary>
  );
}
