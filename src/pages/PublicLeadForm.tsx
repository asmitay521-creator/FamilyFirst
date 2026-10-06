import { useState } from 'react';
import { db } from '../services/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { User, Phone, Mail, ShieldCheck, CheckCircle2, ArrowRight, PhoneCall, MessageCircle, Sparkles } from 'lucide-react';

export default function PublicLeadForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
      setErrorMsg('कृपया वैध १० अंकी मोबाईल नंबर प्रविष्ट करा.');
      return;
    }

    setLoading(true);

    try {
      const leadId = `lead_wp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const nameParts = cleanName.split(' ');
      const firstName = nameParts[0] || cleanName;
      const lastName = nameParts.slice(1).join(' ') || '';

      const leadData = {
        id: leadId,
        _id: leadId,
        firstName,
        lastName,
        name: cleanName,
        phone: cleanPhone.startsWith('91') && cleanPhone.length > 10 ? cleanPhone : cleanPhone,
        email: email.trim() || '',
        source: 'WhatsApp Status',
        leadSource: 'WhatsApp Status',
        stage: 'TO_CONTACT',
        leadStage: 'To Contact',
        status: 'NEW',
        leadStatus: 'Interested',
        notes: `WhatsApp Status Lead: ₹399/दिवस पेन्शन योजना माहितीसाठी चौकशी. नाव: ${cleanName}, फोन: ${cleanPhone}`,
        interests: ['निवृत्ती वेतन / पेन्शन योजना (₹399/दिवस, ₹70 लाख फंड + ₹6 लाख पेन्शन)'],
        productInterests: ['Pension Plan', 'Retirement Planning'],
        isWebsiteLead: true,
        tags: ['whatsapp-lead', 'pension-plan', 'status-enquiry'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to Firebase Firestore
      if (db) {
        await setDoc(doc(db, 'leads', leadId), leadData, { merge: true });
      }

      // Also cache to local storage for immediate offline sync if on same domain
      try {
        const localLeads = JSON.parse(localStorage.getItem('insumitra_custom_leads') || '[]');
        localStorage.setItem('insumitra_custom_leads', JSON.stringify([leadData, ...localLeads]));
      } catch {}

      setSubmitted(true);
    } catch (err: any) {
      console.error('Lead submission error:', err);
      setErrorMsg('माहिती पाठवताना अडचण आली. कृपया पुन्हा प्रयत्न करा किंवा थेट कॉल करा.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-lg relative z-10 my-auto">
        
        {/* Banner Card Preview */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 border border-blue-500/30 rounded-2xl p-4 mb-4 shadow-xl text-center">
          <div className="inline-flex items-center gap-1.5 bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase mb-2">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-pulse" /> विशेष योजना ऑफर
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-snug">
            रोज बचत करा <span className="text-yellow-400 underline decoration-yellow-400 font-black">₹399 रु.</span>
          </h1>
          <p className="text-xs sm:text-sm text-blue-200 mt-1 font-medium">
            रिटायरमेंटला मिळवा <span className="text-emerald-400 font-bold">₹70 लाखांपर्यंत Tax Free फंड</span> + <span className="text-yellow-300 font-bold">₹6 लाख वार्षिक पेन्शन</span>
          </p>
        </div>

        {/* Modal / Form Card (Matching User's Reference Screenshot) */}
        <div className="bg-white text-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
          
          {!submitted ? (
            <>
              {/* Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  </div>
                  <span className="text-xl font-bold text-emerald-900 tracking-tight">Family First</span>
                </div>
                
                <h2 className="text-2xl font-extrabold text-emerald-800 mt-1">
                  योजनेची मोफत माहिती मिळवा
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  खालील तपशील भरा, आमचे प्रतिनिधी त्वरित संपर्क करतील
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium text-center">
                    {errorMsg}
                  </div>
                )}

                {/* Name */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="तुमचे नाव लिहा *"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-full text-slate-800 placeholder-slate-400 text-sm font-medium transition duration-200 outline-none shadow-sm"
                  />
                </div>

                {/* Mobile Number */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="१० अंकी मोबाईल नंबर लिहा *"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-full text-slate-800 placeholder-slate-400 text-sm font-medium transition duration-200 outline-none shadow-sm"
                  />
                </div>

                {/* Email (Optional) */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ईमेल आयडी लिहा (पर्यायी)"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-full text-slate-800 placeholder-slate-400 text-sm font-medium transition duration-200 outline-none shadow-sm"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold rounded-full text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition duration-200 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>माहिती मिळवा</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              {/* Privacy Footer */}
              <div className="mt-5 text-center flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
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
                तुमची माहिती आम्हाला मिळाली आहे. <strong>Family First (राहुल कुलकर्णी)</strong> चे प्रतिनिधी लवकरच आपल्याशी फोनवर संपर्क साधतील.
              </p>

              {/* Quick Connect Actions */}
              <div className="space-y-3 pt-2">
                <a
                  href={`https://wa.me/918421702419?text=Namaste%2C%20Mi%20${encodeURIComponent(name)}.%20Mala%20%E2%82%B9399%20pension%20yojanabaddal%20mahiti%20havi%20aahe.`}
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

        {/* Footer info */}
        <div className="text-center mt-4 text-xs text-slate-400">
          <p className="font-semibold text-slate-300">Family First | Rahul Kulkarni</p>
          <p>Financial Planning • Insurance • Investments</p>
          <p className="mt-1 text-slate-500">संपर्क: 8421702419</p>
        </div>

      </div>
    </div>
  );
}
