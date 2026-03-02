// ==========================================
// 5. BUILDER UI & EDITOR LOGIC
// ==========================================

function resizeImageForStorage(dataUrl, callback) {
    const img = new Image();
    img.onload = () => {
        const MAX_WIDTH = 1200;
        let width = img.width; let height = img.height;
        if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataUrl;
}

async function injectRandomImage(key, arrayName = null, index = null) {
    try {
        const res = await fetch('https://picsum.photos/1000/600');
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = function (e) {
            if (arrayName !== null && index !== null) updateArrayItem(arrayName, index, key, e.target.result);
            else updateSlide(key, e.target.result);
            renderEditor();
        };
        reader.readAsDataURL(blob);
    } catch (e) { alert("Could not fetch random image."); }
}

function resizePreview() {
    const pane = document.getElementById('previewArea');
    const wrapper = document.getElementById('livePreview');
    if (!pane || !wrapper) return;
    const scaleX = (pane.clientWidth - 80) / 1200;
    const scaleY = (pane.clientHeight - 120) / 800;
    const scale = Math.min(scaleX, scaleY, 1);
    wrapper.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', resizePreview);

function renderApp() {
    renderSlideList();
    renderEditor();
    renderPreview();
    resizePreview();
    document.getElementById('slideCountBadge').innerText = slides.length;
}

let draggedIndex = null;
function renderSlideList() {
    const list = document.getElementById('slideList');
    list.innerHTML = '';
    slides.forEach((slide, index) => {
        const div = document.createElement('div');
        div.className = `slide-item rounded-lg mb-1 ${slide.id === currentSlideId ? 'active shadow-lg' : ''}`;
        div.draggable = true;

        div.ondragstart = (e) => { draggedIndex = index; e.dataTransfer.effectAllowed = 'move'; };
        div.ondragover = (e) => { e.preventDefault(); div.classList.add('drag-over'); };
        div.ondragleave = (e) => { div.classList.remove('drag-over'); };
        div.ondrop = (e) => {
            e.preventDefault(); div.classList.remove('drag-over');
            if (draggedIndex === null || draggedIndex === index) return;
            const item = slides.splice(draggedIndex, 1)[0];
            slides.splice(index, 0, item);
            saveProjects();
            renderApp();
        };
        div.onclick = () => { currentSlideId = slide.id; renderApp(); };

        div.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden w-full pointer-events-none">
                <div class="w-6 h-6 rounded ${slide.id === currentSlideId ? 'text-white' : 'bg-slate-800 text-slate-400'} flex items-center justify-center text-xs font-bold shrink-0" ${slide.id === currentSlideId ? 'style="background-color: var(--accent-color)"' : ''}>${index + 1}</div>
                <div class="truncate text-sm font-semibold flex-grow">${escapeHtml(slide.navName || 'Untitled')}</div>
            </div>
            <div class="flex shrink-0">
                <button onclick="duplicateSlide('${slide.id}', event)" class="text-slate-500 hover:text-blue-400 p-2 rounded hover:bg-slate-800 transition" title="Duplicate Slide"><i class="fa-regular fa-copy"></i></button>
                <button onclick="deleteSlide('${slide.id}', event)" class="text-slate-500 hover:text-red-400 p-2 rounded hover:bg-slate-800 transition ml-1" title="Delete Slide"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(div);
    });
}

function handleImageUpload(event, key, arrayName = null, index = null) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        resizeImageForStorage(e.target.result, (resizedUrl) => {
            if (arrayName !== null && index !== null) updateArrayItem(arrayName, index, key, resizedUrl);
            else updateSlide(key, resizedUrl);
            renderEditor();
        });
    };
    reader.readAsDataURL(file);
}

