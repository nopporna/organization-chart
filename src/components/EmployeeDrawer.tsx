import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import { X, Mail, MapPin, Award, User, Layers, Calendar, Edit3, Save, Trash2, ChevronRight, AlertCircle, Plus } from 'lucide-react';

interface EmployeeDrawerProps {
  employee: Employee | null;
  employees: Employee[];
  isAdmin: boolean;
  onClose: () => void;
  onUpdate: (updated: Employee) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelectEmployee: (emp: Employee) => void;
}

export default function EmployeeDrawer({
  employee,
  employees,
  isAdmin,
  onClose,
  onUpdate,
  onDelete,
  onSelectEmployee,
}: EmployeeDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({});
  const [newTitle, setNewTitle] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        ...employee,
        historicalTitles: [...employee.historicalTitles],
      });
      setIsEditing(false);
      setErrorMsg('');
    }
  }, [employee]);

  if (!employee) return null;

  const directManager = employees.find((emp) => emp.id === employee.reportsToId);
  const directReports = employees.filter((emp) => emp.reportsToId === employee.id);

  // Cycle check helper: returns true if prospectiveManagerId is a descendant of employeeId
  const isDescendant = (employeeId: string, prospectiveManagerId: string): boolean => {
    if (!prospectiveManagerId) return false;
    if (employeeId === prospectiveManagerId) return true;
    const prospectiveManager = employees.find(emp => emp.id === prospectiveManagerId);
    if (!prospectiveManager) return false;
    return isDescendant(employeeId, prospectiveManager.reportsToId);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSaving(true);

    try {
      const updatedEmp: Employee = {
        id: employee.id,
        name: formData.name || '',
        nickname: formData.nickname || '',
        email: formData.email || '',
        department: formData.department || '',
        role: formData.role || '',
        grade: formData.grade || '',
        reportsToId: formData.reportsToId || '',
        photoUrl: formData.photoUrl || '',
        historicalTitles: formData.historicalTitles || [],
        bio: formData.bio || '',
      };

      if (!updatedEmp.name.trim()) {
        throw new Error('Name is required');
      }

      // Cycle verification
      if (updatedEmp.reportsToId && isDescendant(employee.id, updatedEmp.reportsToId)) {
        throw new Error('Circular reporting structure detected! A manager cannot report to their own direct or indirect subordinates.');
      }

      await onUpdate(updatedEmp);
      setIsEditing(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update employee');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${employee.name} from the organization chart? This will also disconnect their reporting lines.`
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await onDelete(employee.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete employee');
    } finally {
      setIsSaving(false);
    }
  };

  const addHistoricalTitle = () => {
    if (newTitle.trim() && formData.historicalTitles) {
      setFormData({
        ...formData,
        historicalTitles: [newTitle.trim(), ...formData.historicalTitles],
      });
      setNewTitle('');
    }
  };

  const removeHistoricalTitle = (index: number) => {
    if (formData.historicalTitles) {
      const filtered = formData.historicalTitles.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        historicalTitles: filtered,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end" id="employee-drawer">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-in-right border-l-2 border-vibrant-yellow">
        
        {/* Header */}
        <div className="bg-vibrant-cream px-6 py-5 border-b-2 border-vibrant-yellow flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-vibrant-peach text-white rounded-xl shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-vibrant-dark">
                {isEditing ? 'Edit Personnel Profile' : 'Personnel Profile'}
              </h3>
              <p className="text-xs text-slate-400 font-bold">ID: {employee.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 bg-vibrant-peach/25 hover:bg-vibrant-peach/35 text-vibrant-peach text-xs font-black px-3 py-2 rounded-xl border border-vibrant-peach/30 transition-all shadow-3xs"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-vibrant-yellow/30 text-slate-400 hover:text-vibrant-dark transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
          
          {errorMsg && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 p-3 rounded-xl flex items-start gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isEditing ? (
            /* ================= EDIT MODE FORM ================= */
            <form onSubmit={handleSave} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#F3F4F6] border-2 border-transparent focus:border-vibrant-pastel-blue rounded-xl px-3 py-2 text-xs text-vibrant-dark focus:outline-hidden font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Nickname</label>
                  <input
                    type="text"
                    value={formData.nickname || ''}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    className="w-full bg-[#F3F4F6] border-2 border-transparent focus:border-vibrant-pastel-blue rounded-xl px-3 py-2 text-xs text-vibrant-dark focus:outline-hidden font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Corporate Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[#F3F4F6] border-2 border-transparent focus:border-vibrant-pastel-blue rounded-xl px-3 py-2 text-xs text-vibrant-dark focus:outline-hidden font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. ASD, CPO, DGE"
                    className="w-full bg-[#F3F4F6] border-2 border-transparent focus:border-vibrant-pastel-blue rounded-xl px-3 py-2 text-xs text-vibrant-dark focus:outline-hidden font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Grade Level</label>
                  <input
                    type="text"
                    value={formData.grade || ''}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    placeholder="e.g. A1, A2, B1, UM, DVM"
                    className="w-full bg-[#F3F4F6] border-2 border-transparent focus:border-vibrant-pastel-blue rounded-xl px-3 py-2 text-xs text-vibrant-dark focus:outline-hidden font-black uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Job Title / Role</label>
                <input
                  type="text"
                  value={formData.role || ''}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-[#F3F4F6] border-2 border-transparent focus:border-vibrant-pastel-blue rounded-xl px-3 py-2 text-xs text-vibrant-dark focus:outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Avatar / Photo URL</label>
                <input
                  type="url"
                  value={formData.photoUrl || ''}
                  onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#F3F4F6] border-2 border-transparent focus:border-vibrant-pastel-blue rounded-xl px-3 py-2 text-xs text-vibrant-dark focus:outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Reports To (Direct Manager)</label>
                <select
                  value={formData.reportsToId || ''}
                  onChange={(e) => setFormData({ ...formData, reportsToId: e.target.value })}
                  className="w-full bg-[#F3F4F6] border-2 border-transparent focus:border-vibrant-pastel-blue rounded-xl px-3 py-2 text-xs text-vibrant-dark focus:outline-hidden font-bold"
                >
                  <option value="">-- No Direct Supervisor (Root Level) --</option>
                  {employees
                    .filter((emp) => emp.id !== employee.id) // cannot report to self
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {emp.nickname ? `(${emp.nickname})` : ''} - {emp.role} [{emp.id}]
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Biography</label>
                <textarea
                  rows={3}
                  value={formData.bio || ''}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full bg-[#F3F4F6] border-2 border-transparent focus:border-vibrant-pastel-blue rounded-xl px-3 py-2 text-xs text-vibrant-dark focus:outline-hidden font-medium"
                />
              </div>

              {/* Historical Job Titles Timeline Build */}
              <div className="border-2 border-vibrant-yellow p-4 rounded-[1.5rem] bg-vibrant-cream/50">
                <label className="block text-xs font-black text-vibrant-dark mb-2 uppercase tracking-wide">Job History Timeline</label>
                
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="e.g. Senior Lead Specialist (2022-2024)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="flex-1 bg-white border-2 border-vibrant-yellow rounded-xl px-3 py-1.5 text-xs text-vibrant-dark focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={addHistoricalTitle}
                    className="bg-vibrant-pastel-blue hover:bg-[#9cb5be] text-white text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {formData.historicalTitles?.map((title, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white border-2 border-vibrant-yellow px-3 py-1.5 rounded-xl text-xs">
                      <span className="text-vibrant-dark font-bold">{title}</span>
                      <button
                        type="button"
                        onClick={() => removeHistoricalTitle(idx)}
                        className="text-red-500 hover:text-red-700 text-xs font-black"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {(!formData.historicalTitles || formData.historicalTitles.length === 0) && (
                    <p className="text-[11px] text-slate-400 italic">No historical job titles listed yet.</p>
                  )}
                </div>
              </div>

              {/* Form Operations */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t-2 border-vibrant-cream">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="flex items-center gap-1 text-red-600 hover:bg-red-50 hover:text-red-800 text-xs font-black px-3 py-2 rounded-xl border-2 border-red-100 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                    className="bg-white hover:bg-vibrant-cream text-slate-500 hover:text-vibrant-dark text-xs font-bold px-4 py-2 rounded-xl border-2 border-vibrant-yellow transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-1 bg-vibrant-peach hover:bg-[#FFA5A0] text-white text-xs font-black px-5 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>

            </form>
          ) : (
            /* ================= VIEW PROFILE MODE ================= */
            <div className="space-y-6">
              
              {/* Profile Card Header */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-white border-2 border-vibrant-yellow p-5 rounded-[2rem] shadow-sm">
                {/* Photo */}
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white bg-white flex-shrink-0 shadow-md ring-4 ring-vibrant-peach">
                  {employee.photoUrl ? (
                    <img
                      src={employee.photoUrl}
                      alt={employee.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(employee.name)}`;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-vibrant-cream text-vibrant-peach font-black text-2xl">
                      {employee.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Profile Meta details */}
                <div className="text-center sm:text-left flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="font-display font-black text-xl text-vibrant-dark">
                      {employee.name}
                    </h2>
                    {employee.nickname && (
                      <span className="text-xs text-vibrant-peach bg-vibrant-peach/20 font-black px-2.5 py-0.5 rounded-full border border-vibrant-peach/30">
                        {employee.nickname}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 font-bold mt-0.5">{employee.role}</p>
                  
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-vibrant-dark font-bold">
                    <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                      <MapPin className="w-3.5 h-3.5 text-vibrant-sky" />
                      <span>{employee.department}</span>
                    </div>
                    <div className="flex items-center gap-1 uppercase font-black text-[#5d8b9d] bg-vibrant-pastel-blue/20 px-2.5 py-0.5 rounded-full border border-vibrant-pastel-blue/30 text-[10px]">
                      <Award className="w-3 h-3 text-[#5d8b9d]" />
                      <span>{employee.grade}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio and Contact Info */}
              <div className="space-y-3">
                {employee.email && (
                  <div className="flex items-center gap-2.5 text-xs text-vibrant-dark bg-white p-3 rounded-[1.5rem] border-2 border-vibrant-yellow shadow-2xs">
                    <Mail className="w-4 h-4 text-vibrant-sky" />
                    <span className="font-black text-slate-400">Email:</span>
                    <a href={`mailto:${employee.email}`} className="hover:underline text-vibrant-sky font-black">
                      {employee.email}
                    </a>
                  </div>
                )}
                {employee.bio && (
                  <div className="bg-white p-4 rounded-[1.5rem] border-2 border-vibrant-yellow shadow-2xs">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">About</h4>
                    <p className="text-xs text-vibrant-dark leading-relaxed italic">{employee.bio}</p>
                  </div>
                )}
              </div>

              {/* Direct Reporting Hierarchy Lines */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Supervisor Block */}
                <div className="bg-white p-4 rounded-[1.5rem] border-2 border-vibrant-yellow flex flex-col shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Direct Supervisor</span>
                  {directManager ? (
                    <div
                      onClick={() => onSelectEmployee(directManager)}
                      className="group flex items-center gap-2.5 cursor-pointer bg-white p-2.5 rounded-xl border border-transparent hover:border-vibrant-peach hover:bg-vibrant-cream transition-all shadow-3xs"
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-3xs ring-2 ring-vibrant-peach/50">
                        <img
                          src={directManager.photoUrl}
                          alt={directManager.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(directManager.name)}`;
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-vibrant-dark group-hover:text-vibrant-peach truncate">{directManager.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{directManager.role}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center p-3 text-[11px] text-slate-400 italic border-2 border-dashed border-vibrant-yellow rounded-xl">
                      No direct supervisor (Top Executive)
                    </div>
                  )}
                </div>

                {/* Subordinates Block */}
                <div className="bg-white p-4 rounded-[1.5rem] border-2 border-vibrant-yellow flex flex-col shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Direct Reports ({directReports.length})</span>
                  <div className="flex-1 max-h-36 overflow-y-auto space-y-2">
                    {directReports.map((sub) => (
                      <div
                        key={sub.id}
                        onClick={() => onSelectEmployee(sub)}
                        className="group flex items-center gap-2.5 cursor-pointer bg-white p-2 rounded-xl border border-transparent hover:border-vibrant-peach hover:bg-vibrant-cream transition-all text-xs shadow-3xs"
                      >
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-100 shadow-3xs">
                          <img
                            src={sub.photoUrl}
                            alt={sub.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(sub.name)}`;
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-vibrant-dark group-hover:text-vibrant-peach truncate">{sub.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{sub.role}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    ))}
                    {directReports.length === 0 && (
                      <div className="flex items-center justify-center p-3 text-[11px] text-slate-400 italic border-2 border-dashed border-vibrant-yellow rounded-xl">
                        No direct reporting subordinates
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Historical Titles Timeline (Visual Vertical List) */}
              <div className="bg-white p-5 rounded-[2rem] border-2 border-vibrant-yellow shadow-sm">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-vibrant-peach" /> Historical Job Titles
                </h4>
                
                <div className="relative border-l-2 border-vibrant-yellow ml-3 pl-5 space-y-4">
                  {/* Current title node */}
                  <div className="relative">
                    <span className="absolute -left-[27px] top-1.5 bg-vibrant-peach w-3 h-3 rounded-full border-2 border-white ring-4 ring-white" />
                    <p className="text-xs font-black text-vibrant-dark">{employee.role}</p>
                    <p className="text-[10px] text-slate-400 font-bold">Current Position Grade: <span className="uppercase text-[#5d8b9d]">{employee.grade}</span></p>
                  </div>

                  {/* Past titles */}
                  {employee.historicalTitles?.map((title, idx) => (
                    <div key={idx} className="relative">
                      <span className="absolute -left-[27px] top-1.5 bg-vibrant-sky w-3 h-3 rounded-full border-2 border-white ring-4 ring-white" />
                      <p className="text-xs text-vibrant-dark font-bold">{title}</p>
                    </div>
                  ))}

                  {(!employee.historicalTitles || employee.historicalTitles.length === 0) && (
                    <div className="text-[11px] text-slate-400 italic">No historical role logs available for this person.</div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
