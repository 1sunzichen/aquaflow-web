/**
 * 本地开发服务器
 * 用法：node server.js
 * 访问：http://localhost:8080
 *
 * 提供 /api/volunteers 接口，自动扫描 image/volunteers/ 目录下的所有图片，
 * 以及 /api/record-images?slug=... 接口，自动扫描对应记录目录下的图片，
 * 无需手动维护 manifest.json。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.webp': 'image/webp',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
};

function listImages(dir, basePath) {
    let files;
    try {
        files = fs.readdirSync(dir)
            .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
            .sort();
    } catch {
        files = [];
    }

    return files.map(f => ({
        file: `/${basePath}/${f}`,
        title: path.basename(f, path.extname(f)).replace(/[-_]+/g, ' '),
        caption: ''
    }));
}

function serveApi(res) {
    const dir = path.join(ROOT, 'image', 'volunteers');
    const images = listImages(dir, 'image/volunteers');
    const body = JSON.stringify({ images });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
}

function serveRecordImages(req, res) {
    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
    const slug = (requestUrl.searchParams.get('slug') || '').replace(/[^a-zA-Z0-9-_]/g, '');

    if (!slug) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing slug' }));
        return;
    }

    const dir = path.join(ROOT, 'content', 'records', slug, 'images');
    const images = listImages(dir, `content/records/${slug}/images`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ images }));
}

function serveFile(urlPath, res) {
    const decoded = decodeURIComponent(urlPath);
    const filePath = path.join(ROOT, decoded === '/' ? 'index.html' : decoded);
    const ext = path.extname(filePath).toLowerCase();

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];

    if (urlPath === '/api/volunteers') {
        serveApi(res);
    } else if (urlPath === '/api/record-images') {
        serveRecordImages(req, res);
    } else {
        serveFile(urlPath, res);
    }
}).listen(PORT, () => {
    console.log(`\n  AQUAFLOW 本地服务已启动`);
    console.log(`  访问地址：http://localhost:${PORT}\n`);
    console.log(`  志愿者图片放入 image/volunteers/，记录图片放入 content/records/<slug>/images/ 后刷新页面即可。\n`);
});
