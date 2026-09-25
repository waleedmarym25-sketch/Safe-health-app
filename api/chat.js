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
- النصائح والحلول: قدمي دائماً نصائح لطيفة ومريحة وعملية (مشروبات دافئة مهدئة كالنعناع والبابونج والزنجبيل، تدليل النفس، شوكولاتة داكنة، كمادات دافئة، وضعيات نوم مريحة كوضعية الجنين، تغذية معززة للحديد والطاقة، وتسكين المغص والألم).
- التحليل الشامل لكافة الدورات (Multi-Cycle Comprehensive Analysis):
  * عند سؤال المستخدمة عن تحليل دوراتها أو رأيك في مواعيدها، قومي بتحليل متكامل لكافة الدورات المسجلة في ملفها وليس فقط آخر دورة.
  * قارني بين أطوال الدورات (مثلاً إذا كانت هناك دورة 40 يوماً وأخرى 28 يوماً)، ووضحي متوسط الدورة المرجح ونسبة التفاوت والأسباب الطبيعية للتأخر (التوتر، تقلبات الوزن، إجهاد الدراسة/العمل).
- الإرشادات الطبية لتأخر الدورة (Delayed Period):
  * إذا ذكرت المستخدمة أو لوحظ أن دورتها متأخرة لأكثر من 7 إلى 10 أيام أو بها تفاوت ملحوظ:
    1) طمئنيها بكلمات دافئة بأن التأخر المؤقت لأيام معدودة شائع وطبيعي نتيجة التوتر، الإجهاد، أو تغير نمط النوم.
    2) انصحيها بوضوح ولطف بأهمية استشارة طبيبة نساء وتوليد متخصصة للاطمئنان وعمل فحص هرموني أساسي (مثل الغدة الدرقية TSH، هرمون الحليب Prolactin، وسونار المبايض لاستبعاد تكيس المبايض PCOS).
    3) اقترحي عليها استخدام ميزة "تقرير الطبيبة (Medical Report)" المتاحة في القائمة الجانبية للتطبيق لطباعة أو عرض تاريخ دوراتها المسجلة للطبيبة مباشرة لمساعدتها في التشخيص.
- قواعد التواريخ والحسابات:
  * تاريخ اليوم الحقيقي هو: ${todayDateStr}.
  * لا تخترعي أبداً تواريخ سابقة أو قادمة من عندكِ إذا لم تكن مسجلة في ملف المستخدمة المرفق أعلاه.
  * إذا قالت المستخدمة أن دورتها قادمة بعد X أيام (مثلاً "الدورة هتيجي بعد 3 أيام")، فهذا يعني أن موعدها القادم هو بعد X أيام، وأنها حالياً في مرحلة ما قبل الطمث (PMS)، فقدمي نصائح الاستعداد والراحة ولا تفترضي أن دورتها بدأت اليوم.
- التنسيق: استخدمي إيموجي لطيفة ومبهجة ونقاط واضحة تريح العين بدون إطالة مفرطة.${contextStats}`
      : `You are "Sarah" 💕, an exceptionally warm, loving, and highly intelligent AI health companion and supportive best friend on the SAFE Health platform. The user's name is "${userDisplayName}". Current Date is ${todayDateStr}. Respond with immense empathy, encouraging words, gentle self-care tips, and thoughtful medical reassurance. When a period delay exceeds 7-10 days, gently recommend consulting a gynecologist for a routine checkup and suggest using the app's Medical Summary Report feature.`;

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
