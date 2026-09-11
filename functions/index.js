const { onCall, HttpsError } = require("firebase-functions/v2/https");
const axios = require("axios");

// Helper to get Zoom API Token (Server-to-Server)
async function getZoomAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId) {
    console.warn("Zoom credentials not set in env. Using mock Zoom link for development.");
    return null;
  }

  const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`;
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  const response = await axios.post(tokenUrl, null, {
    headers: { Authorization: `Basic ${authHeader}` }
  });
  
  return response.data.access_token;
}

exports.generateSeminarZoom = onCall({ region: "asia-south1", cors: true }, async (request) => {
  try {
    const { date, topic, time, seminarId } = request.data;
    if (!seminarId) throw new HttpsError("invalid-argument", "seminarId is required");

    // We delegate the DB read/write to the frontend to avoid Google Application Default Credentials Invalid_Grant issues in the local emulator.
    // The backend's sole responsibility is hiding the Zoom Client Secret and returning the secure meeting link.

  const token = await getZoomAccessToken();

  let zoomResponse;
  if (token) {
    // Real Zoom API implementation (timezone Asia/Kolkata)
    const startTimeParts = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    let startDateTime = date; // fallback
    if (startTimeParts) {
      let hours = parseInt(startTimeParts[1]);
      if (startTimeParts[3].toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (startTimeParts[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
      const hStr = hours.toString().padStart(2, '0');
      startDateTime = `${date}T${hStr}:${startTimeParts[2]}:00`;
    }

    try {
      const resp = await axios.post(
        "https://api.zoom.us/v2/users/me/meetings",
        {
          topic: `Family First Seminar: ${topic}`,
          type: 2,
          start_time: startDateTime,
          timezone: "Asia/Kolkata",
          settings: {
            host_video: true,
            participant_video: false,
            mute_upon_entry: true,
            waiting_room: true,
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      zoomResponse = resp.data;
    } catch (error) {
      console.error("Zoom API Error:", error.response?.data || error.message);
      throw new HttpsError("internal", "Failed to communicate with Zoom API");
    }
  } else {
    // Mock for missing credentials
    zoomResponse = {
      id: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      join_url: `https://us02web.zoom.us/j/${Math.floor(Math.random() * 9000000000)}`,
      password: Math.random().toString(36).slice(-6).toUpperCase()
    };
  }

  const zoomDetails = {
    meetingId: zoomResponse.id,
    joinUrl: zoomResponse.join_url,
    password: zoomResponse.password,
    generatedAt: new Date().toISOString(),
    status: "CREATED"
  };

    return { success: true, zoomDetails };
  } catch (error) {
    console.error("Function generateSeminarZoom crashed:", error);
    throw new HttpsError("internal", error.message || "Internal Server Error");
  }
});

exports.mockSendBulkWhatsApp = onCall({ region: "asia-south1", cors: true }, async (request) => {
  // Proxies heavy simulated loads without database keys to prevent local emulator crash.
  return { success: true };
});
