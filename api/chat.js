/**
 * Vercel Serverless API — чат с MiniMax по базе знаний (услуги риелтора).
 * По запросам на объекты — поиск через DuckDuckGo HTML (без API-ключа), результат подставляется в ответ.
 * Переменная окружения: MINIMAX_API_KEY
 */

const KNOWLEDGE_STR = JSON.stringify([
  { q: "Какие услуги оказывает риелтор?", a: "Услуги: консультация по купле-продаже и аренде недвижимости; подбор объектов; организация просмотров; юридическая проверка документов и объекта; ведение переговоров; сопровождение сделки до регистрации в Росреестре; помощь в ипотеке и сделках с загородной недвижимостью." },
  { q: "Сколько стоят услуги риелтора в Москве?", a: "Стоимость в Москве: сделки купли-продажи квартир на вторичном рынке — от 35 000 до 150 000 рублей за сделку; на платформах вроде Профи.ру — от 65 000 руб. Альтернатива: 1–3% от суммы сделки. Фиксированная помощь в покупке двухкомнатной квартиры — в среднем около 250 000 руб." },
  { q: "Цены на услуги риелтора", a: "Купля-продажа квартиры (вторичка): 35 000 – 150 000 руб. или 1–3% от суммы. Загородная и элитная недвижимость: от 200 000 руб. Аренда: от 15 000 до 50 000 руб. или 50–100% от месячной арендной платы." },
  { q: "Как связаться с Ильёй Антоновым?", a: "Связаться с Ильёй Антоновым: Telegram — https://t.me/illantonov, email — ilyaantonov06022003@gmail.com. На сайте есть форма «Оставьте свои данные». Напишите в Telegram или через форму." },
  { q: "Контакты Илья Антонов", a: "Илья Антонов: Telegram @illantonov (https://t.me/illantonov), email ilyaantonov06022003@gmail.com. Для консультации — напишите в Telegram или заполните форму на сайте." },
  { q: "Услуги по аренде недвижимости", a: "Услуги по аренде: подбор объекта, просмотры, проверка документов и договора, сопровождение сделки. Стоимость: от 15 000 до 50 000 руб. или 50–100% от месячной арендной платы." },
  { q: "Сопровождение сделки с недвижимостью", a: "Сопровождение сделки: проверка юридической чистоты, подготовка документов, переговоры, контроль до регистрации в Росреестре. Цена зависит от типа недвижимости и суммы сделки." }
]);

// Запрос похож на подбор объектов/вариантов недвижимости?
function isListingRequest(text) {
  const t = (text || '').toLowerCase();
  const keywords = ['объект', 'объекты', 'подбор', 'подбери', 'варианты', 'вариант', 'квартир', 'квартира', 'студи', 'недвижимость', 'искать', 'посмотреть', 'покажи', 'есть ли', 'найди', 'подобрать', 'аренд', 'продаж', 'купл', 'комнат', 'дом', 'жиль'];
  return keywords.some(kw => t.includes(kw));
}

// Поиск через DuckDuckGo HTML (без API-ключа). База: "аренда" или "продажа" недвижимости москва + запрос пользователя
async function searchListingsDuckDuckGo(userMessage) {
  const t = (userMessage || '').toLowerCase();
  const isSale = /продаж|купл|купить|продать|покупк/.test(t);
  const base = isSale ? 'продажа недвижимости москва' : 'аренда недвижимости москва';
  const query = (userMessage && userMessage.trim())
    ? `${base} ${userMessage.trim()}`
    : base;
  try {
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ q: query }).toString(),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Парсим результат: result__a (заголовок + ссылка), result__snippet (описание)
    const results = [];
    const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="(?:https?:\/\/duckduckgo\.com\/l\/\?uddg=)?([^"&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    const links = [];
    while ((m = linkRe.exec(html)) !== null) {
      let url = (m[1] || '').trim();
      if (url.includes('%')) try { url = decodeURIComponent(url); } catch (_) {}
      if (!url.startsWith('http')) url = 'https://' + url.replace(/^\/\//, '');
      const title = (m[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (title && title.length > 2 && !/duckduckgo|feedback/i.test(title))
        links.push({ url, title });
    }
    const snippets = [];
    while ((m = snippetRe.exec(html)) !== null) {
      const snip = (m[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (snip && snip.length > 10) snippets.push(snip);
    }
    for (let i = 0; i < Math.min(6, links.length); i++) {
      const link = links[i];
      const snippet = snippets[i] || '';
      results.push(`${i + 1}. ${link.title}\n   ${snippet}\n   ${link.url}`);
    }
    return results.length ? results.join('\n\n') : null;
  } catch (_) {
    return null;
  }
}

const SYSTEM_PROMPT_BASE = `Ты — Личный помощник Илья Антонов. Отвечай вежливо. Опирайся на данные ниже и при наличии — на блок "Поиск в интернете" (это примерные варианты для разговора; актуальный подбор и просмотры делает Илья). Не выдумывай цены или адреса. Если информации нет — предложи написать Илье: Telegram @illantonov или форма на сайте. В конце при необходимости: Telegram https://t.me/illantonov или форма на сайте.

Данные об услугах и контактах:
${KNOWLEDGE_STR}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Сервер: не настроен MINIMAX_API_KEY. Добавьте ключ в Vercel → Project → Settings → Environment Variables.' });
  }
  const { message } = req.body || {};
  const userText = message && typeof message === 'string' ? message.trim() : '';
  if (!userText) {
    return res.status(400).json({ error: 'Нет сообщения' });
  }

  let systemPrompt = SYSTEM_PROMPT_BASE;
  if (isListingRequest(userText)) {
    const searchText = await searchListingsDuckDuckGo(userText);
    if (searchText) {
      systemPrompt += `\n\nПоиск в интернете (DuckDuckGo, примерные варианты для ориентира):\n${searchText}\n\nКратко перескажи эти варианты в разговоре как примерный обзор; уточни, что точный подбор и актуальные цены — у Ильи (Telegram, форма на сайте).`;
    }
  }

  try {
    const response = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'M2-her',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
        max_completion_tokens: 1024,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (data.base_resp && data.base_resp.status_code !== 0) {
      const code = data.base_resp.status_code;
      const msg = (data.base_resp.status_msg || '').toLowerCase();
      // Недостаточно баланса на MiniMax — показываем вежливый ответ с контактами и услугами
      if (code === 1008 || msg.includes('insufficient balance') || msg.includes('balance')) {
        return res.status(200).json({
          response: 'Сейчас я временно не могу ответить (закончился баланс сервиса). Напишите Илье напрямую — он ответит вам лично.\n\n' +
            'Telegram: @illantonov — https://t.me/illantonov\n' +
            'Или оставьте заявку через форму на сайте.\n\n' +
            'Услуги: консультации по недвижимости, купля-продажа и аренда; цены от 35 000 ₽ за сделку, аренда от 15 000 ₽.'
        });
      }
      return res.status(500).json({ error: data.base_resp.status_msg || 'Ошибка MiniMax API' });
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'Пустой ответ от модели' });
    }
    return res.status(200).json({ response: content });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('insufficient balance') || msg.includes('balance')) {
      return res.status(200).json({
        response: 'Сейчас я временно не могу ответить (закончился баланс сервиса). Напишите Илье в Telegram @illantonov (https://t.me/illantonov) или через форму на сайте — он ответит лично. Услуги: недвижимость, купля-продажа и аренда; цены от 35 000 ₽.'
      });
    }
    return res.status(500).json({ error: err.message || 'Ошибка запроса к AI' });
  }
}
