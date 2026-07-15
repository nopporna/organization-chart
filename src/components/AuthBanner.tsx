import React, { useState } from 'react';
import { googleSignIn, logout, AuthUser } from '../lib/auth';
import { createDemoSpreadsheet, extractSpreadsheetId } from '../lib/sheets';
import { LogIn, LogOut, Database, RefreshCw, PlusCircle, ExternalLink } from 'lucide-react';

interface AuthBannerProps {
  user: AuthUser | null;
  isAdmin: boolean;
  accessToken: string | null;
  spreadsheetId: string;
  spreadsheetTitle: string;
  isSyncing: boolean;
  onAuthSuccess: (user: AuthUser, token: string) => void;
  onAuthLogout: () => void;
  onSpreadsheetLinked: (id: string) => void;
  onRefresh: () => void;
}

export default function AuthBanner({
  user,
  isAdmin,
  accessToken,
  spreadsheetId,
  spreadsheetTitle,
  isSyncing,
  onAuthSuccess,
  onAuthLogout,
  onSpreadsheetLinked,
  onRefresh,
}: AuthBannerProps) {
  const [sheetInput, setSheetInput] = useState(spreadsheetId);
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    try {
      setErrorMsg('');
      const result = await googleSignIn();
      if (result) {
        onAuthSuccess(result.user, result.accessToken);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please make sure popups are allowed.');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onAuthLogout();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLinkSheet = () => {
    const id = extractSpreadsheetId(sheetInput);
    if (id) {
      onSpreadsheetLinked(id);
      setErrorMsg('');
    } else {
      setErrorMsg('Please enter a valid Spreadsheet ID or URL.');
    }
  };

  const handleCreateDemo = async () => {
    if (!accessToken) return;
    setIsCreatingDemo(true);
    setErrorMsg('');
    try {
      const result = await createDemoSpreadsheet(accessToken);
      onSpreadsheetLinked(result.spreadsheetId);
      setSheetInput(result.spreadsheetId);
    } catch (err: any) {
      setErrorMsg('Failed to create demo spreadsheet: ' + err.message);
    } finally {
      setIsCreatingDemo(false);
    }
  };

  return (
    <div className="w-full bg-white border-b-2 border-vibrant-yellow px-4 py-3 sm:px-6 shadow-sm" id="auth-banner">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Left Side: Brand and Auth Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-vibrant-peach rounded-xl flex items-center justify-center shadow-sm">
            <div className="w-5 h-5 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-vibrant-dark">
                Org<span className="text-vibrant-pastel-blue">Visual</span>
              </span>
              {user && spreadsheetId && (
                <div className="flex items-center gap-2 px-3 py-1 bg-vibrant-sage rounded-full text-[10px] sm:text-xs font-black text-[#558B2F]">
                  <div className="w-2 h-2 bg-[#77DD77] rounded-full animate-pulse"></div>
                  <span>Sheets Synced</span>
                </div>
              )}
              {user && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-black ${
                  isAdmin
                    ? 'bg-vibrant-peach/40 text-vibrant-dark'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  <span>{isAdmin ? 'Admin' : 'View only'}</span>
                </div>
              )}
            </div>
            {user ? (
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                Logged in as <span className="font-black text-vibrant-dark">{user.displayName || user.email}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Sign in with Google to view the organization chart
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Auth / Spreadsheet controls */}
        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <>
              {isAdmin && (
                <div className="flex items-center bg-[#F3F4F6] rounded-xl border-2 border-transparent focus-within:border-vibrant-pastel-blue shadow-2xs overflow-hidden p-0.5">
                  <input
                    type="text"
                    placeholder="Paste Google Sheet URL or ID..."
                    value={sheetInput}
                    onChange={(e) => setSheetInput(e.target.value)}
                    className="px-3 py-1.5 text-xs text-vibrant-dark bg-transparent focus:outline-hidden w-48 sm:w-64 font-medium"
                  />
                  <button
                    onClick={handleLinkSheet}
                    className="bg-vibrant-pastel-blue hover:bg-[#9cb5be] text-white text-xs font-black px-3 py-1.5 rounded-lg transition-all"
                  >
                    Link Sheet
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                {isAdmin && !spreadsheetId && (
                  <button
                    onClick={handleCreateDemo}
                    disabled={isCreatingDemo}
                    className="flex items-center gap-1.5 bg-vibrant-peach hover:bg-[#FFA5A0] text-white text-xs font-black px-3 py-2 rounded-lg transition-all shadow-sm disabled:opacity-50"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    {isCreatingDemo ? 'Creating...' : 'Create Sample Sheet'}
                  </button>
                )}

                {spreadsheetId && (
                  <>
                    <button
                      onClick={onRefresh}
                      disabled={isSyncing}
                      title="Sync data now"
                      className="p-2 text-vibrant-dark hover:bg-vibrant-cream rounded-lg border-2 border-vibrant-yellow bg-white transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>
                    {isAdmin && (
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Google Sheet"
                        className="p-2 text-vibrant-dark hover:bg-vibrant-cream rounded-lg border-2 border-vibrant-yellow bg-white transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </>
                )}

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 bg-white hover:bg-vibrant-cream text-slate-500 hover:text-vibrant-dark text-xs font-bold px-3 py-2 rounded-lg border-2 border-vibrant-yellow transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleLogin}
              className="flex items-center justify-center gap-2 bg-white hover:bg-vibrant-cream text-vibrant-dark font-black text-xs border-2 border-vibrant-yellow px-4 py-2 rounded-lg shadow-sm transition-all"
            >
              <LogIn className="w-4 h-4 text-[#4285F4]" />
              Sign in with Google
            </button>
          )}
        </div>

      </div>

      {errorMsg && (
        <div className="max-w-7xl mx-auto mt-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg font-bold">
          {errorMsg}
        </div>
      )}

      {user && spreadsheetId && spreadsheetTitle && (
        <div className="max-w-7xl mx-auto mt-2 flex items-center gap-2 text-xs text-vibrant-dark font-bold bg-white border-2 border-vibrant-yellow px-3 py-1.5 rounded-lg shadow-2xs">
          <Database className="w-3.5 h-3.5 text-vibrant-peach" />
          <span>Connected Sheet: <strong className="text-vibrant-peach font-black">{spreadsheetTitle}</strong></span>
          <span className="text-slate-400 font-normal">(ID: {spreadsheetId.substring(0, 8)}...{spreadsheetId.substring(spreadsheetId.length - 8)})</span>
        </div>
      )}
    </div>
  );
}
