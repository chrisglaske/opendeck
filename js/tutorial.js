// ==========================================
// 3. INTERACTIVE TUTORIAL
// ==========================================
var isTutorialMode = false;
var currentTutStep = 0;
var tutData = [
    { t: "Welcome to OpenDeck", s: "Let's take a quick tour of your new presentation studio.", c: `<div class="text-center"><i class="fa-solid fa-wand-magic-sparkles text-yellow-400 text-5xl mb-4"></i><p class="text-lg">Create beautiful, branded tech talks without writing a single line of code.</p></div>` },
    { t: "1. Data Privacy & Saving", s: "Where do my presentations go?", c: `<div class="flex items-start gap-4 bg-slate-800 p-4 rounded-lg border border-slate-700"><i class="fa-solid fa-hard-drive text-blue-400 text-3xl mt-1 shrink-0"></i><div><p class="mb-2 text-base">Everything is saved automatically in your browser's <strong>Local Storage</strong>.</p><p class="text-red-400 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Warning: If you clear your browser cache, your presentations will be deleted!</p></div></div>` },
    { t: "2. Editing is Magic", s: "Two ways to build.", c: `<div class="flex flex-col gap-3"><div class="bg-slate-800 p-4 rounded-lg border border-slate-700"><h4 class="font-bold text-white mb-1"><i class="fa-solid fa-mouse-pointer text-blue-400 mr-2"></i> 100% Click-to-Edit</h4><p class="text-slate-400">Click any text directly on the slide preview to type onto the slide. The sidebar stays in sync.</p></div><div class="bg-slate-800 p-4 rounded-lg border border-slate-700"><h4 class="font-bold text-white mb-1"><i class="fa-solid fa-sliders text-blue-400 mr-2"></i> The Inspector</h4><p class="text-slate-400">Use the right-hand sidebar to change icons, upload images, and write Speaker Notes.</p></div></div>` },
    { t: "3. Exporting & Presenting", s: "Take it with you.", c: `<div class="grid grid-cols-2 gap-4"><div class="bg-slate-800 p-4 text-center rounded-lg border border-slate-700"><i class="fa-solid fa-play text-green-400 text-3xl mb-3"></i><br><strong class="text-white">Present Now</strong><br><span class="text-xs text-slate-400">Presents instantly in your browser</span></div><div class="bg-slate-800 p-4 text-center rounded-lg border border-slate-700"><i class="fa-solid fa-file-powerpoint text-orange-400 text-3xl mb-3"></i><br><strong class="text-white">Export PPTX</strong><br><span class="text-xs text-slate-400">For Google Slides, includes Notes!</span></div></div>` }
];

function checkTutorial() {
    if (!localStorage.getItem('openDeckTutSeen')) startInteractiveTutorial();
}

function startInteractiveTutorial() {
    if (document.getElementById('dashboardView').style.display !== 'none') {
        const tutId = 'proj_tutorial_123';
        let tutProj = projects.find(p => p.id === tutId);
        if (!tutProj) {
            tutProj = {
                id: tutId, name: 'Tutorial Sandbox', lastModified: Date.now(),
                data: {
                    slideCounter: 1,
                    globalSettings: { theme: '#10B981', font: "'Inter', sans-serif", headerText: 'Interactive Tutorial', headerIcon: 'T' },
                    slides: [{ id: 'slide_123', type: 'split', navName: 'Welcome', title: 'Interactive Guided Tour', subtitle: 'Follow the glowing highlights to learn how to use the builder!', bullets: ['Click any text on the slide to edit it.', 'Changes automatically sync to the Inspector on the right.', 'Everything saves automatically.'], boxTitle: 'Magic Editor', boxText: 'Try clicking me!', boxIcon: 'fa-wand-magic-sparkles', notes: '' }]
                }
            };
            projects.push(tutProj);
            saveProjects(false);
        }
        openProject(tutId);
    }
    isTutorialMode = true;
    currentTutStep = 1;
    document.getElementById('tutOverlay').style.display = 'block';
    showTutStep(1);
}

function advanceTutorial() {
    if (!isTutorialMode) return;
    currentTutStep++;
    if (currentTutStep > 4) endTutorial();
    else showTutStep(currentTutStep);
}

