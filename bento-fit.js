(() => {
  const shop = document.getElementById('shop-modal');
  if (!shop) return;
  const selector = '.bento-row > p, .bento-row h3, .bento-row .btn, .bento-shop-description > span, .bento-results-title, .bento-slot span';
  let scheduled = false;
  function fit() {
    scheduled = false;
    const lines = [...shop.querySelectorAll(selector)];
    for (const line of lines) line.style.fontSize = '';
    for (const line of lines) {
      if (!line.clientWidth) continue;
      const style = getComputedStyle(line);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const available = line.clientWidth - padding;
      const needed = line.scrollWidth - padding;
      if (available > 0 && needed > available) {
        line.style.fontSize = `${parseFloat(style.fontSize) * available / needed * .97}px`;
      }
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(fit);
  }
  new MutationObserver(schedule).observe(shop, {
    childList: true, characterData: true, subtree: true,
    attributes: true, attributeFilter: ['class'],
  });
  if (typeof ResizeObserver === 'function') {
    let width = -1;
    new ResizeObserver(entries => {
      const next = entries[0].contentRect.width;
      if (next !== width) { width = next; schedule(); }
    }).observe(shop.querySelector('.shop-panel'));
  }
  window.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
})();
