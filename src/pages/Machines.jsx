import React from 'react';
import Header from '../components/Header';
import MachineCard from '../components/MachineCard';

export default function Machines({ machines, machineStates, alertLog }) {
  const activeAlerts = alertLog.filter(a => !a.resolved).length;
  return (
    <div className="flex-1 overflow-auto">
      <Header title="All Machines" subtitle="Click a machine to see detailed diagnostics" alertCount={activeAlerts} />
      <div className="p-8 grid-bg min-h-screen">
        <div className="grid grid-cols-2 gap-5">
          {machines.map(m => (
            <MachineCard key={m.id} machine={m} state={machineStates[m.id]} />
          ))}
        </div>
      </div>
    </div>
  );
}