function renderEditor() {
    const form = document.getElementById('editorForm');
    const slide = slides.find(s => s.id === currentSlideId);
    if (!slide) { form.innerHTML = ''; return; }

    let html = `
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6 shadow-inner relative overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1" style="background:var(--accent-color)"></div>
            <div class="form-group !mb-0 pl-2">
                <label class="text-slate-300"><i class="fa-solid fa-bars-staggered mr-1"></i> Menu Tab Name</label>
                <input type="text" value="${escapeHtml(slide.navName || '')}" oninput="updateSlide('navName', this.value)" class="!mb-0 border-none bg-slate-900 font-bold">
            </div>
        </div>
        
        <h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2"><i class="fa-solid fa-paintbrush mr-1"></i> Slide Layout</h3>
        <div class="grid grid-cols-2 gap-3 mb-6">
            <div>
                <label>Transition Effect</label>
                <select onchange="updateSlide('transition', this.value)" class="text-xs !mb-0 font-bold">
                    <option value="fade-in" ${slide.transition === 'fade-in' ? 'selected' : ''}>Fade In</option>
                    <option value="slide-up" ${slide.transition === 'slide-up' ? 'selected' : ''}>Slide Up</option>
                    <option value="zoom-in" ${slide.transition === 'zoom-in' ? 'selected' : ''}>Zoom In</option>
                </select>
            </div>
            <div>
                <label>Background</label>
                <select onchange="updateSlide('bgOverride', this.value)" class="text-xs !mb-0 font-bold">
                    <option value="bg-default" ${slide.bgOverride === 'bg-default' ? 'selected' : ''}>Default Radial</option>
                    <option value="bg-deepblue" ${slide.bgOverride === 'bg-deepblue' ? 'selected' : ''}>Deep Blue Radial</option>
                    <option value="bg-midnight" ${slide.bgOverride === 'bg-midnight' ? 'selected' : ''}>Midnight Radial</option>
                    <option value="bg-pitchblack" ${slide.bgOverride === 'bg-pitchblack' ? 'selected' : ''}>Pitch Black Solid</option>
                    <option value="bg-purewhite" ${slide.bgOverride === 'bg-purewhite' ? 'selected' : ''}>Pure White</option>
                </select>
            </div>
        </div>
    `;

    // MODERN TECH
    if (slide.type === 'intro') {
        html += renderIconInput('Main Hero Icon', slide.icon, "updateSlide('icon', this.value)");
        html += `<h3 class="text-xs font-bold text-slate-400 mt-8 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">Bottom Tags</h3>`;
        (slide.tags || []).forEach((tag, i) => {
            html += `<div class="bg-slate-800/50 p-4 rounded-lg mb-3 border border-slate-700 relative group"><button onclick="removeArrayItem('tags', ${i})" class="absolute top-2 right-2 text-slate-500 hover:text-red-400 transition"><i class="fa-solid fa-xmark"></i></button>${renderIconInput('Tag Icon', tag.icon, `updateArrayItem('tags', ${i}, 'icon', this.value)`)}</div>`;
        });
        html += `<button onclick="addArrayItem('tags', {text:'New Tag', icon:'fa-star'})" class="w-full text-sm bg-slate-800 py-3 rounded-lg hover:bg-slate-700 border border-dashed border-slate-600 transition font-bold"><i class="fa-solid fa-plus mr-1"></i> Add Tag</button>`;
    }
    else if (slide.type === 'split') {
        html += `<h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">Right Side Visual</h3>`;
        if (slide.image) {
            html += `<div class="bg-slate-800 p-3 rounded-lg mb-6 text-center border border-slate-700 relative"><img src="${slide.image}" class="h-24 mx-auto object-cover rounded shadow mb-3"><button onclick="removeImage('image')" class="w-full bg-slate-900 hover:bg-red-900 text-xs text-red-400 hover:text-white transition font-bold py-2 rounded"><i class="fa-solid fa-trash mr-1"></i> Remove Image</button></div>`;
        } else {
            html += `<div class="flex items-center justify-between mb-2"><label class="!mb-0">Upload Image</label><button onclick="injectRandomImage('image')" class="text-[10px] bg-slate-700 px-2 py-1 rounded hover:bg-blue-600 transition font-bold"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Random</button></div>
                     <div class="form-group"><input type="file" accept="image/*" onchange="handleImageUpload(event, 'image')"></div>
                     <div class="flex items-center my-4"><div class="flex-grow border-t border-slate-700"></div><span class="mx-3 text-xs text-slate-500 font-bold">OR</span><div class="flex-grow border-t border-slate-700"></div></div>
                     ${renderIconInput('Highlight Box Icon', slide.boxIcon, "updateSlide('boxIcon', this.value)")}`;
        }
        html += `<h3 class="text-xs font-bold text-slate-400 mt-8 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">Left Bullets</h3>`;
        (slide.bullets || []).forEach((b, i) => {
            html += `<div class="flex items-center gap-2 mb-2 bg-slate-800 p-2 rounded border border-slate-700"><span class="text-slate-500 text-xs px-2 font-bold">${i + 1}</span><button onclick="removeArrayPrimitive('bullets', ${i})" class="ml-auto text-red-400 hover:bg-slate-700 p-1.5 rounded transition"><i class="fa-solid fa-trash"></i></button></div>`;
        });
        html += `<button onclick="addArrayPrimitive('bullets', 'New key point')" class="w-full text-sm bg-slate-800 py-3 rounded-lg hover:bg-slate-700 border border-dashed border-slate-600 transition mt-2 font-bold"><i class="fa-solid fa-plus mr-1"></i> Add Bullet</button>`;
    }
    else if (slide.type === 'grid') {
        html += `<h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">Grid Cards</h3>`;
        (slide.cards || []).forEach((card, i) => {
            html += `<div class="bg-slate-800 p-4 rounded-lg mb-4 border border-slate-700 relative"><button onclick="removeArrayItem('cards', ${i})" class="absolute top-2 right-2 text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button><div class="font-bold text-slate-300 mb-3 text-sm">Card ${i + 1} Visual</div>`;
            if (card.image) html += `<div class="text-center"><img src="${card.image}" class="h-12 mx-auto object-cover rounded mb-2"><button onclick="removeImage('image', 'cards', ${i})" class="text-xs text-red-400 hover:underline">Remove Image</button></div>`;
            else {
                html += renderIconInput('Card Icon', card.icon, `updateArrayItem('cards', ${i}, 'icon', this.value)`);
                html += `<div class="flex items-center justify-between mb-1 mt-2"><label class="!mb-0 text-[10px]">Or upload image:</label><button onclick="injectRandomImage('image', 'cards', ${i})" class="text-[10px] bg-slate-700 px-2 py-0.5 rounded hover:bg-blue-600 transition font-bold"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Random</button></div>
                         <input type="file" accept="image/*" onchange="handleImageUpload(event, 'image', 'cards', ${i})" class="text-xs !mb-0">`;
            }
            html += `</div>`;
        });
        html += `<button onclick="addArrayItem('cards', {title:'New Feature', text:'Describe it here.', icon:'fa-star'})" class="w-full text-sm bg-slate-800 py-3 rounded-lg hover:bg-slate-700 border border-dashed border-slate-600 transition font-bold"><i class="fa-solid fa-plus mr-1"></i> Add Card</button>`;
    }
    else if (slide.type === 'list') {
        html += `<h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">List Items</h3>`;
        (slide.items || []).forEach((item, i) => {
            html += `<div class="bg-slate-800 p-4 rounded-lg mb-3 border border-slate-700 relative"><button onclick="removeArrayItem('items', ${i})" class="absolute top-2 right-2 text-slate-500 hover:text-red-400"><i class="fa-solid fa-xmark"></i></button>${renderIconInput(`Item ${i + 1} Icon`, item.icon, `updateArrayItem('items', ${i}, 'icon', this.value)`)}</div>`;
        });
        html += `<button onclick="addArrayItem('items', {label:'New Item', value:'Status', icon:'fa-check'})" class="w-full text-sm bg-slate-800 py-3 rounded-lg hover:bg-slate-700 border border-dashed border-slate-600 transition font-bold"><i class="fa-solid fa-plus mr-1"></i> Add Row</button>`;
    }
    else if (slide.type === 'code') {
        html += `
            <h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">Code Snippet</h3>
            <div class="form-group"><label>Terminal Theme</label><select onchange="updateSlide('codeColor', this.value)" class="font-bold">
                <option value="text-green-400" ${slide.codeColor === 'text-green-400' ? 'selected' : ''}>Hacker Green</option>
                <option value="text-blue-400" ${slide.codeColor === 'text-blue-400' ? 'selected' : ''}>Ocean Blue</option>
                <option value="text-pink-400" ${slide.codeColor === 'text-pink-400' ? 'selected' : ''}>Synthwave Pink</option>
                <option value="text-yellow-400" ${slide.codeColor === 'text-yellow-400' ? 'selected' : ''}>Warning Yellow</option>
                <option value="text-white" ${slide.codeColor === 'text-white' ? 'selected' : ''}>Plain White</option>
            </select></div>
        `;
    }
    else if (slide.type === 'cta') {
        html += `<h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">Main Visual</h3>`;
        if (slide.image) html += `<div class="bg-slate-800 p-3 rounded-lg mb-4 text-center border border-slate-700"><img src="${slide.image}" class="h-24 mx-auto object-cover rounded mb-2"><button onclick="removeImage('image')" class="text-xs text-red-400 hover:underline font-bold"><i class="fa-solid fa-trash mr-1"></i> Remove</button></div>`;
        else {
            html += renderIconInput('Main Icon', slide.icon, "updateSlide('icon', this.value)");
            html += `<div class="flex items-center justify-between mb-1"><label class="!mb-0">Or Upload Image</label><button onclick="injectRandomImage('image')" class="text-[10px] bg-slate-700 px-2 py-1 rounded hover:bg-blue-600 transition font-bold"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Random</button></div>
                     <div class="form-group"><input type="file" accept="image/*" onchange="handleImageUpload(event, 'image')"></div>`;
        }
    }

    // CORPORATE EDGE
    else if (slide.type === 'corp_title') {
        html += `<div class="p-4 bg-slate-800 rounded-lg text-sm text-slate-400 mb-4"><i class="fa-solid fa-circle-info text-blue-400 mr-2"></i> This template is minimalist. Click the text on the slide preview directly to edit the Title, Subtitle, and Author.</div>`;
    }
    else if (slide.type === 'corp_quote') {
        html += `<div class="p-4 bg-slate-800 rounded-lg text-sm text-slate-400 mb-4"><i class="fa-solid fa-circle-info text-blue-400 mr-2"></i> Click the text on the slide preview directly to edit the Quote and Attribution.</div>`;
    }
    else if (slide.type === 'corp_image_text') {
        html += `<h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">Left Side Visual</h3>`;
        if (slide.image) {
            html += `<div class="bg-slate-800 p-3 rounded-lg mb-6 text-center border border-slate-700 relative"><img src="${slide.image}" class="h-24 mx-auto object-cover rounded shadow mb-3"><button onclick="removeImage('image')" class="w-full bg-slate-900 hover:bg-red-900 text-xs text-red-400 hover:text-white transition font-bold py-2 rounded"><i class="fa-solid fa-trash mr-1"></i> Remove Image</button></div>`;
        } else {
            html += `<div class="flex items-center justify-between mb-2"><label class="!mb-0">Upload Image</label><button onclick="injectRandomImage('image')" class="text-[10px] bg-slate-700 px-2 py-1 rounded hover:bg-blue-600 transition font-bold"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Random</button></div>
                     <div class="form-group"><input type="file" accept="image/*" onchange="handleImageUpload(event, 'image')"></div>`;
        }
        html += `<h3 class="text-xs font-bold text-slate-400 mt-8 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">Right Copy Bullets</h3>`;
        (slide.bullets || []).forEach((b, i) => {
            html += `<div class="flex items-center gap-2 mb-2 bg-slate-800 p-2 rounded border border-slate-700"><span class="text-slate-500 text-xs px-2 font-bold">${i + 1}</span><button onclick="removeArrayPrimitive('bullets', ${i})" class="ml-auto text-red-400 hover:bg-slate-700 p-1.5 rounded transition"><i class="fa-solid fa-trash"></i></button></div>`;
        });
        html += `<button onclick="addArrayPrimitive('bullets', 'Editorial point')" class="w-full text-sm bg-slate-800 py-3 rounded-lg hover:bg-slate-700 border border-dashed border-slate-600 transition mt-2 font-bold"><i class="fa-solid fa-plus mr-1"></i> Add Point</button>`;
    }

    // CREATIVE PITCH
    else if (slide.type === 'pitch_hero') {
        html += `<h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">Background Image</h3>`;
        if (slide.image) {
            html += `<div class="bg-slate-800 p-3 rounded-lg mb-6 text-center border border-slate-700 relative"><img src="${slide.image}" class="h-24 mx-auto object-cover rounded shadow mb-3"><button onclick="removeImage('image')" class="w-full bg-slate-900 hover:bg-red-900 text-xs text-red-400 hover:text-white transition font-bold py-2 rounded"><i class="fa-solid fa-trash mr-1"></i> Remove Background</button></div>`;
        } else {
            html += `<div class="flex items-center justify-between mb-2"><label class="!mb-0">Upload Background Image</label><button onclick="injectRandomImage('image')" class="text-[10px] bg-slate-700 px-2 py-1 rounded hover:bg-blue-600 transition font-bold"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Random</button></div>
                     <div class="form-group"><input type="file" accept="image/*" onchange="handleImageUpload(event, 'image')"></div>`;
        }
    }
    else if (slide.type === 'pitch_stats') {
        html += `<h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">Key Metrics</h3>`;
        (slide.stats || []).forEach((stat, i) => {
            html += `<div class="bg-slate-800 p-4 rounded-lg mb-3 border border-slate-700 relative"><button onclick="removeArrayItem('stats', ${i})" class="absolute top-2 right-2 text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
                     <label>Statistic Value (e.g. 99%)</label><input type="text" value="${escapeHtml(stat.value)}" oninput="updateArrayItem('stats', ${i}, 'value', this.value)" class="mb-2">
                     <label>Label</label><input type="text" value="${escapeHtml(stat.label)}" oninput="updateArrayItem('stats', ${i}, 'label', this.value)" class="!mb-0"></div>`;
        });
        html += `<button onclick="addArrayItem('stats', {value:'100', label:'New Metric'})" class="w-full text-sm bg-slate-800 py-3 rounded-lg hover:bg-slate-700 border border-dashed border-slate-600 transition font-bold"><i class="fa-solid fa-plus mr-1"></i> Add Metric</button>`;
    }
    else if (slide.type === 'pitch_timeline') {
        html += `<h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest border-b border-slate-700 pb-2">Timeline Milestones</h3>`;
        (slide.timeline || []).forEach((item, i) => {
            html += `<div class="bg-slate-800 p-4 rounded-lg mb-3 border border-slate-700 relative"><button onclick="removeArrayItem('timeline', ${i})" class="absolute top-2 right-2 text-slate-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button>
                     <label>Milestone (e.g. 2024)</label><input type="text" value="${escapeHtml(item.year)}" oninput="updateArrayItem('timeline', ${i}, 'year', this.value)" class="mb-2">
                     <label>Description</label><input type="text" value="${escapeHtml(item.text)}" oninput="updateArrayItem('timeline', ${i}, 'text', this.value)" class="!mb-0"></div>`;
        });
        html += `<button onclick="addArrayItem('timeline', {year:'Future', text:'Next Step'})" class="w-full text-sm bg-slate-800 py-3 rounded-lg hover:bg-slate-700 border border-dashed border-slate-600 transition font-bold"><i class="fa-solid fa-plus mr-1"></i> Add Milestone</button>`;
    }

    html += `
        <div class="mt-8 pt-6 border-t border-slate-800">
            <h3 class="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest"><i class="fa-solid fa-clipboard-user mr-1"></i> Speaker Notes</h3>
            <textarea rows="4" placeholder="Add notes for your presentation here. These will export directly to PPTX." oninput="updateSlide('notes', this.value)" class="!mb-0 text-sm bg-slate-900 border-slate-700">${escapeHtml(slide.notes || '')}</textarea>
        </div>
    `;

    form.innerHTML = html;
}

