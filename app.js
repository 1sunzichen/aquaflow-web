// AQUAFLOW_OS Core Logic

const contentCollections = {
    plans: {
        manifestPath: 'content/plans/manifest.json',
        listId: 'plans-list',
        detailId: 'plans-detail',
        countId: 'plans-count',
        emptyMessage: 'NO_PLAN_DOCUMENTS_FOUND',
        errorMessage: 'PLAN_DATA_SYNC_FAILED'
    },
    records: {
        manifestPath: 'content/records/manifest.json',
        listId: 'records-list',
        detailId: 'records-detail',
        countId: 'records-count',
        emptyMessage: 'NO_RECORD_DOCUMENTS_FOUND',
        errorMessage: 'RECORD_DATA_SYNC_FAILED'
    }
};

const collectionState = {
    plans: [],
    records: []
};

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
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'block';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function updateTime() {
    const timeEl = document.getElementById('system-time');
    if (!timeEl) return;

    const now = new Date();
    timeEl.textContent = `TIMESTAMP: ${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function escapeHtml(value) {
    return value
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
    const frontMatter = parts[1].trim().split('\n');
    frontMatter.forEach(line => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) return;
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        meta[key] = value;
    });

    const body = parts.slice(2).join('---').trim();
    return { meta, body };
}

function formatInlineMarkdown(line) {
    return escapeHtml(line)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function markdownToHtml(markdown) {
    const lines = markdown.split('\n');
    const blocks = [];
    let paragraph = [];
    let listItems = [];

    function flushParagraph() {
        if (paragraph.length) {
            blocks.push(`<p>${paragraph.map(formatInlineMarkdown).join('<br>')}</p>`);
            paragraph = [];
        }
    }

    function flushList() {
        if (listItems.length) {
            blocks.push(`<ul>${listItems.map(item => `<li>${formatInlineMarkdown(item)}</li>`).join('')}</ul>`);
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

        if (/^#{1,3}\s/.test(trimmed)) {
            flushParagraph();
            flushList();
            const level = trimmed.match(/^#+/)[0].length;
            const text = trimmed.slice(level).trim();
            blocks.push(`<h${level + 1}>${formatInlineMarkdown(text)}</h${level + 1}>`);
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
            blocks.push(`<blockquote>${formatInlineMarkdown(trimmed.slice(2).trim())}</blockquote>`);
            return;
        }

        paragraph.push(trimmed);
    });

    flushParagraph();
    flushList();
    return blocks.join('');
}

function formatMetaLabel(key) {
    return key.replaceAll('_', ' ').toUpperCase();
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

    countEl.textContent = `${String(items.length).padStart(2, '0')} DOCS ONLINE`;

    if (!items.length) {
        listEl.innerHTML = `<div class="content-empty">${config.emptyMessage}</div>`;
        return;
    }

    listEl.innerHTML = items.map((item, index) => `
        <button class="content-entry${index === 0 ? ' active' : ''}" type="button" onclick="selectEntry('${collectionName}', '${item.slug}')">
            <span class="entry-date">${escapeHtml(item.meta.date || 'DATE_PENDING')}</span>
            <strong>${escapeHtml(item.meta.title || item.slug)}</strong>
            <span class="entry-summary">${escapeHtml(item.meta.summary || 'NO_SUMMARY')}</span>
        </button>
    `).join('');
}

function renderEntryDetail(collectionName, entry) {
    const config = contentCollections[collectionName];
    const detailEl = document.getElementById(config.detailId);
    if (!detailEl) return;

    if (!entry) {
        detailEl.innerHTML = `<div class="content-empty">${config.emptyMessage}</div>`;
        return;
    }

    const metaHtml = Object.entries(entry.meta)
        .filter(([key, value]) => key !== 'title' && value)
        .map(([key, value]) => `
            <div class="detail-meta-item">
                <span class="detail-meta-label">${escapeHtml(formatMetaLabel(key))}</span>
                <span class="detail-meta-value">${escapeHtml(value)}</span>
            </div>
        `)
        .join('');

    detailEl.classList.remove('detail-loading');
    detailEl.innerHTML = `
        <div class="detail-header">
            <div>
                <p class="detail-kicker">${collectionName === 'plans' ? 'LIVE PLAN DOCUMENT' : 'FIELD RECORD DOCUMENT'}</p>
                <h3>${escapeHtml(entry.meta.title || entry.slug)}</h3>
            </div>
        </div>
        <div class="detail-meta-grid">${metaHtml || '<div class="content-empty">NO_METADATA</div>'}</div>
        <div class="detail-body">${markdownToHtml(entry.body)}</div>
    `;
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

    if (countEl) countEl.textContent = 'SYNC_FAILED';
    if (listEl) listEl.innerHTML = `<div class="content-empty">${config.errorMessage}</div>`;
    if (detailEl) detailEl.innerHTML = `<div class="content-empty">${config.errorMessage}<br>请通过静态服务器访问页面，并检查清单路径。</div>`;
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
                    title: parsed.meta.title || item.title || 'UNTITLED_DOCUMENT'
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

window.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000);

    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };

    initializeCollections();
});
