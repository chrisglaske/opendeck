// ==========================================
// 4. DASHBOARD & UI LOGIC
// ==========================================

function startAppFromLanding() {
    localStorage.setItem('openDeckAppState', 'dashboard');
    document.getElementById('landingView').style.display = 'none';
    bootAppToDashboard();
}

function renderDashboard() {
    const grid = document.getElementById('projectGrid');
    const search = document.getElementById('searchBar') ? document.getElementById('searchBar').value.toLowerCase() : '';
    const sort = document.getElementById('sortSelect') ? document.getElementById('sortSelect').value : 'newest';

    document.getElementById('dashboardStats').innerText = `You have ${projects.length} saved presentations.`;
    grid.innerHTML = '';

    let filtered = projects.filter(p => p.name.toLowerCase().includes(search));
    if (sort === 'newest') filtered.sort((a, b) => b.lastModified - a.lastModified);
    if (sort === 'oldest') filtered.sort((a, b) => a.lastModified - b.lastModified);
    if (sort === 'alpha') filtered.sort((a, b) => a.name.localeCompare(b.name));

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-24 text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800 border-dashed">
                <div class="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <i class="fa-solid fa-layer-group text-4xl text-slate-600"></i>
                </div>
                <h3 class="text-3xl font-extrabold text-white mb-3">Your workspace is empty</h3>
                <p class="mb-8 text-slate-400 text-lg max-w-md text-center">Start your next great tech talk by creating a new presentation or importing an .odeck file.</p>
                <button onclick="createNewProject()" class="text-white px-8 py-4 rounded-xl font-bold shadow-[0_0_30px_rgba(59,130,246,0.4)] transition flex items-center gap-3 hover:scale-105 text-lg" style="background-color: var(--accent-color)">
                    <i class="fa-solid fa-plus"></i> Create Your First Presentation
                </button>
            </div>
        `;
        return;
    }

    filtered.forEach(p => {
        const date = new Date(p.lastModified).toLocaleDateString() + ' ' + new Date(p.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        // Safe access in case p.data is undefined
        const slideCount = (p.data && p.data.slides) ? p.data.slides.length : 0;

        let previewHtml = '';
        if (p.data && p.data.slides && p.data.slides.length > 0) {
            const s1 = p.data.slides[0];
            const themeCol = (p.data.globalSettings && p.data.globalSettings.theme) ? p.data.globalSettings.theme : '#3B82F6';

            if (s1.type === 'intro') {
                previewHtml = `<div class="deck-preview" style="--deck-color: ${themeCol}"><i class="fa-solid ${escapeHtml(s1.icon || 'fa-desktop')} text-4xl mb-3 z-10 drop-shadow-md" style="color: ${themeCol}"></i><h3 class="text-white font-extrabold text-xl tracking-tight z-10 line-clamp-2 leading-tight px-4">${escapeHtml(s1.title || 'Untitled')}</h3><p class="text-slate-400 text-xs uppercase tracking-widest mt-2 z-10 line-clamp-1 opacity-80">${escapeHtml(s1.subtitle || '')}</p></div>`;
            } else if (s1.type === 'corp_title') {
                previewHtml = `<div class="deck-preview" style="background: #f8fafc; --deck-color: transparent;"><div class="w-full flex flex-col justify-center px-4 text-left"><div class="h-1 w-8 mb-2" style="background:${themeCol}"></div><h3 class="text-black font-bold text-lg leading-tight z-10 line-clamp-2">${escapeHtml(s1.title || 'Untitled')}</h3></div></div>`;
            } else if (s1.type === 'pitch_hero') {
                let bgImg = s1.image ? `background-image: url(${s1.image}); background-size: cover;` : `background: ${themeCol};`;
                previewHtml = `<div class="deck-preview" style="${bgImg}"><div class="absolute inset-0 bg-black/50"></div><h3 class="text-white font-extrabold text-2xl tracking-tighter z-10 line-clamp-2 px-2 drop-shadow">${escapeHtml(s1.title || 'Untitled')}</h3></div>`;
            } else if (s1.type === 'corp_quote') {
                previewHtml = `<div class="deck-preview" style="background: #0f172a; --deck-color: transparent;"><i class="fa-solid fa-quote-left text-3xl mb-2" style="color:${themeCol}"></i><h3 class="text-white font-serif italic text-sm leading-tight z-10 line-clamp-2">${escapeHtml(s1.title || 'Untitled')}</h3></div>`;
            } else if (s1.type === 'pitch_stats') {
                previewHtml = `<div class="deck-preview" style="background: #0f172a; --deck-color: transparent;"><div class="flex gap-2"><div class="h-4 w-6 rounded" style="background:${themeCol}"></div><div class="h-4 w-6 rounded" style="background:${themeCol}"></div><div class="h-4 w-6 rounded" style="background:${themeCol}"></div></div></div>`;
            } else {
                previewHtml = `<div class="deck-preview" style="--deck-color: ${themeCol}"><h3 class="text-white font-bold text-lg tracking-tight z-10 line-clamp-2 px-4">${escapeHtml(s1.title || 'Untitled')}</h3></div>`;
            }
        } else {
            previewHtml = `<div class="deck-preview"><i class="fa-solid fa-file text-slate-700 text-5xl"></i></div>`;
        }

        grid.innerHTML += `
            <div class="project-card group">
                <div class="absolute inset-0 bg-slate-900/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center z-30 transition-all duration-300">
                    <button onclick="openProject('${p.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-bold mb-3 shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75"><i class="fa-solid fa-pen-to-square mr-2"></i> Open Editor</button>
                    <button onclick="presentDirectly('${p.id}')" class="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-150"><i class="fa-solid fa-play text-green-400 mr-2"></i> Present Now</button>
                </div>
                
                <div class="absolute top-3 right-3 flex gap-2 z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-200">
                    <button onclick="exportOdeck('${p.id}', event)" class="bg-slate-800 hover:bg-blue-600 text-white w-9 h-9 rounded-lg flex items-center justify-center transition shadow-lg border border-slate-600" title="Export Backup"><i class="fa-solid fa-download"></i></button>
                    <button onclick="duplicateProject('${p.id}', event)" class="bg-slate-800 hover:bg-slate-600 text-white w-9 h-9 rounded-lg flex items-center justify-center transition shadow-lg border border-slate-600" title="Duplicate"><i class="fa-regular fa-copy"></i></button>
                    <button onclick="deleteProject('${p.id}', event)" class="bg-slate-800 hover:bg-red-600 text-white w-9 h-9 rounded-lg flex items-center justify-center transition shadow-lg border border-slate-600" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
                
                ${previewHtml}

                <div class="p-5 flex-grow bg-slate-900 border-t border-slate-800 z-10 pointer-events-none">
                    <h3 class="text-lg font-bold text-white mb-1 truncate">${escapeHtml(p.name)}</h3>
                    <p class="text-[10px] text-slate-500 font-mono uppercase mb-4">Edited: ${date}</p>
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-md border border-slate-700">${slideCount} Slides</span>
                    </div>
                </div>
            </div>
        `;
    });
}

function createNewProject() {
    const id = 'proj_' + Math.random().toString(36).substr(2, 9);
    const newProj = {
        id: id, name: 'Untitled Presentation', lastModified: Date.now(),
        data: {
            slideCounter: 1,
            globalSettings: { theme: '#3B82F6', font: "'Inter', sans-serif", headerText: 'OpenDeck', headerIcon: 'OD' },
            slides: [{ id: 'slide_' + Date.now() + Math.floor(Math.random() * 1000), type: 'intro', navName: 'Welcome', title: 'New Presentation', subtitle: 'A catchy subtitle', icon: 'fa-desktop', tags: [], notes: '' }]
        }
    };
    projects.push(newProj);
    // Crucial fix: do not save the empty global state to the new project! We just pushed it to array.
    saveProjects(false);
    openProject(id);
}

function createDemoProject() {
    const demoId = 'proj_demo_' + Date.now();
    const demoProj = {
        id: demoId,
        name: '✨ Interactive Demo Deck',
        lastModified: Date.now(),
        data: {
            slideCounter: 7,
            globalSettings: { theme: '#8B5CF6', font: "'Space Grotesk', sans-serif", headerText: 'OpenDeck Studio', headerIcon: 'OD' },
            slides: [
                {
                    id: 'slide_demo_1', type: 'pitch_hero', navName: 'Welcome',
                    title: 'Unleash Your Ideas 🚀', subtitle: 'The zero-config, privacy-first presentation studio.',
                    transition: 'fade-in', bgOverride: 'bg-midnight',
                    notes: 'Welcome to OpenDeck! This speaker view is completely local and synced in real-time.'
                },
                {
                    id: 'slide_demo_2', type: 'pitch_stats', navName: 'Performance',
                    title: 'Lightning Fast. Zero Bloat.', subtitle: 'Built for speed, privacy, and developers.',
                    stats: [
                        { value: '0MB', label: 'Node Modules', color: '#10B981' },
                        { value: '100%', label: 'Local & Private', color: '#8B5CF6' },
                        { value: '60fps', label: 'Render Speed', color: '#F43F5E' }
                    ],
                    transition: 'slide-up', bgOverride: 'bg-deepblue', notes: 'No dependencies. No backend. Just pure web performance.'
                },
                {
                    id: 'slide_demo_3', type: 'split', navName: 'Features',
                    title: 'Developer-Ready Workflows', subtitle: 'Finally, an editor that respects your time and data.',
                    bullets: ['No mandatory accounts or subscriptions', 'Version-control friendly backups (.odeck)', 'Click anywhere to edit instantly', 'Export to standalone HTML or PPTX'],
                    boxTitle: '100% Secure',
                    boxText: "Your presentations never leave your browser's Local Storage.",
                    boxIcon: 'fa-shield-halved',
                    transition: 'fade-in', bgOverride: 'bg-default', notes: 'Try clicking on the text in the main preview window to edit it directly!'
                },
                {
                    id: 'slide_demo_4', type: 'grid', navName: 'Layouts',
                    title: 'Beautiful Layouts Out-of-the-Box', subtitle: 'Stop fighting with alignments. Just pick a template and type.',
                    cards: [
                        { title: 'Modern Tech', text: 'Terminal blocks, code snippets, and tech grids.', icon: 'fa-code', color: '#10B981' },
                        { title: 'Corporate Edge', text: 'Clean splits, executive quotes, and imagery.', icon: 'fa-building', color: '#3B82F6' },
                        { title: 'Creative Pitch', text: 'Cinematic heroes, giant metrics, and timelines.', icon: 'fa-rocket', color: '#F59E0B' }
                    ],
                    transition: 'zoom-in', bgOverride: 'bg-deepblue', notes: 'Each layout is responsive and scales perfectly to any screen or PDF export.'
                },
                {
                    id: 'slide_demo_5', type: 'code', navName: 'Code',
                    title: 'Code That Looks Good', subtitle: 'Drop in your scripts, JSON, or commands with beautiful syntax highlighting.',
                    codeHeader: 'deploy.sh', codeContent: '#!/bin/bash\n\n# Clone the OpenDeck repository\ngit clone https://github.com/chrisglaske/opendeck.git\n\n# Open directly in any browser\n# No build tools, no npm install, no servers needed.\nopen index.html\n\necho "Happy Presenting! 🎉"', codeColor: 'text-pink-400',
                    transition: 'slide-up', bgOverride: 'bg-default', notes: 'Change the syntax color theme using the right-hand Inspector panel.'
                },
                {
                    id: 'slide_demo_6', type: 'list', navName: 'Checklist',
                    title: 'Launch Checklist', subtitle: 'Ready to share your presentation with the world?',
                    items: [
                        { label: 'Write Content', value: 'DONE', icon: 'fa-check-circle', color: '#10B981' },
                        { label: 'Pick Brand Theme', value: 'DONE', icon: 'fa-check-circle', color: '#10B981' },
                        { label: 'Export to HTML', value: 'READY', icon: 'fa-rocket', color: '#3B82F6' }
                    ],
                    transition: 'fade-in', bgOverride: 'bg-deepblue', notes: 'Lists are great for tracking progress, roadmaps, or technical requirements.'
                },
                {
                    id: 'slide_demo_7', type: 'cta', navName: 'Get Started',
                    title: 'Ready to build?', subtitle: 'Return to the dashboard to create your own masterpiece.',
                    icon: 'fa-wand-magic-sparkles', link: 'opendeck.work',
                    transition: 'zoom-in', bgOverride: 'bg-pitchblack', notes: 'Thanks for trying out the demo!'
                }
            ]
        }
    };
    projects.push(demoProj);
    saveProjects(false);
}

function openProject(id) {
    const p = projects.find(x => x.id === id);
    if (!p) {
        returnToDashboard();
        return;
    }

    // CRITICAL BUG FIX: Load globals BEFORE making the project active, so background saves don't overwrite it!
    slides = (p.data && p.data.slides) ? p.data.slides : [];
    slideCounter = (p.data && p.data.slideCounter) ? p.data.slideCounter : slides.length;
    globalSettings = (p.data && p.data.globalSettings) ? p.data.globalSettings : { theme: '#3B82F6', font: "'Inter', sans-serif", headerText: 'OpenDeck', headerIcon: 'OD' };
    currentSlideId = slides.length > 0 ? slides[0].id : null;

    // NOW it is safe to set the active project
    activeProjectId = id;
    localStorage.setItem('openDeckAppState', id);

    document.documentElement.style.setProperty('--accent-color', globalSettings.theme);
    document.documentElement.style.setProperty('--global-font', globalSettings.font || "'Inter', sans-serif");
    document.getElementById('projectTitleInput').value = p.name;

    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('builderView').style.display = 'flex';

    if (window.renderApp) renderApp();
}

function presentDirectly(id) {
    const originalId = activeProjectId;
    activeProjectId = id;
    const p = projects.find(x => x.id === id);

    const tempSlides = slides;
    const tempSettings = globalSettings;

    slides = (p.data && p.data.slides) ? p.data.slides : [];
    globalSettings = (p.data && p.data.globalSettings) ? p.data.globalSettings : { theme: '#3B82F6', font: "'Inter', sans-serif", headerText: 'OpenDeck', headerIcon: 'OD' };

    if (window.presentInBrowser) presentInBrowser();

    activeProjectId = originalId;
    slides = tempSlides;
    globalSettings = tempSettings;
}

function returnToDashboard() {
    if (activeProjectId) saveProjects(false);
    activeProjectId = null;

    localStorage.setItem('openDeckAppState', 'dashboard');

    document.getElementById('builderView').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'flex';
    renderDashboard();
}

function returnToLanding() {
    // Save any open project just in case
    if (activeProjectId) saveProjects(false);
    activeProjectId = null;

    // Clear the auto-resume state
    localStorage.removeItem('openDeckAppState');

    // Hide studio views and show the landing page
    document.getElementById('builderView').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('landingView').style.display = 'flex';
}

function updateProjectTitle(val) {
    const p = projects.find(x => x.id === activeProjectId);
    if (p) { p.name = val || 'Untitled Presentation'; saveProjects(); }
}

function deleteProject(id, event) {
    event.stopPropagation();
    if (confirm("Permanently delete this presentation?")) {
        projects = projects.filter(x => x.id !== id);
        saveProjects(false);
        renderDashboard();
    }
}

function duplicateProject(id, event) {
    event.stopPropagation();
    const p = projects.find(x => x.id === id);
    if (p) {
        const clone = JSON.parse(JSON.stringify(p));
        clone.id = 'proj_' + Date.now();
        clone.name = clone.name + ' (Copy)';
        clone.lastModified = Date.now();

        if (clone.data && clone.data.slides) {
            clone.data.slides.forEach(s => {
                s.id = 'slide_' + Date.now() + Math.floor(Math.random() * 10000);
            });
        }

        projects.push(clone);
        saveProjects(false);
        renderDashboard();
    }
}

function exportOdeck(id, event) {
    if (event) event.stopPropagation();
    saveProjects(false);
    const p = projects.find(x => x.id === id);
    if (!p) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(p));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = p.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.odeck';
    a.click();
}

function importProject(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (imported.id && imported.data) {
                imported.id = 'proj_' + Date.now();
                imported.lastModified = Date.now();

                if (imported.data.slides) {
                    imported.data.slides.forEach(s => {
                        s.id = 'slide_' + Date.now() + Math.floor(Math.random() * 10000);
                    });
                }

                projects.push(imported);
                saveProjects(false);
                renderDashboard();

                const lbl = document.querySelector('label[for="importOdeck"]');
                const oldHtml = lbl.innerHTML;
                lbl.innerHTML = `<i class="fa-solid fa-check text-green-400"></i> Imported!`;
                lbl.classList.replace('bg-slate-800', 'bg-green-900');
                setTimeout(() => { lbl.innerHTML = oldHtml; lbl.classList.replace('bg-green-900', 'bg-slate-800'); }, 2000);
            } else { alert("Invalid .odeck file format."); }
        } catch (err) { alert("Error reading file."); }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// --- UI HELPERS ---
function showModal(id) {
    const m = document.getElementById(id);
    m.style.display = 'flex';
    void m.offsetWidth;
    m.classList.add('show');
}

function hideModal(id) {
    const m = document.getElementById(id);
    m.classList.remove('show');
    setTimeout(() => m.style.display = 'none', 300);
}

function openTemplateModal() {
    showModal('templateModal');
    switchTemplateTab('tech');
}

function closeTemplateModal() { hideModal('templateModal'); }

function switchTemplateTab(tab) {
    document.querySelectorAll('.template-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tabBtn_' + tab).classList.add('active');

    document.getElementById('tabContent_tech').classList.add('hidden');
    document.getElementById('tabContent_corp').classList.add('hidden');
    document.getElementById('tabContent_pitch').classList.add('hidden');

    document.getElementById('tabContent_' + tab).classList.remove('hidden');
}

function openSettingsModal() {
    document.getElementById('globalTheme').value = globalSettings.theme;
    document.getElementById('globalFont').value = globalSettings.font || "'Inter', sans-serif";
    document.getElementById('globalHeaderText').value = globalSettings.headerText;
    document.getElementById('globalHeaderIcon').value = globalSettings.headerIcon;
    showModal('settingsModal');
}

function closeSettingsModal() { hideModal('settingsModal'); }

function updateGlobalSetting(key, value) {
    globalSettings[key] = value;
    if (key === 'theme') document.documentElement.style.setProperty('--accent-color', value);
    if (key === 'font') document.documentElement.style.setProperty('--global-font', value);
    saveProjects();
}

var activeIconCallback = null;
function openIconModal(callback) {
    activeIconCallback = callback;
    const grid = document.getElementById('iconGrid');
    grid.innerHTML = '';
    iconLibrary.forEach(icon => {
        const btn = document.createElement('button');
        btn.className = 'icon-btn';
        btn.innerHTML = `<i class="fa-solid ${icon} mb-2"></i><span class="text-[10px] text-slate-400 break-words w-full">${icon.replace('fa-', '')}</span>`;
        btn.onclick = () => { activeIconCallback(icon); closeIconModal(); };
        grid.appendChild(btn);
    });
    showModal('iconModal');
}

// --- COOKIE & PRIVACY LOGIC ---
function checkCookieConsent() {
    const consent = localStorage.getItem('openDeck_cookieConsent');

    // Landing Page Footer Elements
    const statusBtn = document.getElementById('cookieStatusBtn');
    const separator = document.getElementById('cookieSeparator');
    const statusText = document.getElementById('cookieStatusText');

    // Dashboard Footer Elements
    const statusBtnDash = document.getElementById('cookieStatusBtnDash');
    const separatorDash = document.getElementById('cookieSeparatorDash');
    const statusTextDash = document.getElementById('cookieStatusTextDash');

    if (!consent) {
        document.getElementById('cookieBanner').style.display = 'flex';
        if (statusBtn) statusBtn.style.display = 'none';
        if (separator) separator.style.display = 'none';
        if (statusBtnDash) statusBtnDash.style.display = 'none';
        if (separatorDash) separatorDash.style.display = 'none';
    } else {
        document.getElementById('cookieBanner').style.display = 'none';
        if (statusBtn) statusBtn.style.display = 'inline';
        if (separator) separator.style.display = 'inline';
        if (statusBtnDash) statusBtnDash.style.display = 'inline';
        if (separatorDash) separatorDash.style.display = 'inline';

        const isAccepted = consent === 'accepted';
        const textToDisplay = isAccepted ? 'Accepted' : 'Declined';
        const classToApply = isAccepted ? 'text-green-400 font-bold' : 'text-red-400 font-bold';

        if (statusText) {
            statusText.innerText = textToDisplay;
            statusText.className = classToApply;
        }
        if (statusTextDash) {
            statusTextDash.innerText = textToDisplay;
            statusTextDash.className = classToApply;
        }
    }
}

function handleCookieConsent(accepted) {
    // Save their preference so it doesn't pop up again
    localStorage.setItem('openDeck_cookieConsent', accepted ? 'accepted' : 'declined');

    // Re-run the check to instantly update the footer UI and hide the banner
    checkCookieConsent();
}

function openCookieSettings() {
    const consent = localStorage.getItem('openDeck_cookieConsent');
    const settingsText = document.getElementById('cookieSettingsText');
    const toggle = document.getElementById('cookieToggle');

    // Set the initial state of the modal based on their past choice
    const isAccepted = consent === 'accepted';
    toggle.checked = isAccepted;
    updateToggleVisuals(isAccepted);

    // Show the modal
    showModal('cookieSettingsModal');
}

function toggleCookieConsent(isAccepted) {
    // 1. Save the new choice and update the footer instantly
    handleCookieConsent(isAccepted);

    // 2. Update the visuals in the modal dynamically
    updateToggleVisuals(isAccepted);
}

function updateToggleVisuals(isAccepted) {
    const settingsText = document.getElementById('cookieSettingsText');
    const track = document.getElementById('toggleTrack');
    const knob = document.getElementById('toggleKnob');

    if (isAccepted) {
        settingsText.innerHTML = `You have chosen to <strong class="text-green-400">Accept</strong> analytics. You can toggle this to change your decision at any time.`;
        track.classList.replace('bg-slate-700', 'bg-blue-600');
        knob.style.transform = 'translateX(24px)'; // Slide knob to the right
    } else {
        settingsText.innerHTML = `You have chosen to <strong class="text-red-400">Decline</strong> analytics. You can toggle this to change your decision at any time.`;
        track.classList.replace('bg-blue-600', 'bg-slate-700');
        knob.style.transform = 'translateX(0px)'; // Slide knob to the left
    }
}

// Run the check immediately
checkCookieConsent();

function closeIconModal() { hideModal('iconModal'); activeIconCallback = null; }

// Explicitly expose to window
window.startAppFromLanding = startAppFromLanding;
window.renderDashboard = renderDashboard;
window.createNewProject = createNewProject;
window.openProject = openProject;
window.presentDirectly = presentDirectly;
window.returnToDashboard = returnToDashboard;
window.updateProjectTitle = updateProjectTitle;
window.deleteProject = deleteProject;
window.duplicateProject = duplicateProject;
window.exportOdeck = exportOdeck;
window.importProject = importProject;
window.showModal = showModal;
window.hideModal = hideModal;
window.openTemplateModal = openTemplateModal;
window.closeTemplateModal = closeTemplateModal;
window.switchTemplateTab = switchTemplateTab;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.updateGlobalSetting = updateGlobalSetting;
window.openIconModal = openIconModal;
window.closeIconModal = closeIconModal;
window.returnToLanding = returnToLanding;
window.handleCookieConsent = handleCookieConsent;
window.openCookieSettings = openCookieSettings;
window.toggleCookieConsent = toggleCookieConsent;
window.createDemoProject = createDemoProject;