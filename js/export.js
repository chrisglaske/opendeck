// ==========================================
// 8. EXPORT ENGINES (HTML, PDF, PPTX) & PRESENTER VIEW
// ==========================================

function exportToPDF() {
    const fullHTML = getCompiledHTML(true);
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    win.onload = function () { setTimeout(() => { win.print(); }, 800); };
}

async function exportToPPTX() {
    saveProjects();
    let pres = new PptxGenJS();
    pres.layout = 'LAYOUT_16x9';

    let masterObjects = [
        { rect: { x: 0.5, y: 0.3, w: 0.3, h: 0.3, fill: { color: globalSettings.theme.replace('#', '') } } },
        { text: { text: globalSettings.headerIcon, options: { x: 0.5, y: 0.3, w: 0.3, h: 0.3, align: "center", valign: "middle", color: "FFFFFF", bold: true, fontSize: 14 } } },
        { text: { text: globalSettings.headerText, options: { x: 0.9, y: 0.3, w: 5, h: 0.3, color: "94A3B8", bold: true, fontSize: 12 } } },
        { line: { x: 0.5, y: 5.3, w: 9, h: 0, line: { color: "1E293B", width: 1 } } }
    ];

    if (globalSettings.companyLogo) {
        masterObjects.push({ image: { data: globalSettings.companyLogo, x: 8.5, y: 4.8, w: 1.0, h: 0.5, sizing: { type: 'contain' } } });
    }

    pres.defineSlideMaster({
        title: "MASTER_SLIDE",
        background: { color: "0F172A" },
        objects: masterObjects
    });

    let accentHex = globalSettings.theme.replace('#', '');

    slides.forEach(s => {
        let slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
        if (s.notes) slide.addNotes(s.notes);

        if (s.bgOverride === 'bg-pitchblack') slide.background = { color: "000000" };
        if (s.bgOverride === 'bg-deepblue') slide.background = { color: "020617" };
        if (s.bgOverride === 'bg-purewhite') slide.background = { color: "FFFFFF" };

        if (s.type === 'intro') {
            slide.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 0.8, w: 9, h: 4.2, fill: { color: "111827" }, line: { color: "1E293B", width: 1 } });
            slide.addText(s.title || '', { x: 1, y: 1.8, w: 8, h: 1, color: "FFFFFF", fontSize: 48, align: 'center', bold: true });
            slide.addText(s.subtitle || '', { x: 1, y: 2.8, w: 8, h: 0.8, color: "94A3B8", fontSize: 20, align: 'center' });
        }
        else if (s.type === 'split') {
            slide.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 0.8, w: 9, h: 4.2, fill: { color: "111827" }, line: { color: "1E293B", width: 1 } });
            slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 0.8, w: 0.1, h: 4.2, fill: { color: accentHex } });
            slide.addText(s.title || '', { x: 0.8, y: 1.0, w: 8, h: 0.6, color: "FFFFFF", fontSize: 32, bold: true });
            slide.addText(s.subtitle || '', { x: 0.8, y: 1.8, w: 4.2, h: 1.2, color: "94A3B8", fontSize: 16 });
            let bullets = (s.bullets || []).map(b => ({ text: b, options: { bullet: { color: accentHex } } }));
            if (bullets.length > 0) slide.addText(bullets, { x: 0.8, y: 3, w: 4.2, h: 1.5, color: "FFFFFF", fontSize: 16 });
            if (s.image) { slide.addImage({ data: s.image, x: 5.2, y: 1.2, w: 4, h: 3.4, sizing: { type: 'contain' } }); }
        }
        else if (s.type === 'grid') {
            slide.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 0.8, w: 9, h: 4.2, fill: { color: "111827" }, line: { color: "1E293B", width: 1 } });
            slide.addText(s.title || '', { x: 0.8, y: 1.0, w: 8, h: 0.6, color: "FFFFFF", fontSize: 32, bold: true });
            let startX = 0.8;
            let width = (8.4 / (s.cards ? s.cards.length : 1)) - 0.2;
            (s.cards || []).forEach((c, i) => {
                let x = startX + (i * (width + 0.2));
                slide.addShape(pres.ShapeType.roundRect, { x: x, y: 2.4, w: width, h: 2.2, fill: { color: "1E293B" } });
                slide.addText(c.title || '', { x: x, y: 3.6, w: width, h: 0.4, color: "FFFFFF", fontSize: 16, align: 'center', bold: true });
            });
        }
        else if (s.type === 'list') {
            slide.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 0.8, w: 9, h: 4.2, fill: { color: "111827" }, line: { color: "1E293B", width: 1 } });
            slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 0.8, w: 0.1, h: 4.2, fill: { color: accentHex } });
            slide.addText(s.title || '', { x: 0.8, y: 1.0, w: 8, h: 0.6, color: "FFFFFF", fontSize: 32, bold: true });
            let startY = 2.8;
            (s.items || []).forEach((item, i) => {
                let hexColor = (item.color || accentHex).replace('#', '');
                slide.addShape(pres.ShapeType.roundRect, { x: 0.8, y: startY + (i * 0.7), w: 4.2, h: 0.6, fill: { color: "1E293B" } });
                slide.addText(item.label || '', { x: 0.9, y: startY + (i * 0.7), w: 2.5, h: 0.6, color: "FFFFFF", fontSize: 14 });
                slide.addText(item.value || '', { x: 3.4, y: startY + (i * 0.7), w: 1.4, h: 0.6, color: hexColor, fontSize: 14, align: 'right', bold: true });
            });
        }
        else if (s.type === 'pitch_hero') {
            if (s.image) slide.addImage({ data: s.image, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: 'cover' } });
            slide.addText(s.title || '', { x: 0.5, y: 2, w: 9, h: 1.5, color: "FFFFFF", fontSize: 60, align: 'center', bold: true });
        }
    });

    const p = projects.find(x => x.id === activeProjectId);
    const name = p ? p.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'presentation';
    pres.writeFile({ fileName: name + ".pptx" });
}

