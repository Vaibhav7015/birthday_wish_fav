require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
const photosFile = path.join(dataDir, 'photos.json');
const messageFile = path.join(dataDir, 'message.json');

for (const dir of [uploadsDir, dataDir]) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(photosFile)) fs.writeFileSync(photosFile, '[]');
if (!fs.existsSync(messageFile)) fs.writeFileSync(messageFile, JSON.stringify({
  name: 'My Favorite Person',
  heading: 'To Someone Truly Special ❤️',
  message: 'Today is a celebration of you, your smile, your happiness, and all the wonderful moments ahead. May your life always be filled with love, laughter, success, and unforgettable memories. Happy Birthday! 🎂❤️'
}, null, 2));

app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
};
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2));

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => allowedTypes.has(file.mimetype)
    ? cb(null, true)
    : cb(Object.assign(new Error('Only JPG, JPEG, PNG, and WebP files are allowed.'), { status: 400 }))
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', uploads: true }));
app.get('/api/message', (req, res) => res.json(readJson(messageFile, {})));
app.get('/api/photos', (req, res) => res.json(readJson(photosFile, [])));

app.put('/api/message', (req, res, next) => {
  const token = process.env.MESSAGE_ADMIN_TOKEN;
  if (token && req.get('x-admin-token') !== token) {
    return res.status(401).json({ error: 'Unauthorized. Provide the configured admin token.' });
  }
  const { name, heading, message } = req.body || {};
  if (!name || !heading || !message) return res.status(400).json({ error: 'name, heading, and message are required.' });
  if ([name, heading, message].some(value => typeof value !== 'string' || value.length > 5000)) {
    return res.status(400).json({ error: 'Text values must be strings under 5000 characters.' });
  }
  const updated = { name: name.trim(), heading: heading.trim(), message: message.trim() };
  writeJson(messageFile, updated);
  res.json(updated);
});

app.post('/api/photos', (req, res, next) => {
  upload.single('photo')(req, res, error => {
    if (error) return next(error);
    if (!req.file) return res.status(400).json({ error: 'A photo file is required.' });
    const caption = String(req.body.caption || '').trim().slice(0, 120);
    const photos = readJson(photosFile, []);
    const photo = {
      id: crypto.randomUUID(),
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      caption,
      createdAt: new Date().toISOString()
    };
    photos.unshift(photo);
    writeJson(photosFile, photos);
    res.status(201).json(photo);
  });
});

app.delete('/api/photos/:id', (req, res) => {
  const token = process.env.MESSAGE_ADMIN_TOKEN;
  if (token && req.get('x-admin-token') !== token) {
    return res.status(401).json({ error: 'Unauthorized. Provide the configured admin token.' });
  }
  const photos = readJson(photosFile, []);
  const photo = photos.find(item => item.id === req.params.id);
  if (!photo) return res.status(404).json({ error: 'Photo not found.' });
  const safeName = path.basename(photo.filename);
  const filePath = path.join(uploadsDir, safeName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  writeJson(photosFile, photos.filter(item => item.id !== photo.id));
  res.status(204).send();
});

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (error instanceof multer.MulterError || error.status === 400) {
    return res.status(error.status || 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Photo must be 5 MB or smaller.' : error.message });
  }
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => console.log(`Birthday website running at http://localhost:${PORT}`));