// --- INLINE EDITING SYNC ---
function handleInlineEdit(event, key, arrayName = null, index = null) {
    let val = event.target.innerText;
    const slide = slides.find(s => s.id === currentSlideId);
    if (!slide) return;
    if (arrayName !== null && index !== null) slide[arrayName][index][key] = val;
    else slide[key] = val;
    saveProjects();

    const form = document.getElementById('editorForm');
    if (form) {
        const inputs = form.querySelectorAll('input[type="text"], textarea');
        inputs.forEach(input => {
            if (input.getAttribute('oninput') && input.getAttribute('oninput').includes(`'${key}'`)) {
                input.value = val;
            }
        });
    }
}

function handleInlineEditPrimitive(event, arrayName, index) {
    let val = event.target.innerText;
    const slide = slides.find(s => s.id === currentSlideId);
    if (slide && slide[arrayName]) {
        slide[arrayName][index] = val;
        saveProjects();
        renderEditor();
    }
}

function createEditableTag(tagName, classNames, content, key, arrayName = null, index = null) {
    let args = arrayName ? `'${key}', '${arrayName}', ${index}` : `'${key}'`;
    return `<${tagName} class="${classNames}" contenteditable="true" onblur="handleInlineEdit(event, ${args})">${escapeHtml(content)}</${tagName}>`;
}

