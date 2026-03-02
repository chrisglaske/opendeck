// ==========================================
// 8. EXPORT ENGINES (HTML, PDF, PPTX)
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

    pres.defineSlideMaster({
        title: "MASTER_SLIDE",
        background: { color: "0F172A" },
        objects: [
            { rect: { x: 0.5, y: 0.3, w: 0.3, h: 0.3, fill: { color: globalSettings.theme.replace('#', '') } } },
            { text: { text: globalSettings.headerIcon, options: { x: 0.5, y: 0.3, w: 0.3, h: 0.3, align: "center", valign: "middle", color: "FFFFFF", bold: true, fontSize: 14 } } },
            { text: { text: globalSettings.headerText, options: { x: 0.9, y: 0.3, w: 5, h: 0.3, color: "94A3B8", bold: true, fontSize: 12 } } },
            { line: { x: 0.5, y: 5.3, w: 9, h: 0, line: { color: "1E293B", width: 1 } } }
        ]
    });

    let accentHex = globalSettings.theme.replace('#', '');

    slides.forEach(s => {
        let slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
        if (s.notes) slide.addNotes(s.notes);

        if (s.bgOverride === 'bg-pitchblack') slide.background = { color: "000000" };
        if (s.bgOverride === 'bg-deepblue') slide.background = { color: "020617" };
        if (s.bgOverride === 'bg-purewhite') slide.background = { color: "FFFFFF" };

        // Modern Tech
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
            else {
                slide.addShape(pres.ShapeType.roundRect, { x: 5.2, y: 1.4, w: 4, h: 3.2, fill: { color: "0F172A" }, line: { color: "1E293B" } });
                slide.addText(s.boxTitle || '', { x: 5.2, y: 2.2, w: 4, h: 0.5, color: "FFFFFF", fontSize: 20, align: 'center', bold: true });
                slide.addText(s.boxText || '', { x: 5.5, y: 2.8, w: 3.4, h: 1, color: "94A3B8", fontSize: 14, align: 'center' });
            }
        }
        else if (s.type === 'grid') {
            slide.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 0.8, w: 9, h: 4.2, fill: { color: "111827" }, line: { color: "1E293B", width: 1 } });
            slide.addText(s.title || '', { x: 0.8, y: 1.0, w: 8, h: 0.6, color: "FFFFFF", fontSize: 32, bold: true });
            slide.addText(s.subtitle || '', { x: 0.8, y: 1.6, w: 8, h: 0.5, color: "94A3B8", fontSize: 16 });
            let startX = 0.8;
            let width = (8.4 / (s.cards ? s.cards.length : 1)) - 0.2;
            (s.cards || []).forEach((c, i) => {
                let x = startX + (i * (width + 0.2));
                slide.addShape(pres.ShapeType.roundRect, { x: x, y: 2.4, w: width, h: 2.2, fill: { color: "1E293B" } });
                if (c.image) slide.addImage({ data: c.image, x: x + (width / 2) - 0.4, y: 2.6, w: 0.8, h: 0.8, sizing: { type: 'contain' } });
                slide.addText(c.title || '', { x: x, y: 3.6, w: width, h: 0.4, color: "FFFFFF", fontSize: 16, align: 'center', bold: true });
                slide.addText(c.text || '', { x: x + 0.1, y: 4.0, w: width - 0.2, h: 0.5, color: "94A3B8", fontSize: 12, align: 'center' });
            });
        }
        else if (s.type === 'list') {
            slide.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 0.8, w: 9, h: 4.2, fill: { color: "111827" }, line: { color: "1E293B", width: 1 } });
            slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 0.8, w: 0.1, h: 4.2, fill: { color: accentHex } });
            slide.addText(s.title || '', { x: 0.8, y: 1.0, w: 8, h: 0.6, color: "FFFFFF", fontSize: 32, bold: true });
            slide.addText(s.subtitle || '', { x: 0.8, y: 1.8, w: 4.2, h: 1.0, color: "94A3B8", fontSize: 16 });
            let startY = 2.8;
            (s.items || []).forEach((item, i) => {
                slide.addShape(pres.ShapeType.roundRect, { x: 0.8, y: startY + (i * 0.7), w: 4.2, h: 0.6, fill: { color: "1E293B" } });
                slide.addText(item.label || '', { x: 0.9, y: startY + (i * 0.7), w: 2.5, h: 0.6, color: "FFFFFF", fontSize: 14 });
                slide.addText(item.value || '', { x: 3.4, y: startY + (i * 0.7), w: 1.4, h: 0.6, color: accentHex, fontSize: 14, align: 'right', bold: true });
            });
            slide.addShape(pres.ShapeType.roundRect, { x: 5.4, y: 1.6, w: 3.6, h: 2.8, fill: { color: "0F172A" } });
            slide.addText("Checklist", { x: 5.4, y: 3.0, w: 3.6, h: 0.5, color: "FFFFFF", fontSize: 24, align: 'center', bold: true });
        }
        else if (s.type === 'code') {
            slide.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 0.8, w: 9, h: 4.2, fill: { color: "111827" }, line: { color: "1E293B", width: 1 } });
            slide.addText(s.title || '', { x: 0.8, y: 1.0, w: 8, h: 0.6, color: "FFFFFF", fontSize: 32, bold: true });
            slide.addText(s.subtitle || '', { x: 0.8, y: 1.6, w: 8, h: 0.5, color: "94A3B8", fontSize: 16 });
            slide.addShape(pres.ShapeType.roundRect, { x: 0.8, y: 2.2, w: 8.4, h: 2.6, fill: { color: "020617" }, line: { color: "334155" } });
            slide.addShape(pres.ShapeType.rect, { x: 0.8, y: 2.2, w: 8.4, h: 0.4, fill: { color: "0F172A" } });
            slide.addText(s.codeHeader || '', { x: 1.2, y: 2.2, w: 7, h: 0.4, color: "64748B", fontSize: 10, fontFace: 'Courier New' });

            let codeHex = "34D399";
            if (s.codeColor === 'text-blue-400') codeHex = "60A5FA";
            if (s.codeColor === 'text-pink-400') codeHex = "F472B6";
            if (s.codeColor === 'text-yellow-400') codeHex = "FACC15";
            if (s.codeColor === 'text-white') codeHex = "FFFFFF";

            slide.addText(s.codeContent || '', { x: 1.0, y: 2.7, w: 8.0, h: 2.0, color: codeHex, fontSize: 12, fontFace: 'Courier New', valign: 'top' });
        }
        else if (s.type === 'cta') {
            slide.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 0.8, w: 9, h: 4.2, fill: { color: "111827" }, line: { color: "1E293B", width: 1 } });
            if (s.image) slide.addImage({ data: s.image, x: 4, y: 1.0, w: 2, h: 1.5, sizing: { type: 'contain' } });
            slide.addText(s.title || '', { x: 1, y: 2.6, w: 8, h: 0.8, color: "FFFFFF", fontSize: 40, align: 'center', bold: true });
            slide.addText(s.subtitle || '', { x: 1, y: 3.4, w: 8, h: 0.6, color: "94A3B8", fontSize: 18, align: 'center' });
            if (s.link) {
                slide.addShape(pres.ShapeType.roundRect, { x: 2, y: 4.2, w: 6, h: 0.6, fill: { color: "1E293B" } });
                slide.addText(s.link, { x: 2, y: 4.2, w: 6, h: 0.6, color: "FFFFFF", fontSize: 16, align: 'center', bold: true });
            }
        }

        // Corporate Edge
        else if (s.type === 'corp_title') {
            let textColor = s.bgOverride === 'bg-purewhite' ? '000000' : 'FFFFFF';
            slide.addShape(pres.ShapeType.rect, { x: 1, y: 1.5, w: 1, h: 0.1, fill: { color: accentHex } });
            slide.addText(s.title || '', { x: 1, y: 1.8, w: 8, h: 1.5, color: textColor, fontSize: 54, bold: true });
            slide.addText(s.subtitle || '', { x: 1, y: 3.3, w: 8, h: 0.8, color: "94A3B8", fontSize: 24 });
            slide.addShape(pres.ShapeType.rect, { x: 1, y: 4.2, w: 8, h: 0.02, fill: { color: "334155" } });
            slide.addText(s.author || '', { x: 1, y: 4.4, w: 8, h: 0.5, color: textColor, fontSize: 16, bold: true });
        }
        else if (s.type === 'corp_quote') {
            let textColor = s.bgOverride === 'bg-purewhite' ? '000000' : 'FFFFFF';
            slide.addText("\"", { x: 1, y: 1, w: 8, h: 1, color: accentHex, fontSize: 80, align: 'center', fontFace: 'Georgia' });
            slide.addText(s.title || '', { x: 1, y: 2, w: 8, h: 1.5, color: textColor, fontSize: 36, align: 'center', italic: true, fontFace: 'Georgia' });
            slide.addText("- " + (s.author || ''), { x: 1, y: 4, w: 8, h: 0.5, color: "94A3B8", fontSize: 16, align: 'center', bold: true });
        }
        else if (s.type === 'corp_image_text') {
            let textColor = s.bgOverride === 'bg-purewhite' ? '000000' : 'FFFFFF';
            if (s.image) { slide.addImage({ data: s.image, x: 0.5, y: 0.8, w: 4, h: 4.2, sizing: { type: 'cover' } }); }
            else { slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 0.8, w: 4, h: 4.2, fill: { color: "1E293B" } }); }

            slide.addText(s.title || '', { x: 5, y: 1.2, w: 4.5, h: 1, color: textColor, fontSize: 32, bold: true });
            slide.addText(s.subtitle || '', { x: 5, y: 2.2, w: 4.5, h: 0.8, color: "94A3B8", fontSize: 16 });
            let bullets = (s.bullets || []).map(b => ({ text: b, options: { bullet: { color: accentHex } } }));
            if (bullets.length > 0) slide.addText(bullets, { x: 5, y: 3.2, w: 4.5, h: 1.5, color: textColor, fontSize: 14 });
        }

        // Creative Pitch
        else if (s.type === 'pitch_hero') {
            if (s.image) {
                slide.addImage({ data: s.image, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: 'cover' } });
                slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: "000000", transparency: 60 } });
            }
            else { slide.background = { color: accentHex }; }

            slide.addText(s.title || '', { x: 0.5, y: 2, w: 9, h: 1.5, color: "FFFFFF", fontSize: 60, align: 'center', bold: true });
            slide.addText(s.subtitle || '', { x: 0.5, y: 3.5, w: 9, h: 1, color: "FFFFFF", fontSize: 24, align: 'center' });
        }
        else if (s.type === 'pitch_stats') {
            let textColor = s.bgOverride === 'bg-purewhite' ? '000000' : 'FFFFFF';
            slide.addText(s.title || '', { x: 0.5, y: 1, w: 9, h: 0.8, color: textColor, fontSize: 40, align: 'center', bold: true });
            slide.addText(s.subtitle || '', { x: 0.5, y: 1.8, w: 9, h: 0.5, color: "94A3B8", fontSize: 18, align: 'center' });

            let startX = 0.5;
            let width = 9 / (s.stats ? s.stats.length : 1);
            (s.stats || []).forEach((st, i) => {
                let x = startX + (i * width);
                slide.addText(st.value || '', { x: x, y: 2.8, w: width, h: 1.2, color: accentHex, fontSize: 60, align: 'center', bold: true });
                slide.addText(st.label || '', { x: x, y: 4, w: width, h: 0.5, color: "94A3B8", fontSize: 16, align: 'center', bold: true });
            });
        }
        else if (s.type === 'pitch_timeline') {
            let textColor = s.bgOverride === 'bg-purewhite' ? '000000' : 'FFFFFF';
            slide.addText(s.title || '', { x: 0.5, y: 1, w: 9, h: 0.8, color: textColor, fontSize: 40, align: 'center', bold: true });
            slide.addText(s.subtitle || '', { x: 0.5, y: 1.8, w: 9, h: 0.5, color: "94A3B8", fontSize: 18, align: 'center' });

            slide.addShape(pres.ShapeType.rect, { x: 1, y: 3.5, w: 8, h: 0.05, fill: { color: "334155" } });

            let startX = 1;
            let width = 8 / (s.timeline ? s.timeline.length : 1);
            (s.timeline || []).forEach((t, i) => {
                let x = startX + (i * width) + (width / 2) - 1;
                slide.addShape(pres.ShapeType.oval, { x: x + 0.85, y: 3.35, w: 0.3, h: 0.3, fill: { color: accentHex } });
                slide.addText(t.year || '', { x: x, y: 3.8, w: 2, h: 0.5, color: textColor, fontSize: 20, align: 'center', bold: true });
                slide.addText(t.text || '', { x: x - 0.5, y: 4.3, w: 3, h: 0.8, color: "94A3B8", fontSize: 14, align: 'center' });
            });
        }
    });

    const p = projects.find(x => x.id === activeProjectId);
    const name = p ? p.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'presentation';
    pres.writeFile({ fileName: name + ".pptx" });
}

