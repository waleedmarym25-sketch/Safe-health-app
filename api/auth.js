// SAFE Health - Free Serverless Auth Endpoint
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'POST') {
      const { identifier, email, username, password, display_name, age, weight, height } = req.body || {};
      const cleanEmail = (email || identifier || username || '').trim().toLowerCase();
      const cleanUsername = (username || identifier || cleanEmail.split('@')[0] || 'user').trim();

      const user = {
        id: Date.now(),
        username: cleanUsername,
        display_name: display_name || cleanUsername,
        email: cleanEmail.includes('@') ? cleanEmail : `${cleanUsername}@safe.app`,
        age: parseInt(age) || 24,
        weight: parseFloat(weight) || 60,
        height: parseFloat(height) || 165,
        bmi: parseFloat(((parseFloat(weight) || 60) / (((parseFloat(height) || 165) / 100) ** 2)).toFixed(1)),
        default_cycle_length: 28,
        default_period_length: 5,
        created_at: new Date().toISOString()
      };

      const token = 'safe_jwt_' + Buffer.from(`${user.email}:${Date.now()}`).toString('base64');
      return res.status(200).json({
        success: true,
        token,
        user
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