function createEditablePrimitive(tagName, classNames, content, arrayName, index) {
    return `<${tagName} class="${classNames}" contenteditable="true" onblur="handleInlineEditPrimitive(event, '${arrayName}', ${index})">${escapeHtml(content)}</${tagName}>`;
}

// --- DATA MUTATORS ---
function updateSlide(key, value) { const slide = slides.find(s => s.id === currentSlideId); if (slide) { slide[key] = value; renderSlideList(); renderPreview(); saveProjects(); } }
function updateArrayItem(arrayName, index, key, value) { const slide = slides.find(s => s.id === currentSlideId); if (slide && slide[arrayName]) { slide[arrayName][index][key] = value; renderPreview(); saveProjects(); } }
function updateArrayPrimitive(arrayName, index, value) { const slide = slides.find(s => s.id === currentSlideId); if (slide && slide[arrayName]) { slide[arrayName][index] = value; renderPreview(); saveProjects(); } }
function addArrayItem(arrayName, defaultObj) { const slide = slides.find(s => s.id === currentSlideId); if (slide) { if (!slide[arrayName]) slide[arrayName] = []; slide[arrayName].push(defaultObj); renderEditor(); renderPreview(); saveProjects(); } }
function addArrayPrimitive(arrayName, defaultStr) { const slide = slides.find(s => s.id === currentSlideId); if (slide) { if (!slide[arrayName]) slide[arrayName] = []; slide[arrayName].push(defaultStr); renderEditor(); renderPreview(); saveProjects(); } }
function removeArrayItem(arrayName, index) { const slide = slides.find(s => s.id === currentSlideId); if (slide && slide[arrayName]) { slide[arrayName].splice(index, 1); renderEditor(); renderPreview(); saveProjects(); } }
function removeArrayPrimitive(arrayName, index) { removeArrayItem(arrayName, index); }
function removeImage(key, arrayName = null, index = null) {
    if (arrayName !== null && index !== null) updateArrayItem(arrayName, index, key, '');
    else updateSlide(key, '');
    renderEditor(); saveProjects();
}

