const contentCollections = {
    plans: {
        manifestPath: 'content/plans/manifest.json',
        listId: 'plans-list',
        detailId: 'plans-detail',
        countId: 'plans-count',
        emptyMessage: '还没有计划内容。',
        errorMessage: '计划内容暂时无法加载。'
    },
    records: {
        manifestPath: 'content/records/manifest.json',
        listId: 'records-list',
        detailId: 'records-detail',
        countId: 'records-count',
        emptyMessage: '还没有记录内容。',
        errorMessage: '记录内容暂时无法加载。'
    }
};

const collectionState = {
    plans: [],
    records: []
};

let revealObserver = null;

const DETAIL_META_EXCLUDED_KEYS = new Set([
    'map_title',
    'map_query',
    'map_note',
    'gallery_title',
    'gallery_images',
    'service_hours',
    'volunteer_benefit',
    'water_plan',
    'hiking_time',
    'activity_items',
    'dinner_plan'
]);

function switchModule(moduleId) {
    document.querySelectorAll('.module').forEach(module => module.classList.remove('active'));
    const target = document.getElementById(moduleId);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(moduleId)) {
            link.classList.add('active');
        }
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });

    if (target) {
        prepareScrollReveal(target);
    }
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.style.display = modal.classList.contains('photo-modal') ? 'flex' : 'block';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function openMapModal(title, url, locationText, note) {
    const modal = document.getElementById('modal-map');
    const titleEl = document.getElementById('map-modal-title');
    const locationEl = document.getElementById('map-modal-location');
    const noteEl = document.getElementById('map-modal-note');
    const frameEl = document.getElementById('map-modal-frame');
    const linkEl = document.getElementById('map-modal-link');

    if (!modal || !titleEl || !locationEl || !noteEl || !frameEl || !linkEl) return;

    titleEl.textContent = title;
    locationEl.textContent = locationText;
    noteEl.textContent = note;
    frameEl.src = url;
    linkEl.href = url;
    modal.style.display = 'block';
}

function updateTime() {
    const timeEl = document.getElementById('system-time');
    if (!timeEl) return;

    const now = new Date();
    timeEl.textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function parseFrontMatter(raw) {
    if (!raw.startsWith('---')) {
        return { meta: {}, body: raw.trim() };
    }

    const parts = raw.split('---');
    if (parts.length < 3) {
        return { meta: {}, body: raw.trim() };
    }

    const meta = {};
    parts[1].trim().split('\n').forEach(line => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) return;
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        meta[key] = value;
    });

    return {
        meta,
        body: parts.slice(2).join('---').trim()
    };
}

function resolveAssetPath(assetPath, docPath) {
    if (!assetPath) return '';
    if (/^(https?:|mailto:|tel:|data:)/i.test(assetPath) || assetPath.startsWith('/')) {
        return assetPath;
    }

    return new URL(assetPath, new URL(docPath, window.location.href)).toString();
}

function createToken(tokens, html) {
    const token = `@@TOKEN_${tokens.length}@@`;
    tokens.push({ token, html });
    return token;
}

function formatInlineMarkdown(text, docPath) {
    const tokens = [];

    let working = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
        const resolved = resolveAssetPath(src.trim(), docPath);
        return createToken(tokens, `<img src="${escapeHtml(resolved)}" alt="${escapeHtml(alt.trim())}" class="detail-inline-image">`);
    });

    working = working.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
        const resolved = resolveAssetPath(href.trim(), docPath);
        const isExternal = /^(https?:|mailto:|tel:)/i.test(resolved);
        const attrs = isExternal ? ' target="_blank" rel="noreferrer"' : '';
        return createToken(tokens, `<a href="${escapeHtml(resolved)}"${attrs}>${escapeHtml(label.trim())}</a>`);
    });

    working = escapeHtml(working)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');

    tokens.forEach(({ token, html }) => {
        working = working.replace(token, html);
    });

    return working;
}

