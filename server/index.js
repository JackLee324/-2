const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// ─── Data Paths ───────────────────────────────────────────────────────────────
const DATA_FILE     = path.join(__dirname, 'data', 'curriculum.json');
const GALLERY_FILE  = path.join(__dirname, 'data', 'olympic_gallery.json');
const UPLOAD_DIR    = path.join(__dirname, '..', 'public', 'assets', 'olympic');

// ─── Multer Config ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure upload directory exists
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ts = Date.now();
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${ts}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    fileFilter: (req, file, cb) => {
        // Comprehensive allowed types: images + videos
        const allowedExts = /\.(jpeg|jpg|png|webp|gif|heic|heif|mp4|mov|webm|avi|mkv)$/i;
        const allowedMimes = /^image\/(jpeg|png|webp|gif|heic|heif)|video\/(mp4|quicktime|webm|avi|x-msvideo)$/i;
        const extMatch = allowedExts.test(file.originalname);
        const mimeMatch = allowedMimes.test(file.mimetype);
        if (extMatch || mimeMatch) return cb(null, true);
        cb(new Error('Unsupported file type: ' + file.originalname), false);
    }
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Data Helpers ─────────────────────────────────────────────────────────────
function readData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify({ prek: [], k: [], climbing: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function readGallery() {
    if (!fs.existsSync(GALLERY_FILE)) {
        fs.mkdirSync(path.dirname(GALLERY_FILE), { recursive: true });
        fs.writeFileSync(GALLERY_FILE, JSON.stringify([], null, 2));
    }
    return JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf8'));
}

function writeGallery(data) {
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── GET /api/curriculum ─────────────────────────────────────────────────────
app.get('/api/curriculum', (req, res) => {
    try {
        const data = readData();
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── GET /api/curriculum/:tab ────────────────────────────────────────────────
app.get('/api/curriculum/:tab', (req, res) => {
    try {
        const { tab } = req.params;
        const validTabs = ['prek', 'k', 'climbing'];
        if (!validTabs.includes(tab)) {
            return res.status(400).json({ success: false, error: 'Invalid tab. Use: prek, k, climbing' });
        }
        const data = readData();
        res.json({ success: true, data: data[tab] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── PUT /api/curriculum/:tab ────────────────────────────────────────────────
app.put('/api/curriculum/:tab', (req, res) => {
    try {
        const { tab } = req.params;
        const validTabs = ['prek', 'k', 'climbing'];
        if (!validTabs.includes(tab)) {
            return res.status(400).json({ success: false, error: 'Invalid tab' });
        }
        const rows = req.body;
        if (!Array.isArray(rows)) {
            return res.status(400).json({ success: false, error: 'Body must be an array of rows' });
        }
        const data = readData();
        data[tab] = rows;
        writeData(data);
        res.json({ success: true, message: `${tab} updated with ${rows.length} rows` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── POST /api/curriculum/:tab ───────────────────────────────────────────────
app.post('/api/curriculum/:tab', (req, res) => {
    try {
        const { tab } = req.params;
        const validTabs = ['prek', 'k', 'climbing'];
        if (!validTabs.includes(tab)) {
            return res.status(400).json({ success: false, error: 'Invalid tab. Use: prek, k, climbing' });
        }
        const newRow = req.body;
        if (!newRow || !newRow.week || !newRow.month || !newRow.unit || !newRow.subunit) {
            return res.status(400).json({ success: false, error: 'Missing required fields: week, month, unit, subunit' });
        }
        const data = readData();
        const cleanRow = {
            week: String(newRow.week),
            month: String(newRow.month),
            unit: String(newRow.unit),
            subunit: String(newRow.subunit || ''),
            wd: String(newRow.wd || ''),
            events: String(newRow.events || ''),
            bgColor: String(newRow.bgColor || ''),
            textColor: String(newRow.textColor || ''),
        };
        if (newRow.holiday) cleanRow.holiday = String(newRow.holiday);
        if (newRow.semester) cleanRow.semester = String(newRow.semester);
        data[tab].push(cleanRow);
        writeData(data);
        res.json({ success: true, row: cleanRow });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── DELETE /api/curriculum/:tab/:week ───────────────────────────────────────
app.delete('/api/curriculum/:tab/:week', (req, res) => {
    try {
        const { tab, week } = req.params;
        const validTabs = ['prek', 'k', 'climbing'];
        if (!validTabs.includes(tab)) {
            return res.status(400).json({ success: false, error: 'Invalid tab' });
        }
        const data = readData();
        const idx = data[tab].findIndex(row =>
            row.week === week || (row.holiday && row.holiday === week) || (row.semester && row.semester === week)
        );
        if (idx === -1) {
            return res.status(404).json({ success: false, error: 'Row not found' });
        }
        const deleted = data[tab].splice(idx, 1)[0];
        writeData(data);
        res.json({ success: true, deleted });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Olympic Gallery API ─────────────────────────────────────────────────────

// GET /api/gallery — return all gallery items
app.get('/api/gallery', (req, res) => {
    try {
        const items = readGallery();
        res.json({ success: true, data: items });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Multer error handler middleware
function handleMulterError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ success: false, error: '文件大小超过200MB限制' });
        }
        return res.status(400).json({ success: false, error: '上传错误: ' + err.message });
    }
    if (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
    next();
}

// POST /api/upload — upload image or video
app.post('/api/upload', upload.single('file'), handleMulterError, (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file received' });
        }
        const isVideo = /mp4|mov|webm/i.test(path.extname(req.file.originalname));
        const item = {
            id: Date.now().toString(),
            filename: req.file.filename,
            originalName: req.file.originalname,
            type: isVideo ? 'video' : 'image',
            caption: req.body.caption || '',
            date: req.body.date || '',
            uploadedAt: new Date().toISOString(),
        };
        const gallery = readGallery();
        gallery.unshift(item); // newest first
        writeGallery(gallery);
        res.json({ success: true, item });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /api/gallery/:id — update caption/date
app.put('/api/gallery/:id', (req, res) => {
    try {
        const { id } = req.params;
        const gallery = readGallery();
        const idx = gallery.findIndex(item => item.id === id);
        if (idx === -1) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        gallery[idx] = { ...gallery[idx], ...req.body, id }; // merge, preserve id
        writeGallery(gallery);
        res.json({ success: true, item: gallery[idx] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/gallery/:id — remove gallery item and physical file
app.delete('/api/gallery/:id', (req, res) => {
    try {
        const { id } = req.params;
        const gallery = readGallery();
        const idx = gallery.findIndex(item => item.id === id);
        if (idx === -1) {
            return res.status(404).json({ success: false, error: 'Item not found' });
        }
        const deleted = gallery.splice(idx, 1)[0];
        writeGallery(gallery);
        // Remove physical file
        const filePath = path.join(UPLOAD_DIR, deleted.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.json({ success: true, deleted });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Static File Serving ───────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🏅 Tsinglan PE CMS running at http://localhost:${PORT}`);
    console.log(`📋 Public page:  http://localhost:${PORT}/`);
    console.log(`⚙️  Admin panel: http://localhost:${PORT}/admin`);
    console.log(`📁 Curriculum:   ${DATA_FILE}`);
    console.log(`📁 Gallery DB:  ${GALLERY_FILE}`);
    console.log(`📁 Upload dir:   ${UPLOAD_DIR}\n`);
});
