/* ==========================================================
   TourWise – app.js
   Flow: Empty → Search (normalized) → Cards + Auto Compare
   + Login Modal (role selection) + Guidebook Detail
   ========================================================== */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  tours: [],
  guidebook: [],
  searchResults: [],
  compareA: null,
  compareB: null,
  currentTour: null,
  loginRole: null,   // 'business' | 'customer'
};

// ── Helpers ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const fmt = n => Number(n).toLocaleString('vi-VN') + ' đ';

const starsHtml = n => {
  const full = Math.floor(n);
  const half = n % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
};

function showToast(msg, type = '') {
  const c = $('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

/**
 * Normalize a Vietnamese string for fuzzy-searching:
 *  "Đà Lạt" → "da lat"  |  "Sa Pa" → "sa pa"
 *  Strips diacritics, lowercases, collapses whitespace.
 */
function normalize(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove combining marks
    .replace(/đ/g, 'd').replace(/Đ/g, 'd') // handle đ/Đ (not in NFD)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')      // keep only letters, digits, spaces
    .replace(/\s+/g, ' ')             // collapse whitespace
    .trim();
}

// ── Data Loading ───────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch('data/tours.json');
    const json = await res.json();
    state.tours = json.tours;
    state.guidebook = json.guidebook || [];
  } catch {
    state.tours = getFallbackTours();
    state.guidebook = [];
  }
  init();
}

// ── Init ───────────────────────────────────────────────────
function init() {
  renderCombos();
  renderDestinations();
  renderGuidebook();
  renderPartnerPage();
  bindEvents();
}

// ── Navigation ─────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section-page').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#navLinks a').forEach(a => a.classList.remove('active'));
  const map = {
    home: ['sectionHome', 'navHome'],
    combo: ['sectionCombo', 'navCombo'],
    destinations: ['sectionDestinations', 'navDestinations'],
    guidebook: ['sectionGuidebook', 'navGuidebook'],
    guidebookDetail: ['sectionGuidebookDetail', 'navGuidebook'],
    partner: ['sectionPartner', 'navPartner'],
  };
  const [secId, navId] = map[name] || ['sectionHome', 'navHome'];
  const sec = $(secId), nav = $(navId);
  if (sec) sec.classList.add('active');
  if (nav) nav.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Search ─────────────────────────────────────────────────
function doSearch() {
  const rawDest = $('searchDestination').value.trim();
  const type = $('searchType').value;

  if (!rawDest && !type) {
    showToast('Vui lòng nhập điểm đến hoặc chọn loại tour!', 'error');
    $('searchDestination').focus();
    return;
  }

  const normDest = normalize(rawDest);

  let results = [...state.tours];

  if (normDest) {
    results = results.filter(t => {
      // normalize every comparator field
      const fields = [
        t.destination,
        t.destinationKey || '',
        t.name,
        t.provider,
      ].map(normalize);
      return fields.some(f => f.includes(normDest));
    });
  }

  if (type) {
    results = results.filter(t => t.type === type);
  }

  state.searchResults = results;
  showSearchResults(results, rawDest || type);

  if (results.length === 0) {
    showToast('Không tìm thấy tour phù hợp 😔', 'error');
  } else {
    showToast(`Tìm thấy ${results.length} tour! 🎉`, 'success');
  }
}

