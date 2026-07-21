import { Employee } from '../types';

async function formatGoogleApiError(response: Response, action: string): Promise<string> {
  try {
    const data = await response.json();
    const message = data?.error?.message;
    const status = data?.error?.status;
    if (message) {
      return status ? `${action}: ${message} (${status})` : `${action}: ${message}`;
    }
  } catch {
    // Fall back to HTTP status when the response body is not JSON.
  }
  return `${action} (${response.status}${response.statusText ? ` ${response.statusText}` : ''})`;
}

// Helper to extract spreadsheet ID from a URL or return it as-is
export function extractSpreadsheetId(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  if (trimmed.includes('docs.google.com/spreadsheets')) {
    // URL pattern: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/...
    const matches = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (matches && matches[1]) {
      return matches[1];
    }
  }
  return trimmed;
}

export function resolveSpreadsheetId(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const fromUrl = urlParams.get('sheet');
  if (fromUrl) return extractSpreadsheetId(fromUrl);

  const fromStorage = localStorage.getItem('org_spreadsheet_id');
  if (fromStorage) return fromStorage;

  return import.meta.env.VITE_DEFAULT_SPREADSHEET_ID || '';
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

const DEFAULT_HEADERS = [
  'ID',
  'Name',
  'Nickname',
  'Email',
  'Department',
  'Unit',
  'Role',
  'Grade',
  'ReportsToID',
  'PhotoURL',
  'HistoricalTitles',
  'Bio',
] as const;

type FieldKey =
  | 'id'
  | 'name'
  | 'nickname'
  | 'email'
  | 'department'
  | 'unit'
  | 'role'
  | 'grade'
  | 'reportsToId'
  | 'photoUrl'
  | 'historicalTitles'
  | 'bio';

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  id: ['id'],
  name: ['name'],
  nickname: ['nickname', 'nick'],
  email: ['email'],
  department: ['department', 'dept'],
  unit: ['unit'],
  role: ['role', 'title', 'jobtitle', 'position'],
  grade: ['grade', 'level'],
  reportsToId: ['reportstoid', 'reportsto', 'managerid', 'manager'],
  photoUrl: ['photourl', 'photo', 'avatar'],
  historicalTitles: ['historicaltitles', 'history', 'jobhistory'],
  bio: ['bio', 'biography', 'about'],
};

let cachedSheetHeaders: string[] = [...DEFAULT_HEADERS];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-]/g, '');
}

function buildColumnIndex(headers: string[]): Partial<Record<FieldKey, number>> {
  const normalized = headers.map(normalizeHeader);
  const index: Partial<Record<FieldKey, number>> = {};

  (Object.keys(HEADER_ALIASES) as FieldKey[]).forEach((field) => {
    for (const alias of HEADER_ALIASES[field]) {
      const found = normalized.indexOf(alias);
      if (found !== -1) {
        index[field] = found;
        break;
      }
    }
  });

  return index;
}

function detectLegacyLayoutWithoutUnit(headers: string[]): boolean {
  const index = buildColumnIndex(headers);
  // Old layout: Department then Role (no Unit column)
  return index.department !== undefined && index.role !== undefined && index.unit === undefined;
}

function employeeToRow(employee: Employee, headers: string[] = cachedSheetHeaders): string[] {
  const index = buildColumnIndex(headers);
  const row = new Array(Math.max(headers.length, DEFAULT_HEADERS.length)).fill('');

  const put = (field: FieldKey, value: string) => {
    const col = index[field];
    if (col === undefined) return;
    row[col] = value;
  };

  put('id', employee.id);
  put('name', employee.name);
  put('nickname', employee.nickname);
  put('email', employee.email);
  put('department', employee.department);
  put('unit', employee.unit);
  put('role', employee.role);
  put('grade', employee.grade);
  put('reportsToId', employee.reportsToId);
  put('photoUrl', employee.photoUrl);
  put('historicalTitles', employee.historicalTitles.join('; '));
  put('bio', employee.bio);

  // Fallback for sheets that still use the fixed new layout and missing header cache
  if (!index.id && !index.name) {
    return [
      employee.id,
      employee.name,
      employee.nickname,
      employee.email,
      employee.department,
      employee.unit,
      employee.role,
      employee.grade,
      employee.reportsToId,
      employee.photoUrl,
      employee.historicalTitles.join('; '),
      employee.bio,
    ];
  }

  return row.slice(0, headers.length);
}

