import { useMemo } from 'react';
import { Vehicle, FuelLog } from '../types';

export const useFleetDashboardStats = (vehicles: Vehicle[], fuelLogs: FuelLog[]) => {
  return useMemo(() => {
    const totalMileage = vehicles.reduce((acc, v) => acc + (v.currentKm || 0), 0);
    const totalFuelSpent = fuelLogs.reduce((acc, l) => acc + (l.amount || 0), 0);
    const costPerKm = totalMileage > 0 ? totalFuelSpent / totalMileage : 0; 

    const activeVehicles = vehicles.filter(v => v.status === 'active').length;
    const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;
    const fleetStatusData = [
      { name: 'Actifs', value: activeVehicles },
      { name: 'Maintenance', value: maintenanceVehicles },
      { name: 'Accidentés', value: vehicles.filter(v => v.status === 'accident').length },
      { name: 'Arrêt', value: vehicles.filter(v => v.status === 'stopped').length },
    ];

    const fuelTrendMap: Record<string, number> = {};
    fuelLogs.forEach(l => {
      const month = l.date.substring(0, 7); // YYYY-MM
      fuelTrendMap[month] = (fuelTrendMap[month] || 0) + l.amount;
    });
    const fuelTrend = Object.entries(fuelTrendMap)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({ month, amount }));

    return { totalMileage, totalFuelSpent, costPerKm, fleetStatusData, fuelTrend };
  }, [vehicles, fuelLogs]);
};
