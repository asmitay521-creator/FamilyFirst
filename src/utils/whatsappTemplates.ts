import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

let isPreloading = false;

export const PRELOAD_TEMPLATES = [
  {
    name: 'Thank You – Financial Literacy',
    category: 'Follow Up',
    message: 'आपण वेळ दिलात व अर्थसाक्षरते बद्दल समजुन घेणेसाठी सहमती दर्शवलीत याबद्दल धन्यवाद..\n\nFamily First - Rahul Kulkarni\n📞 8421702419',
  },
  {
    name: 'Preferred Meeting Time',
    category: 'Meeting',
    message: 'आपण अर्थसाक्षरता, रिस्क मॅनेजमेंट,आणि आर्थिक नियोजना बद्दल माहिती घेणेसाठी वेळ देणार आहात तर आपल्या भेटीची सोयीची वेळ सकाळी योग्य असेल का सायंकाळी ते कळवावे..\n\nFamily First - Rahul Kulkarni\n📞 8421702419',
  },
  {
    name: 'Meeting Confirmation',
    category: 'Meeting',
    message: 'आपण आर्थिक नियोजन चर्चेबाबत भेटीसाठी वार {{day}} वेळ {{time}} निश्चित केली आहे त्यानुसार आपण भेटत आहोत..\n\nFamily First - Rahul Kulkarni\n📞 8421702419',
  },
  {
    name: 'Tomorrow Meeting Reminder',
    category: 'Reminder',
    message: 'आपली भेट उद्या {{time}} वेळेत ठरली आहे..त्यानुसार आपण आपली वेळ राखुन ठेवावी ही विनंती..\n\nFamily First - Rahul Kulkarni\n📞 8421702419',
  },
  {
    name: "Today's Meeting",
    category: 'Reminder',
    message: 'आज आपण {{time}} या वेळेत भेटत आहोत..\n\nFamily First - Rahul Kulkarni\n📞 8421702419',
  },
  {
    name: 'Meeting Follow Up',
    category: 'Follow Up',
    message: 'आज आपण भेट घेतली व आर्थिक नियोजन अर्थसाक्षरते बद्दल सर्व माहिती जाणुन घेतलीत,आम्ही आशा करतो की आजच्या आम्ही दिलेल्या प्रेझेंटेशन मधुन तुमच्या आर्थिक नियोजना बद्दलच्या संकल्पना स्पष्ट झाल्या असतील..पुढील नियोजनासाठी संपर्कात राहुच..\n\nFamily First - Rahul Kulkarni\n📞 8421702419',
  },
  {
    name: 'Financial Security Follow Up',
    category: 'Follow Up',
    message: 'आपण योग्य वेळी योग्य निर्णय घेउन आर्थिक सुरक्षेच्या दिशेने तुम्ही एक पाउल टाकत आहात तुमच्या या प्रवासात आम्ही तुम्हाला योग्य मार्गदर्शन करत राहु..\n\nFamily First - Rahul Kulkarni\n📞 8421702419',
  },
  {
    name: 'Financial Planning Required Documents',
    category: 'Documents',
    message: 'आपला आर्थिक नियोजन प्रस्ताव सादर करणेसाठी आधार,पॅन,चेक,Id साईज फोटो,तीन वर्षाचे ITR,तीन महिन्यांची पगार स्लिप तर नाॅमिनिचे आधार आणि बँक डिटेल हे कागदपत्र आवश्यक आहेत..\n\nFamily First - Rahul Kulkarni\n📞 8421702419',
  },
  {
    name: 'Medical Follow Up',
    category: 'Medical',
    message: 'नमस्कार,\nआपली मेडिकल तपासणी व्यवस्थित झाली का? तपासणीदरम्यान काही अडचण आली नाही ना, याची खात्री करण्यासाठी हा छोटासा फॉलोअप.\nआपले मेडिकल रिपोर्ट प्राप्त होताच आपला प्रस्ताव मंजुरीसाठी पुढे पाठवला जाईल. त्यानंतरच्या प्रत्येक टप्प्याची माहिती आपणास देत राहू.\nपुढील कार्यवाहीसाठी आम्ही आपल्या संपर्कात राहूच.\n\nआपला,\nराहुल कुलकर्णी MDRT (USA) | Family First\n📞 8421702419',
  },
  {
    name: 'Proposal Approved',
    category: 'Proposal',
    message: '🎉 हार्दिक अभिनंदन!\nआपला आर्थिक नियोजनाचा प्रस्ताव यशस्वीरीत्या मंजूर झाला आहे.\nआपल्या आर्थिक भविष्यासाठी नियोजन करताना आमची निवड करून आमच्यावर विश्वास दाखवल्याबद्दल मनःपूर्वक धन्यवाद!\nहा विश्वास आम्ही केवळ जबाबदारी म्हणून नव्हे, तर दीर्घकालीन नात्याची बांधिलकी म्हणून जपू.\nआपल्या आर्थिक सुरक्षितता, संपत्ती निर्मिती आणि निवृत्तीच्या नियोजनासाठी आम्ही सदैव आपल्या सोबत आहोत.\n\nआपला,\nराहुल कुलकर्णी MDRT (USA) | Family First\n📞 8421702419',
  },
  {
    name: 'Payment Received',
    category: 'Payment',
    message: 'नमस्कार,\nआपल्या आर्थिक नियोजनाच्या प्रस्तावासाठीचे पेमेंट यशस्वीरीत्या प्राप्त झाले आहे. ✅\nआपण आमच्यावर दाखवलेल्या विश्वासाबद्दल मनःपूर्वक धन्यवाद.\nआपल्या प्रस्तावाच्या पुढील प्रक्रियेची प्रत्येक अपडेट आम्ही आपणास देत राहू.\n\nआपला,\nराहुल कुलकर्णी MDRT (USA) | Family First\n📞 8421702419',
  },
  {
    name: 'Welcome – Family Welfare Consultant',
    category: 'Welcome',
    message: 'Welcome to Family First!\nआपल्या आर्थिक नियोजनाच्या प्रवासात आमच्यावर विश्वास ठेवून सहभागी झाल्याबद्दल धन्यवाद.\nProtect | Save | Invest\nआपल्या कुटुंबाचे आर्थिक संरक्षण, संपत्ती निर्मिती आणि निवृत्ती नियोजनासाठी आम्ही दीर्घकाळ आपल्या सोबत राहू.\nआपल्या प्रत्येक महत्त्वाच्या आर्थिक टप्प्यावर योग्य नियोजनासाठी आम्ही उपलब्ध आहोत.\n\nराहुल कुलकर्णी MDRT (USA) | Family First\n📞 8421702419',
  },
  {
    name: 'Retirement & Family Protection – Required Documents',
    category: 'Documents',
    message: 'नमस्कार,\nआपल्या Retirement & Family Protection Financial Planning प्रस्तावासाठी खालील कागदपत्रांची आवश्यकता आहे:\nApplicant Documents\n* आधार कार्ड\n* पॅन कार्ड\n* बँक चेक / पासबुकचा फोटो\n* मागील 3 वर्षांचे ITR\n* मागील 3 महिन्यांच्या Salary Slips\n* Form 16 / Form 16A\n* Degree / शैक्षणिक प्रमाणपत्र\n* पासपोर्ट साईज फोटो\n* ID साईज फोटो\nNominee Documents\n* आधार कार्ड\n* बँक पासबुक / चेकचा फोटो\nकृपया वरील कागदपत्रे उपलब्ध करून द्यावीत, जेणेकरून आपला आर्थिक नियोजनाचा प्रस्ताव तत्काळ सादर करून पुढील प्रक्रिया सुरू करता येईल.\n\nधन्यवाद! 🙏\nराहुल कुलकर्णी MDRT (USA) | Family First\n📞 8421702419',
  },
  {
    name: 'Seminar Registration Confirmation',
    category: 'SEMINAR',
    message: 'नमस्कार {{name}} जी,\n\nआम्ही *Family First* तर्फे आयोजित करत असलेल्या *\'{{topic}}\'* या विशेष सेमिनारमध्ये आपले सहर्ष नोंदणी पूर्ण झाली आहे. 🎉\n\n📅 *तारीख:* {{date}}\n⏰ *वेळ:* {{time}}\n📍 *स्थान:* {{venue}}\n🎤 *वक्ते:* {{speaker}}\n\nअधिक माहितीसाठी संपर्क करा. धन्यवाद!\n\nFamily First - Rahul Kulkarni\n📞 8421702419',
  },
  {
    name: 'Seminar Reminder Message',
    category: 'SEMINAR',
    message: 'नमस्कार {{name}} जी,\n\nआपला *\'{{topic}}\'* सेमिनार आज {{time}} वाजता आयोजित केला आहे. कृपया वेळेवर उपस्थित राहावे.\n\n📅 *तारीख:* {{date}}\n⏰ *वेळ:* {{time}}\n📍 *स्थान:* {{venue}}\n\nधन्यवाद!\n\nFamily First - Rahul Kulkarni\n📞 8421702419',
  }
];

