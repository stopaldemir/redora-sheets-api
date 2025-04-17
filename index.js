require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const morgan        = require('morgan');
const path          = require('path');

const generateRoute = require('./routes/generate');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

app.use('/output', express.static(path.resolve(__dirname, '../output')));

app.use('/api/generate', generateRoute);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use((err, _req, res, _next) => {
  console.error('🌐 Global Error:', err);
  res.status(500).json({ error: 'Sunucuda beklenmedik hata', details: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🟢 Backend running on http://localhost:${PORT}`);
});
