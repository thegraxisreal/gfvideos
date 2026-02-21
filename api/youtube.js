export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.YT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'YouTube API key not configured' });
  }

  // Forward all query params, injecting the key
  const params = new URLSearchParams(req.query);
  params.set('key', apiKey);

  // Determine which YouTube endpoint to hit based on ?endpoint= param
  const endpoint = params.get('endpoint') || 'search';
  params.delete('endpoint');

  const ytUrl = `https://www.googleapis.com/youtube/v3/${endpoint}?${params.toString()}`;

  try {
    const response = await fetch(ytUrl);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach YouTube API', details: err.message });
  }
}
