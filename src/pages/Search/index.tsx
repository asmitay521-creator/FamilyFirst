import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchService } from '@api/index';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Shield, FileText, TrendingUp } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

const SECTION_META: Record<string, { label: string; Icon: React.ElementType; route: string; color: string }> = {
  contacts: { label: 'Contacts', Icon: Users, route: '/contacts', color: 'text-blue-500 bg-blue-50' },
  policies: { label: 'Policies', Icon: Shield, route: '/policies', color: 'text-green-500 bg-green-50' },
  claims:   { label: 'Claims', Icon: FileText, route: '/claims', color: 'text-yellow-500 bg-yellow-50' },
  leads:    { label: 'Leads', Icon: TrendingUp, route: '/leads', color: 'text-purple-500 bg-purple-50' },
};

function getItemLabel(section: string, item: any): string {
  if (section === 'contacts') return item.contactName || `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || item.phone || 'Contact';
  if (section === 'policies') return item.policyNumber || item.contactName || 'Policy';
  if (section === 'claims')   return item.claimNumber || item.contactName || 'Claim';
  if (section === 'leads')    return item.contactName || `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim() || item.planName || 'Lead';
  return item.id;
}

function getItemSub(section: string, item: any): string {
  const plan = item.planName || item.plan?.name || '';
  const contact = item.contactName || `${item.contact?.firstName ?? ''} ${item.contact?.lastName ?? ''}`.trim();
  const phone = item.phone || item.contact?.phone || item.email || '';

  if (section === 'contacts') return [phone, item.email, item.aadhaarNumber].filter(Boolean).join(' · ');
  if (section === 'policies') return [plan, contact, item.status].filter(Boolean).join(' · ');
  if (section === 'claims')   return [item.claimType, contact, item.policyNumber, item.status].filter(Boolean).join(' · ');
  if (section === 'leads')    return [plan, contact, item.stage].filter(Boolean).join(' · ');
  return '';
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['global-search-page', debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const results = data?.data ?? {};
  const hasResults = Object.values(results).some((arr: any) => arr?.length > 0);
  const totalCount = Object.values(results).reduce((acc: number, arr: any) => acc + (arr?.length ?? 0), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Global Search</h2>
        <p className="text-sm text-gray-500">Search across contacts, policies, claims, and leads.</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-11 pr-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
          placeholder="Type to search contacts, policies, claims, leads…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded"
            onClick={() => setQuery('')}>
            ✕
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && debouncedQuery.length >= 2 && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse bg-gray-100" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {debouncedQuery.length < 2 && !query && (
        <div className="text-center py-16 text-gray-400">
          <Search size={36} className="mx-auto mb-3 text-gray-200" />
          <p>Start typing to search…</p>
          <p className="text-xs mt-1">Minimum 2 characters required</p>
        </div>
      )}

      {/* No results */}
      {debouncedQuery.length >= 2 && !isLoading && !hasResults && (
        <div className="text-center py-12 text-gray-400">
          <p>No results found for &ldquo;<strong>{debouncedQuery}</strong>&rdquo;</p>
        </div>
      )}

      {/* Results */}
      {hasResults && !isLoading && (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">{totalCount} result{totalCount !== 1 ? 's' : ''} for &ldquo;<strong>{debouncedQuery}</strong>&rdquo;</p>
          {Object.entries(SECTION_META).map(([section, meta]) => {
            const items: any[] = results[section] ?? [];
            if (items.length === 0) return null;
            const { label, Icon, route, color } = meta;
            return (
              <div key={section} className="card space-y-2">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`p-1.5 rounded-lg ${color}`}><Icon size={14}/></span>
                  <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
                  <span className="badge-gray ml-auto">{items.length}</span>
                </div>
                <div className="space-y-1">
                  {items.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => navigate(`${route}/${item.id}`)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors group">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{getItemLabel(section, item)}</p>
                        {getItemSub(section, item) && (
                          <p className="text-xs text-gray-400 truncate">{getItemSub(section, item)}</p>
                        )}
                      </div>
                      <span className="text-xs text-primary-500 opacity-0 group-hover:opacity-100 shrink-0 ml-2">View →</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
