import { MachineProvider, ErrorBoundary } from './context/MachineContext';
import { useMachine } from './context/MachineContext';
import { useState } from 'react';
import Sidebar from './components/Sidebar';
import InitModal from './components/InitModal';
import Dashboard from './pages/Dashboard';
import DamagePrevention from './pages/DamagePrevention';
import Inventory from './pages/Inventory';
import AlertsPage from './pages/Alerts';
import Records from './pages/Records';
import AiPredictor from './pages/AiPredictor';
import SensorReadings from './pages/SensorReadings';
import OriginalSensor from './pages/OriginalSensor';
import Settings from './pages/Settings';

function AppShell() {
  const { initialized } = useMachine();
  const [page, setPage] = useState('damage');

  const renderPage = () => {
    switch (page) {
      case 'damage':    return <DamagePrevention />;
      case 'dashboard': return <Dashboard />;
      case 'inventory': return <Inventory />;
      case 'alerts':    return <AlertsPage />;
      case 'records':   return <Records />;
      case 'predictor': return <AiPredictor />;
      case 'readings':  return <SensorReadings />;
      case 'original':  return <OriginalSensor />;
      case 'settings':  return <Settings />;
      default:          return <DamagePrevention />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
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
