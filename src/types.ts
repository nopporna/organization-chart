export interface Employee {
  id: string;
  name: string;
  nickname: string;
  email: string;
  department: string;
  unit: string; // sub-team under department
  role: string;
  grade: string; // e.g. "EC", "DVM", "HO", "UM", "A1", "A2", "A3", "B1", "B2", "B4" etc
  reportsToId: string; // ID of the manager, empty string if root
  photoUrl: string;
  historicalTitles: string[]; // parsed from semicolon or comma-separated list
  bio: string;
}

export interface OrgNode {
  id: string; // same as employee.id
  employee: Employee;
  children: OrgNode[];
  isExpanded?: boolean;
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  title: string;
}
