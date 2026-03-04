
import React, { useState, useEffect, useMemo } from 'react';
import { User, Vehicle, Driver, FuelLog, AccidentLog, Attachment } from '../types';
import { getCloudData, saveCloudData } from '../services/database';
import { 
  Truck, Fuel, AlertTriangle, BarChart3, Plus, Search, 
  Edit2, Trash2, Save, X, Paperclip, Loader2,
  LayoutGrid, UserCheck, Milestone, Activity, Zap, Wallet, 
  PieChart as PieIcon, TrendingUp as TrendingIcon, MapPin
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, 
  AreaChart, Area, CartesianGrid, XAxis, YAxis, BarChart, Bar 
} from 'recharts';

interface FleetManagementProps {
  user: User;
}

type FleetTab = 'overview' | 'vehicles' | 'drivers' | 'fuel' | 'accidents' | 'reports';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff7900', '#3b82f6', '#ef4444'];

const Modal = ({ title, children, onClose, onSave, isSaving }: any) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
    <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
      <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
        <h3 className="text-xl font-black uppercase italic tracking-tighter">{title}</h3>
        <button onClick={onClose}><X className="w-6 h-6 text-slate-300 hover:text-slate-500" /></button>
      </div>
      <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
        {children}
      </div>
      <div className="p-6 bg-slate-50 border-t flex space-x-4">
        <button onClick={onClose} className="flex-1 py-4 rounded-2xl bg-white border border-slate-200 text-slate-400 font-black uppercase text-xs hover:bg-slate-100">Annuler</button>
        <button onClick={onSave} disabled={isSaving} className="flex-1 py-4 rounded-2xl bg-slate-900 text-white font-black uppercase text-xs hover:bg-[#ff7900] shadow-xl flex items-center justify-center">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer
        </button>
      </div>
    </div>
  </div>
);

