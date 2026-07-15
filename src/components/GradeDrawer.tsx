import React from 'react';
import { Employee } from '../types';
import { X, Award, MapPin, Mail, ArrowRight, User } from 'lucide-react';

interface GradeDrawerProps {
  grade: string | null;
  employees: Employee[];
  selectedDepartment?: string;
  onClose: () => void;
  onSelectEmployee: (emp: Employee) => void;
}

export default function GradeDrawer({ grade, employees, selectedDepartment = '', onClose, onSelectEmployee }: GradeDrawerProps) {
  if (!grade) return null;

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.grade.toLowerCase() === grade.toLowerCase() &&
      (!selectedDepartment || emp.department === selectedDepartment)
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end" id="grade-drawer">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-in-right border-l-2 border-vibrant-yellow">
        
        {/* Drawer Header */}
        <div className="bg-vibrant-cream px-6 py-5 border-b-2 border-vibrant-yellow flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-vibrant-pastel-blue text-white rounded-xl shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-vibrant-dark">
                Grade Position <span className="uppercase text-[#5d8b9d] font-black">{grade}</span>
              </h3>
              <p className="text-xs text-slate-400 font-bold">
                {filteredEmployees.length} {filteredEmployees.length === 1 ? 'employee' : 'employees'}
                {selectedDepartment ? ` in ${selectedDepartment}` : ''} at this grade level
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-vibrant-yellow/30 text-slate-400 hover:text-vibrant-dark transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-3 font-bold">
              <Award className="w-12 h-12 stroke-1 opacity-50" />
              <p className="text-sm">No active employees assigned to this grade.</p>
            </div>
          ) : (
            filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                onClick={() => onSelectEmployee(emp)}
                className="group relative bg-white hover:bg-vibrant-cream border-2 border-vibrant-yellow hover:border-vibrant-pastel-blue p-4 rounded-[2rem] cursor-pointer transition-all duration-200 shadow-2xs flex gap-4"
              >
                {/* Employee Photo */}
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white flex-shrink-0 bg-white shadow-sm ring-2 ring-vibrant-pastel-blue">
                  {emp.photoUrl ? (
                    <img
                      src={emp.photoUrl}
                      alt={emp.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(emp.name)}`;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-vibrant-cream text-vibrant-pastel-blue font-black text-sm">
                      {emp.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-sans font-black text-sm text-vibrant-dark truncate group-hover:text-vibrant-pastel-blue transition-colors">
                      {emp.name}
                    </h4>
                    {emp.nickname && (
                      <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm font-bold">
                        ({emp.nickname})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">{emp.role}</p>
                  
                  <div className="mt-2.5 space-y-1.5 font-bold">
                    <div className="flex items-center gap-1.5 text-[11px] text-vibrant-dark">
                      <MapPin className="w-3 h-3 text-vibrant-sky" />
                      <span className="truncate">{emp.department}</span>
                    </div>
                    {emp.email && (
                      <div className="flex items-center gap-1.5 text-[11px] text-vibrant-dark">
                        <Mail className="w-3 h-3 text-vibrant-peach" />
                        <span className="truncate">{emp.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow Right Indicator */}
                <div className="self-center p-1.5 rounded-full bg-white group-hover:bg-vibrant-pastel-blue text-slate-400 group-hover:text-white border-2 border-vibrant-yellow group-hover:border-vibrant-pastel-blue transition-all shadow-3xs">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
