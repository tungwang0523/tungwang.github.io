const initialiseGalleryWall = (wall: HTMLElement) => {
  if (wall.dataset.galleryWallReady === 'true') return;
  wall.dataset.galleryWallReady = 'true';

  const photos = Array.from(wall.querySelectorAll<HTMLElement>('[data-gallery-photo]'));
  let frame = 0;

  const layout = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const styles = getComputedStyle(wall);
      const available =
        wall.clientWidth -
        (Number.parseFloat(styles.paddingLeft) || 0) -
        (Number.parseFloat(styles.paddingRight) || 0);
      if (!available) return;

      const gap = Number.parseFloat(styles.columnGap) || 4;
      const viewportWidth = window.innerWidth;
      const target = viewportWidth <= 620 ? 240 : viewportWidth <= 1030 ? 220 : 250;
      const rows: Array<{ items: HTMLElement[]; ratio: number }> = [];
      let items: HTMLElement[] = [];
      let ratio = 0;

      photos.forEach((photo) => {
        const photoRatio = Number.parseFloat(photo.dataset.galleryRatio || '1') || 1;
        items.push(photo);
        ratio += photoRatio;
        if (ratio * target + gap * (items.length - 1) >= available) {
          rows.push({ items, ratio });
          items = [];
          ratio = 0;
        }
      });
      if (items.length) rows.push({ items, ratio });

      rows.forEach((row, rowIndex) => {
        const complete =
          rowIndex < rows.length - 1 ||
          row.ratio * target + gap * (row.items.length - 1) >= available;
        const height = complete
          ? (available - gap * (row.items.length - 1)) / row.ratio
          : Math.min(target, (available - gap * (row.items.length - 1)) / row.ratio);

        row.items.forEach((photo) => {
          const photoRatio = Number.parseFloat(photo.dataset.galleryRatio || '1') || 1;
          photo.style.flexBasis = `${photoRatio * height}px`;
        });
      });
    });
  };

  const resizeObserver = new ResizeObserver(layout);
  resizeObserver.observe(wall);
  layout();
};

const initialiseGalleryWalls = () => {
  const pendingWalls = Array.from(
    document.querySelectorAll<HTMLElement>('[data-gallery-wall]:not([data-gallery-wall-ready])'),
  );
  if (pendingWalls.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    pendingWalls.forEach(initialiseGalleryWall);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        initialiseGalleryWall(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '100% 0px' },
  );

  pendingWalls.forEach((wall) => observer.observe(wall));
};

initialiseGalleryWalls();
document.addEventListener('astro:page-load', initialiseGalleryWalls);
