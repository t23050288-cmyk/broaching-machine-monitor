import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Machines from './pages/Machines';
import MachineDetail from './pages/MachineDetail';
import Analytics from './pages/Analytics';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import { useMachineData } from './hooks/useMachineData';

export default function App() {
  const {
    machineStates,
    timeSeriesData,
    alertLog,
    isConnected,
    acknowledgeAlert,
    machines,
  } = useMachineData(2000);

  const activeAlerts = alertLog.filter(a => !a.resolved).length;

  const shared = { machines, machineStates, timeSeriesData, alertLog, isConnected };

  return (
    <div className="flex min-h-screen" style={{ background: '#0a0e1a' }}>
      <Sidebar isConnected={isConnected} alertCount={activeAlerts} />

      {/* Main content offset for sidebar */}
      <div className="flex-1 ml-64 flex flex-col">
        {!isConnected && (
          <div className="flex items-center justify-center gap-3 py-2 text-xs font-mono"
            style={{ background: '#ff444418', color: '#ff4444', borderBottom: '1px solid #ff444433' }}>
            <span className="status-dot animate-pulse-red" style={{ background: '#ff4444' }}></span>
            CONNECTING TO MACHINE NETWORK...
          </div>
        )}

        <Routes>
          <Route path="/"           element={<Dashboard  {...shared} />} />
          <Route path="/machines"   element={<Machines   {...shared} />} />
          <Route path="/machines/:id" element={<MachineDetail {...shared} />} />
          <Route path="/analytics"  element={<Analytics  {...shared} />} />
          <Route path="/alerts"     element={<Alerts alertLog={alertLog} acknowledgeAlert={acknowledgeAlert} />} />
          <Route path="/settings"   element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}
