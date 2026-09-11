const admin = require("firebase-admin");
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const { generateSeminarZoom } = require("./index.js");

async function run() {
  try {
    const res = await generateSeminarZoom.run({
      data: {
        date: "2026-08-24",
        topic: "Financial Literacy",
        time: "11:00 AM",
        seminarId: "2026-08-24_FinancialLiteracy"
      }
    });
    console.log("Success:", res);
  } catch (e) {
    console.error("Error executing function:", e);
  }
}
run();