function addSlide(type) {
    slideCounter++;
    let newSlide = { id: 'slide_' + Date.now() + '_' + Math.floor(Math.random() * 1000), type: type, navName: 'New Slide', title: 'Main Topic Heading', transition: 'fade-in', bgOverride: 'bg-default', notes: '' };

    if (type === 'intro') { newSlide.subtitle = 'Subtitle or presenter name'; newSlide.icon = 'fa-desktop'; newSlide.tags = []; }
    if (type === 'split') { newSlide.subtitle = 'Explain the details of this topic here in a few sentences.'; newSlide.bullets = ['First key point', 'Second point']; newSlide.boxTitle = 'Highlight'; newSlide.boxText = 'Important takeaway goes here'; newSlide.boxIcon = 'fa-info-circle'; }
    if (type === 'grid') { newSlide.subtitle = 'Break down your topic into key areas.'; newSlide.cards = [{ title: 'Feature 1', text: 'Description of feature 1.', icon: 'fa-cube' }, { title: 'Feature 2', text: 'Description of feature 2.', icon: 'fa-bolt' }]; }
    if (type === 'list') { newSlide.subtitle = 'List out requirements, status, or steps.'; newSlide.items = [{ label: 'Step 1', value: 'Done', icon: 'fa-check-circle' }]; }
    if (type === 'code') { newSlide.subtitle = 'Description of the code snippet below.'; newSlide.codeHeader = 'script.sh'; newSlide.codeContent = '#!/bin/bash\necho "Hello World"'; newSlide.codeColor = 'text-green-400'; }
    if (type === 'cta') { newSlide.subtitle = 'What should the audience do next?'; newSlide.icon = 'fa-rocket'; newSlide.link = 'go.company.com/action'; }

    if (type === 'corp_title') { newSlide.subtitle = 'Subtitle or department here'; newSlide.author = 'Presenter Name'; newSlide.bgOverride = 'bg-purewhite'; }
    if (type === 'corp_quote') { newSlide.title = 'Innovation distinguishes between a leader and a follower.'; newSlide.author = 'Steve Jobs'; }
    if (type === 'corp_image_text') { newSlide.subtitle = 'Detailed description goes here.'; newSlide.bullets = ['Supporting detail one', 'Supporting detail two']; }

    if (type === 'pitch_hero') { newSlide.subtitle = 'The big idea.'; }
    if (type === 'pitch_stats') { newSlide.subtitle = 'Key performance indicators.'; newSlide.stats = [{ value: '99%', label: 'Uptime' }, { value: '10x', label: 'Growth' }, { value: '24/7', label: 'Support' }]; }
    if (type === 'pitch_timeline') { newSlide.subtitle = 'Our journey.'; newSlide.timeline = [{ year: '2023', text: 'Launch' }, { year: '2024', text: 'Scale' }, { year: '2025', text: 'Dominate' }]; }

    slides.push(newSlide);
    currentSlideId = newSlide.id;
    hideModal('templateModal');
    saveProjects();
    renderApp();
    setTimeout(() => { document.getElementById('slideList').scrollTop = 9999; }, 50);
}

function duplicateSlide(id, event) {
    event.stopPropagation();
    const index = slides.findIndex(s => s.id === id);
    if (index === -1) return;
    slideCounter++;
    const cloned = JSON.parse(JSON.stringify(slides[index]));
    cloned.id = 'slide_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    cloned.navName = cloned.navName + ' (Copy)';
    slides.splice(index + 1, 0, cloned);
    currentSlideId = cloned.id;
    saveProjects();
    renderApp();
}

