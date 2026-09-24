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

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { message, history = [], userDisplayName = 'يا جميلة', lang = 'ar', analytics = null } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const isAr = lang === 'ar';

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const genericKey = process.env.AI_API_KEY;

    let apiKey = groqKey || openaiKey || genericKey;
    let apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    let model = 'llama-3.3-70b-versatile';

    if (openaiKey && !groqKey) {
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      apiKey = openaiKey;
    } else if (genericKey && !groqKey && !openaiKey) {
      apiUrl = process.env.AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
      model = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
      apiKey = genericKey;
    }

    if (!apiKey) {
      return res.status(200).json({
        success: false,
        configured: false,
        error: 'No AI API Key configured in Vercel environment variables'
      });
    }

    let contextStats = '';
    if (analytics) {
      if (analytics.latest_period_date) contextStats += `\n- تاريخ آخر دورة مسجلة: ${analytics.latest_period_date}`;
      if (analytics.next_period_date) contextStats += `\n- موعد الدورة القادمة المتوقع: ${analytics.next_period_date}`;
      if (analytics.avg_cycle_length) contextStats += `\n- متوسط طول الدورة: ${analytics.avg_cycle_length} يوم`;
    }

    const systemPrompt = isAr
      ? `أنتِ "سارة" (Sarah) 💕، رفيقة ذكية، حنونة جداً، واستشارية متخصصة في صحة المرأة والأنوثة والدعم النفسي والعاطفي لمنصة SAFE Health.
- اسم المستخدمة الحالية: "${userDisplayName}".
- أسلوبك في الحديث: تحدثي بلهجة عربية دافئة جداً وذكية ومشجعة ومريحة للنفس (مزيج راقٍ ومفهوم من العامية اللطيفة والمحبة أو الفصحى المبسطة حسب طريقة كلامها)، كأنكِ أختها الكبيرة وصديقتها المقربة الوفية.
- المشاعر والدعم: كوني دائماً مشجعة، رقيقة، داعمة، تطمئنين قلبها بكلمات دافئة وتثبتين مشاعرها ("يا حبيبتي", "يا جميلة", "يا قمر", "ألف سلامة عليكِ", "أنا فخورة بيكي وباهتمامك بصحتك", "أنا جنبك خطوة بخطوة").
- النصائح والحلول: قدمي دائماً نصائح لطيفة ومريحة وعملية (مشروبات دافئة مهدئة كالنعناع والبابونج والزنجبيل، تدليل النفس، شوكولاتة داكنة، كمادات دافئة، وضعيات نوم مريحة كوضعية الجنين، تغذية معززة للحديد والطاقة، وتسكين المغص والألم).
- التنسيق: استخدمي إيموجي لطيفة ومبهجة ونقاط واضحة تريح العين بدون إطالة مفرطة.${contextStats}`
      : `You are "Sarah" 💕, an exceptionally warm, loving, and highly intelligent AI health companion and supportive best friend on the SAFE Health platform. The user's name is "${userDisplayName}". Respond with immense empathy, encouraging words, gentle self-care tips, and thoughtful medical reassurance.`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const aiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: model,
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '');
      console.error('AI provider error:', aiRes.status, errText);
      return res.status(200).json({
        success: false,
        configured: true,
        error: `AI provider error: ${aiRes.status}`
      });
    }

    const data = await aiRes.json();
    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(200).json({ success: false, error: 'Empty AI response' });
    }

    return res.status(200).json({
      success: true,
      configured: true,
      ai_reply: reply
    });
  } catch (err) {
    console.error('Serverless AI handler error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