function getCompiledHTML(isPDF = false) {
    saveProjects(false);
    let navItems = slides.map((s, i) => `<div class="nav-item \${i===0?'active':''}" onclick="goToSlide(\${i})">${escapeHtml(s.navName)}</div>`).join('\n            ');

    let slideBlocks = slides.map((s, i) => {
        let html = generateSlideHTML(s, true);
        html = html.replace(/contenteditable="true"/g, '').replace(/onblur="[^"]*"/g, '');
        return `<section class="slide ${s.bgOverride || 'bg-default'}" id="slide-${i}">\n                ${html}\n            </section>`;
    }).join('\n\n        ');

    let totalSlides = slides.length;
    let notesData = JSON.stringify(slides.map(s => ({ notes: s.notes || '', name: s.navName || 'Untitled' })));
    let uniqueSyncKey = 'openDeckSync_' + Date.now();

    let pdfPrintStyles = isPDF ? `
        @media print {
            @page { size: 16in 9in; margin: 0; }
            body { background: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: visible; }
            .top-nav, .nav-btn, .slide-indicator, #helpBtn, #helpModal { display: none !important; }
            .slide-container { display: block; width: 100vw; height: auto; transform: none !important; }
            .slide { width: 16in; height: 9in; page-break-after: always; position: relative; overflow: hidden; padding: 4rem; }
            .theme-card { animation: none !important; transform: none !important; opacity: 1 !important; box-shadow: none !important; }
        }
    ` : '';

    let fontImport = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap";

    if (globalSettings.font.includes('Roboto')) fontImport = "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap";
    else if (globalSettings.font.includes('Space Grotesk')) fontImport = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap";
    else if (globalSettings.font.includes('Playfair')) fontImport = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap";

    // Inject custom font URL if it exists in the saved list
    if (globalSettings.savedFonts) {
        let match = globalSettings.savedFonts.find(f => f.family === globalSettings.font);
        if (match) fontImport = match.url;
    }

    // The output string utilizes BroadcastChannel for pristine cross-tab communication
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(globalSettings.headerText)}</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link href="${fontImport}" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@700&display=swap" rel="stylesheet">
<style>
:root { --bg-dark: #000000; --accent-color: ${globalSettings.theme}; --global-font: ${globalSettings.font}; }
body { font-family: var(--global-font); background-color: var(--bg-dark); color: white; overflow: hidden; margin: 0; }

.top-nav { position: fixed; top: 0; left: 0; right: 0; height: 4rem; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(12px); border-bottom: 1px solid color-mix(in srgb, var(--accent-color) 20%, transparent); display: flex; align-items: center; justify-content: space-between; padding: 0 2rem; z-index: 1000; }
.nav-links-container { display: flex; gap: 0.25rem; overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; }
.nav-links-container::-webkit-scrollbar { display: none; }
.nav-item { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; padding: 0.5rem 0.75rem; cursor: pointer; transition: all 0.3s; border-bottom: 2px solid transparent; white-space: nowrap; }
.nav-item.active { color: var(--accent-color); border-bottom: 2px solid var(--accent-color); }

.slide-container { display: flex; transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1); height: 100vh; width: ${totalSlides}00vw; }
.slide { width: 100vw; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4rem; position: relative; }

