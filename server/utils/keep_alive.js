import cron from 'node-cron';
import https from 'https';

/**
 * Pings the server to keep it from sleeping on Render's free tier.
 * It uses the RENDER_EXTERNAL_URL environment variable if available.
 */
export const initKeepAlive = () => {
  const url = process.env.RENDER_EXTERNAL_URL || process.env.PING_URL;
  
  if (!url) {
    console.log("⚠️ Keep-alive disabled: RENDER_EXTERNAL_URL or PING_URL not set.");
    return;
  }

  console.log(`🚀 Keep-alive initialized for: ${url}`);

  // Ping every 14 minutes (Render free tier sleeps after 15 mins)
  cron.schedule('*/14 * * * *', () => {
    // Target the deep warmup endpoint to keep the AI pipeline hot
    const warmupUrl = url.endsWith('/') ? `${url}api/warmup` : `${url}/api/warmup`;
    
    console.log(`💓 Sending deep keep-alive ping to ${warmupUrl}...`);
    https.get(warmupUrl, (res) => {
      console.log(`✅ Deep Ping successful: Status ${res.statusCode}`);
    }).on('error', (err) => {
      console.error(`❌ Deep Ping failed: ${err.message}`);
    });
  });
};
