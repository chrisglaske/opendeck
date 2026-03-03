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
    document.getElementById('slideCountBadge').innerText = slides.length;
    // Fixes the large slide bug on initial load by waiting for the DOM to finish painting!
    setTimeout(resizePreview, 50);
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
            <div class="flex shrink-0 pointer-events-auto">
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

// Helper for sleek icon inputs in properties panel
function generateProIconInput(label, value, onUpdateStr) {
    const randId = Math.random().toString(36).substr(2, 5);
    window[`iconCb_${randId}`] = function (icon) {
        const func = new Function('icon', `${onUpdateStr.replace('this.value', 'icon')}; renderApp();`);
        func(icon);
    };
    return `
        <div class="flex flex-col gap-1.5 mb-3">
            <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">${label}</label>
            <div class="flex gap-2 w-full">
                <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-2 text-xs text-white outline-none font-mono transition-colors" value="${escapeHtml(value)}" oninput="${onUpdateStr}">
                <button class="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-md border border-slate-700 transition-colors" onclick="openIconModal(window.iconCb_${randId})"><i class="fa-solid fa-icons"></i></button>
            </div>
        </div>
    `;
}

// --- 🔥 HIGH-END PURE TAILWIND PRO INSPECTOR ---
function renderEditor() {
    const form = document.getElementById('editorForm');
    const slide = slides.find(s => s.id === currentSlideId);
    if (!slide) { form.innerHTML = ''; return; }

    let html = `
        <div class="mb-6 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
            <div class="bg-slate-800/80 px-4 py-2.5 border-b border-slate-700/50 flex items-center">
                <i class="fa-solid fa-sliders text-blue-400 mr-2 text-xs"></i>
                <span class="text-[0.65rem] font-extrabold uppercase tracking-widest text-slate-300">General Setup</span>
            </div>
            <div class="p-4 space-y-4">
                <div class="flex flex-col gap-2">
                    <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Tab Name (Sidebar)</label>
                    <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-2 text-sm text-white outline-none transition-colors" value="${escapeHtml(slide.navName || '')}" oninput="updateSlide('navName', this.value)">
                </div>
                <div class="flex gap-3">
                    <div class="flex flex-col gap-2 w-1/2">
                        <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Transition</label>
                        <select class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-2 py-2 text-xs text-white outline-none transition-colors cursor-pointer" onchange="updateSlide('transition', this.value)">
                            <option value="fade-in" ${slide.transition === 'fade-in' ? 'selected' : ''}>Fade In</option>
                            <option value="slide-up" ${slide.transition === 'slide-up' ? 'selected' : ''}>Slide Up</option>
                            <option value="zoom-in" ${slide.transition === 'zoom-in' ? 'selected' : ''}>Zoom In</option>
                        </select>
                    </div>
                    <div class="flex flex-col gap-2 w-1/2">
                        <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Background</label>
                        <select class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-2 py-2 text-xs text-white outline-none transition-colors cursor-pointer" onchange="updateSlide('bgOverride', this.value)">
                            <option value="bg-default" ${slide.bgOverride === 'bg-default' ? 'selected' : ''}>Dark Radial</option>
                            <option value="bg-deepblue" ${slide.bgOverride === 'bg-deepblue' ? 'selected' : ''}>Deep Blue</option>
                            <option value="bg-midnight" ${slide.bgOverride === 'bg-midnight' ? 'selected' : ''}>Midnight</option>
                            <option value="bg-pitchblack" ${slide.bgOverride === 'bg-pitchblack' ? 'selected' : ''}>Solid Black</option>
                            <option value="bg-purewhite" ${slide.bgOverride === 'bg-purewhite' ? 'selected' : ''}>Pure White</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `;

    const openBlock = (title, icon) => `<div class="mb-6 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-sm"><div class="bg-slate-800/80 px-4 py-2.5 border-b border-slate-700/50 flex items-center"><i class="fa-solid ${icon} text-blue-400 mr-2 text-xs"></i><span class="text-[0.65rem] font-extrabold uppercase tracking-widest text-slate-300">${title}</span></div><div class="p-4">`;
    const closeBlock = `</div></div>`;

    if (slide.type === 'intro') {
        html += openBlock('Hero Assets', 'fa-image');
        html += generateProIconInput('Main Icon', slide.icon, "updateSlide('icon', this.value)");
        html += closeBlock;

        html += openBlock('Pill Badges', 'fa-tags');
        (slide.tags || []).forEach((tag, i) => {
            html += `<div class="bg-[#0b1121] border border-slate-700/50 rounded-lg p-3 mb-3 relative group transition hover:border-slate-500">
                        <div class="absolute -top-2 -right-2 bg-slate-800 hover:bg-red-500 text-slate-400 hover:text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-all shadow-md border border-slate-600" onclick="removeArrayItem('tags', ${i})"><i class="fa-solid fa-trash"></i></div>
                        <div class="flex items-center justify-between mb-3">
                            <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Tag Color</label>
                            <input type="color" class="w-8 h-6 bg-transparent rounded cursor-pointer border-0 p-0" value="${tag.color || '#3B82F6'}" onchange="updateArrayItem('tags', ${i}, 'color', this.value)">
                        </div>
                        ${generateProIconInput('Icon', tag.icon, `updateArrayItem('tags', ${i}, 'icon', this.value)`)}
                     </div>`;
        });
        html += `<button class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors shadow-sm" onclick="addArrayItem('tags', {text:'New Tag', icon:'fa-star', color:'#3B82F6'})"><i class="fa-solid fa-plus mr-2"></i>Add Tag</button>`;
        html += closeBlock;
    }
    else if (slide.type === 'split') {
        html += openBlock('Right Visual', 'fa-image');
        if (slide.image) {
            html += `<img src="${slide.image}" class="w-full h-24 object-cover rounded-lg border border-slate-700 mb-3 shadow-inner">
                     <button class="w-full bg-red-900/30 hover:bg-red-500 text-red-400 hover:text-white border border-red-900/50 text-xs font-bold py-2 rounded-lg transition" onclick="removeImage('image')">Remove Image</button>`;
        } else {
            html += `<div class="flex justify-between items-center mb-2"><label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Upload Image</label><button class="text-[9px] bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-0.5 rounded transition" onclick="injectRandomImage('image')">Random</button></div>
                     <input type="file" class="w-full text-xs text-slate-400 file:bg-slate-800 file:border-0 file:text-white file:px-3 file:py-1.5 file:rounded file:cursor-pointer file:hover:bg-slate-700 mb-4" accept="image/*" onchange="handleImageUpload(event, 'image')">
                     <div class="flex items-center gap-3 mb-4"><div class="h-px bg-slate-800 flex-grow"></div><span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">OR USE ICON</span><div class="h-px bg-slate-800 flex-grow"></div></div>
                     ${generateProIconInput('Highlight Box Icon', slide.boxIcon, "updateSlide('boxIcon', this.value)")}`;
        }
        html += closeBlock;

        html += openBlock('Left Details', 'fa-list');
        (slide.bullets || []).forEach((b, i) => {
            html += `<div class="flex justify-between items-center bg-[#0b1121] border border-slate-700/50 rounded-lg p-2 mb-2">
                        <span class="text-xs font-bold text-slate-500 px-2">${i + 1}</span>
                        <button class="text-slate-500 hover:text-red-400 px-2 transition-colors" onclick="removeArrayPrimitive('bullets', ${i})"><i class="fa-solid fa-trash"></i></button>
                     </div>`;
        });
        html += `<button class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors mt-2" onclick="addArrayPrimitive('bullets', 'New key point')"><i class="fa-solid fa-plus mr-2"></i>Add Bullet</button>`;
        html += closeBlock;
    }
    else if (slide.type === 'grid') {
        html += openBlock('Feature Cards', 'fa-border-all');
        (slide.cards || []).forEach((card, i) => {
            html += `<div class="bg-[#0b1121] border border-slate-700/50 rounded-lg p-3 mb-3 relative group transition hover:border-slate-500">
                        <div class="absolute -top-2 -right-2 bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-all border border-slate-600 shadow-md" onclick="removeArrayItem('cards', ${i})"><i class="fa-solid fa-trash"></i></div>
                        <div class="text-[10px] font-extrabold text-slate-500 tracking-widest mb-3 border-b border-slate-800 pb-1">CARD ${i + 1}</div>`;
            if (card.image) {
                html += `<img src="${card.image}" class="w-full h-12 object-cover rounded mb-2 border border-slate-700">
                         <button class="text-[10px] text-red-400 hover:text-red-300 w-full text-left font-bold" onclick="removeImage('image', 'cards', ${i})">Remove Image</button>`;
            } else {
                html += `<div class="flex items-center justify-between mb-3">
                            <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Accent Color</label>
                            <input type="color" class="w-8 h-6 bg-transparent rounded cursor-pointer border-0 p-0" value="${card.color || '#3B82F6'}" onchange="updateArrayItem('cards', ${i}, 'color', this.value)">
                        </div>
                        ${generateProIconInput('Card Icon', card.icon, `updateArrayItem('cards', ${i}, 'icon', this.value)`)}
                        <div class="flex justify-between items-center mt-3 border-t border-slate-800 pt-3 mb-2">
                            <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Upload Image</label>
                            <button class="text-[9px] bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white px-2 py-0.5 rounded transition" onclick="injectRandomImage('image', 'cards', ${i})">Random</button>
                        </div>
                        <input type="file" class="w-full text-[10px] text-slate-400 file:bg-slate-800 file:border-0 file:text-white file:px-2 file:py-1 file:rounded file:cursor-pointer file:hover:bg-slate-700" accept="image/*" onchange="handleImageUpload(event, 'image', 'cards', ${i})">`;
            }
            html += `</div>`;
        });
        html += `<button class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors" onclick="addArrayItem('cards', {title:'New Feature', text:'Description', icon:'fa-star', color:'#3B82F6'})"><i class="fa-solid fa-plus mr-2"></i>Add Card</button>`;
        html += closeBlock;
    }
    else if (slide.type === 'list') {
        html += openBlock('Status Rows', 'fa-list-check');
        (slide.items || []).forEach((item, i) => {
            html += `<div class="bg-[#0b1121] border border-slate-700/50 rounded-lg p-3 mb-3 relative group transition hover:border-slate-500">
                        <div class="absolute -top-2 -right-2 bg-slate-800 hover:bg-red-500 text-slate-400 hover:text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-all border border-slate-600 shadow-md" onclick="removeArrayItem('items', ${i})"><i class="fa-solid fa-trash"></i></div>
                        <div class="flex gap-4 mb-4 mt-2">
                            <div class="flex-grow flex flex-col gap-1.5">
                                <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Status Label</label>
                                <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-2 text-xs text-white outline-none transition-colors" value="${escapeHtml(item.value)}" oninput="updateArrayItem('items', ${i}, 'value', this.value)" placeholder="e.g. DONE">
                            </div>
                            <div class="flex flex-col gap-1.5 w-16">
                                <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Color</label>
                                <input type="color" class="w-full h-8 bg-transparent rounded cursor-pointer border-0 p-0" value="${item.color || '#10B981'}" onchange="updateArrayItem('items', ${i}, 'color', this.value)">
                            </div>
                        </div>
                        ${generateProIconInput('Row Icon', item.icon, `updateArrayItem('items', ${i}, 'icon', this.value)`)}
                     </div>`;
        });
        html += `<button class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors" onclick="addArrayItem('items', {label:'New Item', value:'WAITING', icon:'fa-circle-dot', color:'#F59E0B'})"><i class="fa-solid fa-plus mr-2"></i>Add Row</button>`;
        html += closeBlock;
    }
    else if (slide.type === 'code') {
        html += openBlock('Terminal Settings', 'fa-terminal');
        html += `<div class="flex flex-col gap-2">
                    <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Syntax Color Theme</label>
                    <select class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-2 text-xs text-white outline-none cursor-pointer" onchange="updateSlide('codeColor', this.value)">
                        <option value="text-green-400" ${slide.codeColor === 'text-green-400' ? 'selected' : ''}>Hacker Green</option>
                        <option value="text-blue-400" ${slide.codeColor === 'text-blue-400' ? 'selected' : ''}>Ocean Blue</option>
                        <option value="text-pink-400" ${slide.codeColor === 'text-pink-400' ? 'selected' : ''}>Synthwave Pink</option>
                        <option value="text-yellow-400" ${slide.codeColor === 'text-yellow-400' ? 'selected' : ''}>Warning Yellow</option>
                        <option value="text-white" ${slide.codeColor === 'text-white' ? 'selected' : ''}>Plain White</option>
                    </select>
                 </div>`;
        html += closeBlock;
    }
    else if (slide.type === 'cta') {
        html += openBlock('Hero Visual', 'fa-rocket');
        if (slide.image) {
            html += `<img src="${slide.image}" class="w-full h-24 object-cover rounded-lg border border-slate-700 mb-3 shadow-inner">
                     <button class="w-full bg-red-900/30 hover:bg-red-500 text-red-400 hover:text-white border border-red-900/50 text-xs font-bold py-2 rounded-lg transition" onclick="removeImage('image')">Remove Image</button>`;
        } else {
            html += `${generateProIconInput('Main Icon', slide.icon, "updateSlide('icon', this.value)")}
                     <div class="flex justify-between items-center mb-2 mt-4 border-t border-slate-800 pt-4"><label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Or Upload Image</label><button class="text-[9px] bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-0.5 rounded transition" onclick="injectRandomImage('image')">Random</button></div>
                     <input type="file" class="w-full text-xs text-slate-400 file:bg-slate-800 file:border-0 file:text-white file:px-3 file:py-1.5 file:rounded file:cursor-pointer file:hover:bg-slate-700" accept="image/*" onchange="handleImageUpload(event, 'image')">`;
        }
        html += closeBlock;
    }
    else if (slide.type === 'pitch_stats') {
        html += openBlock('Key Metrics', 'fa-chart-simple');
        (slide.stats || []).forEach((stat, i) => {
            html += `<div class="bg-[#0b1121] border border-slate-700/50 rounded-lg p-3 mb-3 relative group transition hover:border-slate-500">
                        <div class="absolute -top-2 -right-2 bg-slate-800 hover:bg-red-500 text-slate-400 hover:text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-all border border-slate-600 shadow-md" onclick="removeArrayItem('stats', ${i})"><i class="fa-solid fa-trash"></i></div>
                        <div class="flex gap-4 mb-4 mt-2">
                            <div class="flex-grow flex flex-col gap-1.5">
                                <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Value (e.g. 10x)</label>
                                <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-2 text-xs text-white outline-none" value="${escapeHtml(stat.value)}" oninput="updateArrayItem('stats', ${i}, 'value', this.value)">
                            </div>
                            <div class="flex flex-col gap-1.5 w-16">
                                <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Color</label>
                                <input type="color" class="w-full h-8 bg-transparent rounded cursor-pointer border-0 p-0" value="${stat.color || '#3B82F6'}" onchange="updateArrayItem('stats', ${i}, 'color', this.value)">
                            </div>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Label</label>
                            <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-2 text-xs text-white outline-none" value="${escapeHtml(stat.label)}" oninput="updateArrayItem('stats', ${i}, 'label', this.value)">
                        </div>
                     </div>`;
        });
        html += `<button class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors" onclick="addArrayItem('stats', {value:'100', label:'Metric', color:'#3B82F6'})"><i class="fa-solid fa-plus mr-2"></i>Add Metric</button>`;
        html += closeBlock;
    }
    else if (slide.type === 'pitch_timeline') {
        html += openBlock('Timeline Milestones', 'fa-timeline');
        (slide.timeline || []).forEach((item, i) => {
            html += `<div class="bg-[#0b1121] border border-slate-700/50 rounded-lg p-3 mb-3 relative group transition hover:border-slate-500">
                        <div class="absolute -top-2 -right-2 bg-slate-800 hover:bg-red-500 text-slate-400 hover:text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-all border border-slate-600 shadow-md" onclick="removeArrayItem('timeline', ${i})"><i class="fa-solid fa-trash"></i></div>
                        <div class="flex gap-4 mb-4 mt-2">
                            <div class="flex-grow flex flex-col gap-1.5">
                                <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Milestone</label>
                                <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-2 text-xs text-white outline-none" value="${escapeHtml(item.year)}" oninput="updateArrayItem('timeline', ${i}, 'year', this.value)">
                            </div>
                            <div class="flex flex-col gap-1.5 w-16">
                                <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Color</label>
                                <input type="color" class="w-full h-8 bg-transparent rounded cursor-pointer border-0 p-0" value="${item.color || '#3B82F6'}" onchange="updateArrayItem('timeline', ${i}, 'color', this.value)">
                            </div>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                            <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-1.5 text-xs text-white outline-none" value="${escapeHtml(item.text)}" oninput="updateArrayItem('timeline', ${i}, 'text', this.value)">
                        </div>
                     </div>`;
        });
        html += `<button class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors" onclick="addArrayItem('timeline', {year:'2025', text:'Next Phase', color:'#3B82F6'})"><i class="fa-solid fa-plus mr-2"></i>Add Milestone</button>`;
        html += closeBlock;
    }
    else if (slide.type === 'corp_image_text') {
        html += openBlock('Left Visual', 'fa-image');
        if (slide.image) {
            html += `<img src="${slide.image}" class="w-full h-24 object-cover rounded-lg border border-slate-700 mb-3 shadow-inner">
                     <button class="w-full bg-red-900/30 hover:bg-red-500 text-red-400 hover:text-white border border-red-900/50 text-xs font-bold py-2 rounded-lg transition" onclick="removeImage('image')">Remove Image</button>`;
        } else {
            html += `<div class="flex justify-between items-center mb-2"><label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Upload Image</label><button class="text-[9px] bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-0.5 rounded transition" onclick="injectRandomImage('image')">Random</button></div>
                     <input type="file" class="w-full text-xs text-slate-400 file:bg-slate-800 file:border-0 file:text-white file:px-3 file:py-1.5 file:rounded file:cursor-pointer file:hover:bg-slate-700 mb-2" accept="image/*" onchange="handleImageUpload(event, 'image')">`;
        }
        html += closeBlock;

        html += openBlock('Right Editorial Bullets', 'fa-list');
        (slide.bullets || []).forEach((b, i) => {
            html += `<div class="flex justify-between items-center bg-[#0b1121] border border-slate-700/50 rounded-lg p-2 mb-2">
                        <span class="text-xs font-bold text-slate-500 px-2">${i + 1}</span>
                        <button class="text-slate-500 hover:text-red-400 px-2 transition-colors" onclick="removeArrayPrimitive('bullets', ${i})"><i class="fa-solid fa-trash"></i></button>
                     </div>`;
        });
        html += `<button class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors mt-2" onclick="addArrayPrimitive('bullets', 'New editorial point')"><i class="fa-solid fa-plus mr-2"></i>Add Point</button>`;
        html += closeBlock;
    }
    else if (slide.type === 'pitch_hero') {
        html += openBlock('Background Image', 'fa-image');
        if (slide.image) {
            html += `<img src="${slide.image}" class="w-full h-24 object-cover rounded-lg border border-slate-700 mb-3 shadow-inner">
                     <button class="w-full bg-red-900/30 hover:bg-red-500 text-red-400 hover:text-white border border-red-900/50 text-xs font-bold py-2 rounded-lg transition" onclick="removeImage('image')">Remove</button>`;
        } else {
            html += `<div class="flex justify-between items-center mb-2"><label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Upload</label><button class="text-[9px] bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-2 py-0.5 rounded transition" onclick="injectRandomImage('image')">Random</button></div>
                     <input type="file" class="w-full text-xs text-slate-400 file:bg-slate-800 file:border-0 file:text-white file:px-3 file:py-1.5 file:rounded file:cursor-pointer file:hover:bg-slate-700" accept="image/*" onchange="handleImageUpload(event, 'image')">`;
        }
        html += closeBlock;
    }
    else if (slide.type === 'corp_team') {
        html += openBlock('Team Members', 'fa-users');
        (slide.team || []).forEach((member, i) => {
            html += `<div class="bg-[#0b1121] border border-slate-700/50 rounded-lg p-3 mb-3 relative group transition hover:border-slate-500">
                        <div class="absolute -top-2 -right-2 bg-slate-800 hover:bg-red-500 text-slate-400 hover:text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-all border border-slate-600 shadow-md" onclick="removeArrayItem('team', ${i})"><i class="fa-solid fa-trash"></i></div>
                        ${member.image ? `<img src="${member.image}" class="w-16 h-16 object-cover rounded-full mx-auto mb-3 border-2 border-slate-700"> <button class="w-full bg-red-900/30 hover:bg-red-500 text-red-400 hover:text-white border border-red-900/50 text-[10px] font-bold py-1.5 rounded transition mb-3" onclick="removeImage('image', 'team', ${i})">Remove</button>` : `<div class="flex justify-between items-center mb-2"><label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Avatar</label><button class="text-[9px] bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white px-2 py-0.5 rounded transition" onclick="injectRandomImage('image', 'team', ${i})">Random</button></div> <input type="file" class="w-full text-[10px] text-slate-400 file:bg-slate-800 file:border-0 file:text-white file:px-2 file:py-1 file:rounded file:cursor-pointer file:hover:bg-slate-700 mb-3" accept="image/*" onchange="handleImageUpload(event, 'image', 'team', ${i})">`}
                        <div class="flex flex-col gap-1.5 mb-2">
                            <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Name</label>
                            <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-1.5 text-xs text-white outline-none" value="${escapeHtml(member.name)}" oninput="updateArrayItem('team', ${i}, 'name', this.value)">
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Role</label>
                            <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-1.5 text-xs text-white outline-none" value="${escapeHtml(member.role)}" oninput="updateArrayItem('team', ${i}, 'role', this.value)">
                        </div>
                     </div>`;
        });
        html += `<button class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors" onclick="addArrayItem('team', {name:'New Member', role:'Job Title', image:''})"><i class="fa-solid fa-plus mr-2"></i>Add Member</button>`;
        html += closeBlock;
    }
    else if (slide.type === 'pitch_pricing') {
        html += openBlock('Pricing Tiers', 'fa-tags');
        (slide.tiers || []).forEach((tier, i) => {
            html += `<div class="bg-[#0b1121] border border-slate-700/50 rounded-lg p-3 mb-3 relative group transition hover:border-slate-500">
                        <div class="absolute -top-2 -right-2 bg-slate-800 hover:bg-red-500 text-slate-400 hover:text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] cursor-pointer opacity-0 group-hover:opacity-100 transition-all border border-slate-600 shadow-md" onclick="removeArrayItem('tiers', ${i})"><i class="fa-solid fa-trash"></i></div>
                        <div class="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                            <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Highlight this tier?</label>
                            <input type="checkbox" class="cursor-pointer" ${tier.highlight ? 'checked' : ''} onchange="updateArrayItem('tiers', ${i}, 'highlight', this.checked)">
                        </div>
                        <div class="flex gap-3 mb-3">
                            <div class="flex flex-col gap-1.5 w-1/2">
                                <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Plan Name</label>
                                <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-1.5 text-xs text-white outline-none" value="${escapeHtml(tier.name)}" oninput="updateArrayItem('tiers', ${i}, 'name', this.value)">
                            </div>
                            <div class="flex flex-col gap-1.5 w-1/2">
                                <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Price</label>
                                <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-1.5 text-xs text-white outline-none" value="${escapeHtml(tier.price)}" oninput="updateArrayItem('tiers', ${i}, 'price', this.value)">
                            </div>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Main Feature</label>
                            <input type="text" class="w-full bg-[#020617] border border-slate-700 focus:border-blue-500 rounded-md px-3 py-1.5 text-xs text-white outline-none" value="${escapeHtml(tier.feature)}" oninput="updateArrayItem('tiers', ${i}, 'feature', this.value)">
                        </div>
                     </div>`;
        });
        html += `<button class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors" onclick="addArrayItem('tiers', {name:'New Plan', price:'$99', feature:'Description', highlight:false})"><i class="fa-solid fa-plus mr-2"></i>Add Tier</button>`;
        html += closeBlock;
    }
    else {
        html += `<div class="bg-blue-900/20 border border-blue-800 rounded-xl p-4 text-xs text-blue-200 leading-relaxed shadow-inner mb-6"><i class="fa-solid fa-wand-magic-sparkles text-blue-400 mr-2 text-lg float-left"></i> This template is fully editable directly on the slide preview.</div>`;
    }

    // SPEAKER NOTES (Always at bottom)
    html += `
        <div class="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden shadow-sm mt-auto mb-10">
            <div class="bg-slate-800/80 px-4 py-2.5 border-b border-slate-700/50 flex items-center">
                <i class="fa-solid fa-clipboard-user text-purple-400 mr-2 text-xs"></i>
                <span class="text-[0.65rem] font-extrabold uppercase tracking-widest text-slate-300">Speaker Notes</span>
            </div>
            <textarea class="w-full bg-transparent border-0 p-4 text-sm text-slate-300 outline-none hover:bg-white/5 focus:bg-white/5 transition-colors resize-y min-h-[150px] placeholder-slate-600" placeholder="Type your presenter notes here. These sync perfectly to the Speaker View and PPTX exports." oninput="updateSlide('notes', this.value)">${escapeHtml(slide.notes || '')}</textarea>
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
            if (input.getAttribute('oninput') && input.getAttribute('oninput').includes(`'${key}'`)) input.value = val;
        });
    }
}
function handleInlineEditPrimitive(event, arrayName, index) {
    let val = event.target.innerText;
    const slide = slides.find(s => s.id === currentSlideId);
    if (slide && slide[arrayName]) { slide[arrayName][index] = val; saveProjects(); renderEditor(); }
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

    // Enhanced "Empty State" text for existing templates
    if (type === 'intro') { newSlide.subtitle = 'Type your subtitle or presenter name here'; newSlide.icon = 'fa-desktop'; newSlide.tags = []; }
    if (type === 'split') { newSlide.subtitle = 'Explain the core details of this concept in a few sentences here. Click to edit.'; newSlide.bullets = ['Type your first supporting point here', 'Add a secondary detail here']; newSlide.boxTitle = 'Key Takeaway'; newSlide.boxText = 'Summarize the most important metric or outcome here.'; newSlide.boxIcon = 'fa-lightbulb'; }
    if (type === 'grid') { newSlide.subtitle = 'Break down your topic into key areas or features.'; newSlide.cards = [{ title: 'First Feature', text: 'Describe the value proposition here.', icon: 'fa-cube', color: '#3B82F6' }, { title: 'Second Feature', text: 'Highlight a technical advantage here.', icon: 'fa-bolt', color: '#10B981' }]; }
    if (type === 'list') { newSlide.subtitle = 'List out requirements, status flags, or compliance steps.'; newSlide.items = [{ label: 'Define project scope', value: 'DONE', icon: 'fa-check-circle', color: '#10B981' }]; }
    if (type === 'code') { newSlide.subtitle = 'Explain what this code block or configuration does.'; newSlide.codeHeader = 'setup.sh'; newSlide.codeContent = '#!/bin/bash\necho "Start typing your code here"'; newSlide.codeColor = 'text-green-400'; }
    if (type === 'cta') { newSlide.subtitle = 'Tell the audience what action they should take next.'; newSlide.icon = 'fa-rocket'; newSlide.link = 'go.company.com/action'; }

    // Enhanced Empty States & NEW TEMPLATES
    if (type === 'corp_title') { newSlide.subtitle = 'Department or presentation context'; newSlide.author = 'Presenter Name'; newSlide.bgOverride = 'bg-purewhite'; }
    if (type === 'corp_quote') { newSlide.title = 'Type a powerful customer quote or visionary statement here.'; newSlide.author = 'Client Name / Role'; }
    if (type === 'corp_image_text') { newSlide.subtitle = 'Type a detailed editorial description here to support the visual.'; newSlide.bullets = ['First supporting detail', 'Second supporting detail']; }

    // NEW: Title & Content, Team, Pricing
    if (type === 'corp_basic') { newSlide.subtitle = 'Type your comprehensive slide content here. This free-form area is perfect for paragraphs, meeting notes, or extended thoughts.'; newSlide.bgOverride = 'bg-purewhite'; }
    if (type === 'corp_team') { newSlide.subtitle = 'The minds behind the magic.'; newSlide.team = [{ name: 'Jane Doe', role: 'CEO & Founder', image: '' }, { name: 'John Smith', role: 'Lead Developer', image: '' }, { name: 'Alice Jones', role: 'Designer', image: '' }]; }
    if (type === 'pitch_pricing') { newSlide.subtitle = 'Choose the plan that fits your needs.'; newSlide.tiers = [{ name: 'Starter', price: 'Free', feature: 'Basic features', highlight: false }, { name: 'Pro', price: '$29', feature: 'All premium features', highlight: true }, { name: 'Enterprise', price: 'Custom', feature: 'Dedicated support', highlight: false }]; }

    if (type === 'pitch_hero') { newSlide.subtitle = 'State your big visionary idea here.'; }
    if (type === 'pitch_stats') { newSlide.subtitle = 'Highlight your key performance indicators.'; newSlide.stats = [{ value: '99%', label: 'Uptime', color: '#3B82F6' }, { value: '10x', label: 'Growth', color: '#10B981' }]; }
    if (type === 'pitch_timeline') { newSlide.subtitle = 'Showcase your roadmap or history.'; newSlide.timeline = [{ year: '2025', text: 'Launch Phase', color: '#3B82F6' }, { year: '2026', text: 'Scale Operations', color: '#3B82F6' }]; }

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

// --- 🔥 FULL HTML GENERATORS ---
function generateSlideHTML(slide, isExport = false) {
    let animClass = slide.transition || 'fade-in';
    if (!isExport) animClass = 'fade-in';

    let html = '';

    if (slide.type === 'intro') {
        let tagsHtml = (slide.tags || []).map((t, i) => `<span class="flex items-center"><i class="fa-solid ${escapeHtml(t.icon)} mr-2" style="color: ${t.color || 'var(--accent-color)'}"></i>${createEditableTag('span', '', t.text, 'text', 'tags', i)}</span>`).join('');
        html = `
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
        let rightHtml = slide.image ? `<img src="${slide.image}" class="w-full h-80 object-cover rounded-2xl border border-slate-700 shadow-2xl">` : `
            <div class="bg-slate-900 rounded-2xl p-8 border border-slate-800 flex flex-col justify-center items-center text-center h-full shadow-inner relative overflow-hidden w-full">
                <div class="absolute top-0 left-0 w-full h-1" style="background: var(--accent-color)"></div>
                <i class="fa-solid ${escapeHtml(slide.boxIcon)} text-6xl text-slate-600 mb-6 drop-shadow-lg"></i>
                ${createEditableTag('h3', 'text-xl font-bold text-white mb-3 w-full', slide.boxTitle, 'boxTitle')}
                ${createEditableTag('p', 'text-slate-400 leading-relaxed w-full', slide.boxText, 'boxText')}
            </div>`;

        html = `
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
            <div class="p-8 bg-slate-800/40 rounded-xl border text-center relative overflow-hidden transition shadow-lg w-full" style="border-color: color-mix(in srgb, ${c.color || 'var(--accent-color)'} 40%, transparent);">
                ${c.image ? `<img src="${c.image}" class="h-16 w-16 mx-auto object-cover rounded mb-6">` : `<i class="fa-solid ${escapeHtml(c.icon)} text-5xl mb-6 drop-shadow-lg" style="color: ${c.color || 'var(--accent-color)'}"></i>`}
                ${createEditableTag('h4', 'text-xl font-bold text-white mb-3 w-full block', c.title, 'title', 'cards', i)}
                ${createEditableTag('p', 'text-sm text-slate-400 leading-relaxed w-full block', c.text, 'text', 'cards', i)}
            </div>
        `).join('');
        html = `
            <div class="theme-card ${animClass}">
                ${createEditableTag('h2', 'text-4xl font-bold mb-4 w-full text-center', slide.title, 'title')}
                ${createEditableTag('p', 'text-slate-400 mb-10 text-lg w-full text-center block', slide.subtitle, 'subtitle')}
                <div class="grid ${colsClass} gap-8 w-full">${cardsHtml}</div>
            </div>
        `;
    }
    else if (slide.type === 'list') {
        let itemsHtml = (slide.items || []).map((item, i) => `
            <li class="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-md w-full transition hover:bg-slate-700/50">
                <div class="flex items-center w-full"><i class="fa-solid ${escapeHtml(item.icon)} mr-4 text-xl shrink-0" style="color: ${item.color || 'var(--accent-color)'}"></i>${createEditableTag('span', 'text-lg font-semibold w-full block', item.label, 'label', 'items', i)}</div>
                <div class="px-3 py-1 rounded border shadow-inner shrink-0" style="border-color: color-mix(in srgb, ${item.color || 'var(--accent-color)'} 40%, transparent); background: color-mix(in srgb, ${item.color || 'var(--accent-color)'} 10%, transparent); color: ${item.color || 'var(--accent-color)'};">
                    ${createEditableTag('span', 'font-bold uppercase tracking-widest text-xs drop-shadow-md', item.value, 'value', 'items', i)}
                </div>
            </li>
        `).join('');
        html = `
            <div class="theme-card border-l-8 ${animClass}" style="border-left-color: var(--accent-color)">
                ${createEditableTag('h2', 'text-4xl font-bold mb-10 w-full', slide.title, 'title')}
                <div class="grid grid-cols-2 gap-12 items-center w-full">
                    <div class="space-y-6 w-full">
                        ${createEditableTag('p', 'text-xl text-slate-300 mb-6 w-full block', slide.subtitle, 'subtitle')}
                        <ul class="space-y-3 w-full">${itemsHtml}</ul>
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
        html = `
            <div class="theme-card ${animClass}">
                ${createEditableTag('h2', 'text-4xl font-bold mb-4 w-full', slide.title, 'title')}
                ${createEditableTag('p', 'text-slate-400 mb-8 text-lg w-full block', slide.subtitle, 'subtitle')}
                <div class="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden w-full text-left">
                    <div class="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-950">
                        <div class="flex gap-2 mr-4 pointer-events-none"><div class="w-3 h-3 rounded-full bg-red-500"></div><div class="w-3 h-3 rounded-full bg-yellow-500"></div><div class="w-3 h-3 rounded-full bg-green-500"></div></div>
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
        html = `
            <div class="theme-card text-center ${animClass}">
                ${slide.image ? `<img src="${slide.image}" class="h-40 mx-auto object-cover rounded-2xl mb-8 shadow-2xl border border-slate-700">` : `<i class="fa-solid ${escapeHtml(slide.icon)} text-7xl text-white mb-8 drop-shadow-lg"></i>`}
                ${createEditableTag('h2', 'text-6xl font-extrabold mb-6 tracking-tighter w-full', slide.title, 'title')}
                ${createEditableTag('p', 'text-2xl text-slate-400 mb-10 max-w-3xl mx-auto font-light w-full block', slide.subtitle, 'subtitle')}
                ${slide.link ? `<div class="inline-block bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-xl hover:scale-105 transition"><i class="fa-solid fa-link accent-text mr-3 pointer-events-none"></i>${createEditableTag('span', 'text-2xl font-mono text-white font-bold', slide.link, 'link')}</div>` : ''}
            </div>
        `;
    }
    else if (slide.type === 'pitch_stats') {
        let statsHtml = (slide.stats || []).map((stat, i) => `
            <div class="flex flex-col items-center">
                <h3 class="text-7xl font-black mb-2 drop-shadow-lg w-full text-center outline-none" contenteditable="true" onblur="handleInlineEdit(event, 'value', 'stats', ${i})" style="color: ${stat.color || 'var(--accent-color)'}">${escapeHtml(stat.value)}</h3>
                ${createEditableTag('p', 'text-xl text-slate-400 uppercase tracking-widest font-bold w-full text-center block', stat.label, 'label', 'stats', i)}
            </div>
        `).join('');

        html = `
            <div class="w-full max-w-6xl px-12 ${animClass}">
                ${createEditableTag('h2', 'text-5xl font-bold mb-4 w-full text-center', slide.title, 'title')}
                ${createEditableTag('p', 'text-xl text-slate-400 mb-20 w-full text-center block', slide.subtitle, 'subtitle')}
                <div class="flex justify-around items-center w-full">${statsHtml}</div>
            </div>
        `;
    }
    else if (slide.type === 'corp_title') {
        let textColor = slide.bgOverride === 'bg-purewhite' ? 'text-black' : 'text-white';
        let authorColor = slide.bgOverride === 'bg-purewhite' ? 'text-slate-600' : 'text-slate-300';
        html = `
            <div class="w-full max-w-5xl px-12 ${animClass} flex flex-col justify-center items-start text-left h-full">
                <div class="w-24 h-2 mb-10 rounded-full shadow-[0_0_15px_var(--accent-color)]" style="background:var(--accent-color)"></div>
                ${createEditableTag('h1', `text-7xl font-black mb-6 tracking-tight w-full leading-tight ${textColor}`, slide.title, 'title')}
                ${createEditableTag('p', `text-3xl font-light mb-16 w-full block ${authorColor}`, slide.subtitle, 'subtitle')}
                <div class="flex items-center gap-6 mt-auto border-t border-slate-800/50 pt-8 w-full">
                    <div class="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center shadow-lg"><i class="fa-solid fa-user accent-text text-xl"></i></div>
                    ${createEditableTag('span', `text-xl font-semibold tracking-wide w-full block ${textColor}`, slide.author || 'Presenter Name', 'author')}
                </div>
            </div>
        `;
    }
    else if (slide.type === 'corp_quote') {
        let textColor = slide.bgOverride === 'bg-purewhite' ? 'text-black' : 'text-white';
        html = `
            <div class="w-full max-w-6xl text-center px-12 ${animClass} flex flex-col items-center justify-center h-full">
                <i class="fa-solid fa-quote-left text-8xl mb-12 opacity-50 drop-shadow-lg" style="color:var(--accent-color)"></i>
                ${createEditableTag('h2', `text-5xl md:text-6xl font-serif italic mb-16 leading-relaxed w-full block drop-shadow ${textColor}`, slide.title, 'title')}
                <div class="flex items-center justify-center gap-6 w-full">
                    <div class="w-24 h-px bg-slate-600"></div>
                    ${createEditableTag('p', `text-xl uppercase tracking-widest font-bold ${textColor}`, slide.author || 'Author Name', 'author')}
                    <div class="w-24 h-px bg-slate-600"></div>
                </div>
            </div>
        `;
    }
    else if (slide.type === 'corp_image_text') {
        let bulletsHtml = (slide.bullets || []).map((b, i) => `<li class="flex items-start w-full"><div class="w-3 h-3 mt-2.5 mr-5 rounded-full shrink-0 shadow-[0_0_10px_var(--accent-color)]" style="background:var(--accent-color)"></div> ${createEditablePrimitive('span', 'flex-grow w-full block text-slate-300', b, 'bullets', i)}</li>`).join('');
        let leftHtml = slide.image ? `<img src="${slide.image}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-900"><i class="fa-solid fa-image text-8xl mb-4"></i><span class="text-sm font-bold uppercase tracking-widest">Image Placeholder</span></div>`;
        html = `
            <div class="theme-card p-0 overflow-hidden flex h-[650px] max-w-6xl ${animClass} shadow-2xl border-0 ring-1 ring-slate-700/50">
                <div class="w-1/2 h-full relative">
                    ${leftHtml}
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent to-[#0b1121]"></div>
                </div>
                <div class="w-1/2 h-full flex flex-col justify-center p-16 bg-[#0b1121]">
                    ${createEditableTag('h2', 'text-5xl font-extrabold mb-6 w-full text-white tracking-tight', slide.title, 'title')}
                    ${createEditableTag('p', 'text-xl text-slate-400 leading-relaxed mb-10 w-full block font-light', slide.subtitle, 'subtitle')}
                    <ul class="space-y-6 text-lg w-full">${bulletsHtml}</ul>
                </div>
            </div>
        `;
    }
    else if (slide.type === 'pitch_hero') {
        let bgStyle = slide.image ? `background-image: url(${slide.image}); background-size: cover; background-position: center;` : `background: radial-gradient(circle at 50% 50%, var(--accent-color) 0%, #000000 100%);`;
        html = `
            <div class="absolute inset-0 z-0 ${animClass} transition-all duration-700" style="${bgStyle}">
                <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
                <div class="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent"></div>
            </div>
            <div class="relative z-10 w-full max-w-6xl text-center ${animClass} flex flex-col items-center justify-center h-full">
                ${createEditableTag('h1', 'text-7xl md:text-[7rem] font-black mb-8 tracking-tighter w-full drop-shadow-2xl uppercase text-white leading-none', slide.title, 'title')}
                ${createEditableTag('p', 'text-3xl text-slate-200 font-light w-full block drop-shadow-lg max-w-4xl mx-auto', slide.subtitle, 'subtitle')}
            </div>
        `;
    }
    else if (slide.type === 'pitch_timeline') {
        let timeHtml = (slide.timeline || []).map((item, i) => `
            <div class="flex flex-col items-center relative z-10 w-56 group">
                <div class="w-10 h-10 rounded-full border-[6px] border-[#020617] mb-6 shadow-[0_0_20px_var(--accent-color)] transition-transform duration-300 group-hover:scale-125" style="background:${item.color || 'var(--accent-color)'}"></div>
                ${createEditableTag('h4', 'text-3xl font-black text-white mb-3 w-full text-center block drop-shadow-md tracking-tight', item.year, 'year', 'timeline', i)}
                ${createEditableTag('p', 'text-base text-slate-400 w-full text-center block leading-relaxed font-medium', item.text, 'text', 'timeline', i)}
            </div>
        `).join('');
        html = `
            <div class="w-full max-w-6xl px-12 ${animClass} flex flex-col justify-center h-full">
                ${createEditableTag('h2', 'text-6xl font-extrabold mb-6 w-full text-center tracking-tight text-white', slide.title, 'title')}
                ${createEditableTag('p', 'text-2xl text-slate-400 mb-28 w-full text-center block font-light', slide.subtitle, 'subtitle')}
                <div class="relative w-full flex justify-between items-start mt-10">
                    <div class="absolute top-4 left-12 right-12 h-1.5 rounded-full bg-slate-800 z-0"></div>
                    ${timeHtml}
                </div>
            </div>
        `;
    }
    else if (slide.type === 'corp_basic') {
        let textColor = slide.bgOverride === 'bg-purewhite' ? 'text-black' : 'text-white';
        let bodyColor = slide.bgOverride === 'bg-purewhite' ? 'text-slate-600' : 'text-slate-300';
        html = `
            <div class="w-full max-w-5xl px-12 ${animClass} flex flex-col justify-start items-start text-left h-full py-16">
                <div class="w-16 h-1.5 mb-8 rounded-full shadow-[0_0_15px_var(--accent-color)]" style="background:var(--accent-color)"></div>
                ${createEditableTag('h2', `text-5xl font-black mb-10 tracking-tight w-full leading-tight ${textColor}`, slide.title, 'title')}
                ${createEditableTag('p', `text-2xl font-light w-full block leading-relaxed ${bodyColor}`, slide.subtitle, 'subtitle')}
            </div>
        `;
    }
    else if (slide.type === 'corp_team') {
        let teamHtml = (slide.team || []).map((member, i) => `
            <div class="flex flex-col items-center group">
                ${member.image ? `<img src="${member.image}" class="w-40 h-40 rounded-full object-cover mb-6 border-4 shadow-xl transition-transform group-hover:scale-105" style="border-color: var(--accent-color)">` : `<div class="w-40 h-40 rounded-full mb-6 border-4 flex items-center justify-center bg-slate-800 shadow-xl transition-transform group-hover:scale-105" style="border-color: var(--accent-color)"><i class="fa-solid fa-user text-5xl text-slate-500"></i></div>`}
                ${createEditableTag('h4', 'text-2xl font-bold text-white mb-2 w-full text-center block', member.name, 'name', 'team', i)}
                ${createEditableTag('p', 'text-sm text-slate-400 uppercase tracking-widest font-semibold w-full text-center block', member.role, 'role', 'team', i)}
            </div>
        `).join('');
        html = `
            <div class="w-full max-w-6xl px-12 ${animClass} flex flex-col justify-center h-full">
                ${createEditableTag('h2', 'text-5xl font-bold mb-4 w-full text-center text-white', slide.title, 'title')}
                ${createEditableTag('p', 'text-xl text-slate-400 mb-16 w-full text-center block font-light', slide.subtitle, 'subtitle')}
                <div class="flex justify-center gap-16 w-full">${teamHtml}</div>
            </div>
        `;
    }
    else if (slide.type === 'pitch_pricing') {
        let tiersHtml = (slide.tiers || []).map((tier, i) => {
            let isHigh = tier.highlight;
            let bgClass = isHigh ? 'bg-slate-800' : 'bg-slate-900/50';
            let borderClass = isHigh ? `border-2` : 'border';
            let scaleClass = isHigh ? 'scale-105 z-10 shadow-2xl' : 'scale-100 z-0 shadow-lg';
            return `
                <div class="${bgClass} ${borderClass} rounded-2xl p-8 flex flex-col items-center text-center transition-transform ${scaleClass}" style="border-color: ${isHigh ? 'var(--accent-color)' : '#334155'}">
                    ${isHigh ? `<div class="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4 -mt-12 shadow-md" style="background:var(--accent-color)">Most Popular</div>` : ''}
                    ${createEditableTag('h4', 'text-2xl font-bold text-white mb-2 w-full block', tier.name, 'name', 'tiers', i)}
                    ${createEditableTag('div', 'text-5xl font-black text-white mb-6 w-full block tracking-tight', tier.price, 'price', 'tiers', i)}
                    <div class="h-px w-full bg-slate-700 mb-6"></div>
                    ${createEditableTag('p', 'text-slate-400 mb-8 w-full block leading-relaxed', tier.feature, 'feature', 'tiers', i)}
                    <div class="w-full py-3 rounded-lg font-bold text-sm transition-colors border pointer-events-none" style="${isHigh ? 'background:var(--accent-color); color:white; border-color:var(--accent-color);' : 'background:transparent; color:white; border-color:#475569;'}">Get Started</div>
                </div>
            `;
        }).join('');
        html = `
            <div class="w-full max-w-6xl px-12 ${animClass} flex flex-col justify-center h-full">
                ${createEditableTag('h2', 'text-5xl font-bold mb-4 w-full text-center text-white', slide.title, 'title')}
                ${createEditableTag('p', 'text-xl text-slate-400 mb-16 w-full text-center block font-light', slide.subtitle, 'subtitle')}
                <div class="grid grid-cols-${Math.max(1, slide.tiers?.length || 3)} gap-6 w-full items-center">${tiersHtml}</div>
            </div>
        `;
    }
    else {
        html = `<div class="theme-card ${animClass}">${createEditableTag('h2', 'text-4xl font-bold mb-10 w-full', slide.title, 'title')}</div>`;
    }

    // --- NEW: Persistent Company Logo Watermark ---
    if (globalSettings.companyLogo) {
        html += `<img src="${globalSettings.companyLogo}" class="absolute bottom-10 right-12 max-h-12 max-w-[200px] object-contain z-[100] opacity-80 pointer-events-none drop-shadow-lg">`;
    }

    return html;
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