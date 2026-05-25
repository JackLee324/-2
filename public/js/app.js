        const BASE_API_URL = '';
        // Scroll animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));

        // ─── Venue Empowerment V6 ────────────────────────────────────────────────
        let venuesData = { coreVenues: [], auxVenues: [], rules: {} };
        let currentVenueIndex = 0;

        async function loadVenuesData() {
            try {
                const res = await fetch('/api/venues?t=' + Date.now());
                const json = await res.json();
                if (json.success) {
                    venuesData = json.data;
                    renderVenueTabs();
                    renderCoreVenue(0);
                    renderAuxVenues();
                    renderOrderBanner();
                }
            } catch (err) {
                console.error('Failed to load venues:', err);
            }
        }

        function renderVenueTabs() {
            const tabs = document.querySelectorAll('.venue-tab');
            if (!tabs.length) return;
            venuesData.coreVenues.forEach((v, i) => {
                if (tabs[i]) {
                    tabs[i].querySelector('.zh') && (tabs[i].querySelector('.zh').textContent = v.name);
                    const enSpan = tabs[i].querySelector('.en');
                    if (enSpan) enSpan.textContent = v.nameEn || '';
                }
            });
        }

        function switchVenue(index) {
            currentVenueIndex = index;
            document.querySelectorAll('.venue-tab').forEach((t, i) => {
                t.classList.toggle('active', i === index);
            });
            renderCoreVenue(index);
        }

        function renderCoreVenue(index) {
            const v = venuesData.coreVenues[index];
            if (!v) return;

            const titleEl = document.getElementById('venueTitle');
            const titleEnEl = document.getElementById('venueTitleEn');
            const purposeEl = document.getElementById('venuePurpose');
            const gamesEl = document.getElementById('venueGames');
            const safetyEl = document.getElementById('venueSafety');
            const lessonEl = document.getElementById('venueLessonPlan');
            const mainImg = document.getElementById('venueMainImage');
            const placeholder = document.getElementById('venueImagePlaceholder');

            titleEl.innerHTML = `<span class="zh">${v.name}</span>`;
            titleEnEl.textContent = v.nameEn || '';
            purposeEl.textContent = v.purpose || '';

            // Image
            if (v.image) {
                mainImg.src = v.image;
                mainImg.style.display = 'block';
                placeholder.style.display = 'none';
                mainImg.onerror = () => {
                    mainImg.style.display = 'none';
                    placeholder.style.display = 'flex';
                    placeholder.innerHTML = '<span class="zh">📷 暂无图片</span>';
                };
            } else {
                mainImg.style.display = 'none';
                placeholder.style.display = 'flex';
                placeholder.innerHTML = '<span class="zh">📷 暂无图片</span>';
            }

            // Games list
            gamesEl.innerHTML = '';
            if (v.games) {
                v.games.split('、').forEach(g => {
                    const li = document.createElement('li');
                    li.textContent = g.trim();
                    gamesEl.appendChild(li);
                });
            }

            // Safety list
            safetyEl.innerHTML = '';
            if (v.safety) {
                v.safety.split('；').forEach(s => {
                    const li = document.createElement('li');
                    li.textContent = s.trim();
                    safetyEl.appendChild(li);
                });
            }

            // Lesson plan
            lessonEl.textContent = v.lessonPlan || '本周教案内容待更新。';
        }

        function renderAuxVenues() {
            const grid = document.getElementById('auxVenuesGrid');
            if (!grid) return;
            grid.innerHTML = '';
            venuesData.auxVenues.forEach(v => {
                const wrapper = document.createElement('div');
                wrapper.className = 'aux-card-wrapper';
                wrapper.dataset.id = v.id;

                const hasImg = v.image && v.image.trim();
                const desc = v.description || '';
                const safety = v.safety || '';

                wrapper.innerHTML = `
                    <div class="aux-card-inner">
                        <div class="aux-img-box">
                            ${hasImg
                                ? `<img src="${v.image}" alt="${v.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                                   <div class="aux-venue-placeholder" style="display:none;width:100%;height:100%;background:linear-gradient(135deg,#E2E8F0,#CBD5E1);align-items:center;justify-content:center;font-size:2rem;display:flex;">🏞️</div>`
                                : `<div class="aux-venue-placeholder" style="width:100%;height:100%;background:linear-gradient(135deg,#E2E8F0,#CBD5E1);display:flex;align-items:center;justify-content:center;font-size:2rem;">🏞️</div>`
                            }
                        </div>
                        <div class="aux-text-panel">
                            <h4>${v.name}</h4>
                            ${desc ? `<p class="aux-desc">${desc}</p>` : ''}
                            ${safety ? `<p class="aux-safety">⚠️ ${safety}</p>` : ''}
                        </div>
                    </div>
                `;

                // Mobile click/touch expansion
                wrapper.addEventListener('click', function(e) {
                    // Only on touch devices or non-hover devices
                    if (window.matchMedia('(hover: none)').matches || 'ontouchstart' in window) {
                        e.stopPropagation();
                        // Close any other expanded card
                        document.querySelectorAll('.aux-card-wrapper.expanded').forEach(el => {
                            if (el !== wrapper) el.classList.remove('expanded');
                        });
                        wrapper.classList.toggle('expanded');
                    }
                });

                grid.appendChild(wrapper);
            });

            // Global click to close expanded cards
            document.addEventListener('click', function(e) {
                if (!e.target.closest('.aux-card-wrapper')) {
                    document.querySelectorAll('.aux-card-wrapper.expanded').forEach(el => {
                        el.classList.remove('expanded');
                    });
                }
            });
        }

        function renderOrderBanner() {
            const bpText = document.getElementById('bikeParkingText');
            const erText = document.getElementById('equipmentReturnText');
            if (bpText) bpText.textContent = venuesData.rules?.bikeParking || '';
            if (erText) erText.textContent = venuesData.rules?.equipmentReturn || '';
        }

        function scrollToVenueShowcase() {
            document.getElementById('venueHeroCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Init venues on page load
        loadVenuesData();

        // ─── / Venue Empowerment V6 ───────────────────────────────────────────────

        // Sunshine Tracker (legacy — kept for compatibility)
        function triggerSunshine(el, className, time) {
            document.querySelectorAll('.sun-slot').forEach(s => s.classList.remove('active'));
            el.classList.add('active');
            const overlay = document.getElementById('tyndallOverlay');
            overlay.classList.add('active');
            setTimeout(() => overlay.classList.remove('active'), 2500);
        }

        // Club Filters
        function filterClubs(age, btn) {
            document.querySelectorAll('.age-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.club-card').forEach(card => {
                const ages = card.getAttribute('data-age');
                if (age === 'all' || ages.includes(age)) {
                    card.style.display = 'block';
                    setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, 50);
                } else {
                    card.style.opacity = '0';
                    setTimeout(() => card.style.display = 'none', 300);
                }
            });
        }

        // Wishlist
        let wishlist = [];
        function addToWishlist(course) {
            if (!wishlist.includes(course)) {
                wishlist.push(course);
                alert('🎒 已添加到心愿单！\n当前' + wishlist.length + '个课程在心愿单中。');
            } else {
                alert('⚠️ 该课程已在心愿单中！');
            }
        }

        // Data card flip for mobile (click to toggle)
        document.querySelectorAll('.flip-card').forEach(card => {
            card.addEventListener('click', function () {
                if (window.innerWidth < 768) {
                    this.classList.toggle('flipped');
                }
            });
        });

        // BMI Analyzer — defer until DOM is ready
        function updateBMI() {
            const ageSlider = document.getElementById('ageSlider');
            const heightSlider = document.getElementById('heightSlider');
            const weightSlider = document.getElementById('weightSlider');
            if (!ageSlider || !heightSlider || !weightSlider) return;
            const age = parseFloat(ageSlider.value);
            const height = parseFloat(heightSlider.value);
            const weight = parseFloat(weightSlider.value);

            document.getElementById('ageValue').textContent = age.toFixed(1);
            document.getElementById('heightValue').textContent = height;
            document.getElementById('weightValue').textContent = weight.toFixed(1);

            // Calculate BMI = weight(kg) / [height(m)]^2
            const heightM = height / 100;
            const bmi = weight / (heightM * heightM);
            const bmiRounded = bmi.toFixed(1);

            document.getElementById('bmiValue').textContent = bmiRounded;

            // Update needle rotation (-90deg to 90deg, mapped from BMI 10-22)
            // BMI 10 = -90deg, BMI 22 = 90deg
            const minBMI = 10, maxBMI = 22;
            const normalizedBMI = Math.max(minBMI, Math.min(maxBMI, bmi));
            const angle = ((normalizedBMI - minBMI) / (maxBMI - minBMI)) * 180 - 90;
            document.getElementById('bmiNeedle').style.transform = `translateX(-50%) rotate(${angle}deg)`;

            // Determine zone and update content
            const bmiHeader = document.getElementById('bmiHeader');
            const bmiZoneTitle = document.getElementById('bmiZoneTitle');
            const bmiZoneSubtitle = document.getElementById('bmiZoneSubtitle');
            const bmiConclusion = document.getElementById('bmiConclusion');
            const bmiImpact = document.getElementById('bmiImpact');

            bmiHeader.classList.remove('underweight', 'healthy', 'overweight');

            if (bmi < 13.5) {
                // Underweight zone
                bmiHeader.classList.add('underweight');
                bmiZoneTitle.innerHTML = '<span class="zh">⚠️ 体重不足区间</span>';
                bmiZoneSubtitle.textContent = 'Insufficient explosive power base, beware of muscle mass deficiency';
                bmiConclusion.innerHTML = '<span class="zh">由于绝对肌肉量较低，蹬地时的地反力受限。短跑速度和跳远高度将低于标准。建议进行适度抗阻训练和营养干预以提升核心力量。</span>';
                bmiImpact.innerHTML = '<span class="zh">爆发力基础不足，需警惕肌肉质量缺乏。推荐适度抗阻训练和营养干预。</span>';
            } else if (bmi <= 17.5) {
                // Healthy zone
                bmiHeader.classList.add('healthy');
                bmiZoneTitle.innerHTML = '<span class="zh">✅ 健康区间</span>';
                bmiZoneSubtitle.textContent = 'Optimal sports performance range, perfect joint load';
                bmiConclusion.innerHTML = '<span class="zh">关节承压处于最佳安全阈值内。跑动时有充足的腾空时间（Flight time），神经指令能高效转化为肌肉动作，极易达到成熟的动作模式，适合开展进阶运动技能学习。</span>';
                bmiImpact.innerHTML = '<span class="zh">处于最佳运动表现范围，关节负载完美。非常适合开展进阶运动技能学习。</span>';
            } else {
                // Overweight zone
                bmiHeader.classList.add('overweight');
                bmiZoneTitle.innerHTML = '<span class="zh">🚨 超重/肥胖区间</span>';
                bmiZoneSubtitle.textContent = 'High joint risk, movement pattern degradation warning';
                bmiConclusion.innerHTML = '<span class="zh">高关节风险和动作模式退化预警。跑动中孩子容易失去关键的腾空阶段（退化为快走保持平衡）。跳跃落地时的巨大冲击力容易导致足弓塌陷（扁平足风险）和膝外翻（X型腿）。需重点关注体重管理和低冲击有氧干预。</span>';
                bmiImpact.innerHTML = '<span class="zh">高关节风险，动作模式退化预警。需要重点关注体重管理和低冲击有氧干预。</span>';
            }

            // Update milestone cards
            document.querySelectorAll('.milestone-card').forEach(card => {
                const minAge = parseFloat(card.dataset.ageMin);
                const maxAge = parseFloat(card.dataset.ageMax);
                if (age >= minAge && age <= maxAge) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
            });
        }

        ageSlider.addEventListener('input', updateBMI);
        heightSlider.addEventListener('input', updateBMI);
        weightSlider.addEventListener('input', updateBMI);

        // Initialize
        updateBMI();

        // Close on background click
        document.getElementById('lightbox').addEventListener('click', function (e) {
            if (e.target === this) closeLightbox();
        });

        // Table switch — now API-driven
        const API_BASE = '/api/curriculum';
        const GALLERY_API_BASE = '/api';
        let semesterMode = 'baseline';
        let currentAge = 4.0;
        let currentStationIndex = 0;
        let radarChart = null;
        let galleryItems = []; // dynamic gallery data from API

        // ── Gallery: load from API ──────────────────────────────────────────────
        async function loadGallery() {
            const grid = document.getElementById('galleryGrid');
            if (!grid) return;
            try {
                const res = await fetch(`${GALLERY_API_BASE}/gallery?t=` + Date.now());
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                galleryItems = json.data || [];
                renderGalleryGrid(galleryItems);
            } catch (err) {
                console.error('Gallery load failed:', err);
                if (grid) grid.innerHTML = '<div style="text-align:center;padding:3rem;color:#E63946;grid-column:1/-1;">数据加载失败</div>';
            }
        }

        function renderGalleryGrid(items) {
            const grid = document.getElementById('galleryGrid');
            if (!grid) return;
            if (!items || items.length === 0) {
                grid.innerHTML = '<div style="text-align:center;padding:3rem;color:#94A3B8;grid-column:1/-1;">暂无照片或视频</div>';
                return;
            }
            grid.innerHTML = items.map((item, i) => {
                const src = `assets/olympic/${item.filename}`;
                if (item.type === 'video') {
                    return `<div class="photo-card fade-in-up" onclick="openGalleryItem(${i})">
                        <video src="${src}" muted loop playsinline preload="none"></video>
                        <div class="video-indicator"></div>
                        <div class="photo-info"><h4>${escapeHtml(item.caption || '')}</h4><p>${escapeHtml(item.date || '')}</p></div>
                    </div>`;
                }
                return `<div class="photo-card fade-in-up" onclick="openGalleryItem(${i})">
                    <img src="${src}" alt="${escapeHtml(item.caption || '')}" loading="lazy">
                    <div class="photo-info"><h4>${escapeHtml(item.caption || '')}</h4><p>${escapeHtml(item.date || '')}</p></div>
                </div>`;
            }).join('');
            // Re-observe new cards for fade-in
            if (window._galleryObserver) {
                document.querySelectorAll('#galleryGrid .fade-in-up').forEach(el => window._galleryObserver.observe(el));
            }
        }

        function openGalleryItem(index) {
            const item = galleryItems[index];
            if (!item) return;
            const lightbox = document.getElementById('lightbox');
            const imgEl = document.getElementById('lightboxImg');
            const videoEl = document.getElementById('lightboxVideo');
            if (!lightbox || !imgEl || !videoEl) return;

            const src = `assets/olympic/${item.filename}`;
            if (item.type === 'video') {
                imgEl.style.display = 'none';
                videoEl.style.display = 'block';
                videoEl.src = src;
                videoEl.play().catch(() => { });
            } else {
                videoEl.style.display = 'none';
                videoEl.pause();
                videoEl.src = '';
                imgEl.style.display = 'block';
                imgEl.src = src;
            }
            lightbox.classList.add('active');
        }

        function closeLightbox() {
            const lightbox = document.getElementById('lightbox');
            const videoEl = document.getElementById('lightboxVideo');
            if (lightbox) lightbox.classList.remove('active');
            if (videoEl) { videoEl.pause(); videoEl.src = ''; }
        }

        function escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        // Scroll animation observer (shared)
        window._galleryObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('visible');
            });
        }, { threshold: 0.1 });

        // Fetch curriculum data from API and render
        async function switchTable(type, btn) {
            // Update active tab button
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            if (btn) btn.classList.add('active');

            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-16 text-slate-400">加载中...</td></tr>`;

            try {
                const res = await fetch(`${API_BASE}/${type}?t=` + new Date().getTime());
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                renderTable(type, json.data);
            } catch (err) {
                console.error('Failed to load curriculum:', err);
                tbody.innerHTML = `<tr><td colspan="4" class="text-center py-16 text-red-400">数据加载失败，请确保后端服务已启动 (npm start)</td></tr>`;
            }
        }

        function renderTable(type, rows) {
            const tbody = document.getElementById('tableBody');
            if (!tbody) return;
            let html = '';

            // Helper to create event badge
            const eventBadge = (text) => {
                if (!text) return '';
                const isOlympic = text.toLowerCase().includes('olympic') || text.toLowerCase().includes('final');
                const isFamily = text.toLowerCase().includes('family');
                const isBoot = text.toLowerCase().includes('boot') || text.toLowerCase().includes('outing');
                const isGraduation = text.toLowerCase().includes('graduation') || text.toLowerCase().includes('ceremony');
                const isHoliday = text.toLowerCase().includes('holiday') || text.toLowerCase().includes('break') || text.toLowerCase().includes('fete') || text.toLowerCase().includes('festival') || text.toLowerCase().includes('sweeping');
                if (isOlympic) return `<span style="background:var(--primary-red);color:white;padding:2px 8px;border-radius:4px;font-size:0.75rem;">${text}</span>`;
                if (isFamily) return `<span style="background:var(--accent-teal);color:white;padding:2px 8px;border-radius:4px;font-size:0.75rem;">${text}</span>`;
                if (isBoot) return `<span style="background:var(--accent-gold);color:white;padding:2px 8px;border-radius:4px;font-size:0.75rem;">${text}</span>`;
                if (isGraduation) return `<span style="background:var(--primary-blue);color:white;padding:2px 8px;border-radius:4px;font-size:0.75rem;">${text}</span>`;
                if (isHoliday) return `<span style="background:var(--text-muted);color:white;padding:2px 8px;border-radius:4px;font-size:0.75rem;">${text}</span>`;
                return `<span style="background:var(--accent-gold);color:white;padding:2px 8px;border-radius:4px;font-size:0.75rem;">${text}</span>`;
            };

            // Helper for unit tag
            const unitTag = (row) => {
                const unit = typeof row === 'string' ? row : row.unit;
                const bgColor = row && row.bgColor ? row.bgColor : null;
                const textColor = row && row.textColor ? row.textColor : null;
                const colors = {
                    'Moving Safely': 'var(--accent-gold)',
                    'Locomotor Movement Skills': 'var(--accent-teal)',
                    'Locomotor Movement': 'var(--accent-teal)',
                    'Fundamental Movement Skills': 'var(--accent-teal)',
                    'Manipulative Skills': 'var(--primary-blue)',
                    'Olympic Month': 'var(--primary-red)',
                    'Gymnastics': 'var(--primary-blue)',
                    'Climbing': 'var(--accent-gold)',
                    'Swimming': 'var(--accent-teal)',
                };
                const fallbackColor = colors[unit] || 'var(--primary-blue)';
                const bg = bgColor || fallbackColor;
                const tc = textColor || 'white';
                if (!unit || unit.trim() === '') return '';
                return `<span class="tag-unit" style="background:${bg};color:${tc};">${unit}</span>`;
            };

            // Subunit rich formatter
            const formatSubunit = (text) => {
                if (!text || text.trim() === '') return `<span class="subunit-simple">—</span>`;

                // Pattern 1: Olympic compound — split on " & " followed by specific keywords
                const OlympicSplitters = / & (?=(?:20m|30m|50m|Sprint|Cycling|Hurdles|Relay|Balance|Bunny|Bouncing|Throw|Jump|Hang|Dribble|Shoot|Tug))/g;
                const items = text.split(OlympicSplitters);
                if (items.length > 1) {
                    const lines = items.map(item => {
                        const trimmed = item.trim();
                        if (!trimmed) return '';
                        const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)$/);
                        if (parenMatch) {
                            return `<span class="subunit-line"><span class="subunit-title">${parenMatch[1].trim()}</span><br><span class="subunit-desc">${parenMatch[2].trim()}</span></span>`;
                        }
                        return `<span class="subunit-line"><span class="subunit-title">${trimmed}</span></span>`;
                    }).filter(Boolean);
                    return `<div class="subunit-content">${lines.join('')}</div>`;
                }

                // Pattern 2: Climbing — split on "Technique (" to extract title and description
                const techMatch = text.match(/^(Technique|Progress Tracker|Setting Targets|Introduction|Level\s+[\d\-]+)\s*[\.\–\-]?\s*(.+)?$/i);
                if (techMatch) {
                    const title = techMatch[1].trim();
                    const desc = (techMatch[2] || '').trim();
                    if (desc) {
                        return `<div class="subunit-content">
                            <span class="subunit-line"><span class="subunit-title">${title}</span></span>
                            <span class="subunit-desc">${desc.replace(/\.$/, '')}</span>
                        </div>`;
                    }
                    return `<span class="subunit-simple">${title}</span>`;
                }

                // Pattern 3: parenthetical description — "Title (Description)"
                const parenMatch = text.match(/^(.+?)\s*\(([^)]+)\)$/);
                if (parenMatch) {
                    return `<div class="subunit-content">
                        <span class="subunit-line"><span class="subunit-title">${parenMatch[1].trim()}</span></span>
                        <span class="subunit-desc">${parenMatch[2].trim()}</span>
                    </div>`;
                }

                // Pattern 4: raw \n newlines — split and render each line
                if (text.includes('\n')) {
                    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                    if (lines.length > 1) {
                        const subunitLines = lines.map(line => {
                            const pm = line.match(/^(.+?)\s*\(([^)]+)\)$/);
                            if (pm) {
                                return `<span class="subunit-line"><span class="subunit-title">${pm[1].trim()}</span><br><span class="subunit-desc">${pm[2].trim()}</span></span>`;
                            }
                            return `<span class="subunit-line"><span class="subunit-title">${line}</span></span>`;
                        }).join('');
                        return `<div class="subunit-content">${subunitLines}</div>`;
                    }
                }

                return `<span class="subunit-simple">${text}</span>`;
            };

            for (const row of rows) {
                if (row.holiday) {
                    html += `<tr class="holiday-row"><td colspan="4">${row.holiday}</td></tr>`;
                } else if (row.semester) {
                    html += `<tr class="semester-row"><td colspan="4">${row.semester}</td></tr>`;
                } else {
                    html += `<tr>
                        <td><span class="week-badge">W${row.week}</span></td>
                        <td>${row.month}</td>
                        <td>${unitTag(row)}</td>
                        <td>${formatSubunit(row.subunit)}</td>
                    </tr>`;
                }
            }

            tbody.innerHTML = html;
        }

        // Initialize — fetch from API
        document.addEventListener('DOMContentLoaded', function () {
            switchTable('prek', document.querySelector('.tab-btn'));
        });

        // ===== RADAR CONSOLE LOGIC =====

        // Complete 8-axis test data
        const stationData = [
            {
                icon: '⚖️',
                title: '走平衡木',
                titleEn: 'Balance Beam | 动态平衡',
                assessment: {
                    zh: '测试动态平衡能力与核心骨盆稳定性，深度激活内耳前庭系统。',
                    en: 'Testing dynamic balance and core-pelvis stability, deeply activating the inner ear vestibular system.'
                },
                norms: [
                    { age: '3岁', value: '引导下平稳走过' },
                    { age: '4岁', value: '独立完成，稍有晃动' },
                    { age: '5岁', value: '躯干直立，约4-6秒', highlight: true },
                    { age: '6岁', value: '快速流畅，<6秒', highlight: true }
                ],
                scores: { 3: 25, 3.5: 35, 4: 50, 4.5: 60, 5: 75, 5.5: 85, 6: 95 }
            },
            {
                icon: '🦘',
                title: '立定跳远',
                titleEn: 'Standing Long Jump | 下肢爆发',
                assessment: {
                    zh: '测试下肢绝对爆发力，以及"摆臂-蹬地"的发力链协同（促进胼胝体发育）。',
                    en: 'Testing lower limb explosive power and arm-leg coordination (corpus callosum development indicator).'
                },
                norms: [
                    { age: '3岁', value: '45-60 cm（双脚同时离地）' },
                    { age: '4岁', value: '65-85 cm' },
                    { age: '5岁', value: '85-105 cm', highlight: true },
                    { age: '6岁', value: '105-125 cm+（懂向后摆臂蓄力）', highlight: true }
                ],
                scores: { 3: 30, 3.5: 40, 4: 55, 4.5: 65, 5: 75, 5.5: 85, 6: 95 }
            },
            {
                icon: '🐰',
                title: '5米连续跳',
                titleEn: '5m Bunny Hop | 敏捷节律',
                assessment: {
                    zh: '考察下肢肌肉快速收缩能力、动作节奏感与核心连续缓冲能力。',
                    en: 'Testing lower limb fast-twitch muscle power, movement rhythm, and core muscle continuous buffering ability.'
                },
                norms: [
                    { age: '3岁', value: '允许停顿，重在双脚同时起落' },
                    { age: '4岁', value: '6.0-8.0秒（连续性增强）' },
                    { age: '5岁', value: '4.5-6.0秒', highlight: true },
                    { age: '6岁', value: '3.5-4.5秒（连贯如弹簧）', highlight: true }
                ],
                scores: { 3: 25, 3.5: 35, 4: 50, 4.5: 65, 5: 80, 5.5: 90, 6: 98 }
            },
            {
                icon: '⚡',
                title: '10米折返跑',
                titleEn: '10m Shuttle Run | 变向速度',
                assessment: {
                    zh: '测试变向速度与敏捷性，深度考验大脑的"执行功能"（急停与变向时的抑制控制力）。',
                    en: 'Testing change-of-direction speed and agility, deeply challenging brain executive function—action inhibition and restart ability during sudden stops.'
                },
                norms: [
                    { age: '3岁', value: '8.5-10.5秒（注意转身防摔）' },
                    { age: '4岁', value: '7.5-9.0秒' },
                    { age: '5岁', value: '6.8-8.0秒', highlight: true },
                    { age: '6岁', value: '6.0-7.0秒（转身重心压低）', highlight: true }
                ],
                scores: { 3: 25, 3.5: 35, 4: 50, 4.5: 65, 5: 78, 5.5: 88, 6: 95 }
            },
            {
                icon: '⚾',
                title: '网球掷远',
                titleEn: 'Overhead Throw | 上肢力量',
                assessment: {
                    zh: '测试躯干与上肢力量，投掷动作跨越身体中线，有效促进左右脑半球信息交换。',
                    en: 'Testing trunk and upper limb explosive power. Throwing across the body midline promotes inter-hemispheric information exchange.'
                },
                norms: [
                    { age: '3岁', value: '约3米（多为单臂发力）' },
                    { age: '4岁', value: '约5米' },
                    { age: '5岁', value: '约7米（出现重心转移意识）', highlight: true },
                    { age: '6岁', value: '9米以上（掌握蹬地转体发力链）', highlight: true }
                ],
                scores: { 3: 20, 3.5: 30, 4: 45, 4.5: 60, 5: 75, 5.5: 88, 6: 95 }
            },
            {
                icon: '🏀',
                title: '连续拍球',
                titleEn: 'Basketball Bounce | 手眼协调',
                assessment: {
                    zh: '高强度考验手-眼-脑神经回路，统合视觉追踪与空间预判能力。',
                    en: 'Intensely testing hand-eye-brain neural circuits, integrating visual tracking and spatial prediction ability.'
                },
                norms: [
                    { age: '3岁', value: '双手抓接反弹球为主' },
                    { age: '4岁', value: '单手连续拍3-5次' },
                    { age: '5岁', value: '连续拍10-20次', highlight: true },
                    { age: '6岁', value: '连续20-40次（手腕下压，不打球）', highlight: true }
                ],
                scores: { 3: 15, 3.5: 25, 4: 40, 4.5: 55, 5: 70, 5.5: 82, 6: 92 }
            },
            {
                icon: '🦩',
                title: '单脚站立',
                titleEn: 'One-Leg Balance | 静态平衡',
                assessment: {
                    zh: '测试深层肌肉关节感受器（本体觉）。这是大脑排除干扰、保持高度专注的生理基础。',
                    en: 'Testing proprioceptors. Balance is the physiological foundation for the brain to maintain focus and filter out distractions.'
                },
                norms: [
                    { age: '3岁', value: '3-5秒' },
                    { age: '4岁', value: '6-10秒' },
                    { age: '5岁', value: '10-20秒', highlight: true },
                    { age: '6岁', value: '20秒以上（微调能力强）', highlight: true }
                ],
                scores: { 3: 20, 3.5: 30, 4: 45, 4.5: 60, 5: 75, 5.5: 85, 6: 92 }
            },
            {
                icon: '🧗',
                title: '悬垂',
                titleEn: 'Bar Hang | 核心耐力',
                assessment: {
                    zh: '握力与上肢相对力量直观体现。握力是评估中枢神经系统整体强度与抗逆力的黄金指标。',
                    en: 'Grip strength and upper limb relative strength indicator. Grip strength is the gold standard for central nervous system overall strength and resilience in sports science.'
                },
                norms: [
                    { age: '3岁', value: '需辅助抓握，2-4秒' },
                    { age: '4岁', value: '独立悬垂3-6秒' },
                    { age: '5岁', value: '6-10秒', highlight: true },
                    { age: '6岁', value: '10-20秒（展现抗挫折意志力）', highlight: true }
                ],
                scores: { 3: 25, 3.5: 35, 4: 50, 4.5: 65, 5: 78, 5.5: 88, 6: 95 }
            }
        ];

        // Radar chart keys (for score lookup)
        const radarKeys = ['balance', 'jump', 'hop', 'shuttle', 'throw', 'dribble', 'standoff', 'hang'];
        // Short titles for radar axis labels
        const radarTitles = ['走平衡木', '立定跳远', '5米连续跳', '10米折返跑', '网球掷远', '连续拍球', '单脚站立', '悬垂'];

        // Score maps per test
        const scoreMaps = {
            balance: { 3: 25, 3.5: 35, 4: 50, 4.5: 60, 5: 75, 5.5: 85, 6: 95 },
            jump: { 3: 30, 3.5: 40, 4: 55, 4.5: 65, 5: 75, 5.5: 85, 6: 95 },
            hop: { 3: 25, 3.5: 35, 4: 50, 4.5: 65, 5: 80, 5.5: 90, 6: 98 },
            shuttle: { 3: 25, 3.5: 35, 4: 50, 4.5: 65, 5: 78, 5.5: 88, 6: 95 },
            throw: { 3: 20, 3.5: 30, 4: 45, 4.5: 60, 5: 75, 5.5: 88, 6: 95 },
            dribble: { 3: 15, 3.5: 25, 4: 40, 4.5: 55, 5: 70, 5.5: 82, 6: 92 },
            standoff: { 3: 20, 3.5: 30, 4: 45, 4.5: 60, 5: 75, 5.5: 85, 6: 92 },
            hang: { 3: 25, 3.5: 35, 4: 50, 4.5: 65, 5: 78, 5.5: 88, 6: 95 }
        };

        function getAgeScore(age, testKey) {
            const scores = scoreMaps[testKey];
            const ages = Object.keys(scores).map(parseFloat).sort((a, b) => a - b);
            let prev = ages[0], next = ages[0];
            for (let a of ages) {
                if (a <= age) prev = a;
                if (a >= age && next === ages[0]) next = a;
            }
            if (prev === next) return scores[prev];
            const ratio = (age - prev) / (next - prev);
            return Math.round(scores[prev] + ratio * (scores[next] - scores[prev]));
        }

        function getTargetScore(age, testKey) {
            const targetAge = Math.min(age + 0.5, 6.0);
            return getAgeScore(targetAge, testKey);
        }

        function initRadarChart() {
            const chartDom = document.getElementById('radarChart');
            if (!chartDom) return;
            radarChart = echarts.init(chartDom, null, { renderer: 'canvas' });

            const option = {
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'item',
                    backgroundColor: 'rgba(29,53,87,0.95)',
                    borderColor: 'transparent',
                    textStyle: { color: 'white', fontFamily: 'Noto Sans SC' }
                },
                legend: { show: false },
                radar: {
                    shape: 'polygon',
                    polygonBorderType: 'solid',
                    center: ['50%', '50%'],
                    radius: '70%',
                    axisName: {
                        color: '#1D3557',
                        fontFamily: 'Noto Sans SC',
                        fontSize: 12,
                        fontWeight: 600
                    },
                    splitNumber: 5,
                    splitLine: {
                        show: true,
                        lineStyle: { color: 'rgba(29,53,87,0.08)', width: 1 }
                    },
                    splitArea: {
                        show: true,
                        areaStyle: {
                            color: ['rgba(29,53,87,0.02)', 'rgba(29,53,87,0.05)', 'rgba(29,53,87,0.08)', 'rgba(29,53,87,0.12)', 'rgba(29,53,87,0.18)']
                        }
                    },
                    axisLine: {
                        show: true,
                        lineStyle: { color: 'rgba(29,53,87,0.12)' }
                    },
                    indicator: radarTitles.map(name => ({ name: name, max: 100 }))
                },
                series: [{
                    type: 'radar',
                    data: []
                }]
            };

            radarChart.setOption(option);

            // Click on radar to select station
            radarChart.on('click', function (params) {
                // Find which axis was clicked by checking if a data point is near a vertex
                const data = params.value;
                if (data && data.length === 8) {
                    // Find the index of the clicked point - use tooltip position
                }
            });

            // Use tooltip events to detect which axis
            radarChart.getZr().on('click', function (params) {
                const pointInPixel = [params.offsetX, params.offsetY];
                if (radarChart.containPixel('radar', pointInPixel)) {
                    const indicator = radarChart.convertFromPixel('radar', pointInPixel);
                    if (indicator && indicator.length >= 2) {
                        const index = Math.round(indicator[0]);
                        if (index >= 0 && index < 8) {
                            setActiveStation(index);
                        }
                    }
                }
            });

            // Hover cursor style on radar vertices
            radarChart.getZr().on('mousemove', function (params) {
                const pointInPixel = [params.offsetX, params.offsetY];
                if (radarChart.containPixel('radar', pointInPixel)) {
                    radarChart.getZr().setCursorStyle('pointer');
                }
            });
        }

        function updateRadarChart() {
            if (!radarChart) return;

            const baselineData = radarKeys.map(key => getAgeScore(currentAge, key));

            let targetData = null;
            if (semesterMode === 'target') {
                targetData = radarKeys.map(key => getTargetScore(currentAge, key));
            }

            const seriesData = [{
                value: baselineData,
                name: '当前能力',
                lineStyle: { color: '#2A9D8F', width: 2.5, type: 'solid' },
                areaStyle: {
                    color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                        { offset: 0, color: 'rgba(42,157,143,0.4)' },
                        { offset: 1, color: 'rgba(42,157,143,0.05)' }
                    ])
                },
                itemStyle: { color: '#2A9D8F', borderColor: '#fff', borderWidth: 2 },
                symbol: 'circle', symbolSize: 8
            }];

            if (targetData) {
                seriesData.push({
                    value: targetData,
                    name: '期末目标',
                    lineStyle: { color: '#E76F51', width: 2, type: [8, 4] },
                    areaStyle: {
                        color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                            { offset: 0, color: 'rgba(231,111,81,0.15)' },
                            { offset: 1, color: 'rgba(231,111,81,0)' }
                        ])
                    },
                    itemStyle: { color: '#E76F51', borderColor: '#fff', borderWidth: 2 },
                    symbol: 'circle', symbolSize: 8
                });
            }

            radarChart.setOption({ series: [{ data: seriesData }] });
        }

        function setActiveStation(index) {
            currentStationIndex = index;
            updateDataStation();
        }

        function navigateStation(direction) {
            currentStationIndex = (currentStationIndex + direction + 8) % 8;
            updateDataStation();
        }

        function updateDataStation() {
            const data = stationData[currentStationIndex];

            document.getElementById('stationIcon').textContent = data.icon;
            document.getElementById('stationTitle').innerHTML = '<span class="zh">' + data.title + '</span>';
            document.getElementById('stationTitleEn').textContent = data.titleEn;

            const assessmentEl = document.getElementById('stationAssessment');
            assessmentEl.innerHTML = '<span class="zh">' + data.assessment.zh + '</span><br><span class="en">' + data.assessment.en + '</span>';

            // Build norms rows with current age highlighted
            const ageKeys = [3, 3.5, 4, 4.5, 5, 5.5, 6];
            const currentNormIdx = ageKeys.indexOf(currentAge);
            let startIdx = Math.max(0, currentNormIdx - 1);
            let endIdx = Math.min(3, startIdx + 4);
            if (endIdx - startIdx < 4) startIdx = Math.max(0, endIdx - 4);
            const displayNorms = data.norms.slice(startIdx, endIdx + 1);

            const normsEl = document.getElementById('stationNorms');
            normsEl.innerHTML = displayNorms.map(n => {
                const isCurrentAge = n.age === Math.floor(currentAge) + '岁' || n.age === currentAge.toFixed(1).replace('.0', '') + '岁';
                const currentStyle = isCurrentAge ? 'color:#E76F51;font-weight:800' : '';
                return '<div class="norm-row">' +
                    '<span class="norm-age">' + n.age + '</span>' +
                    '<span class="norm-value' + (n.highlight ? ' highlight' : '') + '"' + (currentStyle ? ' style="' + currentStyle + '"' : '') + '>' + n.value + '</span>' +
                    '</div>';
            }).join('');

            // Highlight current axis on radar
            if (radarChart) {
                radarChart.dispatchAction({
                    type: 'highlight',
                    seriesIndex: 0,
                    dataIndex: currentStationIndex
                });
            }
        }

        function setSemesterMode(mode) {
            semesterMode = mode;
            document.querySelectorAll('.semester-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
            const indicator = document.getElementById('deltaIndicator');
            if (mode === 'target') {
                indicator.style.opacity = '1';
                indicator.style.border = '1px dashed #E76F51';
                indicator.querySelector('.delta-value').style.color = '#E76F51';
            } else {
                indicator.style.opacity = '0.6';
                indicator.style.border = '1px dashed rgba(42,157,143,0.3)';
                indicator.querySelector('.delta-value').style.color = 'var(--primary-blue)';
            }
            updateRadarChart();
        }

        // Init when DOM ready
        document.addEventListener('DOMContentLoaded', function () {
            loadGallery();
            initRadarChart();
            updateRadarChart();
            updateDataStation();

            const ageSlider = document.getElementById('radarAgeSlider');
            if (ageSlider) {
                ageSlider.addEventListener('input', function () {
                    currentAge = parseFloat(this.value);
                    document.getElementById('radarAgeValue').textContent = currentAge.toFixed(1);
                    updateRadarChart();
                    updateDataStation(); // refresh norms highlight
                    const deltaPercent = Math.round(15 + (currentAge - 3) * 4);
                    document.querySelector('.delta-value').textContent = '+' + deltaPercent + '%';
                });
            }

            window.addEventListener('resize', function () {
                if (radarChart) radarChart.resize();
            });
        });

        // ─── Morning Parkour Frontend ─────────────────────────────────────────────
        const PARKOUR_API = '/api/parkour';
        let parkourRows = [];
        let parkourVideoRows = [];

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function formatSafetyHtml(text) {
            if (!text) return '';
            return text.split('\n').map(line => {
                if (!line.trim()) return '';
                const content = escapeHtml(line.replace(/^[✅⚠️]+/, ''));
                if (line.includes('⚠️')) {
                    return `<span class="warn">⚠️ ${content}</span>`;
                }
                return `<span class="ok">✅ ${content}</span>`;
            }).join('<br>');
        }

        function openParkourMap(imagePath, caption) {
            const lb = document.getElementById('pkLightbox');
            const img = document.getElementById('pkLightboxImg');
            const vid = document.getElementById('pkLightboxVideo');
            const cap = document.getElementById('pkLightboxCaption');
            if (!lb || !img) return;
            img.style.display = '';
            img.classList.remove('zoomed');
            lb.classList.remove('zoomed');
            if (vid) vid.style.display = 'none';
            img.src = imagePath;
            if (cap) cap.textContent = caption || '';
            lb.classList.add('open');
            document.body.style.overflow = 'hidden';
        }

        function togglePkLightboxZoom(e) {
            e.stopPropagation();
            const lb = document.getElementById('pkLightbox');
            const img = document.getElementById('pkLightboxImg');
            if (!lb || !img) return;
            lb.classList.toggle('zoomed');
            img.classList.toggle('zoomed');
        }

        function closePkLightbox() {
            const lb = document.getElementById('pkLightbox');
            const img = document.getElementById('pkLightboxImg');
            const vid = document.getElementById('pkLightboxVideo');
            if (lb) { lb.classList.remove('open'); lb.classList.remove('zoomed'); }
            if (img) { img.src = ''; img.style.display = 'none'; img.classList.remove('zoomed'); }
            if (vid) { vid.src = ''; vid.style.display = 'none'; }
            document.body.style.overflow = '';
        }

        function openPkVideoLightbox(src, title) {
            const lb = document.getElementById('pkLightbox');
            const img = document.getElementById('pkLightboxImg');
            const vid = document.getElementById('pkLightboxVideo');
            const cap = document.getElementById('pkLightboxCaption');
            if (!lb || !vid) return;
            img.style.display = 'none';
            vid.style.display = 'block';
            vid.src = src;
            if (cap) cap.textContent = title || '';
            lb.classList.add('open');
            document.body.style.overflow = 'hidden';
        }

        async function loadParkourFrontend() {
            const featured = document.getElementById('parkourFeaturedSection');
            const schedule = document.getElementById('parkourScheduleSection');
            const videoSection = document.getElementById('parkourVideoSection');
            if (!featured || !schedule) return;

            try {
                const [pkRes, vidRes] = await Promise.all([
                    fetch(PARKOUR_API + '?t=' + Date.now()),
                    fetch(BASE_API_URL + '/api/parkour-videos?t=' + Date.now())
                ]);
                const pkJson = await pkRes.json();
                const vidJson = await vidRes.json();
                if (pkJson.success) parkourRows = pkJson.data || [];
                if (vidJson.success) parkourVideoRows = vidJson.data || [];
            } catch (err) {
                parkourRows = [];
                parkourVideoRows = [];
                console.error('Failed to load parkour:', err);
            }

            // Featured track: use isFeatured=true row, fallback to first
            const featuredRow = parkourRows.find(r => r.isFeatured === true) || parkourRows[0];
            if (featuredRow) {
                featured.style.display = 'block';
                const safetyHtml = formatSafetyHtml(featuredRow.safetyNotes || '暂无安全指南');
                let imgHtml;
                if (featuredRow.imagePath) {
                    imgHtml = `<img src="${featuredRow.imagePath}?t=${Date.now()}" alt="${escapeHtml(featuredRow.trackName || '')}" onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#E2E8F0,#F8FAFC)';this.parentElement.innerHTML='<div style=display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:0.5rem;><span style=font-size:2rem;>🗺️</span><span style=color:#94A3B8;font-size:0.85rem;>Map Coming Soon</span></div>';">`;
                } else {
                    // Placeholder with gradient
                    imgHtml = `<div style="width:100%;height:100%;background:linear-gradient(135deg,#E2E8F0,#F8FAFC);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0.5rem;border-radius:12px;">
                        <span style="font-size:2.5rem;">🗺️</span>
                        <span style="color:#94A3B8;font-size:0.9rem;">Map Coming Soon</span>
                        <span style="color:#CBD5E1;font-size:0.75rem;">跑道图即将发布</span>
                    </div>`;
                }
                featured.innerHTML = `
                <div class="parkour-featured">
                    <div class="parkour-featured-header">
                        <span>⭐ 本周焦点跑道 <span style="font-weight:400;opacity:0.8;font-size:0.85em;">| Featured Track</span></span>
                    </div>
                    <div class="parkour-featured-body">
                        <div class="parkour-featured-image">${imgHtml}</div>
                        <div class="parkour-featured-info">
                            <span class="parkour-week-badge">${escapeHtml(featuredRow.week || '')}</span>
                            <div class="parkour-track-name">${escapeHtml(featuredRow.trackName || '')}</div>
                            <div class="parkour-class-teacher">${escapeHtml(featuredRow.className || '')} · ${escapeHtml(featuredRow.teacher || '')}</div>
                            <div class="parkour-safety-alert">
                                <div class="parkour-safety-title">🚨 Safety First | 安全重点</div>
                                <div class="parkour-safety-notes">${safetyHtml}</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            } else {
                featured.style.display = 'none';
            }

            // Schedule table
            if (parkourRows.length > 0) {
                schedule.style.display = 'block';
                const rowsHtml = parkourRows.map(row => {
                    const safetyLine = (row.safetyNotes || '').split('\n').filter(l => l.trim()).slice(0, 2).join(' | ').substring(0, 80);
                    let mapCell;
                    if (row.imagePath) {
                        mapCell = `<img class="map-thumbnail" src="${escapeHtml(row.imagePath)}?t=${Date.now()}" alt="${escapeHtml(row.trackName || '')}" onclick="openParkourMap('${escapeHtml(row.imagePath)}', '${escapeHtml(row.trackName || '')}')" loading="lazy">`;
                    } else {
                        mapCell = `<div class="map-thumbnail-placeholder">暂无地图<span class="map-placeholder-sub">No Map</span></div>`;
                    }
                    return `<tr>
                        <td class="pk-week"><span>${escapeHtml(row.week || '')}</span></td>
                        <td>
                            <div class="pk-class">${escapeHtml(row.className || '')}</div>
                            <div class="pk-teacher">${escapeHtml(row.teacher || '')}</div>
                        </td>
                        <td class="pk-track">${escapeHtml(row.trackName || '')}</td>
                        <td class="pk-safety" style="white-space:pre-wrap;word-break:break-word;line-height:1.6;">${escapeHtml(safetyLine)}</td>
                        <td style="text-align:center;">${mapCell}</td>
                    </tr>`;
                }).join('');
                schedule.innerHTML = `
                <div class="parkour-schedule">
                    <div class="parkour-schedule-title">📅 跑酷排期大表 <span style="font-weight:400;color:#64748B;font-size:0.85rem;">Parkour Schedule</span></div>
                    <div class="parkour-table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Week</th>
                                    <th>Class & Teacher</th>
                                    <th>Track Name</th>
                                    <th>Safety Notes</th>
                                    <th style="text-align:center;">Map</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHtml}</tbody>
                        </table>
                    </div>
                </div>`;
            } else {
                schedule.style.display = 'none';
            }

            // Parkour Video Tutorial Grid
            if (parkourVideoRows.length > 0) {
                videoSection.style.display = 'block';
                const videoGrid = document.getElementById('pkVideoGrid');
                videoGrid.innerHTML = parkourVideoRows.map(v => `
                    <div class="pk-video-card" onclick="openPkVideoLightbox('/assets/parkour-videos/${v.filename}', '${escapeHtml(v.title || '')}')">
                        <div class="pk-video-thumb">
                            <video src="/assets/parkour-videos/${v.filename}" muted loop playsinline preload="metadata" onerror="this.parentElement.innerHTML='<div style=display:flex;align-items:center;justify-content:center;height:100%;background:#F1F5F9;><span style=font-size:2rem;>🎬</span></div>'"></video>
                            <div class="pk-video-overlay">▶</div>
                        </div>
                        <div class="pk-video-info">
                            <div class="pk-video-title">${escapeHtml(v.title || '未命名')}</div>
                            ${v.description ? `<div class="pk-video-desc">${escapeHtml(v.description)}</div>` : ''}
                        </div>
                    </div>`).join('');
            } else {
                videoSection.style.display = 'block';
                const videoGrid = document.getElementById('pkVideoGrid');
                videoGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem 1rem;background:#F8FAFC;border-radius:16px;border:2px dashed #E2E8F0;">
                    <div style="font-size:2.5rem;margin-bottom:0.75rem;">🎬</div>
                    <div style="font-size:1rem;font-weight:700;color:#64748B;">教学视频录制中...</div>
                    <div style="font-size:0.8rem;color:#94A3B8;margin-top:0.25rem;">Coaches are preparing tutorial videos for you</div>
                </div>`;
            }
        }

        // ─── Load parkour when morning section is in view ─────────────────────────
        document.addEventListener('DOMContentLoaded', () => {
            // Lazy load parkour when #morning comes into view
            const morningSection = document.getElementById('morning');
            if (!morningSection) return;
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    loadParkourFrontend();
                    observer.disconnect();
                }
            }, { threshold: 0.1 });
            observer.observe(morningSection);
        });