const AttachmentSection = ({ items, onUpload, onDelete }: { items: Attachment[], onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void, onDelete: (index: number) => void }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black uppercase text-slate-400">Documents (Carte Grise, Permis...)</label>
    <div className="flex flex-wrap gap-2">
      {items.map((att, idx) => (
        <div key={idx} className="bg-slate-100 pl-3 pr-2 py-1 rounded-lg text-xs font-bold flex items-center group">
          <Paperclip className="w-3 h-3 mr-1 text-slate-400" />
          <span className="mr-2 max-w-[150px] truncate">{att.name}</span>
          <button 
            onClick={() => onDelete(idx)} 
            className="p-1 hover:bg-white rounded-full text-slate-400 hover:text-rose-500 transition-colors"
            title="Supprimer le document"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <label className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-black uppercase flex items-center border border-indigo-100 hover:bg-indigo-100 cursor-pointer transition-colors">
        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={onUpload} />
        <Plus className="w-3 h-3 mr-1" /> Ajouter
      </label>
    </div>
  </div>
);

const FleetManagement: React.FC<FleetManagementProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<FleetTab>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [accidents, setAccidents] = useState<AccidentLog[]>([]);

  const [showModal, setShowModal] = useState<'vehicles' | 'drivers' | 'fuel' | 'accidents' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Forms
  const [vehicleForm, setVehicleForm] = useState<Partial<Vehicle>>({});
  const [driverForm, setDriverForm] = useState<Partial<Driver>>({});
  const [fuelForm, setFuelForm] = useState<Partial<FuelLog>>({});
  const [accidentForm, setAccidentForm] = useState<Partial<AccidentLog>>({});

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [v, d, f, a] = await Promise.all([
        getCloudData('fleet_vehicles'),
        getCloudData('fleet_drivers'),
        getCloudData('fleet_fuel'),
        getCloudData('fleet_accidents')
      ]);
      setVehicles(v || []);
      setDrivers(d || []);
      setFuelLogs(f || []);
      setAccidents(a || []);
      setIsLoading(false);
    };
    load();
  }, []);

  const dashboardMetrics = useMemo(() => {
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

  const detailedAnalytics = useMemo(() => {
    return vehicles.map(v => {
      const vLogs = fuelLogs.filter(l => l.vehicleId === v.id);
      const totalSpent = vLogs.reduce((acc, l) => acc + l.amount, 0);
      
      const sortedLogs = vLogs.sort((a,b) => a.odometer - b.odometer);
      const startKm = sortedLogs.length > 0 ? sortedLogs[0].odometer : 0;
      const endKm = sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1].odometer : (v.currentKm || 0);
      const kmDiff = Math.max(0, endKm - startKm);

      const costKm = kmDiff > 0 ? totalSpent / kmDiff : 0;

      return {
        label: v.plate,
        sublabel: `${v.brand} ${v.model}`,
        totalSpent,
        kmDiff: kmDiff || v.currentKm,
        costKm
      };
    });
  }, [vehicles, fuelLogs]);

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
      const vehicle = vehicles.find(v => v.id === l.vehicleId);
      const plate = vehicle ? vehicle.plate : 'Inconnu';
      vehicleSet.add(plate);
      grouped[l.date][plate] = (grouped[l.date][plate] || 0) + l.amount;
    });

    const data = Object.values(grouped).sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(-14);
    return { data, vehicles: Array.from(vehicleSet) };
  }, [fuelLogs, vehicles]);

  const handleEdit = (type: string, item: any) => {
    setEditingId(item.id);
    if (type === 'vehicles') { setVehicleForm(item); setShowModal('vehicles'); }
    if (type === 'drivers') { setDriverForm(item); setShowModal('drivers'); }
    if (type === 'fuel_entry') { setFuelForm(item); setShowModal('fuel'); }
    if (type === 'accidents') { setAccidentForm(item); setShowModal('accidents'); }
  };

  const handleSaveVehicle = async () => {
    if (!vehicleForm.plate) return alert("Immatriculation requise");
    setIsSaving(true);
    try {
      const newItem = { ...vehicleForm, id: editingId || Math.random().toString(36).substr(2, 9), status: vehicleForm.status || 'active' } as Vehicle;
      const updated = editingId ? vehicles.map(v => v.id === editingId ? newItem : v) : [...vehicles, newItem];
      setVehicles(updated);
      await saveCloudData('fleet_vehicles', updated);
      setShowModal(null); setEditingId(null);
    } catch (e) {
      console.error("Erreur sauvegarde véhicule", e);
      alert("Erreur lors de l'enregistrement. Le fichier est peut-être trop volumineux.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDriver = async () => {
    if (!driverForm.name) return alert("Nom requis");
    setIsSaving(true);
    try {
      const newItem = { ...driverForm, id: editingId || Math.random().toString(36).substr(2, 9) } as Driver;
      const updated = editingId ? drivers.map(d => d.id === editingId ? newItem : d) : [...drivers, newItem];
      setDrivers(updated);
      await saveCloudData('fleet_drivers', updated);
      setShowModal(null); setEditingId(null);
    } catch (e) {
      console.error("Erreur sauvegarde conducteur", e);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const openAttachment = (attachment: Attachment) => {
    const win = window.open();
    if (win) {
        win.document.write(`<iframe src="${attachment.data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  };

  // Compression automatique des images pour éviter de saturer la base de données
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7); // Qualité 70%
          resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'vehicle' | 'driver') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Sécurité taille fichier pour PDF
    if (file.type === 'application/pdf' && file.size > 2 * 1024 * 1024) {
        alert("Le fichier PDF est trop volumineux (Max 2MB). La synchronisation échouera.");
        return;
    }

    try {
        let base64String = "";
        
        if (file.type.startsWith('image/')) {
            base64String = await compressImage(file);
        } else {
            base64String = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target?.result as string);
                reader.readAsDataURL(file);
            });
        }

        const newAtt: Attachment = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            mimeType: file.type,
            data: base64String,
            date: new Date().toISOString()
        };
        
        if (target === 'vehicle') {
            setVehicleForm(prev => ({ ...prev, attachments: [...(prev.attachments || []), newAtt] }));
        } else {
            setDriverForm(prev => ({ ...prev, attachments: [...(prev.attachments || []), newAtt] }));
        }
    } catch (error) {
        console.error("Erreur traitement fichier:", error);
        alert("Impossible de traiter ce fichier.");
    }
  };

  const handleDeleteAttachment = (index: number, target: 'vehicle' | 'driver') => {
    if (target === 'vehicle') {
      setVehicleForm(prev => ({
        ...prev,
        attachments: prev.attachments?.filter((_, i) => i !== index)
      }));
    } else {
      setDriverForm(prev => ({
        ...prev,
        attachments: prev.attachments?.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSaveFuel = async () => {
    if (!fuelForm.vehicleId || !fuelForm.driverId) return alert("Champs obligatoires manquants.");
    setIsSaving(true);
    const newLog = { ...fuelForm, id: editingId || Math.random().toString(36).substr(2, 9) } as FuelLog;
    let updatedLogs = editingId ? fuelLogs.map(l => l.id === editingId ? newLog : l) : [newLog, ...fuelLogs];
    updatedLogs = updatedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setFuelLogs(updatedLogs);
    const updatedVehicles = vehicles.map(v => v.id === newLog.vehicleId ? { ...v, currentKm: Math.max(v.currentKm || 0, newLog.odometer || 0) } : v); 
    setVehicles(updatedVehicles);
    await Promise.all([saveCloudData('fleet_fuel', updatedLogs), saveCloudData('fleet_vehicles', updatedVehicles)]);
    setIsSaving(false); setShowModal(null); setEditingId(null);
  };

  const handleDeleteFuel = async (id: string) => {
    if (!confirm("Supprimer cet enregistrement de carburant ?")) return;
    const updated = fuelLogs.filter(l => l.id !== id);
    setFuelLogs(updated);
    await saveCloudData('fleet_fuel', updated);
  };

  const handleSaveAccident = async () => {
    if (!accidentForm.vehicleId || !accidentForm.driverId) return alert("Véhicule et Conducteur requis.");
    setIsSaving(true);
    const newAcc = { ...accidentForm, id: editingId || Math.random().toString(36).substr(2, 9) } as AccidentLog;
    const updated = editingId ? accidents.map(a => a.id === editingId ? newAcc : a) : [newAcc, ...accidents];
    setAccidents(updated); await saveCloudData('fleet_accidents', updated);
    setIsSaving(false); setShowModal(null); setEditingId(null);
  };

  const handleDeleteAccident = async (id: string) => {
    if (!confirm("Supprimer ce rapport de sinistre ?")) return;
    const updated = accidents.filter(a => a.id !== id);
    setAccidents(updated);
    await saveCloudData('fleet_accidents', updated);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Tab Navigation */}
      <div className="flex bg-white p-1.5 rounded-[2rem] shadow-sm border border-slate-200 mb-8 w-fit overflow-x-auto max-w-full">
        {[{ id: 'overview', label: 'Dashboard', icon: LayoutGrid }, { id: 'vehicles', label: 'Véhicules', icon: Truck }, { id: 'drivers', label: 'Équipe', icon: UserCheck }, { id: 'fuel', label: 'Carburant', icon: Fuel }, { id: 'accidents', label: 'Sinistres', icon: AlertTriangle }, { id: 'reports', label: 'Analytique', icon: BarChart3 }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as FleetTab)} className={`flex items-center px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#ff7900] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><tab.icon className="w-4 h-4 mr-2" /> {tab.label}</button>
        ))}
      </div>

      {isLoading ? <div className="py-32 flex flex-col items-center justify-center"><Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" /></div> : (
        <div className="animate-in fade-in duration-500">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[ { label: 'KM Total', value: `${dashboardMetrics.totalMileage.toLocaleString()} KM`, icon: Milestone, color: 'text-blue-500', bg: 'bg-blue-50' }, { label: 'Véhicules', value: `${vehicles.length}`, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' }, { label: 'Coût au KM', value: `${dashboardMetrics.costPerKm.toFixed(2)} DH`, icon: Zap, color: 'text-orange-500', bg: 'bg-orange-50' }, { label: 'Budget Fuel', value: `${dashboardMetrics.totalFuelSpent.toLocaleString()} DH`, icon: Wallet, color: 'text-rose-500', bg: 'bg-rose-50' } ].map((kpi, i) => (
                  <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center space-x-4 shadow-sm"><div className={`${kpi.bg} p-4 rounded-2xl`}><kpi.icon className={`w-6 h-6 ${kpi.color}`} /></div><div><p className="text-[9px] font-black uppercase text-slate-400">{kpi.label}</p><p className="text-xl font-black text-slate-900">{kpi.value}</p></div></div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm"><h3 className="text-sm font-black uppercase italic tracking-tighter mb-6 flex items-center"><PieIcon className="w-4 h-4 mr-2 text-orange-500" /> État Parc</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dashboardMetrics.fleetStatusData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{dashboardMetrics.fleetStatusData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" height={36}/></PieChart></ResponsiveContainer></div></div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm lg:col-span-2"><h3 className="text-sm font-black uppercase italic tracking-tighter mb-6 flex items-center"><TrendingIcon className="w-4 h-4 mr-2 text-orange-500" /> Dépenses MAD</h3><div className="h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dashboardMetrics.fuelTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="month" tick={{fontSize: 9}} /><YAxis tick={{fontSize: 9}} /><Tooltip /><Area type="monotone" dataKey="amount" stroke="#ff7900" fill="#ff7900" fillOpacity={0.1} /></AreaChart></ResponsiveContainer></div></div>
              </div>
            </div>
          )}

          {activeTab === 'vehicles' && (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
              <div className="p-8 border-b flex justify-between items-center">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Parc Automobile</h3>
                <button onClick={() => { setEditingId(null); setVehicleForm({ driverIds: [], attachments: [], insuranceExpiry: '', techVisitExpiry: '', fuelBudget: 0 }); setShowModal('vehicles'); }} className="px-6 py-3 bg-[#ff7900] text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Nouveau Véhicule</button>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-8 py-5">Véhicule</th><th className="px-8 py-5">Docs</th><th className="px-8 py-5 text-right">KM</th><th className="px-8 py-5 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{vehicles.map(v => <tr key={v.id} className="hover:bg-slate-50 transition-all"><td className="px-8 py-6"><p className="font-black text-slate-900">{v.plate}</p><p className="text-[10px] text-slate-400 uppercase">{v.brand} {v.model}</p></td><td className="px-8 py-6"><div className="flex -space-x-2">{v.attachments?.slice(0, 3).map((a, i) => <button key={i} onClick={() => openAttachment(a)} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black">{a.mimeType.includes('pdf') ? 'PDF' : 'IMG'}</button>)}</div></td><td className="px-8 py-6 text-right font-black">{v.currentKm?.toLocaleString()} KM</td><td className="px-8 py-6 text-right"><button onClick={() => handleEdit('vehicles', v)} className="p-2.5 text-slate-300 hover:text-orange-500"><Edit2 className="w-4 h-4" /></button></td></tr>)}</tbody></table></div>
            </div>
          )}

          {activeTab === 'drivers' && (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
              <div className="p-8 border-b flex justify-between items-center"><h3 className="text-xl font-black uppercase italic tracking-tighter">Conducteurs</h3><button onClick={() => { setEditingId(null); setDriverForm({ status: 'active', attachments: [] }); setShowModal('drivers'); }} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Nouveau</button></div>
              <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-8 py-5">Nom</th><th className="px-8 py-5 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{drivers.map(d => <tr key={d.id} className="hover:bg-slate-50 transition-all"><td className="px-8 py-6 font-black text-slate-900">{d.name}</td><td className="px-8 py-6 text-right"><button onClick={() => handleEdit('drivers', d)} className="p-2.5 text-slate-300 hover:text-blue-500"><Edit2 className="w-4 h-4" /></button></td></tr>)}</tbody></table></div>
            </div>
          )}

          {activeTab === 'fuel' && (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
              <div className="p-8 border-b flex justify-between items-center"><h3 className="text-xl font-black uppercase italic tracking-tighter">Historique Carburant</h3><button onClick={() => { setEditingId(null); setFuelForm({ date: new Date().toISOString().split('T')[0], destinationCity: '' }); setShowModal('fuel'); }} className="px-6 py-3 bg-[#ff7900] text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center shadow-lg"><Plus className="w-4 h-4 mr-2" /> Ajout Carburant</button></div>
              <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-8 py-5">Date</th><th className="px-8 py-5">Véhicule</th><th className="px-8 py-5">Destination</th><th className="px-8 py-5 text-right">KM</th><th className="px-8 py-5 text-right">Montant</th><th className="px-8 py-5 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{fuelLogs.map(log => <tr key={log.id} className="hover:bg-slate-50 transition-all group"><td className="px-8 py-5 text-xs font-bold text-slate-400">{log.date}</td><td className="px-8 py-5 font-black">{vehicles.find(v => v.id === log.vehicleId)?.plate}</td><td className="px-8 py-5 font-bold text-slate-500 uppercase text-[10px]">{log.destinationCity || '-'}</td><td className="px-8 py-5 text-right font-mono text-[10px]">{log.odometer?.toLocaleString()}</td><td className="px-8 py-5 text-right font-black text-orange-500">{log.amount} DH</td><td className="px-8 py-5 text-right">
                <div className="flex justify-end space-x-1">
                  <button onClick={() => handleEdit('fuel_entry', log)} className="p-2 text-slate-300 hover:text-orange-500"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteFuel(log.id)} className="p-2 text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </td></tr>)}</tbody></table></div>
            </div>
          )}

          {activeTab === 'accidents' && (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
              <div className="p-8 border-b flex justify-between items-center">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Registre des Sinistres</h3>
                <button onClick={() => { setEditingId(null); setAccidentForm({ date: new Date().toISOString().split('T')[0], status: 'pending', cost: 0 }); setShowModal('accidents'); }} className="px-6 py-3 bg-rose-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center shadow-lg">
                  <AlertTriangle className="w-4 h-4 mr-2" /> Nouveau Sinistre
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                    <tr>
                      <th className="px-8 py-5">Date</th>
                      <th className="px-8 py-5">Véhicule / Chauffeur</th>
                      <th className="px-8 py-5">Description</th>
                      <th className="px-8 py-5 text-right">Coût estimé</th>
                      <th className="px-8 py-5 text-center">Statut</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {accidents.map(acc => (
                      <tr key={acc.id} className="hover:bg-slate-50 transition-all group">
                        <td className="px-8 py-5 text-xs font-bold text-slate-400">{acc.date}</td>
                        <td className="px-8 py-5">
                          <p className="font-black text-slate-900">{vehicles.find(v => v.id === acc.vehicleId)?.plate || '?'}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">{drivers.find(d => d.id === acc.driverId)?.name || '?'}</p>
                        </td>
                        <td className="px-8 py-5">
                          <p className="text-xs text-slate-600 line-clamp-1 italic">{acc.description}</p>
                        </td>
                        <td className="px-8 py-5 text-right font-black text-rose-500">{acc.cost?.toLocaleString()} DH</td>
                        <td className="px-8 py-5 text-center">
                          <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${
                            acc.status === 'operational' ? 'bg-emerald-50 text-emerald-600' :
                            acc.status === 'in_repair' ? 'bg-blue-50 text-blue-600' :
                            acc.status === 'immobilized' ? 'bg-rose-50 text-rose-600' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {acc.status}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end space-x-2">
                            <button onClick={() => handleEdit('accidents', acc)} className="p-2 text-slate-300 hover:text-[#ff7900]"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteAccident(acc.id)} className="p-2 text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {accidents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-20 text-center text-slate-300 font-black uppercase text-xs italic tracking-widest">Aucun sinistre enregistré</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
             <div className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {[ 
                   { label: 'KM Parcourus', value: detailedAnalytics.reduce((a,c) => a + Number(c.kmDiff || 0), 0).toLocaleString(), icon: Milestone, color: 'text-blue-500' }, 
                   { label: 'Coût DH', value: detailedAnalytics.reduce((a,c) => a + Number(c.totalSpent || 0), 0).toLocaleString(), icon: Wallet, color: 'text-[#ff7900]' }, 
                   { 
                     label: 'Moyenne / KM', 
                     value: (detailedAnalytics.reduce((a,c) => a + Number(c.kmDiff || 0), 0) > 0 
                       ? (detailedAnalytics.reduce((a,c) => a + Number(c.totalSpent || 0), 0) / detailedAnalytics.reduce((a,c) => a + Number(c.kmDiff || 0), 0)).toFixed(2) 
                       : "0.00"), 
                     icon: Zap, 
                     color: 'text-emerald-500' 
                   } 
                 ].map((kpi, i) => (
                   <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100"><p className="text-[10px] font-black uppercase text-slate-400 mb-2">{kpi.label}</p><h4 className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</h4></div>
                 ))}
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                     <h3 className="text-sm font-black uppercase italic tracking-tighter mb-6 flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-indigo-500" /> Coûts par Zone de Prospection
                     </h3>
                     <div className="h-64 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                           <Pie
                             data={fuelByZone}
                             cx="50%"
                             cy="50%"
                             innerRadius={60}
                             outerRadius={80}
                             paddingAngle={5}
                             dataKey="value"
                           >
                             {fuelByZone.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                           </Pie>
                           <Tooltip formatter={(val: number) => `${val.toLocaleString()} DH`} contentStyle={{borderRadius: '12px'}} />
                           <Legend verticalAlign="bottom" height={36} iconType="circle" />
                         </PieChart>
                       </ResponsiveContainer>
                     </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                     <h3 className="text-sm font-black uppercase italic tracking-tighter mb-6 flex items-center">
                        <TrendingIcon className="w-4 h-4 mr-2 text-emerald-500" /> Conso Journalière / Véhicule
                     </h3>
                     <div className="h-64 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={dailyConsumption.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                           <XAxis dataKey="date" tick={{fontSize: 9}} />
                           <YAxis tick={{fontSize: 10}} />
                           <Tooltip contentStyle={{borderRadius: '12px'}} />
                           <Legend verticalAlign="top" iconType="circle" wrapperStyle={{fontSize: '10px'}} />
                           {dailyConsumption.vehicles.map((plate, index) => (
                             <Bar 
                               key={plate} 
                               dataKey={plate} 
                               stackId="a" 
                               fill={COLORS[index % COLORS.length]} 
                               radius={index === dailyConsumption.vehicles.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                             />
                           ))}
                         </BarChart>
                       </ResponsiveContainer>
                     </div>
                  </div>
               </div>

               <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden"><div className="p-8 border-b"><h3 className="text-sm font-black uppercase italic tracking-tighter">Rentabilité au KM</h3></div><table className="w-full text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-8 py-5">Entité</th><th className="px-8 py-5 text-right">Distance</th><th className="px-8 py-5 text-right text-orange-600 bg-orange-50/30">Coût / KM</th></tr></thead><tbody className="divide-y divide-slate-100">{detailedAnalytics.map((res, idx) => <tr key={idx} className="hover:bg-slate-50"><td className="px-8 py-5"><p className="font-black">{res.label}</p><p className="text-[9px] text-slate-400">{res.sublabel}</p></td><td className="px-8 py-5 text-right font-bold text-blue-600">{res.kmDiff.toLocaleString()} KM</td><td className="px-8 py-5 text-right font-black text-orange-600 bg-orange-50/20">{(res.costKm || 0).toFixed(2)} DH</td></tr>)}</tbody></table></div>
             </div>
          )}
        </div>
      )}

      {showModal === 'vehicles' && (
        <Modal title={editingId ? "Modifier Véhicule" : "Nouveau Véhicule"} onClose={() => setShowModal(null)} onSave={handleSaveVehicle} isSaving={isSaving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="text-[10px] font-black uppercase text-slate-400">Immatriculation</label><input type="text" value={vehicleForm.plate || ''} onChange={e => setVehicleForm({...vehicleForm, plate: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" placeholder="12345-A-1" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Marque</label><input type="text" value={vehicleForm.brand || ''} onChange={e => setVehicleForm({...vehicleForm, brand: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" placeholder="Dacia" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Modèle</label><input type="text" value={vehicleForm.model || ''} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" placeholder="Dokker" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Statut</label><select value={vehicleForm.status || 'active'} onChange={e => setVehicleForm({...vehicleForm, status: e.target.value as any})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm appearance-none"><option value="active">Actif</option><option value="maintenance">Maintenance</option><option value="accident">Accidenté</option><option value="stopped">Arrêt</option></select></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">KM Actuel</label><input type="number" value={vehicleForm.currentKm || ''} onChange={e => setVehicleForm({...vehicleForm, currentKm: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Budget Carburant</label><input type="number" value={vehicleForm.fuelBudget || ''} onChange={e => setVehicleForm({...vehicleForm, fuelBudget: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" /></div>
          </div>
          <div className="mt-4">
             <AttachmentSection 
                items={vehicleForm.attachments || []} 
                onUpload={(e) => handleAttachmentUpload(e, 'vehicle')} 
                onDelete={(index) => handleDeleteAttachment(index, 'vehicle')}
             />
          </div>
        </Modal>
      )}

      {showModal === 'drivers' && (
        <Modal title={editingId ? "Modifier Conducteur" : "Nouveau Conducteur"} onClose={() => setShowModal(null)} onSave={handleSaveDriver} isSaving={isSaving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="text-[10px] font-black uppercase text-slate-400">Nom Complet</label><input type="text" value={driverForm.name || ''} onChange={e => setDriverForm({...driverForm, name: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">N° Permis</label><input type="text" value={driverForm.licenseNumber || ''} onChange={e => setDriverForm({...driverForm, licenseNumber: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Téléphone</label><input type="text" value={driverForm.phone || ''} onChange={e => setDriverForm({...driverForm, phone: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Statut</label><select value={driverForm.status || 'active'} onChange={e => setDriverForm({...driverForm, status: e.target.value as any})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm appearance-none"><option value="active">Actif</option><option value="on_leave">Congé</option><option value="suspended">Suspendu</option></select></div>
          </div>
          <div className="mt-4">
             <AttachmentSection 
                items={driverForm.attachments || []} 
                onUpload={(e) => handleAttachmentUpload(e, 'driver')} 
                onDelete={(index) => handleDeleteAttachment(index, 'driver')}
             />
          </div>
        </Modal>
      )}

      {showModal === 'fuel' && (
        <Modal title="Saisie Carburant" onClose={() => setShowModal(null)} onSave={handleSaveFuel} isSaving={isSaving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="text-[10px] font-black uppercase text-slate-400">Date</label><input type="date" value={fuelForm.date || ''} onChange={e => setFuelForm({...fuelForm, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Véhicule</label><select value={fuelForm.vehicleId || ''} onChange={e => setFuelForm({...fuelForm, vehicleId: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm appearance-none"><option value="">Sélectionner...</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>)}</select></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Conducteur</label><select value={fuelForm.driverId || ''} onChange={e => setFuelForm({...fuelForm, driverId: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm appearance-none"><option value="">Sélectionner...</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Destination / Zone</label><input type="text" value={fuelForm.destinationCity || ''} onChange={e => setFuelForm({...fuelForm, destinationCity: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" placeholder="Ville ou Zone" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Montant (DH)</label><input type="number" value={fuelForm.amount || ''} onChange={e => setFuelForm({...fuelForm, amount: parseFloat(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Compteur KM</label><input type="number" value={fuelForm.odometer || ''} onChange={e => setFuelForm({...fuelForm, odometer: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" /></div>
          </div>
        </Modal>
      )}

      {showModal === 'accidents' && (
        <Modal title="Déclaration Sinistre" onClose={() => setShowModal(null)} onSave={handleSaveAccident} isSaving={isSaving}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="text-[10px] font-black uppercase text-slate-400">Date</label><input type="date" value={accidentForm.date || ''} onChange={e => setAccidentForm({...accidentForm, date: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Véhicule</label><select value={accidentForm.vehicleId || ''} onChange={e => setAccidentForm({...accidentForm, vehicleId: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm appearance-none"><option value="">Sélectionner...</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}</select></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Conducteur</label><select value={accidentForm.driverId || ''} onChange={e => setAccidentForm({...accidentForm, driverId: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm appearance-none"><option value="">Sélectionner...</option>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Coût Estimé</label><input type="number" value={accidentForm.cost || ''} onChange={e => setAccidentForm({...accidentForm, cost: parseFloat(e.target.value)})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm" /></div>
            <div className="col-span-1 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400">Description</label><textarea value={accidentForm.description || ''} onChange={e => setAccidentForm({...accidentForm, description: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm h-24" placeholder="Détails de l'incident..." /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-400">Statut</label><select value={accidentForm.status || 'pending'} onChange={e => setAccidentForm({...accidentForm, status: e.target.value as any})} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-black text-sm appearance-none"><option value="pending">En attente</option><option value="in_repair">En réparation</option><option value="operational">Réparé / Opérationnel</option><option value="total_loss">Épave</option></select></div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FleetManagement;
