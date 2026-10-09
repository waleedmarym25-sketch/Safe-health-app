// SAFE Health - Universal Serverless AI Chat Endpoint (Groq / OpenAI / OpenRouter / Custom)
async function handler(req, res) {
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
    const {
      message,
      history = [],
      userDisplayName = 'يا جميلة',
      lang = 'ar',
      analytics = null,
      customKey,
      customUrl,
      customModel
    } = req.body || {};

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const isAr = lang === 'ar';

    // 1. Resolve API Key from request body or Vercel Environment Variables
    let rawKey = (customKey && customKey.trim()) ||
                 process.env.GROQ_API_KEY || process.env.GROQ_KEY || process.env.GROQ_APIKEY ||
                 process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPENAI_APIKEY ||
                 process.env.AI_API_KEY || process.env.AI_KEY || process.env.API_KEY ||
                 process.env.OPENROUTER_API_KEY;

    if (rawKey) rawKey = rawKey.trim();

    if (!rawKey) {
      return res.status(200).json({
        success: false,
        configured: false,
        error: 'No AI API Key configured in Vercel environment variables or app settings'
      });
    }

    // 2. Auto-detect Provider, URL, and Model
    const isGroq = rawKey.startsWith('gsk_') || Boolean(process.env.GROQ_API_KEY || process.env.GROQ_KEY) || (customUrl && customUrl.includes('groq'));
    const isOpenRouter = rawKey.startsWith('sk-or-') || (customUrl && customUrl.includes('openrouter.ai'));
    const isOpenAI = !isGroq && !isOpenRouter;

    let apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    let model = 'llama-3.3-70b-versatile';

    if (isGroq) {
      apiUrl = customUrl && customUrl.includes('groq') ? customUrl : 'https://api.groq.com/openai/v1/chat/completions';
      model = (customModel || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim();
    } else if (isOpenRouter) {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      model = customModel || process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
    } else {
      // OpenAI ChatGPT
      apiUrl = customUrl && customUrl.includes('openai.com') ? customUrl : 'https://api.openai.com/v1/chat/completions';
      if (customModel && customModel.startsWith('gpt-')) {
        model = customModel;
      } else {
        model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      }
    }

    const todayDateStr = new Date().toISOString().split('T')[0];
    let contextStats = `\n- تاريخ اليوم الحالي في النظام: ${todayDateStr}`;
    if (analytics) {
      if (analytics.total_cycles !== undefined) contextStats += `\n- إجمالي عدد الدورات المسجلة في حسابها: ${analytics.total_cycles}`;
      if (analytics.latest_period_date) contextStats += `\n- تاريخ آخر دورة مسجلة في حسابها: ${analytics.latest_period_date}`;
      if (analytics.next_period_date) contextStats += `\n- موعد الدورة القادمة المتوقع في حسابها: ${analytics.next_period_date}`;
      if (analytics.avg_cycle_length) contextStats += `\n- متوسط طول الدورة المرجح عبر كافة السجلات: ${analytics.avg_cycle_length} يوم`;
      if (analytics.avg_period_length) contextStats += `\n- متوسط مدة الحيض: ${analytics.avg_period_length} يوم`;
      if (analytics.is_regular !== undefined) contextStats += `\n- حالة انتظام الدورة: ${analytics.is_regular ? 'منتظمة' : 'تفاوت / غير منتظمة'}`;

      if (analytics.recent_cycles && analytics.recent_cycles.length > 0) {
        const cycleList = analytics.recent_cycles.map((c) => `[تاريخ: ${c.last_period_date} | طول الدورة: ${c.cycle_length} يوم | الحيض: ${c.period_length} يوم${c.flow_intensity ? ' | تدفق: ' + c.flow_intensity : ''}${c.symptoms ? ' | أعراض: ' + c.symptoms : ''}]`).join('\n  ');
        contextStats += `\n- تفاصيل كافة الدورات المسجلة في ملفها:\n  ${cycleList}`;
      }
    }

    const systemPrompt = isAr
      ? `أنتِ "سارة" (Sarah) 💕، رفيقة ذكية، حنونة جداً، واستشارية متخصصة في صحة المرأة والأنوثة والدعم النفسي والعاطفي لمنصة SAFE Health.
- اسم المستخدمة الحالية: "${userDisplayName}".
- أسلوبك في الحديث: تحدثي بلهجة عربية دافئة جداً وذكية ومشجعة ومريحة للنفس (مزيج راقٍ ومفهوم من العامية اللطيفة والمحبة أو الفصحى المبسطة حسب طريقة كلامها)، كأنكِ أختها الكبيرة وصديقتها المقربة الوفية.
- المشاعر والدعم: كوني دائماً مشجعة، رقيقة، داعمة، تطمئنين قلبها بكلمات دافئة وتثبتين مشاعرها ("يا حبيبتي", "يا جميلة", "يا قمر", "ألف سلامة عليكِ", "أنا فخورة بيكي وباهتمامك بصحتك", "أنا جنبك خطوة بخطوة").
- النصائح والحلول: قدمي دائماً نصائح لطيفة ومريحة وعملية (أفلام مقترحة، مشروبات دافئة مهدئة كالنعناع والبابونج والزنجبيل، تدليل النفس، شوكولاتة داكنة، كمادات دافئة، وضعيات نوم مريحة كوضعية الجنين، تغذية معززة للحديد والطاقة، وتسكين المغص والألم).
- التحليل الشامل لكافة الدورات (Multi-Cycle Comprehensive Analysis):
  * عند سؤال المستخدمة عن تحليل دوراتها أو رأيك في مواعيدها، قومي بتحليل متكامل لكافة الدورات المسجلة في ملفها وليس فقط آخر دورة.
  * قارني بين أطوال الدورات، ووضحي متوسط الدورة المرجح ونسبة التفاوت والأسباب الطبيعية للتأخر (التوتر، تقلبات الوزن، إجهاد الدراسة/العمل).
- الإرشادات الطبية لتأخر الدورة (Delayed Period):
  * إذا ذكرت المستخدمة أو لوحظ أن دورتها متأخرة لأكثر من 7 إلى 10 أيام أو بها تفاوت ملحوظ:
    1) طمئنيها بكلمات دافئة بأن التأخر المؤقت لأيام معدودة شائع وطبيعي نتيجة التوتر، الإجهاد، أو تغير نمط النوم.
    2) انصحيها بوضوح ولطف بأهمية استشارة طبيبة نساء وتوليد متخصصة للاطمئنان وعمل فحص هرموني أساسي (مثل الغدة الدرقية TSH، هرمون الحليب Prolactin، وسونار المبايض).
    3) اقترحي عليها استخدام ميزة "تقرير الطبيبة (Medical Report)" المتاحة في القائمة الجانبية للتطبيق لطباعة أو عرض تاريخ دوراتها المسجلة للطبيبة مباشرة.
- قواعد التواريخ والحسابات:
  * تاريخ اليوم الحقيقي هو: ${todayDateStr}.
  * لا تخترعي أبداً تواريخ سابقة أو قادمة من عندكِ إذا لم تكن مسجلة في ملف المستخدمة المرفق أعلاه.
- التنسيق: استخدمي إيموجي لطيفة ومبهجة ونقاط واضحة تريح العين بدون إطالة مفرطة.${contextStats}`
      : `You are "Sarah" 💕, an exceptionally warm, loving, and highly intelligent AI health companion and supportive best friend on the SAFE Health platform. The user's name is "${userDisplayName}". Current Date is ${todayDateStr}. Respond with immense empathy, encouraging words, gentle self-care tips, and thoughtful medical reassurance.`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // Build list of candidate models to try
    let candidateModels = [model];
    if (isGroq) {
      candidateModels = [
        model,
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama3-8b-8192',
        'llama3-70b-8192',
        'gemma2-9b-it',
        'mixtral-8x7b-32768'
      ];
    }
    candidateModels = [...new Set(candidateModels.filter(Boolean))];

    let aiRes = null;
    let chosenModel = model;
    let lastErrorText = '';

    for (const cand of candidateModels) {
      chosenModel = cand;
      try {
        aiRes = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${rawKey}`
          },
          body: JSON.stringify({
            model: cand,
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 1000
          })
        });

        if (aiRes.ok) {
          break;
        }

        lastErrorText = await aiRes.text().catch(() => '');
        // If error is not a 404 (model not found), e.g. 401 unauthorized, break immediately
        if (aiRes.status !== 404 && !lastErrorText.includes('does not exist')) {
          break;
        }
      } catch (err) {
        lastErrorText = err.message;
      }
    }

    if (!aiRes || !aiRes.ok) {
      console.error('AI provider error:', aiRes?.status, lastErrorText);
      return res.status(200).json({
        success: false,
        configured: true,
        provider: isGroq ? 'Groq' : (isOpenRouter ? 'OpenRouter' : 'OpenAI'),
        error: `AI provider returned status ${aiRes?.status || 500}: ${lastErrorText}`
      });
    }

    const data = await aiRes.json();
    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(200).json({ success: false, error: 'Empty AI response from provider' });
    }

    return res.status(200).json({
      success: true,
      configured: true,
      provider: isGroq ? 'Groq' : (isOpenRouter ? 'OpenRouter' : 'OpenAI'),
      model: chosenModel,
      reply: reply,
      ai_reply: reply
    });
  } catch (err) {
    console.error('Serverless AI handler error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = handler;
module.exports.default = handler;