.bg-default { background: radial-gradient(circle at 50% 50%, #111827 0%, #000000 100%); }
.bg-deepblue { background: radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%); }
.bg-midnight { background: radial-gradient(circle at 50% 50%, #2e1065 0%, #000000 100%); }
.bg-pitchblack { background: #000000; }
.bg-purewhite { background: #ffffff; color: #000000 !important; }

.theme-card { background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(10px); border: 1px solid color-mix(in srgb, var(--accent-color) 15%, transparent); border-radius: 1.5rem; padding: 4rem; max-width: 1200px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8); }
.bg-purewhite .theme-card { background: rgba(255, 255, 255, 0.95); border-color: rgba(0,0,0,0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1); }
.accent-text { color: var(--accent-color); }

.nav-btn { position: fixed; bottom: 2rem; background: rgba(30, 30, 30, 0.8); border: 1px solid color-mix(in srgb, var(--accent-color) 30%, transparent); color: white; width: 3.5rem; height: 3.5rem; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 100; transition: all 0.2s; }
.nav-btn:hover { background: var(--accent-color); color: white; transform: scale(1.1); }
.prev-btn { left: 2rem; } .next-btn { right: 2rem; }
.slide-indicator { position: fixed; bottom: 2.5rem; left: 50%; transform: translateX(-50%); display: flex; gap: 0.5rem; }
.dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: #333; transition: all 0.3s; }
.dot.active { background: var(--accent-color); width: 1.5rem; border-radius: 1rem; }

.fade-in { animation: fadeIn 0.8s ease-out forwards; }
.slide-up { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.zoom-in { animation: zoomIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(60px); } to { opacity: 1; transform: translateY(0); } }
@keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }

/* AMAZING PRO PRESENTER VIEW UI */
#presenterView { display: none; background: #020617; color: white; height: 100vh; padding: 2rem; box-sizing: border-box; overflow: hidden; flex-direction: column; font-family: var(--global-font); }
.p-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.p-title-area h2 { margin: 0; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.025em; display: flex; align-items: center; gap: 0.75rem; }
.p-badge { background: var(--accent-color); color: white; font-size: 0.65rem; padding: 0.2rem 0.5rem; border-radius: 0.5rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; }
.p-time { font-family: 'Space Mono', monospace; font-size: 3rem; font-weight: 700; color: white; text-shadow: 0 0 20px rgba(255,255,255,0.2); tabular-nums: true; letter-spacing: -0.05em; }

.p-body { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; flex-grow: 1; height: calc(100vh - 120px); }

.p-main-col { display: flex; flex-direction: column; gap: 1.5rem; }
.p-side-col { display: flex; flex-direction: column; gap: 1.5rem; }

.p-box { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 1.5rem; display: flex; flex-direction: column; overflow: hidden; backdrop-filter: blur(10px); }
.p-box-header { padding: 1rem 1.5rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em; border-bottom: 1px solid rgba(255,255,255,0.05); display:flex; justify-content: space-between; }

.p-preview-container { flex-grow: 1; position: relative; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.p-scale-wrapper { width: 1200px; height: 800px; position: absolute; transform-origin: center center; background: #000; border-radius: 1rem; overflow: hidden; }

.p-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.p-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 1.5rem; border-radius: 1rem; font-size: 1.2rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.p-btn:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); }
.p-btn-next { background: var(--accent-color); border-color: var(--accent-color); box-shadow: 0 10px 30px -10px var(--accent-color); }
.p-btn-next:hover { background: color-mix(in srgb, var(--accent-color) 80%, white); box-shadow: 0 15px 40px -10px var(--accent-color); }

.p-notes-content { padding: 1.5rem; flex-grow: 1; overflow-y: auto; font-size: 1.5rem; line-height: 1.6; color: #e2e8f0; font-weight: 300; }

.timer-wrap { display: flex; flex-direction: column; align-items: flex-end; }
.timer-label { font-size: 0.65rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.1em; font-weight: 700; margin-bottom: -0.5rem; z-index: 10; }

${pdfPrintStyles}
</style>
</head>
<body class="exporting">

<div id="standardView">
    <nav class="top-nav" id="topNav">
        <div class="flex items-center gap-2 mr-8 flex-shrink-0">
            <div class="bg-blue-600 rounded px-2 py-0.5 font-bold text-white text-sm" style="background-color: var(--accent-color)">${escapeHtml(globalSettings.headerIcon)}</div>
            <span class="font-bold tracking-tight whitespace-nowrap">${escapeHtml(globalSettings.headerText)}</span>
        </div>
        <div class="nav-links-container">${navItems}</div>
    </nav>

    <div class="slide-container" id="container">${slideBlocks}</div>

    <div class="nav-btn prev-btn" onclick="prevSlide()"><i class="fa-solid fa-chevron-left"></i></div>
    <div class="nav-btn next-btn" onclick="nextSlide()"><i class="fa-solid fa-chevron-right"></i></div>
    <div class="slide-indicator" id="indicator"></div>

    <div id="helpBtn" class="fixed top-20 right-6 w-8 h-8 bg-slate-900/50 border border-slate-700/50 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 hover:border-slate-500 cursor-pointer z-[2000] shadow-lg transition-all opacity-20 hover:opacity-100" onclick="document.getElementById('helpModal').style.display='flex'">
        <i class="fa-solid fa-question text-xs"></i>
    </div>
    
    <div id="helpModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[3000] hidden items-center justify-center transition-all" onclick="this.style.display='none'">
        <div class="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl" onclick="event.stopPropagation()">
            <i class="fa-solid fa-chalkboard-user text-5xl text-blue-500 mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"></i>
            <h2 class="text-2xl font-bold text-white mb-4">Speaker Controls</h2>
            <ul class="text-slate-300 text-left space-y-4 mb-8 bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
                <li class="flex items-center"><strong class="w-24 text-center text-white px-2 py-1.5 bg-slate-950 rounded mr-3 shadow-inner text-sm font-mono border border-slate-800">Space ➔</strong> <span class="text-sm">Next Slide</span></li>
                <li class="flex items-center"><strong class="w-24 text-center text-white px-2 py-1.5 bg-slate-950 rounded mr-3 shadow-inner text-sm font-mono border border-slate-800">←</strong> <span class="text-sm">Previous Slide</span></li>
                <li class="flex items-center"><strong class="w-24 text-center text-blue-400 px-2 py-1.5 bg-blue-900/30 rounded mr-3 shadow-inner text-sm font-mono border border-blue-900">S</strong> <span class="text-sm font-bold text-white">Open Speaker View</span></li>
            </ul>
            <div class="flex gap-4">
                <button class="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-6 py-3 rounded-xl font-bold w-full transition-all" onclick="document.getElementById('helpModal').style.display='none'">Close</button>
                <button class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold w-full shadow-lg transition-all flex items-center justify-center gap-2" onclick="openSpeakerView()"><i class="fa-solid fa-desktop"></i> Speaker View</button>
            </div>
        </div>
    </div>
</div>

<div id="presenterView">
    <div class="p-header">
        <div class="p-title-area">
            <h2>${escapeHtml(globalSettings.headerText)} <span class="p-badge">Speaker View</span></h2>
            <div class="text-slate-400 text-sm mt-1 font-mono uppercase tracking-widest" id="p-slide-status">Slide 1 of ${totalSlides}</div>
        </div>
        <div class="timer-wrap">
            <span class="timer-label">Elapsed Time</span>
            <div id="timerDisplay" class="p-time" style="color: var(--accent-color);">00:00:00</div>
        </div>
    </div>
    <div class="p-body">
        <div class="p-main-col">
            <div class="p-box" style="flex-grow: 1;">
                <div class="p-box-header">Current Slide</div>
                <div class="p-preview-container" id="p-current-wrapper">
                    <div class="p-scale-wrapper" id="p-current-container"></div>
                </div>
            </div>
            <div class="p-controls">
                <button class="p-btn" onclick="prevSlide()"><i class="fa-solid fa-arrow-left"></i> Previous</button>
                <button class="p-btn p-btn-next" onclick="nextSlide()">Next <i class="fa-solid fa-arrow-right"></i></button>
            </div>
        </div>
        <div class="p-side-col">
            <div class="p-box" style="height: 35vh; opacity: 0.8;">
                <div class="p-box-header"><span>Next Slide</span> <span id="p-next-indicator" class="text-slate-500">2</span></div>
                <div class="p-preview-container" id="p-next-wrapper">
                     <div class="p-scale-wrapper" id="p-next-container"></div>
                </div>
            </div>
            <div class="p-box" style="flex-grow: 1;">
                <div class="p-box-header">Speaker Notes</div>
                <div class="p-notes-content" id="p-notes-content"></div>
            </div>
        </div>
    </div>
</div>

<script>
const container = document.getElementById('container');
const dotsContainer = document.getElementById('indicator');
const navItems = document.querySelectorAll('.nav-item');
const numSlides = ${totalSlides};
const notesData = ${notesData};
const syncKey = '${uniqueSyncKey}';
let currentSlide = 0;
let presenterWindow = null;

// Use BroadcastChannel! This completely bypasses localStorage blob restrictions!
const syncChannel = new BroadcastChannel(syncKey);

// Presenter View Check 
const isPresenter = window.location.hash === '#presenter' || window.isPresenterOverride;

if (isPresenter) {
    document.getElementById('standardView').style.display = 'none';
    document.getElementById('presenterView').style.display = 'flex';
    document.title = "Speaker View - " + document.title;
    startTimer();
    window.addEventListener('resize', scalePresenterPreviews);
} else {
    for (let i = 0; i < numSlides; i++) {
        const dot = document.createElement('div');
        dot.className = \`dot \${i === 0 ? 'active' : ''}\`;
        dotsContainer.appendChild(dot);
    }
}

// Fire the update explicitly on load so the Speaker view isn't blank
window.addEventListener('DOMContentLoaded', () => {
    if (isPresenter) {
        updateSlide(true);
        setTimeout(scalePresenterPreviews, 100);
    }
});

function updateSlide(skipSync = false) {
    if (!isPresenter) {
        container.style.transform = \`translateX(-\${currentSlide * 100}vw)\`;
        const currentSection = document.querySelectorAll('.slide')[currentSlide];
        if(currentSection) {
            const card = currentSection.querySelector('.theme-card, .absolute.inset-0.z-0');
            if(card) { card.style.animation = 'none'; card.offsetHeight; card.style.animation = null; }
        }
        const dots = document.querySelectorAll('.dot');
        dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentSlide));
        navItems.forEach((item, idx) => item.classList.toggle('active', idx === currentSlide));
        if(navItems[currentSlide]) navItems[currentSlide].scrollIntoView({behavior: "smooth", block: "nearest", inline: "center"});
    } else {
        document.getElementById('p-slide-status').innerText = \`Slide \${currentSlide + 1} of \${numSlides} - \${notesData[currentSlide].name}\`;
        document.getElementById('p-next-indicator').innerText = currentSlide < numSlides - 1 ? \`Slide \${currentSlide + 2}\` : 'End';
        document.getElementById('p-notes-content').innerText = notesData[currentSlide].notes || 'No notes for this slide.';
        
        const currBox = document.getElementById('p-current-container');
        const nextBox = document.getElementById('p-next-container');
        const sourceCurrent = document.getElementById('slide-' + currentSlide);
        const sourceNext = currentSlide < numSlides - 1 ? document.getElementById('slide-' + (currentSlide + 1)) : null;

        currBox.innerHTML = ''; nextBox.innerHTML = '';
        if (sourceCurrent) { 
            let clone = sourceCurrent.cloneNode(true); 
            // We lock the cloned theme-slide to fill the fixed 1200x800 wrapper exactly as it looks in the builder
            clone.className = 'theme-slide ' + sourceCurrent.className.split(' ').find(c => c.startsWith('bg-')); 
            currBox.appendChild(clone); 
        }
        if (sourceNext) { 
            let clone = sourceNext.cloneNode(true); 
            clone.className = 'theme-slide ' + sourceNext.className.split(' ').find(c => c.startsWith('bg-')); 
            nextBox.appendChild(clone); 
        }
        scalePresenterPreviews();
    }

    // Ping the robust BroadcastChannel to update the other window!
    if (!skipSync) {
        syncChannel.postMessage(currentSlide.toString());
    }
}

function scalePresenterPreviews() {
    if(!isPresenter) return;
    const currWrap = document.getElementById('p-current-wrapper');
    const currBox = document.getElementById('p-current-container');
    const nextWrap = document.getElementById('p-next-wrapper');
    const nextBox = document.getElementById('p-next-container');
    
    // Calculate the perfect uniform scale factor based on the 1200x800 raw aspect ratio
    if (currWrap && currBox) {
        const scale = Math.min(currWrap.clientWidth / 1200, currWrap.clientHeight / 800) * 0.95;
        currBox.style.transform = \`scale(\${scale})\`;
    }
    if (nextWrap && nextBox) {
        const scale = Math.min(nextWrap.clientWidth / 1200, nextWrap.clientHeight / 800) * 0.95;
        nextBox.style.transform = \`scale(\${scale})\`;
    }
}

function goToSlide(n, skipSync = false) { currentSlide = n; updateSlide(skipSync); }
function nextSlide() { if (currentSlide < numSlides - 1) { currentSlide++; updateSlide(); } }
function prevSlide() { if (currentSlide > 0) { currentSlide--; updateSlide(); } }

function openSpeakerView() {
    document.getElementById('helpModal').style.display='none';
    
    // Prevent multiple window openings!
    if (presenterWindow && !presenterWindow.closed) {
        presenterWindow.focus();
        return;
    }
    
    // Bulletproof Blob fallback: Copy the DOM and forcefully inject the override script!
    if (window.location.protocol === 'blob:') {
        presenterWindow = window.open('', 'SpeakerView', 'width=1200,height=800');
        presenterWindow.document.write('<!DOCTYPE html><html><head><script>window.isPresenterOverride=true;<\\/script>' + document.head.innerHTML + '</head><body class="exporting">' + document.body.innerHTML + '</body></html>');
        presenterWindow.document.close();
    } else {
        presenterWindow = window.open(window.location.href.split('#')[0] + '#presenter', 'SpeakerView', 'width=1200,height=800');
    }
}

// Receive messages from the other window instantly via BroadcastChannel!
syncChannel.onmessage = (event) => {
    let newSlide = parseInt(event.data, 10);
    if(!isNaN(newSlide) && newSlide !== currentSlide) { 
        currentSlide = newSlide; 
        updateSlide(true); // true prevents an infinite loop bounce back!
    }
};

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 's' || e.key === 'S') openSpeakerView();
});

let startTime, timerInterval;
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const diff = Date.now() - startTime;
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        const display = document.getElementById('timerDisplay');
        if(display) display.innerText = h + ':' + m + ':' + s; // Pure JS fixes escaping logic bugs!
    }, 1000);
}
<\/script>
</body>
</html>`;
}

function presentInBrowser() {
    const fullHTML = getCompiledHTML(false);
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}

function exportPresentation() {
    const fullHTML = getCompiledHTML(false);
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const p = projects.find(x => x.id === activeProjectId);
    const name = p ? p.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'presentation';
    a.download = name + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Explicitly expose to window
window.exportToPDF = exportToPDF;
window.exportToPPTX = exportToPPTX;
window.getCompiledHTML = getCompiledHTML;
window.presentInBrowser = presentInBrowser;
window.exportPresentation = exportPresentation;