function markdownToHtml(markdown, docPath) {
    const lines = markdown.split('\n');
    const blocks = [];
    let paragraph = [];
    let listItems = [];

    function flushParagraph() {
        if (paragraph.length) {
            blocks.push(`<p>${paragraph.map(line => formatInlineMarkdown(line, docPath)).join('<br>')}</p>`);
            paragraph = [];
        }
    }

    function flushList() {
        if (listItems.length) {
            blocks.push(`<ul>${listItems.map(item => `<li>${formatInlineMarkdown(item, docPath)}</li>`).join('')}</ul>`);
            listItems = [];
        }
    }

    lines.forEach(line => {
        const trimmed = line.trim();

        if (!trimmed) {
            flushParagraph();
            flushList();
            return;
        }

        const imageOnlyMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imageOnlyMatch) {
            flushParagraph();
            flushList();
            const [, alt, src] = imageOnlyMatch;
            const resolved = resolveAssetPath(src.trim(), docPath);
            blocks.push(`
                <figure class="detail-figure">
                    <img src="${escapeHtml(resolved)}" alt="${escapeHtml(alt.trim())}" class="detail-figure-image">
                    ${alt.trim() ? `<figcaption>${escapeHtml(alt.trim())}</figcaption>` : ''}
                </figure>
            `);
            return;
        }

        if (/^#{1,4}\s/.test(trimmed)) {
            flushParagraph();
            flushList();
            const level = trimmed.match(/^#+/)[0].length;
            const text = trimmed.slice(level).trim();
            blocks.push(`<h${Math.min(level + 1, 6)}>${formatInlineMarkdown(text, docPath)}</h${Math.min(level + 1, 6)}>`);
            return;
        }

        if (/^[-*]\s/.test(trimmed)) {
            flushParagraph();
            listItems.push(trimmed.slice(2).trim());
            return;
        }

        if (/^>\s/.test(trimmed)) {
            flushParagraph();
            flushList();
            blocks.push(`<blockquote>${formatInlineMarkdown(trimmed.slice(2).trim(), docPath)}</blockquote>`);
            return;
        }

        paragraph.push(trimmed);
    });

    flushParagraph();
    flushList();
    return blocks.join('');
}

function formatMetaLabel(key) {
    const labels = {
        date: '日期',
        status: '状态',
        start_node: '起点',
        target_zone: '目标区域',
        unit_load: '补给准备',
        route: '路线',
        weather: '天气',
        summary: '摘要'
    };

    return labels[key] || key.replaceAll('_', ' ');
}

function splitMetaList(value) {
    return String(value || '')
        .split('|')
        .map(item => item.trim())
        .filter(Boolean);
}

function createBaiduMapUrl(query) {
    return `https://map.baidu.com/search/${encodeURIComponent(query)}/`;
}

function renderVolunteerSection(entry) {
    const benefit = entry.meta.volunteer_benefit || entry.meta.service_hours;
    const items = [
        ['志愿者福利', benefit],
        ['发水之后', entry.meta.water_plan],
        ['徒步时间', entry.meta.hiking_time],
        ['途中活动', splitMetaList(entry.meta.activity_items).join('、')],
        ['结束后', entry.meta.dinner_plan]
    ].filter(([, value]) => value);

    if (!items.length) return '';

    return `
        <section class="detail-extra-card">
            <p class="detail-extra-eyebrow">志愿者安排</p>
            <h4>这次参与除了发水，还会有完整的同行安排。</h4>
            <div class="schedule-list">
                ${items.map(([label, value]) => `
                    <div class="schedule-item">
                        <span class="schedule-label">${escapeHtml(label)}</span>
                        <p>${escapeHtml(value)}</p>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
}

function renderMapSection(entry) {
    const mapQuery = entry.meta.map_query;
    if (!mapQuery) return '';

    const mapTitle = entry.meta.map_title || '地点参考地图';
    const mapNote = entry.meta.map_note || '如果地图嵌入显示受限，可以点击按钮在百度地图中打开。';
    const mapUrl = createBaiduMapUrl(mapQuery);
    const locationText = entry.meta.map_location || entry.meta.start_node || mapQuery;

    return `
        <section class="detail-extra-card map-card">
            <p class="detail-extra-eyebrow">地点地图</p>
            <h4>${escapeHtml(mapTitle)}</h4>
            <p class="map-location-text">地点：${escapeHtml(locationText)}</p>
            <div class="map-embed-shell">
                <iframe
                    class="map-embed"
                    src="${escapeHtml(mapUrl)}"
                    title="${escapeHtml(mapTitle)}"
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade"
                ></iframe>
            </div>
            <p class="map-note">${escapeHtml(mapNote)}</p>
            <div class="map-action-row">
                <button
                    type="button"
                    class="map-link-btn map-expand-btn"
                    onclick="openMapModal('${escapeHtml(mapTitle)}', '${escapeHtml(mapUrl)}', '${escapeHtml(locationText)}', '${escapeHtml(mapNote)}')"
                >
                    放大查看地图
                </button>
                <a class="map-link-btn" href="${escapeHtml(mapUrl)}" target="_blank" rel="noreferrer">在百度地图中打开</a>
            </div>
        </section>
    `;
}

