import { useState } from 'react';
import Sidebar from './components/Sidebar';
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

export default function App() {
  const [page, setPage] = useState('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard':   return <Dashboard />;
      case 'performance': return <Performance />;
      case 'inventory':   return <Inventory />;
      case 'alerts':      return <AlertsPage />;
      case 'records':     return <Records />;
      case 'settings':    return <SettingsPage />;
      case 'predictor':   return <AiPredictor />;
      case 'chatbot':     return <Chatbot />;
      case 'readings':    return <SensorReadings />;
      case 'damage':      return <DamagePrevention />;
      default:            return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-[#10141a] text-[#dfe2eb] overflow-hidden dark">
      <Sidebar current={page} onChange={setPage}/>
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        {renderPage()}
      </main>
    </div>
  );
}