function mapRowsToEmployees(
  values: string[][],
  headers: string[] = cachedSheetHeaders
): { employees: Employee[]; rawRows: string[][] } {
  const index = buildColumnIndex(headers);
  const legacy = detectLegacyLayoutWithoutUnit(headers);

  const read = (row: string[], field: FieldKey, fallback = ''): string => {
    const col = index[field];
    if (col !== undefined) {
      return row[col] || fallback;
    }

    // Legacy fixed positions when Unit column does not exist:
    // A:ID B:Name C:Nickname D:Email E:Department F:Role G:Grade H:ReportsToID I:PhotoURL J:HistoricalTitles K:Bio
    if (legacy || Object.keys(index).length === 0) {
      const legacyMap: Partial<Record<FieldKey, number>> = {
        id: 0,
        name: 1,
        nickname: 2,
        email: 3,
        department: 4,
        role: 5,
        grade: 6,
        reportsToId: 7,
        photoUrl: 8,
        historicalTitles: 9,
        bio: 10,
      };
      // Unit appended as last column after Bio
      if (field === 'unit' && row.length > 11) {
        return row[11] || fallback;
      }
      const legacyCol = legacyMap[field];
      return legacyCol !== undefined ? row[legacyCol] || fallback : fallback;
    }

    return fallback;
  };

  const employees: Employee[] = values
    .map((row) => {
      const id = read(row, 'id');
      if (!id || id.toLowerCase() === 'id') return null;

      const rawHistory = read(row, 'historicalTitles');
      const historicalTitles = rawHistory
        ? rawHistory.split(';').map((t) => t.trim()).filter(Boolean)
        : [];

      return {
        id,
        name: read(row, 'name'),
        nickname: read(row, 'nickname'),
        email: read(row, 'email'),
        department: read(row, 'department'),
        unit: read(row, 'unit'),
        role: read(row, 'role'),
        grade: read(row, 'grade'),
        reportsToId: read(row, 'reportsToId'),
        photoUrl: read(row, 'photoUrl'),
        historicalTitles,
        bio: read(row, 'bio'),
      };
    })
    .filter((emp): emp is Employee => emp !== null);

  return { employees, rawRows: values };
}