function showSearchResults(results, query) {
  // Switch from empty state to results
  $('emptyHome').style.display = 'none';
  $('resultsArea').style.display = 'block';

  $('searchResultsText').innerHTML =
    `🔍 Kết quả cho "<strong>${query}</strong>": <strong>${results.length}</strong> tour`;

  renderTourGrid(results);

  if (results.length >= 2) {
    state.compareA = results[0];
    state.compareB = results[1];
    renderCompareSection(results);
    $('compareSection').style.display = 'block';
  } else {
    $('compareSection').style.display = 'none';
  }

  renderReviews(results);

  setTimeout(() => {
    $('resultsArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

function clearSearch() {
  $('searchDestination').value = '';
  $('searchType').value = '';
  $('searchDate').value = '';
  $('resultsArea').style.display = 'none';
  $('emptyHome').style.display = 'flex';
  state.searchResults = [];
  state.compareA = null;
  state.compareB = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.quickSearch = function (dest) {
  showSection('home');
  $('searchDestination').value = dest;
  setTimeout(doSearch, 100);
};

// ── Tour Cards ─────────────────────────────────────────────
function buildTourCard(tour) {
  const card = document.createElement('div');
  card.className = 'tour-card';
  card.dataset.id = tour.id;
  card.innerHTML = `
    <div class="tour-card-img-wrap">
      <img src="${tour.image}" alt="${tour.name}" loading="lazy" />
      <span class="tour-type-badge">${tour.type}</span>
    </div>
    <div class="tour-card-body">
      <div class="tour-card-provider">${tour.provider}</div>
      <div class="tour-card-name">${tour.name}</div>
      <div class="tour-card-meta">
        <span class="star-rating">${starsHtml(tour.rating)}</span>
        <strong>${tour.rating}</strong>
        <span class="rating-count">(${tour.reviews.toLocaleString()} đánh giá)</span>
      </div>
      <div class="tour-card-meta">
        <span>⏱️</span> ${tour.duration}
        &nbsp;•&nbsp;
        <span>🚌</span> ${tour.transport}
      </div>
      <div class="tour-card-footer">
        <div>
          <div class="tour-price">${fmt(tour.price)}</div>
          <div class="tour-price-sub">/ người</div>
        </div>
        <button class="btn-detail" data-id="${tour.id}">Chi tiết</button>
      </div>
    </div>
  `;
  card.querySelector('.btn-detail').addEventListener('click', e => {
    e.stopPropagation();
    openTourModal(tour.id);
  });
  card.addEventListener('click', () => openTourModal(tour.id));
  return card;
}

function renderTourGrid(tours) {
  const grid = $('tourGrid');
  grid.innerHTML = '';
  if (!tours || tours.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>Không tìm thấy tour phù hợp</h3>
        <p>Thử thay đổi từ khóa hoặc điểm đến khác</p>
      </div>`;
    return;
  }
  tours.forEach(t => grid.appendChild(buildTourCard(t)));
}

// ── Compare ────────────────────────────────────────────────
function renderCompareSection(tours) {
  renderCompareSelectors(tours);
  renderCompareTable();
}

function renderCompareSelectors(tours) {
  const opts = tours.map(t =>
    `<option value="${t.id}">${t.provider} – ${t.name}</option>`
  ).join('');

  $('compareSelectors').innerHTML = `
    <div class="compare-selector-group">
      <span class="compare-selector-label">Tour A</span>
      <select class="compare-selector" id="selectA">${opts}</select>
    </div>
    <div class="compare-selector-group">
      <span class="compare-selector-label b">Tour B</span>
      <select class="compare-selector" id="selectB">${opts}</select>
    </div>
  `;

  const selA = $('selectA');
  const selB = $('selectB');
  selA.value = String(tours[0]?.id ?? '');
  selB.value = String(tours[1]?.id ?? tours[0]?.id ?? '');

  const onChange = () => {
    const idA = parseInt(selA.value);
    const idB = parseInt(selB.value);
    if (idA === idB) {
      showToast('Vui lòng chọn 2 tour khác nhau!', 'error');
      return;
    }
    state.compareA = state.tours.find(t => t.id === idA) || null;
    state.compareB = state.tours.find(t => t.id === idB) || null;
    renderCompareTable();
  };

  selA.addEventListener('change', onChange);
  selB.addEventListener('change', onChange);
}

function renderCompareTable() {
  const a = state.compareA;
  const b = state.compareB;
  if (!a || !b) { $('compareTableWrap').innerHTML = ''; return; }

  const aCheaper = a.price < b.price;
  const bCheaper = b.price < a.price;

  const criteria = [
    {
      icon: '🖼️', label: 'Hình ảnh',
      renderA: () => `<img src="${a.image}" alt="${a.provider}" />`,
      renderB: () => `<img src="${b.image}" alt="${b.provider}" />`,
    },
    { icon: '⏱️', label: 'Thời gian', key: 'duration' },
    {
      icon: '💰', label: 'Giá',
      renderA: () => `<span class="price-cell ${aCheaper ? 'cheaper' : ''}">${fmt(a.price)}</span>`,
      renderB: () => `<span class="price-cell ${bCheaper ? 'cheaper' : ''}">${fmt(b.price)}</span>`,
    },
    { icon: '🚌', label: 'Phương tiện', key: 'transport' },
    { icon: '🏨', label: 'Nơi ở', key: 'accommodation' },
    { icon: '🍽️', label: 'Bữa ăn', key: 'meals' },
    { icon: '🛡️', label: 'Bảo hiểm', key: 'insurance' },
    {
      icon: '⭐', label: 'Đánh giá',
      renderA: () => `<span style="color:var(--accent)">${starsHtml(a.rating)}</span> ${a.rating} (${a.reviews} lượt)`,
      renderB: () => `<span style="color:var(--accent)">${starsHtml(b.rating)}</span> ${b.rating} (${b.reviews} lượt)`,
    },
    {
      icon: '📋', label: 'Đặt tour',
      renderA: () => `<button class="btn-book" onclick="openTourModal(${a.id})">ĐẶT TOUR</button>`,
      renderB: () => `<button class="btn-book" onclick="openTourModal(${b.id})">ĐẶT TOUR</button>`,
    },
  ];

  const rows = criteria.map(c => {
    const cellA = c.renderA ? c.renderA() : (c.key ? (a[c.key] ?? '—') : '—');
    const cellB = c.renderB ? c.renderB() : (c.key ? (b[c.key] ?? '—') : '—');
    return `
      <tr>
        <td><span class="criterion-icon">${c.icon}</span>${c.label}</td>
        <td>${cellA}</td>
        <td>${cellB}</td>
      </tr>`;
  }).join('');

  $('compareTableWrap').innerHTML = `
    <table class="compare-table">
      <thead>
        <tr>
          <th>TIÊU CHÍ</th>
          <th>Tour A – ${a.provider}</th>
          <th class="col-b">Tour B – ${b.provider}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Reviews ────────────────────────────────────────────────
function renderReviews(tours) {
  const all = [];
  tours.forEach(tour => {
    (tour.reviews_data || []).forEach(r => all.push({ ...r, tourName: tour.name, provider: tour.provider }));
  });
  $('reviewsGrid').innerHTML = all.slice(0, 6).map(r => `
    <div class="review-card">
      <div class="review-header">
        <div class="review-avatar">${r.name[0]}</div>
        <div class="review-meta">
          <div class="review-name">${r.name} ${r.verified ? '<span class="verified-badge">✅</span>' : ''}</div>
          <div class="review-sub">${r.provider} · ${r.tourName}</div>
          <div class="review-stars">${'★'.repeat(r.rating)}</div>
        </div>
      </div>
      <div class="review-text">"${r.comment}"</div>
    </div>
  `).join('');
}

// ── Tour Detail Modal ──────────────────────────────────────
function openTourModal(tourId) {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour) return;
  state.currentTour = tour;

  $('modalImg').src = tour.image;
  $('modalImg').alt = tour.name;
  $('modalTourTitle').textContent = tour.name;
  $('modalProvider').textContent = `${tour.provider} · ${tour.type}`;
  $('modalPrice').textContent = fmt(tour.price);

  $('modalInfoGrid').innerHTML = `
    <div class="info-item">⏱️ Thời gian: <span>${tour.duration}</span></div>
    <div class="info-item">📍 Điểm đến: <span>${tour.destination}</span></div>
    <div class="info-item">⭐ Đánh giá: <span>${tour.rating} (${tour.reviews.toLocaleString()} lượt)</span></div>
    <div class="info-item">🚌 Phương tiện: <span>${tour.transport}</span></div>
    <div class="info-item">🏨 Nơi ở: <span>${tour.accommodation}</span></div>
    <div class="info-item">🍽️ Bữa ăn: <span>${tour.meals}</span></div>
    <div class="info-item">🛡️ Bảo hiểm: <span>${tour.insurance}</span></div>
  `;

  $('modalItinerary').innerHTML = (tour.itinerary || []).map((day, i) => `
    <li>
      <span class="day-badge">Ngày ${i + 1}</span>
      <span>${day.replace(/^Ngày \d+:\s*/i, '')}</span>
    </li>
  `).join('');

  $('modalInclusions').innerHTML = (tour.inclusions || []).map(i => `<span class="tag include">✅ ${i}</span>`).join('');
  $('modalExclusions').innerHTML = (tour.exclusions || []).map(e => `<span class="tag exclude">❌ ${e}</span>`).join('');

  $('modalReviews').innerHTML = (tour.reviews_data || []).map(r => `
    <div class="review-card" style="margin-bottom:.75rem;">
      <div class="review-header">
        <div class="review-avatar">${r.name[0]}</div>
        <div class="review-meta">
          <div class="review-name">${r.name} ${r.verified ? '<span class="verified-badge">✅</span>' : ''}</div>
          <div class="review-stars">${'★'.repeat(r.rating)}</div>
        </div>
      </div>
      <div class="review-text">"${r.comment}"</div>
    </div>
  `).join('');

  $('tourModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

window.openTourModal = openTourModal; // allow inline onclick

function closeTourModal() {
  $('tourModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Guidebook List ─────────────────────────────────────────
function renderGuidebook(filterCat = 'all') {
  const list = state.guidebook;
  if (!list || list.length === 0) {
    $('guidebookContent').innerHTML = `<div class="empty-state"><div class="empty-icon">📖</div><h3>Đang cập nhật bài viết...</h3></div>`;
    return;
  }

  // Unique categories
  const cats = ['all', ...new Set(list.map(p => p.category))];
  const catLabels = { all: '🗂 Tất cả' };

  const filtered = filterCat === 'all' ? list : list.filter(p => p.category === filterCat);
  const [featured, ...rest] = filtered;

  $('guidebookContent').innerHTML = `
    <div class="guide-category-bar" id="guideCategoryBar">
      ${cats.map(c => `
        <button class="guide-cat-btn ${filterCat === c ? 'active' : ''}" data-cat="${c}">
          ${catLabels[c] || c}
        </button>`).join('')}
    </div>
    ${featured ? `
    <div class="guide-featured" onclick="openGuidebookDetail(${featured.id})">
      <img src="${featured.coverImage}" alt="${featured.title}" loading="lazy" />
      <div class="guide-featured-overlay">
        <span class="guide-featured-tag">${featured.category}</span>
        <div class="guide-featured-title">${featured.title}</div>
        <div class="guide-featured-meta">${featured.author} &nbsp;·&nbsp; ${featured.date} &nbsp;·&nbsp; ⏱ ${featured.readTime} đọc</div>
        <div class="guide-featured-excerpt">${featured.subtitle}</div>
      </div>
    </div>` : ''}
    <div class="guide-grid" id="guideGrid">
      ${rest.map(p => `
        <div class="guide-card" onclick="openGuidebookDetail(${p.id})">
          <div class="guide-card-img-wrap">
            <img class="guide-card-img" src="${p.coverImage}" alt="${p.title}" loading="lazy" />
            <span class="guide-card-badge">${p.category}</span>
          </div>
          <div class="guide-card-body">
            <div class="guide-card-meta">
              <span>${p.date}</span>
              <span class="guide-card-meta-dot"></span>
              <span>⏱ ${p.readTime} đọc</span>
            </div>
            <div class="guide-card-title">${p.title}</div>
            <div class="guide-card-excerpt">${p.subtitle}</div>
            <div class="guide-card-footer">
              <div class="guide-card-author">
                <div class="guide-card-avatar">${p.author[0]}</div>
                <span class="guide-card-author-name">${p.author}</span>
              </div>
              <span class="guide-read-time">📖 Đọc tiếp →</span>
            </div>
          </div>
        </div>`).join('')}
    </div>
  `;

  // Bind category filter buttons
  document.querySelectorAll('.guide-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => renderGuidebook(btn.dataset.cat));
  });
}

// ── Guidebook Detail ───────────────────────────────────────
function openGuidebookDetail(id) {
  const post = state.guidebook.find(p => p.id === id);
  if (!post) return;

  const related = state.guidebook.filter(p => p.id !== id).slice(0, 4);

  const sidebarHtml = related.length ? `
    <div class="guide-sidebar">
      <span class="guide-sidebar-label">📌 Bài viết liên quan</span>
      ${related.map(r => `
        <div class="guide-sidebar-card" onclick="openGuidebookDetail(${r.id})">
          <img class="guide-sidebar-img" src="${r.coverImage}" alt="${r.title}" loading="lazy" />
          <div>
            <div class="guide-sidebar-title">${r.title}</div>
            <div class="guide-sidebar-meta">${r.category} · ${r.readTime} đọc</div>
          </div>
        </div>`).join('')}
    </div>` : '';

  $('guidebookDetailContent').innerHTML = `
    <button class="guide-back-btn" onclick="showSection('guidebook')">← Quay lại Cẩm Nang</button>
    <div class="guide-detail-hero">
      <img src="${post.coverImage}" alt="${post.title}" />
      <div class="guide-detail-hero-overlay">
        <span class="guide-detail-category">${post.category}</span>
        <div class="guide-detail-title">${post.title}</div>
        <div class="guide-detail-subtitle">${post.subtitle}</div>
        <div class="guide-detail-meta">
          <span>✍️ ${post.author}</span>
          <span>📅 ${post.date}</span>
          <span>⏱ ${post.readTime} đọc</span>
        </div>
      </div>
    </div>
    <div class="guide-detail-layout">
      <div class="guide-article">
        <p class="guide-article-intro">${post.subtitle}</p>
        ${(post.sections || []).map(s => `
          <div class="guide-article-section">
            <h3>${s.heading}</h3>
            <p>${s.content}</p>
          </div>`).join('')}
      </div>
      ${sidebarHtml}
    </div>
  `;

  showSection('guidebookDetail');
}

window.openGuidebookDetail = openGuidebookDetail;

// ── Combos ────────────────────────────────────────────────
const combosData = [
  { name: 'Sa Pa + Hà Giang 5N4Đ', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop', price: 6200000, save: 15, sub: 'SINH CAFE · Khám phá' },
  { name: 'Đà Lạt + Nha Trang 6N5Đ', image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=200&h=200&fit=crop', price: 7900000, save: 20, sub: 'SAIGONTOURIST · Nghỉ dưỡng' },
  { name: 'Phú Quốc + Côn Đảo 7N6Đ', image: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=200&h=200&fit=crop', price: 12500000, save: 25, sub: 'DREAM TRAVEL · Biển đảo' },
  { name: 'Hội An + Huế + Đà Nẵng 5N4Đ', image: 'https://cdn.vietnamisawesome.com/wp-content/uploads/2023/04/hoi-an-ancient-town-7-2048x1536.jpg', price: 8400000, save: 18, sub: 'SAIGON STAR · Văn hóa' },
];
function renderCombos() {
  $('comboGrid').innerHTML = combosData.map(c => `
    <div class="combo-card">
      <img src="${c.image}" alt="${c.name}" loading="lazy" />
      <div class="combo-card-body">
        <div class="combo-card-title">${c.name}</div>
        <div class="combo-card-sub">${c.sub}</div>
        <div class="combo-card-price">${fmt(c.price)} <span class="combo-card-save">-${c.save}%</span></div>
        <button class="btn-detail" style="margin-top:.65rem;" onclick="showToast('Liên hệ để đặt combo!', 'success')">Xem chi tiết</button>
      </div>
    </div>
  `).join('');
}

// ── Destinations ──────────────────────────────────────────
const destData = [
  { name: 'Sa Pa', count: '12 tour', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop' },
  { name: 'Đà Lạt', count: '8 tour', img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&h=300&fit=crop' },
  { name: 'Đà Nẵng', count: '15 tour', img: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=400&h=300&fit=crop' },
  { name: 'Phú Quốc', count: '10 tour', img: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=400&h=300&fit=crop' },
  { name: 'Hà Giang', count: '6 tour', img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=300&fit=crop' },
  { name: 'Nha Trang', count: '11 tour', img: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&h=300&fit=crop' },
  { name: 'Hội An', count: '9 tour', img: 'https://cdn.vietnamisawesome.com/wp-content/uploads/2023/04/hoi-an-ancient-town-7-2048x1536.jpg' },
  { name: 'Hạ Long', count: '14 tour', img: 'https://images.unsplash.com/photo-1540611025311-01df3cef54b5?w=400&h=300&fit=crop' },
];
function renderDestinations() {
  $('destinationsGrid').innerHTML = destData.map(d => `
    <div class="dest-card" onclick="quickSearch('${d.name}'); showSection('home');">
      <img src="${d.img}" alt="${d.name}" loading="lazy" />
      <div class="dest-overlay">
        <div><div class="dest-name">${d.name}</div><div class="dest-count">${d.count}</div></div>
      </div>
    </div>
  `).join('');
}

// ── Partner ────────────────────────────────────────────────
function renderPartnerPage() {
  $('partnerContent').innerHTML = `
    <div class="partner-grid">
      <div class="partner-card">
        <h3 style="color:var(--primary);">🏢 Lợi ích khi hợp tác</h3>
        <ul style="list-style:none;display:flex;flex-direction:column;gap:.65rem;font-size:.88rem;color:var(--text-mid);">
          <li>✅ Tiếp cận hàng chục nghìn khách hàng tiềm năng mỗi tháng</li>
          <li>✅ Hệ thống đặt tour tự động, hoạt động 24/7</li>
          <li>✅ So sánh tour minh bạch, tăng uy tín thương hiệu</li>
          <li>✅ Hỗ trợ marketing, quảng bá trực tuyến đa kênh</li>
          <li>✅ Dashboard theo dõi doanh thu thời gian thực</li>
          <li>✅ Hoa hồng cạnh tranh, thanh toán đúng hạn</li>
        </ul>
      </div>
      <div class="partner-card">
        <h3 style="color:var(--secondary);">📝 Đăng ký hợp tác</h3>
        <input class="partner-input" placeholder="Tên công ty / Cá nhân" />
        <input class="partner-input" placeholder="Email liên hệ" type="email" />
        <input class="partner-input" placeholder="Số điện thoại" type="tel" />
        <select class="partner-input" style="cursor:pointer;background:white;">
          <option>Loại hình kinh doanh...</option>
          <option>Công ty lữ hành</option>
          <option>Hướng dẫn viên tự do</option>
          <option>Resort / Khách sạn</option>
          <option>Vận chuyển du lịch</option>
        </select>
        <button class="btn-compare" onclick="showToast('Đã gửi đăng ký! TourWise sẽ liên hệ trong 24h 🎉', 'success')">Gửi đăng ký ngay →</button>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-value">200+</div><div class="stat-label">Đối tác lữ hành</div></div>
      <div class="stat-card"><div class="stat-value">30%</div><div class="stat-label">Tăng trưởng doanh thu</div></div>
      <div class="stat-card"><div class="stat-value">24/7</div><div class="stat-label">Hỗ trợ kỹ thuật</div></div>
      <div class="stat-card"><div class="stat-value">50K+</div><div class="stat-label">Khách đặt tour/tháng</div></div>
    </div>
  `;
}

// ── Login Modal ────────────────────────────────────────────
function openLoginModal() {
  // Reset to step 1
  $('loginStep1').style.display = 'block';
  $('loginStep2').style.display = 'none';
  state.loginRole = null;
  $('loginModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
  $('loginModal').classList.remove('open');
  document.body.style.overflow = '';
}
window.closeLoginModal = closeLoginModal;

function selectRole(role) {
  state.loginRole = role;
  $('loginStep1').style.display = 'none';
  $('loginStep2').style.display = 'block';

  const isBusiness = role === 'business';
  $('loginFormTitle').textContent = isBusiness ? '🏢 Đăng nhập Doanh Nghiệp' : '🧳 Đăng nhập Khách Hàng';
  $('loginFormSub').textContent = isBusiness
    ? 'Quản lý tour, hợp đồng và doanh thu của bạn'
    : 'Tìm & đặt tour, quản lý chuyến đi của bạn';

  const extraFields = $('businessExtraFields');
  if (extraFields) extraFields.style.display = isBusiness ? 'block' : 'none';
}

// ── Event Binding ──────────────────────────────────────────
function bindEvents() {
  // Nav links
  const navLinks = $('navLinks');
  document.querySelectorAll('#navLinks a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      showSection(a.dataset.section);
      navLinks.classList.remove('show'); // close on mobile
    });
  });
  $('logoHome').addEventListener('click', e => { e.preventDefault(); showSection('home'); });

  // Mobile menu toggle
  const mobileMenuBtn = $('mobileMenuBtn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('show');
    });
  }

  // Search
  $('btnSearch').addEventListener('click', doSearch);
  $('searchDestination').addEventListener('keydown', e => e.key === 'Enter' && doSearch());

  // Clear search
  $('btnClearSearch').addEventListener('click', clearSearch);

  // Quick dest buttons
  document.querySelectorAll('.quick-dest-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('searchDestination').value = btn.dataset.dest;
      doSearch();
    });
  });

  // Tour modal
  $('modalClose').addEventListener('click', closeTourModal);
  $('tourModal').addEventListener('click', e => { if (e.target === $('tourModal')) closeTourModal(); });
  $('modalBookBtn').addEventListener('click', () => {
    showToast(`Đặt tour "${state.currentTour?.name}" thành công! 🎫`, 'success');
    closeTourModal();
  });

  // Login button → open modal
  $('btnLogin').addEventListener('click', openLoginModal);

  // Login modal close
  $('loginClose').addEventListener('click', closeLoginModal);
  $('loginModal').addEventListener('click', e => { if (e.target === $('loginModal')) closeLoginModal(); });

  // Role cards
  $('roleBusiness').addEventListener('click', () => selectRole('business'));
  $('roleCustomer').addEventListener('click', () => selectRole('customer'));

  // Login back button
  $('loginBack').addEventListener('click', () => {
    $('loginStep1').style.display = 'block';
    $('loginStep2').style.display = 'none';
  });

  // Login/Register tabs
  $('tabLogin').addEventListener('click', () => {
    $('tabLogin').classList.add('active');
    $('tabRegister').classList.remove('active');
    $('formLogin').style.display = 'block';
    $('formRegister').style.display = 'none';
  });
  $('tabRegister').addEventListener('click', () => {
    $('tabRegister').classList.add('active');
    $('tabLogin').classList.remove('active');
    $('formRegister').style.display = 'block';
    $('formLogin').style.display = 'none';
    // Show/hide business extra fields based on role
    const extra = $('businessExtraFields');
    if (extra) extra.style.display = state.loginRole === 'business' ? 'block' : 'none';
  });

  // Login submit
  $('btnLoginSubmit').addEventListener('click', () => {
    const email = $('loginEmail').value.trim();
    const pw = $('loginPassword').value;
    if (!email || !pw) {
      showToast('Vui lòng nhập đầy đủ thông tin!', 'error');
      return;
    }
    showToast('Đăng nhập thành công! Chào mừng bạn 🎉', 'success');
    closeLoginModal();
  });

  // Password toggle
  $('pwToggle').addEventListener('click', () => {
    const inp = $('loginPassword');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    $('pwToggle').textContent = inp.type === 'password' ? '👁️' : '🙈';
  });

  // Chat
  $('chatBtn').addEventListener('click', () => showToast('Hỗ trợ trực tuyến đang kết nối... 💬'));

  // Keyboard ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeTourModal();
      closeLoginModal();
    }
  });
}

// ── Make globals ───────────────────────────────────────────
window.showToast = showToast;
window.showSection = showSection;

// ── Fallback data ──────────────────────────────────────────
function getFallbackTours() {
  return [
    {
      id: 1, name: 'Sa Pa 3 Ngày 2 Đêm', provider: 'SINH CAFE',
      destination: 'Sa Pa', destinationKey: 'sa pa sapa',
      duration: '3 ngày 2 đêm', price: 2050000, type: 'Tham quan',
      transport: 'Xe giường nằm', accommodation: '3 sao',
      meals: '5 bữa chính (120k/bữa)', insurance: '20.000.000 đ/khách',
      rating: 4.5, reviews: 320,
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=380&fit=crop',
      description: 'Tour Sa Pa cùng Sinh Cafe', itinerary: ['Ngày 1', 'Ngày 2', 'Ngày 3'],
      inclusions: ['Xe', 'KS 3 sao', '5 bữa', 'BH', 'HDV'], exclusions: ['CP cá nhân'],
      reviews_data: [{ name: 'Ngọc Hà', rating: 5, comment: 'Rất hay!', verified: true }]
    },
    {
      id: 2, name: 'Sa Pa 3 Ngày 2 Đêm', provider: 'DREAM TRAVEL',
      destination: 'Sa Pa', destinationKey: 'sa pa sapa',
      duration: '3 ngày 2 đêm', price: 2890000, type: 'Tham quan',
      transport: 'Tàu hỏa', accommodation: '3 sao',
      meals: '5 bữa chính (130k/bữa)', insurance: '20.000.000 đ/khách',
      rating: 4.7, reviews: 215,
      image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600&h=380&fit=crop',
      description: 'Tour Sa Pa cùng Dream Travel', itinerary: ['Ngày 1', 'Ngày 2', 'Ngày 3'],
      inclusions: ['Tàu hỏa', 'KS 3 sao', '5 bữa', 'BH', 'Xe đưa đón'], exclusions: ['CP cá nhân'],
      reviews_data: [{ name: 'Thu Phương', rating: 5, comment: 'Thích lắm!', verified: true }]
    },
    {
      id: 3, name: 'Đà Lạt 4 Ngày 3 Đêm', provider: 'SAIGON STAR',
      destination: 'Đà Lạt', destinationKey: 'da lat dalat',
      duration: '4 ngày 3 đêm', price: 3886000, type: 'Nghỉ dưỡng',
      transport: 'Xe 45 chỗ', accommodation: '3 sao',
      meals: '6 bữa ăn (150k/bữa)', insurance: '20.000.000 đ/khách',
      rating: 4.6, reviews: 178,
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&h=380&fit=crop',
      description: 'Tour Đà Lạt', itinerary: ['Ngày 1', 'Ngày 2', 'Ngày 3', 'Ngày 4'],
      inclusions: ['Xe', 'KS 3 sao', '6 bữa', 'BH', 'HDV'], exclusions: ['CP cá nhân'],
      reviews_data: [{ name: 'Lan Anh', rating: 5, comment: 'Đẹp quá!', verified: true }]
    },
    {
      id: 4, name: 'Đà Lạt 4 Ngày 3 Đêm', provider: 'SAIGONTOURIST',
      destination: 'Đà Lạt', destinationKey: 'da lat dalat',
      duration: '4 ngày 3 đêm', price: 3290000, type: 'Nghỉ dưỡng',
      transport: 'Xe 45 chỗ', accommodation: '3 sao',
      meals: '6 bữa (140k/bữa)', insurance: '20.000.000 đ/khách',
      rating: 4.8, reviews: 402,
      image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&h=380&fit=crop',
      description: 'Tour Đà Lạt Saigontourist', itinerary: ['Ngày 1', 'Ngày 2', 'Ngày 3', 'Ngày 4'],
      inclusions: ['Xe', 'KS 3 sao', '6 bữa', 'BH', 'HDV'], exclusions: ['CP cá nhân'],
      reviews_data: [{ name: 'Kim Ngân', rating: 5, comment: 'Uy tín!', verified: true }]
    }
  ];
}

// ── Bootstrap ──────────────────────────────────────────────
loadData();