function renderPlanExtras(entry) {
    const volunteerSection = renderVolunteerSection(entry);
    const mapSection = renderMapSection(entry);

    if (!volunteerSection && !mapSection) return '';

    return `<div class="detail-extras">${volunteerSection}${mapSection}</div>`;
}

function buildRecordGalleryHtml(entry, galleryImages) {
    if (!galleryImages.length) return '';

    const galleryTitle = entry.meta.gallery_title || '现场图片';
    const items = galleryImages.map((item, index) => {
        const resolved = resolveAssetPath(item.file || item, entry.path);
        const caption = item.caption || galleryTitle;
        const title = `${entry.meta.title || '行动记录'} · ${index + 1}`;
        return `
            <button class="record-gallery-item" type="button" onclick="openPhotoModal('${escapeHtml(resolved)}', '${escapeHtml(title)}', '${escapeHtml(caption)}')">
                <img src="${escapeHtml(resolved)}" alt="${escapeHtml(title)}" loading="lazy">
            </button>
        `;
    }).join('');

    return `
        <section class="record-gallery">
            <div class="record-gallery-header">
                <p class="detail-extra-eyebrow">现场画面</p>
                <h4>${escapeHtml(galleryTitle)}</h4>
            </div>
            <div class="record-gallery-grid">${items}</div>
        </section>
    `;
}

async function loadRecordGallery(entry) {
    const fallbackImages = splitMetaList(entry.meta.gallery_images);

    try {
        const res = await fetch(`/api/record-images?slug=${encodeURIComponent(entry.slug)}`);
        if (res.ok) {
            const data = await res.json();
            if ((data.images || []).length) {
                return data.images;
            }
        }
    } catch { /* 静默降级到 front matter */ }

    return fallbackImages;
}

function sortByDateDesc(items) {
    return [...items].sort((left, right) => {
        const leftTime = Date.parse(left.meta.date || '');
        const rightTime = Date.parse(right.meta.date || '');
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });
}

function renderCollectionList(collectionName) {
    const config = contentCollections[collectionName];
    const listEl = document.getElementById(config.listId);
    const countEl = document.getElementById(config.countId);
    const items = collectionState[collectionName];

    if (!listEl || !countEl) return;

    countEl.textContent = `共 ${items.length} 期`;

    if (!items.length) {
        listEl.innerHTML = `<div class="content-empty">${config.emptyMessage}</div>`;
        return;
    }

    listEl.innerHTML = items.map((item, index) => `
        <button class="content-entry${index === 0 ? ' active' : ''}" type="button" onclick="selectEntry('${collectionName}', '${item.slug}')">
            <span class="entry-date">${escapeHtml(item.meta.date || '日期待补充')}</span>
            <strong>${escapeHtml(item.meta.title || item.slug)}</strong>
            <span class="entry-summary">${escapeHtml(item.meta.summary || '暂无摘要')}</span>
        </button>
    `).join('');

    prepareScrollReveal(listEl);
}

async function renderEntryDetail(collectionName, entry) {
    const config = contentCollections[collectionName];
    const detailEl = document.getElementById(config.detailId);
    if (!detailEl) return;

    if (!entry) {
        detailEl.innerHTML = `<div class="content-empty">${config.emptyMessage}</div>`;
        return;
    }

    const metaHtml = Object.entries(entry.meta)
        .filter(([key, value]) => key !== 'title' && value && !DETAIL_META_EXCLUDED_KEYS.has(key))
        .map(([key, value]) => `
            <div class="detail-meta-item">
                <span class="detail-meta-label">${escapeHtml(formatMetaLabel(key))}</span>
                <span class="detail-meta-value">${escapeHtml(value)}</span>
            </div>
        `)
        .join('');

    const extrasHtml = collectionName === 'plans'
        ? renderPlanExtras(entry)
        : buildRecordGalleryHtml(entry, await loadRecordGallery(entry));

    detailEl.classList.remove('detail-loading');
    detailEl.innerHTML = `
        <div class="detail-header">
            <div>
                <p class="detail-kicker">${collectionName === 'plans' ? '计划详情' : '行动记录'}</p>
                <h3>${escapeHtml(entry.meta.title || entry.slug)}</h3>
            </div>
        </div>
        <div class="detail-meta-grid">${metaHtml || '<div class="content-empty">暂无补充信息</div>'}</div>
        ${extrasHtml}
        <div class="detail-body">${markdownToHtml(entry.body, entry.path)}</div>
    `;

    prepareScrollReveal(detailEl);
}

