import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { User, Phone, Mail, ShieldCheck, CheckCircle2, ArrowRight, PhoneCall, MessageCircle, Sparkles, Tag, ChevronDown } from 'lucide-react';
import { PRODUCT_OPTIONS } from '../utils/productOptions';

export default function PublicLeadForm() {
  const [searchParams] = useSearchParams();

  // URL Query Parameters
  const paramProduct = searchParams.get('product') || 'pension';
  const paramAssignee = searchParams.get('assignee') || '';
  const paramTitle = searchParams.get('title') ? decodeURIComponent(searchParams.get('title')!) : '';
  const paramOffer = searchParams.get('offer') ? decodeURIComponent(searchParams.get('offer')!) : '';
  const paramNoBanner = searchParams.get('nobanner') === '1';

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(paramProduct);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state if url param changes
  useEffect(() => {
    if (paramProduct) setSelectedProduct(paramProduct);
  }, [paramProduct]);

  // Selected product object
  const currentProdObj = PRODUCT_OPTIONS.find(p => p.id === selectedProduct) || PRODUCT_OPTIONS[1];

  // Dynamic Headings based on product
  const formTitle = paramTitle || (
    selectedProduct === 'pension' ? 'पेन्शन व निवृत्ती योजनेची मोफत माहिती मिळवा' :
    selectedProduct === 'health_general' ? 'आरोग्य विमा (Health Insurance) मोफत माहिती व कोटेशन' :
    selectedProduct === 'term_insurance' ? 'टर्म इन्शुरन्स मोफत माहिती व कोटेशन' :
    selectedProduct === 'child_future' ? 'मुलांचे शिक्षण व लग्न नियोजन फंड माहिती' :
    selectedProduct === 'investment' ? 'गुंतवणूक व हमी बचत योजना माहिती' :
    selectedProduct === 'motor' ? 'गाडी / वाहन विमा (Motor Insurance) कोटेशन' :
    'विमा व गुंतवणूक योजनेची मोफत माहिती मिळवा'
  );

  const offerHeadline = paramOffer || (
    selectedProduct === 'pension' ? 'पेन्शन व निवृत्ती नियोजन — रिटायरमेंटला मिळवा भरघोस फंड + नियमित पेन्शन' :
    selectedProduct === 'health_general' ? '100% कॅशलेस हॉस्पिटलायझेशन, अमर्याद कव्हर व कुटुंबासाठी संपूर्ण आरोग्य सुरक्षा' :
    selectedProduct === 'term_insurance' ? 'कमीत कमी प्रीमियममध्ये तुमच्या कुटुंबाला द्या संपूर्ण आर्थिक सुरक्षा' :
    selectedProduct === 'child_future' ? 'मुलांचे डॉक्टर, इंजिनिअर व उच्च शिक्षणासाठी हमखास गॅरंटीड फंड' :
    selectedProduct === 'investment' ? 'गुंतवणूक व हमी बचत योजना — सुरक्षित भविष्य आणि उत्तम परतावा' :
    selectedProduct === 'motor' ? 'गाडी / वाहन विमा — सर्वोत्कृष्ट क्लेम सपोर्ट व तत्काळ पॉलिसी' :
    'Family First — Financial Planning, Insurance & Investments'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanName = name.trim();
    const cleanPhone = phone.trim().replace(/\D/g, '');

    if (!cleanName) {
      setErrorMsg('कृपया आपले पूर्ण नाव लिहा.');
      return;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMsg('कृपया वैध १० अंकी मोबाईल नंबर लिहा.');
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
        notes: `Customer Lead: ${currentProdObj.name}. नाव: ${cleanName}, फोन: ${cleanPhone}`,
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
      setErrorMsg('माहिती पाठवताना अडचण आली. कृपया पुन्हा प्रयत्न करा किंवा थेट 8421702419 वर कॉल करा.');
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
                  खालील तपशील भरा, आमचे प्रतिनिधी त्वरित संपर्क करतील
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
                    placeholder="तुमचे नाव लिहा *"
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
                    placeholder="१० अंकी मोबाईल नंबर लिहा *"
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
                    placeholder="ईमेल आयडी लिहा (पर्यायी)"
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl text-slate-800 placeholder-slate-400 text-xs sm:text-sm font-medium transition duration-200 outline-none shadow-xs"
                  />
                </div>

                {/* Product Dropdown (Contains all products) */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-600">
                    <Tag className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-full pl-10 pr-9 py-3 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl text-slate-800 text-xs sm:text-sm font-semibold transition duration-200 outline-none shadow-xs appearance-none cursor-pointer"
                  >
                    {PRODUCT_OPTIONS.filter(p => p.id !== 'all').map((prod) => (
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
                      <span>माहिती मिळवा</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Privacy Footer */}
              <div className="mt-3.5 text-center flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>तुमची माहिती १००% सुरक्षित राहील.</span>
              </div>
            </>
          ) : (
            /* Success View */
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-emerald-900 mb-2">
                धन्यवाद, {name}!
              </h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                तुमची माहिती आम्हाला मिळाली आहे. <strong>Family First (राहुल कुलकर्णी)</strong> चे प्रतिनिधी लवकरच <strong>{currentProdObj.name}</strong> बद्दल आपल्याशी फोनवर संपर्क साधतील.
              </p>

              {/* Quick Connect Actions */}
              <div className="space-y-3 pt-2">
                <a
                  href={`https://wa.me/918421702419?text=Namaste%2C%20Mi%20${encodeURIComponent(name)}.%20Mala%20${encodeURIComponent(currentProdObj.name)}%20yojanabaddal%20mahiti%20havi%20aahe.`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-md transition duration-150"
                >
                  <MessageCircle className="w-4 h-4" />
                  थेट WhatsApp वर मेसेज करा
                </a>

                <a
                  href="tel:8421702419"
                  className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition duration-150"
                >
                  <PhoneCall className="w-4 h-4 text-emerald-700" />
                  आत्ताच कॉल करा (8421702419)
                </a>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
