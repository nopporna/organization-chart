import React, { useState, useEffect } from 'react';
import { Employee, OrgNode } from './types';
import { initAuth, getAccessToken, setAccessToken, AuthUser } from './lib/auth';
import { fetchEmployeesFromSheet, updateEmployeeReportsTo, updateEmployeeRow, addEmployeeRow, deleteEmployeeRow, getSpreadsheetDetails, resolveSpreadsheetId } from './lib/sheets';
import AuthBanner from './components/AuthBanner';
import StatSummary from './components/StatSummary';
import OrgTree from './components/OrgTree';
import EmployeeDrawer from './components/EmployeeDrawer';
import GradeDrawer from './components/GradeDrawer';
import { Search, ChevronDown, ChevronUp, Layers, UserPlus, RefreshCw, AlertCircle, PlusCircle, Check } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  
  const [spreadsheetId, setSpreadsheetId] = useState(() => resolveSpreadsheetId());
  const [spreadsheetTitle, setSpreadsheetTitle] = useState('');
  const [sheetName, setSheetName] = useState('Sheet1');
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rawSheetRows, setRawSheetRows] = useState<string[][]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  // Filtering and Views
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  // Active drawers
  const [activeEmployee, setActiveEmployee] = useState<Employee | null>(null);
  const [activeGrade, setActiveGrade] = useState<string | null>(null);
  
  // Collapse state (Record<EmployeeID, isExpanded>)
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, boolean>>({});

  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = !!user && (
    adminEmails.length === 0 ||
    (!!user.email && adminEmails.includes(user.email.toLowerCase()))
  );
  const canViewData = !!user && !!accessToken;

  // Init Google Auth on load
  useEffect(() => {
    initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessTokenState(token);
        setAccessToken(token);
      },
      () => {
        setUser(null);
        setAccessTokenState(null);
        setEmployees([]);
        setRawSheetRows([]);
        setSpreadsheetTitle('');
        setSyncStatusMsg('');
      }
    );
  }, []);

  // Sync Google Sheet only after sign-in
  const loadSheetData = async (targetId = spreadsheetId, token: string | null = accessToken) => {
    if (!targetId || !token) return;
    setIsSyncing(true);
    setSyncStatusMsg('Syncing latest personnel data...');
    try {
      const details = await getSpreadsheetDetails(targetId, token);
      setSpreadsheetTitle(details.title);
      setSheetName(details.firstSheetName);
      localStorage.setItem('org_sheet_name', details.firstSheetName);

      const { employees: fetchedList, rawRows } = await fetchEmployeesFromSheet(
        targetId,
        details.firstSheetName,
        token
      );
      if (fetchedList.length > 0) {
        setEmployees(fetchedList);
        setRawSheetRows(rawRows);
        setSyncStatusMsg('');
      } else {
        setEmployees([]);
        setRawSheetRows([]);
        setSyncStatusMsg('Sheet linked successfully, but no employees found.');
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatusMsg('Failed to fetch from Google Sheets: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!canViewData) {
      setEmployees([]);
      setRawSheetRows([]);
      setSpreadsheetTitle('');
      return;
    }
    if (!spreadsheetId) return;
    loadSheetData(spreadsheetId, accessToken);
  }, [spreadsheetId, accessToken, canViewData]);

  const handleSpreadsheetLinked = (id: string) => {
    setSpreadsheetId(id);
    localStorage.setItem('org_spreadsheet_id', id);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedNodeIds((prev) => ({
      ...prev,
      [id]: prev[id] === false,
    }));
  };

  const handleExpandAll = () => {
    const updated: Record<string, boolean> = {};
    employees.forEach((emp) => {
      updated[emp.id] = true;
    });
    setExpandedNodeIds(updated);
  };

  const handleCollapseAll = () => {
    const updated: Record<string, boolean> = {};
    employees.forEach((emp) => {
      updated[emp.id] = false;
    });
    setExpandedNodeIds(updated);
  };

  // Reassign Manager handler (Drag and Drop / Profile reassign)
  const handleReassignManager = async (draggedId: string, targetId: string) => {
    const dragged = employees.find((e) => e.id === draggedId);
    const target = employees.find((e) => e.id === targetId);
    if (!dragged || !target) return;

    const confirmed = window.confirm(
      `Confirm reporting structure update:\nMove ${dragged.name} (${dragged.role}) to report directly to ${target.name} (${target.role})?`
    );
    if (!confirmed) return;

    // Update locally first for instant lag-free feel
    const updatedList = employees.map((emp) => {
      if (emp.id === draggedId) {
        return { ...emp, reportsToId: targetId };
      }
      return emp;
    });
    setEmployees(updatedList);

    // Sync with Sheets
    if (spreadsheetId && accessToken) {
      setIsSyncing(true);
      try {
        const fetchedIndex = rawSheetRows.findIndex((row) => row[0] === draggedId);
        if (fetchedIndex !== -1) {
          await updateEmployeeReportsTo(spreadsheetId, sheetName, accessToken, fetchedIndex, targetId);
          await loadSheetData();
        }
      } catch (err: any) {
        alert('Failed to sync reporting line change to Google Sheets: ' + err.message);
        // rollback
        loadSheetData();
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Add or Update employee profile
  const handleUpdateEmployee = async (updatedEmp: Employee) => {
    const isNew = !employees.some((e) => e.id === updatedEmp.id);
    
    // Update locally first
    if (isNew) {
      setEmployees([...employees, updatedEmp]);
    } else {
      setEmployees(employees.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
    }

    if (spreadsheetId && accessToken) {
      setIsSyncing(true);
      try {
        if (isNew) {
          await addEmployeeRow(spreadsheetId, sheetName, accessToken, updatedEmp);
        } else {
          const index = rawSheetRows.findIndex((row) => row[0] === updatedEmp.id);
          if (index !== -1) {
            await updateEmployeeRow(spreadsheetId, sheetName, accessToken, index, updatedEmp);
          }
        }
        await loadSheetData();
      } catch (err: any) {
        alert('Failed to write changes to Google Sheets: ' + err.message);
        loadSheetData();
      } finally {
        setIsSyncing(false);
      }
    }

    // Keep active drawers up to date
    if (activeEmployee && activeEmployee.id === updatedEmp.id) {
      setActiveEmployee(updatedEmp);
    }
  };

  // Delete employee profile
  const handleDeleteEmployee = async (id: string) => {
    // Reconnect children to the deleted employee's manager
    const targetEmp = employees.find((e) => e.id === id);
    const newReportsTo = targetEmp ? targetEmp.reportsToId : '';

    const updatedList = employees
      .filter((e) => e.id !== id)
      .map((e) => {
        if (e.reportsToId === id) {
          return { ...e, reportsToId: newReportsTo };
        }
        return e;
      });

    setEmployees(updatedList);

    if (spreadsheetId && accessToken) {
      setIsSyncing(true);
      try {
        const index = rawSheetRows.findIndex((row) => row[0] === id);
        if (index !== -1) {
          await deleteEmployeeRow(spreadsheetId, sheetName, accessToken, index);
          
          // Also patch children in Sheets
          const childrenToPatch = employees.filter((e) => e.reportsToId === id);
          for (const child of childrenToPatch) {
            const childIdx = rawSheetRows.findIndex((row) => row[0] === child.id);
            if (childIdx !== -1) {
              await updateEmployeeReportsTo(spreadsheetId, sheetName, accessToken, childIdx, newReportsTo);
            }
          }
        }
        await loadSheetData();
      } catch (err: any) {
        alert('Failed to delete row in Google Sheets: ' + err.message);
        loadSheetData();
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleTriggerAddEmployee = () => {
    const nextIdNum = Math.max(...employees.map((e) => {
      const num = parseInt(e.id.replace('EMP', ''));
      return isNaN(num) ? 0 : num;
    })) + 1;
    const generatedId = `EMP${String(nextIdNum).padStart(3, '0')}`;

    const template: Employee = {
      id: generatedId,
      name: '',
      nickname: '',
      email: '',
      department: selectedDepartment || 'ASD',
      unit: selectedUnit || '',
      role: 'Consultant',
      grade: 'A1',
      reportsToId: employees[0]?.id || '',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      historicalTitles: [],
      bio: '',
    };

    setActiveEmployee(template);
  };

  const departmentsList = Array.from(new Set(employees.map((e) => e.department))).filter(Boolean);
  const unitsList = Array.from(
    new Set(
      employees
        .filter((e) => !selectedDepartment || e.department === selectedDepartment)
        .map((e) => e.unit)
    )
  ).filter(Boolean);

  return (
    <div className="min-h-screen bg-vibrant-cream font-sans text-vibrant-dark flex flex-col selection:bg-vibrant-yellow/40" id="app-root">
      
      {/* Top Google OAuth & Sync Connection Bar */}
      <AuthBanner
        user={user}
        isAdmin={isAdmin}
        accessToken={accessToken}
        spreadsheetId={spreadsheetId}
        spreadsheetTitle={spreadsheetTitle}
        isSyncing={isSyncing}
        onAuthSuccess={(u, t) => {
          setUser(u);
          setAccessTokenState(t);
          setAccessToken(t);
        }}
        onAuthLogout={() => {
          setUser(null);
          setAccessTokenState(null);
          setEmployees([]);
          setRawSheetRows([]);
          setSpreadsheetTitle('');
          setSyncStatusMsg('');
          setActiveEmployee(null);
          setActiveGrade(null);
        }}
        onSpreadsheetLinked={handleSpreadsheetLinked}
        onRefresh={() => loadSheetData(spreadsheetId, accessToken)}
      />

      {/* Main Body Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6">
        
        {/* Header Title Section */}
        <div className="text-center mb-8 relative">
          <h1 className="font-sans font-black text-3xl sm:text-4xl text-vibrant-dark tracking-tight uppercase">
            Organization Chart
          </h1>
          <p className="text-xs text-slate-400 font-black mt-1">
            {!canViewData
              ? 'Sign in to view the organization chart'
              : `${employees.length} employees${spreadsheetId ? ' (synced from Google Sheets)' : ''}`}
          </p>
          
          {/* Status logs */}
          {syncStatusMsg && (
            <p className="text-xs font-black text-vibrant-sky mt-2 flex items-center justify-center gap-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {syncStatusMsg}
            </p>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="bg-white border-2 border-vibrant-yellow rounded-[2rem] p-4 sm:p-5 shadow-sm mb-6 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Search and Department selection */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative flex-1 min-w-[240px] max-w-md bg-[#F3F4F6] border-2 border-transparent focus-within:border-vibrant-pastel-blue rounded-xl px-3 py-2 flex items-center gap-2 transition-all">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name / nickname / ID / role..."
                  className="w-full bg-transparent focus:outline-hidden text-xs text-vibrant-dark font-medium"
                />
              </div>

              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelectedUnit('');
                }}
                className="bg-[#F3F4F6] border-2 border-transparent focus:border-vibrant-pastel-blue rounded-xl px-3 py-2 text-xs font-bold text-vibrant-dark focus:outline-hidden cursor-pointer"
              >
                <option value="">All Departments</option>
                {departmentsList.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep} Department
                  </option>
                ))}
              </select>

              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="bg-[#F3F4F6] border-2 border-transparent focus:border-vibrant-pastel-blue rounded-xl px-3 py-2 text-xs font-bold text-vibrant-dark focus:outline-hidden cursor-pointer"
              >
                <option value="">All Units</option>
                {unitsList.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExpandAll}
                  className="bg-white hover:bg-vibrant-cream text-vibrant-dark text-xs font-bold px-3 py-2 rounded-xl border-2 border-vibrant-yellow shadow-3xs transition-all"
                >
                  Expand All
                </button>
                <button
                  onClick={handleCollapseAll}
                  className="bg-white hover:bg-vibrant-cream text-vibrant-dark text-xs font-bold px-3 py-2 rounded-xl border-2 border-vibrant-yellow shadow-3xs transition-all"
                >
                  Collapse All
                </button>
              </div>

              {isAdmin && (
                <button
                  onClick={handleTriggerAddEmployee}
                  className="flex items-center gap-1.5 bg-vibrant-peach hover:bg-[#FFA5A0] text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-sm ml-auto lg:ml-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Personnel
                </button>
              )}
            </div>

          </div>

          {/* Toggle Collapsible Board Summary */}
          <div className="border-t-2 border-vibrant-cream pt-3 flex justify-center">
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="flex items-center gap-1.5 text-xs font-black text-slate-400 hover:text-vibrant-dark transition-colors"
            >
              {showSummary ? (
                <>
                  <ChevronUp className="w-4 h-4" /> Hide Corporate Summary
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" /> Show Corporate Summary
                </>
              )}
            </button>
          </div>
        </div>

        {/* Statistics Board Panel */}
        {showSummary && <StatSummary employees={employees} />}

        {/* Tree Content Stage */}
        <div className="bg-white border-2 border-vibrant-yellow rounded-[2.5rem] min-h-[500px] h-[calc(100vh-12rem)] shadow-sm flex flex-col">
          <OrgTree
            employees={employees}
            searchQuery={searchQuery}
            selectedDepartment={selectedDepartment}
            selectedUnit={selectedUnit}
            expandedNodeIds={expandedNodeIds}
            onToggleExpand={handleToggleExpand}
            onSelectEmployee={(emp) => {
              setActiveEmployee(emp);
              setActiveGrade(null);
            }}
            onSelectGrade={(grade) => {
              setActiveGrade(grade);
              setActiveEmployee(null);
            }}
            onReassignManager={handleReassignManager}
            isAdmin={isAdmin}
          />
        </div>

      </main>

      {/* Floating Instructions/Tips */}
      <footer className="py-6 border-t-2 border-vibrant-yellow bg-vibrant-cream text-center text-xs text-slate-500 font-bold">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-black text-vibrant-dark">💡 Interactive Quick Tips</p>
          <p className="mt-1 max-w-xl mx-auto font-medium text-slate-400">
            {!canViewData ? (
              'Sign in with Google to view the organization chart. Admins can edit and sync changes to Google Sheets.'
            ) : isAdmin ? (
              'Drag any employee node and drop them onto another card to reassign reporting structures. Right-click a card to view staff with the same grade.'
            ) : (
              'View-only mode. Right-click a card to view staff with the same grade. Contact an admin to make changes.'
            )}
          </p>
        </div>
      </footer>

      {/* Interactive Profile Drawer */}
      <EmployeeDrawer
        employee={activeEmployee}
        employees={employees}
        isAdmin={isAdmin}
        onClose={() => setActiveEmployee(null)}
        onUpdate={handleUpdateEmployee}
        onDelete={handleDeleteEmployee}
        onSelectEmployee={(emp) => {
          setActiveEmployee(emp);
          setActiveGrade(null);
        }}
      />

      {/* Grade Side Drawer list */}
      <GradeDrawer
        grade={activeGrade}
        employees={employees}
        selectedDepartment={selectedDepartment}
        selectedUnit={selectedUnit}
        onClose={() => setActiveGrade(null)}
        onSelectEmployee={(emp) => {
          setActiveEmployee(emp);
          setActiveGrade(null);
        }}
      />

    </div>
  );
}
