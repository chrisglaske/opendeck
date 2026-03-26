// ==========================================
// 2. CORE STORAGE FUNCTIONS
// ==========================================

const STORAGE_KEY_PROJECTS = 'openDeckDB_v2';
const STORAGE_KEY_FOLDERS = 'openDeckFolders_v1';
const STORAGE_SCHEMA_VERSION = 3;
const STORAGE_KEY_MIGRATION_NOTICE_SEEN = 'openDeckLegacyMigrationNoticeSeen_v3';

const VALID_TRANSITIONS = new Set(['fade-in', 'slide-up', 'zoom-in', 'reveal-right']);
const VALID_BACKGROUNDS = new Set(['bg-default', 'bg-deepblue', 'bg-midnight', 'bg-aurora', 'bg-sunset', 'bg-pitchblack', 'bg-purewhite']);

function ensureString(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}

function ensureArray(value, fallback = []) {
    return Array.isArray(value) ? value : fallback;
}

function getDefaultBgForType(type) {
    if (type === 'glass_intro' || type === 'comparison') return 'bg-aurora';
    if (type === 'showcase_window') return 'bg-deepblue';
    if (type === 'roadmap_cards') return 'bg-sunset';
    if (type === 'corp_title' || type === 'corp_basic') return 'bg-purewhite';
    return 'bg-default';
}

