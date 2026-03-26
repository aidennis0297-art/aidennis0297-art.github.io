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
        theme: 'light',
        calendarData: {},
        isOverdoseMode: false,
        isEEEnabled: false,
        showShortcuts: true
    };

    const $ = id => document.getElementById(id);
    const esc = s => s ? s.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "";

    // --- DOM ---
    const el = {
        todoList: $('todo-list'), todoInput: $('todo-input'), inputHL: $('input-highlights'),
        cancelAutoBtn: $('cancel-auto-parse-btn'),
        addBtn: $('add-btn'), viewTitle: $('current-view-title'), dateDisplay: $('date-display'),
        catList: $('category-list'), addCatBtn: $('add-category-btn'),
        isRoutineCb: $('is-routine-cb'), routineToggle: $('routine-toggle-label'),
        routinePeriod: $('routine-period'),
        routinePeriodWrapper: $('routine-period-wrapper'),
        routineWeeklyOptions: $('routine-weekly-options'),
        routineMonthlyOptions: $('routine-monthly-options'),
        routineDailyOptions: $('routine-daily-options'),
        routineTime: $('routine-time'),
        monthlyType: $('monthly-type'),
        monthlyDateSelect: $('monthly-date-select'),
        monthlyRelativeSelect: $('monthly-relative-select'),
        catSelect: $('task-category-select'),
        badgeRoutine: $('badge-routine'), inputWrapper: $('input-wrapper'), 
        rewardInput: $('reward-input'), habitGrid: $('habit-grid'),
        achieveChart: $('achievement-chart'), todayRate: $('today-rate'),
        rewardChip: $('reward-display-chip'), editModeBtn: $('edit-mode-btn'),
        aiReportBtn: $('ai-report-btn'), aiModal: $('ai-modal'), aiModalBody: $('ai-modal-body'), aiModalClose: $('ai-modal-close-btn'), aiModalConfirm: $('ai-modal-confirm-btn'),
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
                theme: state.theme || 'light',
                calendarData: state.calendarData || {},
                isOverdoseMode: state.isOverdoseMode || false,
                isEEEnabled: state.isEEEnabled || false,
                showShortcuts: (state.showShortcuts !== undefined) ? state.showShortcuts : true
            });
        }, 800);
    };

    let isInitialLoad = true;
    function loadDataFromCloud() {
        if (!currentUser) return;
        el.authLoading.classList.remove('hidden'); // Show loading while fetching state
        
        db.ref('users/' + currentUser.uid + '/state').on('value', snapshot => {
            const data = snapshot.val();
            if (data) {
                state = {
                    categories: data.categories || [],
                    tasks: data.tasks || [],
                    victoryLog: data.victoryLog || [],
                    currentView: state.currentView || 'super-routine',
                    reward: data.reward || '',
                    rewardTarget: data.rewardTarget || '100',
                    editMode: state.editMode,
                    theme: data.theme || 'light',
                    calendarData: data.calendarData || {},
                    isOverdoseMode: data.isOverdoseMode || false,
                    isEEEnabled: data.isEEEnabled || false,
                    showShortcuts: (data.showShortcuts !== undefined) ? data.showShortcuts : true
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
            
            if (isInitialLoad) {
                el.authLoading.classList.add('hidden');
                initAppUI();
                isInitialLoad = false;
            } else {
                // Not initial load, just update UI
                renderSidebar();
                updateDropdown();
                renderTasks();
                updateBadges();
                if (state.currentView === 'victory-log' && typeof renderVictoryLog === 'function') renderVictoryLog();
                if (state.currentView === 'calendar' && typeof initCalendarView === 'function') initCalendarView();
                if (state.currentView === 'super-routine' && typeof renderHabitGrid === 'function') {
                    renderHabitGrid();
                    renderChart();
                }
            }
        }, err => {
            if (isInitialLoad) {
                el.authLoading.classList.add('hidden');
                alert("데이터를 불러오지 못했습니다: " + err.message);
                console.error(err);
            }
        });
    }

    function getCompletedRoutineInPeriod(r, targetDate) {
        if (!r.isRoutine || r.isRoutineHistory) return null;
        const rect = r.recurrence;
        const type = typeof rect === 'string' ? rect : (rect?.type || '');
        if (type === 'weekly' && !(typeof rect === 'object' && rect.days && rect.days.length > 0)) {
            const day = targetDate.getDay();
            const diff = (day === 0 ? -6 : 1) - day;
            const weekStarts = new Date(targetDate); weekStarts.setDate(targetDate.getDate() + diff); weekStarts.setHours(0,0,0,0);
            const weekEnds = new Date(weekStarts); weekEnds.setDate(weekStarts.getDate() + 6); weekEnds.setHours(23,59,59,999);
            return state.tasks.find(x => x.originalRoutineId === r.id && x.status === 'completed' && new Date(x.completedAt) >= weekStarts && new Date(x.completedAt) <= weekEnds);
        } else if (type === 'monthly' && !(typeof rect === 'object' && (rect.subType === 'date' || rect.subType === 'relative'))) {
            return state.tasks.find(x => {
                if (x.originalRoutineId !== r.id || x.status !== 'completed') return false;
                const d = new Date(x.completedAt);
                return d.getFullYear() === targetDate.getFullYear() && d.getMonth() === targetDate.getMonth();
            });
        } else {
            const ts = targetDate.toDateString();
            return state.tasks.find(x => x.originalRoutineId === r.id && x.status === 'completed' && new Date(x.completedAt).toDateString() === ts);
        }
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
        updateEEUI();
        updateShortcutVisibility();
        setView(state.currentView);
    }

    function updateShortcutVisibility() {
        document.body.classList.toggle('hide-shortcuts', !state.showShortcuts);
    }
    
    function updateEEUI() {
        const btn = $('ee-enable-btn');
        if (btn) {
            btn.innerHTML = state.isEEEnabled ? '<i class="fas fa-unlock"></i> 이스터에그 활성됨' : '<i class="fas fa-lock"></i> 이스터에그 해제';
            btn.classList.toggle('primary', state.isEEEnabled);
        }
        const navItem = document.querySelector('.nav-item[data-view="calendar"]');
        if (navItem) navItem.classList.toggle('hidden', !state.isEEEnabled);
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
                const card = h.closest('.sr-card');
                if (card) card.classList.toggle('collapsed');
                const target = $(h.dataset.target);
                if (target) target.classList.toggle('hidden');
                if (h.dataset.target === 'chart-section') renderChart();
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
        el.todoInput.oninput = () => {
            state.cancelAutoParse = false;
            handleHL();
        };
        if (el.cancelAutoBtn) {
            el.cancelAutoBtn.onclick = (e) => {
                e.preventDefault();
                state.cancelAutoParse = true;
                handleHL();
                el.todoInput.focus();
            };
        }
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

        // AI Report Modal Wiring
        if (el.aiReportBtn) el.aiReportBtn.onclick = showAIReport;
        if (el.aiModalClose) el.aiModalClose.onclick = () => el.aiModal.classList.add('hidden');
        if (el.aiModalConfirm) el.aiModalConfirm.onclick = () => el.aiModal.classList.add('hidden');

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
            if (['history','trash','settings'].includes(v)) return;
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
            el.routinePeriodWrapper.classList.toggle('hidden', !isRoutine);
            
            // Show sub-options based on type
            if (isRoutine) el.routinePeriod.dispatchEvent(new Event('change'));

            // Update icon and text
            const iconEl = el.routineToggle.querySelector('.toggle-icon i');
            const textEl = el.routineToggle.querySelector('.toggle-text');
            if (iconEl) iconEl.className = isRoutine ? 'fas fa-sync-alt' : 'fas fa-bell';
            if (textEl) textEl.textContent = isRoutine ? '루틴' : '리마인더';
        };

        el.routinePeriod.onchange = () => {
            const v = el.routinePeriod.value;
            el.routineDailyOptions.classList.toggle('hidden', v !== 'daily');
            el.routineWeeklyOptions.classList.toggle('hidden', v !== 'weekly');
            el.routineMonthlyOptions.classList.toggle('hidden', v !== 'monthly');
        };

        el.monthlyType.onchange = () => {
            const v = el.monthlyType.value;
            el.monthlyDateSelect.classList.toggle('hidden', v !== 'date');
            el.monthlyRelativeSelect.classList.toggle('hidden', v !== 'relative');
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
                return;
            }

            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';

            if (!isInput) {
                if (e.key === '/') {
                    e.preventDefault();
                    el.todoInput.focus();
                    return;
                }

                if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
                    e.preventDefault();
                    if (e.key === '3' && state.categories.length > 0) {
                        const curIdx = state.categories.findIndex(c => c.id === state.currentView);
                        const nextIdx = (curIdx + 1) % state.categories.length;
                        setView(state.categories[nextIdx].id);
                        return;
                    }
                    const viewsMap = {'1':'all', '2':'super-routine', '4':'history', '5':'victory-log', '6':'trash'};
                    if (viewsMap[e.key]) setView(viewsMap[e.key]);
                    return;
                }

                if (e.key === '`') {
                    e.preventDefault();
                    if (el.themeToggleBtn) el.themeToggleBtn.click();
                    return;
                }

                if (e.key === '\\') {
                    e.preventDefault();
                    state.showShortcuts = !state.showShortcuts;
                    updateShortcutVisibility();
                    save();
                    return;
                }

                const getFocusables = () => Array.from(document.querySelectorAll('.todo-item, .hg-row, .hg-pill-row, .hg-reminder-row')).filter(el => !el.classList.contains('hidden') && el.offsetParent !== null);
                
                if (['ArrowDown', 'j'].includes(e.key)) {
                    e.preventDefault();
                    const focusable = getFocusables();
                    state.kbFocusIndex = Math.min((state.kbFocusIndex || -1) + 1, focusable.length - 1);
                    updateKbFocus(focusable);
                } else if (['ArrowUp', 'k'].includes(e.key)) {
                    e.preventDefault();
                    const focusable = getFocusables();
                    state.kbFocusIndex = Math.max((state.kbFocusIndex || -1) - 1, 0);
                    updateKbFocus(focusable);
                } else if (['x', ' ', 'Enter'].includes(e.key)) {
                    const focusable = getFocusables();
                    if (state.kbFocusIndex >= 0 && focusable[state.kbFocusIndex]) {
                        e.preventDefault();
                        toggleKbFocused(focusable[state.kbFocusIndex]);
                    }
                } else if (e.key === 'Delete') {
                    const focusable = getFocusables();
                    if (state.kbFocusIndex >= 0 && focusable[state.kbFocusIndex]) {
                        e.preventDefault();
                        deleteKbFocused(focusable[state.kbFocusIndex]);
                    }
                }
            }
        };

        function updateKbFocus(items) {
            document.querySelectorAll('.kb-focus').forEach(el => el.classList.remove('kb-focus'));
            if (state.kbFocusIndex >= 0 && state.kbFocusIndex < items.length) {
                items[state.kbFocusIndex].classList.add('kb-focus');
                items[state.kbFocusIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                state.kbFocusIndex = -1;
            }
        }

        function toggleKbFocused(el) {
            if (el.classList.contains('todo-item')) {
                const id = el.dataset.id;
                const t = state.tasks.find(x => x.id === id);
                if (t) completeTask(t);
            } else if (el.classList.contains('hg-reminder-row')) {
                const cb = el.querySelector('.hg-reminder-check, .cb');
                if (cb) cb.click();
            } else if (el.classList.contains('hg-row') || el.classList.contains('hg-pill-row')) {
                let targetCell = el.querySelector('.hg-cell.today');
                if (!targetCell) targetCell = el.querySelector('.hg-cell:not(.hg-cell-hdr)');
                if (targetCell) targetCell.click();
            }
        }

        function deleteKbFocused(el) {
            if (el.classList.contains('todo-item')) {
                const id = el.dataset.id;
                const t = state.tasks.find(x => x.id === id);
                if (t && t.status !== 'deleted') {
                     t.status = 'deleted'; save(); renderTasks(); updateBadges(); 
                }
            } else {
                 const delBtn = el.querySelector('.hg-del-btn');
                 if (delBtn) delBtn.click();
            }
        }

        el.todoInput.onkeydown = e => {
            if (e.key === 'Escape') {
                state.cancelAutoParse = true;
                handleHL();
            } else if (e.key === 'Tab') {
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

        // Easter Egg Toggle in Settings
        const eeBtn = $('ee-enable-btn');
        if (eeBtn) {
            eeBtn.onclick = () => {
                if (!state.isEEEnabled) {
                    openPrompt("이스터에그 해제", "보안코드를 입력하세요", (val) => {
                        if (val === "서울시립대") {
                            state.isEEEnabled = true;
                            save();
                            updateEEUI();
                        } else if (val !== null && val !== "") {
                            alert("코드가 올바르지 않습니다.");
                        }
                    });
                } else {
                    state.isEEEnabled = false;
                    save();
                    updateEEUI();
                }
            };
        }

        // Global list delegation
        el.todoList.onclick = handleListClick;
        el.todoList.addEventListener('change', e => {
            if (e.target.classList.contains('cat-change-select')) {
                const item = e.target.closest('.todo-item');
                const t = state.tasks.find(x => x.id === item.dataset.id);
                if (t) {
                    t.categoryId = e.target.value;
                    save(); renderTasks(); renderSidebar();
                }
            }
        });
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

    // --- AI REPORT LOGIC ---
    function showAIReport() {
        if (!el.aiModal) return;
        el.aiModal.classList.remove('hidden');
        el.aiModalBody.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--blue); margin-bottom: 10px;"></i>
                <p>데이터를 분석하고 있습니다...</p>
            </div>`;
        
        setTimeout(() => {
            const now = new Date();
            const lastWeek = new Date(now);
            lastWeek.setDate(now.getDate() - 7);
            
            const routines = state.tasks.filter(t => t.isRoutine && !t.isRoutineHistory && t.status === 'active');
            const history = state.tasks.filter(t => t.isRoutineHistory && t.status === 'completed' && new Date(t.completedAt) >= lastWeek);
            
            let totalExpected = 0;
            let weakRoutines = [];
            
            routines.forEach(r => {
                const rt = typeof r.recurrence === 'string' ? r.recurrence : (r.recurrence?.type || '');
                let expected = 7;
                if (rt === 'weekly') expected = 1;
                else if (rt === 'every2days') expected = 3;
                else if (rt === 'every3days') expected = 2;
                else if (rt === 'monthly') expected = 0; 
                
                totalExpected += expected;
                const doneCount = history.filter(h => h.originalRoutineId === r.id).length;
                
                if (expected > 0 && (doneCount / expected) < 0.5) {
                    weakRoutines.push({ id: r.id, name: r.text, rate: Math.round((doneCount/expected)*100) });
                }
            });
            
            const overallRate = totalExpected > 0 ? Math.round((history.length / totalExpected) * 100) : 0;
            
            // 1. Reward Balance Evaluation
            let rewardFeedback = '';
            if (!state.reward) {
                if (routines.length >= 3) rewardFeedback = '루틴 목표는 세워졌는데 보상이 없네요! <strong>이번 주 나만의 약속</strong>을 꼭 설정해 보세요.';
                else rewardFeedback = '설정된 보상이 없습니다. 작은 보상 하나를 걸고 시작해 볼까요?';
            } else {
                if (routines.length <= 2) rewardFeedback = `현재 루틴 갯수에 비해 '${esc(state.reward)}' 보상은 꽤 커 보입니다! 동기부여가 잘 되겠네요.`;
                else if (routines.length >= 7) rewardFeedback = `루틴이 무려 ${routines.length}개나 됩니다! '${esc(state.reward)}' 보상을 위해 열심히 달릴 준비 되셨나요?`;
                else rewardFeedback = `'${esc(state.reward)}' 보상을 향한 이번 주 계획 밸런스가 좋습니다!`;
            }

            // 2. Interactive Analysis for Weak Routine
            let interactiveHtml = '';
            let targetRoutine = weakRoutines.length > 0 ? weakRoutines[0] : null;

            if (targetRoutine) {
                interactiveHtml = `
                <div style="margin-top:20px; border-left:4px solid var(--purple); padding:10px 15px; background:var(--bg2); border-radius:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-search text-purple" style="font-size:1.2rem;"></i>
                        <strong style="font-size:1.05rem;">집중 분석: ${esc(targetRoutine.name)}</strong>
                    </div>
                    <p style="margin-top:8px; font-size:0.9rem; color:var(--text); line-height:1.4;">
                        지난주 이 항목의 달성률이 <strong>${targetRoutine.rate}%</strong>에 그쳤습니다. 실천하기 가장 어려웠던 원인이 무엇인가요?
                    </p>
                    <div id="ai-action-container" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
                        <button class="ai-cause-btn" data-id="${targetRoutine.id}" data-cause="time" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px; background:var(--bg1); cursor:pointer; font-weight:600; font-size:0.85rem;">시간 부족 ⏳</button>
                        <button class="ai-cause-btn" data-id="${targetRoutine.id}" data-cause="energy" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px; background:var(--bg1); cursor:pointer; font-weight:600; font-size:0.85rem;">체력 방전 🔋</button>
                        <button class="ai-cause-btn" data-id="${targetRoutine.id}" data-cause="motivation" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px; background:var(--bg1); cursor:pointer; font-weight:600; font-size:0.85rem;">귀찮음 🎯</button>
                    </div>
                </div>`;
            } else {
                interactiveHtml = `
                <div style="margin-top:20px; background:rgba(0,122,255,0.1); padding:15px; border-radius:8px; text-align:center; color:var(--blue);">
                    <i class="fas fa-thumbs-up" style="font-size:1.5rem; margin-bottom:8px;"></i>
                    <p style="margin:0; font-size:0.95rem; font-weight:600;">진단할 부진 루틴이 없습니다. 완벽해요!</p>
                </div>`;
            }

            el.aiModalBody.innerHTML = `
                <div style="text-align:center; margin-bottom:15px;">
                    <div style="font-size:3rem; margin-bottom:5px;">${overallRate >= 80 ? '🔥' : overallRate >= 50 ? '💪' : '🌱'}</div>
                    <h4 style="margin:0; font-size:1.1rem;">지난주 달성률 <span style="color:var(--blue); font-size:1.3rem; margin-left:5px;">${Math.min(100, overallRate)}%</span></h4>
                </div>
                
                <div style="background:var(--blue-bg); color:var(--text); padding:12px 15px; border-radius:8px; font-size:0.9rem; line-height:1.5; margin-bottom:15px; display:flex; gap:12px; align-items:flex-start;">
                    <i class="fas fa-gift text-blue" style="font-size:1.2rem; margin-top:2px;"></i>
                    <div><strong>보상 밸런스 체크:</strong><br>${rewardFeedback}</div>
                </div>

                ${interactiveHtml}
            `;

            // Bind events for root cause buttons
            setTimeout(() => {
                const causeBtns = el.aiModalBody.querySelectorAll('.ai-cause-btn');
                causeBtns.forEach(btn => {
                    btn.onclick = () => {
                        const cause = btn.dataset.cause;
                        const tid = btn.dataset.id;
                        const t = state.tasks.find(x => x.id == tid);
                        if (!t) return;

                        const container = el.aiModalBody.querySelector('#ai-action-container');
                        if (cause === 'time') {
                            container.innerHTML = `
                                <div style="width:100%; border:1px solid var(--green); background:rgba(52,199,89,0.1); border-radius:6px; padding:12px; text-align:center;">
                                    <p style="margin:0 0 10px 0; font-size:0.9rem;">부담을 줄이기 위해 일단 <strong>'5분만'</strong> 해보는 건 어떨까요? 루틴 이름에 '(5분만)'을 추가해 드릴게요.</p>
                                    <button id="ai-apply-btn" class="btn btn-primary" style="width:100%;">이름 변경 적용하기</button>
                                </div>
                            `;
                            el.aiModalBody.querySelector('#ai-apply-btn').onclick = () => {
                                if(!t.text.includes('(5분만)')) t.text += ' (5분만)';
                                save(); renderTasks(); renderSidebar();
                                container.innerHTML = `<div style="text-align:center; color:var(--green); font-weight:bold; width:100%;"><i class="fas fa-check-circle"></i> 적용 완료!</div>`;
                            };
                        } else if (cause === 'energy') {
                            container.innerHTML = `
                                <div style="width:100%; border:1px solid var(--orange); background:rgba(255,149,0,0.1); border-radius:6px; padding:12px; text-align:center;">
                                    <p style="margin:0 0 10px 0; font-size:0.9rem;">에너지가 많이 달린다면, 이번 주만 <strong>임시로 비활성화(보류)</strong> 해두고 쉴까요?</p>
                                    <button id="ai-apply-btn" class="btn btn-primary" style="width:100%; background:var(--orange);">이번 주 비활성화</button>
                                </div>
                            `;
                            el.aiModalBody.querySelector('#ai-apply-btn').onclick = () => {
                                t.status = 'paused'; // or just soft delete from active routine list
                                save(); renderTasks(); renderSidebar();
                                container.innerHTML = `<div style="text-align:center; color:var(--orange); font-weight:bold; width:100%;"><i class="fas fa-pause-circle"></i> 비활성화 완료 (추후 설정에서 복구 가능)</div>`;
                            };
                        } else if (cause === 'motivation') {
                            container.innerHTML = `
                                <div style="width:100%; border:1px solid var(--purple); background:rgba(175,82,222,0.1); border-radius:6px; padding:12px; text-align:center;">
                                    <p style="margin:0 0 10px 0; font-size:0.9rem;">이 루틴 완수만을 위한 <strong>작은 특별 보상</strong>을 이름 옆에 적어볼까요?</p>
                                    <div style="display:flex; gap:8px;">
                                        <input type="text" id="ai-reward-input" placeholder="예: + 커피 한잔" style="flex:1; padding:8px; border:1px solid var(--border); border-radius:6px;">
                                        <button id="ai-apply-btn" class="btn btn-primary">추가</button>
                                    </div>
                                </div>
                            `;
                            const input = el.aiModalBody.querySelector('#ai-reward-input');
                            input.focus();
                            el.aiModalBody.querySelector('#ai-apply-btn').onclick = () => {
                                if(input.value.trim()) t.text += ` [🎁 ${input.value.trim()}]`;
                                save(); renderTasks(); renderSidebar();
                                container.innerHTML = `<div style="text-align:center; color:var(--purple); font-weight:bold; width:100%;"><i class="fas fa-check-circle"></i> 추가 완료!</div>`;
                            };
                        }
                    };
                });
            }, 10);
            
        }, 800);
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
        
        const isSettings = v === 'settings', isVictory = v === 'victory-log', isCalendar = v === 'calendar';
        if (el.settingsView) el.settingsView.classList.toggle('hidden', !isSettings);
        if (el.victoryView) el.victoryView.classList.toggle('hidden', !isVictory);
        
        const calView = $('calendar-view');
        if (calView) {
            calView.classList.toggle('hidden', !isCalendar);
            if (isCalendar) initCalendarView();
            else if (window.stopCalendar) window.stopCalendar();
        }

        el.todoList.classList.toggle('hidden', isSettings || isVictory || isCalendar);
        
        const isUserCat = !['all', 'super-routine', 'history', 'victory-log', 'trash', 'settings', 'calendar'].includes(v);
        $('edit-view-actions').classList.toggle('hidden', !isUserCat && v !== 'all');
        
        // AI Report button visibility: Show only in 'all' view
        if (el.aiReportBtn) el.aiReportBtn.classList.toggle('hidden', v !== 'all');
        // Edit mode button visibility: Show for user categories
        if (el.editModeBtn) el.editModeBtn.classList.toggle('hidden', !isUserCat);
        
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
                'settings': '설정',
                'calendar': '📅 캘린더'
            }[v];
        }
        
        el.inputWrapper.style.display = ['history','trash','settings','victory-log', 'calendar'].includes(v) ? 'none' : 'block';
        const mainHeader = document.querySelector('.main-header');
        if (mainHeader) mainHeader.style.display = (v === 'calendar') ? 'none' : 'flex';
        
        updateDropdown(); renderTasks();
        if (isVictory) renderVictoryLog();
    }

    // --- TASK LOGIC ---
    function addTask() {
        const fullText = el.todoInput.value.trim(); if (!fullText) return;
        const pr = state.cancelAutoParse ? { targetDate: null, matched: null, timeMatched: null } : parseDate(fullText);
        let taskText = fullText;
        let finalIsRoutine = el.isRoutineCb.checked;
        let finalPeriod = el.routinePeriod.value;

        // Auto-detect routine keywords in input
        const daysMap = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 };
        const weekMap = { '첫째주': 1, '둘째주': 2, '셋째주': 3, '넷째주': 4, '마지막주': 5 };

        if (!state.cancelAutoParse) {
        // 1. Weekly with specific day
        const weeklyMatch = taskText.match(/매주\s*([월화수목금토일])요일(마다)?/);
        if (weeklyMatch) {
            finalIsRoutine = true; finalPeriod = 'weekly';
            const dayNum = daysMap[weeklyMatch[1]];
            // Update UI
            el.routinePeriod.value = 'weekly';
            el.routinePeriod.dispatchEvent(new Event('change'));
            el.routineWeeklyOptions.querySelectorAll('input').forEach(i => i.checked = parseInt(i.value) === dayNum);
            taskText = taskText.replace(weeklyMatch[0], '').replace(/\s+/g, ' ').trim();
        }
        
        // 2. Monthly with relative week/day
        const monthlyRelMatch = taskText.match(/매달\s*(첫째주|둘째주|셋째주|넷째주|마지막주)\s*([월화수목금토일])요일(마다)?/);
        if (monthlyRelMatch) {
            finalIsRoutine = true; finalPeriod = 'monthly';
            el.routinePeriod.value = 'monthly';
            el.routinePeriod.dispatchEvent(new Event('change'));
            el.monthlyType.value = 'relative';
            el.monthlyType.dispatchEvent(new Event('change'));
            $('monthly-week-num').value = weekMap[monthlyRelMatch[1]];
            $('monthly-day-name').value = daysMap[monthlyRelMatch[2]];
            taskText = taskText.replace(monthlyRelMatch[0], '').replace(/\s+/g, ' ').trim();
        }

        // 3. Monthly with specific date
        const monthlyDateMatch = taskText.match(/매달\s*(\d{1,2})일(마다)?/);
        if (monthlyDateMatch) {
            finalIsRoutine = true; finalPeriod = 'monthly';
            el.routinePeriod.value = 'monthly';
            el.routinePeriod.dispatchEvent(new Event('change'));
            el.monthlyType.value = 'date';
            el.monthlyType.dispatchEvent(new Event('change'));
            $('monthly-day-num').value = parseInt(monthlyDateMatch[1]);
            taskText = taskText.replace(monthlyDateMatch[0], '').replace(/\s+/g, ' ').trim();
        }

        // 5. Every 2 or 3 days
        const everyMatch = taskText.match(/(이틀|격일|3일|삼일)마다/);
        if (everyMatch) {
            finalIsRoutine = true; 
            if (everyMatch[1] === '이틀' || everyMatch[1] === '격일') {
                finalPeriod = 'every2days';
            } else {
                finalPeriod = 'every3days';
            }
            taskText = taskText.replace(everyMatch[0], '').replace(/\s+/g, ' ').trim();
        }

        // 4. Daily with time
        if (pr.timeMatched) {
            const timeValMatch = pr.timeMatched.match(/(\d{1,2})시(\s*(\d{1,2})분)?/);
            if (timeValMatch) {
                const hh = timeValMatch[1].padStart(2, '0');
                const mm = (timeValMatch[3] || '0').padStart(2, '0').slice(0, 2);
                el.routineTime.value = `${hh}:${mm}`;
                taskText = taskText.replace(pr.timeMatched, '').replace(/\s+/g, ' ').trim();
            }
        }

        if (pr.matched) {
            taskText = taskText.replace(pr.matched, '').replace(/\s+/g, ' ').trim();
        }

        const hashtagMatch = taskText.match(/#(\S+)/);
        if (hashtagMatch) {
            const cName = hashtagMatch[1];
            const foundCat = state.categories.find(c => c.name === cName);
            if (foundCat) {
                el.catSelect.value = foundCat.id;
                taskText = taskText.replace(hashtagMatch[0], '').replace(/\s+/g, ' ').trim();
            }
        }
        } // End of !state.cancelAutoParse feature flag skip
        if (!taskText) taskText = fullText;

        const newOrder = state.tasks.length ? Math.max(...state.tasks.map(t => t.order || 0)) + 1 : 0;
        
        let recurrenceData = null;
        if (finalIsRoutine) {
            if (finalPeriod === 'daily') {
                recurrenceData = { type: 'daily', time: el.routineTime.value };
            } else if (finalPeriod === 'weekly') {
                const days = Array.from(el.routineWeeklyOptions.querySelectorAll('input:checked')).map(i => parseInt(i.value));
                recurrenceData = { type: 'weekly', days: days.length ? days : [new Date().getDay()] };
            } else if (finalPeriod === 'monthly') {
                if (el.monthlyType.value === 'date') {
                    recurrenceData = { type: 'monthly', subType: 'date', day: parseInt($('monthly-day-num').value) };
                } else {
                    recurrenceData = { 
                        type: 'monthly', 
                        subType: 'relative', 
                        weekNum: parseInt($('monthly-week-num').value), 
                        dayName: parseInt($('monthly-day-name').value) 
                    };
                }
            } else {
                recurrenceData = finalPeriod;
            }
        }

        state.tasks.push({
            id: Date.now().toString(), text: taskText, categoryId: el.catSelect.value || 'cat_life',
            status: 'active', isRoutine: finalIsRoutine,
            recurrence: recurrenceData,
            dueDate: pr.targetDate ? pr.targetDate.toISOString() : null,
            order: newOrder, createdAt: new Date().toISOString()
        });
        save(); el.todoInput.value = ""; el.inputHL.innerHTML = ""; 
        state.cancelAutoParse = false;
        if (el.cancelAutoBtn) el.cancelAutoBtn.classList.add('hidden');
        // Reset
        el.isRoutineCb.checked = false; 
        el.routinePeriod.value = 'daily';
        el.routineWeeklyOptions.querySelectorAll('input').forEach(i => i.checked = false);
        el.isRoutineCb.dispatchEvent(new Event('change'));
        renderTasks(); updateBadges();
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
            const existing = getCompletedRoutineInPeriod(t, now);
            
            if (existing) {
                // Toggle OFF
                state.tasks = state.tasks.filter(x => x.id !== existing.id);
            } else {
                // Toggle ON
                state.tasks.push({
                    ...t, id: Date.now().toString() + 'h', originalRoutineId: t.id,
                    status: 'completed', completedAt: now.toISOString(), isRoutineHistory: true
                });
                
                // Update master routine date to next occurrence
                let next = t.dueDate ? new Date(t.dueDate) : new Date();
                const advance = () => {
                    const rect = t.recurrence;
                    const type = typeof rect === 'string' ? rect : rect.type;

                    if (type === 'daily') next.setDate(next.getDate() + 1);
                    else if (type === 'every2days') next.setDate(next.getDate() + 2);
                    else if (type === 'every3days') next.setDate(next.getDate() + 3);
                    else if (type === 'weekly') {
                        if (typeof rect === 'object' && rect.days) {
                            // Find next day in the list
                            let currentDay = next.getDay();
                            let daysOffset = 1;
                            while (!rect.days.includes((currentDay + daysOffset) % 7) && daysOffset < 8) {
                                daysOffset++;
                            }
                            next.setDate(next.getDate() + daysOffset);
                        } else {
                            next.setDate(next.getDate() + 7);
                        }
                    } else if (['mon','tue','wed','thu','fri','sat','sun'].includes(type) || ['mon','tue','wed','thu','fri','sat','sun'].includes(rect)) {
                        next.setDate(next.getDate() + 7);
                    } else if (type === 'monthly') {
                        if (typeof rect === 'object') {
                            if (rect.subType === 'date') {
                                next.setMonth(next.getMonth() + 1);
                                next.setDate(rect.day);
                            } else if (rect.subType === 'relative') {
                                // Find next month's Nth weekday
                                next.setMonth(next.getMonth() + 1);
                                next.setDate(1);
                                let firstDay = next.getDay();
                                let diff = (rect.dayName - firstDay + 7) % 7;
                                let targetDate = 1 + diff + (rect.weekNum - 1) * 7;
                                
                                // Handle 'last' week case
                                let lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
                                if (targetDate > lastDayOfMonth) {
                                    if (rect.weekNum === 5) targetDate -= 7;
                                }
                                next.setDate(targetDate);
                            }
                        } else {
                            next.setMonth(next.getMonth() + 1);
                        }
                    }
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
        // Filter out ghost tasks (no text and not a routine being actively edited)
        const activeTasks = state.tasks.filter(t => t.text !== "" || t.isRoutine);
        if (v === 'all') {
            return activeTasks
                .filter(t => t.status === 'active' && !t.isRoutineHistory)
                .sort((a,b) => {
                    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                    if (da !== db) return da - db;
                    return (a.order || 0) - (b.order || 0);
                });
        }
        if (v === 'super-routine') return activeTasks.filter(t => t.status === 'active' && t.isRoutine && !t.isRoutineHistory).sort((a,b) => (a.order||0) - (b.order||0));
        if (v === 'sr-reminders') return activeTasks.filter(t => t.status === 'active' && !t.isRoutine && !t.isRoutineHistory).sort((a,b) => {
            const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            if (da !== db) return da - db;
            return (a.order || 0) - (b.order || 0);
        });
        if (v === 'history') return activeTasks.filter(t => t.status === 'completed').sort((a,b) => new Date(b.completedAt) - new Date(a.completedAt));
        if (v === 'trash') return activeTasks.filter(t => t.status === 'deleted' || t.status === 'paused').sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        return activeTasks.filter(t => t.status === 'active' && t.categoryId === v && !t.isRoutineHistory).sort((a,b) => (a.order||0) - (b.order||0));
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

            const past = [], today = [], tmrList = [], warning = [], others = [];
            tasks.forEach(t => {
                if (!t.dueDate) others.push(t);
                else {
                    const d = new Date(t.dueDate);
                    if (d < now && d.toDateString() !== now.toDateString()) past.push(t);
                    else if (d.toDateString() === now.toDateString()) today.push(t);
                    else if (d.toDateString() === tmr.toDateString()) tmrList.push(t);
                    else if (d.toDateString() === dat.toDateString()) warning.push(t);
                    else others.push(t);
                }
            });

            // Two-column layout
            let leftCol = '';
            if (past.length) {
                leftCol += `<div class="history-cat-header" style="color:var(--red)"><i class="fas fa-history"></i> 지난 일정</div>`;
                past.forEach(t => leftCol += tHTML(t));
            }
            if (today.length) {
                leftCol += `<div class="history-cat-header urgent"><i class="fas fa-exclamation-circle"></i> 오늘까지</div>`;
                today.forEach(t => leftCol += tHTML(t));
            }
            if (tmrList.length) {
                leftCol += `<div class="history-cat-header warning"><i class="fas fa-clock"></i> 내일까지</div>`;
                tmrList.forEach(t => leftCol += tHTML(t));
            }
            if (warning.length) {
                leftCol += `<div class="history-cat-header" style="color:var(--yellow)"><i class="fas fa-calendar-day"></i> 모레까지</div>`;
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
                const dailyGroup = routines.filter(r => { const rt = typeof r.recurrence === 'string' ? r.recurrence : (r.recurrence?.type || ''); return rt === 'daily' || rt === 'everyday'; });
                const weeklyGroup = routines.filter(r => { const rt = typeof r.recurrence === 'string' ? r.recurrence : (r.recurrence?.type || ''); return rt === 'weekly' || ['mon','tue','wed','thu','fri','sat','sun'].includes(rt) || rt === 'every2days' || rt === 'every3days'; });
                const monthlyGroup = routines.filter(r => { const rt = typeof r.recurrence === 'string' ? r.recurrence : (r.recurrence?.type || ''); return rt === 'monthly'; });

                if (dailyGroup.length) {
                    rightCol += `<div class="history-cat-header"><i class="fas fa-sun" style="color:var(--purple)"></i> 일간 루틴</div>`;
                    dailyGroup.forEach(t => rightCol += tHTML(t));
                }
                if (weeklyGroup.length) {
                    rightCol += `<div class="history-cat-header"><i class="fas fa-calendar-week" style="color:var(--blue)"></i> 주간 루틴</div>`;
                    weeklyGroup.forEach(t => rightCol += tHTML(t));
                }
                if (monthlyGroup.length) {
                    rightCol += `<div class="history-cat-header"><i class="fas fa-calendar-alt" style="color:var(--green)"></i> 월간 루틴</div>`;
                    monthlyGroup.forEach(t => rightCol += tHTML(t));
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
        
        setTimeout(() => { if (typeof updateKbFocus === 'function') updateKbFocus(); }, 10);
    }

    function tHTML(t) {
        const isDone = t.status === 'completed';
        const isSR = state.currentView === 'super-routine';
        let meta = '';
        if (t.isRoutine) {
            let rText = '루틴';
            if (t.recurrence) {
                const rect = t.recurrence;
                const dayNamesKO = ['일', '월', '화', '수', '목', '금', '토'];
                const dayEngToKo = { 'mon':'월', 'tue':'화', 'wed':'수', 'thu':'목', 'fri':'금', 'sat':'토', 'sun':'일' };
                const type = typeof rect === 'string' ? rect : (rect.type || '');
                if (type === 'daily') rText = `매일${rect.time ? ' ' + rect.time : ''}`;
                else if (type === 'every2days') rText = '이틀마다';
                else if (type === 'every3days') rText = '3일마다';
                else if (type === 'weekly') {
                    if (typeof rect === 'object' && rect.days && rect.days.length > 0) {
                        rText = `매주 ${rect.days.map(d => dayNamesKO[d]).join(', ')}요일`;
                    } else rText = '매주';
                } else if (dayEngToKo[type]) {
                    rText = `매주 ${dayEngToKo[type]}요일`;
                } else if (type === 'monthly') {
                    if (typeof rect === 'object' && rect.subType === 'date') rText = `매월 ${rect.day}일`;
                    else if (typeof rect === 'object' && rect.subType === 'relative') {
                        const wNames = ['첫째주', '둘째주', '셋째주', '넷째주', '마지막주'];
                        const w = wNames[rect.weekNum - 1] || `${rect.weekNum}째주`;
                        rText = `매월 ${w} ${dayNamesKO[rect.dayName]}요일`;
                    } else rText = '매월';
                }
            }
            meta += `<span class="meta-tag routine"><i class="fas fa-sync-alt"></i> ${rText}</span>`;
        }
        
        // Hide "until tomorrow" labels for daily routines
        if (t.dueDate && !isDone && !t.isRoutine) {
            const d = new Date(t.dueDate), now = new Date(); now.setHours(0,0,0,0);
            const tmr = new Date(now); tmr.setDate(now.getDate() + 1);
            const dat = new Date(now); dat.setDate(now.getDate() + 2);
            const overdue = d < now;
            const isToday = d.toDateString() === now.toDateString();
            const isTmr = d.toDateString() === tmr.toDateString();
            const isDat = d.toDateString() === dat.toDateString();
            
            let dateLabel = '';
            let label = d.toLocaleDateString('ko-KR',{month:'short',day:'numeric'});
            let cls = '';
            if (isToday) { dateLabel = '오늘'; cls = 'overdue'; }
            else if (isTmr) { dateLabel = '내일'; cls = 'overdue'; }
            else if (isDat) { dateLabel = '모레'; cls = 'warning'; }
            else { dateLabel = label; if(overdue) cls = 'overdue'; }

            const hasTime = (d.getHours() !== 0 || d.getMinutes() !== 0) && !(d.getHours() === 23 && d.getMinutes() === 59);
            if (hasTime) {
                label = `${dateLabel} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}까지`;
            } else {
                label = `${dateLabel}까지`;
            }
            meta += `<span class="meta-tag ${cls}"><i class="far fa-calendar"></i> ${label}</span>`;
        }
        
        let cbStatus = '';
        if (t.isRoutine && !t.isRoutineHistory) {
            // Check if completed in its required period
            const checked = !!getCompletedRoutineInPeriod(t, new Date());
            if (checked) cbStatus = 'cb-done';
        } else if (isDone) cbStatus = 'cb-done';
        
        if (isDone && t.completedAt && !t.isRoutineHistory) {
            const cd = new Date(t.completedAt);
            const cLabel = cd.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' });
            meta += `<span class="meta-tag"><i class="fas fa-check"></i> ${cLabel} 완료</span>`;
        }

        if (t.status === 'paused') {
            meta += `<span class="meta-tag" style="color:var(--orange); font-weight:600;"><i class="fas fa-pause-circle"></i> 비활성화됨</span>`;
        }

        let glowClass = '';
        if (t.dueDate && !isDone && !t.isRoutine) {
            const d = new Date(t.dueDate), now = new Date(); now.setHours(0,0,0,0);
            if (d.toDateString() === now.toDateString()) {
                glowClass = 'glow-red';
            }
        }

        let acts = '';
        if (state.editMode) {
            let catOptions = state.categories.map(c => `<option value="${c.id}" ${c.id===t.categoryId?'selected':''}>${esc(c.name)}</option>`).join('');
            acts = `
            <div class="item-actions visible">
                <select class="cat-change-select">${catOptions}</select>
                <button class="act-btn" data-act="move" data-dir="up"><i class="fas fa-chevron-up"></i></button>
                <button class="act-btn" data-act="move" data-dir="down"><i class="fas fa-chevron-down"></i></button>
                <button class="act-btn del" data-act="delete"><i class="fas fa-trash"></i></button>
            </div>`;
        } else {
            let inner = '';
            if (t.status === 'completed' || t.status === 'deleted' || t.status === 'paused') {
                inner += `<button class="act-btn restore-btn" data-act="restore" title="복구"><i class="fas fa-undo"></i></button>`;
            }
            if (t.status === 'deleted') {
                inner += `<button class="act-btn del" data-act="harddelete" title="영구 삭제"><i class="fas fa-times"></i></button>`;
            } else {
                inner += `<button class="act-btn del" data-act="delete" title="삭제"><i class="fas fa-trash"></i></button>`;
            }
            acts = `<div class="item-actions">${inner}</div>`;
        }

        const cat = state.categories.find(c => c.id === t.categoryId);
        const catColor = cat ? cat.color : '#8e8e93';
        const catIndicator = `<div class="todo-cat-indicator" style="background:${catColor}"></div>`;

        return `<li class="todo-item ${isDone?'completed':''} ${glowClass}" data-id="${t.id}">
            ${catIndicator}
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
                <div class="sidebar-kb-key">3</div>
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

    function parseDate(v) {
        if (!v) return { targetDate: null, matched: null, timeMatched: null };
        const today = new Date(); today.setHours(0,0,0,0);
        let t = null, m = null, timeStr = null;

        // 1. Time Parsing: "12시 30분", "1시까지", "2시 15분까지"
        const timeMatch = v.match(/(\d{1,2})시(\s*(\d{1,2})분)?(\s*까지)?/);
        if (timeMatch) {
            timeStr = timeMatch[0];
        }

        // 2. Date Parsing
        const days = ['일','월','화','수','목','금','토'];
        const regs = [
            { r: /오늘/, d: 0 }, { r: /내일/, d: 1 }, { r: /모레/, d: 2 },
            { r: /이번주\s*([월화수목금토일])요일/, w: 0 },
            { r: /다음주\s*([월화수목금토일])요일/, w: 1 },
            { r: /다다음주\s*([월화수목금토일])요일/, w: 2 },
            { r: /(\d{1,2})월\s*(\d{1,2})일/, f: 'md' },
            { r: /(?<=^|\s)(\d{1,2})[\.\/](\d{1,2})(?=\s|$)/, f: 'md' }
        ];

        for (let obj of regs) {
            const match = v.match(obj.r);
            if (match) {
                m = match[0];
                if (obj.d !== undefined) { 
                    t = new Date(today); 
                    t.setDate(today.getDate() + obj.d); 
                } else if (obj.w !== undefined) {
                    const target = days.indexOf(match[1]);
                    t = new Date(today);
                    t.setDate(today.getDate() + (obj.w * 7) + (target - today.getDay()));
                    // Adjust if "this week Tuesday" is already passed
                    if (obj.w === 0 && t < today) t.setDate(t.getDate() + 7);
                } else if (obj.f === 'md') {
                    t = new Date(today); 
                    t.setMonth(parseInt(match[1]) - 1); 
                    t.setDate(parseInt(match[2]));
                    if (t < today) t.setFullYear(today.getFullYear() + 1);
                }
                break;
            }
        }
        
        // Apply time if found
        if (timeStr) {
            let assumedToday = false;
            if (!t) { t = new Date(today); assumedToday = true; }
            const tm = timeStr.match(/(\d{1,2})시(\s*(\d{1,2})분)?/);
            if (tm) {
                const hh = parseInt(tm[1]);
                const mm = tm[3] ? parseInt(tm[3]) : 0;
                t.setHours(hh, mm, 0, 0);
                if (assumedToday && t < new Date()) t.setDate(t.getDate() + 1);
            }
        }

        return { targetDate: t, matched: m, timeMatched: timeStr };
    }

    function handleHL() {
        const v = el.todoInput.value; 
        
        if (state.cancelAutoParse) {
            el.inputHL.innerHTML = esc(v);
            if (el.cancelAutoBtn) el.cancelAutoBtn.classList.add('hidden');
            return;
        }
        
        const pr = parseDate(v);
        
        const routineMatch = v.match(/(매일|이틀마다|격일|3일마다|삼일마다|매주\s*[월화수목금토일]요일|매달\s*\d{1,2}일|매달\s*[첫둘셋넷마지막]+주\s*[월화수목금토일]요일)(마다)?/);
        
        let toHighlight = [];
        if (pr.matched) toHighlight.push({ text: pr.matched, type: 'date' });
        if (pr.timeMatched) toHighlight.push({ text: pr.timeMatched, type: 'time' });
        if (routineMatch) toHighlight.push({ text: routineMatch[0], type: 'routine' });

        const hashtagMatch = v.match(/#(\S+)/);
        if (hashtagMatch && !state.cancelAutoParse) {
            const cName = hashtagMatch[1];
            const foundCat = state.categories.find(c => c.name === cName);
            if (foundCat) {
                el.catSelect.value = foundCat.id; // Switch category actively
                toHighlight.push({ text: hashtagMatch[0], type: 'routine' }); // Highlight hashtag
            }
        }

        // Remove duplicates and overlaps
        toHighlight = toHighlight.filter((item, index) => {
            return toHighlight.findIndex(h => h.text === item.text) === index;
        });

        if (el.cancelAutoBtn) {
            el.cancelAutoBtn.classList.toggle('hidden', toHighlight.length === 0);
        }

        // Sort by position in string
        const highlightsWithPos = toHighlight.map(h => ({ ...h, pos: v.indexOf(h.text) }))
                                             .filter(h => h.pos !== -1)
                                             .sort((a,b) => a.pos - b.pos);

        let lastIdx = 0;
        let finalHtml = '';
        highlightsWithPos.forEach(h => {
            if (h.pos < lastIdx) return; // Skip overlapping
            finalHtml += esc(v.substring(lastIdx, h.pos));
            let cls = 'highlight-bg';
            if (h.type === 'date' && (h.text.includes('오늘') || h.text.includes('내일'))) cls = 'highlight-bg-red';
            finalHtml += `<span class="${cls}">${esc(h.text)}</span>`;
            lastIdx = h.pos + h.text.length;
        });
        finalHtml += esc(v.substring(lastIdx));
        el.inputHL.innerHTML = finalHtml || esc(v);
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
        
        // --- 리마인더 섹션 (새 컨테이너 sr-reminders-list 사용) ---
        const reminderList = $('sr-reminders-list');
        if (reminderList) reminderList.innerHTML = '';
        const reminders = state.tasks.filter(t => t.status === 'active' && !t.isRoutine && !t.isRoutineHistory && t.text !== "");
        if (reminders.length > 0 && reminderList) {
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
                let catSelect2 = '';
                if (state.hgEditMode) {
                    const opts = state.categories.map(c => `<option value="${c.id}" ${c.id===r.categoryId?'selected':''}>${esc(c.name)}</option>`).join('');
                    catSelect2 = `<select class="hg-cat-select" data-rid="${r.id}">${opts}</select>`;
                }
                const delBtn2 = state.hgEditMode ? `${catSelect2}<i class="fas fa-minus-circle hg-del-btn" data-rid="${r.id}" data-is-reminder="true"></i>` : '';
                const row = document.createElement('div');
                row.className = 'hg-reminder-row';
                row.dataset.rid = r.id;
                row.innerHTML = `
                    <div class="hg-reminder-check" data-act="complete" data-rid="${r.id}"><i class="fas fa-check"></i></div>
                    <div class="hg-reminder-label">${delBtn2}<span class="hg-reminder-text">${esc(r.text)}</span>${dueMeta}</div>
                `;
                reminderList.appendChild(row);
            });
        } else if (reminderList) {
            reminderList.innerHTML = `<div class="empty-state" style="padding:20px 0;"><p style="font-size:0.8rem;">리마인더가 없습니다.</p></div>`;
        }

        // --- 요일 헤더 (리마인더 아래로 이동) ---
        let newH = `<div class="hg-row hg-header"><div class="hg-label">이번 주 계획</div>`;
        const dayNames = ['월','화','수','목','금','토','일'];
        days.forEach((d, idx) => {
            const isToday = d.toDateString() === new Date().toDateString();
            newH += `<div class="hg-cell-hdr ${isToday?'today':''}" data-day-idx="${idx}">${dayNames[idx]}</div>`;
        });
        const headerRow = document.createElement('div');
        headerRow.innerHTML = newH + '</div>';
        el.habitGrid.appendChild(headerRow.firstChild);

        // --- 루틴 섹션 (그룹화) ---
        const allRoutines = getPool().filter(r => {
            const rt = typeof r.recurrence === 'string' ? r.recurrence : (r.recurrence?.type || '');
            return rt !== '';
        });

        const dailyGroup = allRoutines.filter(r => {
            const type = typeof r.recurrence === 'string' ? r.recurrence : r.recurrence.type;
            return type === 'daily' || type === 'everyday';
        });
        const advancedGroup = allRoutines.filter(r => {
            const type = typeof r.recurrence === 'string' ? r.recurrence : r.recurrence.type;
            return type !== 'daily' && type !== 'everyday';
        });

        const renderRoutRow = (r, isAdvanced = false) => {
            const rect = r.recurrence;
            const type = typeof rect === 'string' ? rect : (rect?.type || '');
            const isWeekly = type === 'weekly';
            const isMonthly = type === 'monthly';
            
            let typeLabel = '';
            if (isWeekly) typeLabel = '주간';
            else if (isMonthly) typeLabel = '월간';
            else if (type === 'every2days') typeLabel = '격일';
            else if (type === 'every3days') typeLabel = '3일';
            else if (['mon','tue','wed','thu','fri','sat','sun'].includes(type)) typeLabel = dayNames[['sun','mon','tue','wed','thu','fri','sat'].indexOf(type)];

            const typeBadge = typeLabel ? `<span class="hg-type-badge">${typeLabel}</span>` : '';
            let catSelect = '';
            if (state.hgEditMode) {
                const opts = state.categories.map(c => `<option value="${c.id}" ${c.id===r.categoryId?'selected':''}>${esc(c.name)}</option>`).join('');
                catSelect = `<select class="hg-cat-select" data-rid="${r.id}">${opts}</select>`;
            }
            const delBtn = state.hgEditMode ? `${catSelect}<i class="fas fa-minus-circle hg-del-btn" data-rid="${r.id}"></i>` : '';

            if (isAdvanced) {
                const hasDays = typeof rect === 'object' && rect.days?.length > 0;
                if (hasDays) {
                    const row = document.createElement('div');
                    row.className = 'hg-row';
                    let rowBody = `<div class="hg-label">${delBtn}${typeBadge}${esc(r.text)}</div>`;
                    days.forEach(day => {
                        let cellDisabled = false;
                        if (!rect.days.includes(day.getDay())) cellDisabled = true;
                        
                        const done = state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt).toDateString() === day.toDateString());
                        if (cellDisabled) rowBody += `<div class="hg-cell disabled" style="opacity:0.2; pointer-events:none;"></div>`;
                        else rowBody += `<div class="hg-cell ${done?'done':''}" data-rid="${r.id}" data-day="${day.toISOString()}">${done?'<i class="fas fa-check"></i>':''}</div>`;
                    });
                    row.innerHTML = rowBody;
                    return row;
                } else {
                    let pillCount = 1;
                    if (type === 'every2days') pillCount = 4;
                    else if (type === 'every3days') pillCount = 3;
                    
                    const weekStarts = new Date(days[0]); weekStarts.setHours(0,0,0,0);
                    const weekEnds = new Date(days[6]); weekEnds.setHours(23,59,59,999);
                    const completions = state.tasks.filter(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt) >= weekStarts && new Date(t.completedAt) <= weekEnds).length;
                    
                    let pillsHTML = '';
                    for (let i = 0; i < pillCount; i++) {
                        const isDone = i < completions;
                        pillsHTML += `
                            <div class="hg-cell pill ${isDone?'done':''}" data-rid="${r.id}" data-day="${days[3].toISOString()}" data-weekly="true">
                                ${isDone?'<i class="fas fa-check"></i>':''}
                            </div>
                        `;
                    }
                    
                    const row = document.createElement('div');
                    row.className = 'hg-pill-row';
                    row.innerHTML = `
                        <div class="hg-label">${delBtn}${typeBadge}${esc(r.text)}</div>
                        <div class="hg-pill-container" style="${pillCount > 1 ? 'display:flex; gap:6px;' : ''}">
                            ${pillsHTML}
                        </div>
                    `;
                    return row;
                }
            } else {
                // Standard 7-day row
                const row = document.createElement('div');
                row.className = 'hg-row';
                let rowBody = `<div class="hg-label">${delBtn}${typeBadge}${esc(r.text)}</div>`;
                days.forEach(day => {
                    let cellDisabled = false;
                    if (['sun','mon','tue','wed','thu','fri','sat'].includes(type)) {
                        if (day.getDay() !== ['sun','mon','tue','wed','thu','fri','sat'].indexOf(type)) cellDisabled = true;
                    } else if (isWeekly && typeof rect === 'object' && rect.days) {
                        if (!rect.days.includes(day.getDay())) cellDisabled = true;
                    }
                    const done = state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt).toDateString() === day.toDateString());
                    if (cellDisabled) rowBody += `<div class="hg-cell disabled" style="opacity:0.2; pointer-events:none;"></div>`;
                    else rowBody += `<div class="hg-cell ${done?'done':''}" data-rid="${r.id}" data-day="${day.toISOString()}">${done?'<i class="fas fa-check"></i>':''}</div>`;
                });
                row.innerHTML = rowBody;
                return row;
            }
        };

        if (dailyGroup.length) {
            dailyGroup.forEach(r => el.habitGrid.appendChild(renderRoutRow(r)));
        }
        if (advancedGroup.length) {
            const sep = document.createElement('div'); sep.className = 'hg-separator';
            sep.innerHTML = `<span class="hg-separator-label">주간/월간 루틴</span>`;
            el.habitGrid.appendChild(sep);
            advancedGroup.forEach(r => el.habitGrid.appendChild(renderRoutRow(r, true)));
        }

        // --- Weekly Archiving Logic ---
        const weekKey = startOfThisWeek.toISOString();
        const prevWeekStart = new Date(startOfThisWeek); prevWeekStart.setDate(prevWeekStart.getDate() - 7);
        const prevWeekKey = prevWeekStart.toISOString();

        if (!state.victoryLog.some(l => l.type === 'week-archive' && l.weekKey === prevWeekKey)) {
            // Archive the PREVIOUS week if it hasn't been archived yet
            const prevRoutines = state.tasks.filter(t => t.isRoutineHistory && t.status === 'completed' && new Date(t.completedAt) >= prevWeekStart && new Date(t.completedAt) < startOfThisWeek);
            
            // Collect prev reminders
            const prevReminders = state.tasks.filter(t => {
                if (t.isRoutine || t.isRoutineHistory || t.status === 'deleted') return false;
                const dCheck = new Date(t.completedAt || t.dueDate || t.createdAt || 0);
                return dCheck < startOfThisWeek;
            });

            if (prevRoutines.length > 0 || prevReminders.length > 0) {
                const routineMap = {};
                prevRoutines.forEach(pr => {
                    const rtName = pr.text;
                    routineMap[rtName] = (routineMap[rtName] || 0) + 1;
                });
                const routineChecklist = Object.keys(routineMap).map(k => ({ name: k, count: routineMap[k] }));
                const reminderChecklist = prevReminders.map(r => ({ name: r.text, success: r.status === 'completed' }));
                
                // Archive logic
                state.victoryLog.push({
                    id: Date.now(),
                    type: 'week-archive',
                    title: `${prevWeekStart.getMonth()+1}월 ${Math.ceil(prevWeekStart.getDate()/7)}주차 기록`,
                    date: new Date().toISOString(),
                    weekKey: prevWeekKey,
                    count: prevRoutines.length,
                    routineChecklist: routineChecklist,
                    reminderChecklist: reminderChecklist,
                    badge: 'WEEKLY ARCHIVE'
                });
                
                // Delete old reminders
                prevReminders.forEach(r => { r.status = 'deleted'; });
                
                save();
            }
        }

        // Toggle All Per Day (Excluding Weekly and Monthly as requested)
        el.habitGrid.querySelectorAll('.hg-cell-hdr').forEach(hdr => {
            hdr.onclick = () => {
                hdr.classList.add('active-click');
                setTimeout(() => hdr.classList.remove('active-click'), 200);
                
                const dayIdx = parseInt(hdr.dataset.dayIdx);
                const day = days[dayIdx];
                const ds = day.toDateString();
                
                const cells = Array.from(el.habitGrid.querySelectorAll(`.hg-cell[data-day]`))
                                   .filter(c => {
                                       if (new Date(c.dataset.day).toDateString() !== ds) return false;
                                       const rid = c.dataset.rid;
                                       const t = state.tasks.find(x => x.id == rid);
                                       if (!t) return false;
                                       const rect = t.recurrence;
                                       const type = typeof rect === 'string' ? rect : (rect?.type || '');
                                       return type !== 'weekly' && type !== 'monthly';
                                   });
                
                const allDone = cells.length > 0 && cells.every(c => c.classList.contains('done'));
                
                cells.forEach(c => {
                    const rid = c.dataset.rid;
                    const ex = state.tasks.find(t => t.originalRoutineId === rid && t.status === 'completed' && new Date(t.completedAt).toDateString() === ds);
                    if (allDone) {
                        if (ex) state.tasks = state.tasks.filter(x => x.id !== ex.id);
                    } else {
                        if (!ex) {
                            const rt = state.tasks.find(x => x.id == rid);
                            state.tasks.push({ ...rt, id: Date.now()+'h'+Math.random(), originalRoutineId: rid, status: 'completed', completedAt: day.toISOString(), isRoutineHistory: true });
                        }
                    }
                });
                save(); renderTasks();
            };
        });

        if (allRoutines.length > 0) {
            const allChecked = allRoutines.every(r => days.every(d => state.tasks.some(t => t.originalRoutineId == r.id && t.status === 'completed' && new Date(t.completedAt).toDateString() === d.toDateString())));
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
                    let completionsInWeek = state.tasks.filter(t => t.originalRoutineId == rid && t.status === 'completed' && new Date(t.completedAt) >= weekStarts && new Date(t.completedAt) <= weekEnds);
                    
                    const elIsDone = cell.classList.contains('done');
                    
                    if (elIsDone && completionsInWeek.length > 0) {
                        completionsInWeek.sort((a,b) => new Date(b.completedAt) - new Date(a.completedAt));
                        const latest = completionsInWeek[0];
                        state.tasks = state.tasks.filter(t => t.id !== latest.id);
                    } else if (!elIsDone) {
                        const rt = state.tasks.find(x => x.id == rid);
                        if (rt) state.tasks.push({ ...rt, id: Date.now()+'h', originalRoutineId: rid, status: 'completed', completedAt: new Date().toISOString(), isRoutineHistory: true });
                    }
                } else {
                    const ex = state.tasks.find(t => t.originalRoutineId == rid && t.status === 'completed' && new Date(t.completedAt).toDateString() === ds);
                    if(ex) state.tasks = state.tasks.filter(x => x.id != ex.id);
                    else {
                        const rt = state.tasks.find(x => x.id == rid);
                        if (rt) state.tasks.push({ ...rt, id: Date.now()+'h', originalRoutineId: rid, status: 'completed', completedAt: new Date(cell.dataset.day).toISOString(), isRoutineHistory: true });
                    }
                }
                save(); renderHabitGrid(); renderTasks();
            };
        });

        el.habitGrid.querySelectorAll('.hg-del-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const rid = btn.dataset.rid;
                const isReminder = btn.dataset.isReminder === 'true';
                if (isReminder) {
                    openConfirm('이 리마인더를 삭제할까요?', () => {
                        state.tasks = state.tasks.filter(t => t.id != rid);
                        save(); renderHabitGrid(); renderTasks();
                    });
                } else {
                    openConfirm('이 루틴을 완전히 삭제할까요?', () => {
                        state.tasks = state.tasks.filter(t => t.id != rid && t.originalRoutineId != rid);
                        save(); renderHabitGrid(); renderTasks();
                    });
                }
            };
        });

        // --- 리마인더 섹션 클릭 핸들러 (부모 컨테이너 수정) ---
        (reminderList || document).querySelectorAll('.hg-reminder-check').forEach(btn => {
            btn.onclick = () => {
                const rid = btn.dataset.rid;
                const t = state.tasks.find(x => x.id == rid);
                if (t) {
                    t.status = 'completed';
                    t.completedAt = new Date().toISOString();
                    save(); renderHabitGrid(); renderTasks(); renderChart();
                }
            };
        });

        // --- 루틴/리마인더 카테고리 변경 처리 ---
        (el.habitGrid || document).querySelectorAll('.hg-cat-select').forEach(sel => {
            sel.onchange = (e) => {
                const rid = sel.dataset.rid;
                const t = state.tasks.find(x => x.id == rid);
                if (t) {
                    t.categoryId = e.target.value;
                    save(); renderHabitGrid(); renderTasks(); renderSidebar(); updateDropdown();
                }
            };
        });
        (reminderList || document).querySelectorAll('.hg-cat-select').forEach(sel => {
            sel.onchange = (e) => {
                const rid = sel.dataset.rid;
                const t = state.tasks.find(x => x.id == rid);
                if (t) {
                    t.categoryId = e.target.value;
                    save(); renderHabitGrid(); renderTasks(); renderSidebar(); updateDropdown();
                }
            };
        });
    }

    function renderVictoryLog() {
        if (!el.victoryView) return;
        const perfEl = $('perfect-weeks-count'), totalEl = $('total-routines-checked');
        if (perfEl) perfEl.textContent = state.victoryLog.filter(l => l.type === 'perfect-week').length;
        if (totalEl) {
            totalEl.textContent = state.tasks.filter(t => t.isRoutineHistory && t.status === 'completed').length;
        }

        el.victoryList.innerHTML = '';
        if (!state.victoryLog.length) {
            el.victoryList.innerHTML = `<div class="empty-state"><p>아직 기록된 영광의 순간이 없습니다.</p></div>`;
            return;
        }

        state.victoryLog.slice().reverse().forEach(log => {
            const d = new Date(log.date);
            const dateStr = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
            
            let icon = 'fa-crown';
            let color = 'var(--purple)';
            if (log.type === 'week-archive') {
                icon = 'fa-calendar-check';
                color = 'var(--blue)';
            }

            let checklistHtml = '';
            if (log.type === 'week-archive') {
                const hasDetailedData = (log.routineChecklist && log.routineChecklist.length) || (log.reminderChecklist && log.reminderChecklist.length);
                
                if (hasDetailedData) {
                    if (log.routineChecklist && log.routineChecklist.length) {
                        checklistHtml += `<div style="margin-top:8px; font-size:0.8rem; color:var(--text);"><strong style="color:var(--blue);"><i class="fas fa-sync-alt"></i> 루틴 달성</strong><br>${log.routineChecklist.map(r => `• ${esc(r.name)} ${r.count}회 달성`).join('<br>')}</div>`;
                    }
                    if (log.reminderChecklist && log.reminderChecklist.length) {
                        checklistHtml += `<div style="margin-top:6px; font-size:0.8rem; color:var(--text);"><strong style="color:var(--yellow);"><i class="fas fa-bell"></i> 리마인더</strong><br>${log.reminderChecklist.map(r => `• ${esc(r.name)} ${r.success ? '(성공)' : '(미완료)'}`).join('<br>')}</div>`;
                    }
                } else {
                    // Fallback for older data without checklist info
                    checklistHtml = `<div style="margin-top:8px; font-size:0.75rem; color:var(--text2); font-style:italic;">상세 내역이 전송되지 않은 이전 기록입니다.</div>`;
                }
            }

            el.victoryList.innerHTML += `
                <div class="victory-entry" style="border-left-color:${color}">
                    <div class="v-icon" style="background:${color}1a; color:${color}"><i class="fas ${icon}"></i></div>
                    <div class="v-info" style="flex:1;">
                        <div class="v-title">${esc(log.title)}</div>
                        <div class="v-date">${dateStr}</div>
                        ${log.count ? `<div style="font-size:0.75rem; color:var(--text2); margin-top:4px;"><i class="fas fa-check-circle"></i> 총 ${log.count}개의 실천 기록</div>` : ''}
                        ${checklistHtml}
                    </div>
                    <div class="v-badge" style="background:${color}">${esc(log.badge)}</div>
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
        
        const pool = state.tasks.filter(t => {
            if (t.status !== 'active' || !t.isRoutine || t.isRoutineHistory) return false;
            const rt = typeof t.recurrence === 'string' ? t.recurrence : (t.recurrence?.type || '');
            return rt !== 'monthly';
        });
        // 리마인더도 퍼센트 계산에 포함 (완료 시 카운트, 삭제된 건 제외)
        const reminderPool = state.tasks.filter(t => !t.isRoutine && !t.isRoutineHistory && t.status !== 'deleted');
        const reminderDoneCount = reminderPool.filter(t => t.status === 'completed').length;
        const reminderTotal = reminderPool.length;
        
        const getDailyDoneCount = (ds, dt) => {
            let totalCredit = 0;
            pool.forEach(r => {
                const rt = typeof r.recurrence === 'string' ? r.recurrence : (r.recurrence?.type || '');
                if (['every2days', 'every3days'].includes(rt) || (typeof r.recurrence === 'object' && r.recurrence.days?.length > 0)) {
                    if (state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt).toDateString() === ds)) totalCredit += 1;
                } else if (rt === 'weekly') {
                    const start = new Date(days[0]); start.setHours(0,0,0,0);
                    const end = new Date(days[6]); end.setHours(23,59,59,999);
                    if (state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt) >= start && new Date(t.completedAt) <= end)) totalCredit += 1;
                } else {
                    if (state.tasks.some(t => t.originalRoutineId === r.id && t.status === 'completed' && new Date(t.completedAt).toDateString() === ds)) totalCredit += 1;
                }
            });
            return totalCredit;
        };

        const rates = days.map(day => {
            const ds = day.toDateString();
            const totalItems = pool.length + reminderTotal;
            if (!totalItems) return 0;
            const routineDone = getDailyDoneCount(ds, day);
            return ((routineDone + reminderDoneCount) / totalItems) * 100;
        });

        const routineRates = days.map(day => {
            const ds = day.toDateString();
            if (!pool.length) return 0;
            const routineDone = getDailyDoneCount(ds, day);
            return (routineDone / pool.length) * 100;
        });

        const reminderRatesList = days.map(day => {
            const endOfDay = new Date(day); endOfDay.setHours(23,59,59,999);
            const done = reminderPool.filter(t => t.status === 'completed' && new Date(t.completedAt) <= endOfDay).length;
            return reminderTotal ? (done / reminderTotal) * 100 : 0;
        });

        const weeklyAvg = rates.length ? Math.round(rates.reduce((a,b)=>a+b,0)/7) : 0;
        const weeklyAvgRout = routineRates.length ? Math.round(routineRates.reduce((a,b)=>a+b,0)/7) : 0;
        const weeklyAvgRem = reminderRatesList.length ? Math.round(reminderRatesList.reduce((a,b)=>a+b,0)/7) : 0;

        if(el.todayRate) {
            el.todayRate.innerHTML = `평균 달성 &nbsp;<span style="color:var(--text2)">|</span>&nbsp; 루틴 <span style="color:var(--blue)">${weeklyAvgRout}%</span> &nbsp;<span style="color:var(--text2)">|</span>&nbsp; 리마인더 <span style="color:var(--yellow)">${weeklyAvgRem}%</span>`;
        }
        if(el.rewardChip) {
            el.rewardChip.classList.toggle('hidden', weeklyAvg < 100 || !state.reward);
            if(state.reward) el.rewardChip.innerHTML = `<i class="fas fa-gift"></i> ${esc(state.reward)}`;
        }

        const pad = { l:30, r:10, t:10, b:25 }, gw = W-pad.l-pad.r, gh = H-pad.t-pad.b;
        ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
        if (state.theme === 'dark') ctx.strokeStyle = '#333';
        for(let i=0; i<=4; i++) {
            const y = pad.t + gh - (gh * i/4);
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W-pad.r, y); ctx.stroke();
        }
        
        const drawLine = (data, colorStr, fillStyleStr) => {
            const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + gh);
            grad.addColorStop(0, fillStyleStr); grad.addColorStop(1, 'rgba(255,255,255,0)');
            
            ctx.beginPath();
            data.forEach((r, i) => {
                const x = pad.l + (gw * i/6), y = pad.t + gh - (gh * r/100);
                if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
            });
            ctx.lineTo(pad.l+gw, pad.t+gh); ctx.lineTo(pad.l, pad.t+gh);
            ctx.fillStyle = grad; ctx.fill();

            ctx.beginPath(); ctx.strokeStyle = colorStr; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            data.forEach((r, i) => {
                const x = pad.l + (gw * i/6), y = pad.t + gh - (gh * r/100);
                if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
            });
            ctx.stroke();

            data.forEach((r, i) => {
                const x = pad.l + (gw * i/6), y = pad.t + gh - (gh * r/100);
                ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = state.theme === 'dark' ? '#1c1c1e' : 'white'; ctx.fill();
                ctx.strokeStyle = colorStr; ctx.lineWidth = 1.5; ctx.stroke();
            });
        };

        drawLine(reminderRatesList, '#ff9500', 'rgba(255, 149, 0, 0.15)'); // Yellow
        drawLine(routineRates, '#007aff', 'rgba(0, 122, 255, 0.15)');      // Blue

        ctx.fillStyle = state.theme === 'dark' ? '#a1a1a6' : '#8e8e93';
        ctx.font = '600 10px Inter';
        ctx.textAlign = 'center';
        ['월','화','수','목','금','토','일'].forEach((label, i) => {
            const x = pad.l + (gw * i/6);
            ctx.fillText(label, x, H - 6);
        });
    }

    // --- CALENDAR VIEW: Cute & Glitchy Routine Calendar ---
    let calInitialized = false;
    let calParticles = [];
    let calFxActive = true;
    let calIntervals = { bubble: null, breathe: null };
    let calAnimReq = { particles: null };
    let calCurrentDate = new Date();
    // Use state-based data
    const getCalData = () => state.calendarData || {};
    const setCalData = (data) => { state.calendarData = data; save(); };
    const setCalIsDarkMode = (val) => { state.isOverdoseMode = val; save(); };

    const CAL_DOT_MAPS = {
        empty: [],
        spade: ["....#....", "...###...", "..#####..", ".#######.", "#########", "#########", "....#....", "...###...", "..#####.."],
        o: ["...###...", ".#######.", ".##...##.", ".##...##.", "##.....##", ".##...##.", ".##...##.", ".#######.", "...###..."],
        x: ["##.....##", "###...###", ".###.###.", "..#####..", "...###...", "..#####..", ".###.###.", "###...###", "##.....##"],
        heart: [".###.###.", "#########", "#########", "#########", ".#######.", "..#####..", "...###...", "....#....", "........."],
        club: ["...###...", "..#####..", "...###...", ".#######.", "#########", ".#######.", "....#....", "...###...", "..#####.."],
        diamond: ["....#....", "...###...", "..#####..", ".#######.", "#########", ".#######.", "..#####..", "...###...", "....#...."]
    };
    const CAL_SYMBOL_ORDER = ['empty', 'spade', 'o', 'x', 'heart', 'club', 'diamond'];
    const CAL_FLASH_TEXTS = ['', 'KAWAII!', 'POP!', 'GLITCH!', 'CRASH!', 'OVERDOSE!', 'EE!', 'WARNING!', 'DANGER!', 'MELTDOWN!'];
    const CAL_BUBBLE_PHRASES = ["이스터에그", "OVERDOSE...", "Need more likes!", "Glitch in the matrix", "Do you love me?", "ERROR 404: Sleep", "Y2K FOREVER", "Too much neon!", "Tap me senpai", "MIND = BLOWN", "✝ BLESS ✝", "Pill time?", "Kawaii overload...", "System hacked.", "Notice me!", "10101010", "Dopamine hit!", "Loading happiness...", "Who designed this?", "이스터에그"];

    function initCalendarView() {
        if (calInitialized) { startCalAnimations(); return; }
        calInitialized = true;

        const view = $('calendar-view');
        const canvas = $('ee-bgCanvas'), ctx = canvas.getContext('2d');
        const grid = $('ee-calendarGrid'), monthDisplay = $('ee-monthDisplay');
        const fxBtn = $('ee-fxBtn'), breatheBtn = $('ee-breatheBtn'), blinkBtn = $('ee-blinkBtn'), modeBtn = $('ee-modeToggle');
        
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        window.addEventListener('resize', resize); resize();

        function createSVG(mapKey) {
            const map = CAL_DOT_MAPS[mapKey]; if (!map || !map.length) return '';
            const w = map[0].length, h = map.length;
            let r = '';
            for (let y=0; y<h; y++) {
                for (let x=0; x<w; x++) { if (map[y][x] === '#') r += `<rect x="${x}" y="${y}" width="1" height="1" fill="currentColor" />`; }
            }
            return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${r}</svg>`;
        }

        function spawnParticles(x, y) {
            const colors = ['#00ffff', '#ff00ff', '#ffff00', '#ffffff', '#ff003c', '#39ff14'];
            for (let i=0; i<10; i++) {
                let p = document.createElement('div'); p.className = 'click-particle';
                p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                p.style.left = x + 'px'; p.style.top = y + 'px';
                document.body.appendChild(p);
                let angle = Math.random() * Math.PI * 2, vel = 4 + Math.random() * 6;
                let tx = Math.cos(angle) * vel * 10, ty = Math.sin(angle) * vel * 10;
                requestAnimationFrame(() => { p.style.transform = `translate(${tx}px, ${ty}px) scale(0)`; p.style.opacity = '0'; });
                setTimeout(() => { if(p.parentNode) p.parentNode.removeChild(p); }, 400);
            }
        }
        const updateTheme = () => {
            view.classList.toggle('dark-mode', state.isOverdoseMode);
            modeBtn.innerText = state.isOverdoseMode ? '🎀 Need Cure?' : '💊 OVERDOSE MODE';
            applyDistort();
        };

        const applyDistort = () => {
            view.querySelectorAll('.ee-day-cell').forEach(cell => {
                cell.classList.remove('is-distorting');
                if (state.isOverdoseMode && Math.random() > 0.4) {
                    cell.classList.add('is-distorting');
                    cell.style.setProperty('--distort-dur', (0.5 + Math.random() * 2) + 's');
                    cell.style.setProperty('--distort-delay', (Math.random() * 1.5) + 's');
                }
            });
        };

        modeBtn.onclick = (e) => { 
            state.isOverdoseMode = !state.isOverdoseMode; 
            updateTheme(); 
            spawnParticles(e.clientX, e.clientY); 
            save(); // Save to cloud
        };

        class CalParticle {
            constructor() { this.reset(true); }
            reset(init = false) {
                this.y = Math.random() * canvas.height; this.dir = Math.random() > 0.5 ? 1 : -1;
                this.baseS = (Math.random() * 2 + 1) * this.dir;
                this.x = init ? Math.random() * canvas.width : (this.dir === 1 ? -50 : canvas.width + 50);
                this.size = Math.floor(Math.random() * 3) + 2;
                const colors = ['#00ffff', '#ff00ff', '#ffffff', '#ffff00']; this.color = colors[Math.floor(Math.random() * colors.length)];
                this.trail = Math.random() > 0.7; this.history = [];
            }
            update() {
                if (this.trail) { this.history.push({x:this.x, y:this.y}); if (this.history.length > 20) this.history.shift(); }
                this.x += state.isOverdoseMode ? this.baseS * 5 : this.baseS;
                if ((this.dir === 1 && this.x > canvas.width + 100) || (this.dir === -1 && this.x < -100)) this.reset();
            }
            draw() {
                if (this.trail && this.history.length > 0) {
                    ctx.beginPath(); ctx.moveTo(this.history[0].x, this.history[0].y);
                    for (let i=1; i<this.history.length; i++) ctx.lineTo(this.history[i].x, this.history[i].y);
                    ctx.strokeStyle = this.color; ctx.lineWidth = this.size; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1;
                }
                ctx.fillStyle = this.color; ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.size, this.size);
            }
        }

        const triggerEffect = (el, lvl) => {
            view.classList.toggle('dark-mode', state.isOverdoseMode);
            void view.offsetWidth; 
            if (lvl > 0 && lvl < 10) view.classList.add(`shake-active-${lvl}`);
            const f = document.createElement('div'); f.className = `glitch-flash flash-lvl-${lvl}`; f.textContent = CAL_FLASH_TEXTS[lvl] || 'HIT!';
            el.appendChild(f);
            setTimeout(() => { 
                view.classList.remove(`shake-active-${lvl}`); 
                if (el.contains(f)) el.removeChild(f); 
            }, 200 + (lvl * 50));
        };

        const triggerWipe = (key) => {
            const wrap = view.querySelector('.ee-calendar-wrapper'), head = view.querySelector('.ee-header');
            $('ee-tooltip').style.display = 'none'; wrap.classList.add('falling-wrapper'); head.classList.add('falling-wrapper');
            const frags = view.querySelectorAll('.ee-day-cell, .ee-weekday, .ee-nav-btn, .ee-month-title, .ee-control-btn, .ee-speech-bubble');
            frags.forEach(f => {
                f.style.setProperty('--fall-x', (Math.random()-0.5)*400+'px'); f.style.setProperty('--fall-rot', (Math.random()-0.5)*720+'deg');
                f.style.animationDelay = (Math.random()*0.3)+'s'; if(f.classList.contains('ee-speech-bubble')) f.style.transition = 'none'; f.classList.add('falling');
            });
            setTimeout(() => $('ee-whiteout').classList.add('whiteout-active'), 1000);
            setTimeout(() => {
                const data = getCalData();
                data[key] = { state: 0, color: '' }; 
                setCalData(data);
                if (!state.isOverdoseMode) { state.isOverdoseMode = true; updateTheme(); }
                wrap.classList.remove('falling-wrapper'); head.classList.remove('falling-wrapper');
                frags.forEach(f => { 
                    f.classList.remove('falling'); 
                    f.style.removeProperty('animation-delay'); 
                    f.style.removeProperty('--fall-x');
                    f.style.removeProperty('--fall-rot');
                });
                view.querySelectorAll('.ee-speech-bubble').forEach(b => { if(b.parentNode) b.parentNode.removeChild(b); });
                render(); $('ee-whiteout').classList.remove('whiteout-active');
            }, 1800);
        };

        const render = () => {
            grid.innerHTML = '';
            const y = calCurrentDate.getFullYear(), m = calCurrentDate.getMonth();
            monthDisplay.innerHTML = `<span>${y}. ${String(m+1).padStart(2,'0')}</span>`;
            const first = new Date(y, m, 1).getDay(), total = new Date(y,m+1,0).getDate();
            for (let i=0; i<first; i++) { const e = document.createElement('div'); e.className = 'ee-day-cell empty'; grid.appendChild(e); }
            for (let d=1; d<=total; d++) {
                const cell = document.createElement('div'); cell.className = 'ee-day-cell';
                const key = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                cell.innerHTML = `<div class="ee-date-num">${d}</div><div class="ee-symbol"></div>`;
                const symEl = cell.querySelector('.ee-symbol');
                let data = getCalData()[key], lvl = (data && typeof data === 'object') ? (data.state || 0) : (data || 0);
                let col = (data && typeof data === 'object') ? (data.color || '') : '';
                if (lvl > 0 && lvl < 10) {
                    if (!col) col = ['#00ffff', '#ff00ff', '#ffff00', '#ffffff', '#ff003c', '#39ff14'][Math.floor(Math.random()*6)];
                    symEl.innerHTML = createSVG(CAL_SYMBOL_ORDER[((lvl-1)%6)+1]);
                    symEl.style.color = col; symEl.style.setProperty('--current-neon', col); symEl.style.setProperty('--rand-delay', Math.random()+'s'); symEl.classList.add('neon-active');
                }
                cell.onmousemove = (e) => { const t = $('ee-tooltip'); t.style.left = (e.clientX+15)+'px'; t.style.top = (e.clientY+15)+'px'; t.style.display = 'block'; t.innerText = lvl === 0 ? "Empty..." : (lvl < 10 ? `Lv.${lvl} - ${CAL_FLASH_TEXTS[lvl]}` : "OVERDOSE..."); };
                cell.onmouseleave = () => $('ee-tooltip').style.display = 'none';
                cell.onmousedown = (e) => {
                    if ($('ee-whiteout').classList.contains('whiteout-active')) return;
                    spawnParticles(e.clientX, e.clientY); lvl++;
                    if (lvl >= 10) { triggerWipe(key); return; }
                    col = ['#00ffff', '#ff00ff', '#ffff00', '#ffffff', '#ff003c', '#39ff14'][Math.floor(Math.random()*6)];
                    const data = getCalData();
                    data[key] = { state: lvl, color: col }; 
                    setCalData(data);
                    symEl.innerHTML = createSVG(CAL_SYMBOL_ORDER[((lvl-1)%6)+1]);
                    symEl.style.color = col; symEl.style.setProperty('--current-neon', col); symEl.style.setProperty('--rand-delay', Math.random()+'s'); symEl.classList.add('neon-active');
                    triggerEffect(cell, lvl);
                };
                grid.appendChild(cell);
            }
            applyDistort();
        };

        const spawnBubble = () => {
            if ($('ee-whiteout').classList.contains('whiteout-active') || state.currentView !== 'calendar') return;
            const b = document.createElement('div'); b.className = 'ee-speech-bubble';
            b.textContent = CAL_BUBBLE_PHRASES[Math.floor(Math.random()*CAL_BUBBLE_PHRASES.length)];
            const y = 20 + Math.random() * (window.innerHeight - 80); b.style.top = y + 'px';
            const isR = Math.random() > 0.5, dur = state.isOverdoseMode ? 2 + Math.random()*3 : 8 + Math.random()*12;
            if (isR) { b.style.left = '-250px'; view.appendChild(b); setTimeout(() => { b.style.transition = `left ${dur}s linear`; b.style.left = '110vw'; }, 50); }
            else { b.style.left = '110vw'; view.appendChild(b); setTimeout(() => { b.style.transition = `left ${dur}s linear`; b.style.left = '-250px'; }, 50); }
            setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, dur * 1000 + 100);
        };

        // Controls
        fxBtn.onclick = () => { calFxActive = !calFxActive; fxBtn.textContent = calFxActive ? 'INTERNET FX: ON' : 'INTERNET FX: OFF'; fxBtn.classList.toggle('active', calFxActive); };
        breatheBtn.onclick = () => {
            if (calIntervals.breathe) { clearInterval(calIntervals.breathe); calIntervals.breathe = null; breatheBtn.textContent = 'TITLE BREATHE: OFF'; breatheBtn.classList.remove('active'); }
            else { 
                let h = 0; breatheBtn.textContent = 'TITLE BREATHE: ON'; breatheBtn.classList.add('active');
                calIntervals.breathe = setInterval(() => { h = (h+15)%360; monthDisplay.style.setProperty('--current-neon', `hsl(${h}, 100%, 65%)`); }, 300);
            }
        };
        blinkBtn.onclick = () => { 
            const active = monthDisplay.classList.toggle('ee-title-blink');
            blinkBtn.textContent = active ? 'TITLE BLINK: ON' : 'TITLE BLINK: OFF'; blinkBtn.classList.toggle('active', active);
        };
        $('ee-prevBtn').onclick = (e) => { spawnParticles(e.clientX, e.clientY); calCurrentDate.setMonth(calCurrentDate.getMonth() - 1); render(); };
        $('ee-nextBtn').onclick = (e) => { spawnParticles(e.clientX, e.clientY); calCurrentDate.setMonth(calCurrentDate.getMonth() + 1); render(); };

        monthDisplay.onclick = (e) => {
            spawnParticles(e.clientX, e.clientY);
            const colors = ['#00ffff', '#ff00ff', '#ffff00', '#ffffff', '#ff003c', '#39ff14'];
            const newNeonColor = colors[Math.floor(Math.random() * colors.length)];
            monthDisplay.style.setProperty('--current-neon', newNeonColor);
        };

        // Main Loop
        function animate() {
            if (state.currentView !== 'calendar') return;
            if (calFxActive) { ctx.clearRect(0,0,canvas.width,canvas.height); calParticles.forEach(p => { p.update(); p.draw(); }); }
            else ctx.clearRect(0,0,canvas.width,canvas.height);
            calAnimReq.particles = requestAnimationFrame(animate);
        }

        // Init
        $('ee-manicText').innerText = "이스터에그 ".repeat(500);
        updateTheme();
        for (let i=0; i<80; i++) calParticles.push(new CalParticle());
        startCalAnimations();
        render();

        function startCalAnimations() {
            if (!calIntervals.bubble) calIntervals.bubble = setInterval(spawnBubble, 2000);
            if (!calAnimReq.particles) animate();
        }
    }

    window.stopCalendar = function() {
        clearInterval(calIntervals.bubble); calIntervals.bubble = null;
        clearInterval(calIntervals.breathe); calIntervals.breathe = null;
        cancelAnimationFrame(calAnimReq.particles); calAnimReq.particles = null;
    };

    // FIREBASE INITIALIZATION ENTRY
    setupAuth();
});
