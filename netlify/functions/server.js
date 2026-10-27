const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getStore } = require('@netlify/blobs');
const serverless = require('serverless-http');

const app = express();

const createLocalFallbackStore = name => {
  const localDir = path.join(__dirname, '..', '..', '.netlify-local', name);
  fs.mkdirSync(localDir, { recursive: true });

  return {
    async get(key) {
      const file = path.join(localDir, key);
      if (!fs.existsSync(file)) return null;
      return fs.readFileSync(file, 'utf8');
    },
    async set(key, value) {
      const file = path.join(localDir, key);
      const payload = typeof value === 'string' ? value : Buffer.from(value);
      fs.writeFileSync(file, payload);
    },
    async delete(key) {
      const file = path.join(localDir, key);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
    async getURL(key) {
      const file = path.join(localDir, key);
      if (!fs.existsSync(file)) return null;
      return `data:${(await this.getMimeType(key))};base64,${fs.readFileSync(file).toString('base64')}`;
    },
    async getMimeType(key) {
      const file = path.join(localDir, key);
      if (!fs.existsSync(file)) return 'application/octet-stream';
      const ext = path.extname(file).toLowerCase();
      const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
      return mimeMap[ext] || 'application/octet-stream';
    }
  };
};

const createStore = name => {
  const hasNetlifyBlobsConfig = Boolean(process.env.NETLIFY_BLOBS_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN);
  if (hasNetlifyBlobsConfig) {
    return getStore({ name, siteID: process.env.NETLIFY_BLOBS_SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  }
  return createLocalFallbackStore(name);
};

const messageStore = createStore('birthday-message');
const photoStore = createStore('birthday-photos');

const readJson = async (store, fallback, key) => {
  try {
    const raw = await store.get(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = async (store, value, key) => {
  await store.set(key, JSON.stringify(value, null, 2));
};

app.use(express.json({ limit: '100kb' }));

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (allowedTypes.has(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error('Only JPG, JPEG, PNG, and WebP files are allowed.'), { status: 400 }));
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', deployment: 'netlify', uploads: true });
});

app.get('/api/message', async (req, res) => {
  const fallback = {
    name: 'My Favorite Person',
    heading: 'To Someone Truly Special ❤️',
    message: 'Today is a celebration of you, your smile, your happiness, and all the wonderful moments ahead. May your life always be filled with love, laughter, success, and unforgettable memories. Happy Birthday! 🎂❤️'
  };

  const message = await readJson(messageStore, fallback, 'message.json');
  res.json(message);
});

app.put('/api/message', async (req, res) => {
  const token = process.env.MESSAGE_ADMIN_TOKEN;

  if (token && req.get('x-admin-token') !== token) {
    return res.status(401).json({ error: 'Unauthorized. Provide the configured admin token.' });
  }

  const { name, heading, message } = req.body || {};
  if (!name || !heading || !message) {
    return res.status(400).json({ error: 'name, heading, and message are required.' });
  }

  if ([name, heading, message].some(value => typeof value !== 'string' || value.length > 5000)) {
    return res.status(400).json({ error: 'Text values must be strings under 5000 characters.' });
  }

  const updated = {
    name: name.trim(),
    heading: heading.trim(),
    message: message.trim()
  };

  await writeJson(messageStore, updated, 'message.json');
  res.json(updated);
});

app.get('/api/photos', async (req, res) => {
  const photos = await readJson(photoStore, [], 'photos.json');
  res.json(photos);
});

app.post('/api/photos', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A photo file is required.' });

    const caption = String(req.body.caption || '').trim().slice(0, 120);
    const ext = req.file.originalname?.includes('.') ? `.${req.file.originalname.split('.').pop()}` : '.png';
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

    await photoStore.set(filename, req.file.buffer, {
      contentType: req.file.mimetype || 'image/png'
    });

    const photos = await readJson(photoStore, [], 'photos.json');
    const photo = {
      id: crypto.randomUUID(),
      filename,
      url: await photoStore.getURL(filename),
      caption,
      createdAt: new Date().toISOString()
    };

    photos.unshift(photo);
    await writeJson(photoStore, photos, 'photos.json');
    res.status(201).json(photo);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/photos/:id', async (req, res) => {
  const token = process.env.MESSAGE_ADMIN_TOKEN;

  if (token && req.get('x-admin-token') !== token) {
    return res.status(401).json({ error: 'Unauthorized. Provide the configured admin token.' });
  }

  const photos = await readJson(photoStore, [], 'photos.json');
  const photo = photos.find(item => item.id === req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found.' });

  try {
    await photoStore.delete(photo.filename);
  } catch (_) {
    // It is safe to ignore this when a blob is already missing.
  }

  const updatedPhotos = photos.filter(item => item.id !== photo.id);
  await writeJson(photoStore, updatedPhotos, 'photos.json');
  res.status(204).send();
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error instanceof multer.MulterError || error.status === 400) {
    return res.status(error.status || 400).json({
      error: error.code === 'LIMIT_FILE_SIZE' ? 'Photo must be 5 MB or smaller.' : error.message
    });
  }
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

exports.handler = serverless(app);
