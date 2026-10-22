// Runs before the page draws, so a light-theme visitor never sees a dark flash.
try { if (localStorage.getItem('padrino.theme') === 'light') document.documentElement.dataset.theme = 'light' } catch (e) {}
