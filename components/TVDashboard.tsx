
import React, { useState, useEffect, useMemo } from 'react';
import { ADVOrder, StockItem, StockUnit, AttendanceAnalysis, Prospect, Opportunity } from '../types';
import { getCloudData } from '../services/database';
import { COMMISSION_RATES } from '../constants';
import { 
  Trophy, TrendingUp, AlertTriangle, Users, Package, 
  Activity, Clock, Calendar, CheckCircle2, XCircle, 
  ArrowUpRight, AlertOctagon, Zap, ShieldCheck, Target, Ban,
  Smartphone, Router, Share2, Box, Wallet, Percent, PhoneOff,
  Briefcase
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid
} from 'recharts';

const COLORS = ['#ff7900', '#3b82f6', '#10b981', '#f43f5e', '#8b5cf6'];

const ICONS_MAP: Record<string, any> = {
    'Zap': Zap,
    'Smartphone': Smartphone,
    'Box': Box,
    'Share2': Share2,
    'Router': Router
};

// Helper function to clean reference fields and prevent sync conflicts
const cleanReference = (ref: string): string => {
  return (ref || '').trim().replace(/\s+/g, ' ');
};

const TVDashboard: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [advOrders, setAdvOrders] = useState<ADVOrder[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockUnits, setStockUnits] = useState<StockUnit[]>([]);
  const [attendance, setAttendance] = useState<AttendanceAnalysis[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [objectivesStore, setObjectivesStore] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  // Horloge Temps Réel
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Chargement des données avec Polling (Refresh toutes les 5s)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [adv, items, units, pros, opps, objs, hrIndex] = await Promise.all([
          getCloudData('adv_orders'),
          getCloudData('stock_items'),
          getCloudData('stock_units'),
          getCloudData('b2b_prospects'),
          getCloudData('b2b_opportunities'),
          getCloudData('kpi_objectives_detail'),
          getCloudData('hr_analysis_index')
        ]);

        if(adv) {
          // Nettoyer les références EN MÉMOIRE SEULEMENT (pas de réécriture destructrice)
          // Dédeduplication pour éviter le double comptage et matcher le Portail ADV
          const cleanedData = adv.map((o: ADVOrder) => ({
            ...o,
            refContrat: cleanReference(o.refContrat || ''),
            doliRef: o.doliRef ? cleanReference(o.doliRef) : o.doliRef,
            raisonSociale: cleanReference(o.raisonSociale || ''),
            telephone: cleanReference(o.telephone || ''),
            nFixe: o.nFixe ? cleanReference(o.nFixe) : o.nFixe,
            nSerie: o.nSerie ? cleanReference(o.nSerie) : o.nSerie,
          }));

          // Dédupliquer EN MÉMOIRE SEULEMENT pour l'affichage
          // IMPORTANT: Les commandes manuelles et celles modifiées par l'utilisateur sont TOUJOURS prioritaires
          const refMap = new Map<string, ADVOrder>();
          for (const order of cleanedData) {
            const key = cleanReference(order.refContrat || '');
            if (!key) continue; // Pas de refContrat, garder tel quel
            
            const existing = refMap.get(key);
            if (!existing) {
              refMap.set(key, order);
            } else {
              // PRIORITÉ 1: Commandes manuelles toujours prioritaires
              if (order.isManuallyCreated && !existing.isManuallyCreated) {
                refMap.set(key, order);
              } else if (existing.isManuallyCreated && !order.isManuallyCreated) {
                // garder l'existante
              } else {
                // PRIORITÉ 2: Commande avec lastEditedAt (modifiée par utilisateur) est prioritaire
                const existingEdited = existing.lastEditedAt || '';
                const newEdited = order.lastEditedAt || '';
                if (newEdited && !existingEdited) {
                  refMap.set(key, order);
                } else if (existingEdited && !newEdited) {
                  // garder l'existante
                } else {
                  // PRIORITÉ 3: Garder la version avec un statut modifié
                  const isExistingModified = existing.isManuallyCreated || existing.isConfirmed || existing.validation !== 'EN ATTENTE' || existing.statutSi !== 'En Etudes';
                  const isNewModified = order.isManuallyCreated || order.isConfirmed || order.validation !== 'EN ATTENTE' || order.statutSi !== 'En Etudes';
                  
                  if (isNewModified && !isExistingModified) {
                    refMap.set(key, order);
                  } else if (!isExistingModified && !isNewModified) {
                    // Les deux non modifiées, garder la plus récente
                    const existingDate = new Date(existing.dateTraitement || 0).getTime();
                    const newDate = new Date(order.dateTraitement || 0).getTime();
                    if (newDate > existingDate) refMap.set(key, order);
                  }
                }
              }
            }
          }

          const ordersWithoutRef = cleanedData.filter((o: ADVOrder) => !cleanReference(o.refContrat || ''));
          const deduplicatedOrders = [...ordersWithoutRef, ...Array.from(refMap.values())];
          
          setAdvOrders(deduplicatedOrders);
        }
        if(items) setStockItems(items);
        if(units) setStockUnits(units);
        if(pros) setProspects(pros);
        if(opps) setOpportunities(opps);
        if(objs) setObjectivesStore(objs);

        // Gestion intelligente des données RH (Support Sharding)
        let hrData: AttendanceAnalysis[] = [];
        const currentMonthKey = new Date().toISOString().slice(0, 7); // YYYY-MM

        if (hrIndex && hrIndex.months && Array.isArray(hrIndex.months)) {
            // 1. Essayer le mois en cours
            // 2. Sinon prendre le dernier mois disponible
            const targetMonth = hrIndex.months.includes(currentMonthKey) 
                ? currentMonthKey 
                : hrIndex.months[hrIndex.months.length - 1];
            
            if (targetMonth) {
                hrData = await getCloudData(`hr_analysis_${targetMonth}`) || [];
            }
        } else {
            // Fallback ancienne version (fichier unique) pour compatibilité
            hrData = await getCloudData('hr_analysis_results') || [];
        }
        setAttendance(hrData);

      } catch(e) {
        console.error("TV Dashboard Data Error", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData(); // Initial
    const refresh = setInterval(fetchData, 5000); // Loop toutes les 5s
    return () => clearInterval(refresh);
  }, []);

  // --- KPIs CALCULÉS ---

  // 1. SALES & ADV (Mois Courant)
  const currentMonth = currentTime.toISOString().slice(0, 7); // YYYY-MM
  const salesStats = useMemo(() => {
    const monthOrders = advOrders.filter(o => {
        let d = o.dateDepot || '';
        // Normalisation Robuste des Dates
        if (d.includes('T')) d = d.split('T')[0]; // ISO
        if (d.includes('/')) { // FR DD/MM/YYYY
           const parts = d.split('/');
           if (parts.length === 3) d = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return d.startsWith(currentMonth);
    });

    const total = monthOrders.length; // Réalisés
    const validated = monthOrders.filter(o => o.validation === 'VALIDE').length;
    
    // Annulés Global (ADV ou Activation)
    const cancelled = monthOrders.filter(o => {
        const vNorm = (o.validation || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const sNorm = (o.statutSi || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return vNorm.includes('ANNULE') || sNorm.includes('ANNULE');
    }).length;

    // Bloqués (Pour le backlog opérationnel) - Validation BLOQUÉ ou Statut SI Bloqué
    const blocked = monthOrders.filter(o => {
        const val = (o.validation || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const statutSi = (o.statutSi || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return val.includes('BLOQUE') || statutSi.includes('BLOQUE');
    }).length;
    
    // Injoignables (Motifs spécifiques demandés)
    const unreachable = monthOrders.filter(o => {
        const combinedReasons = ((o.raisonBlocage || '') + ' ' + (o.raisonBlocageSi || '')).toLowerCase();
        return combinedReasons.includes('injoignable');
    }).length;
    
    // Backlog séparé : En attente de validation ADV (statut EN ATTENTE ou BLOQUÉ) et En attente Activation (A traiter)
    // Correction : Ajout de 'BLOQUÉ' pour alignement avec le Portail ADV
    const waitingAdv = advOrders.filter(o => o.validation === 'EN ATTENTE' || o.validation === 'BLOQUÉ').length;
    const waitingActiv = advOrders.filter(o => o.validation === 'VALIDE' && o.statutSi === 'A traiter').length;

    const rate = total > 0 ? Math.round((validated / total) * 100) : 0;

    // Calcul des Facturés + Installés non facturés (Statut SI précis + Validation VALIDE)
    // Filtrage par dateStatutSi (date du changement de statut) uniquement
    const facturedOrders = advOrders.filter(o => {
        // Condition 1: Validation doit être VALIDE (obligatoire)
        if (o.validation !== 'VALIDE') return false;
        
        const sRaw = (o.statutSi || '').trim().toUpperCase();
        const s = sRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Normalisation accents
        
        // Condition 2: Statut SI doit être "Facturé" OU "Installé non Facturé"
        if (!s.includes('FACTURE') && !s.includes('INSTALLE')) return false;
        
        // Condition 3: dateStatutSi doit exister et être dans le mois en cours
        if (!o.dateStatutSi) return false;
        
        let d = o.dateStatutSi;
        if (d.includes('T')) d = d.split('T')[0]; // ISO
        if (d.includes('/')) { // FR DD/MM/YYYY
           const parts = d.split('/');
           if (parts.length === 3) d = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return d.startsWith(currentMonth);
    });
    const facturedCount = facturedOrders.length;

    // --- LEADERBOARD BASÉ SUR LE TRO (TAUX RÉALISATION OBJECTIFS) ---
    
    // 1. Récupérer les ventes par agent (Source : ADV Facturé)
    const agentSalesMap: Record<string, number> = {};
    facturedOrders.forEach(o => {
        if(o.commercial) {
            agentSalesMap[o.commercial] = (agentSalesMap[o.commercial] || 0) + 1;
        }
    });

    // 2. Récupérer les objectifs du mois (Source : KPI Pilot)
    const monthObjectives = objectivesStore[currentMonth] || {};
    
    // 3. Construire la liste combinée (Union des vendeurs ADV et des objectifs)
    const allAgents = Array.from(new Set([...Object.keys(monthObjectives), ...Object.keys(agentSalesMap)]));

    const leaderboardData = allAgents.map(agentName => {
        const sales = agentSalesMap[agentName] || 0;
        const agentObjs: any = monthObjectives[agentName] || {};
        
        const totalObjective: number = (Object.values(agentObjs) as any[]).reduce((sum: number, val: any) => sum + Number(val || 0), 0);
        
        const tro = totalObjective > 0 ? Math.round((sales / totalObjective) * 100) : 0;

        return {
            name: agentName,
            sales,
            objective: totalObjective,
            tro
        };
    });

    // 4. Trier par TRO décroissant
    const leaderboard = leaderboardData
        .filter(d => d.objective > 0 || d.sales > 0)
        .sort((a,b) => {
            if (b.tro !== a.tro) return b.tro - a.tro; 
            return b.sales - a.sales; 
        })
        .map((item, idx) => ({ 
            ...item, 
            rank: idx + 1,
            displayName: item.name.split(' ')[0] 
        }));

    // --- CALCUL MIX PRODUIT FACTURÉ VS OBJECTIFS (GLOBAL) ---
    
    const productStats = {
        ftth: { label: 'Fibre', realized: 0, objective: 0, iconName: 'Zap', color: '#ff7900' },
        tdlte: { label: 'TDLTE', realized: 0, objective: 0, iconName: 'Router', color: '#06b6d4' },
        adsl: { label: 'ADSL', realized: 0, objective: 0, iconName: 'Router', color: '#f43f5e' },
        mobile: { label: 'Mobile', realized: 0, objective: 0, iconName: 'Smartphone', color: '#3b82f6' },
        box: { label: 'Box 4G', realized: 0, objective: 0, iconName: 'Box', color: '#8b5cf6' },
        pro: { label: 'Partage', realized: 0, objective: 0, iconName: 'Share2', color: '#10b981' },
    };

    // Calcul du Réalisé Global (FACTURÉ) avec classification améliorée
    facturedOrders.forEach(o => {
        const off = (o.offre || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // PRIORITÉ 1: Toutes les offres commençant par "FORFAIT" ou "Forfait" = MOBILE
        if (off.startsWith('FORFAIT')) {
            productStats.mobile.realized++;
        }
        // PRIORITÉ 2: Partage spécifique  
        else if (off.includes('PARTAGE') || off.includes('SHARING')) {
            productStats.pro.realized++;
        }
        // PRIORITÉ 3: TDLTE spécifique
        else if (off.includes('TDLTE')) {
            productStats.tdlte.realized++;
        }
        // PRIORITÉ 4: ADSL (sans fibre)
        else if (off.includes('ADSL') && !off.includes('FTTH') && !off.includes('FIBRE')) {
            productStats.adsl.realized++;
        }
        // PRIORITÉ 5: Fibre (sans TDLTE)
        else if ((off.includes('FTTH') || off.includes('FIBRE') || off.includes('FIBER')) && !off.includes('TDLTE')) {
            productStats.ftth.realized++;
        }
        // PRIORITÉ 6: Box 4G
        else if (off.includes('BOX') || off.includes('5G') || off.includes('4G') && off.includes('ROUTEUR')) {
            productStats.box.realized++;
        }
        // PRIORITÉ 7: Autres mobiles
        else if (off.includes('MOBILE') || off.includes('GSM') || off.includes('SIM') || off.includes('CARTE')) {
            productStats.mobile.realized++;
        }
        else {
            // Cas non classifiés : tentative de classification par défaut intelligente
            if (off.includes('INTERNET') || off.includes('HAUT DEBIT')) {
                productStats.ftth.realized++; // Probablement fibre
            } else {
                productStats.mobile.realized++; // Fallback vers mobile
            }
        }
    });

    // Calcul des Objectifs Globaux avec mapping robuste
    Object.values(monthObjectives).forEach((agentObjs: any) => {
        // Fibre : plusieurs clés possibles (sans TDLTE)
        productStats.ftth.objective += Number(agentObjs['FTTH'] || 0) + 
                                      Number(agentObjs['Fibre'] || 0);
        
        // TDLTE : clés spécifiques
        productStats.tdlte.objective += Number(agentObjs['TDLTE+'] || 0) + 
                                       Number(agentObjs['TDLTE'] || 0);
        
        // ADSL
        productStats.adsl.objective += Number(agentObjs['ADSL'] || 0);
        
        // Mobile : plusieurs clés possibles
        productStats.mobile.objective += Number(agentObjs['MOBILE'] || 0) + 
                                         Number(agentObjs['Mobile'] || 0) + 
                                         Number(agentObjs['GSM'] || 0);
        
        // Box 4G : plusieurs clés possibles
        productStats.box.objective += Number(agentObjs['BOX/SIM'] || 0) + 
                                     Number(agentObjs['BOX'] || 0) + 
                                     Number(agentObjs['Box'] || 0) + 
                                     Number(agentObjs['4G'] || 0);
        
        // Partage : plusieurs clés possibles
        productStats.pro.objective += Number(agentObjs['Partage FTTH'] || 0) + 
                                     Number(agentObjs['Partage'] || 0) + 
                                     Number(agentObjs['PARTAGE'] || 0);
    });
    
    return { total, validated, cancelled, blocked, waitingAdv, waitingActiv, rate, factured: facturedCount, leaderboard, productStats, unreachable };
  }, [advOrders, currentMonth, objectivesStore]);

  // 2. STOCK
  const stockStats = useMemo(() => {
    const lowStock = stockItems.filter(i => 
      i.name && (i.warehouseSerials?.length || 0) <= i.minThreshold
    );
    
    lowStock.sort((a, b) => {
        const gapA = a.minThreshold - (a.warehouseSerials?.length || 0);
        const gapB = b.minThreshold - (b.warehouseSerials?.length || 0);
        return gapB - gapA;
    });

    const totalUnits = stockUnits.length;
    const inDepot = stockUnits.filter(u => u.currentOwner === 'Dépôt').length;
    
    return { 
        alerts: lowStock.length, 
        alertedItems: lowStock, 
        total: totalUnits, 
        availability: Math.round((inDepot/totalUnits)*100) || 0 
    };
  }, [stockItems, stockUnits]);

  // 3. RH (Aujourd'hui ou Dernier Jour Traité)
  const hrStats = useMemo(() => {
    if(attendance.length === 0) return { presence: 0, lates: 0, absents: 0, date: null };
    
    // Trier par date décroissante pour avoir le jour le plus récent
    const sorted = [...attendance].sort((a,b) => b.date.localeCompare(a.date));
    
    const lastDate = sorted[0]?.date;
    const dayRecords = sorted.filter(a => a.date === lastDate);
    
    const present = dayRecords.filter(a => a.status === 'present' || a.status === 'meeting_presence').length;
    const late = dayRecords.filter(a => a.isLate).length;
    const absents = dayRecords.filter(a => a.status === 'absent_unauthorized' || a.status === 'absent_authorized' || a.status === 'incomplete').length;
    const total = dayRecords.length;
    
    return { 
        presence: total > 0 ? Math.round((present/total)*100) : 0, 
        lates: late, 
        absents, 
        date: lastDate 
    };
  }, [attendance]);

  // 4. B2B (Mois Courant)
  const b2bStats = useMemo(() => {
    const monthProspects = prospects.filter(p => p.createdAt.startsWith(currentMonth));
    const monthOpps = opportunities.filter(o => o.createdAt.startsWith(currentMonth));
    
    const pCount = monthProspects.length;
    const oCount = monthOpps.length;
    const rate = pCount > 0 ? Math.round((oCount / pCount) * 100) : 0;

    return { prospects: pCount, opportunities: oCount, rate };
  }, [prospects, opportunities, currentMonth]);

  if(isLoading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-[#ff7900] font-black tracking-widest text-2xl animate-pulse">CHARGEMENT DIVERSIFIA LIVE...</div>;

  // Composant Circulaire SVG simple pour le TRO
  const CircularProgress = ({ value, color, size = 60 }: { value: number, color: string, size?: number }) => {
      const radius = size / 2 - 4;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (Math.min(value, 100) / 100) * circumference;
      
      return (
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
              <svg className="transform -rotate-90 w-full h-full">
                  <circle cx={size/2} cy={size/2} r={radius} stroke="#334155" strokeWidth="6" fill="transparent" />
                  <circle 
                      cx={size/2} cy={size/2} r={radius} 
                      stroke={color} strokeWidth="6" fill="transparent" 
                      strokeDasharray={circumference} strokeDashoffset={offset} 
                      strokeLinecap="round"
                  />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-black text-white">{value}%</span>
              </div>
          </div>
      );
  };

  return (
    <div className="h-screen bg-slate-950 text-white overflow-hidden font-['Plus_Jakarta_Sans'] flex flex-col">
      
      {/* HEADER */}
      <div className="h-28 bg-slate-900 border-b border-white/10 flex items-center justify-between px-12 flex-shrink-0">
         <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-[#ff7900] rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-orange-500/20">
                <Activity className="w-7 h-7 text-white" />
            </div>
            <div>
                <h1 className="text-3xl font-black uppercase italic tracking-tighter leading-none">DIVERSIFIA <span className="text-[#ff7900]">LIVE</span></h1>
                <p className="text-xs font-bold text-slate-400 tracking-[0.3em] uppercase mt-1">Performance Center</p>
            </div>
         </div>
         <div className="flex items-center gap-8">
            <div className="text-right">
                <p className="text-4xl font-black tracking-widest font-mono">{currentTime.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</p>
                <p className="text-sm font-bold text-slate-500 uppercase">{currentTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
         </div>
      </div>

      {/* MAIN GRID */}
      <div className="flex-1 min-h-0 p-6 pb-12 mb-6 grid grid-cols-12 grid-rows-6 gap-6">
         
         {/* BLOC 1: TOP PERFORMERS (Gauche) */}
         <div className="col-span-3 row-span-6 bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-8 flex flex-col relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#ff7900] to-yellow-500"></div>
            <div className="flex items-center gap-3 mb-8 flex-shrink-0">
                <Trophy className="w-7 h-7 text-yellow-400" />
                <div>
                    <h2 className="text-xl font-black uppercase italic tracking-tighter">Top Vendeurs</h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Classement par TRO (%)</p>
                </div>
            </div>
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                {salesStats.leaderboard.map((agent, index) => (
                    <div key={index} className={`relative p-2.5 rounded-2xl border ${index === 0 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-slate-800/50 border-white/5'} flex items-center justify-between transition-all shrink-0`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-white'}`}>
                                {agent.rank}
                            </div>
                            <div>
                                <span className="font-bold uppercase text-[10px] tracking-wide block truncate max-w-[100px]">{agent.displayName}</span>
                                <span className="text-[8px] text-slate-400 font-bold leading-none block">
                                   {agent.sales} Ventes
                                   {agent.objective > 0 ? ` / ${agent.objective} Obj` : ''}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`text-lg font-black ${agent.tro >= 100 ? 'text-emerald-500' : 'text-[#ff7900]'}`}>{agent.tro}%</span>
                            <p className="text-[7px] font-bold text-slate-500 uppercase leading-none">{agent.objective > 0 ? 'Objectif' : 'Sans Obj'}</p>
                        </div>
                        {index === 0 && <div className="absolute -right-2 -top-2"><img src="https://cdn-icons-png.flaticon.com/512/6455/6455041.png" className="w-6 h-6 animate-bounce" alt="crown"/></div>}
                    </div>
                ))}
            </div>
         </div>

         {/* BLOC 2: SALES GLOBAL */}
         <div className="col-span-6 row-span-3 bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-8 flex flex-col shadow-xl">
            <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-3"><Target className="w-6 h-6 text-[#ff7900]" /> Performance Commerciale</h2>
                <span className="bg-slate-800 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-slate-400">Mois en cours</span>
            </div>
            <div className="grid grid-cols-5 gap-4 h-full">
                <div className="bg-slate-800/50 rounded-3xl p-4 flex flex-col justify-center items-center border border-white/5">
                    <span className="text-3xl lg:text-4xl font-black text-white">{salesStats.total}</span>
                    <span className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Réalisés</span>
                </div>
                
                <div className="bg-emerald-500/10 rounded-3xl p-4 flex flex-col justify-center items-center border border-emerald-500/20">
                    <span className="text-3xl lg:text-4xl font-black text-emerald-500">{salesStats.validated}</span>
                    <span className="text-[9px] lg:text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-2">Validés</span>
                </div>

                <div className="bg-cyan-500/10 rounded-3xl p-4 flex flex-col justify-center items-center border border-cyan-500/20">
                    <span className="text-3xl lg:text-4xl font-black text-cyan-500">{salesStats.factured}</span>
                    <span className="text-[9px] lg:text-[10px] font-bold text-cyan-400 uppercase tracking-widest mt-2">Facturés</span>
                </div>

                <div className="bg-orange-500/10 rounded-3xl p-4 flex flex-col justify-center items-center border border-orange-500/20">
                    <span className="text-3xl lg:text-4xl font-black text-orange-500">{salesStats.blocked}</span>
                    <span className="text-[9px] lg:text-[10px] font-bold text-orange-400 uppercase tracking-widest mt-2">Bloqués</span>
                </div>

                <div className="bg-rose-500/10 rounded-3xl p-4 flex flex-col justify-center items-center border border-rose-500/20">
                    <span className="text-3xl lg:text-4xl font-black text-rose-500">{salesStats.cancelled}</span>
                    <span className="text-[9px] lg:text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-2">Annulés</span>
                </div>
            </div>
         </div>

         {/* BLOC 3: OPERATIONAL HEALTH + B2B */}
         <div className="col-span-3 row-span-3 grid grid-rows-3 gap-6">
             <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-6 flex items-center justify-between shadow-xl">
                 <div>
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Dossiers en Attente de Validation</p>
                     <div className="flex items-center gap-6">
                        <div>
                            <p className="text-3xl font-black text-yellow-500">{salesStats.waitingAdv}</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">ADV</p>
                        </div>
                        <div className="w-px h-8 bg-white/10"></div>
                        <div>
                            <p className="text-3xl font-black text-blue-500">{salesStats.waitingActiv}</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Activation</p>
                        </div>
                     </div>
                 </div>
                 <div className="w-14 h-14 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500">
                     <Clock className="w-7 h-7" />
                 </div>
             </div>
             
             <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-6 flex items-center justify-between shadow-xl">
                 <div>
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Injoignables</p>
                     <p className="text-4xl font-black text-orange-500">{salesStats.unreachable}</p>
                     <p className="text-[10px] text-orange-400 font-bold mt-1">Client / Études / GO</p>
                 </div>
                 <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500">
                     <PhoneOff className="w-7 h-7" />
                 </div>
             </div>

             {/* NEW B2B CARD */}
             <div className="bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-6 flex items-center justify-between shadow-xl">
                 <div>
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pipeline B2B</p>
                     <div className="flex items-end gap-2">
                        <p className="text-3xl font-black text-indigo-500">{b2bStats.prospects}</p>
                        <span className="text-[10px] text-slate-500 font-bold mb-1 mr-2">Pros</span>
                        
                        <p className="text-3xl font-black text-white">{b2bStats.opportunities}</p>
                        <span className="text-[10px] text-slate-500 font-bold mb-1">Deals</span>
                     </div>
                     <p className="text-[10px] text-indigo-400 font-bold mt-1 uppercase tracking-wide">Conv: {b2bStats.rate}%</p>
                 </div>
                 <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                     <Briefcase className="w-7 h-7" />
                 </div>
             </div>
         </div>

         {/* BLOC 4: DETAILS MIX & RH */}
         <div className="col-span-9 row-span-3 grid grid-cols-3 gap-6">
             
             {/* Mix Produit */}
             <div className="col-span-2 bg-slate-900/50 rounded-[2.5rem] border border-white/5 p-8 shadow-xl">
                <h3 className="text-sm font-black uppercase italic tracking-tighter mb-6 text-slate-300 flex items-center">
                    <Target className="w-4 h-4 mr-2" /> Performance Facturée vs Objectifs
                </h3>
                <div className="h-full flex items-center justify-between gap-4">
                    {Object.entries(salesStats.productStats).map(([key, data]: [string, any]) => {
                        const tro = data.objective > 0 ? Math.round((data.realized / data.objective) * 100) : 0;
                        const Icon = ICONS_MAP[data.iconName] || Target;
                        return (
                            <div key={key} className="bg-slate-800/50 rounded-3xl p-4 flex-1 border border-white/5 flex flex-col items-center justify-between h-full max-h-[180px]">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className="w-4 h-4" style={{ color: data.color }} />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{data.label}</span>
                                </div>
                                
                                <CircularProgress value={tro} color={data.color} size={70} />
                                
                                <div className="text-center mt-3 w-full">
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-full px-2">
                                        <span>Réal</span>
                                        <span>Obj</span>
                                    </div>
                                    <div className="flex justify-between items-center font-black text-white text-lg w-full px-2 leading-none">
                                        <span style={{ color: data.color }}>{data.realized}</span>
                                        <span className="text-slate-600">/</span>
                                        <span className="text-slate-300">{data.objective}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
             </div>

             {/* RH & Stock Warning */}
             <div className="col-span-1 flex flex-col gap-4 overflow-hidden h-full">
                 <div className="bg-slate-900/50 rounded-[2rem] border border-white/5 p-5 flex items-center justify-between shadow-lg h-24 flex-shrink-0">
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">RH Présence</p>
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-white leading-none mt-1">{hrStats.presence}%</span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-bold text-rose-400">{hrStats.lates} Retards</span>
                                <span className="text-[8px] text-slate-600">|</span>
                                <span className="text-[9px] font-bold text-orange-400">{hrStats.absents} Absents</span>
                            </div>
                        </div>
                    </div>
                    <Users className="w-8 h-8 text-indigo-500" />
                 </div>
                 
                 {/* ALERTE STOCK AVEC LISTE */}
                 <div className={`rounded-[2rem] border p-4 flex flex-col shadow-lg overflow-hidden relative flex-1 ${stockStats.alerts > 0 ? 'bg-rose-900/20 border-rose-500/50' : 'bg-slate-900/50 border-white/5'}`}>
                    <div className="flex-shrink-0 mb-1">
                        <div className="flex justify-between items-start">
                           <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Alerte Stock</p>
                           <AlertOctagon className={`w-6 h-6 ${stockStats.alerts > 0 ? 'text-rose-500 animate-pulse' : 'text-emerald-500'}`} />
                        </div>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className={`text-3xl font-black ${stockStats.alerts > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{stockStats.alerts}</span>
                            <span className="text-[10px] font-bold text-slate-400">Produits en Rupture</span>
                        </div>
                    </div>
                    
                    {stockStats.alerts > 0 && stockStats.alertedItems && stockStats.alertedItems.length > 0 ? (
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1 mt-1 space-y-1">
                            {stockStats.alertedItems.map((item, idx) => (
                                <div key={item.id || idx} className="flex justify-between items-center bg-slate-900/40 p-1.5 rounded-lg border border-white/5">
                                    <span className="font-bold text-rose-300 text-[9px] truncate flex-1 min-w-0 mr-2" title={item.name}>
                                        {item.name || 'Produit Inconnu'}
                                    </span>
                                    <span className="font-mono font-black text-rose-500 bg-rose-950/80 px-1.5 py-0.5 rounded text-[8px] whitespace-nowrap border border-rose-500/20">
                                        {item.warehouseSerials?.length || 0} / {item.minThreshold}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Stock Sécurisé</p>
                        </div>
                    )}
                 </div>
             </div>

         </div>

      </div>

      {/* FOOTER TICKER */}
      <div className="h-28 bg-[#ff7900] flex items-center overflow-hidden relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50 border-t-4 border-orange-400 flex-shrink-0">
         <div className="absolute whitespace-nowrap animate-marquee flex items-center gap-32 text-white font-black uppercase tracking-widest text-4xl">
            <span className="flex items-center gap-4"><span className="text-5xl">🚀</span> Objectif Mois: 1500 Ventes</span>
            <span className="flex items-center gap-4"><span className="text-5xl">⭐</span> Top Vendeur: {salesStats.leaderboard[0]?.displayName || '---'} ({salesStats.leaderboard[0]?.tro || 0}%)</span>
            <span className="flex items-center gap-4"><span className="text-5xl">🔥</span> Challenge "Sprint Fibre" en cours jusqu'au 30 !</span>
            <span className="flex items-center gap-4"><span className="text-5xl">⚠️</span> Rappel RH: Validation des congés avant le 25.</span>
            <span className="flex items-center gap-4"><span className="text-5xl">📈</span> Taux de transformation global: {salesStats.rate}%</span>
            <span className="flex items-center gap-4"><span className="text-5xl">🚀</span> Objectif Mois: 1500 Ventes</span>
            <span className="flex items-center gap-4"><span className="text-5xl">⭐</span> Top Vendeur: {salesStats.leaderboard[0]?.displayName || '---'} ({salesStats.leaderboard[0]?.tro || 0}%)</span>
            <span className="flex items-center gap-4"><span className="text-5xl">🔥</span> Challenge "Sprint Fibre" en cours jusqu'au 30 !</span>
         </div>
      </div>

      <style>{`
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default TVDashboard;
