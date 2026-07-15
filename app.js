(function () {
  const data = Array.isArray(window.UNIVERSITIES) ? window.UNIVERSITIES : [];
  const STORAGE_KEY = 'myUniversityList_v1';

  const els = {
    search: document.getElementById('search'),
    continent: document.getElementById('continent'),
    country: document.getElementById('country'),
    level: document.getElementById('level'),
    toefl: document.getElementById('toefl'),
    noMajorRestriction: document.getElementById('noMajorRestriction'),
    resetBtn: document.getElementById('resetFilters'),
    resultCount: document.getElementById('resultCount'),
    cardGrid: document.getElementById('cardGrid'),
    emptyState: document.getElementById('emptyState'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalBody: document.getElementById('modalBody'),
    modalClose: document.getElementById('modalClose'),
    openMyList: document.getElementById('openMyList'),
    myListCount: document.getElementById('myListCount'),
    myListOverlay: document.getElementById('myListOverlay'),
    myListClose: document.getElementById('myListClose'),
    myListItems: document.getElementById('myListItems'),
    myListEmpty: document.getElementById('myListEmpty'),
    myListCopy: document.getElementById('myListCopy'),
    myListClear: document.getElementById('myListClear'),
  };

  // --- favorites (persisted by university name, order = priority) ---
  function loadFavorites() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const validNames = new Set(data.map((u) => u.name));
      return raw.filter((name) => validNames.has(name));
    } catch {
      return [];
    }
  }

  function saveFavorites() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }

  let favorites = loadFavorites();

  function isFavorite(name) {
    return favorites.includes(name);
  }

  function toggleFavorite(name) {
    if (isFavorite(name)) {
      favorites = favorites.filter((n) => n !== name);
    } else {
      favorites.push(name);
    }
    saveFavorites();
    render();
    renderMyList();
  }

  function moveFavorite(name, direction) {
    const idx = favorites.indexOf(name);
    const swapWith = idx + direction;
    if (idx === -1 || swapWith < 0 || swapWith >= favorites.length) return;
    [favorites[idx], favorites[swapWith]] = [favorites[swapWith], favorites[idx]];
    saveFavorites();
    renderMyList();
  }

  function reorderFavorites(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const [moved] = favorites.splice(fromIndex, 1);
    favorites.splice(toIndex, 0, moved);
    saveFavorites();
    renderMyList();
  }

  function removeFavorite(name) {
    favorites = favorites.filter((n) => n !== name);
    saveFavorites();
    render();
    renderMyList();
  }

  function uniqueSorted(key) {
    return Array.from(new Set(data.map((u) => u[key]).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  function populateSelect(select, values) {
    values.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
  }

  populateSelect(els.continent, uniqueSorted('continent'));
  populateSelect(els.country, uniqueSorted('country'));
  populateSelect(els.level, uniqueSorted('level'));
  populateSelect(els.toefl, uniqueSorted('toefl_myBestScore_accepted'));

  function toeflTagClass(value) {
    if (value === '인정') return 'ok';
    if (value === '불인정' || value === '불가') return 'bad';
    return 'warn';
  }

  function firstLine(text) {
    if (!text) return '';
    return String(text).split('\n')[0];
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function linkify(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/(https?:\/\/[^\s]+)/g, (url) => {
      const clean = url.replace(/[)\],.]+$/, '');
      const trailing = url.slice(clean.length);
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${trailing}`;
    });
  }

  function matchesFilters(u) {
    const q = els.search.value.trim().toLowerCase();
    if (q) {
      const haystack = `${u.name} ${u.city}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (els.continent.value && u.continent !== els.continent.value) return false;
    if (els.country.value && u.country !== els.country.value) return false;
    if (els.level.value && u.level !== els.level.value) return false;
    if (els.toefl.value && u.toefl_myBestScore_accepted !== els.toefl.value) return false;
    if (els.noMajorRestriction.checked && u.major_restriction) return false;
    return true;
  }

  function cardTemplate(u, idx) {
    const fav = isFavorite(u.name);
    return `
      <article class="card" data-idx="${idx}" tabindex="0" role="button" aria-haspopup="dialog">
        <button
          class="fav-btn ${fav ? 'active' : ''}"
          data-idx="${idx}"
          aria-pressed="${fav}"
          aria-label="${fav ? '내 리스트에서 제거' : '내 리스트에 추가'}"
          title="${fav ? '내 리스트에서 제거' : '내 리스트에 추가'}"
        >${fav ? '★' : '☆'}</button>
        <div class="card-title">${escapeHtml(u.name)}</div>
        <div class="card-location">${escapeHtml(firstLine(u.city))}, ${escapeHtml(u.country)} · ${escapeHtml(u.continent)}</div>
        <div class="card-tags">
          <span class="tag">${escapeHtml(u.level)}</span>
          <span class="tag ${toeflTagClass(u.toefl_myBestScore_accepted)}">MyBestScore ${escapeHtml(u.toefl_myBestScore_accepted)}</span>
          ${u.major_restriction ? '' : '<span class="tag ok">전공제한 없음</span>'}
        </div>
        <dl class="card-meta">
          <dt>GPA</dt><dd>${escapeHtml(firstLine(u.gpa_requirement))}</dd>
          <dt>어학</dt><dd>${escapeHtml(firstLine(u.language_requirement))}</dd>
          <dt>정원</dt><dd>${escapeHtml(u.students_per_semester)}명/학기</dd>
        </dl>
      </article>
    `;
  }

  function modalTemplate(u) {
    return `
      <h2>${escapeHtml(u.name)}</h2>
      <div class="card-location">${escapeHtml((u.city || '').replace(/\n/g, ' · '))}, ${escapeHtml(u.country)} · ${escapeHtml(u.continent)}</div>
      <div class="card-tags">
        <span class="tag">${escapeHtml(u.level)}</span>
        <span class="tag ${toeflTagClass(u.toefl_myBestScore_accepted)}">MyBestScore ${escapeHtml(u.toefl_myBestScore_accepted)}</span>
        ${u.major_restriction ? `<span class="tag warn">전공제한: ${escapeHtml(u.major_restriction).replace(/\n/g, ' ')}</span>` : '<span class="tag ok">전공제한 없음</span>'}
        ${u.semester_restriction ? `<span class="tag warn">학기제한: ${escapeHtml(u.semester_restriction).replace(/\n/g, ' ')}</span>` : ''}
      </div>

      <div class="modal-section">
        <h3>GPA 요건</h3>
        <p>${escapeHtml(u.gpa_requirement)}</p>
      </div>
      <div class="modal-section">
        <h3>어학 요건</h3>
        <p>${escapeHtml(u.language_requirement)}</p>
      </div>
      <div class="modal-section">
        <h3>파견 정원 / 학사일정</h3>
        <p>${escapeHtml(u.students_per_semester)}명/학기 · ${escapeHtml(u.academic_calendar)}</p>
      </div>
      <div class="modal-section">
        <h3>웹사이트</h3>
        <p>${linkify(u.website)}</p>
      </div>
      <div class="modal-section">
        <h3>비고</h3>
        <div class="modal-notes">${linkify(u.notes)}</div>
      </div>
    `;
  }

  function render() {
    const filtered = [];
    data.forEach((u, idx) => {
      if (matchesFilters(u)) filtered.push({ u, idx });
    });
    els.cardGrid.innerHTML = filtered.map(({ u, idx }) => cardTemplate(u, idx)).join('');
    els.emptyState.hidden = filtered.length !== 0;
    els.resultCount.textContent = `${filtered.length} / ${data.length}개 대학 표시 중`;
    els.myListCount.textContent = favorites.length;
  }

  function openModal(idx) {
    const u = data[Number(idx)];
    if (!u) return;
    els.modalBody.innerHTML = modalTemplate(u);
    els.modalOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    els.modalOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  els.cardGrid.addEventListener('click', (e) => {
    const favBtn = e.target.closest('.fav-btn');
    if (favBtn) {
      const u = data[Number(favBtn.dataset.idx)];
      if (u) toggleFavorite(u.name);
      return;
    }
    const card = e.target.closest('.card');
    if (card) openModal(card.dataset.idx);
  });

  els.cardGrid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('.fav-btn')) return;
    const card = e.target.closest('.card');
    if (card) {
      e.preventDefault();
      openModal(card.dataset.idx);
    }
  });

  els.modalClose.addEventListener('click', closeModal);
  els.modalOverlay.addEventListener('click', (e) => {
    if (e.target === els.modalOverlay) closeModal();
  });

  // --- My List panel ---
  function myListItemTemplate(u, name, index, total) {
    return `
      <li class="mylist-item" draggable="true" data-name="${escapeHtml(name)}" data-index="${index}">
        <span class="mylist-drag-handle" aria-hidden="true">⠿</span>
        <span class="mylist-rank">${index + 1}</span>
        <div class="mylist-info">
          <div class="mylist-name">${escapeHtml(u.name)}</div>
          <div class="mylist-meta">${escapeHtml(u.country)} · ${escapeHtml(u.continent)}</div>
        </div>
        <div class="mylist-controls">
          <button class="mylist-up" ${index === 0 ? 'disabled' : ''} aria-label="위로 이동" title="위로 이동">▲</button>
          <button class="mylist-down" ${index === total - 1 ? 'disabled' : ''} aria-label="아래로 이동" title="아래로 이동">▼</button>
          <button class="mylist-remove" aria-label="삭제" title="삭제">✕</button>
        </div>
      </li>
    `;
  }

  function renderMyList() {
    const items = favorites
      .map((name) => data.find((u) => u.name === name))
      .filter(Boolean);
    els.myListItems.innerHTML = items
      .map((u, i) => myListItemTemplate(u, u.name, i, items.length))
      .join('');
    els.myListEmpty.hidden = items.length !== 0;
    els.myListItems.hidden = items.length === 0;
    els.myListCount.textContent = favorites.length;
  }

  function openMyListPanel() {
    renderMyList();
    els.myListOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeMyListPanel() {
    els.myListOverlay.hidden = true;
    document.body.style.overflow = '';
  }

  els.openMyList.addEventListener('click', openMyListPanel);
  els.myListClose.addEventListener('click', closeMyListPanel);
  els.myListOverlay.addEventListener('click', (e) => {
    if (e.target === els.myListOverlay) closeMyListPanel();
  });

  els.myListItems.addEventListener('click', (e) => {
    const li = e.target.closest('.mylist-item');
    if (!li) return;
    const name = li.dataset.name;
    if (e.target.closest('.mylist-up')) moveFavorite(name, -1);
    else if (e.target.closest('.mylist-down')) moveFavorite(name, 1);
    else if (e.target.closest('.mylist-remove')) removeFavorite(name);
  });

  let dragFromIndex = null;

  els.myListItems.addEventListener('dragstart', (e) => {
    const li = e.target.closest('.mylist-item');
    if (!li) return;
    dragFromIndex = Number(li.dataset.index);
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  els.myListItems.addEventListener('dragend', (e) => {
    const li = e.target.closest('.mylist-item');
    if (li) li.classList.remove('dragging');
    els.myListItems.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    dragFromIndex = null;
  });

  els.myListItems.addEventListener('dragover', (e) => {
    e.preventDefault();
    const li = e.target.closest('.mylist-item');
    if (!li) return;
    els.myListItems.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    li.classList.add('drag-over');
  });

  els.myListItems.addEventListener('drop', (e) => {
    e.preventDefault();
    const li = e.target.closest('.mylist-item');
    if (!li || dragFromIndex === null) return;
    const toIndex = Number(li.dataset.index);
    reorderFavorites(dragFromIndex, toIndex);
  });

  els.myListCopy.addEventListener('click', async () => {
    const items = favorites
      .map((name) => data.find((u) => u.name === name))
      .filter(Boolean);
    const text = items
      .map((u, i) => `${i + 1}. ${u.name} (${u.country})`)
      .join('\n');
    const originalLabel = els.myListCopy.textContent;
    try {
      await navigator.clipboard.writeText(text);
      els.myListCopy.textContent = '복사됨!';
    } catch {
      els.myListCopy.textContent = '복사 실패';
    }
    setTimeout(() => {
      els.myListCopy.textContent = originalLabel;
    }, 1500);
  });

  els.myListClear.addEventListener('click', () => {
    if (favorites.length === 0) return;
    if (!window.confirm('내 리스트의 모든 대학을 삭제할까요?')) return;
    favorites = [];
    saveFavorites();
    render();
    renderMyList();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.myListOverlay.hidden) closeMyListPanel();
    else if (!els.modalOverlay.hidden) closeModal();
  });

  [els.search, els.continent, els.country, els.level, els.toefl, els.noMajorRestriction].forEach((el) => {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  els.resetBtn.addEventListener('click', () => {
    els.search.value = '';
    els.continent.value = '';
    els.country.value = '';
    els.level.value = '';
    els.toefl.value = '';
    els.noMajorRestriction.checked = false;
    render();
  });

  render();

  window.openUniversityDetail = openModal;
})();
