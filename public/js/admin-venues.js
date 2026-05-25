    // ─── Venues Admin Logic ──────────────────────────────────────────────────────
    const VENUES_API = '/api';
    let venuesAdminData = { coreVenues: [], auxVenues: [], rules: {} };
    let currentEditingAuxId = null;

    async function initVenuesTab() {
        document.getElementById('venuesSection').classList.remove('hidden');
        try {
            const res = await fetch(VENUES_API + '/venues?t=' + Date.now());
            const json = await res.json();
            if (json.success) venuesAdminData = json.data;
        } catch (e) { console.error(e); }
        // ✅ 必须等 fetch 完成后才能回显数据
        loadCoreVenueEdit('outdoor-playground');
        renderAuxVenuesList();
        document.getElementById('rulesBikeParking').value = venuesAdminData.rules?.bikeParking || '';
        document.getElementById('rulesEquipmentReturn').value = venuesAdminData.rules?.equipmentReturn || '';
    }

    function loadCoreVenueEdit(id) {
        const v = venuesAdminData.coreVenues.find(c => c.id === id);
        if (!v) return;
        document.getElementById('venueName').value = v.name || '';
        document.getElementById('venueNameEn').value = v.nameEn || '';
        document.getElementById('venuePurpose').value = v.purpose || '';
        document.getElementById('venueGames').value = v.games || '';
        document.getElementById('venueSafety').value = v.safety || '';
        document.getElementById('venueLessonPlan').value = v.lessonPlan || '';
        document.getElementById('venueImagePath').value = v.image || '';
        const preview = document.getElementById('venueImagePreview');
        if (v.image) {
            preview.innerHTML = `<img src="${v.image}" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
            preview.innerHTML = '<span style="color:#94A3B8;font-size:0.85rem;">📷 点击上传图片</span>';
        }
    }

    function previewVenueImage(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('venueImagePreview').innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    }

    async function saveCoreVenue() {
        const id = document.getElementById('venueCoreSelector').value;
        const imageInput = document.getElementById('venueImageInput');
        let imagePath = document.getElementById('venueImagePath').value;

        // 先检查是否选了新文件，有则上传
        if (imageInput.files[0]) {
            try {
                const fd = new FormData();
                fd.append('fieldImage', imageInput.files[0]);
                const res = await fetch(VENUES_API + '/upload-venue', { method: 'POST', headers: { 'X-Admin-Token': getAdminToken() || '' }, body: fd });
                const json = await res.json();
                if (json.success) imagePath = json.imagePath;
                else throw new Error(json.error);
            } catch (e) { showToast('❌ 图片上传失败: ' + e.message, 'error'); return; }
        }

        const updated = {
            name: document.getElementById('venueName').value,
            nameEn: document.getElementById('venueNameEn').value,
            purpose: document.getElementById('venuePurpose').value,
            games: document.getElementById('venueGames').value,
            safety: document.getElementById('venueSafety').value,
            lessonPlan: document.getElementById('venueLessonPlan').value,
            image: imagePath
        };

        // ✅ 使用 Deep Merge 路由，绝不覆盖其他场地
        try {
            const res = await fetch(VENUES_API + '/venues/core/' + id, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': getAdminToken() || ''
                },
                body: JSON.stringify(updated)
            });
            const json = await res.json();
            if (json.success) {
                // 更新本地内存
                const idx = venuesAdminData.coreVenues.findIndex(c => c.id === id);
                if (idx >= 0) venuesAdminData.coreVenues[idx] = { ...venuesAdminData.coreVenues[idx], ...updated };
                showToast('✅ 核心场地已保存', 'success');
            } else {
                showToast('❌ 保存失败: ' + json.error, 'error');
            }
        } catch (e) { showToast('❌ 保存失败: ' + e.message, 'error'); }
    }

    function renderAuxVenuesList() {
        const list = document.getElementById('auxVenuesList');
        list.innerHTML = '';
        venuesAdminData.auxVenues.forEach((v, i) => {
            list.innerHTML += `
            <div style="display:flex;align-items:center;gap:1rem;padding:1rem;border:1px solid #F1F5F9;border-radius:12px;margin-bottom:0.75rem;flex-wrap:wrap;">
                <div style="width:60px;height:45px;background:#F1F5F9;border-radius:8px;overflow:hidden;flex-shrink:0;">
                    ${v.image ? `<img src="${v.image}" style="width:100%;height:100%;object-fit:cover;">` : '<span style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.2rem;">🏞️</span>'}
                </div>
                <div style="flex:1;min-width:150px;">
                    <div style="font-weight:600;font-size:0.9rem;color:#1D3557;">${v.name}</div>
                    <div style="font-size:0.78rem;color:#475569;">${v.description || ''}</div>
                    ${v.safety ? `<div style="font-size:0.72rem;color:#E63946;margin-top:0.2rem;">⚠️ ${v.safety}</div>` : ''}
                </div>
                <button class="btn btn-sm btn-slate" onclick="editAuxVenue('${v.id}')">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="removeAuxVenue('${v.id}')">🗑</button>
            </div>`;
        });
    }

    function previewAuxImage(input) {
        const file = input.files[0];
        const preview = document.getElementById('auxImagePreview');
        if (!file) {
            preview.innerHTML = '<span style="color:#94A3B8;font-size:0.85rem;">📷 预览区</span>';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    }

    function showAddAuxModal() {
        currentEditingAuxId = null;
        document.getElementById('auxModalTitle').textContent = '➕ 添加辅助场地';
        document.getElementById('auxModalSubmitBtn').textContent = '添加';
        document.getElementById('auxName').value = '';
        document.getElementById('auxDesc').value = '';
        document.getElementById('auxSafety').value = '';
        document.getElementById('auxImage').value = '';
        document.getElementById('auxImagePreview').innerHTML = '<span style="color:#94A3B8;font-size:0.85rem;">📷 预览区</span>';
        document.getElementById('addAuxModal').style.display = 'flex';
    }

    function editAuxVenue(id) {
        const v = venuesAdminData.auxVenues.find(a => a.id === id);
        if (!v) return;
        currentEditingAuxId = id;
        document.getElementById('auxModalTitle').textContent = '✏️ 编辑辅助场地';
        document.getElementById('auxModalSubmitBtn').textContent = '保存修改';
        document.getElementById('auxName').value = v.name || '';
        document.getElementById('auxDesc').value = v.description || '';
        document.getElementById('auxSafety').value = v.safety || '';
        document.getElementById('auxImage').value = '';
        if (v.image) {
            document.getElementById('auxImagePreview').innerHTML = `<img src="${v.image}" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
            document.getElementById('auxImagePreview').innerHTML = '<span style="color:#94A3B8;font-size:0.85rem;">📷 预览区</span>';
        }
        document.getElementById('addAuxModal').style.display = 'flex';
    }

    function closeAddAuxModal() {
        document.getElementById('addAuxModal').style.display = 'none';
        currentEditingAuxId = null;
    }

    async function submitAuxVenueForm() {
        const name = document.getElementById('auxName').value.trim();
        const description = document.getElementById('auxDesc').value.trim();
        const safety = document.getElementById('auxSafety').value.trim();
        const imageInput = document.getElementById('auxImage');
        let imagePath = currentEditingAuxId
            ? (venuesAdminData.auxVenues.find(a => a.id === currentEditingAuxId)?.image || '')
            : '';

        if (!name) { showToast('请输入场地名称', 'error'); return; }

        // Upload image if selected
        if (imageInput.files[0]) {
            try {
                const fd = new FormData();
                fd.append('fieldImage', imageInput.files[0]);
                const res = await fetch(VENUES_API + '/upload-venue', { method: 'POST', headers: { 'X-Admin-Token': getAdminToken() || '' }, body: fd });
                const json = await res.json();
                if (json.success) imagePath = json.imagePath;
                else throw new Error(json.error);
            } catch (e) { showToast('图片上传失败: ' + e.message, 'error'); return; }
        }

        if (currentEditingAuxId) {
            // Update existing — persist to server via deep-merge endpoint
            try {
                const res = await fetch(VENUES_API + '/venues/aux/' + currentEditingAuxId, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-Token': getAdminToken() || ''
                    },
                    body: JSON.stringify({ name, description, safety, image: imagePath })
                });
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                // Sync local memory
                const idx = venuesAdminData.auxVenues.findIndex(a => a.id === currentEditingAuxId);
                if (idx >= 0) venuesAdminData.auxVenues[idx] = { ...venuesAdminData.auxVenues[idx], name, description, safety, image: imagePath };
                showToast('✅ 辅助场地已保存', 'success');
            } catch (e) {
                showToast('❌ 保存失败: ' + e.message, 'error');
                return;
            }
        } else {
            // Add new — call saveVenuesToServer (bulk POST) so server gets the new item
            const newVenue = { id: 'aux_' + Date.now(), name, description, safety, image: imagePath };
            venuesAdminData.auxVenues.push(newVenue);
            try {
                await saveVenuesToServer();
                showToast('✅ 辅助场地已添加', 'success');
            } catch (e) {
                // Rollback local add on failure
                venuesAdminData.auxVenues = venuesAdminData.auxVenues.filter(v => v.id !== newVenue.id);
                showToast('❌ 添加失败: ' + e.message, 'error');
                return;
            }
        }
        renderAuxVenuesList();
        closeAddAuxModal();
    }

    async function removeAuxVenue(id) {
        if (!confirm('确定删除该辅助场地？')) return;
        try {
            await fetch(VENUES_API + '/venues/aux/' + id, { method: 'DELETE', headers: { 'X-Admin-Token': getAdminToken() || '' } });
        } catch (e) { /* ignore network error, still remove locally */ }
        venuesAdminData.auxVenues = venuesAdminData.auxVenues.filter(v => v.id !== id);
        renderAuxVenuesList();
    }

    async function saveAuxVenues() {
        await saveVenuesToServer();
        showToast('✅ 辅助场地已保存', 'success');
    }

    async function saveRules() {
        venuesAdminData.rules.bikeParking = document.getElementById('rulesBikeParking').value;
        venuesAdminData.rules.equipmentReturn = document.getElementById('rulesEquipmentReturn').value;
        await saveVenuesToServer();
        showToast('✅ 归位规范已保存', 'success');
    }

    async function saveVenuesToServer() {
        const res = await fetch(VENUES_API + '/venues', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': getAdminToken() || ''
            },
            body: JSON.stringify(venuesAdminData)
        });
        const json = await res.json();
        if (!json.success) showToast('❌ 保存失败: ' + json.error, 'error');
    }