function columnLetter(index: number): string {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

async function ensureSheetHasColumns(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string,
  minColumns: number
): Promise<void> {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title,gridProperties(columnCount)))`;
  const metaResponse = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaResponse.ok) {
    throw new Error(await formatGoogleApiError(metaResponse, 'Failed to read sheet grid size'));
  }

  const meta = await metaResponse.json();
  const sheet = (meta.sheets || []).find(
    (s: any) => s.properties?.title === sheetName
  );
  if (!sheet) return;

  const currentColumns = sheet.properties?.gridProperties?.columnCount || 0;
  if (currentColumns >= minColumns) return;

  const sheetId = sheet.properties.sheetId;
  const expandResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            appendDimension: {
              sheetId,
              dimension: 'COLUMNS',
              length: minColumns - currentColumns,
            },
          },
        ],
      }),
    }
  );

  if (!expandResponse.ok) {
    throw new Error(await formatGoogleApiError(expandResponse, 'Failed to expand sheet columns'));
  }
}

async function ensureUnitHeader(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string,
  headers: string[]
): Promise<string[]> {
  const index = buildColumnIndex(headers);
  if (index.unit !== undefined) {
    cachedSheetHeaders = headers;
    return headers;
  }

  // Append Unit at the end so existing columns are not shifted/scrambled.
  const nextHeaders = [...headers, 'Unit'];
  await ensureSheetHasColumns(spreadsheetId, sheetName, accessToken, nextHeaders.length);

  const unitCol = columnLetter(nextHeaders.length - 1);
  const headerCell = `'${sheetName}'!${unitCol}1`;
  const writeResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(headerCell)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: headerCell,
        majorDimension: 'ROWS',
        values: [['Unit']],
      }),
    }
  );

  if (!writeResponse.ok) {
    throw new Error(await formatGoogleApiError(writeResponse, 'Failed to add Unit header'));
  }

  cachedSheetHeaders = nextHeaders;
  return nextHeaders;
}

// Read a publicly shared sheet (no Google sign-in required).
// The sheet must be shared as "Anyone with the link" → Viewer.
export async function fetchEmployeesFromPublicSheet(
  spreadsheetId: string,
  sheetName = 'Sheet1'
): Promise<{ employees: Employee[]; rawRows: string[][] }> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      'Failed to fetch public sheet. Share the sheet as "Anyone with the link can view".'
    );
  }

  const csv = await response.text();
  if (csv.trim().toLowerCase().startsWith('<!doctype') || csv.trim().toLowerCase().startsWith('<html')) {
    throw new Error(
      'Sheet is not publicly accessible. Share it as "Anyone with the link can view".'
    );
  }

  const rows = parseCsv(csv);
  const headers = rows[0] || [...DEFAULT_HEADERS];
  cachedSheetHeaders = headers;
  const dataRows = rows.slice(1);
  return mapRowsToEmployees(dataRows, headers);
}

// Fetch spreadsheet metadata to get the title and the first sheet's name
export async function getSpreadsheetDetails(
  spreadsheetId: string,
  accessToken: string
): Promise<{ title: string; firstSheetName: string }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await formatGoogleApiError(response, 'Failed to fetch spreadsheet details'));
  }

  const data = await response.json();
  const title = data.properties.title || 'Organization Chart';
  const firstSheetName = data.sheets?.[0]?.properties?.title || 'Sheet1';

  return { title, firstSheetName };
}

// Fetch employee records from the sheet
export async function fetchEmployeesFromSheet(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<{ employees: Employee[]; rawRows: string[][] }> {
  const range = `'${sheetName}'!A1:Z2000`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await formatGoogleApiError(response, 'Failed to fetch sheet data'));
  }

  const data = await response.json();
  const values: string[][] = data.values || [];
  const headers = (values[0] || [...DEFAULT_HEADERS]).map((h) => String(h || '').trim());
  cachedSheetHeaders = headers.length ? headers : [...DEFAULT_HEADERS];
  const dataRows = values.slice(1);
  return mapRowsToEmployees(dataRows, cachedSheetHeaders);
}

// Update the ReportsToID cell of an employee surgically
export async function updateEmployeeReportsTo(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string,
  employeeIndexInFetchedArray: number, // index in values array (from fetchEmployeesFromSheet)
  newReportsToId: string
): Promise<void> {
  const headers = await ensureUnitHeader(spreadsheetId, sheetName, accessToken, cachedSheetHeaders);
  const index = buildColumnIndex(headers);
  const reportsCol = index.reportsToId ?? 8;
  const rowNum = employeeIndexInFetchedArray + 2; // +2 because range starts at A2
  const cellRange = `'${sheetName}'!${columnLetter(reportsCol)}${rowNum}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(cellRange)}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: cellRange,
      majorDimension: 'ROWS',
      values: [[newReportsToId]],
    }),
  });

  if (!response.ok) {
    throw new Error(await formatGoogleApiError(response, 'Failed to update reporting line'));
  }
}

// Update an entire employee row
export async function updateEmployeeRow(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string,
  employeeIndexInFetchedArray: number,
  employee: Employee
): Promise<void> {
  const headers = await ensureUnitHeader(spreadsheetId, sheetName, accessToken, cachedSheetHeaders);
  await ensureSheetHasColumns(spreadsheetId, sheetName, accessToken, headers.length);

  const rowNum = employeeIndexInFetchedArray + 2;
  const endCol = columnLetter(headers.length - 1);
  const range = `'${sheetName}'!A${rowNum}:${endCol}${rowNum}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: [employeeToRow(employee, headers)],
    }),
  });

  if (!response.ok) {
    throw new Error(await formatGoogleApiError(response, 'Failed to update employee details'));
  }
}

// Add a new employee row
export async function addEmployeeRow(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string,
  employee: Employee
): Promise<void> {
  const headers = await ensureUnitHeader(spreadsheetId, sheetName, accessToken, cachedSheetHeaders);
  await ensureSheetHasColumns(spreadsheetId, sheetName, accessToken, headers.length);

  const endCol = columnLetter(headers.length - 1);
  const range = `'${sheetName}'!A:${endCol}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: [employeeToRow(employee, headers)],
    }),
  });

  if (!response.ok) {
    throw new Error(await formatGoogleApiError(response, 'Failed to add employee'));
  }
}

