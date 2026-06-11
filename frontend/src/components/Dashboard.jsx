import React, { useState, useEffect } from 'react';
import { api, BACKEND_URL } from '../utils/api';

export default function Dashboard({ onLogout }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Search, Sort, Filter states
  const [search, setSearch] = useState('');
  const [filterDevice, setFilterDevice] = useState('All');
  const [filterCountry, setFilterCountry] = useState('All');
  const [sortBy, setSortBy] = useState('timestamp_desc');

  // Copy Feedback state
  const [copied, setCopied] = useState(false);

  // Clear Logs confirmation modal state
  const [showClearModal, setShowClearModal] = useState(false);

  const shareUrl = `${BACKEND_URL}/document.html`;

  // Fetch logs function
  const loadLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    try {
      const data = await api.fetchLogs();
      setLogs(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch tracking data.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Poll for logs every 5 seconds
  useEffect(() => {
    loadLogs();
    const interval = setInterval(() => {
      loadLogs(true);
    }, 5000);

    // Handle token expiry event from API
    const handleAuthExpired = () => {
      onLogout();
    };
    window.addEventListener('auth-expired', handleAuthExpired);

    return () => {
      clearInterval(interval);
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  // Format date helper
  const formatDateTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }) + ' ' + date.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Format relative time for latest visit
  const getRelativeTime = (isoString) => {
    try {
      const diffMs = new Date() - new Date(isoString);
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      return formatDateTime(isoString);
    } catch {
      return '';
    }
  };

  // Copy link to clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clear all logs action
  const handleClearLogs = async () => {
    try {
      await api.clearLogs();
      setLogs([]);
      setShowClearModal(false);
    } catch (err) {
      alert(err.message || 'Failed to clear logs.');
    }
  };

  // Export logs to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Timestamp', 'IP Address', 'Country', 'City', 'Browser', 'OS', 'Device', 'Referrer', 'Session ID', 'User Agent'];
    const rows = logs.map(log => [
      log.id,
      log.timestamp,
      log.ip,
      log.country,
      log.city,
      log.browser,
      log.os,
      log.device,
      log.referrer,
      log.session_id,
      `"${log.user_agent.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `document_tracker_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Statistics Computations
  const totalVisits = logs.length;
  const uniqueVisitors = new Set(logs.map(log => log.session_id)).size;
  const latestVisit = logs[0] || null;

  // Distribution aggregates
  const getDistribution = (key) => {
    const counts = {};
    logs.forEach(log => {
      const val = log[key] || 'Unknown';
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, percentage: totalVisits > 0 ? Math.round((count / totalVisits) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  };

  const countriesDist = getDistribution('country').slice(0, 5);
  const devicesDist = getDistribution('device');
  const browsersDist = getDistribution('browser').slice(0, 5);

  // Extract unique filter sets
  const uniqueCountries = Array.from(new Set(logs.map(log => log.country || 'Unknown'))).sort();

  // Search, Sort, Filter pipeline
  const filteredLogs = logs.filter(log => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      (log.ip || '').toLowerCase().includes(searchLower) ||
      (log.country || '').toLowerCase().includes(searchLower) ||
      (log.city || '').toLowerCase().includes(searchLower) ||
      (log.browser || '').toLowerCase().includes(searchLower) ||
      (log.os || '').toLowerCase().includes(searchLower) ||
      (log.referrer || '').toLowerCase().includes(searchLower) ||
      (log.session_id || '').toLowerCase().includes(searchLower);

    const matchesDevice = filterDevice === 'All' || log.device === filterDevice;
    const matchesCountry = filterCountry === 'All' || log.country === filterCountry;

    return matchesSearch && matchesDevice && matchesCountry;
  });

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    if (sortBy === 'timestamp_desc') {
      return new Date(b.timestamp) - new Date(a.timestamp);
    }
    if (sortBy === 'timestamp_asc') {
      return new Date(a.timestamp) - new Date(b.timestamp);
    }
    if (sortBy === 'ip') {
      return (a.ip || '').localeCompare(b.ip || '');
    }
    if (sortBy === 'location') {
      return `${a.country}, ${a.city}`.localeCompare(`${b.country}, ${b.city}`);
    }
    if (sortBy === 'referrer') {
      return (a.referrer || '').localeCompare(b.referrer || '');
    }
    return 0;
  });

  // Share message constructs
  const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`Review the confidential document here: ${shareUrl}`)}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Review Confidential Document')}`;
  const emailShareUrl = `mailto:?subject=${encodeURIComponent('Review Confidential Strategy Document')}&body=${encodeURIComponent(`Please find the strategy link below:\n\n${shareUrl}`)}`;

  return (
    <div className="min-h-screen bg-slate-950 pb-12">
      
      {/* Navbar */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-brand-cyan to-brand-blue text-slate-950 font-bold text-sm">
              T
            </div>
            <span className="font-semibold text-lg text-white tracking-wide">Tracker Admin</span>
            {isRefreshing && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-cyan ring-1 ring-inset ring-brand-cyan/20">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan animate-pulse"></span>
                syncing
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                api.logout();
                onLogout();
              }}
              className="rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-300 transition-all active:scale-95"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard Body */}
      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        
        {/* Alerts / Error Panel */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 text-sm text-red-400">
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="font-semibold">Synchronization Error</p>
              <p className="text-xs font-light text-red-400/80">{error}</p>
            </div>
          </div>
        )}

        {/* Sharing Toolbar Banner */}
        <section className="bg-gradient-to-r from-slate-900 to-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute w-40 h-40 bg-brand-cyan/5 rounded-full blur-2xl -top-10 -left-10"></div>
          <div className="space-y-1.5 relative z-10">
            <h2 className="text-lg font-semibold text-white">Share Tracked Strategy Document</h2>
            <p className="text-xs text-slate-400 font-light">Copy or send this URL. Any visits to it will be logged instantly in the database.</p>
            <div className="flex items-center gap-2 font-mono text-xs text-brand-cyan bg-slate-950/60 border border-slate-800/80 rounded-lg px-3 py-1.5 w-fit max-w-full overflow-hidden select-all">
              {shareUrl}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0">
            {/* Copy Button */}
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl border transition-all active:scale-95 ${
                copied 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-200'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                {copied ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.524 3h-3.048a2.25 2.25 0 00-2.143 1.888L5.75 7.5H18c-.125-.853-.878-1.5-1.75-1.5h-.584zM5.75 7.5H18M5.75 7.5H4.25A2.25 2.25 0 002 9.75v10.5A2.25 2.25 0 004.25 22.5h15.5a2.25 2.25 0 002.25-2.25V9.75a2.25 2.25 0 00-2.25-2.25H18M5.75 7.5v12.75a.75.75 0 00.75.75h11a.75.75 0 00.75-.75V7.5" />
                )}
              </svg>
              {copied ? 'Copied!' : 'Copy Link'}
            </button>

            {/* WhatsApp */}
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center p-2.5 rounded-xl border border-slate-800 hover:border-emerald-500/20 bg-slate-900 hover:bg-emerald-500/10 text-slate-300 hover:text-emerald-400 transition-all active:scale-95"
              title="Share via WhatsApp"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.022-.08-.124-.22-.282-.297-.16-.079-.933-.46-1.07-.51-.14-.05-.24-.07-.34.07-.1.14-.38.51-.47.61-.09.1-.18.12-.34.04-.16-.08-.68-.25-1.295-.8-0.48-.43-.805-.96-.9-1.12-.09-.16-.01-.25.07-.33.08-.08.16-.19.24-.28.08-.1.11-.16.16-.28.05-.12.025-.22-.01-.29-.035-.08-.34-.81-.466-1.117-.122-.295-.244-.255-.336-.26-.088-.004-.19-.005-.29-.005-.1 0-.27.04-.41.19-.14.15-.54.53-.54 1.29s.55 1.49.62 1.6c.08.1 1.09 1.66 2.64 2.33.37.16.65.25.87.32.37.12.7.1.97.07.3-.04.933-.38 1.06-.75.13-.37.13-.69.09-.76zM12.007 2a9.999 9.999 0 0 0-8.665 14.996l-1.02 3.733 3.825-1.003A9.996 9.996 0 0 0 12.007 22a10 10 0 0 0 10-10 10 10 0 0 0-10-10z" />
              </svg>
            </a>

            {/* Telegram */}
            <a
              href={telegramShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center p-2.5 rounded-xl border border-slate-800 hover:border-sky-500/20 bg-slate-900 hover:bg-sky-500/10 text-slate-300 hover:text-sky-400 transition-all active:scale-95"
              title="Share via Telegram"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2Zm4.707 7.792-1.745 8.224c-.13.585-.478.73-.97.452l-2.66-1.96-1.283 1.234c-.14.14-.26.26-.53.26l.19-2.7 4.918-4.44c.214-.19-.047-.296-.33-.108L6.2 14.14l-2.617-.82c-.57-.177-.58-.57.12-.843l10.223-3.94c.475-.173.89.11.73.91Z" />
              </svg>
            </a>

            {/* Email */}
            <a
              href={emailShareUrl}
              className="flex items-center justify-center p-2.5 rounded-xl border border-slate-800 hover:border-violet-500/20 bg-slate-900 hover:bg-violet-500/10 text-slate-300 hover:text-violet-400 transition-all active:scale-95"
              title="Share via Email"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </a>
          </div>
        </section>

        {/* Primary Counters and Latest Visit */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Total Visits */}
          <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-sm shadow-lg flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Total Visits</span>
              <p className="text-3xl font-extrabold text-white">{loading ? '...' : totalVisits}</p>
            </div>
            <div className="p-3 bg-brand-cyan/10 text-brand-cyan rounded-xl border border-brand-cyan/20">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>

          {/* Card 2: Unique Visitors */}
          <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-sm shadow-lg flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Unique Visitors</span>
              <p className="text-3xl font-extrabold text-white">{loading ? '...' : uniqueVisitors}</p>
            </div>
            <div className="p-3 bg-brand-blue/10 text-brand-blue rounded-xl border border-brand-blue/20">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A9.06 9.06 0 0112.024 20c-1.107 0-2.178-.199-3.178-.565v-.009a9.34 9.34 0 011.024-3.03M18.02 9.75a3.25 3.25 0 11-6.5 0 3.25 3.25 0 016.5 0zm-1.5 8.25a3.25 3.25 0 11-6.5 0 3.25 3.25 0 016.5 0z" />
              </svg>
            </div>
          </div>

          {/* Card 3: Latest Visit Quick-View */}
          <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-sm shadow-lg flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 mb-2">
              <span class="text-xs font-semibold text-slate-500 uppercase tracking-widest">Latest Visit</span>
              {latestVisit && (
                <span className="text-xs text-brand-cyan font-mono">{getRelativeTime(latestVisit.timestamp)}</span>
              )}
            </div>
            {latestVisit ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-white truncate max-w-[120px]">{latestVisit.ip}</span>
                  <span className="text-xs text-slate-400 font-light truncate max-w-[140px]">{latestVisit.city}, {latestVisit.country}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{latestVisit.browser} on {latestVisit.os}</span>
                  <span className="capitalize px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded text-[9px] font-bold">{latestVisit.device}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 font-light">No records registered yet.</p>
            )}
          </div>

        </section>

        {/* Graphical Metrics Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Countries Chart */}
          <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-sm shadow-lg flex flex-col justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/60 pb-3 mb-4">Top Countries</h3>
            <div className="space-y-3.5 flex-grow">
              {loading ? (
                <div className="text-sm text-slate-600">Loading distribution...</div>
              ) : countriesDist.length > 0 ? (
                countriesDist.map((item, idx) => (
                  <div key={item.name} className="space-y-1">
                    <div class="flex justify-between text-xs font-light">
                      <span className="text-slate-300 font-semibold">{item.name}</span>
                      <span className="text-slate-400">{item.count} ({item.percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-900">
                      <div 
                        className="bg-gradient-to-r from-brand-cyan to-brand-blue h-1.5 rounded-full" 
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-600 italic">No geolocation data.</div>
              )}
            </div>
          </div>

          {/* Browser Chart */}
          <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-sm shadow-lg flex flex-col justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/60 pb-3 mb-4">Browser Profiles</h3>
            <div className="space-y-3.5 flex-grow">
              {loading ? (
                <div className="text-sm text-slate-600">Loading browsers...</div>
              ) : browsersDist.length > 0 ? (
                browsersDist.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div class="flex justify-between text-xs font-light">
                      <span className="text-slate-300 font-semibold">{item.name}</span>
                      <span className="text-slate-400">{item.count} ({item.percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-900">
                      <div 
                        className="bg-brand-cyan h-1.5 rounded-full" 
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-600 italic">No browser profiles.</div>
              )}
            </div>
          </div>

          {/* Device Mix Chart */}
          <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl backdrop-blur-sm shadow-lg flex flex-col justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/60 pb-3 mb-4">Device Allocation</h3>
            <div className="space-y-4 flex-grow flex flex-col justify-center">
              {loading ? (
                <div className="text-sm text-slate-600">Loading devices...</div>
              ) : devicesDist.length > 0 ? (
                <div className="space-y-4">
                  {devicesDist.map(item => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 w-16">{item.name}</span>
                      <div className="flex-grow bg-slate-950 rounded-full h-3.5 overflow-hidden border border-slate-900 flex">
                        <div 
                          className="bg-gradient-to-r from-brand-blue to-brand-cyan h-full rounded-full transition-all duration-500" 
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-white w-12 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-600 italic text-center">No device details.</div>
              )}
            </div>
          </div>

        </section>

        {/* Logs Table Controls and Container */}
        <section className="bg-slate-900/20 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
          
          {/* Controls Bar */}
          <div className="p-6 border-b border-slate-850 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-slate-900/40">
            
            {/* Search Input */}
            <div className="relative max-w-sm flex-grow">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.604 10.604z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search logs (IP, location, agent...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-cyan focus:border-brand-cyan transition-all"
              />
            </div>

            {/* Sorting, Filtering, Export & Clear */}
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Device Filter */}
              <select
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl py-2 px-3 focus:outline-none focus:border-brand-cyan transition-all"
              >
                <option value="All">All Devices</option>
                <option value="Desktop">Desktop Only</option>
                <option value="Mobile">Mobile Only</option>
                <option value="Tablet">Tablet Only</option>
              </select>

              {/* Country Filter */}
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl py-2 px-3 focus:outline-none focus:border-brand-cyan transition-all max-w-[140px]"
              >
                <option value="All">All Countries</option>
                {uniqueCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Sort Options */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl py-2 px-3 focus:outline-none focus:border-brand-cyan transition-all"
              >
                <option value="timestamp_desc">Date (Newest First)</option>
                <option value="timestamp_asc">Date (Oldest First)</option>
                <option value="ip">IP Address</option>
                <option value="location">Location</option>
                <option value="referrer">Referrer</option>
              </select>

              {/* Export Button */}
              <button
                onClick={handleExportCSV}
                disabled={logs.length === 0}
                className="bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
              >
                Export CSV
              </button>

              {/* Clear Logs Button */}
              <button
                onClick={() => setShowClearModal(true)}
                disabled={logs.length === 0}
                className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/25 text-red-400 text-xs font-semibold px-4 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
              >
                Clear Database
              </button>

            </div>

          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-500 text-sm font-light">Loading database records...</div>
            ) : sortedLogs.length > 0 ? (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-semibold bg-slate-900/20">
                    <th className="py-4 px-6">Timestamp</th>
                    <th className="py-4 px-6">IP Address</th>
                    <th className="py-4 px-6">Location</th>
                    <th className="py-4 px-6">System Info</th>
                    <th className="py-4 px-6">Device</th>
                    <th className="py-4 px-6">Referrer</th>
                    <th className="py-4 px-6">Session ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60 text-xs text-slate-300 font-light">
                  {sortedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-4 px-6 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="py-4 px-6 font-mono font-semibold text-slate-300">
                        {log.ip}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className="text-white block font-medium">{log.city}</span>
                        <span className="text-[10px] text-slate-500">{log.country}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-white block font-medium">{log.browser}</span>
                        <span className="text-[10px] text-slate-500">on {log.os}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
                          log.device === 'Mobile' 
                            ? 'bg-amber-400/10 text-amber-400 ring-1 ring-inset ring-amber-400/20' 
                            : log.device === 'Tablet'
                            ? 'bg-purple-400/10 text-purple-400 ring-1 ring-inset ring-purple-400/20'
                            : 'bg-emerald-400/10 text-emerald-400 ring-1 ring-inset ring-emerald-400/20'
                        }`}>
                          {log.device}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-[10px] text-slate-400 truncate max-w-[120px]" title={log.referrer}>
                        {log.referrer}
                      </td>
                      <td className="py-4 px-6 font-mono text-[10px] text-slate-500 select-all" title={log.session_id}>
                        {log.session_id.substring(0, 12)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-16 text-center text-slate-600 font-light space-y-2">
                <svg className="h-10 w-10 mx-auto text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm">No analytics logs matched the filters.</p>
              </div>
            )}
          </div>

          {/* Table Footer Count indicator */}
          <div className="px-6 py-4 border-t border-slate-900/60 bg-slate-900/20 flex items-center justify-between text-xs text-slate-500 font-light">
            <span>Showing {sortedLogs.length} of {totalVisits} registered events</span>
          </div>

        </section>

      </main>

      {/* Confirmation Modal for Clearing Database */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl relative overflow-hidden space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-red-500/10 border border-red-500/20 mb-3 text-red-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-white mb-1">Clear Audit Logs?</h4>
              <p className="text-xs text-slate-400 font-light leading-relaxed">
                This action is irreversible. It will wipe all access metadata, analytics counters, and tracking logs currently stored in the SQLite database.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs py-2.5 rounded-xl transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleClearLogs}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs py-2.5 rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-95"
              >
                Clear Database
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