function getCompiledHTML(isPDF = false) {
    saveProjects(false);
    let navItems = slides.map((s, i) => `<div class="nav-item \${i===0?'active':''}" onclick="goToSlide(\${i})">${escapeHtml(s.navName)}</div>`).join('\n            ');

    let slideBlocks = slides.map(s => {
        let html = generateSlideHTML(s, true);
        html = html.replace(/contenteditable="true"/g, '').replace(/onblur="[^"]*"/g, '');
        return `<section class="slide ${s.bgOverride || 'bg-default'}">\n                ${html}\n            </section>`;
    }).join('\n\n        ');

    let totalSlides = slides.length;
    let pdfPrintStyles = isPDF ? `
        @media print {
            @page { size: 16in 9in; margin: 0; }
            body { background: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow: visible; }
            .top-nav, .nav-btn, .slide-indicator { display: none !important; }
            .slide-container { display: block; width: 100vw; height: auto; transform: none !important; }
            .slide { width: 16in; height: 9in; page-break-after: always; position: relative; overflow: hidden; padding: 4rem; }
            .theme-card { animation: none !important; transform: none !important; opacity: 1 !important; box-shadow: none !important; }
        }
    ` : '';

    let fontImport = "";
    if (globalSettings.font.includes('Roboto')) fontImport = "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap";
    else if (globalSettings.font.includes('Space Grotesk')) fontImport = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap";
    else if (globalSettings.font.includes('Playfair')) fontImport = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap";
    else fontImport = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(globalSettings.headerText)}</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link href="${fontImport}" rel="stylesheet">