// Delete an employee (clear their row values)
export async function deleteEmployeeRow(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string,
  employeeIndexInFetchedArray: number
): Promise<void> {
  const headers = cachedSheetHeaders.length ? cachedSheetHeaders : [...DEFAULT_HEADERS];
  const rowNum = employeeIndexInFetchedArray + 2;
  const endCol = columnLetter(Math.max(headers.length - 1, 0));
  const range = `'${sheetName}'!A${rowNum}:${endCol}${rowNum}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await formatGoogleApiError(response, 'Failed to clear employee row'));
  }
}

// Create a brand new Spreadsheet with pre-populated demo organization data
export async function createDemoSpreadsheet(accessToken: string): Promise<{ spreadsheetId: string }> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  
  // 1. Create empty spreadsheet
  const createResponse = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: 'Corporate Organization Chart Data',
      },
    }),
  });

  if (!createResponse.ok) {
    throw new Error(await formatGoogleApiError(createResponse, 'Failed to create spreadsheet'));
  }

  const spreadsheetData = await createResponse.json();
  const spreadsheetId = spreadsheetData.spreadsheetId;
  const sheetName = spreadsheetData.sheets?.[0]?.properties?.title || 'Sheet1';

  // 2. Prepare sample dataset that perfectly matches the specification and looks amazing
  const headers = [
    'ID',
    'Name',
    'Nickname',
    'Email',
    'Department',
    'Unit',
    'Role',
    'Grade',
    'ReportsToID',
    'PhotoURL',
    'HistoricalTitles',
    'Bio',
  ];

  const demoEmployees = [
    [
      'EMP001',
      'Executive Committee',
      'EC',
      'board@largecorp.com',
      'Executive Committee',
      'Board',
      'Executive Committee',
      'EC',
      '',
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=200',
      'Board Directors (2022-2026); Trustees Board (2018-2022)',
      'The primary governing committee directing long-term strategic development, major expansions, and corporate governance.',
    ],
    [
      'EMP002',
      'Narit',
      'ต้น',
      'narit.t@largecorp.com',
      'ASD',
      'Unit A',
      'Division Manager',
      'DVM',
      'EMP001',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
      'ASD Deputy Manager (2023-2025); Senior Consultant (2020-2023)',
      'Heads the Agile Solutions Division (ASD), steering full-stack digital transformations and technology delivery tracks.',
    ],
    [
      'EMP003',
      'Anuwat',
      'เอียด',
      'anuwat.e@largecorp.com',
      'CPO',
      'PMO',
      'Head of Office',
      'HO',
      'EMP001',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200',
      'CPO Product Lead (2022-2024); Chief Operations Expert (2019-2022)',
      'Leads the Corporate Program Office (CPO), managing strategic alignment, operational standards, and cross-division synergies.',
    ],
    [
      'EMP004',
      'Soemsak',
      'Breeze',
      'soemsak.b@largecorp.com',
      'DGE',
      'Platform',
      'Division Manager',
      'DVM',
      'EMP001',
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200',
      'DGE Engineering Manager (2021-2024); Lead Devops Engineer (2018-2021)',
      'Heads Digital Growth & Engineering (DGE), leading platform scalability, Cloud infrastructure, and modern SaaS products.',
    ],
    [
      'EMP005',
      'Chatchawal',
      'ตาล',
      'chatchawal.t@largecorp.com',
      'DGI',
      'Security',
      'Division Manager',
      'DVM',
      'EMP001',
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200',
      'DGI Security Architect (2022-2024); Senior Network Specialist (2020-2022)',
      'Heads Digital Governance & Infrastructure (DGI), ensuring state-of-the-art cybersecurity compliance and stable networks.',
    ],
    [
      'EMP006',
      'Seehasak',
      'บอย',
      'seehasak.b@largecorp.com',
      'ASD',
      'Unit A',
      'Unit Manager',
      'UM',
      'EMP002',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      'Senior Systems Architect (2023-2025); Full Stack Developer (2021-2023)',
      'Manages Unit A within ASD, specialized in next-gen client platforms, responsive UI designs, and native application builds.',
    ],
    [
      'EMP007',
      'Chantana',
      'นา',
      'chantana.n@largecorp.com',
      'ASD',
      'Unit B',
      'Unit Manager',
      'UM',
      'EMP002',
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
      'Senior QA Manager (2022-2024); Quality Assurance Lead (2019-2022)',
      'Manages Unit B within ASD, driving the corporate-wide automated testing pipeline, quality gates, and release compliance.',
    ],
    [
      'EMP008',
      'Ratchadaporn',
      'เชอรี่',
      'ratchadaporn.c@largecorp.com',
      'ASD',
      'Unit C',
      'Unit Manager',
      'UM',
      'EMP002',
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200',
      'Senior Scrum Master (2021-2024); Business Analyst (2018-2021)',
      'Manages Unit C within ASD, centering on Agile product management, client relations, and delivery timelines.',
    ],
    [
      'EMP009',
      'Nuttachart',
      'ปาย',
      'nuttachart.p@largecorp.com',
      'ASD',
      'Unit D',
      'Unit Manager',
      'UM',
      'EMP002',
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200',
      'Senior Backend Engineer (2022-2025); Integration Developer (2020-2022)',
      'Manages Unit D within ASD, directing enterprise integrations, API design, and core ERP systems.',
    ],
    [
      'EMP010',
      'Patcharapon',
      'M',
      'patcharapon.m@largecorp.com',
      'ASD',
      'Unit D',
      'SAP ABAPER',
      'A2',
      'EMP009',
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200',
      'Junior SAP Developer (2024-2025); ERP Associate (2023-2024)',
      'Expert ABAP Developer handling custom standard reports, complex ALV grids, and secure web service integrations.',
    ],
    [
      'EMP011',
      'Jirayus',
      'Ant',
      'jirayus.a@largecorp.com',
      'ASD',
      'Unit D',
      'SAP ABAPER',
      'A2',
      'EMP010',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
      'Database Trainee (2024-2025)',
      'Core ERP developer in charge of performance tuning SQL queries, smartforms customization, and functional diagnostics.',
    ],
    [
      'EMP012',
      'Jeeravich',
      'Gap',
      'jeeravich.g@largecorp.com',
      'ASD',
      'Unit D',
      'SAP ABAPER',
      'A2',
      'EMP011',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200',
      'Tech Intern (2025)',
      'Develops modular extensions and business logic mapping scripts within SAP NetWeaver environments.',
    ],
    [
      'EMP013',
      'Pattarawan',
      'Ploy',
      'pattarawan.p@largecorp.com',
      'CPO',
      'PMO',
      'Project Coordinator',
      'B1',
      'EMP003',
      'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=200',
      'Operations Analyst (2023-2025)',
      'Coordinates cross-departmental operations and handles executive summary reporting streams.',
    ],
    [
      'EMP014',
      'Worawut',
      'Nut',
      'worawut.n@largecorp.com',
      'DGE',
      'Frontend',
      'React Developer',
      'A3',
      'EMP004',
      'https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&q=80&w=200',
      'Frontend Junior (2024-2025)',
      'Engineers clean, fast, and accessible user experiences utilizing modern React, Vite, and Tailwind.',
    ],
    [
      'EMP015',
      'Kittisak',
      'Tee',
      'kittisak.t@largecorp.com',
      'DGE',
      'Platform',
      'DevOps Architect',
      'B4',
      'EMP004',
      'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&q=80&w=200',
      'Lead Sysops (2021-2023); Linux Engineer (2019-2021)',
      'Architects CI/CD pipelines, Kubernetes microservice clusters, and auto-scaling cloud topologies.',
    ],
    [
      'EMP016',
      'Siriwan',
      'Ice',
      'siriwan.i@largecorp.com',
      'DGI',
      'Security',
      'Security Engineer',
      'B1',
      'EMP005',
      'https://images.unsplash.com/photo-1534751516642-a131fed10495?auto=format&fit=crop&q=80&w=200',
      'Risk Assessor (2024-2025)',
      'Monitors cyber threat matrices, manages security posture tools, and performs compliance scanning campaigns.',
    ],
  ];

  const allRows = [headers, ...demoEmployees];

  // 3. Write data to Sheet1
  const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`;
  const writeResponse = await fetch(writeUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: `${sheetName}!A1`,
      majorDimension: 'ROWS',
      values: allRows,
    }),
  });

  if (!writeResponse.ok) {
    throw new Error(await formatGoogleApiError(writeResponse, 'Failed to write demo data'));
  }

  return { spreadsheetId };
}