export async function preloadWhatsAppTemplates() {
  if (!db || isPreloading) return;
  isPreloading = true;
  try {
    const snap = await getDocs(collection(db, 'whatsappTemplates'));
    
    // Create map of existing templates for updating overrides
    const dbDocsMap = new Map<string, any>();
    const seenNames = new Set<string>();
    
    for (const d of snap.docs) {
      const data = d.data();
      const n = (data.name || data.title || '').trim().toLowerCase();
      if (!n) continue;
      
      if (seenNames.has(n)) {
        await deleteDoc(d.ref).catch(() => {});
      } else {
        seenNames.add(n);
        dbDocsMap.set(n, { ref: d.ref, data });
      }
    }

    // Now upsert templates
    for (const t of PRELOAD_TEMPLATES) {
      const lowerName = t.name.toLowerCase();
      const matchedVars = t.message.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || [];
      const uniqueVars = Array.from(new Set(matchedVars));
      
      if (dbDocsMap.has(lowerName)) {
        // ALWAYS overwrite to enforce the text correction required by user
        const existing = dbDocsMap.get(lowerName);
        await setDoc(existing.ref, {
          name: t.name,
          category: t.category,
          message: t.message,
          variables: uniqueVars,
          isActive: existing.data.isActive ?? true,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else {
        // Create new
        const newId = `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'whatsappTemplates', newId), {
          name: t.name,
          category: t.category,
          message: t.message,
          variables: uniqueVars,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error("Failed to preload whatsappTemplates", error);
  } finally {
    isPreloading = false;
  }
}

export function replaceWhatsAppVariables(templateContent: string, data: any) {
  if (!templateContent) return '';
  let msg = templateContent;
  const safeReplace = (token: string, value: string | undefined | null) => {
    const rx = new RegExp(`\\{\\{${token}\\}\\}`, 'gi');
    msg = msg.replace(rx, value || '');
  };

  safeReplace('name', data?.name || data?.firstName);
  safeReplace('customer_name', data?.name || data?.firstName);
  safeReplace('attendee_name', data?.name || data?.firstName);
  safeReplace('day', data?.day || data?.meetingDay || 'आज');
  safeReplace('date', data?.date || data?.meetingDate || new Date().toISOString().slice(0, 10));
  safeReplace('time', data?.time || data?.meetingTime || '11:00 AM');
  safeReplace('topic', data?.topic || data?.seminarTopic || 'आर्थिक साक्षरता');
  safeReplace('venue', data?.venue || data?.seminarVenue || 'Office / Online');
  safeReplace('speaker', data?.speaker || data?.seminarSpeaker || 'Rahul Kulkarni');
  safeReplace('consultant', data?.consultantName || 'Family Welfare Consultant');
  safeReplace('consultant_name', data?.consultantName || 'Family Welfare Consultant');
  return msg.trim();
}
