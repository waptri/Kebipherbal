// server.js
const express = require('express');
const axios = require('axios');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();

// parse JSON
app.use(bodyParser.json());

// serve your public folder
app.use(express.static(path.join(__dirname, 'public')));

// === MPESA CONFIG ===
const BUSINESS_SHORT_CODE = '174379';
const PASSKEY = 'process.env.MPESA_CONSUMER_KEY';
const CONSUMER_KEY = 'process.env.MPESA_CONSUMER_KEY';
const CONSUMER_SECRET = 'process.env.MPESA_CONSUMER_SECRET';
const CALLBACK_URL = 'https://your-ngrok-url.ngrok-free.app/callback'; // update with your ngrok URL

// helpers
function getTimestamp() {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0')
  );
}

function generatePassword(timestamp) {
  const passString = BUSINESS_SHORT_CODE + PASSKEY + timestamp;
  return Buffer.from(passString).toString('base64');
}

async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return response.data.access_token;
}

// STK Push endpoint
app.post('/mpesa/stkpush', async (req, res) => {
  const { amount, phone } = req.body;

  // Basic validation
  if (!/^2547\d{8}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number. Must start with 2547XXXXXXXX' });
  }

  const timestamp = getTimestamp();
  const password = generatePassword(timestamp);

  try {
    const token = await getAccessToken();

    const payload = {
      BusinessShortCode: BUSINESS_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: BUSINESS_SHORT_CODE,
      PhoneNumber: phone,
      CallBackURL: CALLBACK_URL,
      AccountReference: 'Test',
      TransactionDesc: 'Test Payment'
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res.status(500).json(err.response ? err.response.data : { error: err.message });
  }
});

// Callback endpoint
app.post('/callback', (req, res) => {
  console.log('Callback received:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
