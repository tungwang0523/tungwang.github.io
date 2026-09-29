const setupMasonryBoundaryClips = (page: HTMLElement) => {
  if (page.dataset.masonryBoundaryReady === 'true') return;

  const viewport = page.querySelector<HTMLElement>('.page-content-card-viewport');
  const grids = Array.from(page.querySelectorAll<HTMLElement>('[data-masonry-grid]'));
  const topMask = page.querySelector<HTMLElement>('.masonry-boundary-mask--top');
  const bottomMask = page.querySelector<HTMLElement>('.masonry-boundary-mask--bottom');

  if (!viewport || grids.length === 0 || !topMask || !bottomMask) return;
  page.dataset.masonryBoundaryReady = 'true';

  let frame = 0;

  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const viewportRect = viewport.getBoundingClientRect();
      const centre = (viewportRect.left + viewportRect.right) / 2;
      const itemRects = grids
        .flatMap((grid) => Array.from(grid.children))
        .filter((item): item is HTMLElement => item instanceof HTMLElement)
        .map((item) => item.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);

      const updateMask = (mask: HTMLElement, boundary: number) => {
        let clipsLeftCard = false;
        let clipsRightCard = false;

        itemRects.forEach((rect) => {
          const crossesBoundary = rect.top < boundary && rect.bottom > boundary;
          const isColumnCard = rect.width < viewportRect.width * 0.75;
          if (!crossesBoundary || !isColumnCard) return;

          if ((rect.left + rect.right) / 2 < centre) clipsLeftCard = true;
          else clipsRightCard = true;
        });

        mask
          .querySelector('.masonry-boundary-mask__corner--left-card')
          ?.classList.toggle('is-visible', clipsLeftCard);
        mask
          .querySelector('.masonry-boundary-mask__corner--right-card')
          ?.classList.toggle('is-visible', clipsRightCard);
      };

      updateMask(topMask, viewportRect.top);
      updateMask(bottomMask, viewportRect.bottom);
    });
  };

  page.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('content-card:refresh', update);
  const observer = new ResizeObserver(update);
  grids.forEach((grid) => observer.observe(grid));
  document.fonts?.ready.then(update);
  update();
};

document
  .querySelectorAll<HTMLElement>('.blog-page.page--content-card, .microblog-page.page--content-card')
  .forEach(setupMasonryBoundaryClips);
