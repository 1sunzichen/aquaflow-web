/**
 * Vercel Serverless Function
 * GET /api/volunteers → 返回 image/volunteers/ 下所有图片列表
 */

const fs = require('fs');
const path = require('path');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

module.exports = (req, res) => {
    const dir = path.join(__dirname, '..', 'image', 'volunteers');
    let files = [];
    try {
        files = fs.readdirSync(dir)
            .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
            .sort();
    } catch { /* 目录不存在时返回空列表 */ }

    const images = files.map(f => ({
        file: `image/volunteers/${f}`,
        title: path.basename(f, path.extname(f)).replace(/[-_]+/g, ' '),
        caption: ''
    }));

    res.setHeader('Content-Type', 'application/json');
    res.json({ images });
};