function normalizeSlide(slide, index) {
    const out = (slide && typeof slide === 'object') ? { ...slide } : {};

    out.id = ensureString(out.id, 'slide_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '_' + index);
    out.type = ensureString(out.type, 'intro');
    out.navName = ensureString(out.navName, `Slide ${index + 1}`);
    out.title = ensureString(out.title, 'Main Topic Heading');
    out.notes = ensureString(out.notes, '');
    out.transition = VALID_TRANSITIONS.has(out.transition) ? out.transition : 'fade-in';
    out.bgOverride = VALID_BACKGROUNDS.has(out.bgOverride) ? out.bgOverride : getDefaultBgForType(out.type);

    if (out.type === 'glass_intro') {
        out.kicker = ensureString(out.kicker, 'Presentation System');
        out.subtitle = ensureString(out.subtitle, '');
        out.icon = ensureString(out.icon, 'fa-wand-magic-sparkles');

        const legacyTags = ensureArray(out.tags, []).map((tag) => ({
            text: ensureString(tag && tag.text, 'Badge'),
            icon: ensureString(tag && tag.icon, 'fa-star'),
            color: ensureString(tag && tag.color, '#3B82F6')
        }));

        out.badges = ensureArray(out.badges, []).map((badge) => ({
            text: ensureString(badge && badge.text, 'Badge'),
            icon: ensureString(badge && badge.icon, 'fa-star'),
            color: ensureString(badge && badge.color, '#3B82F6')
        }));

        if (!out.badges.length && legacyTags.length) out.badges = legacyTags;
    }

    if (out.type === 'pitch_stats') {
        out.subtitle = ensureString(out.subtitle, '');
        out.stats = ensureArray(out.stats, []).map((stat) => ({
            value: ensureString(stat && stat.value, '100'),
            label: ensureString(stat && stat.label, 'Metric'),
            color: ensureString(stat && stat.color, '#3B82F6')
        }));

        if (!out.stats.length) {
            out.stats = [
                { value: '99%', label: 'Uptime', color: '#3B82F6' },
                { value: '10x', label: 'Growth', color: '#10B981' }
            ];
        }
    }

    if (out.type === 'grid') {
        out.subtitle = ensureString(out.subtitle, '');
        out.cards = ensureArray(out.cards, []).map((card) => ({
            title: ensureString(card && card.title, 'Feature'),
            text: ensureString(card && card.text, 'Description'),
            icon: ensureString(card && card.icon, 'fa-star'),
            color: ensureString(card && card.color, '#3B82F6'),
            image: ensureString(card && card.image, '')
        }));
    }

    if (out.type === 'split') {
        out.subtitle = ensureString(out.subtitle, '');
        out.bullets = ensureArray(out.bullets, []).map((bullet) => ensureString(bullet, ''));
        out.boxTitle = ensureString(out.boxTitle, 'Key Takeaway');
        out.boxText = ensureString(out.boxText, '');
        out.boxIcon = ensureString(out.boxIcon, 'fa-lightbulb');
        out.image = ensureString(out.image, '');
    }

    return out;
}

function migrateProjectsDatabase(rawProjects) {
    let changed = false;
    let migratedCount = 0;
    const safeProjects = ensureArray(rawProjects, []);

    const migratedProjects = safeProjects
        .filter((project) => project && typeof project === 'object')
        .map((project, projectIndex) => {
            const migrated = { ...project };
            const data = (migrated.data && typeof migrated.data === 'object') ? { ...migrated.data } : {};
            let projectChanged = false;

            if (!migrated.id || !migrated.name || !Array.isArray(data.slides)) {
                changed = true;
                projectChanged = true;
            }

            migrated.id = ensureString(migrated.id, 'proj_' + Date.now() + '_' + projectIndex);
            migrated.name = ensureString(migrated.name, 'Untitled Presentation');
            migrated.lastModified = Number.isFinite(migrated.lastModified) ? migrated.lastModified : Date.now();
            migrated.tags = ensureArray(migrated.tags, []).map((tag) => ensureString(tag, '')).filter(Boolean);

            data.slides = ensureArray(data.slides, []).map((slide, i) => normalizeSlide(slide, i));
            data.slideCounter = Number.isFinite(data.slideCounter) ? data.slideCounter : data.slides.length;

            const gs = (data.globalSettings && typeof data.globalSettings === 'object') ? { ...data.globalSettings } : {};
            gs.theme = ensureString(gs.theme, '#3B82F6');
            gs.font = ensureString(gs.font, "'Inter', sans-serif");
            gs.headerText = ensureString(gs.headerText, 'OpenDeck');
            gs.headerIcon = ensureString(gs.headerIcon, 'OD');
            gs.customFontUrl = ensureString(gs.customFontUrl, '');
            gs.customFontFamily = ensureString(gs.customFontFamily, '');
            gs.companyLogo = ensureString(gs.companyLogo, '');
            gs.savedFonts = ensureArray(gs.savedFonts, []).filter((font) => font && typeof font === 'object');
            data.globalSettings = gs;

            if (!data.slides.length) {
                data.slides = [normalizeSlide({ type: 'glass_intro', navName: 'Welcome', title: 'New Presentation', subtitle: 'Start building your story here.' }, 0)];
                data.slideCounter = 1;
                changed = true;
                projectChanged = true;
            }

            migrated.data = data;

            const currentVersion = Number.isFinite(migrated.schemaVersion) ? migrated.schemaVersion : 0;
            if (currentVersion < STORAGE_SCHEMA_VERSION) {
                migrated.schemaVersion = STORAGE_SCHEMA_VERSION;
                changed = true;
                projectChanged = true;
            }

            if (projectChanged) migratedCount++;

            return migrated;
        });

    return { projects: migratedProjects, changed, migratedCount };
}

function showLegacyMigrationNotice(migratedCount) {
    const existing = document.getElementById('legacyMigrationToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'legacyMigrationToast';
    toast.style.cssText = [
        'position:fixed',
        'top:20px',
        'right:20px',
        'z-index:10001',
        'max-width:420px',
        'background:linear-gradient(145deg,#0f172a,#111827)',
        'border:1px solid #334155',
        'border-left:4px solid #22c55e',
        'border-radius:12px',
        'box-shadow:0 20px 50px -18px rgba(0,0,0,0.95)',
        'padding:12px 14px',
        'color:#e2e8f0',
        'font-family:Space Grotesk, sans-serif',
        'opacity:0',
        'transform:translateY(-8px)',
        'transition:all .22s ease'
    ].join(';');

    const deckLabel = migratedCount === 1 ? 'presentation' : 'presentations';
    toast.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:10px;">
            <i class="fa-solid fa-circle-check" style="color:#22c55e;margin-top:2px;"></i>
            <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#86efac;margin-bottom:3px;">Legacy Data Upgraded</div>
                <div style="font-size:13px;line-height:1.5;">Updated ${migratedCount} older ${deckLabel} to the latest template schema for consistent rendering.</div>
            </div>
            <button id="legacyMigrationToastClose" style="background:transparent;border:0;color:#94a3b8;cursor:pointer;font-size:14px;line-height:1;padding:2px;">✕</button>
        </div>
    `;

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    const close = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-8px)';
        setTimeout(() => toast.remove(), 220);
    };

    const closeBtn = toast.querySelector('#legacyMigrationToastClose');
    if (closeBtn) closeBtn.onclick = close;
    setTimeout(close, 6200);
}

function consumeLegacyMigrationNotice() {
    const pendingCount = Number(window.__openDeckLegacyMigrationPendingCount || 0);
    if (pendingCount <= 0) return;
    window.__openDeckLegacyMigrationPendingCount = 0;
    showLegacyMigrationNotice(pendingCount);
}

function loadProjects() {
    try {
        const data = localStorage.getItem(STORAGE_KEY_PROJECTS);
        if (data) {
            const parsed = JSON.parse(data);
            const migration = migrateProjectsDatabase(parsed);
            projects = migration.projects;

            if (migration.migratedCount > 0 && !localStorage.getItem(STORAGE_KEY_MIGRATION_NOTICE_SEEN)) {
                window.__openDeckLegacyMigrationPendingCount = migration.migratedCount;
                localStorage.setItem(STORAGE_KEY_MIGRATION_NOTICE_SEEN, 'true');
            }

            if (migration.changed) {
                localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
            }
        }

        const folderData = localStorage.getItem(STORAGE_KEY_FOLDERS);
        if (folderData) {
            const parsedFolders = JSON.parse(folderData);
            folders = ensureArray(parsedFolders, []);
        }
    } catch (e) { console.error("Could not load projects", e); }
}

function saveProjects(triggerIndicator = true) {
    if (activeProjectId) {
        const p = projects.find(p => p.id === activeProjectId);
        if (p) {
            p.data = { slides, slideCounter, globalSettings };
            p.lastModified = Date.now();
        }
    }
    try {
        localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
        localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
        if (triggerIndicator && activeProjectId) showSaveIndicator();
    } catch (e) {
        alert("Storage limit reached! Please remove large images or export/delete old presentations.");
    }
}

function showSaveIndicator() {
    const ind = document.getElementById('saveIndicator');
    const now = new Date();
    ind.innerHTML = `<i class="fa-solid fa-cloud-arrow-up text-green-500"></i> Saved ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    ind.classList.remove('opacity-50');
    ind.classList.add('opacity-100', 'text-green-400');
    setTimeout(() => { ind.classList.remove('opacity-100', 'text-green-400'); ind.classList.add('opacity-50'); }, 1500);
}

function clearAllData() {
    const confirmation = prompt("WARNING: This will permanently delete ALL your presentations.\n\nTo confirm, please type exactly:\nWIPE MY DATA");

    if (confirmation === "WIPE MY DATA") {
        localStorage.removeItem(STORAGE_KEY_PROJECTS);
        localStorage.removeItem(STORAGE_KEY_FOLDERS);
        localStorage.removeItem('openDeckTutSeen');
        localStorage.removeItem('openDeckDemoSeeded'); // Resets the demo deck
        localStorage.removeItem('openDeckAppState');
        location.reload();
    } else if (confirmation !== null) {
        alert("Data wipe canceled. You must type 'WIPE MY DATA' exactly to confirm.");
    }
}

// Explicitly expose to window
window.loadProjects = loadProjects;
window.saveProjects = saveProjects;
window.showSaveIndicator = showSaveIndicator;
window.clearAllData = clearAllData;
window.consumeLegacyMigrationNotice = consumeLegacyMigrationNotice;