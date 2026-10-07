import { useState, useEffect } from 'react';
import { 
  Link2, Copy, Check, Share2, Sparkles, ExternalLink, 
  UserCheck, Phone, MessageSquare, Tag, Eye, ChevronRight,
  User, RefreshCw, Send, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import { db } from '../../services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { PRODUCT_OPTIONS } from '../../utils/productOptions';

export default function LeadFormGenerator() {
  const user = useAuthStore((s) => s.user);

  // Simple State (Platform/Source removed as requested)
  const [selectedProduct, setSelectedProduct] = useState('pension');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Live Leads
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  // Fetch employees
  const { data: empRes } = useQuery({
    queryKey: ['employees', 'list_simple'],
    queryFn: () => employeesService.list({ limit: 100 }).catch(() => ({ data: [] })),
    staleTime: 5 * 60_000,
  });
  const employees: any[] = empRes?.data || [];

  // Direct Live URL for WhatsApp Sharing
  const BASE_URL = 'https://familyfirstweb.vercel.app';
  
  // Clean direct URL generator (Live URL for WhatsApp) - points directly to standalone static form
  const generateUrl = () => {
    const params = new URLSearchParams();
    if (selectedProduct) {
      params.set('product', selectedProduct);
    }
    if (assignedEmployeeId) {
      params.set('assignee', assignedEmployeeId);
    }

    const qs = params.toString();
    return `${BASE_URL}/lead-form.html${qs ? `?${qs}` : ''}`;
  };

  const currentLink = generateUrl();
  const currentProdObj = PRODUCT_OPTIONS.find((p) => p.id === selectedProduct) || PRODUCT_OPTIONS[1];

  // Clean WhatsApp Message Template
  const generateWhatsAppMessage = () => {
    let msg = `🎯 *Family First — ${currentProdObj.name}*\n\n`;
    if (selectedProduct === 'pension') {
      msg += `✨ *पेन्शन व निवृत्ती नियोजन — रिटायरमेंटला मिळवा भरघोस फंड + नियमित पेन्शन*\n\n`;
    } else if (selectedProduct === 'health_general') {
      msg += `✨ *100% कॅशलेस हॉस्पिटलायझेशन व कुटुंबासाठी संपूर्ण आरोग्य सुरक्षा*\n\n`;
    } else if (selectedProduct === 'term_insurance') {
      msg += `✨ *कमीत कमी प्रीमियममध्ये तुमच्या कुटुंबाला द्या संपूर्ण आर्थिक सुरक्षा*\n\n`;
    } else if (selectedProduct === 'child_future') {
      msg += `✨ *मुलांचे उच्च शिक्षण व लग्न नियोजनासाठी हमखास गॅरंटीड फंड*\n\n`;
    } else if (selectedProduct === 'investment') {
      msg += `✨ *गुंतवणूक व हमी बचत योजना — सुरक्षित भविष्य आणि उत्तम परतावा*\n\n`;
    } else if (selectedProduct === 'motor') {
      msg += `✨ *गाडी / वाहन विमा — सर्वोत्कृष्ट क्लेम सपोर्ट व तत्काळ पॉलिसी*\n\n`;
    } else {
      msg += `✨ *सर्व प्रकारच्या विमा व गुंतवणूक योजनांची संपूर्ण माहिती*\n\n`;
    }
    msg += `👉 मोफत माहिती मिळवण्यासाठी खालील लिंकवर क्लिक करा:\n`;
    msg += `🔗 ${currentLink}\n\n`;
    msg += `_तुमची माहिती १००% सुरक्षित राहील._`;
    return msg;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentLink);
    setCopiedLink(true);
    toast.success('Link copied!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(generateWhatsAppMessage());
    setCopiedMsg(true);
    toast.success('WhatsApp text copied!');
    setTimeout(() => setCopiedMsg(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(generateWhatsAppMessage());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Real-time Firestore stream
  useEffect(() => {
    if (!db) {
      setLoadingLeads(false);
      return;
    }
    try {
      const unsub = onSnapshot(collection(db, 'leads'), (snapshot) => {
        const leadsArr: any[] = [];
        snapshot.forEach((doc) => {
          leadsArr.push({ id: doc.id, ...doc.data() });
        });
        leadsArr.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setRecentLeads(leadsArr.slice(0, 10));
        setLoadingLeads(false);
      }, () => setLoadingLeads(false));
      return () => unsub();
    } catch {
      setLoadingLeads(false);
    }
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 font-sans">
      
      {/* Clean & Elegant Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#17143F] flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <Link2 className="w-5 h-5" />
            </div>
            <span>Lead Form & Link Generator</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
            ग्राहकांसाठी WhatsApp किंवा सोशल मीडियावर शेअर करायची सोपी फॉर्म लिंक तयार करा.
          </p>
        </div>

        <button
          onClick={() => setShowPreviewModal(true)}
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs transition border border-slate-300 shadow-sm self-start sm:self-auto cursor-pointer active:scale-95"
        >
          <Eye className="w-4 h-4 text-emerald-600" />
          <span>मोबाईल प्रिव्ह्यू पहा (Preview)</span>
        </button>
      </div>

      {/* Main Generator Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        {/* Step 1: Select Product (Platform removed as requested) */}
        <div className="p-5 sm:p-6 space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              उत्पादन निवडा (Select Product) *
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none transition cursor-pointer"
            >
              {PRODUCT_OPTIONS.map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              तुम्ही निवडलेले उत्पादन ग्राहकाच्या फॉर्मवर थेट सिलेक्ट केलेले असेल.
            </p>
          </div>

          {/* Optional Assignee Field */}
          {employees.length > 0 && (
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                लीड कोणाला असाइन करायची? (Auto-Assign Lead - Optional)
              </label>
              <select
                value={assignedEmployeeId}
                onChange={(e) => setAssignedEmployeeId(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">Family First Admin (Rahul Kulkarni)</option>
                {employees.map((emp) => (
                  <option key={emp.id || emp._id} value={emp.id || emp._id}>
                    {emp.firstName} {emp.lastName || ''}
                  </option>
                ))}
              </select>
            </div>
          )}

        </div>

        {/* Step 2: Generated Link & 1-Click Action Bar */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 sm:p-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
          
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                तयार झालेली Form Link:
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {currentProdObj.name}
              </span>
            </div>
          </div>

          {/* Direct Link Input Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              readOnly
              value={currentLink}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 bg-white dark:bg-slate-900 border-2 border-emerald-500/40 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 dark:text-slate-100 select-all shadow-inner outline-none transition cursor-pointer"
            />
            
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition active:scale-95 shadow-sm shrink-0 cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-white" />}
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            
            <button
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold py-2 px-4 rounded-xl text-xs transition shadow-sm active:scale-95 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              WhatsApp वर शेअर करा
            </button>

            <button
              onClick={handleCopyMessage}
              className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 px-3.5 rounded-xl text-xs transition border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer"
            >
              {copiedMsg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
              {copiedMsg ? 'मजकूर कॉपी झाला!' : 'WhatsApp मेसेज कॉपी करा'}
            </button>

            <a
              href={currentLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 px-3.5 rounded-xl text-xs transition border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              फॉर्म तपासून पहा (Open Form)
            </a>

          </div>

        </div>

      </div>

      {/* Real-time Leads Table */}
      <div className="bg-[#100e28] text-white rounded-2xl border border-white/10 shadow-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                या लिंकवरून थेट जमा झालेल्या लीड्स (Live Customer Leads)
              </h2>
              <p className="text-xs text-slate-400">
                ग्राहकांनी फॉर्म भरल्यास त्यांची माहिती लगेच येथे व CRM मध्ये दिसेल.
              </p>
            </div>
          </div>
          <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-3 py-1 rounded-full border border-emerald-500/30">
            {recentLeads.length} Leads
          </span>
        </div>

        {loadingLeads ? (
          <div className="py-8 text-center text-xs text-slate-400">माहिती लोड होत आहे...</div>
        ) : recentLeads.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-200">अजून कोणतीही नवीन लीड आलेली नाही.</p>
            <p>तुमची जनरेट केलेली लिंक WhatsApp Status वर शेअर करा!</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#18153c] text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 border-b border-white/10">नाव (Customer Name)</th>
                  <th className="py-3 px-4 border-b border-white/10">मोबाईल नंबर</th>
                  <th className="py-3 px-4 border-b border-white/10">उत्पादन (Interested Product)</th>
                  <th className="py-3 px-4 border-b border-white/10">तारीख व वेळ</th>
                  <th className="py-3 px-4 border-b border-white/10 text-right">संपर्क (Action)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentLeads.map((lead, idx) => {
                  const leadName = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Customer';
                  const leadPhone = lead.phone || lead.mobile || '-';
                  const leadProduct = Array.isArray(lead.interests) && lead.interests.length > 0 
                    ? lead.interests[0] 
                    : (lead.productInterests?.[0] || 'General Inquiry');
                  
                  // Safe Date Formatter
                  let formattedDate = '-';
                  if (lead.createdAt) {
                    try {
                      if (typeof lead.createdAt === 'object' && lead.createdAt.seconds) {
                        formattedDate = new Date(lead.createdAt.seconds * 1000).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                      } else {
                        const d = new Date(lead.createdAt);
                        if (!isNaN(d.getTime())) {
                          formattedDate = d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                        } else {
                          formattedDate = String(lead.createdAt);
                        }
                      }
                    } catch {
                      formattedDate = String(lead.createdAt);
                    }
                  }

                  const rowBg = idx % 2 === 0 ? 'bg-[#151236]' : 'bg-[#1b1842]';

                  return (
                    <tr key={lead.id} className={`${rowBg} hover:bg-[#231f54] transition-colors`}>
                      <td className="py-3 px-4 font-bold text-white text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0 border border-emerald-500/30">
                            {leadName.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate max-w-[180px] text-white font-bold">{leadName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-300 text-xs sm:text-sm">
                        {leadPhone}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs font-semibold max-w-[220px] truncate">
                          {leadProduct}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-xs whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {leadPhone !== '-' ? (
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <a
                              href={`https://wa.me/91${leadPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Namaste ${leadName}, Family First (Rahul Kulkarni) kadun samparka karat aahot.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 bg-[#25D366] hover:bg-[#20ba59] text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition active:scale-95"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </a>
                            <a
                              href={`tel:${leadPhone}`}
                              className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition active:scale-95"
                              title="Call"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Call</span>
                            </a>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clean Mobile Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                ग्राहक मोबाईल प्रिव्ह्यू (Customer Mobile View)
              </span>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                बंद करा (✕)
              </button>
            </div>

            {/* Preview Form Content */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-3 text-left">
              <div className="text-center">
                <span className="text-xs font-black text-emerald-800 dark:text-emerald-400">Family First</span>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                  योजनेची मोफत माहिती मिळवा
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full text-slate-400">
                  तुमचे नाव लिहा *
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full text-slate-400">
                  १० अंकी मोबाईल नंबर *
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full text-slate-400">
                  ईमेल आयडी (पर्यायी)
                </div>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-full text-emerald-800 dark:text-emerald-300 font-semibold text-[11px] truncate">
                  उत्पादन: {currentProdObj.name}
                </div>
              </div>

              <div className="py-2 bg-emerald-600 text-white text-center font-bold text-xs rounded-full shadow">
                माहिती मिळवा ➔
              </div>
            </div>

            <div className="mt-3 text-center">
              <a
                href={currentLink}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 font-bold hover:underline inline-flex items-center gap-1"
              >
                प्रत्यक्ष नवीन टॅबमध्ये उघडा <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
