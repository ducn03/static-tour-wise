/* =====================================================
   TourLink – app.js
   Static SPA: Navigation | Search | Compare | Modal
   ===================================================== */

'use strict';

// ── State ────────────────────────────────────────────
const state = {
  tours: [],
  filtered: [],
  compareList: [],    // max 2 items
  activeSection: 'home',
  activeFilter: 'all',
  currentTour: null,
};

// ── Helpers ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString('vi-VN') + ' đ';
const stars = n => '★'.repeat(Math.floor(n)) + (n % 1 >= 0.5 ? '½' : '') + '☆'.repeat(5 - Math.ceil(n));

function showToast(msg, type = '') {
  const c = $('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

// ── Data Loading ─────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch('data/tours.json');
    const json = await res.json();
    state.tours = json.tours;
    state.filtered = [...state.tours];
  } catch (e) {
    console.warn('Fetch failed, using inline fallback data');
    state.tours = getFallbackTours();
    state.filtered = [...state.tours];
  }
  init();
}

// ── Init ─────────────────────────────────────────────
function init() {
  renderTourGrid(state.filtered);
  renderReviews();
  renderCombos();
  renderDestinations();
  renderGuidebook();
  renderPartnerPage();
  bindEvents();
}

// ── Navigation ────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section-page').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#navLinks a').forEach(a => a.classList.remove('active'));

  const sectionMap = {
    home: 'sectionHome',
    combo: 'sectionCombo',
    destinations: 'sectionDestinations',
    guidebook: 'sectionGuidebook',
    partner: 'sectionPartner',
  };
  const navMap = {
    home: 'navHome',
    combo: 'navCombo',
    destinations: 'navDestinations',
    guidebook: 'navGuidebook',
    partner: 'navPartner',
  };

  const sec = $(sectionMap[name]);
  const nav = $(navMap[name]);
  if (sec) sec.classList.add('active');
  if (nav) nav.classList.add('active');
  state.activeSection = name;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Tour Card ─────────────────────────────────────────
function buildTourCard(tour) {
  const isCompared = state.compareList.find(t => t.id === tour.id);
  const card = document.createElement('div');
  card.className = 'tour-card';
  card.dataset.id = tour.id;
  card.innerHTML = `
    <div class="tour-card-img-wrap">
      <img src="${tour.image}" alt="${tour.name}" loading="lazy" />
      <span class="tour-type-badge">${tour.type}</span>
      <div class="compare-checkbox-wrap">
        <label>
          <input type="checkbox" class="compare-check" data-id="${tour.id}" ${isCompared ? 'checked' : ''} />
          So sánh
        </label>
      </div>
    </div>
    <div class="tour-card-body">
      <div class="tour-card-provider">${tour.provider}</div>
      <div class="tour-card-name">${tour.name}</div>
      <div class="tour-card-meta">
        <span class="star-rating">${stars(tour.rating)}</span>
        <strong>${tour.rating}</strong>
        <span class="rating-count">(${tour.reviews.toLocaleString()} lượt đánh giá)</span>
      </div>
      <div class="tour-card-meta">
        <span>📅</span> ${tour.duration} &nbsp;•&nbsp;
        <span>📍</span> ${tour.destination}
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

  // Detail button
  card.querySelector('.btn-detail').addEventListener('click', e => {
    e.stopPropagation();
    openModal(tour.id);
  });

  // Card click → detail
  card.addEventListener('click', () => openModal(tour.id));

  // Compare checkbox
  card.querySelector('.compare-check').addEventListener('change', function (e) {
    e.stopPropagation();
    handleCompareToggle(tour.id, this.checked);
  });

  return card;
}

function renderTourGrid(tours) {
  const grid = $('tourGrid');
  grid.innerHTML = '';
  if (!tours || tours.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div>
        <h3>Không tìm thấy tour phù hợp</h3>
        <p>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
      </div>`;
    return;
  }
  tours.forEach(t => grid.appendChild(buildTourCard(t)));
}

// ── Filter Tabs ───────────────────────────────────────
function applyFilter(filterVal) {
  state.activeFilter = filterVal;
  if (filterVal === 'all') {
    state.filtered = [...state.tours];
  } else {
    state.filtered = state.tours.filter(t => t.type === filterVal);
  }
  clearSearch();
  renderTourGrid(state.filtered);
}

