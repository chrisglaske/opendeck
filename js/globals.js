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

// BOOTSTRAP
window.onload = () => { bootApp(); };

function bootApp() {
    const loadingScreen = document.getElementById('loadingSequence');
    const dashGrid = document.getElementById('projectGrid');
    const dashHeader = document.getElementById('dashHeader');
    const bar = document.getElementById('loadingBar');
    const text = document.getElementById('loadingText');

    setTimeout(() => { bar.style.width = '30%'; text.innerText = 'Connecting to Local Database...'; }, 300);
    setTimeout(() => {
        loadProjects();
        bar.style.width = '70%';
        text.innerText = `Found ${projects.length} presentations...`;
    }, 800);
    setTimeout(() => { bar.style.width = '100%'; text.innerText = 'Rendering assets...'; }, 1300);
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        dashHeader.style.display = 'flex';
        dashGrid.style.display = 'grid';
        renderDashboard();
        checkTutorial();
    }, 1800);
}

// Explicitly expose to window
window.bootApp = bootApp;