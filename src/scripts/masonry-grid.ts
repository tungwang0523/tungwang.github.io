const setupMasonryGrid = (grid: HTMLElement) => {
  if (grid.dataset.masonryReady === 'true') return;
  grid.dataset.masonryReady = 'true';

  let frame = 0;

  const layout = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const items = Array.from(grid.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      );

      grid.classList.remove('is-masonry-ready');
      items.forEach((item) => item.style.removeProperty('grid-row-end'));

      if (window.matchMedia('(max-width: 560px)').matches || grid.offsetParent === null) return;

      const heights = items.map((item) => item.getBoundingClientRect().height);
      grid.classList.add('is-masonry-ready');

      const styles = getComputedStyle(grid);
      const row = Number.parseFloat(styles.gridAutoRows) || 1;
      const gap = Number.parseFloat(styles.columnGap) || 12;

      items.forEach((item, index) => {
        item.style.gridRowEnd = `span ${Math.max(1, Math.ceil((heights[index] + gap) / row))}`;
      });
    });
  };

  const observer = new ResizeObserver(layout);
  observer.observe(grid);
  Array.from(grid.children).forEach((item) => observer.observe(item));
  grid.querySelectorAll('img').forEach((image) => {
    if (!image.complete) image.addEventListener('load', layout, { once: true });
  });
  document.fonts?.ready.then(layout);
  window.addEventListener('resize', layout, { passive: true });
  window.addEventListener('content-card:refresh', layout);
  layout();
};

document.querySelectorAll<HTMLElement>('[data-masonry-grid]').forEach(setupMasonryGrid);
