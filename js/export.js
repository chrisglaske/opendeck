// ==========================================
// 8. EXPORT ENGINES (HTML, PDF) & PRESENTER VIEW
// ==========================================

function setPdfExportState(isBusy, message = 'Download PDF') {
    const button = document.getElementById('exportPdfBtn');
    if (!button) return;
    button.classList.toggle('od-button-busy', isBusy);
    button.innerHTML = isBusy
        ? `<i class="fa-solid fa-spinner text-red-400"></i> ${message}`
        : `<i class="fa-solid fa-file-arrow-down text-red-400"></i> Download PDF`;
}

function buildPdfSlideNode(slide) {
    const wrapper = document.createElement('div');
    wrapper.className = `preview-wrapper ${slide.bgOverride || 'bg-default'}`;
    wrapper.style.position = 'relative';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.transform = 'none';
    wrapper.style.margin = '0';
    wrapper.style.boxShadow = 'none';

    let html = generateSlideHTML(slide, true);
    html = html.replace(/contenteditable="true"/g, '').replace(/onblur="[^"]*"/g, '');
    wrapper.innerHTML = `<div class="theme-slide">${html}</div>`;
    return wrapper;
}

function hexToRgba(hex, alpha = 1) {
    if (!hex || typeof hex !== 'string') return `rgba(59,130,246,${alpha})`;
    const cleaned = hex.replace('#', '').trim();
    const normalized = cleaned.length === 3
        ? cleaned.split('').map(ch => ch + ch).join('')
        : cleaned;

    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(59,130,246,${alpha})`;

    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function sanitizePdfNodeStyles(node) {
    const accent = globalSettings?.theme || '#3B82F6';
    const accentSoft = hexToRgba(accent, 0.12);
    const accentBorder = hexToRgba(accent, 0.35);

    node.querySelectorAll('[style]').forEach((element) => {
        const styleAttr = element.getAttribute('style');
        if (!styleAttr || !styleAttr.includes('color-mix(')) return;

        const sanitized = styleAttr.replace(/color-mix\([^)]*\)/gi, (match) => {
            if (match.includes('10%') || match.includes('15%') || match.includes('20%')) return accentSoft;
            return accentBorder;
        });

        element.setAttribute('style', sanitized);
    });

    node.querySelectorAll('.theme-card').forEach((element) => {
        element.style.borderColor = accentBorder;
    });
}

async function waitForPdfSlideReady(node) {
    if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (e) { }
    }

    const images = Array.from(node.querySelectorAll('img'));
    await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
        });
    }));

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function exportToPDF() {
    const stripEditableAttrs = (html) =>
        html
            .replace(/contenteditable="true"/g, '')
            .replace(/onblur="[^"]*"/g, '');

    const buildPrintableSlidesMarkup = () => {
        const measurementHost = document.createElement('div');
        measurementHost.style.position = 'fixed';
        measurementHost.style.left = '-20000px';
        measurementHost.style.top = '0';
        measurementHost.style.width = '1400px';
        measurementHost.style.padding = '24px';
        measurementHost.style.background = '#020617';
        measurementHost.style.zIndex = '-1';
        document.body.appendChild(measurementHost);

        const sections = [];
        slides.forEach((slide, index) => {
            const section = document.createElement('section');
            section.className = `pdf-slide ${slide.bgOverride || 'bg-default'}`;
            section.id = `pdf-slide-${index}`;
            section.innerHTML = `<div class="theme-slide">${stripEditableAttrs(generateSlideHTML(slide, true))}</div>`;
            measurementHost.appendChild(section);

            if (typeof window.fitSlideContent === 'function') {
                try { window.fitSlideContent(section); } catch (e) { }
            }

            sections.push(section.outerHTML);
        });

        document.body.removeChild(measurementHost);
        return sections.join('\n');
    };

    const createPrintFrameDocument = (slidesMarkup) => {
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.position = 'fixed';
        frame.style.right = '0';
        frame.style.bottom = '0';
        frame.style.width = '1px';
        frame.style.height = '1px';
        frame.style.opacity = '0';
        frame.style.pointerEvents = 'none';
        frame.style.border = '0';
        document.body.appendChild(frame);

        const frameDoc = frame.contentDocument;
        frameDoc.open();
        frameDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>OpenDeck PDF</title></head><body></body></html>`);
        frameDoc.close();

        document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
            frameDoc.head.appendChild(node.cloneNode(true));
        });

        const printStyle = frameDoc.createElement('style');
        printStyle.textContent = `
            html, body { margin: 0; padding: 0; background: #000; }
            body { overflow: visible !important; }
            .pdf-slide {
                width: 16in;
                height: 9in;
                margin: 0;
                padding: 0;
                page-break-after: always;
                break-after: page;
                position: relative;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .pdf-slide:last-child { page-break-after: auto; break-after: auto; }
            .pdf-slide .theme-slide {
                width: 16in;
                height: 9in;
                padding: 4rem;
                box-sizing: border-box;
            }
            @page { size: 16in 9in; margin: 0; }
            @media print {
                html, body { width: 16in; margin: 0 !important; padding: 0 !important; }
            }
        `;
        frameDoc.head.appendChild(printStyle);

        frameDoc.body.innerHTML = slidesMarkup;
        return frame;
    };

    const waitForFrameReady = async (frame) => {
        const frameDoc = frame.contentDocument;

        const links = Array.from(frameDoc.querySelectorAll('link[rel="stylesheet"]'));
        await Promise.all(links.map((link) => {
            const sheet = link.sheet;
            if (sheet) return Promise.resolve();
            return new Promise((resolve) => {
                link.addEventListener('load', resolve, { once: true });
                link.addEventListener('error', resolve, { once: true });
                setTimeout(resolve, 3000);
            });
        }));

        if (frameDoc.fonts && frameDoc.fonts.ready) {
            try { await frameDoc.fonts.ready; } catch (e) { }
        }

        const images = Array.from(frameDoc.images || []);
        await Promise.all(images.map((image) => {
            if (image.complete) return Promise.resolve();
            return new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
            });
        }));

        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await new Promise(resolve => setTimeout(resolve, 250));
    };

    let printFrame = null;
    try {
        setPdfExportState(true, 'Preparing PDF');
        saveProjects();

        const slidesMarkup = buildPrintableSlidesMarkup();
        printFrame = createPrintFrameDocument(slidesMarkup);
        await waitForFrameReady(printFrame);

        const frameWindow = printFrame.contentWindow;
        try { frameWindow.focus(); } catch (e) { }
        frameWindow.print();

        const cleanup = () => {
            if (printFrame && printFrame.parentNode) {
                printFrame.parentNode.removeChild(printFrame);
            }
            printFrame = null;
            setPdfExportState(false);
        };

        frameWindow.addEventListener('afterprint', cleanup, { once: true });
        setTimeout(cleanup, 12000);
    } catch (error) {
        console.error('PDF export failed:', error);
        if (printFrame && printFrame.parentNode) {
            printFrame.parentNode.removeChild(printFrame);
        }
        setPdfExportState(false);
        alert('PDF export failed. Please try again.');
    }
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
    let slidePayload = JSON.stringify(slides.map((slide) => {
        let html = generateSlideHTML(slide, true);
        html = html.replace(/contenteditable="true"/g, '').replace(/onblur="[^"]*"/g, '');
        return {
            name: slide.navName || 'Untitled',
            notes: slide.notes || '',
            bgClass: slide.bgOverride || 'bg-default',
            html
        };
    })).replace(/<\/script/gi, '<\\/script');
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
* { box-sizing: border-box; }
body { font-family: var(--global-font); background-color: var(--bg-dark); color: white; overflow: hidden; margin: 0; }