function deleteSlide(id, event) {
    event.stopPropagation();
    if (slides.length <= 1) return alert("You must have at least one slide.");
    if (confirm("Delete this slide?")) {
        slides = slides.filter(s => s.id !== id);
        if (currentSlideId === id) currentSlideId = slides[0].id;
        saveProjects();
        renderApp();
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function generateSlideHTML(slide, isExport = false) {
    let animClass = slide.transition || 'fade-in';
    if (!isExport) animClass = 'fade-in';

    if (slide.type === 'intro') {
        let tagsHtml = (slide.tags || []).map((t, i) => `<span class="flex items-center"><i class="fa-solid ${escapeHtml(t.icon)} mr-2"></i>${createEditableTag('span', '', t.text, 'text', 'tags', i)}</span>`).join('');
        return `
            <div class="theme-card text-center ${animClass}">
                <div class="mb-6 inline-block p-4 rounded-3xl border" style="background-color: color-mix(in srgb, var(--accent-color) 10%, transparent); border-color: color-mix(in srgb, var(--accent-color) 20%, transparent);">
                    <i class="fa-solid ${escapeHtml(slide.icon)} text-6xl accent-text drop-shadow-[0_0_15px_var(--accent-color)]"></i>
                </div>
                ${createEditableTag('h1', 'text-7xl font-extrabold mb-4 tracking-tighter w-full', slide.title, 'title')}
                ${createEditableTag('p', 'text-2xl text-slate-400 uppercase tracking-widest font-light mb-12 w-full block', slide.subtitle, 'subtitle')}
                <div class="flex justify-center gap-8 text-slate-500 text-sm font-mono">${tagsHtml}</div>
            </div>
        `;
    }
    else if (slide.type === 'split') {
        let bulletsHtml = (slide.bullets || []).map((b, i) => `<li class="flex items-start w-full"><i class="fa-solid fa-angle-right accent-text mr-3 mt-1.5"></i> ${createEditablePrimitive('span', 'flex-grow w-full block', b, 'bullets', i)}</li>`).join('');
        let rightHtml = '';
        if (slide.image) { rightHtml = `<img src="${slide.image}" class="w-full h-80 object-cover rounded-2xl border border-slate-700 shadow-2xl">`; }
        else {
            rightHtml = `
                <div class="bg-slate-900 rounded-2xl p-8 border border-slate-800 flex flex-col justify-center items-center text-center h-full shadow-inner relative overflow-hidden w-full">
                    <div class="absolute top-0 left-0 w-full h-1" style="background: var(--accent-color)"></div>
                    <i class="fa-solid ${escapeHtml(slide.boxIcon)} text-6xl text-slate-600 mb-6 drop-shadow-lg"></i>
                    ${createEditableTag('h3', 'text-xl font-bold text-white mb-3 w-full', slide.boxTitle, 'boxTitle')}
                    ${createEditableTag('p', 'text-slate-400 leading-relaxed w-full', slide.boxText, 'boxText')}
                </div>
            `;
        }

        return `
            <div class="theme-card border-l-8 ${animClass}" style="border-left-color: var(--accent-color)">
                ${createEditableTag('h2', 'text-4xl font-bold mb-10 w-full', slide.title, 'title')}
                <div class="grid grid-cols-2 gap-16 items-center">
                    <div class="space-y-8 w-full">
                        ${createEditableTag('p', 'text-xl text-slate-300 leading-relaxed w-full block', slide.subtitle, 'subtitle')}
                        <ul class="space-y-5 text-slate-400 text-lg w-full">${bulletsHtml}</ul>
                    </div>
                    <div class="h-full flex flex-col justify-center w-full">${rightHtml}</div>
                </div>
            </div>
        `;
    }
    else if (slide.type === 'grid') {
        let colsClass = slide.cards && slide.cards.length === 4 ? 'grid-cols-2' : 'grid-cols-3';
        let cardsHtml = (slide.cards || []).map((c, i) => `
            <div class="p-8 bg-slate-800/40 rounded-xl border text-center relative overflow-hidden transition shadow-lg w-full" style="border-color: color-mix(in srgb, var(--accent-color) 30%, transparent);">
                ${c.image ? `<img src="${c.image}" class="h-16 w-16 mx-auto object-cover rounded mb-6">` : `<i class="fa-solid ${escapeHtml(c.icon)} text-5xl accent-text mb-6"></i>`}
                ${createEditableTag('h4', 'text-xl font-bold text-white mb-3 w-full block', c.title, 'title', 'cards', i)}
                ${createEditableTag('p', 'text-sm text-slate-400 leading-relaxed w-full block', c.text, 'text', 'cards', i)}
            </div>
        `).join('');
        return `
            <div class="theme-card ${animClass}">
                ${createEditableTag('h2', 'text-4xl font-bold mb-4 w-full text-center', slide.title, 'title')}
                ${createEditableTag('p', 'text-slate-400 mb-10 text-lg w-full text-center block', slide.subtitle, 'subtitle')}
                <div class="grid ${colsClass} gap-8 w-full">${cardsHtml}</div>
            </div>
        `;
    }
    else if (slide.type === 'list') {
        let itemsHtml = (slide.items || []).map((item, i) => `
            <li class="flex items-center justify-between bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md w-full">
                <div class="flex items-center w-full"><i class="fa-solid ${escapeHtml(item.icon)} text-slate-400 mr-4 text-xl shrink-0"></i>${createEditableTag('span', 'text-lg font-semibold w-full block', item.label, 'label', 'items', i)}</div>
                ${createEditableTag('span', 'accent-text font-bold uppercase tracking-widest text-sm bg-slate-900 px-3 py-1 rounded border border-slate-700 ml-4 shrink-0', item.value, 'value', 'items', i)}
            </li>
        `).join('');
        return `
            <div class="theme-card border-l-8 ${animClass}" style="border-left-color: var(--accent-color)">
                ${createEditableTag('h2', 'text-4xl font-bold mb-10 w-full', slide.title, 'title')}
                <div class="grid grid-cols-2 gap-12 items-center w-full">
                    <div class="space-y-6 w-full">
                        ${createEditableTag('p', 'text-xl text-slate-300 mb-6 w-full block', slide.subtitle, 'subtitle')}
                        <ul class="space-y-4 w-full">${itemsHtml}</ul>
                    </div>
                    <div class="flex flex-col items-center justify-center bg-slate-900 border border-slate-700 p-10 rounded-2xl h-full shadow-inner w-full">
                        <i class="fa-solid fa-list-check text-9xl accent-text mb-8 drop-shadow-[0_0_20px_var(--accent-color)] opacity-80"></i>
                        <h3 class="text-3xl font-bold text-white tracking-tight text-center pointer-events-none">Checklist</h3>
                    </div>
                </div>
            </div>
        `;
    }
    else if (slide.type === 'code') {
        let codeColor = slide.codeColor || 'text-green-400';
        return `
            <div class="theme-card ${animClass}">
                ${createEditableTag('h2', 'text-4xl font-bold mb-4 w-full', slide.title, 'title')}
                ${createEditableTag('p', 'text-slate-400 mb-8 text-lg w-full block', slide.subtitle, 'subtitle')}
                
                <div class="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden w-full text-left">
                    <div class="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-950">
                        <div class="flex gap-2 mr-4 pointer-events-none">
                            <div class="w-3 h-3 rounded-full bg-red-500"></div><div class="w-3 h-3 rounded-full bg-yellow-500"></div><div class="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <i class="fa-solid fa-file-code text-slate-500 mr-2 text-xs pointer-events-none"></i>
                        ${createEditableTag('span', 'text-xs text-slate-400 font-mono tracking-widest w-full block', slide.codeHeader, 'codeHeader')}
                    </div>
                    <div class="p-6 overflow-x-auto">
                        ${createEditableTag('pre', `font-mono text-sm ${codeColor} leading-relaxed whitespace-pre-wrap outline-none w-full block`, slide.codeContent, 'codeContent')}
                    </div>
                </div>
            </div>
        `;
    }
    else if (slide.type === 'cta') {
        return `
            <div class="theme-card text-center ${animClass}">
                ${slide.image ? `<img src="${slide.image}" class="h-40 mx-auto object-cover rounded-2xl mb-8 shadow-2xl border border-slate-700">` : `<i class="fa-solid ${escapeHtml(slide.icon)} text-7xl text-white mb-8 drop-shadow-lg"></i>`}
                ${createEditableTag('h2', 'text-6xl font-extrabold mb-6 tracking-tighter w-full', slide.title, 'title')}
                ${createEditableTag('p', 'text-2xl text-slate-400 mb-10 max-w-3xl mx-auto font-light w-full block', slide.subtitle, 'subtitle')}
                ${slide.link ? `<div class="inline-block bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl hover:scale-105 transition"><i class="fa-solid fa-link accent-text mr-3 pointer-events-none"></i>${createEditableTag('span', 'text-2xl font-mono text-white font-bold', slide.link, 'link')}</div>` : ''}
            </div>
        `;
    }
    // CORPORATE EDGE
    else if (slide.type === 'corp_title') {
        return `
            <div class="w-full max-w-5xl px-12 ${animClass}">
                <div class="w-16 h-2 mb-8" style="background:var(--accent-color)"></div>
                ${createEditableTag('h1', 'text-8xl font-bold mb-6 tracking-tight leading-tight w-full', slide.title, 'title')}
                ${createEditableTag('p', 'text-3xl text-slate-400 font-light mb-16 w-full block', slide.subtitle, 'subtitle')}
                <div class="flex items-center gap-4 mt-20 border-t border-slate-800 pt-6">
                    <div class="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center pointer-events-none"><i class="fa-solid fa-user accent-text"></i></div>
                    ${createEditableTag('span', 'text-xl font-medium w-full block', slide.author, 'author')}
                </div>
            </div>
        `;
    }
    else if (slide.type === 'corp_quote') {
        return `
            <div class="w-full max-w-5xl text-center px-12 ${animClass}">
                <i class="fa-solid fa-quote-left text-6xl mb-8 opacity-50" style="color:var(--accent-color)"></i>
                ${createEditableTag('h2', 'text-5xl font-serif italic mb-10 leading-relaxed w-full block', slide.title, 'title')}
                <div class="flex items-center justify-center gap-4">
                    <div class="w-12 h-0.5 bg-slate-600"></div>
                    ${createEditableTag('p', 'text-xl text-slate-400 uppercase tracking-widest font-bold', slide.author, 'author')}
                    <div class="w-12 h-0.5 bg-slate-600"></div>
                </div>
            </div>
        `;
    }
    else if (slide.type === 'corp_image_text') {
        let bulletsHtml = (slide.bullets || []).map((b, i) => `<li class="flex items-start w-full"><div class="w-2 h-2 mt-2 mr-4 rounded-full shrink-0" style="background:var(--accent-color)"></div> ${createEditablePrimitive('span', 'flex-grow w-full block', b, 'bullets', i)}</li>`).join('');
        let leftHtml = slide.image ? `<img src="${slide.image}" class="w-full h-full object-cover">` : `<div class="w-full h-full bg-slate-800 flex items-center justify-center"><i class="fa-solid fa-image text-slate-600 text-6xl"></i></div>`;
        return `
            <div class="theme-card p-0 overflow-hidden flex h-[600px] ${animClass}">
                <div class="w-1/2 h-full relative">${leftHtml}</div>
                <div class="w-1/2 h-full flex flex-col justify-center p-16">
                    ${createEditableTag('h2', 'text-4xl font-bold mb-6 w-full', slide.title, 'title')}
                    ${createEditableTag('p', 'text-lg text-slate-400 leading-relaxed mb-8 w-full block', slide.subtitle, 'subtitle')}
                    <ul class="space-y-4 text-slate-300 text-lg w-full">${bulletsHtml}</ul>
                </div>
            </div>
        `;
    }
    // CREATIVE PITCH
    else if (slide.type === 'pitch_hero') {
        let bgStyle = slide.image ? `background-image: url(${slide.image}); background-size: cover; background-position: center;` : `background: var(--accent-color);`;
        return `
            <div class="absolute inset-0 z-0 ${animClass}" style="${bgStyle}">
                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            </div>
            <div class="relative z-10 w-full max-w-5xl text-center ${animClass}">
                ${createEditableTag('h1', 'text-8xl font-black mb-6 tracking-tighter w-full drop-shadow-2xl uppercase text-white', slide.title, 'title')}
                ${createEditableTag('p', 'text-3xl text-white font-light w-full block drop-shadow-lg', slide.subtitle, 'subtitle')}
            </div>
        `;
    }
    else if (slide.type === 'pitch_stats') {
        let statsHtml = (slide.stats || []).map((stat, i) => `
            <div class="flex flex-col items-center">
                ${createEditableTag('h3', 'text-7xl font-black mb-2 accent-text drop-shadow-[0_0_20px_rgba(59,130,246,0.3)] w-full text-center', stat.value, 'value', 'stats', i)}
                ${createEditableTag('p', 'text-xl text-slate-400 uppercase tracking-widest font-bold w-full text-center block', stat.label, 'label', 'stats', i)}
            </div>
        `).join('');
        return `
            <div class="w-full max-w-6xl px-12 ${animClass}">
                ${createEditableTag('h2', 'text-5xl font-bold mb-4 w-full text-center', slide.title, 'title')}
                ${createEditableTag('p', 'text-xl text-slate-400 mb-20 w-full text-center block', slide.subtitle, 'subtitle')}
                <div class="flex justify-around items-center w-full">${statsHtml}</div>
            </div>
        `;
    }
    else if (slide.type === 'pitch_timeline') {
        let timeHtml = (slide.timeline || []).map((item, i) => `
            <div class="flex flex-col items-center relative z-10 w-48">
                <div class="w-6 h-6 rounded-full border-4 border-slate-900 mb-6 shadow-[0_0_15px_var(--accent-color)]" style="background:var(--accent-color)"></div>
                ${createEditableTag('h4', 'text-2xl font-bold text-white mb-2 w-full text-center block', item.year, 'year', 'timeline', i)}
                ${createEditableTag('p', 'text-sm text-slate-400 w-full text-center block leading-relaxed', item.text, 'text', 'timeline', i)}
            </div>
        `).join('');
        return `
            <div class="w-full max-w-6xl px-12 ${animClass}">
                ${createEditableTag('h2', 'text-5xl font-bold mb-4 w-full text-center', slide.title, 'title')}
                ${createEditableTag('p', 'text-xl text-slate-400 mb-24 w-full text-center block', slide.subtitle, 'subtitle')}
                
                <div class="relative w-full flex justify-between items-start">
                    <div class="absolute top-3 left-10 right-10 h-1 bg-slate-800 z-0"></div>
                    ${timeHtml}
                </div>
            </div>
        `;
    }

    return '';
}

function renderPreview() {
    const preview = document.getElementById('livePreview');
    const slide = slides.find(s => s.id === currentSlideId);
    if (!slide) { preview.innerHTML = ''; return; }
    preview.className = `preview-wrapper ${slide.bgOverride || 'bg-default'}`;
    preview.innerHTML = `<div class="theme-slide">${generateSlideHTML(slide, false)}</div>`;
}

// Explicitly expose to window
window.resizeImageForStorage = resizeImageForStorage;
window.injectRandomImage = injectRandomImage;
window.resizePreview = resizePreview;
window.renderApp = renderApp;
window.renderSlideList = renderSlideList;
window.handleImageUpload = handleImageUpload;
window.renderEditor = renderEditor;
window.handleInlineEdit = handleInlineEdit;
window.handleInlineEditPrimitive = handleInlineEditPrimitive;
window.createEditableTag = createEditableTag;
window.createEditablePrimitive = createEditablePrimitive;
window.updateSlide = updateSlide;
window.updateArrayItem = updateArrayItem;
window.updateArrayPrimitive = updateArrayPrimitive;
window.addArrayItem = addArrayItem;
window.addArrayPrimitive = addArrayPrimitive;
window.removeArrayItem = removeArrayItem;
window.removeArrayPrimitive = removeArrayPrimitive;
window.removeImage = removeImage;
window.addSlide = addSlide;
window.duplicateSlide = duplicateSlide;
window.deleteSlide = deleteSlide;
window.escapeHtml = escapeHtml;
window.generateSlideHTML = generateSlideHTML;
window.renderPreview = renderPreview;