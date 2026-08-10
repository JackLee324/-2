        const BASE_API_URL = '';
        // 纯内存凭证，刷新页面或关闭标签后自动销毁，不可逆
        window.currentAdminToken = null;

        // ─── Admin Auth State Machine ────────────────────────────────────────────────
        function getAdminToken() { return window.currentAdminToken; }

        function initAdminAuth() {
            // 每次页面加载强制显示锁屏，不读取任何本地缓存
            showLoginOverlay();
        }

        function showLoginOverlay() {
            const overlay = document.getElementById('adminLoginOverlay');
            if (overlay) {
                overlay.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
                document.getElementById('loginPasswordInput').value = '';
                document.getElementById('loginError').style.display = 'none';
                document.getElementById('loginPasswordInput').focus();
            }
        }

        function hideLoginOverlay() {
            const overlay = document.getElementById('adminLoginOverlay');
            if (overlay) {
                overlay.classList.add('hidden');
                document.body.style.overflow = '';
            }
        }

        async function attemptLogin() {
            const pwd = document.getElementById('loginPasswordInput').value;
            const errEl = document.getElementById('loginError');
            errEl.style.display = 'none';
            if (!pwd) {
                errEl.textContent = '请输入密码';
                errEl.style.display = 'block';
                return;
            }
            try {
                const res = await fetch(BASE_API_URL + '/api/admin/login', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                    body: JSON.stringify({ password: pwd })
                });
                const json = await res.json();
                if (json.success) {
                    window.currentAdminToken = json.token;
                    hideLoginOverlay();
                    showToast('✅ 已解锁管理后台', 'success');
                } else {
                    errEl.textContent = json.error || '安全密码错误，请重新输入';
                    errEl.style.display = 'block';
                    document.getElementById('loginPasswordInput').value = '';
                    document.getElementById('loginPasswordInput').focus();
                }
            } catch (e) {
                errEl.textContent = '网络错误，请稍后重试';
                errEl.style.display = 'block';
            }
        }

        function adminLogout() {
            window.currentAdminToken = null;
            showLoginOverlay();
        }

        async function handlePasswordChange() {
            const oldPwd = document.getElementById('secOldPassword').value;
            const newPwd = document.getElementById('secNewPassword').value;
            const confirmPwd = document.getElementById('secConfirmPassword').value;
            const msgEl = document.getElementById('secMessage');
            const btn = document.getElementById('secChangeBtn');
            msgEl.textContent = '';
            msgEl.style.color = '';

            if (!oldPwd || !newPwd || !confirmPwd) {
                msgEl.textContent = '请填写所有字段';
                msgEl.style.color = '#DC2626';
                return;
            }
            if (newPwd.length < 6) {
                msgEl.textContent = '新密码长度至少6位';
                msgEl.style.color = '#DC2626';
                return;
            }
            if (newPwd !== confirmPwd) {
                msgEl.textContent = '两次输入的新密码不一致';
                msgEl.style.color = '#DC2626';
                return;
            }
            btn.disabled = true;
            btn.textContent = '修改中...';
            try {
                const res = await fetch(BASE_API_URL + '/api/admin/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                    body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd })
                });
                const json = await res.json();
                if (json.success) {
                    window.currentAdminToken = null;
                    msgEl.textContent = '✅ 密码修改成功，正在重新登录...';
                    msgEl.style.color = '#2A9D8F';
                    setTimeout(() => { window.location.reload(); }, 1500);
                } else {
                    msgEl.textContent = json.error || '修改失败';
                    msgEl.style.color = '#DC2626';
                    btn.disabled = false;
                    btn.textContent = '🔒 确认修改';
                }
            } catch (e) {
                msgEl.textContent = '网络错误，请稍后重试';
                msgEl.style.color = '#DC2626';
                btn.disabled = false;
                btn.textContent = '🔒 确认修改';
            }
        }

        // Run auth check on page load
        initAdminAuth();
        const API = '/api/curriculum';
        let currentTab = 'prek';
        let allData = { prek: [], k: [], climbing: [] };
        let editTarget = null;   // { tab, index }
        let deleteTarget = null; // { tab, index }

        // Default color map
        const COLOR_DEFAULTS = {
            'Moving Safely': { bg: '#F4A261', text: '#7C3A00' },
            'Locomotor Movement Skills': { bg: '#2A9D8F', text: '#FFFFFF' },
            'Locomotor Movement': { bg: '#2A9D8F', text: '#FFFFFF' },
            'Fundamental Movement Skills': { bg: '#2A9D8F', text: '#FFFFFF' },
            'Manipulative Skills': { bg: '#1D3557', text: '#FFFFFF' },
            'Olympic Month': { bg: '#E63946', text: '#FFFFFF' },
            'Gymnastics': { bg: '#1D3557', text: '#FFFFFF' },
            'Climbing': { bg: '#F4A261', text: '#7C3A00' },
            'Swimming': { bg: '#2A9D8F', text: '#FFFFFF' },
        };

        // ─── Init ────────────────────────────────────────────────────────────────────
        document.addEventListener('DOMContentLoaded', loadAll);

        async function loadAll() {
            try {
                const res = await fetch(API + '?t=' + Date.now());
                const json = await res.json();
                if (json.success) {
                    allData = json.data;
                    renderTable();
                }
            } catch (e) {
                showToast('❌ 无法连接后端服务，请先运行 npm start', 'error');
            }
        }

        // ─── Tab Switch ─────────────────────────────────────────────────────────────
        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.tab === tab);
            });
            document.getElementById('currentTabLabel').textContent =
                { prek: 'PreK PE', k: 'K PE', climbing: 'Climbing & Swimming', gallery: '奥林匹克相册', parkour: '晨间跑酷管理', calendar: '在线校历管理', venues: '场地赋能管理', reservations: '场地预约管理', security: '安全设置' }[tab] || tab;

            // Show/hide curriculum section
            const tableWrap = document.querySelector('.table-wrap');
            const toolbar = document.querySelector('.toolbar');
            if (tableWrap) tableWrap.classList.toggle('hidden', tab === 'gallery' || tab === 'parkour' || tab === 'calendar' || tab === 'venues' || tab === 'reservations' || tab === 'security');
            if (toolbar) toolbar.classList.toggle('hidden', tab === 'gallery' || tab === 'parkour' || tab === 'calendar' || tab === 'venues' || tab === 'reservations' || tab === 'security');

            // Show/hide gallery section
            const gallerySection = document.getElementById('gallerySection');
            const uploadSection = document.getElementById('galleryUploadSection');
            if (gallerySection) gallerySection.classList.toggle('hidden', tab !== 'gallery');
            if (uploadSection) uploadSection.classList.toggle('hidden', tab !== 'gallery');

            // Show/hide parkour section
            const parkourSection = document.getElementById('parkourSection');
            const parkourUploadSection = document.getElementById('parkourUploadSection');
            const parkourVideoSection = document.getElementById('parkourVideoSection');
            if (parkourSection) parkourSection.classList.toggle('hidden', tab !== 'parkour');
            if (parkourUploadSection) parkourUploadSection.classList.toggle('hidden', tab !== 'parkour');
            if (parkourVideoSection) parkourVideoSection.classList.toggle('hidden', tab !== 'parkour');

            // Show/hide calendar section
            const noticePanel     = document.getElementById('noticePanel');
            const themeConfigSection = document.getElementById('themeConfigSection');
            const calSection = document.getElementById('calSection');
            const calListSection = document.getElementById('calListSection');
            if (noticePanel)         noticePanel.classList.toggle('hidden', tab !== 'calendar');
            if (themeConfigSection)  themeConfigSection.classList.toggle('hidden', tab !== 'calendar');
            if (calSection)         calSection.classList.toggle('hidden', tab !== 'calendar');
            if (calListSection)     calListSection.classList.toggle('hidden', tab !== 'calendar');

            // Show/hide venues section
            const venuesSection = document.getElementById('venuesSection');
            if (venuesSection) venuesSection.classList.toggle('hidden', tab !== 'venues');

            // Show/hide reservations section
            const reservationsSection = document.getElementById('reservationsSection');
            if (reservationsSection) reservationsSection.classList.toggle('hidden', tab !== 'reservations');

            // Show/hide security section
            const securitySection = document.getElementById('securitySection');
            if (securitySection) securitySection.classList.toggle('hidden', tab !== 'security');

            if (tab === 'gallery') {
                renderGallery();
            } else if (tab === 'parkour') {
                renderParkourTable();
                renderParkourVideoTable();
            } else if (tab === 'calendar') {
                loadCalendarData().then(() => { renderCalendarTable(); renderThemeList(); loadNoticePanel(); });
            } else if (tab === 'venues') {
                initVenuesTab();
            } else if (tab === 'reservations') {
                initReservationsTab();
            } else {
                renderTable();
            }
        }

        // ─── Render ─────────────────────────────────────────────────────────────────
        function renderTable() {
            const rows = allData[currentTab] || [];
            const dataRows = rows.filter(r => r.week);
            document.getElementById('rowCount').textContent = dataRows.length;
            const tbody = document.getElementById('tableBody');

            if (rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#94A3B8;">暂无数据</td></tr>';
                return;
            }

            tbody.innerHTML = rows.map((row, i) => {
                if (row.holiday) {
                    return `<tr class="row-holiday"><td colspan="5">🎉 ${escapeHtml(row.holiday)}</td></tr>`;
                }
                if (row.semester) {
                    return `<tr class="row-semester"><td colspan="5">${escapeHtml(row.semester)}</td></tr>`;
                }
                const bg = row.bgColor || '#1D3557';
                const fg = row.textColor || '#FFFFFF';
                const badgeStyle = `background:${bg};color:${fg};`;
                const subunitHTML = formatSubunitDisplay(row.subunit || '');
                return `<tr>
            <td><span class="week-badge">W${escapeHtml(row.week || '')}</span></td>
            <td style="color:#64748B;font-size:0.82rem;">${escapeHtml(row.month || '')}</td>
            <td>
                <span class="unit-badge" style="${badgeStyle}" onclick="editRow(${i})" title="点击编辑颜色">
                    <span class="color-swatch" style="background:${bg};border-color:${fg};"></span>
                    ${escapeHtml(row.unit || '')}
                </span>
            </td>
            <td class="subunit-preview">${subunitHTML}</td>
            <td style="text-align:center;">
                <button class="btn btn-sm btn-slate" onclick="editRow(${i})">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRow(${i})">🗑</button>
            </td>
        </tr>`;
            }).join('');
        }

        // ─── Sub-Unit Preview Formatter ─────────────────────────────────────────────
        function formatSubunitDisplay(text) {
            if (!text || !text.trim()) return '<span style="color:#CBD5E1;">—</span>';
            if (!text.includes('\n')) {
                const m = text.match(/^(.+?)\s*\(([^)]+)\)$/);
                if (m) return `<span class="line"><span class="title">${escapeHtml(m[1])}</span><span class="desc">(${escapeHtml(m[2])})</span></span>`;
                return `<span class="line"><span class="title">${escapeHtml(text)}</span></span>`;
            }
            return text.split('\n').filter(l => l.trim()).map(line => {
                const m = line.match(/^(.+?)\s*\(([^)]+)\)$/);
                if (m) return `<span class="line"><span class="title">${escapeHtml(m[1])}</span><span class="desc">(${escapeHtml(m[2])})</span><span class="newline"></span></span>`;
                return `<span class="line"><span class="title">${escapeHtml(line.trim())}</span><span class="newline"></span></span>`;
            }).join('');
        }

        // ─── Row Type Toggle ─────────────────────────────────────────────────────────
        function toggleRowTypeFields() {
            const type = document.querySelector('input[name="rowType"]:checked').value;
            document.getElementById('weekRowFields').classList.toggle('hidden', type !== 'week');
            document.getElementById('holidayRowFields').classList.toggle('hidden', type !== 'holiday');
            document.getElementById('semesterRowFields').classList.toggle('hidden', type !== 'semester');
            document.getElementById('modalHeader').className = `modal-header ${type === 'holiday' ? 'holiday' : type === 'semester' ? 'semester' : 'add'}`;
            document.getElementById('modalTitle').textContent =
                type === 'holiday' ? '🎉 添加假期行' :
                    type === 'semester' ? '📋 添加学期标题' : '➕ 添加数据行';
        }

        // ─── Color Sync ─────────────────────────────────────────────────────────────
        function syncColorText(type) {
            if (type === 'bg') {
                document.getElementById('f_bgColorText').value = document.getElementById('f_bgColor').value;
            } else {
                document.getElementById('f_textColorText').value = document.getElementById('f_textColor').value;
            }
            updateColorPreview();
        }

        function syncColorPicker(type) {
            const textVal = type === 'bg' ? document.getElementById('f_bgColorText').value : document.getElementById('f_textColorText').value;
            const picker = type === 'bg' ? document.getElementById('f_bgColor') : document.getElementById('f_textColor');
            if (/^#[0-9A-Fa-f]{6}$/.test(textVal)) {
                picker.value = textVal;
                updateColorPreview();
            }
        }

        function resetColors() {
            const unit = document.getElementById('f_unit').value;
            const defaults = COLOR_DEFAULTS[unit] || { bg: '#1D3557', text: '#FFFFFF' };
            document.getElementById('f_bgColor').value = defaults.bg;
            document.getElementById('f_bgColorText').value = defaults.bg;
            document.getElementById('f_textColor').value = defaults.text;
            document.getElementById('f_textColorText').value = defaults.text;
            updateColorPreview();
        }

        function updateColorPreview() {
            const unit = document.getElementById('f_unit').value || 'Unit Name';
            const bg = document.getElementById('f_bgColor').value;
            const fg = document.getElementById('f_textColor').value;
            const preview = document.getElementById('colorPreview');
            preview.style.background = bg;
            preview.style.color = fg;
            preview.textContent = unit;
        }

        // ─── Unit Change Handler ─────────────────────────────────────────────────────
        function onUnitChange() {
            const unit = document.getElementById('f_unit').value;
            const defaults = COLOR_DEFAULTS[unit] || { bg: '#1D3557', text: '#FFFFFF' };
            document.getElementById('f_bgColor').value = defaults.bg;
            document.getElementById('f_bgColorText').value = defaults.bg;
            document.getElementById('f_textColor').value = defaults.text;
            document.getElementById('f_textColorText').value = defaults.text;
            updateColorPreview();
        }

        // ─── Show Add Modal ──────────────────────────────────────────────────────────
        function showAddModal(type) {
            editTarget = null;
            document.getElementById('modalForm').reset();
            document.getElementById('rowTypeSection').classList.remove('hidden');
            document.querySelector('input[name="rowType"][value="week"]').checked = true;
            toggleRowTypeFields();

            // Default colors
            document.getElementById('f_bgColor').value = '#1D3557';
            document.getElementById('f_bgColorText').value = '#1D3557';
            document.getElementById('f_textColor').value = '#FFFFFF';
            document.getElementById('f_textColorText').value = '#FFFFFF';
            updateColorPreview();

            if (type === 'holiday') {
                document.querySelector('input[name="rowType"][value="holiday"]').checked = true;
                toggleRowTypeFields();
            } else if (type === 'semester') {
                document.querySelector('input[name="rowType"][value="semester"]').checked = true;
                toggleRowTypeFields();
            }

            document.getElementById('modal').classList.remove('hidden');
        }

        // ─── Edit Row ───────────────────────────────────────────────────────────────
        function editRow(index) {
            const row = allData[currentTab][index];
            editTarget = { tab: currentTab, index };

            document.getElementById('rowTypeSection').classList.add('hidden');
            document.getElementById('modalHeader').className = 'modal-header edit';
            document.getElementById('modalTitle').textContent = '✏️ 编辑数据行';

            if (row.holiday) {
                document.querySelector('input[name="rowType"][value="holiday"]').checked = true;
                toggleRowTypeFields();
                document.getElementById('f_holiday').value = row.holiday;
            } else if (row.semester) {
                document.querySelector('input[name="rowType"][value="semester"]').checked = true;
                toggleRowTypeFields();
                document.getElementById('f_semester').value = row.semester;
            } else {
                document.querySelector('input[name="rowType"][value="week"]').checked = true;
                toggleRowTypeFields();
                document.getElementById('f_week').value = row.week || '';
                document.getElementById('f_month').value = row.month || '';
                document.getElementById('f_unit').value = row.unit || '';
                document.getElementById('f_subunit').value = row.subunit || '';
                document.getElementById('f_events').value = row.events || '';
                document.getElementById('f_wd').value = row.wd || '';
                const bg = row.bgColor || (COLOR_DEFAULTS[row.unit] || {}).bg || '#1D3557';
                const fg = row.textColor || (COLOR_DEFAULTS[row.unit] || {}).text || '#FFFFFF';
                document.getElementById('f_bgColor').value = bg;
                document.getElementById('f_bgColorText').value = bg;
                document.getElementById('f_textColor').value = fg;
                document.getElementById('f_textColorText').value = fg;
                updateColorPreview();
            }

            document.getElementById('modal').classList.remove('hidden');
        }

        // ─── Close Modal ─────────────────────────────────────────────────────────────
        function closeModal() {
            document.getElementById('modal').classList.add('hidden');
        }

        // ─── Form Submit ─────────────────────────────────────────────────────────────
        async function handleFormSubmit(e) {
            e.preventDefault();
            const type = document.querySelector('input[name="rowType"]:checked').value;
            const tab = editTarget ? editTarget.tab : currentTab;
            const idx = editTarget ? editTarget.index : -1;

            let newRow;
            if (type === 'holiday') {
                newRow = { holiday: document.getElementById('f_holiday').value.trim() };
            } else if (type === 'semester') {
                newRow = { semester: document.getElementById('f_semester').value.trim() };
            } else {
                const week = document.getElementById('f_week').value.trim();
                const month = document.getElementById('f_month').value.trim();
                const unit = document.getElementById('f_unit').value.trim();
                const subunit = document.getElementById('f_subunit').value.trim();
                if (!week || !month || !unit || !subunit) {
                    showToast('⚠️ Week、Month、Unit、Sub-Unit 为必填项', 'error');
                    return;
                }
                newRow = {
                    week, month, unit, subunit,
                    events: document.getElementById('f_events').value.trim(),
                    wd: document.getElementById('f_wd').value.trim(),
                    bgColor: document.getElementById('f_bgColor').value,
                    textColor: document.getElementById('f_textColor').value,
                };
            }

            try {
                if (idx >= 0) {
                    allData[tab][idx] = newRow;
                } else {
                    allData[tab].push(newRow);
                }

                const res = await fetch(`${API}/${tab}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                    body: JSON.stringify(allData[tab]),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);

                closeModal();
                renderTable();
                showToast(idx >= 0 ? '✅ 已更新' : '✅ 已添加', 'success');
            } catch (err) {
                showToast('❌ 保存失败: ' + err.message, 'error');
            }
        }

        // ─── Delete ─────────────────────────────────────────────────────────────────
        function deleteRow(index) {
            const row = allData[currentTab][index];
            deleteTarget = { tab: currentTab, index };
            const label = row.holiday || row.semester || (`W${row.week} — ${(row.subunit || '').substring(0, 40)}`);
            document.getElementById('deleteModalMsg').textContent = `确定要删除「${label}」吗？此操作不可撤销。`;
            document.getElementById('deleteModal').classList.remove('hidden');
        }

        async function confirmDelete() {
            // Gallery context
            if (currentTab === 'gallery' && deleteGalleryTarget) {
                await confirmGalleryDelete();
                return;
            }
            // Parkour context
            if (currentTab === 'parkour' && deleteParkourTarget) {
                await confirmParkourDelete();
                return;
            }
            // Curriculum delete
            if (!deleteTarget) return;
            const { tab, index } = deleteTarget;

            try {
                allData[tab].splice(index, 1);
                const res = await fetch(`${API}/${tab}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                    body: JSON.stringify(allData[tab]),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);

                closeDeleteModal();
                renderTable();
                showToast('✅ 已删除', 'success');
            } catch (err) {
                showToast('❌ 删除失败: ' + err.message, 'error');
            }
        }

        async function confirmGalleryDelete() {
            if (!deleteGalleryTarget) return;
            const item = galleryItems[deleteGalleryTarget.index];
            if (!item) return;
            try {
                const res = await fetch(`${GALLERY_API}/gallery/${item.id}`, { method: 'DELETE', headers: { 'X-Admin-Token': getAdminToken() || '' } });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                closeDeleteModal();
                renderGallery();
                showToast('✅ 已删除', 'success');
            } catch (err) {
                showToast('❌ 删除失败: ' + err.message, 'error');
            }
        }

        function closeDeleteModal() {
            document.getElementById('deleteModal').classList.add('hidden');
            deleteTarget = null;
            deleteGalleryTarget = null;
            deleteParkourTarget = null;
        }

        async function confirmParkourDelete() {
            if (!deleteParkourTarget) return;
            const { index, imagePath } = deleteParkourTarget;
            const row = parkourData[index];
            if (!row) return;
            try {
                // Delete physical image file
                if (imagePath) {
                    await fetch(BASE_API_URL + '/api/parkour-image', {
                        method: 'DELETE',
                        headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                        body: JSON.stringify({ imagePath })
                    });
                }
                // Remove from data
                parkourData.splice(index, 1);
                // Save to backend
                const res = await fetch(BASE_API_URL + '/api/parkour', {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                    body: JSON.stringify(parkourData)
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                closeDeleteModal();
                renderParkourTable();
                showToast('✅ 已删除', 'success');
            } catch (err) {
                showToast('❌ 删除失败: ' + err.message, 'error');
            }
        }

        // ─── Toast ───────────────────────────────────────────────────────────────────
        function showToast(msg, type = 'success') {
            const t = document.getElementById('toast');
            t.textContent = msg;
            t.style.background = type === 'error' ? '#DC2626' : '#1D3557';
            t.style.display = 'block';
            setTimeout(() => { t.style.display = 'none'; }, 3000);
        }

        // ─── Escape ──────────────────────────────────────────────────────────────────
        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        // ─── Gallery Tab Logic ──────────────────────────────────────────────────────────
        const GALLERY_API = '/api';
        let galleryItems = [];

        // (switchTab is already defined above — shared between curriculum and gallery tabs)

        // File preview before upload
        function previewGalleryFile(input) {
            const preview = document.getElementById('galleryFilePreview');
            const videoPreview = document.getElementById('galleryVideoPreview');
            const imgPreview = document.getElementById('galleryImgPreview');
            if (!input.files || !input.files[0]) return;
            const file = input.files[0];
            const isVideo = file.type.startsWith('video/');
            preview.style.display = 'block';
            if (isVideo) {
                videoPreview.style.display = 'block';
                imgPreview.style.display = 'none';
                videoPreview.src = URL.createObjectURL(file);
            } else {
                videoPreview.style.display = 'none';
                imgPreview.style.display = 'block';
                imgPreview.src = URL.createObjectURL(file);
            }
        }

        // Handle gallery upload
        async function handleGalleryUpload(e) {
            e.preventDefault();
            const fileInput = document.getElementById('galleryFileInput');
            const captionInput = document.getElementById('galleryCaption');
            const dateInput = document.getElementById('galleryDate');
            const btn = document.getElementById('galleryUploadBtn');

            if (!fileInput.files[0]) {
                showToast('⚠️ 请先选择文件', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('caption', captionInput.value.trim());
            formData.append('date', dateInput.value.trim());

            btn.disabled = true;
            btn.textContent = '⬆️ 上传中...';
            try {
                const res = await fetch(`${GALLERY_API}/upload`, { method: 'POST', headers: { 'X-Admin-Token': getAdminToken() || '' }, body: formData });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                showToast('✅ 上传成功', 'success');
                // Reset form
                document.getElementById('galleryUploadForm').reset();
                document.getElementById('galleryFilePreview').style.display = 'none';
                renderGallery();
            } catch (err) {
                showToast('❌ 上传失败: ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = '⬆️ 上传';
            }
        }

        // Load gallery items
        async function renderGallery() {
            const tbody = document.getElementById('galleryBody');
            if (!tbody) return;
            try {
                const res = await fetch(`${GALLERY_API}/gallery?t=` + Date.now());
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                galleryItems = json.data || [];
                renderGalleryTable();
            } catch (err) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:#DC2626;">加载失败：${err.message}</td></tr>`;
            }
        }

        function renderGalleryTable() {
            const tbody = document.getElementById('galleryBody');
            if (!tbody) return;
            if (galleryItems.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#94A3B8;">暂无照片或视频</td></tr>';
                return;
            }
            tbody.innerHTML = galleryItems.map((item, i) => {
                const src = `assets/olympic/${item.filename}`;
                const thumbStyle = 'width:120px;height:80px;object-fit:cover;border-radius:8px;display:block;';
                const preview = item.type === 'video'
                    ? `<video src="${src}" style="${thumbStyle}" muted preload="none"></video>`
                    : `<img src="${src}" alt="${escapeHtml(item.caption || '')}" style="${thumbStyle}">`;
                return `<tr>
            <td><span style="font-size:1.2rem;">${item.type === 'video' ? '🎬' : '📷'}</span></td>
            <td><a href="${src}" target="_blank">${preview}</a></td>
            <td>
                <div style="font-weight:600;color:#1D3557;font-size:0.85rem;">${escapeHtml(item.caption || '—')}</div>
                <div style="color:#94A3B8;font-size:0.75rem;margin-top:2px;">${escapeHtml(item.originalName || item.filename)}</div>
            </td>
            <td style="color:#64748B;font-size:0.82rem;">${escapeHtml(item.date || '—')}</td>
            <td style="text-align:center;">
                <button class="btn btn-sm btn-slate" onclick="editGalleryItem(${i})">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteGalleryItem(${i})">🗑</button>
            </td>
        </tr>`;
            }).join('');
        }

        // Edit gallery item (caption + date)
        let editGalleryTarget = null;

        function editGalleryItem(index) {
            const item = galleryItems[index];
            if (!item) return;
            editGalleryTarget = { index };

            const newCaption = prompt('修改说明文字:', item.caption || '');
            if (newCaption === null) return;
            const newDate = prompt('修改日期:', item.date || '');
            if (newDate === null) return;

            updateGalleryItem(item.id, { caption: newCaption.trim(), date: newDate.trim() });
        }

        async function updateGalleryItem(id, updates) {
            try {
                const res = await fetch(`${GALLERY_API}/gallery/${id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                    body: JSON.stringify(updates),
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                showToast('✅ 已更新', 'success');
                renderGallery();
            } catch (err) {
                showToast('❌ 更新失败: ' + err.message, 'error');
            }
        }

        let deleteGalleryTarget = null;

        // ─── Parkour Functions ──────────────────────────────────────────────────────
        let parkourData = [];
        let editParkourIndex = null;

        async function loadParkour() {
            try {
                const res = await fetch(BASE_API_URL + '/api/parkour?t=' + Date.now());
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                parkourData = json.data || [];
            } catch (err) {
                parkourData = [];
                showToast('❌ 加载跑酷数据失败: ' + err.message, 'error');
            }
        }

        async function renderParkourTable() {
            await loadParkour();
            const tbody = document.getElementById('parkourTableBody');
            if (!tbody) return;

            if (parkourData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#94A3B8;">暂无跑酷数据，请在上方添加</td></tr>';
                return;
            }

            tbody.innerHTML = parkourData.map((row, i) => {
                const safetyPreview = (row.safetyNotes || '').replace(/\n/g, ' | ').substring(0, 60) + ((row.safetyNotes || '').length > 60 ? '…' : '');
                const imgTag = row.imagePath
                    ? `<img src="${row.imagePath}?t=${Date.now()}" style="width:80px;height:60px;object-fit:cover;border-radius:8px;border:1px solid #E2E8F0;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 60%22><rect fill=%22%23F1F5F9%22 width=%2280%22 height=%2260%22/><text x=%2240%22 y=%2235%22 text-anchor=%22middle%22 fill=%22%2394A3B8%22 font-size=%2210%22>暂无图片</text></svg>'">`
                    : `<span style="color:#CBD5E1;font-size:0.8rem;">—</span>`;
                const isFeatured = row.isFeatured === true;
                const featuredBtn = isFeatured
                    ? `<button class="btn btn-sm" onclick="toggleFeatured(${i})" style="background:#F59E0B;color:white;cursor:default;" title="当前焦点跑道">⭐ 焦点</button>`
                    : `<button class="btn btn-sm" onclick="toggleFeatured(${i})" style="background:#E2E8F0;color:#94A3B8;" title="设为本周焦点跑道">☆ 设为焦点</button>`;
                return `<tr style="border-bottom:1px solid #F1F5F9;">
                    <td style="padding:0.65rem 0.75rem;"><span style="background:#1D3557;color:white;padding:2px 8px;border-radius:20px;font-size:0.78rem;">${escapeHtml(row.week || '')}</span></td>
                    <td style="padding:0.65rem 0.75rem;">
                        <div style="font-weight:600;color:#1D3557;">${escapeHtml(row.className || '')}</div>
                        <div style="font-size:0.78rem;color:#64748B;">${escapeHtml(row.teacher || '')}</div>
                    </td>
                    <td style="padding:0.65rem 0.75rem;">
                        <div style="font-weight:600;color:#E63946;margin-bottom:2px;">${escapeHtml(row.trackName || '')}</div>
                        <div style="font-size:0.73rem;color:#475569;max-width:240px;white-space:pre-wrap;word-break:break-word;line-height:1.6;">${escapeHtml(safetyPreview)}</div>
                    </td>
                    <td style="padding:0.65rem 0.75rem;text-align:center;">${imgTag}</td>
                    <td style="padding:0.65rem 0.75rem;text-align:center;">${featuredBtn}</td>
                    <td style="padding:0.65rem 0.75rem;text-align:center;white-space:nowrap;">
                        <button class="btn btn-sm btn-slate" onclick="editParkourRow(${i})">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteParkourRow(${i})">🗑</button>
                    </td>
                </tr>`;
            }).join('');
        }

        function editParkourRow(index) {
            const row = parkourData[index];
            if (!row) return;
            editParkourIndex = index;
            document.getElementById('pk_week').value = row.week || '';
            document.getElementById('pk_className').value = row.className || '';
            document.getElementById('pk_teacher').value = row.teacher || '';
            document.getElementById('pk_trackName').value = row.trackName || '';
            document.getElementById('pk_safetyNotes').value = row.safetyNotes || '';
            // Show existing image in preview
            const preview = document.getElementById('pk_preview');
            const previewImg = document.getElementById('pk_previewImg');
            if (row.imagePath) {
                previewImg.src = row.imagePath + '?t=' + Date.now();
                preview.style.display = 'block';
            } else {
                preview.style.display = 'none';
            }
            // Scroll to form
            document.getElementById('parkourUploadSection').scrollIntoView({ behavior: 'smooth' });
            showToast('✏️ 已载入编辑数据，修改后点击"保存跑道数据"', 'success');
        }

        function deleteParkourRow(index) {
            const row = parkourData[index];
            if (!row) return;
            deleteParkourTarget = { index, imagePath: row.imagePath };
            document.getElementById('deleteModalMsg').textContent = `确定要删除「${row.trackName || row.week}」吗？${row.imagePath ? '跑道图将同时从磁盘删除。' : ''}`;
            document.getElementById('deleteModal').classList.remove('hidden');
        }

        function previewParkourFile() {
            const fileInput = document.getElementById('pk_fileInput');
            const preview = document.getElementById('pk_preview');
            const previewImg = document.getElementById('pk_previewImg');
            if (!fileInput || !fileInput.files || !fileInput.files[0]) {
                preview.style.display = 'none';
                return;
            }
            const file = fileInput.files[0];
            if (!file.type.startsWith('image/')) {
                showToast('❌ 请选择图片文件', 'error');
                preview.style.display = 'none';
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }

        async function handleParkourUpload(e) {
            e.preventDefault();
            const form = e.target;
            const fileInput = document.getElementById('pk_fileInput');

            // Validate
            const week = document.getElementById('pk_week').value.trim();
            const className = document.getElementById('pk_className').value.trim();
            const teacher = document.getElementById('pk_teacher').value.trim();
            const trackName = document.getElementById('pk_trackName').value.trim();
            const safetyNotes = document.getElementById('pk_safetyNotes').value.trim();

            if (!week || !className || !teacher || !trackName) {
                showToast('❌ 请填写所有必填字段', 'error');
                return;
            }

            try {
                let imagePath = '';
                let filename = '';

                // Upload image if selected
                if (fileInput.files && fileInput.files[0]) {
                    const formData = new FormData();
                    formData.append('trackImage', fileInput.files[0]);
                    const uploadRes = await fetch(BASE_API_URL + '/api/upload-parkour', { method: 'POST', headers: { 'X-Admin-Token': getAdminToken() || '' }, body: formData });
                    const uploadJson = await uploadRes.json();
                    if (!uploadJson.success) throw new Error(uploadJson.error || '上传失败');
                    imagePath = uploadJson.imagePath;
                    filename = uploadJson.filename;
                }

                if (editParkourIndex !== null) {
                    // Update existing row
                    const existing = parkourData[editParkourIndex];
                    // If changing image, delete old one
                    if (editParkourIndex !== null && existing && existing.imagePath && existing.imagePath !== imagePath) {
                        await fetch(BASE_API_URL + '/api/parkour-image', {
                            method: 'DELETE',
                            headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                            body: JSON.stringify({ imagePath: existing.imagePath })
                        });
                    }
                    parkourData[editParkourIndex] = {
                        ...existing,
                        id: existing.id || ('pk' + Date.now()),
                        week, className, teacher, trackName, safetyNotes,
                        imagePath: imagePath || existing.imagePath || ''
                    };
                    editParkourIndex = null;
                    showToast('✅ 跑道数据已更新', 'success');
                } else {
                    // Add new row
                    const newRow = {
                        id: 'pk' + Date.now(),
                        week, className, teacher, trackName, safetyNotes, imagePath
                    };
                    parkourData.push(newRow);
                    showToast('✅ 跑道数据已添加', 'success');
                }

                // Save all to backend
                const saveRes = await fetch(BASE_API_URL + '/api/parkour', {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                    body: JSON.stringify(parkourData)
                });
                const saveJson = await saveRes.json();
                if (!saveJson.success) throw new Error(saveJson.error);

                clearParkourForm();
                renderParkourTable();
            } catch (err) {
                showToast('❌ 保存失败: ' + err.message, 'error');
            }
        }

        function clearParkourForm() {
            editParkourIndex = null;
            document.getElementById('parkourUploadForm').reset();
            document.getElementById('pk_preview').style.display = 'none';
        }

        let deleteParkourTarget = null;

        function deleteGalleryItem(index) {
            const item = galleryItems[index];
            if (!item) return;
            deleteGalleryTarget = { index };
            document.getElementById('deleteModalMsg').textContent = `确定要删除「${item.caption || item.filename}」吗？文件将同时从磁盘删除。`;
            document.getElementById('deleteModal').classList.remove('hidden');
        }

        // ─── Toggle Featured (Radio Logic) ─────────────────────────────────────────
        async function toggleFeatured(index) {
            const row = parkourData[index];
            if (!row) return;
            // If already featured, do nothing (keep it featured)
            if (row.isFeatured === true) return;

            try {
                // Set all rows isFeatured=false, then set target row true
                parkourData.forEach((r, i) => {
                    parkourData[i].isFeatured = (i === index);
                });
                const res = await fetch(BASE_API_URL + '/api/parkour', {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                    body: JSON.stringify(parkourData)
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                renderParkourTable();
                showToast('⭐ 已设为本周焦点跑道', 'success');
            } catch (err) {
                showToast('❌ 设置焦点失败: ' + err.message, 'error');
            }
        }

        // ─── Parkour Video Management ─────────────────────────────────────────────
        let parkourVideoData = [];

        function previewParkourVideoFile() {
            const fileInput = document.getElementById('pv_fileInput');
            const preview = document.getElementById('pv_preview');
            const previewVideo = document.getElementById('pv_previewVideo');
            if (!fileInput || !fileInput.files || !fileInput.files[0]) {
                preview.style.display = 'none';
                return;
            }
            const file = fileInput.files[0];
            if (!file.type.startsWith('video/')) {
                showToast('❌ 请选择视频文件', 'error');
                preview.style.display = 'none';
                return;
            }
            previewVideo.src = URL.createObjectURL(file);
            preview.style.display = 'block';
        }

        async function handleParkourVideoUpload(e) {
            e.preventDefault();
            const fileInput = document.getElementById('pv_fileInput');
            const titleInput = document.getElementById('pv_title');
            const descInput = document.getElementById('pv_description');
            const btn = document.getElementById('pv_uploadBtn');

            if (!fileInput.files[0]) {
                showToast('⚠️ 请先选择视频文件', 'error');
                return;
            }
            if (!titleInput.value.trim()) {
                showToast('⚠️ 请输入视频标题', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('videoFile', fileInput.files[0]);
            formData.append('title', titleInput.value.trim());
            formData.append('description', descInput.value.trim());

            btn.disabled = true;
            btn.textContent = '⬆️ 上传中...';
            try {
                const res = await fetch(BASE_API_URL + '/api/upload-parkour-video', { method: 'POST', headers: { 'X-Admin-Token': getAdminToken() || '' }, body: formData });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                showToast('✅ 视频上传成功', 'success');
                clearParkourVideoForm();
                renderParkourVideoTable();
            } catch (err) {
                showToast('❌ 上传失败: ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = '⬆️ 上传视频';
            }
        }

        function clearParkourVideoForm() {
            document.getElementById('parkourVideoUploadForm').reset();
            document.getElementById('pv_preview').style.display = 'none';
        }

        async function renderParkourVideoTable() {
            const listEl = document.getElementById('parkourVideoList');
            if (!listEl) return;
            try {
                const res = await fetch(BASE_API_URL + '/api/parkour-videos?t=' + Date.now());
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                parkourVideoData = json.data || [];
            } catch (err) {
                parkourVideoData = [];
            }

            if (parkourVideoData.length === 0) {
                listEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:#94A3B8;font-size:0.85rem;">暂无教学视频，请在上方上传</div>';
                return;
            }

            listEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;margin-top:0.5rem;">
                ${parkourVideoData.map((v, i) => `
                <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:1rem;display:flex;flex-direction:column;gap:0.5rem;">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;">
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:700;color:#1D3557;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(v.title || '未命名')}</div>
                            <div style="font-size:0.73rem;color:#94A3B8;margin-top:2px;">${v.originalName || v.filename}</div>
                        </div>
                        <button class="btn btn-sm btn-danger" onclick="deleteParkourVideo('${v.id}')" style="flex-shrink:0;" title="删除此视频">🗑</button>
                    </div>
                    ${v.description ? `<div style="font-size:0.78rem;color:#64748B;line-height:1.5;">${escapeHtml(v.description)}</div>` : ''}
                    <div style="margin-top:auto;padding-top:0.4rem;">
                        <video src="/assets/parkour-videos/${v.filename}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;background:#000;" muted preload="none" onerror="this.style.display='none'"></video>
                    </div>
                    <div style="font-size:0.68rem;color:#CBD5E1;text-align:right;">${v.uploadTime ? new Date(v.uploadTime).toLocaleDateString('zh-CN') : ''}</div>
                </div>`).join('')}
            </div>`;
        }

        async function deleteParkourVideo(id) {
            if (!confirm('确定要删除这个教学视频吗？此操作不可撤销。')) return;
            try {
                const res = await fetch(BASE_API_URL + `/api/parkour-video/${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': getAdminToken() || '' } });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                showToast('✅ 已删除', 'success');
                renderParkourVideoTable();
            } catch (err) {
                showToast('❌ 删除失败: ' + err.message, 'error');
            }
        }

        // ═══════════════════════════════════════════════════════
        // CALENDAR TAB — 在线校历管理
        // ═══════════════════════════════════════════════════════
        const EVENT_TYPES = {
            ParentEvent:   { label: '家长在园日',  color: '#9B59B6', textColor: '#fff' },
            SchoolDay:     { label: '上学日',      color: '#F1C40F', textColor: '#333' },
            OnCampusEvent: { label: '活动日',      color: '#E91E8C', textColor: '#fff' },
            PDDay:         { label: '培训/工作日', color: '#95A5A6', textColor: '#fff' },
            Holiday:       { label: '假期',        color: '#27AE60', textColor: '#fff' }
        };

        let calendarEvents = [];
        let editingEventId = null;

        // ── Theme Config ──────────────────────────────────────────────────────────
        async function saveThemeConfig() {
            const month  = parseInt(document.getElementById('themeMonth').value);
            const theme  = document.getElementById('themeName').value.trim();
            const themeEn = document.getElementById('themeNameEn').value.trim();
            if (!theme) { showToast('⚠️ 请填写主题名称', 'error'); return; }

            // Load current themes from server
            let calData = { monthlyThemes: [] };
            try {
                const res  = await fetch(BASE_API_URL + '/api/calendar?t=' + Date.now());
                const json  = await res.json();
                if (json.success) calData = json.data;
            } catch (e) { showToast('❌ 无法加载主题数据', 'error'); return; }

            // Merge: replace existing theme for this month, or append
            const themes = (calData.monthlyThemes || []).filter(t => t.month !== month);
            themes.push({ month, theme, themeEn });
            themes.sort((a, b) => a.month - b.month);

            try {
                const res = await fetch(BASE_API_URL + '/api/calendar/themes', {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                    body: JSON.stringify(themes)
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                showToast('✅ 主题已保存', 'success');
                document.getElementById('themeName').value = '';
                document.getElementById('themeNameEn').value = '';
                // Reload data so theme list reflects new data
                await loadCalendarData();
                renderThemeList();
            } catch (e) {
                showToast('❌ 保存失败: ' + e.message, 'error');
            }
        }

        function renderThemeList() {
            const el = document.getElementById('themeList');
            if (!el) return;
            const themes = window.calendarThemes || [];
            if (themes.length === 0) {
                el.innerHTML = '<div style="font-size:0.78rem;color:#94A3B8;text-align:center;padding:0.5rem;">暂无配置，点击保存后在此显示</div>';
                return;
            }
            const MONTH_NAMES = ['','1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
            el.innerHTML = themes.map(t =>
                `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-bottom:1px solid #F1F5F9;font-size:0.82rem;">
                    <span style="font-weight:700;color:#1D3557;min-width:40px;">${MONTH_NAMES[t.month]}</span>
                    <span style="color:#1D3557;font-weight:600;">${escapeHtml(t.theme)}</span>
                    <span style="color:#94A3B8;font-size:0.75rem;">${escapeHtml(t.themeEn || '')}</span>
                </div>`
            ).join('');
        }

        // ── Notice Panel ─────────────────────────────────────────────────────────
        function onNoticeToggleChange() {
            const toggle  = document.getElementById('noticeToggle');
            const track   = document.getElementById('noticeToggleTrack');
            const thumb   = document.getElementById('noticeToggleThumb');
            const label   = document.getElementById('noticeToggleLabel');
            const checked = toggle.checked;
            if (checked) {
                track.style.background = '#2A9D8F';
                thumb.style.left = '25px';
                label.textContent = '已开启';
                label.style.color = '#2A9D8F';
            } else {
                track.style.background = '#CBD5E1';
                thumb.style.left = '3px';
                label.textContent = '已关闭';
                label.style.color = '#94A3B8';
            }
        }

        function loadNoticePanel() {
            const notice = window.globalNotice || { isActive: false, type: 'info', content: '' };
            document.getElementById('noticeToggle').checked = !!notice.isActive;
            document.getElementById('noticeType').value    = notice.type || 'info';
            document.getElementById('noticeContent').value = notice.content || '';
            onNoticeToggleChange(); // Sync toggle visual
        }

        async function saveNoticeConfig() {
            const isActive = document.getElementById('noticeToggle').checked;
            const type     = document.getElementById('noticeType').value;
            const content  = document.getElementById('noticeContent').value.trim();
            if (isActive && !content) { showToast('⚠️ 开启通知时内容不能为空', 'error'); return; }
            try {
                const res = await fetch(BASE_API_URL + '/api/calendar/notice', {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                    body: JSON.stringify({ isActive, type, content })
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                window.globalNotice = json.globalNotice;
                showToast('✅ 通知已保存', 'success');
            } catch (e) {
                showToast('❌ 保存失败: ' + e.message, 'error');
            }
        }

        async function loadCalendarData() {
            try {
                const res = await fetch(BASE_API_URL + '/api/calendar?t=' + Date.now());
                const json = await res.json();
                if (json.success) {
                    calendarEvents = json.data.events || [];
                    window.calendarThemes = json.data.monthlyThemes || [];
                    window.globalNotice = json.data.globalNotice || { isActive: false, type: 'info', content: '' };
                }
            } catch (e) {
                calendarEvents = [];
            }
        }

        function getTypeBadge(type) {
            const t = EVENT_TYPES[type] || { label: type, color: '#999', textColor: '#fff' };
            return `<span style="display:inline-block;background:${t.color};color:${t.textColor};padding:2px 10px;border-radius:6px;font-size:0.72rem;font-weight:700;">${t.label}</span>`;
        }

        function formatDateRange(date, endDate) {
            if (!endDate || date === endDate) return date;
            return `${date} → ${endDate}`;
        }

        function renderCalendarTable() {
            const listEl = document.getElementById('calendarEventList');
            if (!listEl) return;

            // Sort desc by date
            const sorted = [...calendarEvents].sort((a, b) => b.date.localeCompare(a.date));

            if (sorted.length === 0) {
                listEl.innerHTML = '<div style="text-align:center;padding:2rem;color:#94A3B8;">暂无校历事件，请在上方添加</div>';
                document.getElementById('calEventCount').textContent = '—';
                return;
            }

            document.getElementById('calEventCount').textContent = `${sorted.length} 条`;

            listEl.innerHTML = sorted.map(ev => {
                const bg   = ev.backgroundColor || '#999';
                const txt  = ev.textColor || '#fff';
                const typeLabel = {
                    ParentEvent: '家长在园日', SchoolDay: '上学日',
                    OnCampusEvent: '活动日', PDDay: '培训/工作日', Holiday: '假期'
                }[ev.type] || ev.type;
                return `
                <div style="display:flex;align-items:center;gap:1rem;padding:1rem;border-bottom:1px solid #F1F5F9;flex-wrap:wrap;">
                    <div style="flex:0 0 auto;text-align:center;min-width:60px;">
                        <div style="font-size:0.75rem;color:#94A3B8;">${ev.date.slice(0,4)}</div>
                        <div style="font-size:1.3rem;font-weight:800;color:#1D3557;line-height:1;">${ev.date.slice(5)}</div>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.25rem;">
                            <span style="background:${bg};color:${txt};padding:2px 8px;border-radius:12px;font-size:0.72rem;font-weight:700;">${typeLabel}</span>
                            <span style="font-weight:700;color:#1D3557;font-size:0.95rem;">${escapeHtml(ev.title || '')}</span>
                        </div>
                        <div style="font-size:0.75rem;color:#6C757D;">${escapeHtml(ev.titleEn || '')}</div>
                        ${ev.description ? `<div style="font-size:0.8rem;color:#64748B;margin-top:0.25rem;">${escapeHtml(ev.description)}</div>` : ''}
                        ${ev.endDate && ev.endDate !== ev.date ? `<div style="font-size:0.72rem;color:#94A3B8;margin-top:0.2rem;">📅 截止：${ev.endDate}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-shrink:0;align-items:center;">
                        <div style="width:20px;height:20px;border-radius:5px;background:${bg};flex-shrink:0;" title="背景色:${bg}"></div>
                        <div style="width:20px;height:20px;border-radius:5px;background:${txt};flex-shrink:0;border:1px solid #E2E8F0;" title="文字色:${txt}"></div>
                        <button class="btn btn-sm btn-slate" onclick="editCalendarEvent('${ev.id}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCalendarEvent('${ev.id}')">🗑</button>
                    </div>
                </div>`;
            }).join('');
        }

        // ── Type → default colors mapping ──
        const CAL_TYPE_DEFAULTS = {
            ParentEvent:   { bg: '#9B59B6', text: '#ffffff' },
            SchoolDay:     { bg: '#F1C40F', text: '#333333' },
            OnCampusEvent: { bg: '#E91E8C', text: '#ffffff' },
            PDDay:         { bg: '#95A5A6', text: '#ffffff' },
            Holiday:       { bg: '#27AE60', text: '#ffffff' }
        };

        // ── Auto-fill colors when type changes ──
        function onCalTypeChange() {
            const type = document.getElementById('cal_type').value;
            const defaults = CAL_TYPE_DEFAULTS[type] || { bg: '#999999', text: '#ffffff' };
            document.getElementById('cal_bgColor').value = defaults.bg;
            document.getElementById('cal_bgColorText').value = defaults.bg;
            document.getElementById('cal_textColor').value = defaults.text;
            document.getElementById('cal_textColorText').value = defaults.text;
            document.getElementById('calBgPreview').style.background = defaults.bg;
            document.getElementById('calTextPreview').style.background = defaults.text;
        }

        function clearCalendarForm() {
            document.getElementById('cal_date').value = '';
            document.getElementById('cal_endDate').value = '';
            document.getElementById('cal_title').value = '';
            document.getElementById('cal_titleEn').value = '';
            document.getElementById('cal_type').value = 'SchoolDay';
            onCalTypeChange();
            document.getElementById('cal_description').value = '';
            editingEventId = null;
            document.getElementById('cal_submitBtn').textContent = '➕ 添加事件';
            document.getElementById('cal_cancelBtn').style.display = 'none';
        }

        function editCalendarEvent(id) {
            const ev = calendarEvents.find(e => e.id === id);
            if (!ev) return;
            editingEventId = id;
            document.getElementById('cal_date').value = ev.date;
            document.getElementById('cal_endDate').value = ev.endDate || '';
            document.getElementById('cal_title').value = ev.title || '';
            document.getElementById('cal_titleEn').value = ev.titleEn || '';
            document.getElementById('cal_type').value = ev.type || 'SchoolDay';
            document.getElementById('cal_description').value = ev.description || '';
            // Populate color fields
            const bg   = ev.backgroundColor || (CAL_TYPE_DEFAULTS[ev.type]?.bg   || '#999999');
            const txt  = ev.textColor       || (CAL_TYPE_DEFAULTS[ev.type]?.text || '#ffffff');
            document.getElementById('cal_bgColor').value = bg;
            document.getElementById('cal_bgColorText').value = bg;
            document.getElementById('cal_textColor').value = txt;
            document.getElementById('cal_textColorText').value = txt;
            document.getElementById('calBgPreview').style.background = bg;
            document.getElementById('calTextPreview').style.background = txt;
            document.getElementById('cal_submitBtn').textContent = '💾 保存修改';
            document.getElementById('cal_cancelBtn').style.display = 'inline-flex';
            document.getElementById('calSection').scrollIntoView({ behavior: 'smooth' });
        }

        async function handleCalendarSubmit(e) {
            e.preventDefault();
            const date = document.getElementById('cal_date').value.trim();
            const endDate = document.getElementById('cal_endDate').value.trim();
            const title = document.getElementById('cal_title').value.trim();
            const titleEn = document.getElementById('cal_titleEn').value.trim();
            const type = document.getElementById('cal_type').value;
            const description = document.getElementById('cal_description').value.trim();

            if (!date || !title || !type) {
                showToast('⚠️ 日期、标题和类型为必填项', 'error');
                return;
            }

            const body = {
                date, endDate, title, titleEn, type, description,
                backgroundColor: document.getElementById('cal_bgColor').value,
                textColor: document.getElementById('cal_textColor').value
            };
            const btn = document.getElementById('cal_submitBtn');
            btn.disabled = true;

            try {
                let res, json;
                if (editingEventId) {
                    res = await fetch(BASE_API_URL + `/api/calendar/event/${editingEventId}`, {
                        method: 'PUT',
                        headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                        body: JSON.stringify(body)
                    });
                    json = await res.json();
                    if (!json.success) throw new Error(json.error);
                    showToast('✅ 事件已更新', 'success');
                } else {
                    res = await fetch(BASE_API_URL + '/api/calendar/event', {
                        method: 'POST',
                        headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                        body: JSON.stringify(body)
                    });
                    json = await res.json();
                    if (!json.success) throw new Error(json.error);
                    showToast('✅ 事件已添加', 'success');
                }
                await loadCalendarData();
                renderCalendarTable();
                clearCalendarForm();
            } catch (err) {
                showToast('❌ 操作失败: ' + err.message, 'error');
            } finally {
                btn.disabled = false;
            }
        }

        async function deleteCalendarEvent(id) {
            if (!confirm('确定要删除这个校历事件吗？此操作不可撤销。')) return;
            try {
                const res = await fetch(`${BASE_API_URL}/api/calendar/event/${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': getAdminToken() || '' } });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                showToast('✅ 已删除', 'success');
                await loadCalendarData();
                renderCalendarTable();
            } catch (err) {
                showToast('❌ 删除失败: ' + err.message, 'error');
            }
        }

        // ─── Venue Reservations Management ──────────────────────────────────────
        var localClasses = [];
        var editingResId = null;
        var venueNameMap = {};

        async function initReservationsTab() {
            await loadClasses();
            await loadVenueOptions();
            document.getElementById('resDate').value = new Date().toISOString().slice(0, 10);
            loadReservations();
        }

        async function loadClasses() {
            try {
                var res = await fetch('/api/calendar/classes');
                var data = await res.json();
                if (data.success) {
                    localClasses = data.data || [];
                    renderClassList();
                    renderClassSelect();
                }
            } catch (e) { console.error('Failed to load classes:', e); }
        }

        function renderClassList() {
            var container = document.getElementById('classList');
            if (!container) return;
            container.innerHTML = localClasses.map(function (c, i) {
                return '<span style="display:inline-flex;align-items:center;gap:0.4rem;background:#F1F5F9;padding:0.4rem 0.75rem;border-radius:8px;font-size:0.85rem;">' +
                    c + ' <button onclick="removeClassItem(' + i + ')" style="background:none;border:none;color:#E63946;cursor:pointer;font-size:1rem;line-height:1;">&times;</button></span>';
            }).join('');
        }

        function renderClassSelect() {
            var select = document.getElementById('resClass');
            if (!select) return;
            select.innerHTML = localClasses.map(function (c) {
                return '<option value="' + c + '">' + c + '</option>';
            }).join('');
        }

        function addClass() {
            var input = document.getElementById('newClassName');
            var name = (input.value || '').trim();
            if (!name) { alert('请输入班级名称'); return; }
            if (localClasses.indexOf(name) >= 0) { alert('该班级已存在'); return; }
            localClasses.push(name);
            input.value = '';
            renderClassList();
            renderClassSelect();
        }

        function removeClassItem(index) {
            localClasses.splice(index, 1);
            renderClassList();
            renderClassSelect();
        }

        async function saveClasses() {
            try {
                var token = getAdminToken();
                var res = await fetch('/api/calendar/classes', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' },
                    body: JSON.stringify(localClasses)
                });
                var data = await res.json();
                if (data.success) {
                    showToast('班级列表已保存');
                } else {
                    alert('保存失败: ' + (data.error || ''));
                }
            } catch (e) { alert('请求失败: ' + e.message); }
        }

        async function loadVenueOptions() {
            try {
                var res = await fetch('/api/venues');
                var data = await res.json();
                if (data.success) {
                    var allVenues = (data.data.coreVenues || []).concat(data.data.auxVenues || []);
                    allVenues.forEach(function (v) { venueNameMap[v.id] = v.name; });
                    var select = document.getElementById('resVenue');
                    if (!select) return;
                    select.innerHTML = allVenues.map(function (v) {
                        return '<option value="' + v.id + '">' + v.name + '</option>';
                    }).join('');
                }
            } catch (e) { console.error('Failed to load venues:', e); }
        }

        async function loadReservations() {
            var date = document.getElementById('resFilterDate').value;
            var container = document.getElementById('reservationList');
            if (!container) return;
            if (!date) {
                container.innerHTML = '<p style="color:#94A3B8;text-align:center;padding:1.5rem;">请选择筛选日期</p>';
                return;
            }
            try {
                var res = await fetch('/api/calendar/reservations?date=' + encodeURIComponent(date));
                var data = await res.json();
                if (data.success && data.data.length > 0) {
                    container.innerHTML = data.data.map(function (r) {
                        var bgColor = editingResId === r.id ? '#FFF3CD' : '#F8FAFC';
                        return '<div style="display:flex;align-items:center;justify-content:space-between;background:' + bgColor + ';padding:0.75rem 1rem;border-radius:10px;border:1px solid #E2E8F0;">' +
                            '<div><strong>' + (venueNameMap[r.venueId] || r.venueId) + '</strong> · ' + r.className + ' · <span style="color:#64748B;">' + r.timeSlot + '</span></div>' +
                            '<div style="display:flex;gap:0.4rem;">' +
                            '<button onclick="editReservation(\'' + r.id + '\')" style="background:#F1F5F9;border:none;padding:0.3rem 0.6rem;border-radius:6px;cursor:pointer;font-size:0.8rem;">✏️</button>' +
                            '<button onclick="deleteReservation(\'' + r.id + '\')" style="background:#FEE2E2;border:none;padding:0.3rem 0.6rem;border-radius:6px;cursor:pointer;font-size:0.8rem;">🗑️</button>' +
                            '</div></div>';
                    }).join('');
                } else {
                    container.innerHTML = '<p style="color:#94A3B8;text-align:center;padding:1.5rem;">' + date + ' 暂无预约记录</p>';
                }
            } catch (e) { container.innerHTML = '<p style="color:#E63946;text-align:center;padding:1rem;">加载失败: ' + e.message + '</p>'; }
        }

        async function addOrUpdateReservation() {
            var date = document.getElementById('resDate').value;
            var venueId = document.getElementById('resVenue').value;
            var className = document.getElementById('resClass').value;
            var timeSlot = document.getElementById('resTimeSlot').value.trim();
            var editId = document.getElementById('editResId').value;

            if (!date || !venueId || !className || !timeSlot) {
                alert('请填写所有字段');
                return;
            }

            try {
                var token = getAdminToken();
                var url = editId ? '/api/calendar/reservation/' + editId : '/api/calendar/reservation';
                var method = editId ? 'PUT' : 'POST';
                var res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' },
                    body: JSON.stringify({ date: date, venueId: venueId, className: className, timeSlot: timeSlot })
                });
                var data = await res.json();
                if (data.success) {
                    showToast(editId ? '预约已更新' : '预约已创建');
                    cancelEditReservation();
                    loadReservations();
                } else {
                    alert('操作失败: ' + (data.error || ''));
                }
            } catch (e) { alert('请求失败: ' + e.message); }
        }

        async function editReservation(id) {
            try {
                var res = await fetch('/api/calendar/reservations?date=' + document.getElementById('resFilterDate').value);
                var data = await res.json();
                if (data.success) {
                    var found = data.data.find(function (r) { return r.id === id; });
                    if (found) {
                        document.getElementById('resDate').value = found.date;
                        document.getElementById('resVenue').value = found.venueId;
                        document.getElementById('resClass').value = found.className;
                        document.getElementById('resTimeSlot').value = found.timeSlot;
                        document.getElementById('editResId').value = found.id;
                        document.getElementById('cancelResEditBtn').style.display = '';
                        editingResId = id;
                        loadReservations();
                        document.getElementById('reservationsSection').scrollIntoView({ behavior: 'smooth' });
                    }
                }
            } catch (e) { alert('加载预约失败: ' + e.message); }
        }

        function cancelEditReservation() {
            document.getElementById('editResId').value = '';
            document.getElementById('cancelResEditBtn').style.display = 'none';
            document.getElementById('resTimeSlot').value = '';
            editingResId = null;
            loadReservations();
        }

        async function deleteReservation(id) {
            if (!confirm('确定删除该预约吗？')) return;
            try {
                var token = getAdminToken();
                var url = '/api/calendar/reservation/' + id;
                var res = await fetch(url, {
                    method: 'DELETE',
                    headers: { 'x-admin-token': token || '' }
                });
                var data = await res.json();
                if (data.success) {
                    showToast('预约已删除');
                    if (editingResId === id) cancelEditReservation();
                    loadReservations();
                } else {
                    alert('删除失败: ' + (data.error || ''));
                }
            } catch (e) { alert('请求失败: ' + e.message); }
        }

        // Init calendar tab
        document.addEventListener('DOMContentLoaded', async () => {
            await loadCalendarData();
            renderCalendarTable();
        });