<style>
:root { --bg-dark: #000000; --slide-bg: #1a1a1a; --accent-color: ${globalSettings.theme}; --global-font: ${globalSettings.font}; --text-main: #f8fafc; --text-dim: #94a3b8; }
body { font-family: var(--global-font); background-color: var(--bg-dark); color: var(--text-main); overflow: hidden; margin: 0; }

.top-nav { position: fixed; top: 0; left: 0; right: 0; height: 4rem; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(12px); border-bottom: 1px solid color-mix(in srgb, var(--accent-color) 20%, transparent); display: flex; align-items: center; justify-content: space-between; padding: 0 2rem; z-index: 1000; }
.nav-links-container { display: flex; gap: 0.25rem; overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; }
.nav-links-container::-webkit-scrollbar { display: none; }
.nav-item { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); padding: 0.5rem 0.75rem; cursor: pointer; transition: all 0.3s; border-bottom: 2px solid transparent; white-space: nowrap; }
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
.bg-purewhite .text-white { color: #000000 !important; }
.bg-purewhite .text-slate-400 { color: #475569 !important; }
.bg-purewhite .text-slate-300 { color: #334155 !important; }
.bg-purewhite .bg-slate-900 { background-color: #f1f5f9 !important; border-color: #e2e8f0 !important; }
.bg-purewhite .bg-slate-800 { background-color: #f8fafc !important; border-color: #e2e8f0 !important; }

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

${pdfPrintStyles}
</style>
</head>
<body class="exporting">
<nav class="top-nav" id="topNav">
<div class="flex items-center gap-2 mr-8 flex-shrink-0">
    <div class="bg-blue-600 rounded px-2 py-0.5 font-bold text-white text-sm" style="background-color: var(--accent-color)">${escapeHtml(globalSettings.headerIcon)}</div>
    <span class="font-bold tracking-tight whitespace-nowrap">${escapeHtml(globalSettings.headerText)}</span>
</div>
<div class="nav-links-container">
    ${navItems}
</div>
</nav>

<div class="slide-container" id="container">
${slideBlocks}
</div>

<div class="nav-btn prev-btn" onclick="prevSlide()"><i class="fa-solid fa-chevron-left"></i></div>
<div class="nav-btn next-btn" onclick="nextSlide()"><i class="fa-solid fa-chevron-right"></i></div>
<div class="slide-indicator" id="indicator"></div>

<script>
const container = document.getElementById('container');
const dotsContainer = document.getElementById('indicator');
const navItems = document.querySelectorAll('.nav-item');
const numSlides = ${totalSlides};
let currentSlide = 0;

for (let i = 0; i < numSlides; i++) {
    const dot = document.createElement('div');
    dot.className = \`dot \${i === 0 ? 'active' : ''}\`;
    dotsContainer.appendChild(dot);
}

function updateSlide() {
    container.style.transform = \`translateX(-\${currentSlide * 100}vw)\`;
    
    const currentSection = document.querySelectorAll('.slide')[currentSlide];
    if(currentSection) {
        const card = currentSection.querySelector('.theme-card, .absolute.inset-0.z-0');
        if(card) {
            card.style.animation = 'none';
            card.offsetHeight;
            card.style.animation = null; 
        }
    }

    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentSlide));
    navItems.forEach((item, idx) => item.classList.toggle('active', idx === currentSlide));
    if(navItems[currentSlide]) navItems[currentSlide].scrollIntoView({behavior: "smooth", block: "nearest", inline: "center"});
}

function goToSlide(n) { currentSlide = n; updateSlide(); }
function nextSlide() { if (currentSlide < numSlides - 1) { currentSlide++; updateSlide(); } }
function prevSlide() { if (currentSlide > 0) { currentSlide--; updateSlide(); } }

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
    if (e.key === 'ArrowLeft') prevSlide();
});
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