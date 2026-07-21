import React from 'react';
import { Employee } from '../types';
import { Users, Briefcase, Award, FolderTree } from 'lucide-react';

interface StatSummaryProps {
  employees: Employee[];
}

export default function StatSummary({ employees }: StatSummaryProps) {
  const totalCount = employees.length;

  // Department counts
  const departmentStats = employees.reduce((acc, curr) => {
    acc[curr.department] = (acc[curr.department] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Unit counts (department / unit)
  const unitStats = employees.reduce((acc, curr) => {
    if (!curr.unit) return acc;
    const key = curr.department ? `${curr.department} / ${curr.unit}` : curr.unit;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Grade counts
  const gradeStats = employees.reduce((acc, curr) => {
    acc[curr.grade] = (acc[curr.grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedDeps = Object.entries(departmentStats).sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })
  );
  const sortedGrades = Object.entries(gradeStats).sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })
  );
  const sortedUnits = Object.entries(unitStats).sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { sensitivity: 'base' })
  );

  return (
    <div className="bg-white/70 border-2 border-vibrant-yellow rounded-[2rem] p-6 shadow-sm mb-6 animate-fade-in" id="stat-summary">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Total stats */}
        <div className="bg-white p-5 rounded-[2rem] border-2 border-vibrant-peach flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-vibrant-peach/20 text-vibrant-peach rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">TOTAL PERSONNEL</p>
            <p className="text-3xl font-display font-black text-vibrant-dark">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border-2 border-vibrant-sky flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-vibrant-sky/20 text-[#3a8baf] rounded-2xl">
            <FolderTree className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">DEPARTMENTS</p>
            <p className="text-3xl font-display font-black text-vibrant-dark">{Object.keys(departmentStats).length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border-2 border-vibrant-sage flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-vibrant-sage/30 text-[#558B2F] rounded-2xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">POSITION GRADES</p>
            <p className="text-3xl font-display font-black text-vibrant-dark">{Object.keys(gradeStats).length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[2rem] border-2 border-vibrant-pastel-blue flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-vibrant-pastel-blue/20 text-[#5d8b9d] rounded-2xl">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">UNITS</p>
            <p className="text-3xl font-display font-black text-vibrant-dark">{Object.keys(unitStats).length}</p>
          </div>
        </div>

      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        
        {/* Department Breakdowns */}
        <div className="bg-white p-5 rounded-[2rem] border-2 border-vibrant-yellow shadow-sm">
          <h4 className="font-display font-black text-sm text-vibrant-dark mb-4 border-b-2 border-vibrant-cream pb-2">Department Breakdown</h4>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {sortedDeps.map(([dep, count]) => {
              const pct = totalCount ? Math.round((count / totalCount) * 100) : 0;
              return (
                <div key={dep} className="text-xs">
                  <div className="flex justify-between text-vibrant-dark mb-1 font-bold">
                    <span>{dep || 'General'}</span>
                    <span className="text-slate-400">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-[#F3F4F6] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-vibrant-sky h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grade Breakdowns */}
        <div className="bg-white p-5 rounded-[2rem] border-2 border-vibrant-yellow shadow-sm">
          <h4 className="font-display font-black text-sm text-vibrant-dark mb-4 border-b-2 border-vibrant-cream pb-2">Grades Breakdown</h4>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {sortedGrades.map(([grade, count]) => {
              const pct = totalCount ? Math.round((count / totalCount) * 100) : 0;
              return (
                <div key={grade} className="text-xs">
                  <div className="flex justify-between items-center text-vibrant-dark mb-1.5 font-bold">
                    <span className="uppercase font-black text-[#5d8b9d] bg-vibrant-pastel-blue/20 px-2 py-0.5 rounded-lg text-[10px]">{grade || 'N/A'}</span>
                    <span className="text-slate-400">{count} employees</span>
                  </div>
                  <div className="w-full bg-[#F3F4F6] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-vibrant-peach h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unit Breakdown */}
        <div className="bg-white p-5 rounded-[2rem] border-2 border-vibrant-yellow shadow-sm">
          <h4 className="font-display font-black text-sm text-vibrant-dark mb-4 border-b-2 border-vibrant-cream pb-2">Unit Breakdown</h4>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {sortedUnits.map(([unit, count]) => {
              const pct = totalCount ? Math.round((count / totalCount) * 100) : 0;
              return (
                <div key={unit} className="text-xs">
                  <div className="flex justify-between text-vibrant-dark mb-1 font-bold">
                    <span className="truncate max-w-[180px]">{unit}</span>
                    <span className="text-slate-400">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-[#F3F4F6] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-vibrant-sage h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