.top-nav { position: fixed; top: 0; left: 0; right: 0; height: 4rem; background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(59, 130, 246, 0.2); border-bottom: 1px solid color-mix(in srgb, var(--accent-color) 20%, transparent); display: flex; align-items: center; justify-content: space-between; padding: 0 2rem; z-index: 1000; }
.nav-links-container { display: flex; gap: 0.25rem; overflow-x: auto; -ms-overflow-style: none; scrollbar-width: none; }
.nav-links-container::-webkit-scrollbar { display: none; }
.nav-item { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; padding: 0.5rem 0.75rem; cursor: pointer; transition: all 0.3s; border-bottom: 2px solid transparent; white-space: nowrap; }
.nav-item.active { color: var(--accent-color); border-bottom: 2px solid var(--accent-color); }

.slide-container { display: flex; transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1); height: 100vh; width: ${totalSlides}00vw; }
.slide { width: 100vw; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4rem; position: relative; }
.theme-slide { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 4rem; position: relative; font-family: var(--global-font); overflow: hidden; }

.bg-default { background: radial-gradient(circle at 50% 50%, #111827 0%, #000000 100%); }
.bg-deepblue { background: radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%); }
.bg-midnight { background: radial-gradient(circle at 50% 50%, #2e1065 0%, #000000 100%); }
.bg-aurora { background: radial-gradient(circle at 15% 20%, rgba(59,130,246,0.24) 0%, transparent 30%), radial-gradient(circle at 85% 78%, rgba(249,115,22,0.18) 0%, transparent 32%), radial-gradient(circle at 50% 8%, rgba(168,85,247,0.18) 0%, transparent 28%), linear-gradient(145deg, #030712 0%, #050816 45%, #020617 100%); }
.bg-sunset { background: radial-gradient(circle at 18% 18%, rgba(251,146,60,0.26) 0%, transparent 28%), radial-gradient(circle at 82% 22%, rgba(236,72,153,0.2) 0%, transparent 30%), radial-gradient(circle at 50% 84%, rgba(59,130,246,0.18) 0%, transparent 30%), linear-gradient(145deg, #12070c 0%, #1f0c15 48%, #09090b 100%); }
.bg-pitchblack { background: #000000; }
.bg-purewhite { background: #ffffff; color: #000000 !important; }

.theme-card { background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(10px); border: 1px solid rgba(59, 130, 246, 0.15); border: 1px solid color-mix(in srgb, var(--accent-color) 15%, transparent); border-radius: 1.5rem; padding: 4rem; max-width: 1200px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8); }
.bg-purewhite .theme-card { background: rgba(255, 255, 255, 0.95); border-color: rgba(0,0,0,0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1); }
.accent-text { color: var(--accent-color); }

.od-deck-shell { width: 100%; max-width: 1200px; position: relative; overflow: visible; padding: 3.25rem; border-radius: 1.75rem; background: rgba(8, 12, 21, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 30px 80px -34px rgba(0, 0, 0, 1), inset 0 1px 0 rgba(255, 255, 255, 0.05); backdrop-filter: blur(22px); }
.bg-purewhite .od-deck-shell { background: rgba(255, 255, 255, 0.95); border-color: rgba(15, 23, 42, 0.12); box-shadow: 0 30px 80px -34px rgba(15, 23, 42, 0.18); }
.od-deck-shell::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 42%, rgba(255, 255, 255, 0.02)); pointer-events: none; }
.od-title-mark { width: 5rem; height: 0.35rem; border-radius: 999px; margin-bottom: 1.4rem; background: var(--accent-color); box-shadow: 0 0 20px -4px var(--accent-color); }
.od-lead { font-size: 1.32rem; line-height: 1.7; color: #94a3b8; }
.bg-purewhite .od-lead { color: #475569; }
.od-panel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; width: 100%; }
.od-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1.4rem; width: 100%; }
.od-card-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.od-card { position: relative; padding: 1.5rem; border-radius: 1.3rem; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05); overflow: hidden; }
.bg-purewhite .od-card { background: rgba(248, 250, 252, 0.96); border-color: rgba(15, 23, 42, 0.1); }
.od-card::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 3px; border-top-left-radius: inherit; border-top-right-radius: inherit; background: var(--card-accent, var(--accent-color)); }
.od-card__icon { width: 3.4rem; height: 3.4rem; border-radius: 1rem; display: inline-flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.05); margin-bottom: 1rem; }
.od-grid-quad { align-items: stretch; }
.od-card--compact { padding: 1.05rem; }
.od-card--compact .od-card__icon { width: 2.8rem; height: 2.8rem; margin-bottom: 0.6rem; }
.od-card--compact h4 { margin-bottom: 0.45rem !important; font-size: 1.02rem !important; line-height: 1.25 !important; }
.od-card--compact p { font-size: 0.82rem !important; line-height: 1.45 !important; }
.od-checklist-shell { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 1.5rem; align-items: stretch; }
.od-check-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.1rem; border-radius: 1rem; background: rgba(15, 23, 42, 0.62); border: 1px solid rgba(255, 255, 255, 0.08); }
.bg-purewhite .od-check-row { background: rgba(248, 250, 252, 0.96); border-color: rgba(15, 23, 42, 0.1); }
.od-code-shell { width: 100%; border-radius: 1.25rem; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.08); background: #09101d; box-shadow: 0 24px 60px -28px rgba(0, 0, 0, 0.95); }
.od-code-shell__head { display: flex; align-items: center; gap: 0.85rem; padding: 0.9rem 1rem; background: #050b16; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.od-metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 1.25rem; width: 100%; }
.od-metric-grid--single { grid-template-columns: minmax(0, 1fr); max-width: 440px; margin: 0 auto; }
.od-metric-grid--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.od-metric-grid--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.od-metric-card { padding: 1.7rem 1rem; border-radius: 1.4rem; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); }
.bg-purewhite .od-metric-card { background: rgba(248, 250, 252, 0.96); border-color: rgba(15, 23, 42, 0.1); }
.od-profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1.5rem; width: 100%; }
.od-profile-card { position: relative; padding: 1.6rem; border-radius: 1.4rem; text-align: center; background: radial-gradient(circle at top, rgba(59, 130, 246, 0.12), transparent 34%), rgba(15, 23, 42, 0.58); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05); }
.bg-purewhite .od-profile-card { background: rgba(248, 250, 252, 0.96); border-color: rgba(15, 23, 42, 0.1); }
.od-profile-avatar-wrap { position: relative; margin-bottom: 1.5rem; }
.od-profile-avatar-wrap::before { content: ''; position: absolute; inset: 14% 12%; border-radius: 999px; background: radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%); filter: blur(14px); pointer-events: none; }
.od-profile-avatar { position: relative; width: 10rem; height: 10rem; border-radius: 999px; display: flex; align-items: center; justify-content: center; margin: 0 auto; border: 4px solid var(--accent-color); background: linear-gradient(180deg, rgba(30, 41, 59, 0.96) 0%, rgba(15, 23, 42, 0.92) 100%); box-shadow: 0 18px 42px -24px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.04); object-fit: cover; }
.od-profile-avatar--image { background: #0f172a; }
.od-profile-accent { width: 3.4rem; height: 0.24rem; border-radius: 999px; margin: 1rem auto 0; background: linear-gradient(90deg, transparent 0%, var(--accent-color) 20%, var(--accent-color) 80%, transparent 100%); opacity: 0.9; }
.od-pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1.2rem; width: 100%; align-items: stretch; }
.od-pricing-card { padding: 1.8rem; border-radius: 1.5rem; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); text-align: center; }
.od-pricing-card--featured { transform: translateY(-10px); border-width: 2px; box-shadow: 0 24px 60px -26px rgba(0, 0, 0, 0.9); }
.bg-purewhite .od-pricing-card { background: rgba(248, 250, 252, 0.96); border-color: rgba(15, 23, 42, 0.1); }
.od-timeline-track { position: relative; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 1rem; width: 100%; padding-top: 1rem; }
.od-timeline-track::before { content: ''; position: absolute; top: 1.8rem; left: 8%; right: 8%; height: 2px; background: rgba(148, 163, 184, 0.24); }
.od-timeline-item { position: relative; text-align: center; padding: 0 0.8rem; }
.od-hero-cover { position: absolute; inset: 0; overflow: hidden; }
.od-hero-cover::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(2, 6, 23, 0.18) 0%, rgba(2, 6, 23, 0.82) 100%); }

