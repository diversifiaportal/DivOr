import * as XLSX from 'xlsx';
import { Opportunity, Prospect } from '../types';

interface ExportRecord {
  'ID Opportunité': string;
  'Titre': string;
  'Entreprise': string;
  'Téléphone': string;
  'Agent Commercial': string;
  'Stade': string;
  'Valeur (MAD)': number;
  'Date de Création': string;
  'Date de Clôture Prévue': string;
  'Notes': string;
  'Type Prospect': string;
  'Statut Prospect': string;
}

/**
 * Exports filtered opportunities to an Excel file
 * @param opportunities Filtered list of opportunities to export
 * @param prospects Complete list of prospects for lookup
 */
export const exportOpportunitiesToExcel = (
  opportunities: Opportunity[],
  prospects: Prospect[]
): void => {
  if (opportunities.length === 0) {
    throw new Error("Aucune opportunité à exporter");
  }

  // Create a Map for O(1) prospect lookups instead of O(N) find operations
  const prospectMap = new Map(prospects.map(p => [p.id, p]));

  // Transform filtered opportunities into export records
  const exportData = transformOpportunitiesToExportData(opportunities, prospectMap);

  // Create and configure the Excel workbook
  const { workbook, worksheet } = createExcelWorkbook(exportData);

  // Generate filename with date
  const filename = generateExportFilename();

  // Write the file
  XLSX.writeFile(workbook, filename);
};

/**
 * Transforms opportunities into export-ready data format with prospect information
 */
function transformOpportunitiesToExportData(
  opportunities: Opportunity[],
  prospectMap: Map<string, Prospect>
): ExportRecord[] {
  return opportunities.map(opp => {
    const prospect = prospectMap.get(opp.prospectId);

    return {
      'ID Opportunité': opp.id,
      'Titre': opp.title,
      'Entreprise': prospect?.companyName || 'Prospect inconnu',
      'Téléphone': prospect?.phone || '',
      'Agent Commercial': opp.assignedTo || 'Non assigné',
      'Stade': opp.stage,
      'Valeur (MAD)': opp.value,
      'Date de Création': new Date(opp.createdAt).toLocaleDateString('fr-FR'),
      'Date de Clôture Prévue': opp.expectedCloseDate
        ? new Date(opp.expectedCloseDate).toLocaleDateString('fr-FR')
        : '',
      'Notes': opp.notes || '',
      'Type Prospect': prospect?.type || '',
      'Statut Prospect': prospect?.status || ''
    };
  });
}

/**
 * Creates Excel workbook with formatted columns
 */
function createExcelWorkbook(exportData: ExportRecord[]) {
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Opportunités');

  // Configure column widths for better readability
  worksheet['!cols'] = [
    { wch: 12 }, // ID Opportunité
    { wch: 25 }, // Titre
    { wch: 25 }, // Entreprise
    { wch: 15 }, // Téléphone
    { wch: 20 }, // Agent Commercial
    { wch: 12 }, // Stade
    { wch: 12 }, // Valeur
    { wch: 18 }, // Date de Création
    { wch: 20 }, // Date de Clôture Prévue
    { wch: 30 }, // Notes
    { wch: 15 }, // Type Prospect
    { wch: 15 }  // Statut Prospect
  ];

  return { workbook, worksheet };
}

/**
 * Generates a timestamped filename for the export
 */
function generateExportFilename(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  return `Opportunites_B2B_${dateStr}.xlsx`;
}