function selectEntry(collectionName, slug) {
    const items = collectionState[collectionName];
    const selected = items.find(item => item.slug === slug);
    if (!selected) return;

    const config = contentCollections[collectionName];
    const listEl = document.getElementById(config.listId);
    if (listEl) {
        listEl.querySelectorAll('.content-entry').forEach(button => {
            button.classList.toggle('active', button.getAttribute('onclick')?.includes(`'${slug}'`));
        });
    }

    renderEntryDetail(collectionName, selected);
}

function renderCollectionError(collectionName) {
    const config = contentCollections[collectionName];
    const listEl = document.getElementById(config.listId);
    const detailEl = document.getElementById(config.detailId);
    const countEl = document.getElementById(config.countId);

    if (countEl) countEl.textContent = '加载失败';
    if (listEl) listEl.innerHTML = `<div class="content-empty">${config.errorMessage}</div>`;
    if (detailEl) detailEl.innerHTML = '<div class="content-empty">请通过本地静态服务器或线上地址访问页面，再刷新试试。</div>';
}

async function loadCollection(collectionName) {
    const config = contentCollections[collectionName];

    try {
        const manifestResponse = await fetch(config.manifestPath);
        if (!manifestResponse.ok) {
            throw new Error(`Manifest request failed: ${config.manifestPath}`);
        }

        const manifest = await manifestResponse.json();
        const items = await Promise.all((manifest.items || []).map(async item => {
            const response = await fetch(item.path);
            if (!response.ok) {
                throw new Error(`Content request failed: ${item.path}`);
            }

            const raw = await response.text();
            const parsed = parseFrontMatter(raw);
            return {
                slug: item.slug || slugify(parsed.meta.title || item.path),
                path: item.path,
                meta: {
                    ...parsed.meta,
                    title: parsed.meta.title || item.title || '未命名内容'
                },
                body: parsed.body
            };
        }));

        collectionState[collectionName] = sortByDateDesc(items);
        renderCollectionList(collectionName);
        renderEntryDetail(collectionName, collectionState[collectionName][0]);
    } catch (error) {
        console.error(error);
        renderCollectionError(collectionName);
    }
}

async function initializeCollections() {
    await Promise.all(Object.keys(contentCollections).map(loadCollection));
}

function ensureRevealObserver() {
    if (revealObserver || typeof IntersectionObserver === 'undefined') return;

    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
        });
    }, {
        threshold: 0.14,
        rootMargin: '0px 0px -10% 0px'
    });
}

function prepareScrollReveal(scope = document) {
    const root = scope instanceof Element ? scope : document;
    const targets = root.matches?.('.content-entry, .summary-card, .principle-card, .volunteer-photo-item, .detail-body > p, .detail-body > ul, .detail-body > blockquote, .detail-body > figure, .detail-body > h2, .detail-body > h3, .detail-body > h4, .detail-meta-item, .detail-extra-card')
        ? [root]
        : root.querySelectorAll('.content-entry, .summary-card, .principle-card, .volunteer-photo-item, .detail-body > p, .detail-body > ul, .detail-body > blockquote, .detail-body > figure, .detail-body > h2, .detail-body > h3, .detail-body > h4, .detail-meta-item, .detail-extra-card');

    ensureRevealObserver();

    Array.from(targets).forEach((node, index) => {
        node.classList.add('scroll-reveal');
        node.dataset.revealDelay = String(index % 4);

        if (!revealObserver) {
            node.classList.add('is-visible');
            return;
        }

        revealObserver.unobserve(node);
        revealObserver.observe(node);
    });
}

// ── Volunteer Images (shared loader) ─────────────────────────────────────────

/**
 * 优先从本地服务器 API 自动扫描目录，
 * 若不可用（静态托管）则降级读取 manifest.json。
 */
async function loadVolunteerImages() {
    // 1. 尝试本地开发服务器自动扫描
    try {
        const res = await fetch('/api/volunteers');
        if (res.ok) {
            const data = await res.json();
            const images = (data.images || []).filter(item => item.file);
            if (images.length) return images;
        }
    } catch { /* 不在本地服务器环境，继续 */ }

    // 2. 降级：读取手动维护的 manifest.json
    try {
        const res = await fetch('image/volunteers/manifest.json');
        if (res.ok) {
            const data = await res.json();
            return (data.images || []).filter(item => item.file);
        }
    } catch { /* 静默 */ }

    return [];
}

