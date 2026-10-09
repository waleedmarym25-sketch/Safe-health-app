// SAFE Health - 100% Free Cross-Device Cloud Sync Serverless Endpoint
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

  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const rawKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY || '';

  const supabaseUrl = rawUrl.trim().replace(/\/+$/, '');
  const supabaseKey = rawKey.trim();

  try {
    if (req.method === 'POST') {
      const { email, password, user, cycles = [] } = req.body || {};
      const cleanEmail = (email || user?.email || '').trim().toLowerCase();
      const cleanUsername = (user?.username || cleanEmail.split('@')[0] || '').trim().toLowerCase();

      if (!cleanEmail && !cleanUsername) {
        return res.status(400).json({ success: false, error: 'Email or username is required for cloud sync' });
      }

      // If Supabase credentials are configured in Vercel environment variables, persist directly to Supabase table
      if (supabaseUrl && supabaseKey) {
        try {
          const payload = {
            email: cleanEmail || cleanUsername,
            username: cleanUsername,
            user_data: user || { email: cleanEmail, username: cleanUsername },
            cycles_data: cycles || [],
            updated_at: new Date().toISOString()
          };

          const supaRes = await fetch(`${supabaseUrl}/rest/v1/user_vault?on_conflict=email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(payload)
          });

          if (supaRes.ok) {
            return res.status(200).json({
              success: true,
              cloud: 'supabase',
              message: 'Cloud sync successful via Supabase PostgreSQL',
              user: payload.user_data,
              cycles: payload.cycles_data
            });
          } else {
            const errText = await supaRes.text().catch(() => '');
            console.warn('Supabase post response error:', supaRes.status, errText);
            return res.status(200).json({
              success: false,
              cloud: 'supabase',
              error: `Supabase database error (${supaRes.status}): ${errText}`
            });
          }
        } catch (supaErr) {
          console.warn('Supabase sync exception:', supaErr);
          return res.status(500).json({ success: false, error: supaErr.message });
        }
      }

      // Fallback response when Supabase is not yet configured in Vercel
      return res.status(200).json({
        success: true,
        cloud: 'unconfigured',
        message: 'Local session saved. For cross-device sync, add SUPABASE_URL and SUPABASE_ANON_KEY to Vercel Environment Variables.',
        email: cleanEmail,
        user: user || { email: cleanEmail, username: cleanUsername },
        cycles: cycles || [],
        total_cycles: (cycles || []).length,
        synced_at: new Date().toISOString()
      });
    }

    if (req.method === 'GET') {
      const identifier = (req.query.email || req.query.identifier || req.query.username || '').trim().toLowerCase();
      if (!identifier) {
        return res.status(400).json({ success: false, error: 'Email or identifier query parameter required' });
      }

      if (supabaseUrl && supabaseKey) {
        try {
          const encId = encodeURIComponent(identifier);
          const filter = identifier.includes('@')
            ? `email=eq.${encId}`
            : `or=(email.eq.${encId},username.eq.${encId})`;

          const supaRes = await fetch(`${supabaseUrl}/rest/v1/user_vault?${filter}&select=*`, {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            }
          });

          if (supaRes.ok) {
            const rows = await supaRes.json();
            if (rows && rows.length > 0) {
              const record = rows[0];
              return res.status(200).json({
                success: true,
                cloud: 'supabase',
                user: record.user_data,
                cycles: record.cycles_data || []
              });
            } else {
              return res.status(200).json({
                success: false,
                notFound: true,
                message: 'Account not found in cloud database'
              });
            }
          } else {
            const errText = await supaRes.text().catch(() => '');
            console.warn('Supabase fetch error:', supaRes.status, errText);
            return res.status(200).json({
              success: false,
              error: `Supabase query error (${supaRes.status}): ${errText}`
            });
          }
        } catch (err) {
          console.warn('Supabase fetch exception:', err);
          return res.status(500).json({ success: false, error: err.message });
        }
      }

      return res.status(200).json({
        success: false,
        notConfigured: true,
        message: 'Cloud sync requires SUPABASE_URL and SUPABASE_ANON_KEY in Vercel environment variables.'
      });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('Sync API handler error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

