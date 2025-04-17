require('dotenv').config();
const { OpenAI } = require('openai');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const MAX_TOKENS = parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 1500;
const TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.2;

const openai = new OpenAI({ apiKey: API_KEY });

/**
 * GPT’den yapılandırılmış JSON alır, parse eder ve obje olarak döner.
 * @param {string} prompt Kullanıcıdan gelen prompt
 * @returns {Promise<Object>} { sheets: [ { name, headers, rows, ... } ] }
 */
async function generateStructuredJSON(prompt) {
  const systemMessage = `
Sen profesyonel bir Excel uzmanısın.
Kullanıcının açıklamasına göre aşağıdaki formatta SADECE JSON döndür:
{
  "sheets": [
    {
      "name": "Sayfa Adı",
      "headers": ["Başlık1","Başlık2",...],
      "rows": [
        ["Değer1", 123, ...],
        ...
      ],
      // opsiyonel: stillendirme bilgisi
      "headerStyle": { "bold": true, "fontColor": "FF0000", "fillColor": "FFFF00" }
    },
    ...
  ]
}
JSON dışında hiçbir çıktı üretme (no markdown, no fences, no açıklama).
  `.trim();

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS
      });

      const raw = resp.choices?.[0]?.message?.content;
      if (!raw) throw new Error('GPT’den içerik gelmedi');

      const jsonText = (() => {
        const m = raw.match(/\{[\s\S]*\}$/);
        return m ? m[0] : raw.trim();
      })();

      try {
        return JSON.parse(jsonText);
      } catch (err) {
        throw new Error(`JSON parse hatası: ${err.message}\nRaw GPT output:\n${raw}`);
      }

    } catch (err) {
      if (attempt === 2) throw err;
      console.warn(`GPT çağrısı başarısız (deneme ${attempt}), retry:`, err.message);
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

module.exports = { generateStructuredJSON };
