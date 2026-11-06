const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const english = document.documentElement.lang === 'en';
const t = message => english ? (window.MINUTREL_TRANSLATIONS?.[message] || message) : message;

// Load an external player only after an explicit play action.
document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-video-id]');
  if (!trigger) return;
  const id = trigger.dataset.videoId;
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
  if (location.protocol === 'file:') {
    window.open(trigger.dataset.videoUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  iframe.title = trigger.dataset.videoTitle;
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  trigger.replaceWith(iframe);
  iframe.focus();
});

function updateLanguageLinks() {
  let fragment = window.location.hash.slice(1);
  try { fragment = decodeURIComponent(fragment); } catch { fragment = ''; }
  $$('[data-language-switch]').forEach(link => {
    const anchors = JSON.parse(link.dataset.anchorMap || '{}');
    link.hash = fragment ? (anchors[fragment] || fragment) : '';
  });
}
updateLanguageLinks();
window.addEventListener('hashchange', updateLanguageLinks);

const menu = $('.menu-toggle');
const nav = $('.desktop-nav');
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', t(open ? 'Fermer le menu' : 'Ouvrir le menu'));
  nav.classList.toggle('is-open', open);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav?.classList.contains('is-open')) {
    nav.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', t('Ouvrir le menu'));
    menu.focus();
  }
});

const tabs = $$('[role=tab]');
function selectTab(tab, focus = false) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(item.getAttribute('aria-controls'));
    if (panel) panel.hidden = !selected;
  }
  if (focus) tab.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectTab(tabs[next], true); }
  });
});

const toast = $('.toast');
let toastTimeout;
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 3200);
}
$$('.code-wrap').forEach(wrap => {
  const button = $('.copy-btn', wrap);
  button?.addEventListener('click', async () => {
    const value = $('code', wrap).textContent;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = t('Copié ✓');
      setTimeout(() => { button.textContent = t('Copier'); }, 2200);
    } catch {
      const range = document.createRange();
      range.selectNodeContents($('code', wrap));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      showToast(t('Texte sélectionné : utilisez Ctrl/Cmd + C pour le copier.'));
    }
  });
});

const demo = $('.demo');
if (demo) {
  const clock = $('.demo-clock', demo);
  const state = $('.demo-state', demo);
  const toggle = $('[data-timer-toggle]', demo);
  const finish = $('[data-timer-finish]', demo);
  const project = $('select', demo);
  const results = $('.demo-results', demo);
  let running = false;
  let elapsed = 0;
  let started = 0;
  const getElapsed = () => elapsed + (running ? performance.now() - started : 0);
  const format = ms => {
    const seconds = Math.floor(ms / 1000);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
  };
  function render() {
    clock.textContent = format(getElapsed());
    toggle.textContent = t(running ? 'Ⅱ  Mettre en pause' : elapsed > 0 ? '▷  Reprendre' : '▷  Démarrer');
    state.textContent = t(running ? 'En cours · les secondes de travail s’additionnent.' : elapsed > 0 ? 'En pause · la pause est exclue de la durée.' : 'Prêt à démarrer. Choisissez votre projet.');
    project.disabled = running || elapsed > 0;
    finish.disabled = !running && elapsed <= 0;
    finish.style.opacity = finish.disabled ? '.45' : '1';
  }
  toggle.addEventListener('click', () => {
    if (running) { elapsed += performance.now() - started; running = false; }
    else { started = performance.now(); running = true; }
    render();
  });
  finish.addEventListener('click', () => {
    const duration = getElapsed();
    if (Math.floor(duration / 1000) > 0) {
      const item = document.createElement('li');
      const title = document.createElement('span');
      const total = document.createElement('strong');
      title.textContent = project.value;
      total.textContent = format(duration);
      item.append(title, total);
      results.prepend(item);
      while (results.children.length > 5) results.lastElementChild.remove();
      showToast(t('Temps de démonstration finalisé. Aucune donnée envoyée.'));
    } else { showToast(t('Démonstration terminée : moins d’une seconde, aucune durée ajoutée.')); }
    running = false;
    elapsed = 0;
    render();
  });
  setInterval(() => { if (running) clock.textContent = format(getElapsed()); }, 200);
  render();
}

const featureCards = $$('[data-feature]');
const featureSearch = $('#feature-search');
const featureFilters = $$('[data-feature-filter]');
let category = 'tout';
function filterFeatures() {
  const query = normalize(featureSearch?.value || '');
  let visible = 0;
  featureCards.forEach(card => {
    const match = (category === 'tout' || card.dataset.category === category) && normalize(card.textContent).includes(query);
    card.hidden = !match;
    if (match) visible++;
  });
  const counter = $('#feature-count');
  if (counter) counter.textContent = english ? `${visible} feature${visible !== 1 ? 's' : ''} shown out of ${featureCards.length}` : `${visible} fonctionnalité${visible > 1 ? 's' : ''} affichée${visible > 1 ? 's' : ''} sur ${featureCards.length}`;
  const empty = $('#feature-empty');
  if (empty) empty.hidden = visible > 0;
}
featureSearch?.addEventListener('input', filterFeatures);
featureFilters.forEach(button => button.addEventListener('click', () => {
  category = button.dataset.featureFilter;
  featureFilters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  filterFeatures();
}));
if (featureCards.length) filterFeatures();

