
export type AppId = 'commissions' | 'fleet' | 'stock' | 'users' | 'hr-attendance' | 'adv' | 'kpi-pilot' | 'b2b-prospect' | 'tv-dashboard' | 'field-command' | 'field-control';

export interface ModulePermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data?: string; // base64 (legacy)
  dataEnc?: string; // base64 (AES-GCM)
  iv?: string; // base64 (AES-GCM)
  storage?: 'inline' | 'idb';
  date: string;
}

export interface User {
  username: string;
  password?: string;
  role: 'admin' | 'agent';
  associatedAgentName?: string;
  allowedApps: AppId[];
  permissions?: {
    stock?: ModulePermissions;
    fleet?: ModulePermissions;
    commissions?: ModulePermissions;
    hr?: ModulePermissions;
    adv?: ModulePermissions;
    b2bProspect?: ModulePermissions;
    fieldCommand?: ModulePermissions;
    fieldControl?: ModulePermissions;
  };
}

// --- FIELD CONTROL (AUDIT TERRAIN) ---
export interface FieldControl {
  id: string;
  targetType?: 'individual' | 'team'; // Nouveau : Type de cible
  controllerName: string; // Celui qui fait le contrôle
  sellerName: string;     // Le vendeur OU le superviseur (si équipe)
  date: string;           // ISO Date
  zone: string;
  gpsLat?: number;
  gpsLng?: number;
  compliance: {
    zoneRespect: boolean;
    supervisorPresent: boolean;
    leftZone: boolean;     // True = il a quitté la zone (négatif)
    kitRespect: boolean;
  };
  metricsAtControlTime: {  // Snapshot des KPIs au moment du contrôle
    prospectsCount: number;
    opportunitiesCount: number;
    contractsCount: number;
  };
  photo?: string; // Base64
  comment: string;
}

// --- PORTAIL ADV & ACTIVATION ORANGE ---
export type ADVValidationStatus = 'VALIDE' | 'EN ATTENTE' | 'BLOQUÉ' | 'ANNULÉ' | 'SUPPRIMÉ';
export type ADVWorkflowStep = 'ÉTUDE' | 'ACTIVATION' | 'FINALISÉ';
export type ADVSiStatus = 'Non reçu' | 'En Etudes' | 'A traiter' | 'En GO' | 'Installé non Facturé' | 'Facturé' | 'Bloqué' | 'Annulé' | 'A resaisir';

export interface ADVOrder {
  id: string;
  refContrat: string;
  dateDepot: string;
  dateSaisi: string; 
  commercial: string;
  prestataire?: string;
  raisonSociale: string;
  telephone: string;
  offre: string;
  ville: string;
  origine?: 'New' | 'Upgrade' | 'Upsale'; // Nouveau champ
  validation: ADVValidationStatus;
  etape: ADVWorkflowStep;
  statutSi?: ADVSiStatus;
  raisonBlocage?: string; // Sous-états ADV
  raisonBlocageSi?: string; // Sous-états Activation
  isConfirmed?: boolean;
  linkCrm?: string;
  dateTraitement: string;
  dateValidation?: string; // Date précise de validation ADV
  dateActivationEnd?: string; // Date précise de fin de cycle Activation
  dateGo?: string; // Date de passage en GO
  dateStatutSi?: string; // Date du dernier changement de statut SI
  nFixe?: string;
  nSerie?: string;
  nSerieVerifie?: string; // Numéro de série vérifié/déposé
  dateSerieVerifie?: string; // Date de vérification du série
  // Flag pour identifier les dossiers créés manuellement (éviter suppression sync Dolibarr)
  isManuallyCreated?: boolean;
  // Timestamp de la dernière modification utilisateur (pour déduplication sûre)
  lastEditedAt?: string;
  // Champs synchronisation Dolibarr
  doliRef?: string;
  tiers?: string;
  departement?: string;
  dateCommande?: string;
  montantHT?: number;
  auteur?: string;
  commerciauxTiers?: string;
  produit?: string;
  typeSouscription?: string;
  esnIcc?: string;
  mbbSriGps?: string;
  villeInstallationFixe?: string;
  attachéCommercial?: string;
  dateCreation?: string;
  dateModif?: string;
  dateCloture?: string;
  facture?: boolean;
  etat?: string;
}

// --- RH ASSIDUITE ---
export interface HRSettings {
  entryTime: string;
  exitTime: string;
  toleranceMinutes: number;
  penaltyThresholdMinutes: number;
  workDays: number[];
  allowSinglePointage: boolean;
  employeeDepartments?: Record<string, 'Sales' | 'Back office'>;
}

export interface RawAttendanceRecord {
  employeeId: string;
  name: string;
  timestamp: string;
}

export interface AuthorizedAbsence {
  employeeId: string;
  date: string;
  type: 'Congé' | 'Maladie' | 'Mission' | 'Autorisation' | 'Férié' | 'Exceptionnel';
  comment?: string;
  startTime?: string;
  endTime?: string;
}

export interface AttendanceAnalysis {
  employeeId: string;
  name: string;
  date: string;
  status: 'present' | 'absent_authorized' | 'absent_unauthorized' | 'incomplete' | 'weekend' | 'meeting_presence';
  firstLog: string | null;
  lastLog: string | null;
  latenessMinutes: number;
  isLate: boolean;
  workDurationMinutes: number;
  comments: string[];
}

