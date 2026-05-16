export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { query } = req.body;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Overpass requires a User-Agent to avoid 406 errors. We disguise it here.
        'User-Agent': 'QuickGovPH-App/1.0' 
      },
      body: `data=${encodeURIComponent(query)}`
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Overpass Proxy Error:", error);
    res.status(500).json({ error: 'Failed to fetch from Overpass' });
  }
}