const guideSearch = $('#chapter-search');
guideSearch?.addEventListener('input', () => {
  const query = normalize(guideSearch.value);
  let count = 0;
  $$('.doc-chapter').forEach(chapter => {
    const match = normalize(chapter.textContent).includes(query);
    chapter.hidden = !match;
    const link = document.querySelector(`.toc a[href="#${chapter.id}"]`);
    if (link) link.hidden = !match;
    if (match) count++;
  });
  const status = $('#chapter-count');
  if (status) { status.hidden = !query; status.textContent = english ? (count ? `${count} matching chapter${count !== 1 ? 's' : ''}.` : 'No chapters found. Try another word.') : (count ? `${count} chapitre${count > 1 ? 's' : ''} correspondant${count > 1 ? 's' : ''}.` : 'Aucun chapitre. Essayez un autre mot.'); }
});
const headings = $$('.doc-chapter');
if ('IntersectionObserver' in window && headings.length) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      $$('.toc a').forEach(link => link.classList.toggle('active', link.hash === `#${entry.target.id}`));
    }
  }, { rootMargin: '-120px 0px -65% 0px', threshold: 0 });
  headings.forEach(heading => observer.observe(heading));
}

const dialog = $('.search-dialog');
const searchInput = $('#site-search');
const searchResults = $('.search-results');
let searchIndex = window.MINUTREL_SEARCH_INDEX;
let searchPromise;
async function loadIndex() {
  if (searchIndex) return searchIndex;
  searchPromise ||= fetch('search-index.json').then(response => {
    if (!response.ok) throw new Error('index');
    return response.json();
  }).then(data => { searchIndex = data; return data; }).catch(error => { searchPromise = undefined; throw error; });
  return searchPromise;
}
function makeResult(item) {
  const anchor = document.createElement('a');
  anchor.className = 'search-result';
  anchor.href = item.url;
  const group = document.createElement('small'); group.textContent = item.group;
  const title = document.createElement('strong'); title.textContent = item.title;
  const excerpt = document.createElement('p'); excerpt.textContent = item.text.slice(0, 165) + (item.text.length > 165 ? '…' : '');
  anchor.append(group, title, excerpt);
  return anchor;
}
let currentSearch = 0;
async function search() {
  const request = ++currentSearch;
  const query = normalize(searchInput.value.trim());
  searchResults.replaceChildren();
  const loading = document.createElement('p'); loading.className = 'search-empty'; loading.textContent = t('Chargement de la documentation…'); searchResults.append(loading);
  try {
    const index = await loadIndex();
    if (request !== currentSearch) return;
    const words = query.split(/\s+/).filter(Boolean);
    const matches = index.filter(item => words.every(word => normalize(`${item.title} ${item.text} ${item.group}`).includes(word))).map(item => ({...item, score:words.reduce((score, word) => score + (normalize(item.title).includes(word) ? 10 : 1), 0)})).sort((a, b) => b.score - a.score).slice(0, query ? 12 : 6);
    searchResults.replaceChildren();
    if (!matches.length) { loading.textContent = t('Aucun résultat. Essayez « chronomètre », « Docker » ou « sauvegarde ».'); searchResults.append(loading); }
    else matches.forEach(item => searchResults.append(makeResult(item)));
  } catch { if (request === currentSearch) { loading.textContent = t('Recherche indisponible. Retrouvez tous les guides dans la page Ressources.'); const link = document.createElement('a'); link.href = 'ressources.html'; link.textContent = t('Ouvrir les ressources'); searchResults.replaceChildren(loading, link); } }
}
function openSearch() { if (!dialog.open) { dialog.showModal(); searchInput.focus(); search(); } }
$$('[data-open-search]').forEach(button => button.addEventListener('click', openSearch));
$('[data-close-search]')?.addEventListener('click', () => dialog.close());
searchInput?.addEventListener('input', search);
searchResults?.addEventListener('click', event => { if (event.target.closest('a')) dialog.close(); });
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
  if (dialog?.open && event.key === 'ArrowDown' && document.activeElement === searchInput) { event.preventDefault(); $('.search-result', dialog)?.focus(); }
});
dialog?.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });

const lightbox = $('.lightbox');
$$('.prose img,.screenshot-alone img,.screen-pair img').forEach(img => {
  img.tabIndex = 0;
  img.setAttribute('role', 'button');
  img.setAttribute('aria-label', `${t('Agrandir :')} ${img.alt}`);
  const open = () => { $('img', lightbox).src = img.src; $('img', lightbox).alt = img.alt; $('p', lightbox).textContent = img.alt; lightbox.showModal(); };
  img.addEventListener('click', open);
  img.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
});
$('[data-close-lightbox]')?.addEventListener('click', () => lightbox.close());
lightbox?.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });

const topLink = $('.top-link');
function updateTopLink() { if (topLink) topLink.hidden = window.scrollY < 650; }
window.addEventListener('scroll', updateTopLink, { passive:true });
updateTopLink();