// ── Search ────────────────────────────────────────────
function doSearch() {
  const dest = $('searchDestination').value.trim().toLowerCase();
  const type = $('searchType').value;

  let results = [...state.tours];

  if (dest) {
    results = results.filter(t =>
      t.destination.toLowerCase().includes(dest) ||
      t.name.toLowerCase().includes(dest) ||
      t.provider.toLowerCase().includes(dest)
    );
  }
  if (type) {
    results = results.filter(t => t.type === type);
  }

  state.filtered = results;
  renderTourGrid(results);

  // Show info bar
  const info = $('searchResultsInfo');
  if (dest || type) {
    const query = [dest, type].filter(Boolean).join(', ');
    info.style.display = 'flex';
    info.innerHTML = `
      <span>🔍 Tìm thấy <strong>${results.length}</strong> tour cho "<strong>${query}</strong>"</span>
      <button class="clear-search" id="btnClearSearch">✕ Xóa tìm kiếm</button>
    `;
    $('btnClearSearch').addEventListener('click', clearSearch);
    $('tourListTitle').textContent = 'KẾT QUẢ TÌM KIẾM';
    // Reset filter tabs
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.filter-tab[data-filter="all"]').classList.add('active');
    state.activeFilter = 'all';
  } else {
    clearSearch();
  }

  if (results.length === 0) {
    showToast('Không tìm thấy tour phù hợp', 'error');
  } else {
    showToast(`Tìm thấy ${results.length} tour!`, 'success');
  }
}

function clearSearch() {
  $('searchResultsInfo').style.display = 'none';
  $('searchDestination').value = '';
  $('searchType').value = '';
  $('searchDate').value = '';
  $('tourListTitle').textContent = 'TOUR NỔI BẬT';
  state.filtered = [...state.tours];
  renderTourGrid(state.filtered);
}

// ── Compare ───────────────────────────────────────────
function handleCompareToggle(tourId, checked) {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour) return;

  if (checked) {
    if (state.compareList.length >= 2) {
      showToast('Chỉ có thể so sánh tối đa 2 tour!', 'error');
      // Uncheck the checkbox
      const cb = document.querySelector(`.compare-check[data-id="${tourId}"]`);
      if (cb) cb.checked = false;
      return;
    }
    state.compareList.push(tour);
    showToast(`Đã thêm "${tour.name}" vào so sánh`, 'success');
  } else {
    state.compareList = state.compareList.filter(t => t.id !== tourId);
    showToast(`Đã xóa "${tour.name}" khỏi so sánh`);
  }

  updateCompareStrip();
}

function updateCompareStrip() {
  const slotA = $('compareSlotA');
  const slotB = $('compareSlotB');
  const btn = $('btnCompare');

  const renderSlot = (slot, tour) => {
    if (tour) {
      slot.classList.add('filled');
      slot.innerHTML = `
        <img class="compare-slot-img" src="${tour.image}" alt="${tour.name}" />
        <span class="compare-slot-name">${tour.name}</span>
        <button class="compare-slot-remove" data-id="${tour.id}" aria-label="Xóa">✕</button>
      `;
      slot.querySelector('.compare-slot-remove').addEventListener('click', e => {
        e.stopPropagation();
        const id = parseInt(e.currentTarget.dataset.id);
        state.compareList = state.compareList.filter(t => t.id !== id);
        // uncheck card
        const cb = document.querySelector(`.compare-check[data-id="${id}"]`);
        if (cb) cb.checked = false;
        updateCompareStrip();
      });
    } else {
      slot.classList.remove('filled');
      slot.innerHTML = `<span class="compare-slot-empty-text">${slot.id === 'compareSlotA' ? 'Chọn Tour A để so sánh' : 'Chọn Tour B để so sánh'}</span>`;
    }
  };

  renderSlot(slotA, state.compareList[0] || null);
  renderSlot(slotB, state.compareList[1] || null);

  btn.disabled = state.compareList.length < 2;
}

