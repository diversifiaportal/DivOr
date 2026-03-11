import { useMemo } from 'react';
import { Vehicle, FuelLog } from '../types';

export const useFleetFuelAnalytics = (vehicles: Vehicle[], fuelLogs: FuelLog[]) => {
  const logsByVehicle = useMemo(() => {
    const map = new Map<string, FuelLog[]>();
    fuelLogs.forEach(l => {
      const arr = map.get(l.vehicleId) || [];
      arr.push(l);
      map.set(l.vehicleId, arr);
    });
    return map;
  }, [fuelLogs]);

  const vehiclesById = useMemo(() => {
    return new Map(vehicles.map(v => [v.id, v]));
  }, [vehicles]);

  const detailedAnalytics = useMemo(() => {
    return vehicles.map(v => {
      const vLogs = logsByVehicle.get(v.id) || [];
      const totalSpent = vLogs.reduce((acc, l) => acc + l.amount, 0);
      
      const sortedLogs = vLogs.length > 0 ? [...vLogs].sort((a,b) => a.odometer - b.odometer) : [];
      let kmDiff = 0;
      if (sortedLogs.length > 1) {
        const startKm = sortedLogs[0].odometer;
        const endKm = sortedLogs[sortedLogs.length - 1].odometer;
        kmDiff = Math.max(0, endKm - startKm);
      } else if (sortedLogs.length === 1) {
        const startKm = sortedLogs[0].odometer;
        const endKm = (v.currentKm || 0) > startKm ? (v.currentKm || 0) : startKm;
        kmDiff = Math.max(0, endKm - startKm);
      } else {
        kmDiff = v.currentKm || 0;
      }

      const costKm = kmDiff > 0 ? totalSpent / kmDiff : 0;

      return {
        label: v.plate,
        sublabel: `${v.brand} ${v.model}`,
        totalSpent,
        kmDiff,
        costKm
      };
    });
  }, [vehicles, logsByVehicle]);

  const fuelByZone = useMemo(() => {
    const map: Record<string, number> = {};
    fuelLogs.forEach(l => {
      const zone = (l.destinationCity || 'Non spécifié').toUpperCase().trim();
      map[zone] = (map[zone] || 0) + l.amount;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [fuelLogs]);

  const dailyConsumption = useMemo(() => {
    const grouped: Record<string, any> = {};
    const vehicleSet = new Set<string>();

    fuelLogs.forEach(l => {
      if (!grouped[l.date]) grouped[l.date] = { date: l.date };
      const vehicle = vehiclesById.get(l.vehicleId);
      const plate = vehicle ? vehicle.plate : 'Inconnu';
      vehicleSet.add(plate);
      grouped[l.date][plate] = (grouped[l.date][plate] || 0) + l.amount;
    });

    const data = Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(-14);
    return { data, vehicles: Array.from(vehicleSet) };
  }, [fuelLogs, vehiclesById]);

  return { detailedAnalytics, fuelByZone, dailyConsumption };
};