function endTutorial() {
    isTutorialMode = false;
    document.getElementById('tutOverlay').style.display = 'none';
    document.getElementById('tutTooltip').style.display = 'none';
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
    localStorage.setItem('openDeckTutSeen', 'true');
    showModal('tutCompleteModal');
}

function skipTutorial() {
    isTutorialMode = false;
    document.getElementById('tutOverlay').style.display = 'none';
    document.getElementById('tutTooltip').style.display = 'none';
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
    localStorage.setItem('openDeckTutSeen', 'true');

    projects = projects.filter(x => x.id !== 'proj_tutorial_123');
    saveProjects(false);
    returnToDashboard();
}

function finishTutorialCreateNew() {
    hideModal('tutCompleteModal');
    projects = projects.filter(x => x.id !== 'proj_tutorial_123');
    saveProjects(false);
    createNewProject();
}

function finishTutorialDashboard() {
    hideModal('tutCompleteModal');
    projects = projects.filter(x => x.id !== 'proj_tutorial_123');
    saveProjects(false);
    returnToDashboard();
}

function showTutStep(step) {
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
    const tooltip = document.getElementById('tutTooltip');
    tooltip.style.display = 'none';

    setTimeout(() => {
        if (step === 1) positionTooltip(document.getElementById('tutSidebar'), "<strong>1. The Outline</strong><br><br>This is your slide navigator. You can <strong>drag and drop</strong> slides to reorder them, or duplicate/delete them.", "right", 1);
        else if (step === 2) positionTooltip(document.getElementById('previewArea'), "<strong>2. Click-to-Edit</strong><br><br>Editing is magic! Click <strong>ANY text</strong> inside the preview to type directly onto the slide. The Inspector panel stays perfectly in sync.", "top", 2);
        else if (step === 3) positionTooltip(document.getElementById('tutInspector'), "<strong>3. The Inspector</strong><br><br>Use this panel to change slide layouts, pick icons, upload background images, and write Speaker Notes.", "left", 3);
        else if (step === 4) positionTooltip(document.getElementById('tutHeaderControls'), "<strong>4. Exporting</strong><br><br>When you're done, Export to Google Slides/PPTX, PDF, or present directly in your browser!", "bottom-left", 4);
    }, 300);
}

function positionTooltip(targetEl, text, position, step) {
    targetEl.classList.add('tut-highlight');
    const tooltip = document.getElementById('tutTooltip');
    const rect = targetEl.getBoundingClientRect();
    const isLast = step === 4;

    tooltip.innerHTML = `
        <div class="mb-4 text-sm leading-relaxed">${text}</div>
        <div class="flex justify-between items-center mt-2 border-t border-slate-700 pt-3">
            <span class="text-xs text-slate-400 font-bold uppercase tracking-widest">Step ${step} of 4</span>
            <button onclick="${isLast ? 'endTutorial()' : `advanceTutorial()`}" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-xs font-bold transition shadow-lg">${isLast ? 'Finish' : 'Next <i class="fa-solid fa-arrow-right ml-1"></i>'}</button>
        </div>
    `;

    tooltip.style.display = 'block';
    void tooltip.offsetWidth;

    setTimeout(() => {
        const tRect = tooltip.getBoundingClientRect();
        let top = 0, left = 0;

        if (position === 'right') { top = rect.top + 80; left = rect.right + 20; }
        else if (position === 'left') { top = rect.top + 80; left = rect.left - tRect.width - 20; }
        else if (position === 'top') { top = rect.top + 40; left = rect.left + (rect.width / 2) - (tRect.width / 2); }
        else if (position === 'bottom-left') { top = rect.bottom + 20; left = rect.right - tRect.width; }

        left = Math.max(20, Math.min(left, window.innerWidth - tRect.width - 20));
        top = Math.max(20, Math.min(top, window.innerHeight - tRect.height - 20));

        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
    }, 50);
}

// Explicitly expose to window
window.checkTutorial = checkTutorial;
window.startInteractiveTutorial = startInteractiveTutorial;
window.advanceTutorial = advanceTutorial;
window.endTutorial = endTutorial;
window.skipTutorial = skipTutorial;
window.finishTutorialCreateNew = finishTutorialCreateNew;
window.finishTutorialDashboard = finishTutorialDashboard;
window.showTutStep = showTutStep;
window.positionTooltip = positionTooltip;