function showCompareTable() {
  if (state.compareList.length < 2) return;
  const [a, b] = state.compareList;

  const sec = $('compareTableSection');
  sec.style.display = 'block';
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const criteria = [
    { icon: '🖼️', label: 'Hình ảnh', key: 'image', render: v => `<img src="${v}" alt="tour" />` },
    { icon: '⏱️', label: 'Thời gian', key: 'duration' },
    { icon: '💰', label: 'Giá', key: 'price', render: v => `<strong>${fmt(v)}</strong>` },
    { icon: '⭐', label: 'Đánh giá', key: null, render: (_, t) => `<span class="star-rating">${stars(t.rating)}</span> ${t.rating}` },
    { icon: '🏨', label: 'Nơi ở', key: 'accommodation' },
    { icon: '🍽️', label: 'Bữa ăn', key: 'meals' },
    { icon: '🛡️', label: 'Bảo hiểm', key: 'insurance' },
    { icon: '🎯', label: 'Hoạt động chính', key: 'activities' },
    { icon: '⭐', label: 'Điểm nhấn', key: 'highlights', render: v => `<span class="chip green">✅ ${v}</span>` },
    { icon: '✅', label: 'Tình trạng đánh giá', key: 'verifiedFeedback', render: (v) => v ? `<span class="chip green">✅ Verified Feedback</span>` : '—' },
    { icon: '📋', label: 'Thao tác', key: null, render: (_, t) => `<button class="btn-book" onclick="openModal(${t.id})">ĐẶT TOUR</button>` },
  ];

  const rows = criteria.map(c => {
    const valA = c.key ? a[c.key] : null;
    const valB = c.key ? b[c.key] : null;
    const cellA = c.render ? c.render(valA, a) : (valA ?? '—');
    const cellB = c.render ? c.render(valB, b) : (valB ?? '—');
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
          <th>Tour A (${a.provider})</th>
          <th>Tour B (${b.provider})</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Modal ─────────────────────────────────────────────
function openModal(tourId) {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour) return;
  state.currentTour = tour;

  $('modalImg').src = tour.image;
  $('modalImg').alt = tour.name;
  $('modalTourTitle').textContent = tour.name;
  $('modalProvider').textContent = tour.provider;
  $('modalPrice').textContent = fmt(tour.price);

  $('modalInfoGrid').innerHTML = `
    <div class="info-item">📅 Thời gian: <span>${tour.duration}</span></div>
    <div class="info-item">📍 Điểm đến: <span>${tour.destination}</span></div>
    <div class="info-item">⭐ Đánh giá: <span>${tour.rating} (${tour.reviews.toLocaleString()} lượt)</span></div>
    <div class="info-item">🏷️ Loại: <span>${tour.type}</span></div>
    <div class="info-item">🏨 Nơi ở: <span>${tour.accommodation}</span></div>
    <div class="info-item">🍽️ Bữa ăn: <span>${tour.meals}</span></div>
  `;

  $('modalItinerary').innerHTML = tour.itinerary.map((day, i) => `
    <li>
      <span class="day-badge">Ngày ${i + 1}</span>
      <span>${day.replace(/^Ngày \d+: /, '')}</span>
    </li>
  `).join('');

  $('modalInclusions').innerHTML = tour.inclusions.map(i => `<span class="tag include">✅ ${i}</span>`).join('');
  $('modalExclusions').innerHTML = tour.exclusions.map(e => `<span class="tag exclude">❌ ${e}</span>`).join('');

  $('modalReviews').innerHTML = tour.reviews_data.map(r => `
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

  const overlay = $('tourModal');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('tourModal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── Reviews ───────────────────────────────────────────
function renderReviews() {
  const all = [];
  state.tours.forEach(tour => {
    tour.reviews_data.forEach(r => all.push({ ...r, tourName: tour.name }));
  });

  $('reviewsGrid').innerHTML = all.slice(0, 6).map(r => `
    <div class="review-card">
      <div class="review-header">
        <div class="review-avatar">${r.name[0]}</div>
        <div class="review-meta">
          <div class="review-name">${r.name} ${r.verified ? '<span class="verified-badge">✅ Xác thực</span>' : ''}</div>
          <div class="review-tour">${r.tourName}</div>
          <div class="review-stars">${'★'.repeat(r.rating)}</div>
        </div>
      </div>
      <div class="review-text">"${r.comment}"</div>
    </div>
  `).join('');
}

// ── Combos ────────────────────────────────────────────
const combosData = [
  { name: 'Sa Pa + Hà Giang 6N5Đ', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop', price: 7200000, save: 15, sub: 'VIET TRAVELLER · Leo núi' },
  { name: 'Đà Nẵng + Hội An + Huế 5N4Đ', image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=200&h=200&fit=crop', price: 8900000, save: 20, sub: 'ASIA DISCOVERY · Văn hóa' },
  { name: 'Phú Quốc + Côn Đảo 7N6Đ', image: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=200&h=200&fit=crop', price: 12500000, save: 25, sub: 'ASIA DISCOVERY · Nghỉ dưỡng' },
  { name: 'Nha Trang + Đà Lạt 5N4Đ', image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=200&h=200&fit=crop', price: 6800000, save: 18, sub: 'VIET TRAVELLER · Biển + Núi' },
];

function renderCombos() {
  $('comboGrid').innerHTML = combosData.map(c => `
    <div class="combo-card">
      <img src="${c.image}" alt="${c.name}" />
      <div class="combo-card-body">
        <div class="combo-card-title">${c.name}</div>
        <div class="combo-card-sub">${c.sub}</div>
        <div class="combo-card-price">${fmt(c.price)} <span class="combo-card-save">-${c.save}%</span></div>
        <button class="btn-detail" style="margin-top:.5rem;">Xem chi tiết</button>
      </div>
    </div>
  `).join('');
}

// ── Destinations ──────────────────────────────────────
const destData = [
  { name: 'Sa Pa', count: '24 tour', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop' },
  { name: 'Đà Nẵng', count: '31 tour', img: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=400&h=300&fit=crop' },
  { name: 'Phú Quốc', count: '18 tour', img: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=400&h=300&fit=crop' },
  { name: 'Hà Giang', count: '12 tour', img: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=300&fit=crop' },
  { name: 'Nha Trang', count: '22 tour', img: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&h=300&fit=crop' },
  { name: 'Hội An', count: '15 tour', img: 'https://images.unsplash.com/photo-1553858245-f5a86e9bbf23?w=400&h=300&fit=crop' },
  { name: 'Đà Lạt', count: '20 tour', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop' },
  { name: 'Hà Long', count: '27 tour', img: 'https://images.unsplash.com/photo-1540611025311-01df3cef54b5?w=400&h=300&fit=crop' },
];

function renderDestinations() {
  $('destinationsGrid').innerHTML = destData.map(d => `
    <div class="dest-card" onclick="searchByDest('${d.name}')">
      <img src="${d.img}" alt="${d.name}" loading="lazy" />
      <div class="dest-overlay">
        <div>
          <div class="dest-name">${d.name}</div>
          <div class="dest-count">${d.count}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function searchByDest(dest) {
  showSection('home');
  $('searchDestination').value = dest;
  setTimeout(doSearch, 100);
}

// ── Guidebook ─────────────────────────────────────────
function renderGuidebook() {
  const posts = [
    { icon: '🏔️', title: 'Kinh nghiệm leo Fansipan cho người mới', by: 'TourLink Team', date: '15/03/2025', read: '8 phút đọc', desc: 'Những lưu ý quan trọng khi chinh phục nóc nhà Đông Dương. Từ trang phục, thiết bị, đến sức khỏe và thời điểm lý tưởng.' },
    { icon: '🏖️', title: 'Top 10 bãi biển đẹp nhất Việt Nam 2025', by: 'Asia Discovery', date: '10/03/2025', read: '12 phút đọc', desc: 'Khám phá những bãi biển thiên đường còn ít người biết đến, từ Nam ra Bắc Việt Nam.' },
    { icon: '🍜', title: 'Ẩm thực Sa Pa – Không thể bỏ qua', by: 'Viet Traveller', date: '05/03/2025', read: '5 phút đọc', desc: 'Những món ăn đặc sản Sa Pa khiến bạn nhớ mãi: thắng cố, cơm lam, thịt trâu gác bếp...' },
    { icon: '💰', title: 'Bí kíp đặt tour giá rẻ nhất', by: 'TourLink Team', date: '01/03/2025', read: '6 phút đọc', desc: 'Thời điểm đặt tour, cách so sánh giá và những mẹo nhỏ giúp bạn tiết kiệm đến 40% chi phí.' },
  ];

  $('guidebookContent').innerHTML = `
    <div class="section-header">
      <h2 class="section-title">BÀI VIẾT NỔI BẬT</h2>
    </div>
    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem;">
      ${posts.map(p => `
        <div class="tour-card" style="cursor:default;">
          <div style="padding:1.5rem .5rem 0 1.25rem; font-size:2.5rem;">${p.icon}</div>
          <div class="tour-card-body">
            <div style="font-size:.72rem; color:var(--text-light); margin-bottom:.3rem;">${p.by} · ${p.date} · ${p.read}</div>
            <div class="tour-card-name" style="-webkit-line-clamp:3;">${p.title}</div>
            <p style="font-size:.8rem; color:var(--text-mid); margin-top:.4rem; line-height:1.5;">${p.desc}</p>
            <button class="btn-detail" style="margin-top:.75rem;">Đọc tiếp →</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Partner Page ──────────────────────────────────────
function renderPartnerPage() {
  $('partnerContent').innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem; margin-bottom:2rem;">
      <div class="tour-card" style="padding:2rem; cursor:default;">
        <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem; color:var(--primary);">🏢 Lợi ích khi hợp tác</h3>
        <ul style="list-style:none; display:flex; flex-direction:column; gap:.65rem; font-size:.88rem; color:var(--text-mid);">
          <li>✅ Tiếp cận 50,000+ khách hàng tiềm năng mỗi tháng</li>
          <li>✅ Hệ thống đặt tour tự động 24/7</li>
          <li>✅ Hỗ trợ marketing và quảng bá thương hiệu</li>
          <li>✅ Dashboard theo dõi doanh thu theo thời gian thực</li>
          <li>✅ Đội ngũ chăm sóc đối tác chuyên nghiệp</li>
          <li>✅ Hoa hồng cạnh tranh, thanh toán đúng hạn</li>
        </ul>
      </div>
      <div class="tour-card" style="padding:2rem; cursor:default;">
        <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem; color:var(--secondary);">📝 Đăng ký hợp tác</h3>
        <div style="display:flex; flex-direction:column; gap:.75rem;">
          <input style="padding:.7rem 1rem; border:1.5px solid var(--border); border-radius:var(--radius-sm); font-size:.88rem; font-family:inherit; outline:none;" placeholder="Tên công ty / Cá nhân" />
          <input style="padding:.7rem 1rem; border:1.5px solid var(--border); border-radius:var(--radius-sm); font-size:.88rem; font-family:inherit; outline:none;" placeholder="Email liên hệ" type="email" />
          <input style="padding:.7rem 1rem; border:1.5px solid var(--border); border-radius:var(--radius-sm); font-size:.88rem; font-family:inherit; outline:none;" placeholder="Số điện thoại" type="tel" />
          <select style="padding:.7rem 1rem; border:1.5px solid var(--border); border-radius:var(--radius-sm); font-size:.88rem; font-family:inherit; outline:none; background:white;">
            <option>Loại hình kinh doanh...</option>
            <option>Công ty lữ hành</option>
            <option>Hướng dẫn viên tự do</option>
            <option>Resort / Khách sạn</option>
            <option>Vận chuyển du lịch</option>
          </select>
          <button class="btn-compare" onclick="showToast('Đã gửi đăng ký! Chúng tôi sẽ liên hệ trong 24h 🎉', 'success')">Gửi đăng ký →</button>
        </div>
      </div>
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="stat-value">500+</div><div class="stat-label">Đối tác lữ hành</div></div>
      <div class="stat-card"><div class="stat-value">30%</div><div class="stat-label">Tăng trưởng doanh thu</div></div>
      <div class="stat-card"><div class="stat-value">24/7</div><div class="stat-label">Hỗ trợ kỹ thuật</div></div>
      <div class="stat-card"><div class="stat-value">₫2B+</div><div class="stat-label">Doanh thu mỗi tháng</div></div>
    </div>
  `;
}

// ── Event Binding ─────────────────────────────────────
function bindEvents() {
  // Nav links
  document.querySelectorAll('#navLinks a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      showSection(a.dataset.section);
    });
  });

  // Logo
  $('logoHome').addEventListener('click', e => {
    e.preventDefault();
    showSection('home');
  });

  // Search button
  $('btnSearch').addEventListener('click', doSearch);
  $('searchDestination').addEventListener('keydown', e => e.key === 'Enter' && doSearch());
  $('searchType').addEventListener('change', doSearch);

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });

  // Compare button
  $('btnCompare').addEventListener('click', showCompareTable);
  $('btnCloseCompare').addEventListener('click', () => {
    $('compareTableSection').style.display = 'none';
  });

  // Modal close
  $('modalClose').addEventListener('click', closeModal);
  $('tourModal').addEventListener('click', e => {
    if (e.target === $('tourModal')) closeModal();
  });
  $('modalBookBtn').addEventListener('click', () => {
    showToast(`Đặt tour "${state.currentTour?.name}" thành công! 🎉`, 'success');
    closeModal();
  });

  // Chat widget
  $('chatBtn').addEventListener('click', () => {
    showToast('Hỗ trợ trực tuyến đang được kết nối... 💬');
  });

  // Login
  $('btnLogin').addEventListener('click', () => {
    showToast('Tính năng đăng nhập sẽ sớm ra mắt!');
  });

  // Keyboard ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

// ── Fallback data (if fetch fails e.g. no server) ────
function getFallbackTours() {
  return [
    {
      id: 1, name: 'Sa Pa 3 Ngày 2 Đêm - Thung Lũng Mây', provider: 'VIET TRAVELLER',
      destination: 'Sa Pa', duration: '3 Ngày 2 Đêm', price: 4500000, rating: 4.5, reviews: 1200,
      type: 'Leo núi', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=250&fit=crop',
      accommodation: '3 Sao Khách Sạn', meals: '5 Bữa (150k/bữa)', insurance: '20 Tr đ/người',
      activities: 'Leo núi, Chợ địa phương, Homestay', highlights: 'Trải nghiệm địa phương',
      verifiedFeedback: true, description: 'Khám phá Sa Pa hùng vĩ.',
      itinerary: ['Ngày 1: Hà Nội – Sa Pa', 'Ngày 2: Fansipan & ruộng bậc thang', 'Ngày 3: Bản Cát Cát, về HN'],
      inclusions: ['Xe đưa đón', 'Khách sạn 3 sao', '5 bữa ăn', 'Bảo hiểm', 'HDV'],
      exclusions: ['Vé máy bay', 'Chi phí cá nhân'],
      reviews_data: [{ name: 'An Nguyên', rating: 5, comment: 'Văn hóa tuyệt vời!', verified: true }]
    },
    {
      id: 2, name: 'Sa Pa 3N2Đ - View Sang Trọng', provider: 'ASIA DISCOVERY',
      destination: 'Sa Pa', duration: '3 Ngày 2 Đêm', price: 4800000, rating: 4.8, reviews: 350,
      type: 'Nghỉ dưỡng', image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&h=250&fit=crop',
      accommodation: '4 Sao Resort', meals: '6 Bữa (200k/bữa)', insurance: '50 Tr đ/người',
      activities: 'Cáp treo Fansipan, Sun World, Bể bơi', highlights: 'Tiện nghi hiện đại',
      verifiedFeedback: true, description: 'Sa Pa theo phong cách sang trọng.',
      itinerary: ['Ngày 1: Hà Nội – Resort 4 sao', 'Ngày 2: Sun World', 'Ngày 3: Spa & về HN'],
      inclusions: ['Xe limousine', 'Resort 4 sao', '6 bữa ăn', 'Bảo hiểm cao cấp', 'HDV riêng'],
      exclusions: ['Vé máy bay', 'Chi phí cá nhân'],
      reviews_data: [{ name: 'Minh Châu', rating: 5, comment: 'Resort đẹp xuất sắc!', verified: true }]
    },
    {
      id: 3, name: 'Đà Nẵng - Hội An 4N3Đ', provider: 'VIET TRAVELLER',
      destination: 'Đà Nẵng', duration: '4 Ngày 3 Đêm', price: 5900000, rating: 4.7, reviews: 890,
      type: 'Biển', image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=400&h=250&fit=crop',
      accommodation: '4 Sao Khách Sạn Biển', meals: '6 Bữa', insurance: '30 Tr đ/người',
      activities: 'Bà Nà Hills, Hội An, Ngũ Hành Sơn', highlights: 'Biển xanh cát trắng',
      verifiedFeedback: true, description: 'Khám phá Đà Nẵng xinh đẹp.',
      itinerary: ['Ngày 1: Bay ĐN, tắm biển', 'Ngày 2: Bà Nà Hills', 'Ngày 3: Hội An', 'Ngày 4: Mua sắm, về HN'],
      inclusions: ['Vé máy bay', 'Khách sạn 4 sao', '6 bữa ăn', 'Bảo hiểm', 'Xe đưa đón'],
      exclusions: ['Chi phí cá nhân'],
      reviews_data: [{ name: 'Thu Hà', rating: 5, comment: 'Hội An đêm đẹp lắm!', verified: true }]
    },
    {
      id: 4, name: 'Phú Quốc 5N4Đ Premium', provider: 'ASIA DISCOVERY',
      destination: 'Phú Quốc', duration: '5 Ngày 4 Đêm', price: 8500000, rating: 4.9, reviews: 520,
      type: 'Nghỉ dưỡng', image: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=400&h=250&fit=crop',
      accommodation: '5 Sao Resort Biển', meals: '8 Bữa Fine Dining', insurance: '100 Tr đ/người',
      activities: 'Lặn biển, Câu cá, Spa', highlights: 'Đảo ngọc thiên đường',
      verifiedFeedback: true, description: 'Tận hưởng xa hoa ở đảo ngọc Phú Quốc.',
      itinerary: ['Ngày 1: Check-in resort 5 sao', 'Ngày 2: Lặn biển', 'Ngày 3: Spa', 'Ngày 4: Câu cá', 'Ngày 5: Về HN'],
      inclusions: ['Vé bay hạng thương gia', 'Resort 5 sao', '8 bữa Fine Dining', 'Bảo hiểm cao cấp'],
      exclusions: ['Chi phí cá nhân'],
      reviews_data: [{ name: 'Linh Chi', rating: 5, comment: 'Resort đẳng cấp quốc tế!', verified: true }]
    },
    {
      id: 5, name: 'Hà Giang Loop 3N2Đ', provider: 'ADVENTURE TOURS',
      destination: 'Hà Giang', duration: '3 Ngày 2 Đêm', price: 3200000, rating: 4.6, reviews: 670,
      type: 'Leo núi', image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=250&fit=crop',
      accommodation: 'Homestay Dân tộc', meals: '5 Bữa', insurance: '15 Tr đ/người',
      activities: 'Đèo Mã Pí Lèng, Đồng Văn, Lũng Cú', highlights: 'Cao nguyên đá kỳ vĩ',
      verifiedFeedback: true, description: 'Chinh phục cao nguyên đá Đồng Văn.',
      itinerary: ['Ngày 1: HN – Hà Giang', 'Ngày 2: Đèo Mã Pí Lèng, Mèo Vạc', 'Ngày 3: Lũng Cú, về HN'],
      inclusions: ['Xe/xe máy', 'Homestay', '5 bữa', 'Bảo hiểm', 'HDV địa phương'],
      exclusions: ['Vé tham quan', 'Chi phí cá nhân'],
      reviews_data: [{ name: 'Quang Huy', rating: 5, comment: 'Cảnh đẹp không thể tả!', verified: true }]
    },
    {
      id: 6, name: 'Nha Trang 3N2Đ - Đảo Nhỏ', provider: 'VIET TRAVELLER',
      destination: 'Nha Trang', duration: '3 Ngày 2 Đêm', price: 4100000, rating: 4.4, reviews: 1100,
      type: 'Biển', image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&h=250&fit=crop',
      accommodation: '3 Sao Khách Sạn Trung Tâm', meals: '5 Bữa Hải Sản', insurance: '20 Tr đ/người',
      activities: 'Tour 4 Đảo, Vinpearl Land, Tắm Bùn', highlights: 'Biển xanh 4 đảo',
      verifiedFeedback: true, description: 'Khám phá vùng biển Nha Trang.',
      itinerary: ['Ngày 1: Bay NTrang, dạo biển', 'Ngày 2: Tour 4 đảo, tắm bùn', 'Ngày 3: Vinpearl, về HN'],
      inclusions: ['Vé máy bay', 'Khách sạn 3 sao', '5 bữa hải sản', 'Bảo hiểm', 'Vé 4 đảo'],
      exclusions: ['Vé Vinpearl', 'Chi phí cá nhân'],
      reviews_data: [{ name: 'Khánh Ly', rating: 5, comment: 'Tour 4 đảo rất vui!', verified: true }]
    },
  ];
}

// ── Bootstrap ─────────────────────────────────────────
loadData();
