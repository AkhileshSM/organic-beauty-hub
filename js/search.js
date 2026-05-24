/* ============================================================
   Organic Beauty Hub — Ingredient Search Engine
   Uses Fuse.js for fuzzy search loaded from jsdelivr
   ============================================================ */

(function () {
  'use strict';

  /* ── State ──────────────────────────────────────────────── */
  let allIngredients  = [];
  let fuse            = null;
  let activeFilters   = { category: 'all', solubility: 'all', evidence: 'all' };
  let currentQuery    = '';
  let selectedId      = null;

  /* ── DOM refs ───────────────────────────────────────────── */
  const searchInput   = document.getElementById('search-input');
  const resultsGrid   = document.getElementById('results-grid');
  const resultCount   = document.getElementById('result-count');
  const modal         = document.getElementById('ingredient-modal');
  const modalBody     = document.getElementById('modal-body');
  const modalClose    = document.getElementById('modal-close');
  const filterBtns    = document.querySelectorAll('[data-filter]');

  /* ── Load data ──────────────────────────────────────────── */
  fetch('data/ingredients.json')
    .then(r => {
      if (!r.ok) throw new Error('Failed to load ingredients data');
      return r.json();
    })
    .then(data => {
      allIngredients = data;
      initFuse();
      renderGrid(allIngredients);
      checkHashRoute();
    })
    .catch(err => {
      resultsGrid.innerHTML = `<p class="error-state">Unable to load ingredient data. ${err.message}</p>`;
    });

  /* ── Init Fuse ──────────────────────────────────────────── */
  function initFuse() {
    fuse = new Fuse(allIngredients, {
      includeScore:     true,
      threshold:        0.35,
      ignoreLocation:   true,
      minMatchCharLen:  2,
      keys: [
        { name: 'commonName',   weight: 0.35 },
        { name: 'inci',         weight: 0.25 },
        { name: 'functions',    weight: 0.15 },
        { name: 'concerns',     weight: 0.15 },
        { name: 'description',  weight: 0.05 },
        { name: 'cas',          weight: 0.05 }
      ]
    });
  }

  /* ── Search handler ─────────────────────────────────────── */
  function handleSearch() {
    currentQuery = searchInput.value.trim();
    applyFiltersAndSearch();
  }

  /* ── Filter + Search ────────────────────────────────────── */
  function applyFiltersAndSearch() {
    let results = allIngredients;

    /* 1. Text search via Fuse */
    if (currentQuery.length >= 2) {
      results = fuse.search(currentQuery).map(r => r.item);
    }

    /* 2. Category filter */
    if (activeFilters.category !== 'all') {
      results = results.filter(i => i.category === activeFilters.category);
    }

    /* 3. Solubility filter */
    if (activeFilters.solubility !== 'all') {
      results = results.filter(i =>
        i.solubility === activeFilters.solubility || i.solubility === 'both'
      );
    }

    /* 4. Evidence filter */
    if (activeFilters.evidence !== 'all') {
      results = results.filter(i => i.evidence === activeFilters.evidence);
    }

    renderGrid(results);
  }

  /* ── Render grid ────────────────────────────────────────── */
  function renderGrid(ingredients) {
    const count = ingredients.length;
    resultCount.textContent = `${count} ingredient${count !== 1 ? 's' : ''}`;

    if (count === 0) {
      resultsGrid.innerHTML = `
        <div class="empty-state">
          <p class="empty-state__icon">🌿</p>
          <p class="empty-state__text">No ingredients match your search.</p>
          <button class="btn btn--outline" onclick="clearSearch()">Clear filters</button>
        </div>`;
      return;
    }

    resultsGrid.innerHTML = ingredients.map(i => buildCard(i)).join('');

    /* Attach open-modal listeners */
    resultsGrid.querySelectorAll('.ingredient-card').forEach(card => {
      card.addEventListener('click', () => openModal(card.dataset.id));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal(card.dataset.id);
        }
      });
    });
  }

  /* ── Build ingredient card ──────────────────────────────── */
  function buildCard(i) {
    const categoryLabel = formatCategory(i.category);
    const tagClass      = categoryTagClass(i.category);
    const evidenceLabel = formatEvidence(i.evidence);
    const functions     = (i.functions || []).slice(0, 3).map(f =>
      `<span class="tag tag--stone">${formatFunction(f)}</span>`
    ).join('');

    return `
      <article
        class="card card--ingredient ingredient-card"
        data-id="${esc(i.id)}"
        tabindex="0"
        role="button"
        aria-label="View details for ${esc(i.commonName)}"
      >
        <div class="card__header">
          <span class="tag ${tagClass}">${categoryLabel}</span>
          <span class="card__evidence evidence--${esc(i.evidence)}">${evidenceLabel}</span>
        </div>
        <h3 class="card__title" style="margin-top: var(--space-3);">${esc(i.commonName)}</h3>
        <p class="card__inci">${esc(i.inci)}</p>
        <div class="card__meta">
          <span class="card__meta-item">
            <span class="card__meta-label">pH</span>
            ${i.phRange.min}–${i.phRange.max}
          </span>
          <span class="card__meta-item">
            <span class="card__meta-label">Typical</span>
            ${i.concentration.typical}${i.concentration.unit}
          </span>
          <span class="card__meta-item">
            <span class="card__meta-label">Solubility</span>
            ${i.solubility}
          </span>
        </div>
        <p class="card__body">${esc(i.description).substring(0, 140)}…</p>
        <div class="card__tags">${functions}</div>
        <p class="card__cta">View full profile →</p>
      </article>`;
  }

  /* ── Modal ──────────────────────────────────────────────── */
  function openModal(id) {
    const i = allIngredients.find(x => x.id === id);
    if (!i) return;
    selectedId = id;
    if (window.location.hash !== '#' + id) {
      window.location.hash = id;
    }

    const compatible  = (i.interactions.compatible || []).join(', ') || '—';
    const caution     = (i.interactions.caution || []).join(', ')    || 'None noted';
    const euRegs      = i.regulatory.eu;
    const usRegs      = i.regulatory.us;
    const jpRegs      = i.regulatory.jp;

    const skinTypes   = (i.skinTypes  || []).map(s => `<span class="tag tag--sage">${s}</span>`).join('');
    const concerns    = (i.concerns   || []).map(c => `<span class="tag tag--terracotta">${formatFunction(c)}</span>`).join('');
    const functions   = (i.functions  || []).map(f => `<span class="tag tag--stone">${formatFunction(f)}</span>`).join('');

    modalBody.innerHTML = `
      <div class="modal__header">
        <div>
          <span class="tag ${categoryTagClass(i.category)} modal__category">${formatCategory(i.category)}</span>
          <h2 class="modal__title">${esc(i.commonName)}</h2>
          <p class="modal__inci">${esc(i.inci)}</p>
          <p class="modal__cas">CAS: ${esc(i.cas)}</p>
        </div>
      </div>

      <div class="modal__grid">
        <div class="modal__section">
          <h3 class="modal__section-title">Quick facts</h3>
          <dl class="fact-list">
            <div class="fact-list__item">
              <dt>pH range</dt>
              <dd>${i.phRange.min}–${i.phRange.max} <span class="fact-optimal">(optimal ${i.phRange.optimal})</span></dd>
            </div>
            <div class="fact-list__item">
              <dt>Concentration</dt>
              <dd>${i.concentration.min}–${i.concentration.max}${i.concentration.unit} <span class="fact-optimal">(typical ${i.concentration.typical}${i.concentration.unit})</span></dd>
            </div>
            <div class="fact-list__item">
              <dt>Solubility</dt>
              <dd>${i.solubility}</dd>
            </div>
            <div class="fact-list__item">
              <dt>Evidence level</dt>
              <dd><span class="evidence--${esc(i.evidence)}">${formatEvidence(i.evidence)}</span></dd>
            </div>
          </dl>
        </div>

        <div class="modal__section">
          <h3 class="modal__section-title">Functions</h3>
          <div class="tag-group">${functions}</div>

          <h3 class="modal__section-title" style="margin-top: var(--space-6);">Targets</h3>
          <div class="tag-group">${concerns}</div>

          <h3 class="modal__section-title" style="margin-top: var(--space-6);">Skin types</h3>
          <div class="tag-group">${skinTypes}</div>
        </div>
      </div>

      <div class="modal__section">
        <h3 class="modal__section-title">Science overview</h3>
        <p class="modal__desc">${esc(i.description)}</p>
      </div>

      <div class="modal__section">
        <h3 class="modal__section-title">Stability</h3>
        <p class="modal__desc">${esc(i.stability)}</p>
      </div>

      <div class="modal__section">
        <h3 class="modal__section-title">Interactions</h3>
        <div class="interactions">
          <div class="interaction interaction--good">
            <span class="interaction__label">✓ Compatible with</span>
            <p>${esc(compatible)}</p>
          </div>
          <div class="interaction interaction--caution">
            <span class="interaction__label">⚠ Use with caution</span>
            <p>${esc(caution)}</p>
          </div>
        </div>
        ${i.interactions.note ? `<p class="interaction__note">${esc(i.interactions.note)}</p>` : ''}
      </div>

      <div class="modal__section">
        <h3 class="modal__section-title">Regulatory status</h3>
        <div class="reg-grid">
          <div class="reg-item">
            <span class="reg-item__region">🇪🇺 EU</span>
            <p>${esc(euRegs)}</p>
          </div>
          <div class="reg-item">
            <span class="reg-item__region">🇺🇸 US</span>
            <p>${esc(usRegs)}</p>
          </div>
          <div class="reg-item">
            <span class="reg-item__region">🇯🇵 JP</span>
            <p>${esc(jpRegs)}</p>
          </div>
        </div>
      </div>

      ${i.keyStudy ? `
      <div class="modal__section modal__key-study">
        <h3 class="modal__section-title">Key study</h3>
        <p class="modal__desc">${esc(i.keyStudy)}</p>
      </div>` : ''}
    `;

    modal.removeAttribute('hidden');
    modal.setAttribute('aria-modal', 'true');
    document.body.style.overflow = 'hidden';
    modalClose.focus();
  }

  function closeModal() {
    modal.setAttribute('hidden', '');
    modal.removeAttribute('aria-modal');
    document.body.style.overflow = '';
    selectedId = null;
    if (window.location.hash) {
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  }

  /* ── Event listeners ─────────────────────────────────────── */
  searchInput.addEventListener('input', debounce(handleSearch, 220));

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') searchInput.value = '';
  });

  modalClose.addEventListener('click', closeModal);
  window.addEventListener('hashchange', checkHashRoute);

  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal();
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.filter;
      const value = btn.dataset.value;

      /* Update active state visually */
      document.querySelectorAll(`[data-filter="${group}"]`).forEach(b => {
        b.classList.toggle('filter-btn--active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });

      activeFilters[group] = value;
      applyFiltersAndSearch();
    });
  });

  /* ── Global clear (used by empty state button) ───────────── */
  window.clearSearch = function () {
    searchInput.value = '';
    currentQuery = '';
    activeFilters = { category: 'all', solubility: 'all', evidence: 'all' };
    document.querySelectorAll('[data-filter]').forEach(btn => {
      const isAll = btn.dataset.value === 'all';
      btn.classList.toggle('filter-btn--active', isAll);
      btn.setAttribute('aria-pressed', isAll ? 'true' : 'false');
    });
    renderGrid(allIngredients);
  };

  /* ── Helpers ─────────────────────────────────────────────── */
  function esc(str) {
    if (typeof str !== 'string') return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  function formatCategory(cat) {
    const map = {
      active:      'Active',
      humectant:   'Humectant',
      emollient:   'Emollient',
      antioxidant: 'Antioxidant',
      preservative:'Preservative',
      SPF:         'UV Filter',
    };
    return map[cat] || cat;
  }

  function categoryTagClass(cat) {
    const map = {
      active:       'tag--terracotta',
      humectant:    'tag--sage',
      emollient:    'tag--stone',
      antioxidant:  'tag--olive',
      preservative: 'tag--stone',
      SPF:          'tag--sage',
    };
    return map[cat] || 'tag--stone';
  }

  function formatEvidence(ev) {
    const map = {
      clinical:  '✦ Clinical',
      in_vivo:   '◆ In vivo',
      in_vitro:  '◇ In vitro',
    };
    return map[ev] || ev;
  }

  function formatFunction(fn) {
    return fn.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function checkHashRoute() {
    const hash = window.location.hash.substring(1);
    if (hash && hash !== selectedId) {
      const i = allIngredients.find(x => x.id === hash);
      if (i) {
        openModal(i.id);
        setTimeout(() => {
          const cardEl = document.querySelector(`[data-id="${i.id}"]`);
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardEl.focus();
          }
        }, 100);
      }
    }
  }

})();