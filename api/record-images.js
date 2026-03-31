/**
 * Vercel Serverless Function
 * GET /api/record-images?slug=... → 返回对应记录目录 images/ 下所有图片列表
 */

const fs = require('fs');
const path = require('path');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

module.exports = (req, res) => {
    const slug = String(req.query.slug || '').replace(/[^a-zA-Z0-9-_]/g, '');

    if (!slug) {
        res.status(400).json({ error: 'Missing slug' });
        return;
    }

    const dir = path.join(__dirname, '..', 'content', 'records', slug, 'images');
    let files = [];
    try {
        files = fs.readdirSync(dir)
            .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
            .sort();
    } catch { /* 目录不存在时返回空列表 */ }

    const images = files.map(f => ({
        file: `/content/records/${slug}/images/${f}`,
        title: path.basename(f, path.extname(f)).replace(/[-_]+/g, ' '),
        caption: ''
    }));

    res.setHeader('Content-Type', 'application/json');
    res.json({ images });
};
