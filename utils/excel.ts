import * as XLSX from 'xlsx';
import { ResultRow, QualitativeAnalysisRow } from '../types';

/**
 * Parses the first sheet of an Excel file as Quantitative Results.
 */
export const parseExcelResults = (buffer: ArrayBuffer): ResultRow[] => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  if (workbook.SheetNames.length === 0) {
    throw new Error("Excel file is empty");
  }

  // Sheet 1: Quantitative Data
  const quantSheetName = workbook.SheetNames[0];
  const quantWorksheet = workbook.Sheets[quantSheetName];
  
  // sheet_to_json returns an array of objects where keys are headers
  const jsonData = XLSX.utils.sheet_to_json(quantWorksheet) as any[];

  // Clean keys: Ensure no leading/trailing whitespace in property names
  // This helps when Excel headers have accidental spaces
  const cleanedData: ResultRow[] = jsonData.map(row => {
    const newRow: any = {};
    Object.keys(row).forEach(key => {
      newRow[key.trim()] = String(row[key]); // Ensure values are strings for consistency with CSV parser
    });
    return newRow as ResultRow;
  });

  return cleanedData;
};

/**
 * Parses the second sheet (if available) as Qualitative Analysis.
 */
export const parseExcelQualitative = (buffer: ArrayBuffer): QualitativeAnalysisRow[] => {
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  if (workbook.SheetNames.length < 2) {
    console.warn("No second sheet found for Qualitative Analysis.");
    return [];
  }

  // Sheet 2: Qualitative Analysis
  const qualSheetName = workbook.SheetNames[1];
  const qualWorksheet = workbook.Sheets[qualSheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(qualWorksheet) as any[];

  const cleanedData: QualitativeAnalysisRow[] = jsonData.map(row => {
    const newRow: any = {};
    Object.keys(row).forEach(key => {
      newRow[key.trim()] = row[key]; 
    });
    return newRow as QualitativeAnalysisRow;
  });

  return cleanedData;
}