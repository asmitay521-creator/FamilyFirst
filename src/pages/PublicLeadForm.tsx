import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { User, Phone, Mail, ShieldCheck, CheckCircle2, ArrowRight, PhoneCall, MessageCircle, Tag, ChevronDown } from 'lucide-react';
import { ProductOption, DEFAULT_PRODUCT_OPTIONS, getAllProductOptions } from '../utils/productOptions';

export default function PublicLeadForm() {
  const [searchParams] = useSearchParams();

  // URL Query Parameters
  const paramProduct = searchParams.get('product') || 'term_insurance';
  const paramPName = searchParams.get('pname') || '';
  const paramAssignee = searchParams.get('assignee') || '';
  const paramTitle = searchParams.get('title') ? decodeURIComponent(searchParams.get('title')!) : '';

  // Products State
  const [productsList, setProductsList] = useState<ProductOption[]>(() => getAllProductOptions());

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(paramProduct);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync products with Firestore custom products
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

  // Handle custom product from pname query param if not in list
  useEffect(() => {
    if (paramProduct && paramPName) {
      setProductsList((prev) => {
        if (prev.some((p) => p.id === paramProduct)) return prev;
        return [...prev, { id: paramProduct, name: paramPName, nameEn: paramPName, isCustom: true }];
      });
    }
  }, [paramProduct, paramPName]);

  // Sync state if url param changes
  useEffect(() => {
    if (paramProduct) setSelectedProduct(paramProduct);
  }, [paramProduct]);

  // Selected product object
  const currentProdObj = productsList.find((p) => p.id === selectedProduct) || productsList[0] || DEFAULT_PRODUCT_OPTIONS[0];

  // Dynamic Headings based on product
  const formTitle = paramTitle || (
    selectedProduct === 'pension' ? 'Get Free Retirement & Pension Plan Details' :
    selectedProduct === 'health_general' ? 'Get Free Health Insurance Quotes & Cashless Hospitalization' :
    selectedProduct === 'term_insurance' ? 'Get Free Term Life Insurance Quotes' :
    selectedProduct === 'child_future' ? 'Get Free Child Education & Future Planning Details' :
    selectedProduct === 'investment' ? 'Get Free Guaranteed Savings & Investment Quotes' :
    selectedProduct === 'motor' ? 'Get Free Motor & Vehicle Insurance Quotes' :
    `Get Free Information for ${currentProdObj.name}`
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanName = name.trim();
    const cleanPhone = phone.trim().replace(/\D/g, '');

    if (!cleanName) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);

    try {
      const leadId = `lead_wp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const nameParts = cleanName.split(' ');
      const firstName = nameParts[0] || cleanName;
      const lastName = nameParts.slice(1).join(' ') || '';

      const leadData: Record<string, any> = {
        id: leadId,
        _id: leadId,
        firstName,
        lastName,
        name: cleanName,
        fullName: cleanName,
        phone: cleanPhone,
        email: email.trim() || '',
        source: 'WhatsApp Share',
        leadSource: 'WhatsApp Share',
        stage: 'TO_CONTACT',
        leadStage: 'To Contact',
        status: 'NEW',
        leadStatus: 'Interested',
        notes: `Customer Inquiry: ${currentProdObj.name}. Name: ${cleanName}, Phone: ${cleanPhone}`,
        service: currentProdObj.name,
        serviceRequired: currentProdObj.name,
        requirement: currentProdObj.name,
        planName: currentProdObj.name,
        product: currentProdObj.name,
        interests: [currentProdObj.name],
        productInterests: [currentProdObj.name],
        plan: {
          name: currentProdObj.name,
          category: currentProdObj.badge || 'LIFE'
        },
        isWebsiteLead: true,
        tags: ['customer-form', 'web-lead', (currentProdObj.badge || 'general').toLowerCase()],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (paramAssignee && paramAssignee.trim()) {
        leadData.assignedEmployeeId = paramAssignee.trim();
      }

      // Ensure no undefined values are sent to Firebase
      Object.keys(leadData).forEach((key) => {
        if (leadData[key] === undefined) {
          delete leadData[key];
        }
      });

      // Save to Firebase Firestore
      if (db) {
        await setDoc(doc(db, 'leads', leadId), leadData, { merge: true });
      }

      // Offline Cache Sync
      try {
        const localLeads = JSON.parse(localStorage.getItem('insumitra_custom_leads') || '[]');
        localStorage.setItem('insumitra_custom_leads', JSON.stringify([leadData, ...localLeads]));
      } catch {}

      setSubmitted(true);
    } catch (err: any) {
      console.error('Lead submission error:', err);
      setErrorMsg('An error occurred while submitting. Please call us directly at 8421702419.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0f1d] text-slate-100 flex items-center justify-center p-3 sm:p-4 relative overflow-x-hidden font-sans">
      
      {/* Dynamic Background Glows */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-[350px] h-[350px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Container - Snug and Centered */}
      <div className="w-full max-w-md mx-auto relative z-10 flex flex-col items-center justify-center">
        
        {/* Modal / Form Card */}
        <div className="w-full bg-white text-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl border border-slate-100 relative">
          
          {!submitted ? (
            <>
              {/* Header */}
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center gap-1.5 mb-1.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-800 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  </div>
                  <span className="text-lg font-black text-emerald-950 tracking-tight">Family First</span>
                </div>
                
                <h2 className="text-xl sm:text-2xl font-extrabold text-emerald-800 leading-tight">
                  {formTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Fill in your details below. Our advisor will reach out to assist you.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {errorMsg && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium text-center">
                    {errorMsg}
                  </div>
                )}

                {/* Name */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name *"
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl text-slate-800 placeholder-slate-400 text-xs sm:text-sm font-medium transition duration-200 outline-none shadow-xs"
                  />
                </div>

                {/* Mobile Number */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-Digit Mobile Number *"
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl text-slate-800 placeholder-slate-400 text-xs sm:text-sm font-medium transition duration-200 outline-none shadow-xs"
                  />
                </div>

                {/* Email (Optional) */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address (Optional)"
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl text-slate-800 placeholder-slate-400 text-xs sm:text-sm font-medium transition duration-200 outline-none shadow-xs"
                  />
                </div>

                {/* Product Dropdown */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                    <Tag className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full pl-10 pr-9 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl text-slate-800 text-xs sm:text-sm font-semibold transition duration-200 outline-none shadow-xs appearance-none cursor-pointer"
                  >
                    {productsList.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold rounded-xl text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition duration-200 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Submit Inquiry</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Privacy Footer */}
              <div className="mt-3.5 text-center flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Your information is 100% confidential and secure.</span>
              </div>
            </>
          ) : (
            /* Success View */
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-emerald-900 mb-2">
                Thank you, {name}!
              </h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                We have received your inquiry. A dedicated advisor from <strong>Family First</strong> will contact you shortly regarding <strong>{currentProdObj.name}</strong>.
              </p>

              {/* Quick Connect Actions */}
              <div className="space-y-3 pt-2">
                <a
                  href={`https://wa.me/918421702419?text=Hello%2C%20I%20am%20${encodeURIComponent(name)}.%20I%20would%20like%20to%20get%20information%20about%20${encodeURIComponent(currentProdObj.name)}.`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-md transition duration-150"
                >
                  <MessageCircle className="w-4 h-4" />
                  Direct Message on WhatsApp
                </a>

                <a
                  href="tel:8421702419"
                  className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition duration-150"
                >
                  <PhoneCall className="w-4 h-4 text-emerald-700" />
                  Call Directly (8421702419)
                </a>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
