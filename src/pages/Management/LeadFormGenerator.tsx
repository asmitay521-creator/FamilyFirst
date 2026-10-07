import { useState, useEffect } from 'react';
import { 
  Link2, Copy, Check, Share2, Sparkles, ExternalLink, 
  UserCheck, Phone, MessageSquare, Tag, Eye, Plus,
  Shield, CheckCircle2, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import { db } from '../../services/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { 
  ProductOption, 
  DEFAULT_PRODUCT_OPTIONS, 
  getAllProductOptions, 
  saveCustomProduct,
  DEFAULT_CATEGORIES,
  getAllCategories,
  saveCustomCategory
} from '../../utils/productOptions';

export default function LeadFormGenerator() {
  const user = useAuthStore((s) => s.user);

  // Products State (Built-in + Dynamic Custom Products)
  const [productsList, setProductsList] = useState<ProductOption[]>(() => getAllProductOptions());
  const [selectedProduct, setSelectedProduct] = useState('term_insurance');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Categories State
  const [categoriesList, setCategoriesList] = useState<string[]>(() => getAllCategories());

  // Add Custom Product Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Life Insurance');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

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

  // Live Firestore listener for custom categories
  useEffect(() => {
    if (!db) return;
    try {
      const unsub = onSnapshot(collection(db, 'custom_categories'), (snapshot) => {
        const cats: string[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.name) cats.push(d.name);
        });
        if (cats.length > 0) {
          const combined = Array.from(new Set([...DEFAULT_CATEGORIES, ...cats]));
          setCategoriesList(combined);
        }
      });
      return () => unsub();
    } catch {}
  }, []);

  // Live Firestore listener for custom products
  useEffect(() => {
    if (!db) return;
    try {
      const unsub = onSnapshot(collection(db, 'custom_products'), (snapshot) => {
        const customArr: ProductOption[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.name) {
            customArr.push({
              id: docSnap.id,
              name: d.name,
              nameEn: d.name,
              badge: d.badge || 'Custom',
              isCustom: true,
            });
          }
        });
        
        if (customArr.length > 0) {
          const seen = new Set(DEFAULT_PRODUCT_OPTIONS.map((p) => p.id));
          const uniqueCustom = customArr.filter((c) => !seen.has(c.id));
          setProductsList([...DEFAULT_PRODUCT_OPTIONS, ...uniqueCustom]);
        }
      });
      return () => unsub();
    } catch {}
  }, []);

  // Handle Adding New Product & Category
  const handleAddNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newProductName.trim();
    if (!cleanName) {
      toast.error('Please enter a product or scheme name');
      return;
    }

    // Determine final category
    let finalCategory = newProductCategory;
    if (isCustomCategoryMode) {
      const cleanCat = customCategoryInput.trim();
      if (!cleanCat) {
        toast.error('Please enter a category name');
        return;
      }
      finalCategory = cleanCat;

      // Save category locally and in state
      saveCustomCategory(cleanCat);
      setCategoriesList((prev) => Array.from(new Set([...prev, cleanCat])));

      // Save category to Firestore
      if (db) {
        try {
          const catId = 'cat_' + cleanCat.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
          await setDoc(doc(db, 'custom_categories', catId), {
            id: catId,
            name: cleanCat,
            createdAt: new Date().toISOString(),
            createdBy: user?.id || 'admin',
          }, { merge: true });
        } catch (err) {
          console.warn('Firestore save category error:', err);
        }
      }
    }

    setSavingProduct(true);
    const prodId = 'prod_' + cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30) + '_' + Math.random().toString(36).slice(2, 6);

    const newProdObj: ProductOption = {
      id: prodId,
      name: cleanName,
      nameEn: cleanName,
      badge: finalCategory,
      isCustom: true,
    };

    // Save locally
    saveCustomProduct(newProdObj);
    setProductsList((prev) => {
      const exists = prev.some((p) => p.id === newProdObj.id);
      return exists ? prev : [...prev, newProdObj];
    });

    // Save to Firestore
    if (db) {
      try {
        await setDoc(doc(db, 'custom_products', prodId), {
          id: prodId,
          name: cleanName,
          badge: finalCategory,
          createdAt: new Date().toISOString(),
          createdBy: user?.id || 'admin',
        }, { merge: true });
      } catch (err) {
        console.warn('Firestore save product error:', err);
      }
    }

    setSelectedProduct(prodId);
    setNewProductName('');
    setIsCustomCategoryMode(false);
    setCustomCategoryInput('');
    setSavingProduct(false);
    setShowAddProductModal(false);
    toast.success(`Product "${cleanName}" (${finalCategory}) added successfully!`);
  };

  // Direct Live URL for WhatsApp Sharing
  const BASE_URL = 'https://familyfirstweb.vercel.app';
  
  // Clean direct URL generator (Live URL for WhatsApp)
  const generateUrl = () => {
    const params = new URLSearchParams();
    if (selectedProduct) {
      params.set('product', selectedProduct);
    }
    const currentProd = productsList.find((p) => p.id === selectedProduct);
    if (currentProd?.isCustom) {
      params.set('pname', currentProd.name);
    }
    if (assignedEmployeeId) {
      params.set('assignee', assignedEmployeeId);
    }

    const qs = params.toString();
    return `${BASE_URL}/lead-form.html${qs ? `?${qs}` : ''}`;
  };

  const currentLink = generateUrl();
  const currentProdObj = productsList.find((p) => p.id === selectedProduct) || productsList[0] || DEFAULT_PRODUCT_OPTIONS[0];

  // Clean English WhatsApp Message Template
  const generateWhatsAppMessage = () => {
    let msg = `🎯 *Family First — ${currentProdObj.name}*\n\n`;
    if (selectedProduct === 'pension') {
      msg += `✨ *Retirement & Pension Planning — Guaranteed Monthly Pension & Corpus Fund*\n\n`;
    } else if (selectedProduct === 'health_general') {
      msg += `✨ *100% Cashless Hospitalization & Comprehensive Family Health Coverage*\n\n`;
    } else if (selectedProduct === 'term_insurance') {
      msg += `✨ *Maximum Life Cover at Lowest Premiums for 100% Family Financial Security*\n\n`;
    } else if (selectedProduct === 'child_future') {
      msg += `✨ *Guaranteed Funding for Your Child's Higher Education & Marriage*\n\n`;
    } else if (selectedProduct === 'investment') {
      msg += `✨ *Guaranteed Savings & Wealth Creation — High Returns with Zero Risk*\n\n`;
    } else if (selectedProduct === 'motor') {
      msg += `✨ *Motor & Vehicle Insurance — Instant Policy & Best Claim Support*\n\n`;
    } else {
      msg += `✨ *Get complete information and customized quotes for ${currentProdObj.name}*\n\n`;
    }
    msg += `👉 Click the link below to get a free personalized quote:\n`;
    msg += `🔗 ${currentLink}\n\n`;
    msg += `_Your information is 100% confidential and secure._`;
    return msg;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentLink);
    setCopiedLink(true);
    toast.success('Form link copied to clipboard!');
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

  // Real-time Firestore stream for Leads
  useEffect(() => {
    if (!db) {
      setLoadingLeads(false);
      return;
    }
    try {
      const unsub = onSnapshot(collection(db, 'leads'), (snapshot) => {
        const leadsArr: any[] = [];
        snapshot.forEach((docSnap) => {
          leadsArr.push({ id: docSnap.id, ...docSnap.data() });
        });
        leadsArr.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setRecentLeads(leadsArr.slice(0, 15));
        setLoadingLeads(false);
      }, () => setLoadingLeads(false));
      return () => unsub();
    } catch {
      setLoadingLeads(false);
    }
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 font-sans">
      
      {/* Clean & Professional Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#17143F] flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <Link2 className="w-5 h-5" />
            </div>
            <span>Lead Form & Link Generator</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
            Generate customized lead capture links to share on WhatsApp status, social media, and client campaigns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition border border-slate-300 shadow-sm cursor-pointer active:scale-95"
          >
            <Eye className="w-4 h-4 text-emerald-600" />
            <span>Preview Form</span>
          </button>
        </div>
      </div>

      {/* Main Generator Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        
        {/* Step 1: Select or Add Product */}
        <div className="p-5 sm:p-6 space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Select Product / Insurance Scheme *
            </label>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition cursor-pointer"
                >
                  {productsList.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} {prod.badge ? `(${prod.badge})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setShowAddProductModal(true)}
                className="inline-flex items-center justify-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold px-5 py-3 rounded-xl text-xs sm:text-sm whitespace-nowrap transition shadow-md hover:shadow-purple-500/20 active:scale-95 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add New Product</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-1.5">
              The selected product will be automatically pre-selected when customers open your form link.
            </p>
          </div>

          {/* Optional Assignee Field */}
          {employees.length > 0 && (
            <div className="pt-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Auto-Assign Leads to Employee (Optional)
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
                Generated Form Link:
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
              Share on WhatsApp
            </button>

            <button
              onClick={handleCopyMessage}
              className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 px-3.5 rounded-xl text-xs transition border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer"
            >
              {copiedMsg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
              {copiedMsg ? 'Message Copied!' : 'Copy WhatsApp Message'}
            </button>

            <a
              href={currentLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 px-3.5 rounded-xl text-xs transition border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              Open Live Form
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
                Live Customer Leads
              </h2>
              <p className="text-xs text-slate-400">
                Customer inquiries captured via this form link appear here and sync to CRM in real-time.
              </p>
            </div>
          </div>
          <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-3 py-1 rounded-full border border-emerald-500/30">
            {recentLeads.length} Leads
          </span>
        </div>

        {loadingLeads ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading leads...</div>
        ) : recentLeads.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-200">No customer leads received yet.</p>
            <p>Share your generated link on WhatsApp Status to start collecting leads!</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#18153c] text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 border-b border-white/10">Customer Name</th>
                  <th className="py-3 px-4 border-b border-white/10">Phone Number</th>
                  <th className="py-3 px-4 border-b border-white/10">Interested Product</th>
                  <th className="py-3 px-4 border-b border-white/10">Date & Time</th>
                  <th className="py-3 px-4 border-b border-white/10 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentLeads.map((lead, idx) => {
                  const leadName = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Customer';
                  const leadPhone = lead.phone || lead.mobile || '-';
                  const leadProduct = Array.isArray(lead.interests) && lead.interests.length > 0 
                    ? lead.interests[0] 
                    : (lead.productInterests?.[0] || lead.service || lead.plan?.name || 'General Inquiry');
                  
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
                              href={`https://wa.me/91${leadPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello ${leadName}, thank you for inquiring about ${leadProduct} with Family First.`)}`}
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

      {/* Add Custom Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Add New Product / Scheme
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Product / Plan Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cyber Insurance, Keyman Policy, Super Top-up..."
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Category Tag
                  </label>
                  {!isCustomCategoryMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategoryMode(true);
                        setCustomCategoryInput('');
                      }}
                      className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      + Add New Category
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCustomCategoryMode(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline cursor-pointer"
                    >
                      Choose Existing Category
                    </button>
                  )}
                </div>

                {!isCustomCategoryMode ? (
                  <select
                    value={newProductCategory}
                    onChange={(e) => {
                      if (e.target.value === '__ADD_NEW__') {
                        setIsCustomCategoryMode(true);
                        setCustomCategoryInput('');
                      } else {
                        setNewProductCategory(e.target.value);
                      }
                    }}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__ADD_NEW__" className="text-purple-600 font-bold">
                      + Add New Category...
                    </option>
                  </select>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required={isCustomCategoryMode}
                        autoFocus
                        placeholder="Enter New Category Name (e.g. Travel, Commercial, Cyber)..."
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-purple-500 rounded-xl text-slate-900 dark:text-white text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setIsCustomCategoryMode(false)}
                        className="px-3 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                      ✓ This category will be automatically added to the dropdown for future use.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow transition active:scale-95 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  {savingProduct ? 'Saving...' : 'Save Product & Generate Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clean Mobile Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Customer Mobile Form Preview
              </span>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Preview Form Content */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-3 text-left">
              <div className="text-center">
                <span className="text-xs font-black text-emerald-800 dark:text-emerald-400">Family First</span>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                  Request Free Information
                </h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400">
                  Full Name *
                </div>
                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400">
                  10-Digit Mobile Number *
                </div>
                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400">
                  Email Address (Optional)
                </div>
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-xl text-emerald-800 dark:text-emerald-300 font-semibold text-[11px] truncate">
                  Product: {currentProdObj.name}
                </div>
              </div>

              <div className="py-3 bg-emerald-600 text-white text-center font-bold text-xs rounded-xl shadow">
                Submit Inquiry ➔
              </div>
            </div>

            <div className="mt-3 text-center">
              <a
                href={currentLink}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 font-bold hover:underline inline-flex items-center gap-1"
              >
                Open Live Form in New Tab <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
