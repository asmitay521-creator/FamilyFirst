export interface ProductOption {
  id: string;
  name: string;
  nameEn: string;
  badge: string;
}

export const PRODUCT_OPTIONS: ProductOption[] = [
  { id: 'all', name: 'सर्व उत्पादने (All Products)', nameEn: 'All Products (Customer chooses)', badge: 'General' },
  { id: 'pension', name: 'पेन्शन व निवृत्ती योजना (Retirement & Pension)', nameEn: 'Retirement & Pension Plan', badge: 'Pension' },
  { id: 'health_general', name: 'आरोग्य विमा / हेल्थ इन्शुरन्स (सर्व कंपन्या)', nameEn: 'Health Insurance (Family Floater)', badge: 'Health' },
  { id: 'term_insurance', name: 'टर्म इन्शुरन्स (Term Insurance)', nameEn: 'Term Insurance', badge: 'Life' },
  { id: 'child_future', name: 'मुलांचे शिक्षण व लग्न नियोजन फंड', nameEn: 'Child Education & Marriage Fund', badge: 'Child' },
  { id: 'investment', name: 'गुंतवणूक व हमी बचत योजना (Savings Plan)', nameEn: 'Guaranteed Savings Plan', badge: 'Savings' },
  { id: 'motor', name: 'गाडी / वाहन विमा (Motor Insurance)', nameEn: 'Motor & Vehicle Insurance', badge: 'Motor' },
];