async function loadHomeCarouselImages() {
    try {
        const manifestResponse = await fetch(contentCollections.records.manifestPath);
        if (!manifestResponse.ok) {
            throw new Error(`Manifest request failed: ${contentCollections.records.manifestPath}`);
        }

        const manifest = await manifestResponse.json();
        const items = await Promise.all((manifest.items || []).map(async item => {
            const response = await fetch(item.path);
            if (!response.ok) return null;

            const raw = await response.text();
            const parsed = parseFrontMatter(raw);
            const entry = {
                slug: item.slug || slugify(parsed.meta.title || item.path),
                path: item.path,
                meta: {
                    ...parsed.meta,
                    title: parsed.meta.title || item.title || '未命名内容'
                },
                body: parsed.body
            };

            const gallery = await loadRecordGallery(entry);
            if (!gallery.length) return null;

            return gallery.slice(0, 3).map((image, index) => ({
                file: resolveAssetPath(image.file || image, entry.path),
                title: entry.meta.title || `记录 ${entry.slug}`,
                caption: index === 0
                    ? (entry.meta.summary || entry.meta.route || '')
                    : `来自 ${entry.meta.title || entry.slug} 的现场照片`
            }));
        }));

        const images = items.flat().filter(Boolean);
        if (images.length) return images;
    } catch (error) {
        console.error(error);
    }

    return loadVolunteerImages();
}

// ── Carousel ────────────────────────────────────────────────────────────────

const carouselState = {
    images: [],
    current: 0,
    timer: null
};

function carouselShow(index) {
    const { images } = carouselState;
    if (!images.length) return;

    carouselState.current = (index + images.length) % images.length;
    const item = images[carouselState.current];

    const imgEl = document.getElementById('carousel-main-img');
    const titleEl = document.getElementById('carousel-title');
    const captionEl = document.getElementById('carousel-caption');

    if (imgEl) { imgEl.src = item.file; imgEl.alt = item.title || ''; }
    if (titleEl) titleEl.textContent = item.title || '';
    if (captionEl) captionEl.textContent = item.caption || '';

    document.querySelectorAll('.carousel-thumb').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === carouselState.current);
    });
}

function carouselNext() { carouselShow(carouselState.current + 1); carouselResetTimer(); }
function carouselPrev() { carouselShow(carouselState.current - 1); carouselResetTimer(); }

function carouselResetTimer() {
    clearInterval(carouselState.timer);
    carouselState.timer = setInterval(() => carouselShow(carouselState.current + 1), 4000);
}

async function initCarousel() {
    const images = await loadHomeCarouselImages();
    if (!images.length) return;

    carouselState.images = images;

    const menuEl = document.getElementById('carousel-menu');
    if (menuEl) {
        menuEl.innerHTML = images.map((item, i) => `
            <button class="carousel-thumb${i === 0 ? ' active' : ''}" type="button"
                onclick="carouselShow(${i}); carouselResetTimer();"
                aria-label="${escapeHtml(item.title || `图片 ${i + 1}`)}">
                <img src="${escapeHtml(item.file)}" alt="${escapeHtml(item.title || '')}">
                <span class="thumb-label">${escapeHtml(item.title || `图片 ${i + 1}`)}</span>
            </button>
        `).join('');
    }

    const sectionEl = document.getElementById('carousel-section');
    if (sectionEl) sectionEl.style.display = '';

    carouselShow(0);
    carouselResetTimer();
}

// ── Volunteer Gallery ────────────────────────────────────────────────────────

function openPhotoModal(src, title, caption) {
    const imgEl = document.getElementById('photo-modal-img');
    const titleEl = document.getElementById('photo-modal-title');
    const subEl = document.getElementById('photo-modal-sub');
    if (imgEl) { imgEl.src = src; imgEl.alt = title || ''; }
    if (titleEl) titleEl.textContent = title || '';
    if (subEl) subEl.textContent = caption || '';
    showModal('modal-photo');
}

async function initVolunteerGallery() {
    const galleryEl = document.getElementById('volunteer-gallery');
    if (!galleryEl) return;

    const images = await loadVolunteerImages();

    if (!images.length) {
        galleryEl.innerHTML = '<div class="content-empty">暂无志愿者图片，请将图片放入 image/volunteers/ 目录。</div>';
        return;
    }

    galleryEl.innerHTML = images.map(item => `
        <div class="volunteer-photo-item" onclick="openPhotoModal('${escapeHtml(item.file)}', '${escapeHtml(item.title || '')}', '${escapeHtml(item.caption || '')}')">
            <img src="${escapeHtml(item.file)}" alt="${escapeHtml(item.title || '')}" loading="lazy">
            ${item.title ? `<p class="volunteer-photo-label">${escapeHtml(item.title)}</p>` : ''}
        </div>
    `).join('');

    prepareScrollReveal(galleryEl);
}

window.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000 * 30);

    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };

    initializeCollections();
    initCarousel();
    initVolunteerGallery();
    prepareScrollReveal(document);
});
