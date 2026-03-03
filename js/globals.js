// ==========================================
// 1. DATA MODEL & GLOBALS
// Using 'var' ensures these are attached to the global window object across all files
// ==========================================
var projects = [];
var activeProjectId = null;
var slides = [];
var slideCounter = 0;
var currentSlideId = null;
var globalSettings = { theme: '#3B82F6', font: "'Inter', sans-serif", headerText: 'OpenDeck', headerIcon: 'OD' };

var iconLibrary = [
    'fa-desktop', 'fa-laptop', 'fa-mobile', 'fa-server', 'fa-database', 'fa-cloud', 'fa-network-wired', 'fa-wifi',
    'fa-shield-halved', 'fa-shield-check', 'fa-lock', 'fa-wall-brick', 'fa-user-shield', 'fa-key', 'fa-eye', 'fa-eye-slash',
    'fa-bolt', 'fa-rocket', 'fa-chart-line', 'fa-arrow-trend-up', 'fa-wrench', 'fa-screwdriver-wrench', 'fa-gear', 'fa-sliders',
    'fa-check', 'fa-xmark', 'fa-circle-exclamation', 'fa-circle-question', 'fa-circle-info', 'fa-triangle-exclamation', 'fa-bell',
    'fa-file-zipper', 'fa-file-code', 'fa-download', 'fa-upload', 'fa-terminal', 'fa-code', 'fa-code-pull-request', 'fa-bug',
    'fa-history', 'fa-clock', 'fa-calendar', 'fa-users', 'fa-user', 'fa-hand-holding-hand', 'fa-lightbulb', 'fa-star', 'fa-heart',
    'fa-apple', 'fa-windows', 'fa-linux', 'fa-github', 'fa-slack', 'fa-image', 'fa-list-check', 'fa-link', 'fa-quote-left', 'fa-bullseye', 'fa-timeline'
];

// Universal text escaper attached immediately so the UI loop NEVER throws an undefined error
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// BOOTSTRAP WITH STATE PERSISTENCE
window.onload = () => {
    // If this is the exported Speaker View, DO NOT boot the main app UI!
    if (window.location.hash === '#presenter' || window.isPresenterOverride) return;

    // Load DB silently to check for projects
    if (window.loadProjects) loadProjects();

    // Check where the user was last before they refreshed
    const appState = localStorage.getItem('openDeckAppState');

    if (appState === 'dashboard') {
        document.getElementById('landingView').style.display = 'none';
        bootAppToDashboard();
    } else if (appState && appState.startsWith('proj_')) {
        document.getElementById('landingView').style.display = 'none';
        // If the project still exists, open it directly!
        if (projects.some(p => p.id === appState)) {
            // Give UI a millisecond to render before pushing project data
            setTimeout(() => { if (window.openProject) openProject(appState); }, 50);
        } else {
            // Fallback if they deleted the project in another tab
            bootAppToDashboard();
        }
    }
    // If no state is saved, it naturally stays on the beautiful landing page.
};

function bootAppToDashboard() {
    const loadingScreen = document.getElementById('loadingSequence');
    const dashGrid = document.getElementById('projectGrid');
    const dashHeader = document.getElementById('dashHeader');
    const bar = document.getElementById('loadingBar');
    const text = document.getElementById('loadingText');

    document.getElementById('dashboardView').style.display = 'flex';
    loadingScreen.style.display = 'flex';
    dashHeader.style.display = 'none';
    dashGrid.style.display = 'none';

    // Snappy loading sequence
    setTimeout(() => { bar.style.width = '30%'; text.innerText = 'Connecting to Local Database...'; }, 150);
    setTimeout(() => { bar.style.width = '70%'; text.innerText = `Found ${projects.length} presentations...`; }, 400);
    setTimeout(() => { bar.style.width = '100%'; text.innerText = 'Rendering assets...'; }, 700);
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        dashHeader.style.display = 'flex';
        dashGrid.style.display = 'grid';

        // --- NEW: SEED DEMO PROJECT ON FIRST BOOT ---
        if (projects.length === 0 && !localStorage.getItem('openDeckDemoSeeded')) {
            if (window.createDemoProject) createDemoProject();
            localStorage.setItem('openDeckDemoSeeded', 'true');
        }

        if (window.renderDashboard) renderDashboard();
        if (window.checkTutorial) checkTutorial();
    }, 1000);
}
// Explicitly expose to window
window.escapeHtml = escapeHtml;
window.bootAppToDashboard = bootAppToDashboard;