.od-shell { width: 100%; max-width: 1200px; position: relative; overflow: visible; padding: 3.5rem; border-radius: 1.75rem; border: 1px solid rgba(255,255,255,0.08); background: rgba(9,12,20,0.68); backdrop-filter: blur(24px); box-shadow: 0 30px 70px -30px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.06); }
.bg-purewhite .od-shell { background: rgba(255,255,255,0.94); border-color: rgba(15,23,42,0.12); box-shadow: 0 30px 70px -30px rgba(15,23,42,0.18); }
.od-shell::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent 45%, rgba(255,255,255,0.03)); pointer-events: none; }
.od-kicker { display: inline-flex; align-items: center; gap: 0.6rem; align-self: flex-start; padding: 0.45rem 0.95rem; border-radius: 999px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #cbd5e1; background: rgba(15,23,42,0.7); border: 1px solid rgba(255,255,255,0.08); }
.bg-purewhite .od-kicker { background: rgba(241,245,249,0.9); color: #475569; border-color: rgba(15,23,42,0.1); }
.od-orb { position: absolute; border-radius: 999px; filter: blur(90px); opacity: 0.9; pointer-events: none; }
.od-orb--blue { width: 20rem; height: 20rem; top: -6rem; left: -5rem; background: rgba(59,130,246,0.22); }
.od-orb--orange { width: 18rem; height: 18rem; right: -4rem; bottom: -5rem; background: rgba(249,115,22,0.16); }
.od-badge-row { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 2.25rem; }
.od-badge { display: inline-flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1.15rem; border-radius: 999px; font-size: 0.9rem; font-weight: 700; color: #e2e8f0; background: rgba(15,23,42,0.72); border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); }
.bg-purewhite .od-badge { color: #0f172a; background: rgba(248,250,252,0.95); border-color: rgba(15,23,42,0.1); }
.od-compare-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; margin-top: 2rem; }
.od-compare-panel { position: relative; padding: 1.8rem; border-radius: 1.4rem; background: rgba(2,6,23,0.55); border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05); }
.bg-purewhite .od-compare-panel { background: rgba(248,250,252,0.94); border-color: rgba(15,23,42,0.1); }
.od-compare-icon { width: 3.5rem; height: 3.5rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 1rem; margin-bottom: 1.1rem; background: rgba(255,255,255,0.04); }
.od-point-list { display: flex; flex-direction: column; gap: 0.85rem; margin-top: 1.25rem; }
.od-point-item { display: flex; align-items: flex-start; gap: 0.8rem; color: #cbd5e1; }
.bg-purewhite .od-point-item { color: #334155; }
.od-showcase-grid { display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr); gap: 1.75rem; align-items: stretch; }
.od-window { display: flex; flex-direction: column; min-height: 30rem; border-radius: 1.2rem; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); background: #0b1120; box-shadow: 0 24px 60px -26px rgba(0,0,0,0.95); }
.bg-purewhite .od-window { border-color: rgba(15,23,42,0.12); background: #f8fafc; }
.od-window__header { display: flex; align-items: center; gap: 0.8rem; padding: 0.9rem 1rem; background: rgba(15,23,42,0.96); border-bottom: 1px solid rgba(255,255,255,0.06); }
.bg-purewhite .od-window__header { background: #e2e8f0; border-bottom-color: rgba(15,23,42,0.08); }
.od-window__dots { display: flex; gap: 0.4rem; }
.od-window__dot { width: 0.72rem; height: 0.72rem; border-radius: 999px; }
.od-window__body { flex: 1; padding: 1.4rem; overflow: auto; }
.od-window__body pre { margin: 0; }
.od-roadmap-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1.25rem; margin-top: 2rem; }
.od-roadmap-card { position: relative; padding: 1.6rem; border-radius: 1.4rem; border: 1px solid rgba(255,255,255,0.08); background: rgba(15,23,42,0.58); overflow: hidden; min-height: 16rem; }
.bg-purewhite .od-roadmap-card { background: rgba(248,250,252,0.96); border-color: rgba(15,23,42,0.1); }
.od-roadmap-card::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 4px; background: var(--phase-color, var(--accent-color)); }
.od-status-pill { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.35rem 0.7rem; border-radius: 999px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
.bg-purewhite .od-status-pill { background: rgba(241,245,249,0.94); border-color: rgba(15,23,42,0.1); }
.bg-purewhite .theme-card { background: rgba(255, 255, 255, 0.95); border-color: rgba(0, 0, 0, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1); }
.bg-purewhite .text-white { color: #000000 !important; }
.bg-purewhite .text-slate-400 { color: #475569 !important; }
.bg-purewhite .text-slate-300 { color: #334155 !important; }
.bg-purewhite .bg-slate-900 { background-color: #f1f5f9 !important; border-color: #e2e8f0 !important; }
.bg-purewhite .bg-slate-800 { background-color: #f8fafc !important; border-color: #e2e8f0 !important; }

.od-shell-density-compact, .od-shell-density-tight, .od-shell-density-ultra { justify-content: flex-start !important; }
.od-shell-density-compact { padding-top: 2.25rem; padding-bottom: 2.25rem; }
.od-shell-density-tight { padding-top: 1.9rem; padding-bottom: 1.9rem; }
.od-shell-density-ultra { padding-top: 1.45rem; padding-bottom: 1.45rem; }
.od-shell-density-compact .od-title-mark, .od-shell-density-tight .od-title-mark, .od-shell-density-ultra .od-title-mark { margin-bottom: 0.9rem; }
.od-shell-density-compact > h1, .od-shell-density-compact > h2, .od-shell-density-tight > h1, .od-shell-density-tight > h2, .od-shell-density-ultra > h1, .od-shell-density-ultra > h2 { margin-bottom: 0.45rem !important; }
.od-shell-density-compact > p, .od-shell-density-tight > p, .od-shell-density-ultra > p { margin-bottom: 1rem !important; }

.od-profile-grid.od-density-compact, .od-metric-grid.od-density-compact, .od-pricing-grid.od-density-compact, .od-roadmap-grid.od-density-compact, .od-timeline-track.od-density-compact { gap: 0.9rem; }
.od-profile-grid.od-density-tight, .od-metric-grid.od-density-tight, .od-pricing-grid.od-density-tight, .od-roadmap-grid.od-density-tight, .od-timeline-track.od-density-tight { gap: 0.7rem; }
.od-profile-grid.od-density-ultra, .od-metric-grid.od-density-ultra, .od-pricing-grid.od-density-ultra, .od-roadmap-grid.od-density-ultra, .od-timeline-track.od-density-ultra { gap: 0.55rem; }

.od-profile-grid.od-density-compact .od-profile-card { padding: 1.2rem; }
.od-profile-grid.od-density-tight .od-profile-card { padding: 0.95rem; }
.od-profile-grid.od-density-ultra .od-profile-card { padding: 0.75rem; }
.od-profile-grid.od-density-compact .od-profile-avatar { width: 8.2rem; height: 8.2rem; }
.od-profile-grid.od-density-tight .od-profile-avatar { width: 6.8rem; height: 6.8rem; }
.od-profile-grid.od-density-ultra .od-profile-avatar { width: 5.6rem; height: 5.6rem; }
.od-profile-grid.od-density-tight h4, .od-profile-grid.od-density-ultra h4 { font-size: 1.5rem !important; }
.od-profile-grid.od-density-tight p, .od-profile-grid.od-density-ultra p { letter-spacing: 0.2em !important; }

.od-metric-grid.od-density-compact .od-metric-card, .od-pricing-grid.od-density-compact .od-pricing-card, .od-roadmap-grid.od-density-compact .od-roadmap-card { padding: 1.2rem; }
.od-metric-grid.od-density-tight .od-metric-card, .od-pricing-grid.od-density-tight .od-pricing-card, .od-roadmap-grid.od-density-tight .od-roadmap-card { padding: 1rem; }
.od-metric-grid.od-density-ultra .od-metric-card, .od-pricing-grid.od-density-ultra .od-pricing-card, .od-roadmap-grid.od-density-ultra .od-roadmap-card { padding: 0.85rem; }
.od-pricing-grid.od-density-tight .od-pricing-card--featured, .od-pricing-grid.od-density-ultra .od-pricing-card--featured { transform: translateY(0); }

.nav-btn { position: fixed; bottom: 2rem; background: rgba(30, 30, 30, 0.8); border: 1px solid rgba(59, 130, 246, 0.3); border: 1px solid color-mix(in srgb, var(--accent-color) 30%, transparent); color: white; width: 3.5rem; height: 3.5rem; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; z-index: 100; transition: all 0.2s; }
.nav-btn:hover { background: var(--accent-color); color: white; transform: scale(1.1); }
.prev-btn { left: 2rem; } .next-btn { right: 2rem; }
.slide-indicator { position: fixed; bottom: 2.5rem; left: 50%; transform: translateX(-50%); display: flex; gap: 0.5rem; }
.dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: #333; transition: all 0.3s; }
.dot.active { background: var(--accent-color); width: 1.5rem; border-radius: 1rem; }

.fade-in { animation: fadeIn 0.8s ease-out forwards; }
.slide-up { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.zoom-in { animation: zoomIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.reveal-right { animation: revealRight 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(60px); } to { opacity: 1; transform: translateY(0); } }
@keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes revealRight { from { opacity: 0; transform: translateX(48px); } to { opacity: 1; transform: translateX(0); } }

@media (max-width: 1024px) {
    .od-compare-grid, .od-showcase-grid, .od-roadmap-grid, .od-panel-grid, .od-card-grid, .od-metric-grid, .od-profile-grid, .od-pricing-grid, .od-timeline-track, .od-checklist-shell { grid-template-columns: 1fr; }
    .od-timeline-track::before { display: none; }
}

.slide-autofit { width: 100%; height: 100%; position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center; transform-origin: center center; }

/* AMAZING PRO PRESENTER VIEW UI */
#presenterView { display: none; background: #020617; color: white; height: 100vh; box-sizing: border-box; overflow: hidden; font-family: var(--global-font); position: relative; }
#presenterStage { position: absolute; inset: 0 auto auto 0; width: 1440px; height: 860px; padding: 1rem; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.65rem; transform-origin: top left; }
.p-header { display: grid; grid-template-columns: minmax(230px, 0.85fr) minmax(0, 1.4fr) minmax(320px, 0.9fr); align-items: start; gap: 0.8rem; flex-shrink: 0; }
.p-title-area h2 { margin: 0; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.025em; display: flex; align-items: center; gap: 0.75rem; }
.p-badge { background: var(--accent-color); color: white; font-size: 0.65rem; padding: 0.2rem 0.5rem; border-radius: 0.5rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; }
.p-time { font-family: 'Space Mono', monospace; font-size: 3rem; font-weight: 700; color: white; text-shadow: 0 0 20px rgba(255,255,255,0.2); tabular-nums: true; letter-spacing: -0.05em; }

.p-top-jump { min-height: 0; }
.p-top-jump .p-box-header { padding: 0.55rem 0.9rem; }
.p-jump-list { padding: 0.55rem 0.55rem 0.65rem; overflow-x: auto; overflow-y: hidden; display: flex; gap: 0.45rem; }
.p-jump-list { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--accent-color) 55%, #334155) rgba(15, 23, 42, 0.8); }
.p-jump-list::-webkit-scrollbar { height: 9px; }
.p-jump-list::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.72); border-radius: 999px; }
.p-jump-list::-webkit-scrollbar-thumb { background: linear-gradient(90deg, color-mix(in srgb, var(--accent-color) 65%, #1e293b), #475569); border-radius: 999px; border: 1px solid rgba(15,23,42,0.85); }
.p-jump-list::-webkit-scrollbar-thumb:hover { background: linear-gradient(90deg, color-mix(in srgb, var(--accent-color) 82%, #1e293b), #64748b); }
.p-jump-item { width: 180px; min-width: 180px; text-align: left; display: grid; grid-template-columns: 1.7rem minmax(0, 1fr); gap: 0.55rem; align-items: center; padding: 0.55rem 0.65rem; border-radius: 0.75rem; border: 1px solid rgba(148,163,184,0.16); background: rgba(15,23,42,0.45); color: #cbd5e1; cursor: pointer; transition: all 0.2s; }
.p-jump-item:hover { border-color: rgba(59,130,246,0.4); background: rgba(15,23,42,0.7); }
.p-jump-item.is-active { border-color: var(--accent-color); background: color-mix(in srgb, var(--accent-color) 18%, rgba(15,23,42,0.82)); color: #fff; box-shadow: 0 14px 34px -18px var(--accent-color); position: relative; }
.p-jump-item.is-active::after { content: 'Current'; position: absolute; top: -0.42rem; right: 0.45rem; padding: 0.08rem 0.4rem; border-radius: 999px; font-size: 0.52rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; background: var(--accent-color); color: #fff; }
.p-jump-item__index { font-family: 'Space Mono', monospace; font-size: 0.68rem; opacity: 0.8; }
.p-jump-item__meta { min-width: 0; }
.p-jump-item__title { font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.p-jump-item__notes { display: block; font-size: 0.62rem; color: #94a3b8; margin-top: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.p-body { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(330px, 1fr); gap: 0.85rem; flex-grow: 1; min-height: 0; }

.p-main-col { display: flex; flex-direction: column; gap: 0.8rem; min-height: 0; overflow: hidden; }
.p-side-col { display: grid; grid-template-rows: minmax(160px, 0.4fr) minmax(260px, 0.6fr); gap: 0.8rem; min-height: 0; overflow: hidden; }
#p-next-box { min-height: 160px; height: auto !important; opacity: 0.85; }
#p-notes-box { min-height: 260px; }

.p-box { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 1.2rem; display: flex; flex-direction: column; overflow: hidden; backdrop-filter: blur(10px); }
.p-box-header { padding: 1rem 1.5rem; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.1em; border-bottom: 1px solid rgba(255,255,255,0.05); display:flex; justify-content: space-between; }

.p-preview-container { flex-grow: 1; position: relative; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.p-scale-wrapper { width: 1200px; height: 800px; position: absolute; transform-origin: center center; background: #000; border-radius: 1rem; overflow: hidden; }
.p-end-state { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column; background: radial-gradient(circle at 50% 24%, rgba(59,130,246,0.2) 0%, rgba(2,6,23,0.92) 48%, #000 100%); border: 1px dashed rgba(148,163,184,0.45); color: #e2e8f0; gap: 0.55rem; }
.p-end-state__title { font-size: 2rem; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color: #f8fafc; }
.p-end-state__meta { font-size: 0.82rem; letter-spacing: 0.12em; text-transform: uppercase; color: #94a3b8; }

.p-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.p-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 1.5rem; border-radius: 1rem; font-size: 1.2rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
.p-btn:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); }
.p-btn-next { background: var(--accent-color); border-color: var(--accent-color); box-shadow: 0 10px 30px -10px var(--accent-color); }
.p-btn-next:hover { background: color-mix(in srgb, var(--accent-color) 80%, white); box-shadow: 0 15px 40px -10px var(--accent-color); }

.p-notes-content { padding: 1rem 1.1rem; flex-grow: 1; overflow-y: auto; font-size: clamp(1rem, 1vw, 1.18rem); line-height: 1.45; color: #e2e8f0; font-weight: 400; }
.p-notes-controls { display: flex; align-items: center; gap: 0.5rem; }
.p-chip-btn { border: 1px solid rgba(148,163,184,0.35); background: rgba(15,23,42,0.8); color: #cbd5e1; padding: 0.3rem 0.65rem; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.68rem; letter-spacing: 0.06em; text-transform: uppercase; transition: all 0.2s; }
.p-chip-btn:hover { border-color: var(--accent-color); color: white; }
.p-shortcuts-box { margin-top: 0.2rem; flex-shrink: 0; }
.p-shortcuts-grid { display: flex; align-items: center; gap: 0.4rem; padding: 0.75rem 1rem; flex-wrap: wrap; }
.p-shortcut { display: flex; align-items: center; justify-content: center; gap: 0.45rem; padding: 0.42rem 0.62rem; border-radius: 999px; border: 1px solid rgba(148,163,184,0.22); background: rgba(15,23,42,0.55); color: #cbd5e1; font-size: 0.66rem; font-weight: 700; letter-spacing: 0.04em; white-space: nowrap; }
.p-shortcut kbd { font-family: 'Space Mono', monospace; font-size: 0.66rem; padding: 0.1rem 0.35rem; border-radius: 0.35rem; background: rgba(2,6,23,0.85); border: 1px solid rgba(148,163,184,0.28); color: #f8fafc; }

.p-timer-grid { display: grid; grid-template-columns: auto auto; align-items: center; gap: 0.5rem 0.75rem; margin-top: 0.9rem; }
.p-timer-meta { display: flex; align-items: center; justify-content: flex-end; gap: 0.6rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; }
.p-target-select { border: 1px solid rgba(148,163,184,0.28); background: rgba(15,23,42,0.86); color: #e2e8f0; padding: 0.45rem 0.65rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
.p-custom-target-wrap { display: none; align-items: center; gap: 0.4rem; margin-top: 0.4rem; }
.p-custom-target-wrap.visible { display: flex; }
.p-custom-target-input { width: 5.5rem; border: 1px solid rgba(148,163,184,0.28); background: rgba(15,23,42,0.86); color: #e2e8f0; padding: 0.35rem 0.6rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; text-align: center; outline: none; }
.p-custom-target-input:focus { border-color: var(--accent-color); }
.p-custom-target-btn { border: 1px solid rgba(148,163,184,0.28); background: rgba(15,23,42,0.86); color: #e2e8f0; padding: 0.35rem 0.75rem; border-radius: 999px; font-size: 0.68rem; font-weight: 700; cursor: pointer; }
.p-custom-target-btn:hover { background: color-mix(in srgb, var(--accent-color) 20%, transparent); border-color: var(--accent-color); color: white; }
.p-status-pill { padding: 0.28rem 0.55rem; border-radius: 999px; background: rgba(30,41,59,0.7); border: 1px solid rgba(148,163,184,0.2); color: #cbd5e1; }
.p-status-pill.is-warning { color: #f59e0b; border-color: rgba(245,158,11,0.45); }
.p-status-pill.is-danger { color: #fb7185; border-color: rgba(251,113,133,0.45); }
.p-remaining-time { font-family: 'Space Mono', monospace; color: #cbd5e1; }

#speakerShortcutBtn { border: 1px solid rgba(59, 130, 246, 0.3); border: 1px solid color-mix(in srgb, var(--accent-color) 30%, transparent); background: transparent; color: #94a3b8; border-radius: 999px; padding: 0.3rem 0.7rem; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; opacity: 0.5; transition: all 0.2s; flex-shrink: 0; }
#speakerShortcutBtn:hover { opacity: 1; color: white; background: color-mix(in srgb, var(--accent-color) 15%, transparent); }
#speakerShortcutBtn .speaker-key { opacity: 0.7; }
#speakerShortcutBtn.is-compact { width: 2rem; height: 2rem; padding: 0; justify-content: center; }
#speakerShortcutBtn.is-compact .speaker-label,
#speakerShortcutBtn.is-compact .speaker-key { display: none; }
#speakerShortcutBtn.is-compact:hover,
#speakerShortcutBtn.is-compact:focus-visible { width: auto; padding: 0.3rem 0.7rem; opacity: 1; }
#speakerShortcutBtn.is-compact:hover .speaker-label,
#speakerShortcutBtn.is-compact:hover .speaker-key,
#speakerShortcutBtn.is-compact:focus-visible .speaker-label,
#speakerShortcutBtn.is-compact:focus-visible .speaker-key { display: inline; }
#speakerHintToast { position: fixed; right: 1.5rem; bottom: 1.5rem; z-index: 2200; border-radius: 0.9rem; border: 1px solid rgba(59,130,246,0.35); background: rgba(2,6,23,0.92); color: #e2e8f0; padding: 0.8rem 0.95rem; font-size: 0.8rem; max-width: 280px; box-shadow: 0 18px 45px -25px #000; opacity: 0; transform: translateY(8px); transition: all 0.25s ease; pointer-events: none; }
#speakerHintToast.show { opacity: 1; transform: translateY(0); }

#p-notes-restore { margin-top: 0.75rem; display: none; width: 100%; }
.p-side-col.notes-collapsed #p-notes-box { display: none !important; }
.p-side-col.notes-collapsed #p-notes-restore { display: inline-flex; align-items: center; justify-content: center; }

body.p-focus-mode .p-header,
body.p-focus-mode .p-shortcuts-box,
body.p-focus-mode .p-top-jump,
body.p-focus-mode #p-notes-box,
body.p-focus-mode #p-next-box { display: none !important; }
body.p-focus-mode .p-body { display: block; height: auto; }
body.p-focus-mode .p-main-col { height: 100%; }
body.p-focus-mode .p-main-col .p-box { height: 100%; }

@media (max-width: 980px) { #speakerShortcutBtn .speaker-label, #speakerShortcutBtn .speaker-key { display: none; } #speakerShortcutBtn { width: 2rem; height: 2rem; padding: 0; justify-content: center; } }

.timer-wrap { display: flex; flex-direction: column; align-items: flex-end; margin-top: 0.1rem; }
.timer-label { font-size: 0.65rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.1em; font-weight: 700; margin-bottom: -0.5rem; z-index: 10; }
.timer-controls { display: flex; align-items: center; gap: 0.5rem; margin-top: 0; }
.timer-btn { border: 1px solid rgba(59,130,246,0.35); background: rgba(15,23,42,0.86); color: #e2e8f0; padding: 0.5rem 0.9rem; border-radius: 999px; cursor: pointer; font-weight: 700; font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; transition: all 0.2s; }
.timer-btn:hover { border-color: var(--accent-color); color: white; }

${pdfPrintStyles}
</style>
</head>
<body class="exporting">

<div id="standardView">
    <nav class="top-nav" id="topNav">
        <div class="flex items-center gap-3 mr-8 flex-shrink-0">
            <div class="bg-blue-600 rounded px-2 py-0.5 font-bold text-white text-sm" style="background-color: var(--accent-color)">${escapeHtml(globalSettings.headerIcon)}</div>
            <span class="font-bold tracking-tight whitespace-nowrap">${escapeHtml(globalSettings.headerText)}</span>
            <button id="speakerShortcutBtn" onclick="openSpeakerView()" aria-label="Open speaker view">
                <i class="fa-solid fa-desktop"></i>
                <span class="speaker-label">Speaker View</span>
                <span class="speaker-key">(S)</span>
            </button>
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

    <div id="speakerHintToast">
        Press <strong style="font-family:'Space Mono',monospace;">S</strong> anytime to open Speaker View.
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
    <div id="presenterStage">
    <div class="p-header">
        <div class="p-title-area">
            <h2>${escapeHtml(globalSettings.headerText)} <span class="p-badge">Speaker View</span></h2>
            <div class="text-slate-400 text-sm mt-1 font-mono uppercase tracking-widest" id="p-slide-status">Slide 1 of ${totalSlides}</div>
        </div>
        <div class="p-box p-top-jump">
            <div class="p-box-header">All Slides <span id="p-slide-count">${totalSlides}</span></div>
            <div class="p-jump-list" id="p-jump-list"></div>
        </div>
        <div class="timer-wrap">
            <span class="timer-label">Elapsed Time</span>
            <div id="timerDisplay" class="p-time" style="color: var(--accent-color);">00:00:00</div>
            <div class="p-timer-grid">
                <div class="timer-controls">
                    <button id="timerToggleBtn" class="timer-btn" onclick="toggleTimer()"><i class="fa-solid fa-play"></i> Start</button>
                    <button id="timerResetBtn" class="timer-btn" onclick="resetTimer()"><i class="fa-solid fa-rotate-left"></i> Reset</button>
                </div>
                <div>
                    <select id="timerTargetSelect" class="p-target-select" onchange="setTimerTarget(this.value)">
                        <option value="0">No Target</option>
                        <option value="900000">15 min</option>
                        <option value="1800000" selected>30 min</option>
                        <option value="2700000">45 min</option>
                        <option value="3600000">60 min</option>
                        <option value="custom">Custom…</option>
                    </select>
                    <div class="p-custom-target-wrap" id="customTargetWrap">
                        <input id="timerCustomInput" class="p-custom-target-input" type="text" placeholder="mm:ss" maxlength="5"
                            onkeydown="if(event.key==='Enter')applyCustomTarget()"
                            oninput="this.value=this.value.replace(/[^0-9:]/g,'')">
                        <button class="p-custom-target-btn" onclick="applyCustomTarget()">Set</button>
                    </div>
                </div>
                <div class="p-timer-meta" style="grid-column: 1 / -1;">
                    <span id="timerStatusPill" class="p-status-pill">Ready</span>
                    <span id="timerRemaining" class="p-remaining-time">Remaining 30:00</span>
                </div>
            </div>
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
        <div class="p-side-col" id="p-side-col">
            <div id="p-next-box" class="p-box" style="height: 35vh; opacity: 0.8;">
                <div class="p-box-header"><span>Next Slide</span> <span id="p-next-indicator" class="text-slate-500">2</span></div>
                <div class="p-preview-container" id="p-next-wrapper">
                     <div class="p-scale-wrapper" id="p-next-container"></div>
                </div>
            </div>
            <div id="p-notes-box" class="p-box" style="flex-grow: 1;">
                <div class="p-box-header">
                    <span>Speaker Notes</span>
                    <div class="p-notes-controls">
                        <button class="p-chip-btn" onclick="adjustNotesSize(-1)">A-</button>
                        <button class="p-chip-btn" onclick="adjustNotesSize(1)">A+</button>
                        <button class="p-chip-btn" id="p-notes-toggle-btn" onclick="toggleNotesPanel()">Hide</button>
                    </div>
                </div>
                <div class="p-notes-content" id="p-notes-content"></div>
            </div>
            <button id="p-notes-restore" class="p-btn" onclick="toggleNotesPanel()"><i class="fa-regular fa-note-sticky"></i> Show Notes</button>
        </div>
    </div>
    <div class="p-box p-shortcuts-box">
        <div class="p-box-header">Shortcuts</div>
        <div class="p-shortcuts-grid">
            <div class="p-shortcut"><kbd>S</kbd> Speaker</div>
            <div class="p-shortcut"><kbd>F</kbd> Focus</div>
            <div class="p-shortcut"><kbd>H</kbd> Notes</div>
            <div class="p-shortcut"><kbd>N</kbd> Next</div>
            <div class="p-shortcut"><kbd>P</kbd> Prev</div>
            <div class="p-shortcut"><kbd>T</kbd> Timer</div>
            <div class="p-shortcut"><kbd>R</kbd> Reset</div>
        </div>
    </div>
    </div>
</div>

<script>
const container = document.getElementById('container');
const dotsContainer = document.getElementById('indicator');
const navItems = document.querySelectorAll('.nav-item');
const presenterRoot = document.getElementById('presenterView');
const presenterStage = document.getElementById('presenterStage');
const numSlides = ${totalSlides};
const slidePayload = ${slidePayload};
const notesData = ${notesData};
const syncKey = '${uniqueSyncKey}';
let currentSlide = 0;
let presenterWindow = null;
let speakerWindowPoll = null;
const instanceId = Math.random().toString(36).slice(2);
let timerState = { elapsedMs: 0, running: false, updatedAt: Date.now() };
let hasTimerState = false;
let timerInterval = null;
let notesFontSize = 1.5;
let speakerHintTimer = null;
let timerTargetMs = 1800000;

const syncChannel = new BroadcastChannel(syncKey);

const isPresenter = window.location.hash === '#presenter' || window.isPresenterOverride;
const isPdfPrintMode = window.location.hash === '#pdfprint';

if (isPresenter) {
    document.getElementById('standardView').style.display = 'none';
    document.getElementById('presenterView').style.display = 'flex';
    document.title = "Speaker View - " + document.title;
    timerState = { elapsedMs: 0, running: false, updatedAt: Date.now() };
    hasTimerState = true;
    ensureTimerTicker();
    scalePresenterLayout();
} else {
    if (document.body) {
        document.body.setAttribute('tabindex', '-1');
        try { document.body.focus(); } catch (e) { }
    }
    for (let i = 0; i < numSlides; i++) {
        const dot = document.createElement('div');
        dot.className = \`dot \${i === 0 ? 'active' : ''}\`;
        dotsContainer.appendChild(dot);
    }
    requestAnimationFrame(() => applyAutoFitToDeck());
    showSpeakerShortcutHint();
}

function showSpeakerShortcutHint() {
    const toast = document.getElementById('speakerHintToast');
    const shortcutButton = document.getElementById('speakerShortcutBtn');
    if (!toast) return;
    toast.classList.add('show');
    if (shortcutButton) shortcutButton.classList.remove('is-compact');
    if (speakerHintTimer) clearTimeout(speakerHintTimer);
    speakerHintTimer = setTimeout(() => {
        if (shortcutButton) shortcutButton.classList.add('is-compact');
    }, 6200);
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4200);
}

// Fit overflowing slide content down to always fill (not overflow) the canvas
function fitSlideContent(root) {
    if (!root) return;
    const target = root.querySelector('[data-slide-autofit]');
    if (!target) return;

    const measureAutoFitBounds = (node) => {
        const baseRect = node.getBoundingClientRect();
        let minLeft = baseRect.left;
        let minTop = baseRect.top;
        let maxRight = baseRect.right;
        let maxBottom = baseRect.bottom;

        node.querySelectorAll('*').forEach((child) => {
            const style = window.getComputedStyle(child);
            if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') return;

            const rect = child.getBoundingClientRect();
            if (!rect.width && !rect.height) return;

            const marginTop = parseFloat(style.marginTop) || 0;
            const marginRight = parseFloat(style.marginRight) || 0;
            const marginBottom = parseFloat(style.marginBottom) || 0;
            const marginLeft = parseFloat(style.marginLeft) || 0;

            minLeft = Math.min(minLeft, rect.left - marginLeft);
            minTop = Math.min(minTop, rect.top - marginTop);
            maxRight = Math.max(maxRight, rect.right + marginRight);
            maxBottom = Math.max(maxBottom, rect.bottom + marginBottom);
        });

        return {
            width: Math.max(1, maxRight - minLeft),
            height: Math.max(1, maxBottom - minTop)
        };
    };

    target.style.transform = 'none';
    target.style.transformOrigin = 'center center';
    const parentW = root.clientWidth  || 1200;
    const navOffset = !isPresenter ? (document.getElementById('topNav')?.offsetHeight || 0) : 0;
    const parentH = Math.max(1, (root.clientHeight || 800) - navOffset);
    const { width: contentW, height: contentH } = measureAutoFitBounds(target);
    const scale = Math.min(1, parentW / contentW, parentH / contentH);
    if (scale < 1) target.style.transform = \`scale(\${scale.toFixed(4)})\`;
}

function applyAutoFitToDeck() {
    document.querySelectorAll('#container .slide').forEach((slide) => fitSlideContent(slide));
}

function scalePresenterLayout() {
    if (!isPresenter || !presenterRoot || !presenterStage) return;
    const stageWidth = 1440;
    const stageHeight = 860;
    const viewportW = Math.max(320, window.innerWidth);
    const viewportH = Math.max(320, window.innerHeight);
    const rawScale = Math.min(viewportW / stageWidth, viewportH / stageHeight);
    const scale = Math.min(1.75, rawScale);

    presenterStage.style.transform = 'scale(' + scale + ')';
    presenterStage.style.left = ((viewportW - (stageWidth * scale)) / 2).toFixed(1) + 'px';
    presenterStage.style.top = ((viewportH - (stageHeight * scale)) / 2).toFixed(1) + 'px';
}

function clampSlideIndex(index) {
    return Math.min(Math.max(index, 0), Math.max(0, numSlides - 1));
}

function normalizeTimerState(nextState) {
    if (!nextState) return null;
    return {
        elapsedMs: Math.max(0, Number(nextState.elapsedMs) || 0),
        running: Boolean(nextState.running),
        updatedAt: Number(nextState.updatedAt) || Date.now()
    };
}

function getEffectiveElapsedMs() {
    if (!timerState.running) return timerState.elapsedMs;
    return timerState.elapsedMs + Math.max(0, Date.now() - timerState.updatedAt);
}

function formatDuration(ms, withHours = true) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (withHours || hours > 0) {
        return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
    }

    return [minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function escapeRuntimeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateTimerDisplay() {
    const display = document.getElementById('timerDisplay');
    if (!display) return;
    const diff = getEffectiveElapsedMs();
    display.innerText = formatDuration(diff, true);

    const remaining = document.getElementById('timerRemaining');
    const status = document.getElementById('timerStatusPill');
    if (!remaining || !status) return;

    if (!timerTargetMs) {
        remaining.innerText = 'No target';
        status.innerText = timerState.running ? 'Running' : 'Ready';
        status.className = 'p-status-pill';
        return;
    }

    const delta = timerTargetMs - diff;
    if (delta >= 0) {
        remaining.innerText = 'Remaining ' + formatDuration(delta, false);
        status.innerText = delta < 300000 ? 'Closing' : (timerState.running ? 'On Track' : 'Ready');
        status.className = delta < 300000 ? 'p-status-pill is-warning' : 'p-status-pill';
    } else {
        remaining.innerText = 'Over ' + formatDuration(Math.abs(delta), false);
        status.innerText = 'Over Time';
        status.className = 'p-status-pill is-danger';
    }
}

function updateTimerButton() {
    const button = document.getElementById('timerToggleBtn');
    if (!button) return;
    button.innerHTML = timerState.running
        ? '<i class="fa-solid fa-pause"></i> Pause'
        : '<i class="fa-solid fa-play"></i> Start';
}

function ensureTimerTicker() {
    if (timerInterval) clearInterval(timerInterval);
    updateTimerDisplay();
    updateTimerButton();
    if (!isPresenter) return;
    timerInterval = setInterval(updateTimerDisplay, 1000);
}

function buildSyncState() {
    return {
        currentSlide,
        timerState: hasTimerState ? timerState : null,
        timerTargetMs
    };
}

function postSyncMessage(type, payload = {}) {
    syncChannel.postMessage({ type, payload, sourceId: instanceId });
}

function postWindowState(targetWindow) {
    if (!targetWindow || targetWindow.closed) return;
    try {
        targetWindow.postMessage({ type: 'OPENDECK_STATE', payload: buildSyncState(), sourceId: instanceId }, '*');
    } catch (e) { }
}

function syncPresentationState() {
    postSyncMessage('STATE', buildSyncState());
    if (isPresenter) {
        postWindowState(window.opener);
    } else {
        postWindowState(presenterWindow);
    }
}

function applyIncomingState(nextState) {
    if (!nextState) return;
    currentSlide = clampSlideIndex(nextState.currentSlide ?? currentSlide);

    const remoteTimerState = normalizeTimerState(nextState.timerState);
    if (remoteTimerState) {
        timerState = remoteTimerState;
        hasTimerState = true;
        ensureTimerTicker();
    }

    if (typeof nextState.timerTargetMs === 'number') {
        timerTargetMs = Math.max(0, nextState.timerTargetMs);
        const targetSelect = document.getElementById('timerTargetSelect');
        if (targetSelect) {
            const existing = Array.from(targetSelect.options).find(o => o.value === String(timerTargetMs));
            if (existing) {
                targetSelect.value = String(timerTargetMs);
            } else if (timerTargetMs > 0) {
                const mins = Math.floor(timerTargetMs / 60000);
                const secs = Math.floor((timerTargetMs % 60000) / 1000);
                const label = secs > 0 ? (mins + 'm ' + String(secs).padStart(2,'0') + 's') : (mins + ' min');
                const customOpt = Array.from(targetSelect.options).find(o => o.value === 'custom' || o.classList?.contains('custom-entry'));
                if (customOpt) { customOpt.text = label; customOpt.value = String(timerTargetMs); }
                targetSelect.value = String(timerTargetMs);
            }
        }
    }

    updateSlide(true);
}

function createPresenterPreview(index) {
    const slide = slidePayload[index];
    if (!slide) return null;

    const preview = document.createElement('div');
    preview.className = 'theme-slide ' + slide.bgClass;
    preview.innerHTML = slide.html;
    return preview;
}

// Initialize the presenter view once the DOM is ready
function initializePresenterView() {
    if (!isPresenter) return;
    scalePresenterLayout();
    updateSlide(true);
    renderSlideJumpList();
    requestAnimationFrame(() => {
        scalePresenterPreviews();
        document.querySelectorAll('.p-scale-wrapper').forEach(fitSlideContent);
        setTimeout(() => { updateSlide(true); }, 180);
    });
    postSyncMessage('READY');
}

function renderSlideJumpList() {
    const list = document.getElementById('p-jump-list');
    if (!list) return;

    list.innerHTML = slidePayload.map((slide, index) => {
        const notesLabel = notesData[index]?.notes ? 'Has notes' : 'No notes';
        const isActive = index === currentSlide;
        return '<button class="p-jump-item' + (isActive ? ' is-active' : '') + '" aria-current="' + (isActive ? 'true' : 'false') + '" onclick="goToSlide(' + index + ')">'
            + '<span class="p-jump-item__index">' + String(index + 1).padStart(2, '0') + '</span>'
            + '<span class="p-jump-item__meta">'
            + '<span class="p-jump-item__title">' + escapeRuntimeHtml(slide.name || 'Untitled') + '</span>'
            + '<span class="p-jump-item__notes">' + notesLabel + '</span>'
            + '</span>'
            + '</button>';
    }).join('');

    const activeItem = list.querySelector('.p-jump-item.is-active');
    if (activeItem) {
        activeItem.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initializePresenterView, { once: true });
} else {
    // DOM is already ready (blob injection path)
    setTimeout(initializePresenterView, 0);
}

if (!isPresenter) {
    window.addEventListener('load', applyAutoFitToDeck, { once: true });
}

async function initializePdfPrintMode() {
    if (!isPdfPrintMode || isPresenter) return;

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (e) { }
    }

    const expectedSlides = numSlides;
    const start = Date.now();
    while (Date.now() - start < 12000) {
        const count = document.querySelectorAll('.slide').length;
        if (count >= expectedSlides) break;
        await wait(120);
    }

    const images = Array.from(document.images || []);
    await Promise.all(images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        });
    }));

    applyAutoFitToDeck();
    await wait(320);

    try { window.focus(); } catch (e) {}
    try { window.print(); } catch (e) {}

    window.addEventListener('afterprint', () => {
        setTimeout(() => {
            try { window.close(); } catch (e) {}
        }, 180);
    }, { once: true });
}

if (isPdfPrintMode && !isPresenter) {
    if (document.readyState === 'complete') {
        initializePdfPrintMode();
    } else {
        window.addEventListener('load', () => initializePdfPrintMode(), { once: true });
    }
}

function updateSlide(skipSync = false) {
    if (!isPresenter) {
        container.style.transform = \`translateX(-\${currentSlide * 100}vw)\`;
        const currentSection = document.querySelectorAll('.slide')[currentSlide];
        if(currentSection) {
            const card = currentSection.querySelector('.theme-card, .absolute.inset-0.z-0');
            if(card) { card.style.animation = 'none'; card.offsetHeight; card.style.animation = null; }
            fitSlideContent(currentSection);
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

        currBox.innerHTML = ''; nextBox.innerHTML = '';
        const currentPreview = createPresenterPreview(currentSlide);
        const nextPreview = currentSlide < numSlides - 1 ? createPresenterPreview(currentSlide + 1) : null;

        if (currentPreview) {
            currBox.appendChild(currentPreview);
            requestAnimationFrame(() => fitSlideContent(currentPreview));
        }
        if (nextPreview) {
            nextBox.appendChild(nextPreview);
            requestAnimationFrame(() => fitSlideContent(nextPreview));
        } else {
            nextBox.innerHTML = '<div class="p-end-state"><div class="p-end-state__title">End</div><div class="p-end-state__meta">No more slides</div></div>';
        }
        scalePresenterPreviews();
        updateTimerDisplay();
        updateTimerButton();
        renderSlideJumpList();
    }

    if (!skipSync) {
        syncPresentationState();
    }
}

function scalePresenterPreviews() {
    if(!isPresenter) return;
    const currWrap = document.getElementById('p-current-wrapper');
    const currBox = document.getElementById('p-current-container');
    const nextWrap = document.getElementById('p-next-wrapper');
    const nextBox = document.getElementById('p-next-container');
    
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
    const helpModal = document.getElementById('helpModal');
    if (helpModal) helpModal.style.display = 'none';
    
    if (presenterWindow && !presenterWindow.closed) {
        presenterWindow.focus();
        return;
    }

    const popup = window.open('', 'SpeakerView', 'width=1280,height=860');
    if (!popup) {
        window.location.hash = 'presenter';
        window.location.reload();
        return;
    }

    presenterWindow = popup;
    const speakerBtn = document.getElementById('speakerShortcutBtn');
    if (speakerBtn) speakerBtn.style.display = 'none';
    if (speakerWindowPoll) clearInterval(speakerWindowPoll);
    speakerWindowPoll = setInterval(() => {
        if (presenterWindow && presenterWindow.closed) {
            clearInterval(speakerWindowPoll);
            speakerWindowPoll = null;
            presenterWindow = null;
            if (speakerBtn) speakerBtn.style.display = '';
        }
    }, 500);

    if (window.location.protocol === 'blob:') {
        const documentMarkup = '<!DOCTYPE html>' + document.documentElement.outerHTML;
        const presenterBlob = new Blob([documentMarkup], { type: 'text/html' });
        const presenterUrl = URL.createObjectURL(presenterBlob) + '#presenter';
        presenterWindow.location.replace(presenterUrl);
        return;
    }

    presenterWindow.location.replace(window.location.href.split('#')[0] + '#presenter');
}

function adjustNotesSize(direction) {
    notesFontSize = Math.min(2.2, Math.max(1, notesFontSize + (direction * 0.1)));
    const notes = document.getElementById('p-notes-content');
    if (notes) notes.style.fontSize = notesFontSize.toFixed(2) + 'rem';
}

function setTimerTarget(value) {
    const wrap = document.getElementById('customTargetWrap');
    if (value === 'custom') {
        if (wrap) wrap.classList.add('visible');
        const input = document.getElementById('timerCustomInput');
        if (input) input.focus();
        return;
    }
    if (wrap) wrap.classList.remove('visible');
    timerTargetMs = Math.max(0, Number(value) || 0);
    updateTimerDisplay();
    syncPresentationState();
}

function applyCustomTarget() {
    const input = document.getElementById('timerCustomInput');
    if (!input) return;
    const raw = input.value.trim();
    let ms = 0;
    if (raw.includes(':')) {
        const parts = raw.split(':');
        const mins = parseInt(parts[0], 10) || 0;
        const secs = parseInt(parts[1], 10) || 0;
        ms = (mins * 60 + Math.min(secs, 59)) * 1000;
    } else {
        ms = (parseInt(raw, 10) || 0) * 60000;
    }
    if (ms <= 0) return;
    timerTargetMs = ms;
    const wrap = document.getElementById('customTargetWrap');
    if (wrap) wrap.classList.remove('visible');
    const select = document.getElementById('timerTargetSelect');
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const label = secs > 0 ? (mins + 'm ' + String(secs).padStart(2,'0') + 's') : (mins + ' min');
    const customOpt = select ? Array.from(select.options).find(o => o.value === 'custom') : null;
    if (customOpt) { customOpt.text = label; customOpt.value = String(ms); }
    if (select) select.value = String(ms);
    input.value = '';
    updateTimerDisplay();
    syncPresentationState();
}

function toggleNotesPanel() {
    const notesBox = document.getElementById('p-notes-box');
    const sideCol = document.getElementById('p-side-col');
    const toggleButton = document.getElementById('p-notes-toggle-btn');
    if (!notesBox || !sideCol) return;
    const hidden = sideCol.classList.toggle('notes-collapsed');
    if (toggleButton) toggleButton.innerText = hidden ? 'Show' : 'Hide';
}

function resetTimer() {
    timerState = { elapsedMs: 0, running: false, updatedAt: Date.now() };
    hasTimerState = true;
    ensureTimerTicker();
    syncPresentationState();
}

function toggleFocusMode() {
    if (!isPresenter) return;
    document.body.classList.toggle('p-focus-mode');
    setTimeout(() => {
        scalePresenterPreviews();
        document.querySelectorAll('.p-scale-wrapper').forEach(fitSlideContent);
    }, 40);
}

syncChannel.onmessage = (event) => {
    const message = event.data || {};
    if (message.sourceId === instanceId) return;

    if (message.type === 'READY') {
        postSyncMessage('STATE', buildSyncState());
        return;
    }

    if (message.type === 'STATE') {
        applyIncomingState(message.payload);
    }
};

window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.sourceId === instanceId) return;
    if (message.type === 'OPENDECK_STATE') {
        applyIncomingState(message.payload);
    }
});

function handleDeckKeydown(e) {
    if (e.defaultPrevented) return;

    const target = e.target;
    const isTypingTarget = target && (target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName));
    if (isTypingTarget) return;

    const key = (e.key || '').toLowerCase();
    const isModified = e.metaKey || e.ctrlKey || e.altKey;

    if (!isModified && (key === 'arrowright' || e.key === ' ')) {
        e.preventDefault();
        nextSlide();
        return;
    }

    if (!isModified && key === 'arrowleft') {
        e.preventDefault();
        prevSlide();
        return;
    }

    if (!isModified && key === 'n') {
        e.preventDefault();
        nextSlide();
        return;
    }

    if (!isModified && key === 'p') {
        e.preventDefault();
        prevSlide();
        return;
    }

    if (!isModified && key === 't') {
        e.preventDefault();
        toggleTimer();
        return;
    }

    if (!isModified && key === 'r') {
        e.preventDefault();
        resetTimer();
        return;
    }

    if (!isModified && key === 'h') {
        e.preventDefault();
        toggleNotesPanel();
        return;
    }

    if (!isModified && key === 'f') {
        e.preventDefault();
        toggleFocusMode();
        return;
    }

    const isSpeakerShortcut = !isModified && (key === 's' || e.key === 'S' || e.code === 'KeyS' || e.keyCode === 83);
    if (isSpeakerShortcut) {
        e.preventDefault();
        e.stopPropagation();
        openSpeakerView();
    }
}

document.addEventListener('keydown', handleDeckKeydown, true);

window.addEventListener('resize', () => {
    if (isPresenter) {
        scalePresenterLayout();
        scalePresenterPreviews();
        document.querySelectorAll('.p-scale-wrapper').forEach(fitSlideContent);
        return;
    }
    applyAutoFitToDeck();
});

function toggleTimer() {
    if (timerState.running) {
        timerState = {
            elapsedMs: getEffectiveElapsedMs(),
            running: false,
            updatedAt: Date.now()
        };
    } else {
        timerState = {
            elapsedMs: getEffectiveElapsedMs(),
            running: true,
            updatedAt: Date.now()
        };
    }
    hasTimerState = true;
    ensureTimerTicker();
    syncPresentationState();
}
<\/script>
</body>
</html>`;
}

function presentInBrowser() {
    const fullHTML = getCompiledHTML(false);
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    // Open the main view; the S key / Speaker View button inside will then open #presenter
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
window.getCompiledHTML = getCompiledHTML;
window.presentInBrowser = presentInBrowser;
window.exportPresentation = exportPresentation;