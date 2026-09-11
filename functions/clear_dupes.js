const admin = require("firebase-admin");

process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

admin.initializeApp({ projectId: 'familyfirst-e2079' });

async function clearDuplicates() {
  const db = admin.firestore();
  const snap = await db.collection('whatsappTemplates').get();
  const seen = new Set();
  let deletedCount = 0;
  
  for (const doc of snap.docs) {
    const data = doc.data();
    const name = (data.name || data.title || '').trim().toLowerCase();
    
    if (seen.has(name)) {
      console.log(`Deleting duplicate: ${name}`);
      await doc.ref.delete();
      deletedCount++;
    } else {
      console.log(`Kept: ${name}`);
      seen.add(name);
    }
  }
  
  console.log(`Deleted ${deletedCount} duplicate templates.`);
}

clearDuplicates().then(() => process.exit(0)).catch(console.error);
