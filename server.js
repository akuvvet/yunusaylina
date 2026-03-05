const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

const publicDir = path.join(__dirname, 'public');
const uploadDir = path.join(__dirname, 'uploads');
const metadataFile = path.join(uploadDir, 'metadata.json');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(express.static(publicDir));
app.use('/uploads', express.static(uploadDir));

function loadMetadata() {
  try {
    if (!fs.existsSync(metadataFile)) return {};
    const raw = fs.readFileSync(metadataFile, 'utf8');
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Fehler beim Laden der Metadaten', error);
    return {};
  }
}

function saveMetadata(data) {
  try {
    fs.writeFileSync(metadataFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Fehler beim Speichern der Metadaten', error);
  }
}

function getUploadedAtFromName(name) {
  const ts = Number(String(name).split('-')[0]);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return new Date(ts).toISOString();
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

function detectType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
  const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  return 'other';
}

app.post('/api/upload', upload.array('files', 50), (req, res) => {
  const metadata = loadMetadata();
  const uploader = (req.body && req.body.uploader) || null;

  const files = (req.files || []).map((file) => {
    metadata[file.filename] = {
      uploader,
    };

    return {
      id: file.filename,
      originalName: file.originalname,
      size: file.size,
      type: detectType(file.filename),
      url: `/uploads/${file.filename}`,
      uploadedAt: getUploadedAtFromName(file.filename),
      uploader,
    };
  });

  saveMetadata(metadata);

  res.json({ files });
});

app.get('/api/files', (_req, res) => {
  const metadata = loadMetadata();

  fs.readdir(uploadDir, (err, entries) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      return res.status(500).json({ error: 'Konnte Upload-Verzeichnis nicht lesen.' });
    }

    const files = entries
      .filter((name) => !name.startsWith('.'))
      .map((name) => {
        const uploadedAt = getUploadedAtFromName(name);
        const meta = metadata[name] || {};
        let size = null;
        try {
          size = fs.statSync(path.join(uploadDir, name)).size;
        } catch {
          size = null;
        }

        return {
          id: name,
          originalName: name.split('-').slice(1).join('-') || name,
          type: detectType(name),
          url: `/uploads/${name}`,
          uploadedAt,
          uploader: meta.uploader || null,
          size,
        };
      });

    return res.json({ files });
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server läuft auf http://localhost:${PORT}`);
});

