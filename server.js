/**
 * 本地开发服务器
 * 用法：node server.js
 * 访问：http://localhost:8080
 *
 * 提供 /api/volunteers 接口，自动扫描 image/volunteers/ 目录下的所有图片，
 * 无需手动维护 manifest.json。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

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

function serveApi(res) {
    const dir = path.join(ROOT, 'image', 'volunteers');
    let files;
    try {
        files = fs.readdirSync(dir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase())).sort();
    } catch {
        files = [];
    }

    const images = files.map(f => ({
        file: `image/volunteers/${f}`,
        title: path.basename(f, path.extname(f)).replace(/[-_]+/g, ' '),
        caption: ''
    }));

    const body = JSON.stringify({ images });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
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
    } else {
        serveFile(urlPath, res);
    }
}).listen(PORT, () => {
    console.log(`\n  AQUAFLOW 本地服务已启动`);
    console.log(`  访问地址：http://localhost:${PORT}\n`);
    console.log(`  把图片放入 image/volunteers/ 后刷新页面即可，无需其他操作。\n`);
});
