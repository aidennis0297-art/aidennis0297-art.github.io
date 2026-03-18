document.addEventListener('DOMContentLoaded', () => {
    // --- FIREBASE AUTHENTICATION & DATABASE INIT ---
    // Ensure firebase is loaded from index.html -> firebase-config.js
    let currentUser = null;

    // --- STATE ---
    let state = {
        categories: [
            { id: 'cat_school', name: '학교', color: '#ff3b30' },
            { id: 'cat_life', name: '생활', color: '#34c759' },
            { id: 'cat_project', name: '프로젝트', color: '#5856d6' }
        ],
        tasks: [],
        victoryLog: [],
        currentView: 'super-routine',
        reward: '',
        rewardTarget: '100',
        editMode: false,
        theme: 'light'
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
        themeToggleBtn: $('theme-toggle-btn'), logoutBtn: $('logout-btn'),
        victoryView: $('victory-log-view'), victoryList: $('victory-list'),
        // Auth DOM
        authOverlay: $('auth-overlay'), authId: $('auth-id'), authPw: $('auth-pw'),
        authSubmit: $('auth-submit-btn'), authSwitchBtn: $('auth-switch-btn'),
        authSwitchText: $('auth-switch-text'), authTitle: $('auth-title'),
        authError: $('auth-error-msg'), authLoading: $('auth-loading'),
        // Mobile DOM
        mobileMenuBtn: $('mobile-menu-btn'), mobileOverlay: $('mobile-overlay'), sidebar: $('sidebar')
    };

    let isLoginMode = true;

    // --- AUTH LOGIC ---
    function setupAuth() {
        if (!firebase) {
            showAuthError("Firebase sdk not loaded.");
            return;
        }

        // Toggle Login/Signup UI
        if(el.authSwitchBtn) {
            el.authSwitchBtn.onclick = () => {
                isLoginMode = !isLoginMode;
                el.authTitle.textContent = isLoginMode ? "로그인" : "회원가입";
                el.authSubmit.textContent = isLoginMode ? "로그인" : "가입하기";
                el.authSwitchText.textContent = isLoginMode ? "계정이 없으신가요?" : "이미 계정이 있으신가요?";
                el.authSwitchBtn.textContent = isLoginMode ? "회원가입" : "로그인";
                el.authError.classList.add('hidden');
            };
        }

        // Handle Submit
        const doAuthSubmit = async () => {
            const id = el.authId.value.trim();
            const pw = el.authPw.value.trim();
            
            // Validation: English letters & numbers only, config length >= 4
            const validRegex = /^[a-zA-Z0-9]{4,}$/;
            if (!validRegex.test(id)) {
                showAuthError("아이디는 영문/숫자 4자 이상이어야 합니다.");
                return;
            }
            if (!validRegex.test(pw)) {
                showAuthError("비밀번호는 영문/숫자 4자 이상이어야 합니다.");
                return;
            }

            el.authLoading.classList.remove('hidden');
            
            try {
                // Firebase Auth expects emails. We will fake an email for the ID:
                const mockEmail = `${id.toLowerCase()}@productivity.local`; 
                
                if (isLoginMode) {
                    await auth.signInWithEmailAndPassword(mockEmail, pw);
                } else {
                    await auth.createUserWithEmailAndPassword(mockEmail, pw);
                    
                    // Initialize empty data structure for new user
                    const userId = auth.currentUser.uid;
                    await db.ref('users/' + userId).set({
                        state: {
                            categories: [
                                { id: 'cat_school', name: '학교', color: '#ff3b30' },
                                { id: 'cat_life', name: '생활', color: '#34c759' },
                                { id: 'cat_project', name: '프로젝트', color: '#5856d6' }
                            ],
                            theme: 'light',
                            rewardTarget: '100',
                            reward: ''
                        }
                    });
                }
            } catch(err) {
                el.authLoading.classList.add('hidden');
                if (err.code === 'auth/email-already-in-use') showAuthError("이미 존재하는 아이디입니다.");
                else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') showAuthError("아이디 또는 비밀번호가 잘못되었습니다.");
                else showAuthError("인증 오류: " + err.message);
            }
        };

        if(el.authSubmit) {
            el.authSubmit.onclick = doAuthSubmit;
        }

        // Enter key on auth fields: ID -> focus PW, PW -> submit
        if(el.authId) {
            el.authId.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); el.authPw.focus(); }
            };
        }
        if(el.authPw) {
            el.authPw.onkeydown = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); doAuthSubmit(); }
            };
        }

        if(el.logoutBtn) {
            el.logoutBtn.onclick = () => {
                auth.signOut().then(() => {
                    location.reload();
                });
            };
        }

        // Listen for Auth State Changes
        auth.onAuthStateChanged(user => {
            if (user) {
                currentUser = user;
                el.authOverlay.classList.add('hidden');
                loadDataFromCloud();
            } else {
                currentUser = null;
                el.authLoading.classList.add('hidden');
                el.authOverlay.classList.remove('hidden');
            }
        });
    }

    function showAuthError(msg) {
        el.authError.textContent = msg;
        el.authError.classList.remove('hidden');
        setTimeout(() => el.authError.classList.add('hidden'), 3000);
    }

    // --- DATA SYNC LOGIC ---
    let syncTimeout = null;
    const save = () => {
        if (!currentUser) return;

        // Ensure all tasks have a unique order
        let maxOrder = 0;
        state.tasks.forEach(t => { if(t.order > maxOrder) maxOrder = t.order; });
        state.tasks = state.tasks.map(t => ({...t, order: t.order ?? (maxOrder++)}));

        // Debounce cloud saving to avoid spamming the database
        clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            db.ref('users/' + currentUser.uid + '/state').set({
                categories: state.categories || [],
                tasks: state.tasks || [],
                victoryLog: state.victoryLog || [],
                reward: state.reward || '',
                rewardTarget: state.rewardTarget || '100',
                theme: state.theme || 'light'
            });
        }, 800);
    };

    function loadDataFromCloud() {
        if (!currentUser) return;
        el.authLoading.classList.remove('hidden'); // Show loading while fetching state
        
        db.ref('users/' + currentUser.uid + '/state').once('value')
            .then(snapshot => {
                const data = snapshot.val();
                if (data) {
                    state = {
                        categories: data.categories || [],
                        tasks: data.tasks || [],
                        victoryLog: data.victoryLog || [],
                        currentView: 'super-routine',
                        reward: data.reward || '',
                        rewardTarget: data.rewardTarget || '100',
                        editMode: false,
                        theme: data.theme || 'light'
                    };
                }
                
                // Ensure default categories exist if corrupted
                if (!state.categories || state.categories.length === 0) {
                     state.categories = [
                        { id: 'cat_school', name: '학교', color: '#ff3b30' },
                        { id: 'cat_life', name: '생활', color: '#34c759' },
                        { id: 'cat_project', name: '프로젝트', color: '#5856d6' }
                    ];
                }
                
                el.authLoading.classList.add('hidden');
                initAppUI();
            })
            .catch(err => {
                el.authLoading.classList.add('hidden');
                alert("데이터를 불러오지 못했습니다: " + err.message);
                console.error(err);
            });
    }


    // --- INIT ---
    function initAppUI() {
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
           // Skip logout button
           if(i.id === 'logout-btn') return;
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

        // Mobile Sidebar
        const closeSidebar = () => {
            if (el.sidebar) el.sidebar.classList.remove('open');
            if (el.mobileOverlay) el.mobileOverlay.classList.add('hidden');
        };
        if (el.mobileMenuBtn) {
            el.mobileMenuBtn.onclick = () => {
                if (el.sidebar) el.sidebar.classList.add('open');
                if (el.mobileOverlay) el.mobileOverlay.classList.remove('hidden');
            };
        }
        if (el.mobileOverlay) {
            el.mobileOverlay.onclick = closeSidebar;
        }

        // Add Task
        el.addBtn.onclick = (e) => { e.preventDefault(); addTask(); };
        el.todoInput.onkeypress = e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } };
        el.todoInput.oninput = handleHL;
        el.todoInput.onfocus = () => { 
            if ($('date-hint-tooltip') && !localStorage.getItem('dateHintShown')) {
                $('date-hint-tooltip').classList.add('visible'); 
                localStorage.setItem('dateHintShown', 'true');
            }
        };
        el.todoInput.onblur = () => { setTimeout(() => { if ($('date-hint-tooltip')) $('date-hint-tooltip').classList.remove('visible'); }, 200); };

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

        // Routine Toggle - swap between 리마인더 and 루틴
        el.isRoutineCb.onchange = e => {
            const isRoutine = e.target.checked;
            el.routineToggle.classList.toggle('active', isRoutine);
            el.routinePeriod.classList.toggle('hidden', !isRoutine);
            // Update icon and text
            const iconEl = el.routineToggle.querySelector('.toggle-icon i');
            const textEl = el.routineToggle.querySelector('.toggle-text');
            if (iconEl) iconEl.className = isRoutine ? 'fas fa-sync-alt' : 'fas fa-bell';
            if (textEl) textEl.textContent = isRoutine ? '루틴' : '리마인더';
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
                save(); // Save theme preference to cloud
                updateThemeIcon();
            };
        }



        // Reset All Tasks & Categories
        if (el.resetAllBtn) {
            el.resetAllBtn.onclick = () => {
                openConfirm("모든 데이터를 지우시겠습니까? (클라우드 데이터도 초기화됩니다)", () => {
                    state.tasks = [];
                    state.reward = '';
                    state.rewardTarget = '100';
                    state.categories = [
                        { id: 'cat_school', name: '학교', color: '#ff3b30' },
                        { id: 'cat_life', name: '생활', color: '#34c759' },
                        { id: 'cat_project', name: '프로젝트', color: '#5856d6' }
                    ];
                    save();
                    location.reload(); 
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

        // Close mobile sidebar on navigation
        if (el.sidebar && el.sidebar.classList.contains('open')) {
            el.sidebar.classList.remove('open');
            if (el.mobileOverlay) el.mobileOverlay.classList.add('hidden');
        }
        
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
        const idx = pool.findIndex(x => x.id === id);
        const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (swapIdx >= 0 && swapIdx < pool.length) {
            const currentOrder = pool[idx].order;
            const targetOrder = pool[swapIdx].order;
            pool[idx].order = targetOrder;
            pool[swapIdx].order = currentOrder;
            
            if (pool[idx].order === pool[swapIdx].order) {
                pool[idx].order = (dir === 'up') ? targetOrder - 1 : targetOrder + 1;
            }
            
            save(); renderTasks();
        }
    }



    function getPool() {
        if(!state.tasks) return [];
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
        if (v === 'sr-reminders') return state.tasks.filter(t => t.status === 'active' && !t.isRoutine && !t.isRoutineHistory).sort((a,b) => {
            const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            if (da !== db) return da - db;
            return (a.order || 0) - (b.order || 0);
        });
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
        
        const regs = [
            /(오늘|내일|모레)(까지)?/, 
            /((이번주|다음주)\s*([월화수목금토일])요일?)(까지)?/,
            /((\d+)월\s*(\d+)일)(까지)?/,
            /((\d{1,2})(\d{2}))(까지)?/,
            /언제까지/
        ];
        
        for(let r of regs) {
            const match = text.match(r);
            if (match) {
                m = match[0];
                const base = match[1];
                
                if (m === '언제까지') {
                    t = null;
                } else if (base === '오늘' || m === '오늘') t = new Date(today);
                else if (base === '내일' || m === '내일') { t = new Date(today); t.setDate(today.getDate()+1); }
                else if (base === '모레' || m === '모레') { t = new Date(today); t.setDate(today.getDate()+2); }
                else if (match[3]) {
                    const dayName = match[3];
                    const diff = (days.indexOf(dayName) - today.getDay() + 7) % 7 || 7;
                    t = new Date(today); t.setDate(today.getDate() + diff + (match[2]==='다음주'?7:0));
                }
                
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
                    if (m.includes('월')) {
                        const mdMatch = m.match(/(\d+)월\s*(\d+)일/);
                        if (mdMatch) { t = new Date(today); t.setMonth(parseInt(mdMatch[1])-1); t.setDate(parseInt(mdMatch[2])); }
                    } else {
                        const numMatch = m.match(/(\d{1,2})(\d{2})/);
                        if (numMatch) { t = new Date(today); t.setMonth(parseInt(numMatch[1])-1); t.setDate(parseInt(numMatch[2])); }
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
        
        const now = new Date();
        const startOfThisWeek = new Date(now);
        const day = now.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        startOfThisWeek.setDate(now.getDate() + diff);
        startOfThisWeek.setHours(0,0,0,0);

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
        
        // --- 리마인더 섹션 (habit grid 상단으로 이동) ---
        const reminders = state.tasks.filter(t => t.status === 'active' && !t.isRoutine && !t.isRoutineHistory);
        if (reminders.length > 0) {
            const separator = document.createElement('div');
            separator.className = 'hg-reminder-separator';
            separator.innerHTML = `<span><i class="fas fa-bell"></i> 리마인더</span>`;
            el.habitGrid.appendChild(separator);

            reminders.forEach(r => {
                let dueMeta = '';
                if (r.dueDate) {
                    const d = new Date(r.dueDate);
                    const now2 = new Date(); now2.setHours(0,0,0,0);
                    const tmr2 = new Date(now2); tmr2.setDate(now2.getDate() + 1);
                    let label = d.toLocaleDateString('ko-KR', {month:'short', day:'numeric'});
                    let urgent = false;
                    if (d < now2 || d.toDateString() === now2.toDateString()) { label = '오늘까지'; urgent = true; }
                    else if (d.toDateString() === tmr2.toDateString()) { label = '내일까지'; urgent = true; }
                    dueMeta = `<span class="hg-reminder-due ${urgent?'urgent':''}"><i class="far fa-calendar"></i> ${label}</span>`;
                }
                const delBtn2 = state.hgEditMode ? `<i class="fas fa-minus-circle hg-del-btn" data-rid="${r.id}" data-is-reminder="true"></i>` : '';
                const row = document.createElement('div');
                row.className = 'hg-reminder-row';
                row.dataset.rid = r.id;
                row.innerHTML = `
                    <div class="hg-reminder-check" data-act="complete" data-rid="${r.id}"><i class="fas fa-check"></i></div>
                    <div class="hg-reminder-label">${delBtn2}<span class="hg-reminder-text">${esc(r.text)}</span>${dueMeta}</div>
                `;
                el.habitGrid.appendChild(row);
            });
        }

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
                    const weekStarts = new Date(days[0]); weekStarts.setHours(0,0,0,0);
                    const weekEnds = new Date(days[6]); weekEnds.setHours(23,59,59,999);
                    
                    const completionsInWeek = state.tasks.filter(t => t.originalRoutineId === rid && t.status === 'completed' && new Date(t.completedAt) >= weekStarts && new Date(t.completedAt) <= weekEnds);
                    
                    if (completionsInWeek.length > 0) {
                        state.tasks = state.tasks.filter(t => !completionsInWeek.includes(t));
                    } else {
                        const rt = state.tasks.find(x => x.id === rid);
                        state.tasks.push({ ...rt, id: Date.now()+'h', originalRoutineId: rid, status: 'completed', completedAt: new Date(cell.dataset.day).toISOString(), isRoutineHistory: true });
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

        // --- 리마인더 섹션 클릭/삭제 핸들러 ---

            // click handler for reminder check
            el.habitGrid.querySelectorAll('.hg-reminder-check').forEach(btn => {
                btn.onclick = () => {
                    const rid = btn.dataset.rid;
                    const t = state.tasks.find(x => x.id === rid);
                    if (t) {
                        t.status = 'completed';
                        t.completedAt = new Date().toISOString();
                        save(); renderTasks();
                    }
                };
            });

            // delete handler for reminder delete
            el.habitGrid.querySelectorAll('.hg-del-btn[data-is-reminder]').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const rid = btn.dataset.rid;
                    openConfirm('이 리마인더를 삭제할까요?', () => {
                        state.tasks = state.tasks.filter(t => t.id !== rid);
                        save(); renderHabitGrid(); renderTasks();
                    });
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
        // 리마인더도 퍼센트 계산에 포함 (완료 시 카운트, 삭제된 건 제외)
        const reminderPool = state.tasks.filter(t => !t.isRoutine && !t.isRoutineHistory && t.status !== 'deleted');
        const reminderDoneCount = reminderPool.filter(t => t.status === 'completed').length;
        const reminderTotal = reminderPool.length;
        
        const rates = days.map(day => {
            const ds = day.toDateString();
            const totalItems = pool.length + reminderTotal;
            if (!totalItems) return 0;
            
            const routineDone = pool.filter(r => {
                if (r.recurrence === 'weekly') {
                    const start = new Date(days[0]); start.setHours(0,0,0,0);
                    const end = new Date(days[6]); end.setHours(23,59,59,999);
                    return state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt) >= start && new Date(t.completedAt) <= end);
                } else {
                    return state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt).toDateString() === ds);
                }
            }).length;
            
            return ((routineDone + reminderDoneCount) / totalItems) * 100;
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

        ctx.fillStyle = state.theme === 'dark' ? '#a1a1a6' : '#8e8e93';
        ctx.font = '500 11px Inter';
        ctx.textAlign = 'center';
        ['월','화','수','목','금','토','일'].forEach((label, i) => {
            const x = pad.l + (gw * i/6);
            ctx.fillText(label, x, H - 8);
        });
    }

    // FIREBASE INITIALIZATION ENTRY
    setupAuth();
});
