import React, { useMemo, useState, useCallback } from 'react';
import { Employee } from '../types';
import { ChevronDown, ChevronUp, Users, AlertCircle, GripVertical, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.1;

interface OrgTreeProps {
  employees: Employee[];
  searchQuery: string;
  selectedDepartment: string;
  expandedNodeIds: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  onSelectEmployee: (emp: Employee) => void;
  onSelectGrade: (grade: string) => void;
  onReassignManager: (draggedId: string, targetId: string) => Promise<void>;
  isAdmin: boolean;
}

export default function OrgTree({
  employees,
  searchQuery,
  selectedDepartment,
  expandedNodeIds,
  onToggleExpand,
  onSelectEmployee,
  onSelectGrade,
  onReassignManager,
  isAdmin,
}: OrgTreeProps) {
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));

  const handleZoomIn = () => setZoom((prev) => clampZoom(prev + ZOOM_STEP));
  const handleZoomOut = () => setZoom((prev) => clampZoom(prev - ZOOM_STEP));
  const handleZoomReset = () => setZoom(1);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((prev) => clampZoom(prev + delta));
  }, []);

  const employeePool = useMemo(() => {
    if (!selectedDepartment) return employees;
    return employees.filter((emp) => emp.department === selectedDepartment);
  }, [employees, selectedDepartment]);

  const employeePoolIds = useMemo(
    () => new Set(employeePool.map((emp) => emp.id)),
    [employeePool]
  );

  // Roots are employees with no manager, or whose manager is outside the current pool.
  const rootEmployees = useMemo(
    () =>
      employeePool.filter((emp) => {
        if (!emp.reportsToId) return true;
        return !employeePoolIds.has(emp.reportsToId);
      }),
    [employeePool, employeePoolIds]
  );

  // Cycle prevention helper
  const isDescendant = (employeeId: string, prospectiveManagerId: string): boolean => {
    if (!prospectiveManagerId) return false;
    if (employeeId === prospectiveManagerId) return true;
    const prospectiveManager = employeePool.find((emp) => emp.id === prospectiveManagerId);
    if (!prospectiveManager) return false;
    return isDescendant(employeeId, prospectiveManager.reportsToId);
  };

  // Helper to count total team members under a node recursively
  const getSubordinateCount = (managerId: string): number => {
    const direct = employeePool.filter((emp) => emp.reportsToId === managerId);
    let total = direct.length;
    for (const sub of direct) {
      total += getSubordinateCount(sub.id);
    }
    return total;
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!isAdmin) return;
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    if (!isAdmin) return;
    e.preventDefault();
    const draggedId = e.dataTransfer.types.includes('text/plain') ? 'valid' : '';
    if (draggedId && targetId !== e.dataTransfer.getData('text/plain') && !isDescendant(e.dataTransfer.getData('text/plain'), targetId)) {
      setDragOverNodeId(targetId);
    }
  };

  const handleDragLeave = () => {
    setDragOverNodeId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    if (!isAdmin) return;
    e.preventDefault();
    setDragOverNodeId(null);
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetId) return;

    // Check circular references
    if (isDescendant(draggedId, targetId)) {
      alert('Circular structure prevented! A manager cannot report to their own subordinate.');
      return;
    }

    await onReassignManager(draggedId, targetId);
  };

  // Determine if employee matches search or department filters
  const matchesFilter = (emp: Employee): boolean => {
    // Check search query
    const searchLower = searchQuery.toLowerCase();
    const nameMatch = emp.name.toLowerCase().includes(searchLower);
    const nicknameMatch = emp.nickname.toLowerCase().includes(searchLower);
    const idMatch = emp.id.toLowerCase().includes(searchLower);
    const roleMatch = emp.role.toLowerCase().includes(searchLower);
    const matchesSearch = !searchQuery || nameMatch || nicknameMatch || idMatch || roleMatch;
    return matchesSearch;
  };

  // Helper to check if any descendant of a node matches search filters (to auto-reveal)
  const hasMatchingDescendant = (id: string): boolean => {
    const children = employeePool.filter((emp) => emp.reportsToId === id);
    for (const child of children) {
      if (matchesFilter(child) || hasMatchingDescendant(child.id)) {
        return true;
      }
    }
    return false;
  };

  // Render a single node card in the org tree
  const getCardBorderClass = (emp: Employee) => {
    const gradeLower = emp.grade.toLowerCase();
    if (emp.id === 'EMP001' || gradeLower === 'ec') {
      return 'border-vibrant-peach';
    } else if (['dvm', 'ho'].includes(gradeLower)) {
      return 'border-vibrant-sky';
    } else if (gradeLower === 'um') {
      return 'border-vibrant-sage';
    } else {
      return 'border-vibrant-pastel-blue';
    }
  };

  const renderNodeCard = (emp: Employee) => {
    const directChildren = employeePool.filter((child) => child.reportsToId === emp.id);
    const isExpanded = expandedNodeIds[emp.id] !== false; // defaults to true
    const totalTeamCount = getSubordinateCount(emp.id);
    const isMatched = matchesFilter(emp);
    const isTargetOfDrag = dragOverNodeId === emp.id;

    // Highlights based on query
    const hasActiveHighlight = searchQuery && isMatched;

    return (
      <div className="flex flex-col items-center">
        {/* Node Card wrapper with drag handlers */}
        <div
          draggable={isAdmin && emp.id !== 'EMP001'} // Let's keep Board root static
          onDragStart={(e) => handleDragStart(e, emp.id)}
          onDragOver={(e) => handleDragOver(e, emp.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, emp.id)}
          onClick={() => onSelectEmployee(emp)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelectGrade(emp.grade);
          }}
          title="Right-click to view all staff with the same grade"
          className={`relative group flex flex-col items-center text-center p-4 rounded-[2rem] w-48 sm:w-52 transition-all duration-300 border-4 cursor-pointer shadow-sm bg-white
            ${getCardBorderClass(emp)}
            ${hasActiveHighlight ? 'ring-4 ring-vibrant-yellow scale-105 z-10' : ''}
            ${isTargetOfDrag ? 'bg-vibrant-cream border-dashed scale-105' : 'hover:scale-[1.02] hover:shadow-md'}
          `}
        >
          {/* Admin Drag Handle icon on hover */}
          {isAdmin && emp.id !== 'EMP001' && (
            <div className="absolute top-3 left-3 p-1 text-slate-300 group-hover:text-vibrant-dark opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Employee Avatar Circle */}
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white mx-auto shadow-sm mb-2.5 relative">
            <img
              src={emp.photoUrl}
              alt={emp.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emp.name)}`;
              }}
            />
          </div>

          {/* Title or Division */}
          <h3 className="font-display font-black text-[10px] text-slate-400 uppercase tracking-tighter truncate max-w-full">
            {emp.role.includes('Manager') || emp.role.includes('Director') || emp.role.includes('Committee') ? emp.department : emp.role}
          </h3>

          {/* Employee Name */}
          <p className="font-sans font-black text-sm text-vibrant-dark mt-1 truncate max-w-full">
            {emp.name}
            {emp.nickname && (
              <span className="font-bold text-xs text-slate-400 ml-1">({emp.nickname})</span>
            )}
          </p>

          {/* Grade Badge */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectGrade(emp.grade);
            }}
            className="mt-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-vibrant-sky/40 text-[10px] font-black text-slate-500 uppercase transition-colors"
            title={`View all ${emp.grade} staff`}
          >
            {emp.grade}
          </button>

          {/* Member Counts */}
          {totalTeamCount > 0 && (
            <span className="mt-2 text-[10px] text-slate-400 font-bold flex items-center gap-1">
              <Users className="w-3 h-3" /> {totalTeamCount} members
            </span>
          )}

          {/* Expand/Collapse Toggle Indicator Button */}
          {directChildren.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(emp.id);
              }}
              className="absolute -bottom-3 bg-white border-2 border-vibrant-yellow text-slate-400 hover:text-vibrant-dark hover:border-vibrant-pastel-blue p-1 rounded-full shadow-sm transition-all"
            >
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Tree Connectors & Children Rendering */}
        {directChildren.length > 0 && isExpanded && (
          <div className="flex flex-col items-center mt-6 w-full relative">
            {/* Vertical connector line straight down from card to horizontal row */}
            <div className="w-0.5 h-6 bg-vibrant-yellow absolute top-[-24px] left-1/2 -translate-x-1/2" />

            {/* Horizontal branch span row */}
            <div className="flex justify-center gap-x-8 gap-y-12 pt-4 relative w-full flex-wrap md:flex-nowrap">
              {/* Horizontal bar connecting children */}
              {directChildren.length > 1 && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-vibrant-yellow mx-auto w-[calc(100%-12rem)] hidden md:block" />
              )}

              {directChildren.map((child) => {
                return (
                  <div key={child.id} className="relative flex flex-col items-center">
                    {/* Vertical connector straight up to horizontal bar */}
                    <div className="w-0.5 h-4 bg-vibrant-yellow absolute top-[-16px] left-1/2 -translate-x-1/2 hidden md:block" />
                    {renderTreeBranch(child)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTreeBranch = (emp: Employee) => {
    // Check if branch contains searches to auto-reveal
    const hasMatchedChild = searchQuery && (matchesFilter(emp) || hasMatchingDescendant(emp.id));
    if (searchQuery && !hasMatchedChild && !matchesFilter(emp)) {
      return null; // hide branch if nothing matches query
    }
    return renderNodeCard(emp);
  };

  return (
    <div className="relative h-full w-full" id="org-tree-stage">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-white border-2 border-vibrant-yellow rounded-xl p-1 shadow-sm">
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoom <= MIN_ZOOM}
          title="Zoom out"
          className="p-2 rounded-lg text-vibrant-dark hover:bg-vibrant-cream transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          title="Reset zoom"
          className="min-w-[3.25rem] px-2 py-1.5 text-[11px] font-black text-vibrant-dark hover:bg-vibrant-cream rounded-lg transition-all"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoom >= MAX_ZOOM}
          title="Zoom in"
          className="p-2 rounded-lg text-vibrant-dark hover:bg-vibrant-cream transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          title="Reset to 100%"
          className="p-2 rounded-lg text-slate-400 hover:text-vibrant-dark hover:bg-vibrant-cream transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className="h-full w-full overflow-auto overscroll-contain"
        id="org-tree-canvas"
        onWheel={handleWheel}
      >
      {employeePool.length === 0 ? (
        <div className="text-center py-16 text-[#A88C7D] flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 stroke-1 opacity-60" />
          <div>
            <p className="text-base font-semibold">
              {selectedDepartment ? `No employees found in ${selectedDepartment}` : 'No Organization Data Detected'}
            </p>
            <p className="text-xs max-w-sm mt-1">
              {selectedDepartment
                ? 'Try selecting a different department or clear the department filter.'
                : "Please connect a valid Google Sheet or click the 'Create Sample Sheet' button above to seed the corporation's chart."}
            </p>
          </div>
        </div>
      ) : rootEmployees.length === 0 ? (
        <div className="text-center py-16 text-[#A88C7D] flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 stroke-1 opacity-60" />
          <div>
            <p className="text-base font-semibold">No Organization Data Detected</p>
            <p className="text-xs max-w-sm mt-1">Please connect a valid Google Sheet or click the 'Create Sample Sheet' button above to seed the corporation's chart.</p>
          </div>
        </div>
      ) : (
        <div
          className="table mx-auto py-8 px-12 pb-16"
          style={{ zoom }}
        >
          <div className="flex flex-col items-center gap-16">
          {rootEmployees.map((root) => (
            <div key={root.id} className="flex flex-col items-center">
              {renderTreeBranch(root)}
            </div>
          ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