// --- FLOTTE ---
export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  status: 'active' | 'maintenance' | 'accident' | 'stopped';
  currentKm: number;
  fuelBudget: number;
  driverIds: string[];
  insuranceExpiry: string;
  techVisitExpiry: string;
  attachments: Attachment[];
}

export interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  phone: string;
  joinDate: string;
  status: 'active' | 'on_leave' | 'suspended';
  attachments: Attachment[];
}

export interface FuelLog {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string;
  destinationCity: string;
  amount: number;
  odometer: number;
}

export interface AccidentLog {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string;
  description: string;
  cost: number;
  photos: string[];
  status: 'pending' | 'in_repair' | 'immobilized' | 'repaired' | 'operational' | 'total_loss';
}

// --- STOCK ---
export interface StockAgent {
  id: string;
  name: string;
  phone?: string;
}

export interface StockItem {
  id: string;
  name: string;
  category: 'Fixe' | 'Mobile' | 'Box' | 'Accessoires';
  minThreshold: number;
  unit: string;
  warehouseSerials: string[]; 
  basePrice: number;
}

export interface StockUnit {
  serialNumber: string;
  itemId: string;
  currentOwner: string; 
  status: 'available' | 'assigned' | 'sold' | 'pending_payment' | 'defective' | 'lost' | 'deposited';
  lastMovementDate: string;
  price: number;
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: 'IN' | 'OUT' | 'RETURN' | 'SALE' | 'PENDING_SALE' | 'LOST' | 'DEFECTIVE' | 'DEPOSITED';
  quantity: number;
  date: string;
  selectedSerials: string[];
  agentName?: string; 
  reference?: string; 
  validator?: string;
}

// --- SALAIRES & COMMISSIONS ---
export interface SalaryData {
  agentName: string;
  baseSalary: number; 
  commission: number;
  seniorityBonus: number;
  prime20HD: number;
  prime100: number;
  bonusCA: number;
  p4: number;
  bonusOther: number;
  routerMalus: number;
  salaryConditionMalus: number;
  clawbackResiliation: number;
  clawbackDiversifia: number;
  lateness: number;
  absences: number;
  advance: number;
  otherDeductions: number;
  cnss: number; 
  hrIncidents: number;
  incidentsList: Record<string, number>;
}

export const initialSalaryData: SalaryData = {
  agentName: '', baseSalary: 0, commission: 0, seniorityBonus: 0, prime20HD: 0,
  prime100: 0, bonusCA: 0, p4: 0, bonusOther: 0, routerMalus: 0,
  salaryConditionMalus: 0, clawbackResiliation: 0, clawbackDiversifia: 0,
  lateness: 0, absences: 0, advance: 0, otherDeductions: 0, cnss: 0, 
  hrIncidents: 0, incidentsList: {},
};

export interface CalculationResult {
  totalGross: number;
  totalDeductions: number;
  netSalary: number;
  tierBonus?: number; // Nouveau: Bonus de palier
  totalSalesVolume?: number; // Volume total de ventes
}

export interface SalesData {
  tdlte: number; ftth20: number; ftth50: number; ftth100: number; ftth200: number; ftth500: number; adsl: number;
  box249: number; box349: number; box5g: number;
  forf6h: number; forf15h: number; forf22h: number; illimiteNat: number; forf34h: number;
  partage20: number; partage50: number; partage100: number; partage200: number;
}

export const initialSalesData: SalesData = {
  tdlte: 0, ftth20: 0, ftth50: 0, ftth100: 0, ftth200: 0, ftth500: 0, adsl: 0,
  box249: 0, box349: 0, box5g: 0, forf6h: 0, forf15h: 0, forf22h: 0,
  illimiteNat: 0, forf34h: 0, partage20: 0, partage50: 0, partage100: 0, partage200: 0,
};

// --- B2B PROSPECTS & OPPORTUNITES ---
export type OpportunityStage = 'Lancée' | 'En cours' | 'Facturée' | 'Annulée';

export interface Opportunity {
  id: string;
  prospectId: string;
  title: string;
  value: number; // Montant estimé ou nombre de lignes
  stage: OpportunityStage;
  expectedCloseDate: string;
  notes: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
}

export interface Prospect {
  id: string;
  companyName: string;
  phone: string;
  address: string;
  sector: string;
  type?: 'Commerce' | 'BTOC' | 'Association' | 'Entreprise' | 'Autre';
  status: 'Nouveau' | 'Nouveau Client' | 'Ancien Client' | 'Recommandation'; // Ajout des nouveaux états
  interest: string[];
  notes: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  lastAction: string;
  // Anciens champs (optionnels pour rétrocompatibilité)
  contactName?: string;
  email?: string;
  // Nouveaux champs
  latitude?: number;
  longitude?: number;
  photo?: string; // Base64 image data
}

// --- FIELD COMMAND (TERRAIN) ---
export interface FieldZone {
  id: string;
  name: string;
  city: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

export interface FieldAlert {
  id: string;
  type: string; // e.g. 'zone_exit'
  severity: 'low' | 'medium' | 'high';
  time: string;
  message: string;
  resolved: boolean;
}

export interface FieldSession {
  id: string;
  agentName: string;
  date: string;
  status: 'active' | 'completed' | 'pending';
  zoneId: string;
  supervisor: string;
  checkInTime: string;
  checkInLat?: number;
  checkInLng?: number;
  checkInSelfie?: string;
  checkOutTime?: string;
  checkOutLat?: number;
  checkOutLng?: number;
  alerts?: FieldAlert[];
}
