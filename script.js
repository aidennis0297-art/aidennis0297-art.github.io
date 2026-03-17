document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let state = {
        categories: JSON.parse(localStorage.getItem('categories')) || [
            { id: 'cat_school', name: '학교', color: '#ff3b30' },
            { id: 'cat_life', name: '생활', color: '#34c759' },
            { id: 'cat_project', name: '프로젝트', color: '#5856d6' }
        ],
        tasks: JSON.parse(localStorage.getItem('tasks')) || [],
        victoryLog: JSON.parse(localStorage.getItem('victoryLog')) || [],
        currentView: 'super-routine',
        reward: localStorage.getItem('reward') || '',
        rewardTarget: localStorage.getItem('rewardTarget') || '100',
        editMode: false,
        theme: localStorage.getItem('theme') || 'light'
    };

    const save = () => {
        // Ensure all tasks have a unique order
        let maxOrder = 0;
        state.tasks.forEach(t => { if(t.order > maxOrder) maxOrder = t.order; });
        state.tasks = state.tasks.map(t => ({...t, order: t.order ?? (maxOrder++)}));
        
        localStorage.setItem('categories', JSON.stringify(state.categories));
        localStorage.setItem('tasks', JSON.stringify(state.tasks));
        localStorage.setItem('victoryLog', JSON.stringify(state.victoryLog));
        localStorage.setItem('reward', state.reward);
        localStorage.setItem('rewardTarget', state.rewardTarget);
    };

    const $ = id => document.getElementById(id);
    const esc = s => s ? s.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "";

    // --- DOM ---
    const el = {
        todoList: $('todo-list'), todoInput: $('todo-input'), inputHL: $('input-highlights'),
        addBtn: $('add-btn'), viewTitle: $('current-view-title'), dateDisplay: $('date-display'),
        catList: $('category-list'), addCatBtn: $('add-category-btn'),
        isRoutineCb: $('is-routine-cb'), routineToggle: $('routine-toggle-label'),
        routinePeriod: $('routine-period'), catSelect: $('task-category-select'),
        badgeRoutine: $('badge-routine'), inputWrapper: $('input-wrapper'), 
        rewardInput: $('reward-input'), habitGrid: $('habit-grid'),
        achieveChart: $('achievement-chart'), todayRate: $('today-rate'),
        rewardChip: $('reward-display-chip'), editModeBtn: $('edit-mode-btn'),
        srEditBtn: $('sr-edit-btn'), modal: $('custom-modal'),
        settingsView: $('settings-view'), resetAllBtn: $('reset-all-btn'),
        themeToggleBtn: $('theme-toggle-btn'),
        exportBtn: $('export-btn'), importBtn: $('import-btn'), importFile: $('import-file-input'),
        victoryView: $('victory-log-view'), victoryList: $('victory-list')
    };

    // --- INIT ---
    function init() {
        const defaults = [
            { id: 'cat_school', name: '학교', color: '#ff3b30' },
            { id: 'cat_life', name: '생활', color: '#34c759' },
            { id: 'cat_project', name: '프로젝트', color: '#5856d6' }
        ];
        let hasChanges = false;
        defaults.forEach(d => {
            if (!state.categories.find(c => c.name === d.name)) {
                state.categories.unshift(d);
                hasChanges = true;
            }
        });
        if (hasChanges) save();
        
        el.dateDisplay.textContent = new Date().toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if(el.rewardInput) el.rewardInput.value = state.reward;
        if($('reward-target-rate')) $('reward-target-rate').value = state.rewardTarget;
        
        document.documentElement.setAttribute('data-theme', state.theme);
        updateThemeIcon();
        
        setupEvents();
        renderSidebar();
        setView(state.currentView);
    }
    
    function updateThemeIcon() {
        if (!el.themeToggleBtn) return;
        const icon = el.themeToggleBtn.querySelector('i');
        if (state.theme === 'light') icon.className = 'fas fa-sun';
        else if (state.theme === 'dark') icon.className = 'fas fa-moon';
        else icon.className = 'fas fa-adjust';
    }

    // --- EVENTS ---
    function setupEvents() {
        // Nav items
        document.querySelectorAll('.nav-item').forEach(i => {
           i.onclick = () => setView(i.dataset.view);
        });

        // Toggle collapsible elements
        document.querySelectorAll('.collapsible, .collapsible-card').forEach(h => {
            h.onclick = () => {
                h.classList.toggle('collapsed');
                const target = $(h.dataset.target);
                if (target) target.classList.toggle('hidden');
            };
        });

        // Add Task
        el.addBtn.onclick = (e) => { e.preventDefault(); addTask(); };
        el.todoInput.onkeypress = e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } };
        el.todoInput.oninput = handleHL;

        // Custom Modal Wiring
        $('modal-cancel-btn').onclick = closeModal;
        $('modal-confirm-btn').onclick = submitModal;

        // Add Category
        if (el.addCatBtn) {
            el.addCatBtn.onclick = (e) => {
                e.stopPropagation();
                openPrompt("새 카테고리", "카테고리 이름을 입력하세요", (val) => {
                    if (val && val.trim()) {
                        const id = 'cat_' + Date.now();
                        state.categories.push({ id, name: val.trim(), color: '#8e8e93' });
                        save(); renderSidebar(); setView(id);
                    }
                });
            };
        }

        // Header Rename (Title Click)
        el.viewTitle.onclick = (e) => {
            const v = state.currentView;
            if (['super-routine','history','trash'].includes(v)) return;
            const cat = state.categories.find(c => c.id === v);
            if (!cat) return;
            
            e.stopPropagation();
            const inp = document.createElement('input');
            inp.className = 'inline-rename-header';
            inp.value = cat.name;
            el.viewTitle.innerHTML = '';
            el.viewTitle.appendChild(inp);
            inp.focus();
            
            const commit = () => {
                const val = inp.value.trim();
                if (val && val !== cat.name) {
                    cat.name = val;
                    save(); renderSidebar();
                }
                setView(v); 
            };
            inp.onblur = commit;
            inp.onkeydown = ev => {
                if (ev.key === 'Enter') inp.blur();
                if (ev.key === 'Escape') { inp.value = cat.name; inp.blur(); }
            };
        };

        // Routine Toggle
        el.isRoutineCb.onchange = e => {
            el.routineToggle.classList.toggle('active', e.target.checked);
            el.routinePeriod.classList.toggle('hidden', !e.target.checked);
        };

        // Combined Edit Mode for Super Routine
        const toggleSREdit = (forceEdit) => {
            state.hgEditMode = (forceEdit !== undefined) ? forceEdit : !state.hgEditMode;
            state.editMode = state.hgEditMode; 
            
            if (el.srEditBtn) {
                el.srEditBtn.classList.toggle('active', state.hgEditMode);
                el.srEditBtn.innerHTML = state.hgEditMode ? 
                    '<i class="fas fa-check"></i> 완료' : 
                    '<i class="fas fa-pen"></i> 수정';
            }
            
            if (state.hgEditMode) {
                if ($('reward-input-body')) $('reward-input-body').classList.remove('hidden');
                if ($('reward-display-text')) $('reward-display-text').classList.add('hidden');
            } else {
                renderTasks(); 
            }
            renderSidebar();
            renderHabitGrid();
        };

        if (el.srEditBtn) {
            el.srEditBtn.onclick = (e) => {
                e.stopPropagation(); // Don't collapse the card
                toggleSREdit();
            };
        }
        el.editModeBtn.onclick = () => {
            state.editMode = !state.editMode;
            el.editModeBtn.classList.toggle('active', state.editMode);
            renderSidebar(); renderTasks();
        };

        // Global keydown for shortcuts
        window.onkeydown = e => {
            if (!el.modal.classList.contains('hidden')) {
                if (e.key === 'Escape') closeModal();
                if (e.key === 'Enter') submitModal();
            }
        };

        el.todoInput.onkeydown = e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const isRoutine = el.isRoutineCb.checked;
                const periods = ['daily', 'weekly', 'monthly'];
                const currentPeriod = el.routinePeriod.value;
                const currentIndex = periods.indexOf(currentPeriod);

                if (!isRoutine) {
                    // Turn routine mode ON
                    el.isRoutineCb.checked = true;
                    el.routinePeriod.value = 'daily';
                } else {
                    if (currentIndex < periods.length - 1) {
                        // Cycle to next period
                        el.routinePeriod.value = periods[currentIndex + 1];
                    } else {
                        // Turn routine mode OFF after cycling through all periods
                        el.isRoutineCb.checked = false;
                        el.routinePeriod.value = 'daily'; // Reset to default
                    }
                }
                el.isRoutineCb.dispatchEvent(new Event('change'));
            }
        };

        const saveRewardBtn = $('save-reward-btn');
        if (saveRewardBtn) {
            saveRewardBtn.onclick = () => {
                state.reward = el.rewardInput.value;
                state.rewardTarget = $('reward-target-rate').value;
                save();
                toggleSREdit(false); 
                renderChart();
            };
        }

        // Theme Toggle (Cycle: Light -> Dark -> Mono)
        if (el.themeToggleBtn) {
            el.themeToggleBtn.onclick = () => {
                const themes = ['light', 'dark', 'mono'];
                const idx = themes.indexOf(state.theme);
                state.theme = themes[(idx + 1) % themes.length];
                document.documentElement.setAttribute('data-theme', state.theme);
                localStorage.setItem('theme', state.theme);
                updateThemeIcon();
            };
        }

        // Export / Import
        if (el.exportBtn) {
            el.exportBtn.onclick = () => {
                const data = JSON.stringify(state, null, 2);
                const blob = new Blob([data], {type: "application/json"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `Productivity_Backup_${new Date().toISOString().split('T')[0]}.json`;
                a.click(); URL.revokeObjectURL(url);
            };
        }
        if (el.importBtn) {
            el.importBtn.onclick = () => el.importFile.click();
        }
        if (el.importFile) {
            el.importFile.onchange = (e) => {
                const file = e.target.files[0]; if(!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const imported = JSON.parse(ev.target.result);
                        if (imported.tasks && imported.categories) {
                            state = {...state, ...imported};
                            save(); location.reload();
                        } else { alert("유효한 백업 파일이 아닙니다."); }
                    } catch(err) { alert("파일을 읽는 중 오류가 발생했습니다."); }
                };
                reader.readAsText(file);
            };
        }

        // Reset All Tasks & Categories
        if (el.resetAllBtn) {
            el.resetAllBtn.onclick = () => {
                openConfirm("모든 데이터를 날리고 초기화할까요?", () => {
                    localStorage.clear();
                    state.tasks = [];
                    state.reward = '';
                    state.rewardTarget = '100';
                    state.categories = [
                        { id: 'cat_school', name: '학교', color: '#ff3b30' },
                        { id: 'cat_life', name: '생활', color: '#34c759' },
                        { id: 'cat_project', name: '프로젝트', color: '#5856d6' }
                    ];
                    save();
                    location.reload(); // Hard reset
                });
            };
        }

        // Global list delegation
        el.todoList.onclick = handleListClick;
    }

    // --- MODAL SYSTEM ---
    let modalCb = null;
    function openPrompt(title, placeholder, cb) {
        $('modal-heading').textContent = title;
        $('modal-input').placeholder = placeholder;
        $('modal-input').value = "";
        $('modal-input').type = "text";
        $('modal-input').classList.remove('hidden');
        el.modal.classList.remove('hidden');
        setTimeout(() => $('modal-input').focus(), 50);
        modalCb = cb;
    }

    function openConfirm(title, cb) {
        $('modal-heading').textContent = title;
        $('modal-input').classList.add('hidden');
        el.modal.classList.remove('hidden');
        modalCb = (ok) => { if(ok) cb(); };
    }

    function closeModal() { el.modal.classList.add('hidden'); modalCb = null; }

    function submitModal() {
        if (!modalCb) return;
        const input = $('modal-input');
        const res = input.classList.contains('hidden') ? true : input.value;
        const cb = modalCb;
        closeModal();
        cb(res);
    }

    // --- VIEW LOGIC ---
    function setView(v) {
        state.currentView = v;
        document.querySelectorAll('.nav-item').forEach(i => {
           if (i.dataset.view) i.classList.toggle('active', i.dataset.view === v);
        });
        
        const isSR = v === 'super-routine';
        if ($('sr-extras')) $('sr-extras').classList.toggle('hidden', !isSR);
        
        const isSettings = v === 'settings', isVictory = v === 'victory-log';
        if (el.settingsView) el.settingsView.classList.toggle('hidden', !isSettings);
        if (el.victoryView) el.victoryView.classList.toggle('hidden', !isVictory);
        
        el.todoList.classList.toggle('hidden', isSettings || isVictory);
        
        const isUserCat = !['all', 'super-routine', 'history', 'victory-log', 'trash', 'settings'].includes(v);
        $('edit-view-actions').classList.toggle('hidden', !isUserCat);
        
        // Month/Week Display for Super Routine
        if (isSR) {
            const now = new Date();
            const month = now.getMonth() + 1;
            const week = Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7);
            el.viewTitle.textContent = `🔥 ${month}월 ${week}주차 슈퍼루틴`;
        } else {
            el.viewTitle.textContent = isUserCat ? (state.categories.find(c => c.id === v)?.name || "목록") : { 
                'all': '📚 모아보기', 
                'history': '완료 리마인더', 
                'victory-log': '🏆 성공의 기록', 
                'trash': '휴지통', 
                'settings': '설정' 
            }[v];
        }
        
        el.inputWrapper.style.display = ['history','trash','settings','victory-log'].includes(v) ? 'none' : 'block';
        
        updateDropdown(); renderTasks();
        if (isVictory) renderVictoryLog();
    }

    // --- TASK LOGIC ---
    function addTask() {
        const fullText = el.todoInput.value.trim(); if (!fullText) return;
        const pr = parseDate(fullText);
        let taskText = fullText;
        if (pr.matched) {
            taskText = fullText.replace(pr.matched, '').replace(/\s+/g, ' ').trim();
        }
        if (!taskText) taskText = fullText; // Fallback if entire text was a date

        const newOrder = state.tasks.length ? Math.max(...state.tasks.map(t => t.order || 0)) + 1 : 0;
        state.tasks.push({
            id: Date.now().toString(), text: taskText, categoryId: el.catSelect.value || 'cat_life',
            status: 'active', isRoutine: el.isRoutineCb.checked,
            recurrence: el.isRoutineCb.checked ? el.routinePeriod.value : null,
            dueDate: pr.targetDate ? pr.targetDate.toISOString() : null,
            order: newOrder, createdAt: new Date().toISOString()
        });
        save(); el.todoInput.value = ""; el.inputHL.innerHTML = ""; renderTasks(); updateBadges();
    }

    function handleListClick(e) {
        const item = e.target.closest('.todo-item'); if (!item) return;
        const id = item.dataset.id, t = state.tasks.find(x => x.id === id); if (!t) return;
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act) return;

        if (act === 'complete') completeTask(t);
        else if (act === 'delete') { t.status = 'deleted'; save(); renderTasks(); updateBadges(); }
        else if (act === 'restore') {
            if (t.isRoutineHistory) {
                // For routine completions, "restore" means removing the completion record (unchecking it)
                state.tasks = state.tasks.filter(x => x.id !== id);
            } else {
                t.status = 'active';
            }
            save(); renderTasks(); updateBadges();
        }
        else if (act === 'harddelete') { openConfirm("영구 삭제할까요?", () => { state.tasks = state.tasks.filter(x => x.id !== id); save(); renderTasks(); }); }
        else if (act === 'move') { moveTask(id, e.target.closest('[data-act]').dataset.dir); }
        else if (act === 'edit-text') inlineEdit(item, t);
        else if (act === 'share') shareTask(t);
        else if (act === 'gcal') addToGoogleCalendar(t);
        else if (act === 'ics') exportToICS(t);
    }

    function inlineEdit(li, t) {
        const span = li.querySelector('.todo-text');
        if (!span) return;
        const input = document.createElement('input');
        input.className = 'inline-edit-input';
        input.value = t.text;
        span.replaceWith(input);
        input.focus();
        input.onblur = () => { 
            const val = input.value.trim();
            if (val !== t.text) {
                t.text = val || t.text; 
                save(); 
            }
            renderTasks(); 
        };
        input.onkeydown = e => { if (e.key === 'Enter') input.blur(); if(e.key==='Escape'){ input.value=t.text; input.blur(); }};
    }

    function completeTask(t) {
        const now = new Date();
        if (t.isRoutine) {
            const ts = now.toDateString();
            const existing = state.tasks.find(x => x.originalRoutineId === t.id && x.status === 'completed' && new Date(x.completedAt).toDateString() === ts);
            
            if (existing) {
                // Toggle OFF
                state.tasks = state.tasks.filter(x => x.id !== existing.id);
            } else {
                // Toggle ON
                state.tasks.push({
                    ...t, id: Date.now().toString() + 'h', originalRoutineId: t.id,
                    status: 'completed', completedAt: now.toISOString(), isRoutineHistory: true
                });
                
                // Update master routine date to next occurrence if this is the "official" completion
                // (Optional: usually routines advance automatically when one is completed)
                let next = t.dueDate ? new Date(t.dueDate) : new Date();
                const advance = () => {
                    if (t.recurrence === 'daily') next.setDate(next.getDate() + 1);
                    else if (t.recurrence === 'weekly') next.setDate(next.getDate() + 7);
                    else if (t.recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
                };
                if (next <= now) advance();
                t.dueDate = next.toISOString();
            }
        } else {
            t.status = 'completed'; t.completedAt = now.toISOString();
            // "Check one, create one"
            if (!t.isRoutine && !['history','trash','settings','super-routine'].includes(state.currentView)) {
                const newOrder = state.tasks.length ? Math.max(...state.tasks.map(x => x.order || 0)) + 1 : 0;
                const newTask = {
                    id: Date.now().toString() + 'n', text: '', categoryId: t.categoryId,
                    status: 'active', isRoutine: false, order: newOrder, createdAt: new Date().toISOString()
                };
                state.tasks.push(newTask);
                save();
                renderTasks();
                setTimeout(() => {
                    const newItemEl = el.todoList.querySelector(`[data-id="${newTask.id}"]`);
                    if (newItemEl) inlineEdit(newItemEl, newTask);
                }, 50);
                return;
            }
        }
        save(); renderTasks(); updateBadges();
    }

    function moveTask(id, dir) {
        let pool = getPool(); 
        // We need to sort by ACTUAL order in the data, not just the filtered view.
        // But for UI movement, we swap positions within the current view's sorted list.
        const idx = pool.findIndex(x => x.id === id);
        const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (swapIdx >= 0 && swapIdx < pool.length) {
            const currentOrder = pool[idx].order;
            const targetOrder = pool[swapIdx].order;
            pool[idx].order = targetOrder;
            pool[swapIdx].order = currentOrder;
            
            // In case orders are same, force a gap
            if (pool[idx].order === pool[swapIdx].order) {
                pool[idx].order = (dir === 'up') ? targetOrder - 1 : targetOrder + 1;
            }
            
            save(); renderTasks();
        }
    }

    function shareTask(t) {
        if (!navigator.share) {
            alert("이 브라우저에서는 공유 기능을 지원하지 않습니다.");
            return;
        }
        navigator.share({
            title: t.text,
            text: `[Productivity] ${t.text}${t.dueDate ? '\n마감: ' + new Date(t.dueDate).toLocaleDateString() : ''}`,
        }).catch(console.error);
    }

    function addToGoogleCalendar(t) {
        const title = encodeURIComponent(t.text);
        let dates = '';
        if (t.dueDate) {
            const d = new Date(t.dueDate);
            const start = d.toISOString().replace(/-|:|\.\d\d\d/g, "");
            const end = new Date(d.getTime() + 60*60*1000).toISOString().replace(/-|:|\.\d\d\d/g, "");
            dates = `&dates=${start}/${end}`;
        }
        const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}${dates}&details=Created+via+Productivity+App`;
        window.open(url, '_blank');
    }

    function exportToICS(t) {
        const start = t.dueDate ? new Date(t.dueDate) : new Date();
        const end = new Date(start.getTime() + 60*60*1000);
        const fmt = d => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
        
        const icsMsg = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "BEGIN:VEVENT",
            `DTSTART:${fmt(start)}`,
            `DTEND:${fmt(end)}`,
            `SUMMARY:${t.text}`,
            "DESCRIPTION:Created via Productivity App",
            "END:VEVENT",
            "END:VCALENDAR"
        ].join("\r\n");

        const blob = new Blob([icsMsg], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${t.text.replace(/[/\\?%*:|"<>]/g, '-')}.ics`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function getPool() {
        const v = state.currentView;
        if (v === 'all') {
            return state.tasks
                .filter(t => t.status === 'active' && !t.isRoutineHistory)
                .sort((a,b) => {
                    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                    if (da !== db) return da - db;
                    return (a.order || 0) - (b.order || 0);
                });
        }
        if (v === 'super-routine') return state.tasks.filter(t => t.status === 'active' && t.isRoutine && !t.isRoutineHistory).sort((a,b) => (a.order||0) - (b.order||0));
        if (v === 'history') return state.tasks.filter(t => t.status === 'completed').sort((a,b) => new Date(b.completedAt) - new Date(a.completedAt));
        if (v === 'trash') return state.tasks.filter(t => t.status === 'deleted').sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        return state.tasks.filter(t => t.status === 'active' && t.categoryId === v && !t.isRoutineHistory).sort((a,b) => (a.order||0) - (b.order||0));
    }

    // --- RENDERING ---
    function renderTasks() {
        el.todoList.innerHTML = '';
        const pool = getPool();
        
        if (state.currentView === 'all') {
            const now = new Date(); now.setHours(0,0,0,0);
            const tmr = new Date(now); tmr.setDate(now.getDate() + 1);
            const dat = new Date(now); dat.setDate(now.getDate() + 2);

            // Separate routines from one-off tasks
            const tasks = pool.filter(t => !t.isRoutine);
            const routines = pool.filter(t => t.isRoutine);

            const urgent = [], warning = [], others = [];
            tasks.forEach(t => {
                if (!t.dueDate) others.push(t);
                else {
                    const d = new Date(t.dueDate);
                    if (d <= tmr) urgent.push(t);
                    else if (d.toDateString() === dat.toDateString()) warning.push(t);
                    else others.push(t);
                }
            });

            // Two-column layout
            let leftCol = '';
            if (urgent.length) {
                leftCol += `<div class="history-cat-header urgent"><i class="fas fa-exclamation-circle"></i> 내일까지</div>`;
                urgent.forEach(t => leftCol += tHTML(t));
            }
            if (warning.length) {
                leftCol += `<div class="history-cat-header warning"><i class="fas fa-clock"></i> 모레까지</div>`;
                warning.forEach(t => leftCol += tHTML(t));
            }
            if (others.length) {
                leftCol += `<div class="history-cat-header others"><i class="fas fa-calendar-alt"></i> 나머지 일정</div>`;
                others.forEach(t => leftCol += tHTML(t));
            }
            if (!tasks.length) {
                leftCol = `<div class="empty-state"><i class="fas fa-check-circle"></i><p>할 일 없음</p></div>`;
            }

            // Routines column
            let rightCol = '';
            if (routines.length) {
                const todayStr = new Date().toDateString();
                const done = routines.filter(r => state.tasks.some(x => x.originalRoutineId === r.id && x.status === 'completed' && new Date(x.completedAt).toDateString() === todayStr));
                const notDone = routines.filter(r => !done.includes(r));
                if (notDone.length) {
                    rightCol += `<div class="history-cat-header"><i class="fas fa-sync-alt" style="color:var(--purple)"></i> 오늘의 루틴</div>`;
                    notDone.forEach(t => rightCol += tHTML(t));
                }
                if (done.length) {
                    rightCol += `<div class="history-cat-header" style="color:var(--green)"><i class="fas fa-check-double"></i> 완료된 루틴</div>`;
                    done.forEach(t => rightCol += tHTML(t));
                }
            } else {
                rightCol = `<div class="empty-state"><i class="fas fa-bolt"></i><p>루틴 없음</p></div>`;
            }

            el.todoList.innerHTML = `
                <div class="all-view-grid">
                    <div class="all-col">
                        <div class="all-col-title"><i class="fas fa-tasks"></i> 할 일</div>
                        ${leftCol}
                    </div>
                    <div class="all-col">
                        <div class="all-col-title"><i class="fas fa-sync-alt"></i> 루틴</div>
                        ${rightCol}
                    </div>
                </div>`;
            return;
        }

        if (state.currentView === 'history') {
             state.categories.forEach(c => {
                 const items = pool.filter(x => x.categoryId === c.id);
                 if (items.length) {
                     el.todoList.innerHTML += `<div class="history-cat-header">${esc(c.name)}</div>`;
                     items.forEach(t => el.todoList.innerHTML += tHTML(t));
                 }
             });
        } else {
            if (!pool.length) {
                el.todoList.innerHTML = `<div class="empty-state"><i class="fas fa-ghost"></i><p>비어 있음</p></div>`;
            } else {
                pool.forEach(t => el.todoList.innerHTML += tHTML(t));
            }
        }

        if (state.currentView === 'super-routine' || state.currentView === 'weekly-goal') {
            renderHabitGrid(); renderChart();
            const hasGoal = state.reward && state.reward.trim() !== "";
            const isEditing = state.hgEditMode;
            const showCert = hasGoal && !isEditing;
            
            if ($('reward-input-body')) $('reward-input-body').classList.toggle('hidden', showCert);
            if ($('reward-display-text')) $('reward-display-text').classList.toggle('hidden', !showCert);
            if (showCert) {
                if ($('target-rate-val')) $('target-rate-val').textContent = state.rewardTarget;
                if ($('current-reward-val')) $('current-reward-val').textContent = state.reward;
            } else if (!isEditing) {
                if ($('reward-input-body')) $('reward-input-body').classList.remove('hidden');
                if ($('reward-display-text')) $('reward-display-text').classList.add('hidden');
            }
        }
    }

    function tHTML(t) {
        const isDone = t.status === 'completed';
        const isSR = state.currentView === 'super-routine';
        let meta = '';
        if (t.isRoutine && !t.isRoutineHistory) meta += `<span class="meta-tag routine"><i class="fas fa-sync-alt"></i> 루틴</span>`;
        
        // Hide "until tomorrow" labels for daily routines
        if (t.dueDate && !isDone && !t.isRoutine) {
            const d = new Date(t.dueDate), now = new Date(); now.setHours(0,0,0,0);
            const tmr = new Date(now); tmr.setDate(now.getDate() + 1);
            const dat = new Date(now); dat.setDate(now.getDate() + 2);
            const overdue = d < now;
            const isToday = d.toDateString() === now.toDateString();
            const isTmr = d.toDateString() === tmr.toDateString();
            const isDat = d.toDateString() === dat.toDateString();
            
            let label = d.toLocaleDateString('ko-KR',{month:'short',day:'numeric'});
            let cls = '';
            if (isToday) { label = '오늘까지'; cls = 'overdue'; }
            else if (isTmr) { label = '내일까지'; cls = 'overdue'; }
            else if (isDat) { label = '모레까지'; cls = 'warning'; }
            else if (overdue) { cls = 'overdue'; }
            meta += `<span class="meta-tag ${cls}"><i class="far fa-calendar"></i> ${label}</span>`;
        }
        
        let cbStatus = '';
        if (t.isRoutine && !t.isRoutineHistory) {
            // For active routines, check if completed TODAY — works in ALL views
            const checked = state.tasks.some(x => x.originalRoutineId === t.id && x.status === 'completed' && new Date(x.completedAt).toDateString() === new Date().toDateString());
            if (checked) cbStatus = 'cb-done';
        } else if (isDone) cbStatus = 'cb-done';

        let glowClass = '';
        if (t.dueDate && !isDone && !t.isRoutine) {
            const d = new Date(t.dueDate), now = new Date(); now.setHours(0,0,0,0);
            const tmr = new Date(now); tmr.setDate(now.getDate() + 1);
            if (d.toDateString() === tmr.toDateString()) {
                glowClass = 'glow-red';
            }
        }

        let acts = '';
        if (state.editMode) {
            acts = `
            <div class="item-actions visible">
                <button class="act-btn" data-act="move" data-dir="up"><i class="fas fa-chevron-up"></i></button>
                <button class="act-btn" data-act="move" data-dir="down"><i class="fas fa-chevron-down"></i></button>
                <button class="act-btn del" data-act="delete"><i class="fas fa-trash"></i></button>
            </div>`;
        } else {
            let inner = '';
            if (t.status === 'completed' || t.status === 'deleted') {
                inner += `<button class="act-btn restore-btn" data-act="restore" title="복구"><i class="fas fa-undo"></i></button>`;
            }
            if (t.status === 'deleted') {
                inner += `<button class="act-btn del" data-act="harddelete" title="영구 삭제"><i class="fas fa-times"></i></button>`;
            } else {
                if (!isDone) {
                    inner += `<button class="act-btn" data-act="share" title="공유하기"><i class="fas fa-share-alt"></i></button>`;
                    inner += `<button class="act-btn" data-act="gcal" title="구글 캘린더 추가"><i class="fab fa-google"></i></button>`;
                    inner += `<button class="act-btn" data-act="ics" title="ICS 저장"><i class="far fa-calendar-plus"></i></button>`;
                }
                inner += `<button class="act-btn del" data-act="delete" title="삭제"><i class="fas fa-trash"></i></button>`;
            }
            acts = `<div class="item-actions">${inner}</div>`;
        }

        return `<li class="todo-item ${isDone?'completed':''} ${glowClass}" data-id="${t.id}">
            <div class="cb-wrap"><div class="cb ${cbStatus}" data-act="complete"><i class="fas fa-check"></i></div></div>
            <div class="todo-content">
                <div class="todo-text" data-act="edit-text">${esc(t.text)}</div>
                <div class="todo-meta">${meta}</div>
            </div>
            ${acts}
        </li>`;
    }

    function renderSidebar() {
        if (!el.catList) return;
        el.catList.innerHTML = '';
        state.categories.forEach((c) => {
            const li = document.createElement('li');
            li.className = `nav-item ${state.currentView === c.id ? 'active' : ''}`;
            li.setAttribute('data-view', c.id);
            li.innerHTML = `
                <div class="cat-icon-trigger" style="color:${c.color || '#8e8e93'}"><i class="fas fa-folder"></i></div>
                <span class="cat-label">${esc(c.name)}</span>
                <div class="cat-actions ${state.editMode ? '' : 'hidden-actions'}">
                    <button class="cat-btn" data-act="up"><i class="fas fa-chevron-up"></i></button>
                    <button class="cat-btn" data-act="down"><i class="fas fa-chevron-down"></i></button>
                    <button class="cat-btn cat-del" data-act="del"><i class="fas fa-times"></i></button>
                </div>`;
            
            li.onclick = (e) => { if(!state.editMode) setView(c.id); };
            li.querySelector('.cat-icon-trigger').onclick = (e) => { e.stopPropagation(); handleColorPicker(c); };
            
            li.querySelector('.cat-label').onclick = e => {
                if(!state.editMode) return;
                e.stopPropagation();
                const cur = c.name;
                const inp = document.createElement('input'); 
                inp.className='sidebar-rename-input'; inp.value = cur;
                e.target.replaceWith(inp); inp.focus();
                
                const done = () => {
                    const n = inp.value.trim();
                    if (n && n !== cur) { c.name = n; save(); }
                    renderSidebar();
                    if (state.currentView === c.id) setView(c.id);
                };
                inp.onblur = done;
                inp.onkeydown = ev => { if(ev.key==='Enter') inp.blur(); if(ev.key==='Escape'){ inp.value=cur; inp.blur(); }};
            };
            
            li.querySelectorAll('.cat-btn').forEach(b => b.onclick = e => {
                e.stopPropagation(); 
                const act = b.dataset.act, i = state.categories.indexOf(c);
                if (act === 'del') {
                    openConfirm(`"${c.name}" 삭제?`, () => {
                        state.categories.splice(i, 1);
                        state.tasks.forEach(t => { if(t.categoryId === c.id) t.categoryId = state.categories[0].id; });
                        if(state.currentView === c.id) setView('super-routine');
                        save(); renderSidebar();
                    });
                } else {
                    const si = act === 'up' ? i-1 : i+1;
                    if(si>=0 && si<state.categories.length) {
                        [state.categories[i], state.categories[si]] = [state.categories[si], state.categories[i]];
                        save(); renderSidebar();
                    }
                }
            });
            el.catList.appendChild(li);
        });
        updateDropdown();
    }

    function updateDropdown() {
        if (!el.catSelect) return;
        el.catSelect.innerHTML = '';
        state.categories.forEach(c => el.catSelect.innerHTML += `<option value="${c.id}">${esc(c.name)}</option>`);
        if (state.categories.find(c => c.id === state.currentView)) el.catSelect.value = state.currentView;
        else if (state.categories.length) el.catSelect.value = state.categories[0].id;
    }

    function updateBadges() {
        const due = state.tasks.filter(t => t.status === 'active' && t.isRoutine && !t.isRoutineHistory).length;
        if (el.badgeRoutine) el.badgeRoutine.textContent = due;
    }

    function handleColorPicker(cat) {
        const colors = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#5856d6', '#af52de', '#ff2d55'];
        cat.color = colors[(colors.indexOf(cat.color) + 1) % colors.length];
        save(); renderSidebar();
    }

    function parseDate(text) {
        const today = new Date(); today.setHours(0,0,0,0);
        const days = ['일','월','화','수','목','금','토'];
        let t = null, m = null;
        
        // Updated to handle optional '까지' and '언제까지'
        const regs = [
            /(오늘|내일|모레)(까지)?/, 
            /((이번주|다음주)\s*([월화수목금토일])요일?)(까지)?/,
            /((\d+)월\s*(\d+)일)(까지)?/,
            /언제까지/
        ];
        
        for(let r of regs) {
            const match = text.match(r);
            if (match) {
                m = match[0];
                const base = match[1];
                
                if (m === '언제까지') {
                    // Just match it so it gets removed from text, but no date set
                    t = null;
                } else if (base === '오늘' || m === '오늘') t = new Date(today);
                else if (base === '내일' || m === '내일') { t = new Date(today); t.setDate(today.getDate()+1); }
                else if (base === '모레' || m === '모레') { t = new Date(today); t.setDate(today.getDate()+2); }
                else if (match[3]) { // week match
                    const dayName = match[3];
                    const diff = (days.indexOf(dayName) - today.getDay() + 7) % 7 || 7;
                    t = new Date(today); t.setDate(today.getDate() + diff + (match[2]==='다음주'?7:0));
                } else if (match[3]) { // month/day match - wait, indices shift
                    // Re-evaluating indices for month/day
                }
                
                // Simplified logic to avoid index confusion with nested groups
                if (m.includes('오늘')) t = new Date(today);
                else if (m.includes('내일')) { t = new Date(today); t.setDate(today.getDate()+1); }
                else if (m.includes('모레')) { t = new Date(today); t.setDate(today.getDate()+2); }
                else if (m.includes('이번주') || m.includes('다음주')) {
                    const dayMatch = m.match(/[월화수목금토일]/);
                    if (dayMatch) {
                        const diff = (days.indexOf(dayMatch[0]) - today.getDay() + 7) % 7 || 7;
                        t = new Date(today); t.setDate(today.getDate() + diff + (m.includes('다음주')?7:0));
                    }
                } else {
                    const mdMatch = m.match(/(\d+)월\s*(\d+)일/);
                    if (mdMatch) {
                        t = new Date(today); t.setMonth(parseInt(mdMatch[1])-1); t.setDate(parseInt(mdMatch[2]));
                    }
                }
                break;
            }
        }
        return { targetDate: t, matched: m };
    }

    function handleHL() {
        const v = el.todoInput.value; const pr = parseDate(v);
        if (pr.matched) {
            const i = v.indexOf(pr.matched);
            const isUrgent = pr.matched.includes('내일') || pr.matched.includes('오늘');
            const cls = isUrgent ? 'highlight-bg-red' : 'highlight-bg';
            el.inputHL.innerHTML = esc(v.substring(0, i)) + `<span class="${cls}">${esc(pr.matched)}</span>` + esc(v.substring(i+pr.matched.length));
        } else el.inputHL.innerHTML = esc(v);
    }

    function renderHabitGrid() {
        if (!el.habitGrid) return;
        el.habitGrid.innerHTML = '';
        
        // Define "Perfect Week" as Mon-Sun
        const now = new Date();
        const startOfThisWeek = new Date(now);
        const day = now.getDay(); // 0:Sun, 1:Mon
        const diff = (day === 0 ? -6 : 1) - day; // diff to Mon
        startOfThisWeek.setDate(now.getDate() + diff);
        startOfThisWeek.setHours(0,0,0,0);

        // Update week label
        const month = now.getMonth() + 1;
        const weekOfMonth = Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7);
        const weekLabel = $('hg-week-label');
        if (weekLabel) weekLabel.textContent = `${month}월 ${weekOfMonth}주차 체크포인트`;

        const days = []; 
        for(let i=0; i<7; i++) {
            const d = new Date(startOfThisWeek);
            d.setDate(startOfThisWeek.getDate() + i);
            days.push(d);
        }
        
        let h = `<div class="hg-row hg-header"><div class="hg-label">이번 주 계획</div>`;
        days.forEach(d => h += `<div class="hg-cell-hdr ${d.toDateString()===new Date().toDateString()?'today':''}">${['월','화','수','목','금','토','일'][days.indexOf(d)]}</div>`);
        el.habitGrid.innerHTML = h + '</div>';
        
        const routines = getPool().filter(r => r.recurrence !== 'monthly');
        routines.forEach(r => {
            const isWeekly = r.recurrence === 'weekly';
            const delBtn = state.hgEditMode ? `<i class="fas fa-minus-circle hg-del-btn" data-rid="${r.id}"></i>` : '';
            const typeBadge = isWeekly ? `<span class="hg-type-badge">주간</span>` : '';
            let row = `<div class="hg-row"><div class="hg-label">${delBtn}${typeBadge}${esc(r.text)}</div>`;
            const weekCompletion = isWeekly && state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && days.some(d => new Date(t.completedAt).toDateString() === d.toDateString()));

            days.forEach(day => {
                const dayDone = state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt).toDateString() === day.toDateString());
                const done = isWeekly ? weekCompletion : dayDone;
                row += `<div class="hg-cell ${done?'done':''}" data-rid="${r.id}" data-day="${day.toISOString()}" data-weekly="${isWeekly}">${done?'<i class="fas fa-check"></i>':''}</div>`;
            });
            el.habitGrid.innerHTML += row + '</div>';
        });

        // Check for Perfect Week (Only if Sun has passed or all checked)
        // Let's check current progress
        if (routines.length > 0) {
            const allChecked = routines.every(r => days.every(d => state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt).toDateString() === d.toDateString())));
            const weekKey = startOfThisWeek.toISOString();
            if (allChecked && !state.victoryLog.some(l => l.weekKey === weekKey)) {
                state.victoryLog.push({
                    id: Date.now(),
                    type: 'perfect-week',
                    title: '완벽한 일주일 달성!',
                    date: weekKey,
                    weekKey: weekKey,
                    badge: 'PERFECT WEEK'
                });
                save();
            }
        }

        el.habitGrid.querySelectorAll('.hg-cell').forEach(cell => {
            cell.onclick = () => {
                const rid = cell.dataset.rid, ds = new Date(cell.dataset.day).toDateString();
                const isWeekly = cell.dataset.weekly === 'true';
                
                if (isWeekly) {
                    // For weekly, if ANY day in THIS week is completed, remove all completions for this week
                    const weekStarts = new Date(days[0]); weekStarts.setHours(0,0,0,0);
                    const weekEnds = new Date(days[6]); weekEnds.setHours(23,59,59,999);
                    
                    const completionsInWeek = state.tasks.filter(t => t.originalRoutineId === rid && t.status === 'completed' && new Date(t.completedAt) >= weekStarts && new Date(t.completedAt) <= weekEnds);
                    
                    if (completionsInWeek.length > 0) {
                        state.tasks = state.tasks.filter(t => !completionsInWeek.includes(t));
                    } else {
                        const rt = state.tasks.find(x => x.id === rid);
                        state.tasks.push({ ...rt, id: Date.now()+'h', originalRoutineId: rid, status: 'completed', completedAt: new Date(cell.dataset.day).toISOString(), isRoutineHistory: true });
        el.habitGrid.querySelectorAll('.hg-del-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const rid = btn.dataset.rid;
                openConfirm('이 루틴을 완전히 삭제할까요?', () => {
                    state.tasks = state.tasks.filter(t => t.id !== rid && t.originalRoutineId !== rid);
                    save(); renderHabitGrid(); renderTasks();
                });
            };
        });
    }
                } else {
                    const ex = state.tasks.find(t => t.originalRoutineId === rid && t.status === 'completed' && new Date(t.completedAt).toDateString() === ds);
                    if(ex) state.tasks = state.tasks.filter(x => x.id !== ex.id);
                    else {
                        const rt = state.tasks.find(x => x.id === rid);
                        state.tasks.push({ ...rt, id: Date.now()+'h', originalRoutineId: rid, status: 'completed', completedAt: new Date(cell.dataset.day).toISOString(), isRoutineHistory: true });
                    }
                }
                save(); renderTasks();
            };
        });
    }

    function renderVictoryLog() {
        if (!el.victoryView) return;
        $('perfect-weeks-count').textContent = state.victoryLog.filter(l => l.type === 'perfect-week').length;
        $('total-routines-checked').textContent = state.tasks.filter(t => t.isRoutineHistory && t.status === 'completed').length;

        el.victoryList.innerHTML = '';
        if (!state.victoryLog.length) {
            el.victoryList.innerHTML = `<div class="empty-state"><p>아직 기록된 영광의 순간이 없습니다.</p></div>`;
            return;
        }

        state.victoryLog.slice().reverse().forEach(log => {
            const d = new Date(log.date);
            const dateStr = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
            el.victoryList.innerHTML += `
                <div class="victory-entry">
                    <div class="v-icon"><i class="fas fa-crown"></i></div>
                    <div class="v-info">
                        <div class="v-title">${esc(log.title)}</div>
                        <div class="v-date">${dateStr}</div>
                    </div>
                    <div class="v-badge">${esc(log.badge)}</div>
                </div>
            `;
        });
    }

    function renderChart() {
        if (!el.achieveChart) return;
        const can = el.achieveChart, ctx = can.getContext('2d'), dpr = window.devicePixelRatio || 1;
        const rect = can.getBoundingClientRect(); if(!rect.width) return;
        can.width = rect.width * dpr; can.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const W = rect.width, H = rect.height;
        ctx.clearRect(0,0,W,H);

        const now = new Date();
        const startOfThisWeek = new Date(now);
        const day = now.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        startOfThisWeek.setDate(now.getDate() + diff);
        startOfThisWeek.setHours(0,0,0,0);
        
        const days = []; for(let i=0; i<7; i++){ const d = new Date(startOfThisWeek); d.setDate(startOfThisWeek.getDate() + i); days.push(d); }
        
        const pool = state.tasks.filter(t => t.status === 'active' && t.isRoutine && !t.isRoutineHistory && t.recurrence !== 'monthly');
        const rates = days.map(day => {
            if(!pool.length) return 0;
            const ds = day.toDateString();
            const doneCount = pool.filter(r => {
                if (r.recurrence === 'weekly') {
                    // Check if completed ANY day during THIS week (days[0] to days[6])
                    const start = new Date(days[0]); start.setHours(0,0,0,0);
                    const end = new Date(days[6]); end.setHours(23,59,59,999);
                    return state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt) >= start && new Date(t.completedAt) <= end);
                } else {
                    return state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt).toDateString() === ds);
                }
            }).length;
            return (doneCount / pool.length) * 100;
        });

        const weeklyAvg = rates.length ? Math.round(rates.reduce((a,b)=>a+b,0)/7) : 0;
        if(el.todayRate) el.todayRate.textContent = `이번 주 평균 달성: ${weeklyAvg}%`;
        if(el.rewardChip) {
            el.rewardChip.classList.toggle('hidden', weeklyAvg < 100 || !state.reward);
            if(state.reward) el.rewardChip.innerHTML = `<i class="fas fa-gift"></i> ${esc(state.reward)}`;
        }

        const pad = { l:30, r:10, t:20, b:35 }, gw = W-pad.l-pad.r, gh = H-pad.t-pad.b;
        ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
        for(let i=0; i<=4; i++) {
            const y = pad.t + gh - (gh * i/4);
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W-pad.r, y); ctx.stroke();
        }
        
        const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + gh);
        grad.addColorStop(0, 'rgba(0, 122, 255, 0.2)'); grad.addColorStop(1, 'rgba(0, 122, 255, 0)');
        ctx.beginPath();
        rates.forEach((r, i) => {
            const x = pad.l + (gw * i/6), y = pad.t + gh - (gh * r/100);
            if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.lineTo(pad.l+gw, pad.t+gh); ctx.lineTo(pad.l, pad.t+gh);
        ctx.fillStyle = grad; ctx.fill();

        ctx.beginPath(); ctx.strokeStyle = '#007aff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        rates.forEach((r, i) => {
            const x = pad.l + (gw * i/6), y = pad.t + gh - (gh * r/100);
            if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        });
        ctx.stroke();

        rates.forEach((r, i) => {
            const x = pad.l + (gw * i/6), y = pad.t + gh - (gh * r/100);
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'white'; ctx.fill();
            ctx.strokeStyle = '#007aff'; ctx.lineWidth = 2; ctx.stroke();
        });

        // Add day labels below x-axis
        ctx.fillStyle = state.theme === 'dark' ? '#a1a1a6' : '#8e8e93';
        ctx.font = '500 11px Inter';
        ctx.textAlign = 'center';
        ['월','화','수','목','금','토','일'].forEach((label, i) => {
            const x = pad.l + (gw * i/6);
            ctx.fillText(label, x, H - 8);
        });
    }

    init();
});
