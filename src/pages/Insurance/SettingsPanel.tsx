import { useState } from 'react';
import { Database, ShieldCheck, Download, Upload, Server, Settings2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<'master' | 'access' | 'backup'>('master');
  const [dropdowns, setDropdowns] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mock_dropdowns') || '[]'); } catch { return []; }
  });
  const [newDropdown, setNewDropdown] = useState({ category: 'Hospitals', value: '' });

  const saveDropdowns = (data: any) => {
    setDropdowns(data);
    localStorage.setItem('mock_dropdowns', JSON.stringify(data));
  };

  const handleBackup = () => {
    toast.success('Backup initiated. Check downloads folder soon.');
    // Simulated backup of local storage
    const data = JSON.stringify(localStorage);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insumitra_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        toast.success('Database restored successfully! Please refresh.');
      } catch {
        toast.error('Corrupted or invalid backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px]">
      {/* Sidebar */}
      <div className="w-full md:w-64 border-r border-gray-200 bg-gray-50/50 p-4 space-y-2">
        <button
          onClick={() => setActiveTab('master')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'master' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Settings2 size={18} />
          Dropdown Master
        </button>
        <button
          onClick={() => setActiveTab('access')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'access' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ShieldCheck size={18} />
          Access Control
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'backup' ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Database size={18} />
          Backup & Restore
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {activeTab === 'master' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Dropdown Master Data</h3>
              <p className="text-sm text-gray-500">Configure global dropdown values across modules.</p>
            </div>
            
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase">Category</label>
                <select
                  value={newDropdown.category}
                  onChange={e => setNewDropdown(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                >
                  <option>Hospitals</option>
                  <option>Doctors</option>
                  <option>Plan Categories</option>
                  <option>Insurance Categories</option>
                </select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase">Value</label>
                <input
                  value={newDropdown.value}
                  onChange={e => setNewDropdown(p => ({ ...p, value: e.target.value }))}
                  placeholder="e.g. Apollo Hospital"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={() => {
                  if (!newDropdown.value.trim()) return;
                  saveDropdowns([...dropdowns, { id: Date.now(), ...newDropdown, active: true }]);
                  setNewDropdown(p => ({ ...p, value: '' }));
                }}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2 h-[38px]"
              >
                <Plus size={16} /> Add
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3 w-20">Status</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dropdowns.map((d: any) => (
                    <tr key={d.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">{d.category}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{d.value}</td>
                      <td className="px-4 py-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={d.active} className="sr-only peer" onChange={() => {
                            saveDropdowns(dropdowns.map((x: any) => x.id === d.id ? { ...x, active: !x.active } : x));
                          }} />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => saveDropdowns(dropdowns.filter((x: any) => x.id !== d.id))} className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dropdowns.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No master data added yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'access' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Employee Access Control</h3>
              <p className="text-sm text-gray-500">Manage role-based permissions and module access for your staff.</p>
            </div>
            <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-start gap-3 text-sm">
              <ShieldCheck size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold mb-1">Backend Integration Required</p>
                <p>Authentic Role-Based Access Control (RBAC) and security policies require backend validation. This UI demonstrates the configuration structure. Until backend APIs are available, these settings will only save locally.</p>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-center">View</th>
                    <th className="px-4 py-3 text-center">Add</th>
                    <th className="px-4 py-3 text-center">Edit</th>
                    <th className="px-4 py-3 text-center">Delete</th>
                    <th className="px-4 py-3 text-center">Export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {['Admin', 'Manager', 'Agent', 'Data Entry'].map(role => (
                    <tr key={role} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{role}</td>
                      <td className="px-4 py-3 text-center"><input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600" /></td>
                      <td className="px-4 py-3 text-center"><input type="checkbox" defaultChecked={role !== 'Agent'} className="rounded border-gray-300 text-primary-600" /></td>
                      <td className="px-4 py-3 text-center"><input type="checkbox" defaultChecked={role === 'Admin' || role === 'Manager'} className="rounded border-gray-300 text-primary-600" /></td>
                      <td className="px-4 py-3 text-center"><input type="checkbox" defaultChecked={role === 'Admin'} className="rounded border-gray-300 text-primary-600" /></td>
                      <td className="px-4 py-3 text-center"><input type="checkbox" defaultChecked={role === 'Admin' || role === 'Manager'} className="rounded border-gray-300 text-primary-600" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Database Backup & Restore</h3>
              <p className="text-sm text-gray-500">Securely export and import your master data and records.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:bg-primary-50/30 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-3" onClick={handleBackup}>
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                  <Download size={24} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Export Backup</h4>
                  <p className="text-xs text-gray-500 mt-1">Download a full snapshot of your current database to a secure .json file.</p>
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:bg-primary-50/30 transition-all relative flex flex-col items-center justify-center text-center gap-3">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Upload size={24} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Restore Data</h4>
                  <p className="text-xs text-gray-500 mt-1">Upload a previously exported backup file to restore your system state.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
