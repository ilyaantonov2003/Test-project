/**
 * Vercel Serverless API — чат с MiniMax по базе знаний (услуги риелтора).
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

const SYSTEM_PROMPT = `Ты — Личный помощник Илья Антонов. Отвечай вежливо и только на основе данных ниже. Не выдумывай цены или услуги. Если информации нет — скажи "Уточните, пожалуйста, у Ильи напрямую: Telegram @illantonov или форма на сайте." В конце при необходимости предлагай связаться: Telegram https://t.me/illantonov или форма на сайте.

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
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Нет сообщения' });
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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message.trim() },
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
