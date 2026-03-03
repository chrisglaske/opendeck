// ==========================================
// 2. CORE STORAGE FUNCTIONS
// ==========================================

function loadProjects() {
    try {
        const data = localStorage.getItem('openDeckDB_v2');
        if (data) projects = JSON.parse(data);
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
        localStorage.setItem('openDeckDB_v2', JSON.stringify(projects));
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
        localStorage.removeItem('openDeckDB_v2');
        localStorage.removeItem('openDeckTutSeen');
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