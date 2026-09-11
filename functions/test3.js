process.env.GCLOUD_PROJECT = "familyfirst-e2079";
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: "familyfirst-e2079" });
const admin = require("firebase-admin");
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
