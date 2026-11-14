/* Climatize 2.1: preferências visuais locais, sem leitura ou escrita no Supabase. */
(() => {
  'use strict';
  const KEY = 'climatize_theme_v21';
  const root = document.documentElement;
  const themeButton = document.getElementById('btn-theme');
  const authButton = document.getElementById('auth-theme-toggle');
  const meta = document.getElementById('theme-meta');
  function setTheme(theme) {
    const safeTheme = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = safeTheme;
    const dark = safeTheme === 'dark';
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(dark));
      themeButton.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
      const icon = themeButton.querySelector('.theme-icon');
      const label = themeButton.querySelector('.theme-label');
      if(icon) icon.textContent = dark ? '☀' : '☾';
      if(label) label.textContent = dark ? 'Modo claro' : 'Modo escuro';
      themeButton.title = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
    }
    if (authButton) {
      authButton.querySelector('span').textContent = dark ? 'Modo claro' : 'Modo escuro';
      authButton.firstChild.textContent = dark ? '☀ ' : '☾ ';
    }
    if(meta) meta.content = dark ? '#071a20' : '#0e3035';
    try { localStorage.setItem(KEY, safeTheme); } catch (_) {}
    // Atualiza o Canvas do Chart.js, que não resolve variáveis CSS automaticamente.
    try {
      if (typeof chartInstance !== 'undefined' && chartInstance) {
        const cs = getComputedStyle(root);
        const muted = cs.getPropertyValue('--muted').trim();
        const grid = cs.getPropertyValue('--chart-grid').trim();
        chartInstance.options.scales.x.ticks.color = muted;
        chartInstance.options.scales.y.ticks.color = muted;
        chartInstance.options.scales.y.grid.color = grid;
        chartInstance.update();
      }
    } catch (_) {}
  }
  function toggle() { setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'); }
  themeButton?.addEventListener('click', toggle);
  authButton?.addEventListener('click', toggle);
  setTheme(root.dataset.theme);

  const today = document.getElementById('hero-date');
  if (today) today.textContent = new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const dateField = document.getElementById('t-data');
  if(dateField && !dateField.value){
    const d = new Date();
    dateField.value = [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }
  document.querySelectorAll('[data-go-module]').forEach(btn=>btn.addEventListener('click',()=>{
    const target = document.querySelector(`.module-tab[data-modulo="${btn.dataset.goModule}"]`);
    if(target) { target.click(); window.scrollTo({top:0,behavior:'smooth'}); }
  }));
  document.querySelectorAll('[data-scroll-to]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelector('.module-tab[data-modulo="financeiro"]')?.click();
    document.getElementById(btn.dataset.scrollTo)?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
})();
