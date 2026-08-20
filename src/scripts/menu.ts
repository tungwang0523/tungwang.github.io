const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menu = document.querySelector<HTMLElement>('[data-menu]');
const mobileBrand = document.querySelector<HTMLElement>('[data-mobile-brand]');
const pageBrand = document.querySelector<HTMLElement>('[data-page-brand]');
const mobileBrandTitle = document.querySelector<HTMLElement>('[data-mobile-brand-title]');
const pageScrollContainer = document.querySelector<HTMLElement>('.page--content-card');
const pageScrollTop = () => pageScrollContainer?.scrollTop ?? window.scrollY;
const scrollPageToTop = () =>
  pageScrollContainer
    ? pageScrollContainer.scrollTo({ top: 0, behavior: 'smooth' })
    : window.scrollTo({ top: 0, behavior: 'smooth' });
const identityTitle =
  document.querySelector<HTMLElement>('[data-mobile-identity]') ??
  document.querySelector<HTMLElement>('.blog-is-sticky .blog-big__title');

if (mobileBrand?.dataset.mobileBrandScrollTop) {
  const homeBeforeTitle = mobileBrand.dataset.mobileBrandHomeBeforeTitle === 'true';
  const homeAtTop = mobileBrand.dataset.mobileBrandHomeAtTop === 'true';
  mobileBrand.addEventListener('click', (event) => {
    if (homeAtTop && pageScrollTop() <= 4) return;
    if (homeBeforeTitle && !mobileBrand.classList.contains('is-expanded')) return;
    event.preventDefault();
    scrollPageToTop();
  });
}

if (pageBrand?.dataset.pageBrandExpanded) {
  pageBrand.addEventListener('click', (event) => {
    if (pageBrand.dataset.pageBrandHomeAtTop === 'true' && pageScrollTop() <= 4) return;
    if (!pageBrand.classList.contains('is-expanded')) return;
    event.preventDefault();
    scrollPageToTop();
  });
}

const setOpen = (open: boolean) => {
  if (!toggle || !menu) return;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  toggle.classList.toggle('is-open', open);
  menu.classList.toggle('is-open', open);
  document.body.classList.toggle('menu-open', open);
};

if (toggle && menu && menu.dataset.swipeCloseReady !== 'true') {
  menu.dataset.swipeCloseReady = 'true';
  let pointerId: number | null = null;
  let touchId: number | null = null;
  let gestureActive = false;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let distance = 0;
  let directionResolved = false;
  let horizontalSwipe = false;

  const clearSwipeStyles = () => {
    menu.classList.remove('is-swipe-dragging');
    menu.style.removeProperty('transform');
    menu.style.removeProperty('transition');
  };

  const finishSwipe = () => {
    if (!gestureActive) return;
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = distance / elapsed;
    const threshold = Math.max(72, menu.clientWidth * 0.16);
    const shouldClose =
      horizontalSwipe && (distance >= threshold || (distance >= 32 && velocity > 0.55));

    pointerId = null;
    touchId = null;
    gestureActive = false;
    directionResolved = false;
    horizontalSwipe = false;

    menu.classList.remove('is-swipe-dragging');
    menu.style.removeProperty('transition');

    if (!shouldClose) {
      menu.style.removeProperty('transform');
      return;
    }

    menu.style.transform = `translateX(${Math.max(menu.clientWidth, window.innerWidth)}px)`;
    const complete = () => {
      setOpen(false);
      menu.classList.add('is-swipe-dragging');
      menu.style.removeProperty('transition');
      menu.style.removeProperty('transform');
      requestAnimationFrame(() => menu.classList.remove('is-swipe-dragging'));
    };
    menu.addEventListener('transitionend', complete, { once: true });
    window.setTimeout(() => {
      if (menu.classList.contains('is-open')) complete();
    }, 320);
  };

  const startSwipe = (clientX: number, clientY: number) => {
    gestureActive = true;
    startX = clientX;
    startY = clientY;
    startTime = performance.now();
    distance = 0;
    directionResolved = false;
    horizontalSwipe = false;
  };

  const moveSwipe = (clientX: number, clientY: number, preventDefault: () => void) => {
    if (!gestureActive) return;
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (!directionResolved && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 7) {
      directionResolved = true;
      horizontalSwipe = deltaX > 0 && Math.abs(deltaX) > Math.abs(deltaY);
    }
    if (!horizontalSwipe) return;

    preventDefault();
    distance = Math.max(0, deltaX);
    menu.classList.add('is-swipe-dragging');
    menu.style.transform = `translateX(${distance}px)`;
  };

  const cancelSwipe = () => {
    pointerId = null;
    touchId = null;
    gestureActive = false;
    directionResolved = false;
    horizontalSwipe = false;
    clearSwipeStyles();
  };

  menu.addEventListener('pointerdown', (event) => {
    /* iOS WebKit can cancel touch pointer sequences inside a vertically
       scrollable drawer. Real touch input is handled by Touch Events below;
       Pointer Events remain for mouse, pen and desktop emulation. */
    if (event.pointerType === 'touch' || !menu.classList.contains('is-open') || !event.isPrimary)
      return;
    pointerId = event.pointerId;
    startSwipe(event.clientX, event.clientY);
  });

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId !== pointerId) return;
      moveSwipe(event.clientX, event.clientY, () => event.preventDefault());
    },
    { passive: false },
  );

  window.addEventListener('pointerup', (event) => {
    if (event.pointerId === pointerId) finishSwipe();
  });
  window.addEventListener('pointercancel', (event) => {
    if (event.pointerId !== pointerId) return;
    cancelSwipe();
  });

  menu.addEventListener(
    'touchstart',
    (event) => {
      if (!menu.classList.contains('is-open') || event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchId = touch.identifier;
      startSwipe(touch.clientX, touch.clientY);
    },
    { passive: true },
  );

  window.addEventListener(
    'touchmove',
    (event) => {
      if (touchId === null) return;
      const touch = Array.from(event.touches).find((item) => item.identifier === touchId);
      if (!touch) return;
      moveSwipe(touch.clientX, touch.clientY, () => event.preventDefault());
    },
    { passive: false },
  );

  window.addEventListener('touchend', (event) => {
    if (touchId === null) return;
    const ended = Array.from(event.changedTouches).some((item) => item.identifier === touchId);
    if (ended) finishSwipe();
  });

  window.addEventListener('touchcancel', (event) => {
    if (touchId === null) return;
    const cancelled = Array.from(event.changedTouches).some((item) => item.identifier === touchId);
    if (cancelled) cancelSwipe();
  });
}

toggle?.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  setOpen(open);
});

menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setOpen(false);
});

if (mobileBrand?.dataset.mobileBrandExpanded) {
  const alwaysExpanded = mobileBrand.dataset.mobileBrandExpandedAlways === 'true';
  const mobileBar = mobileBrand.closest<HTMLElement>('.menu-mobile-bar');
  const updateExpandedBrand = () => {
    const navigationBottom = mobileBar?.getBoundingClientRect().bottom ?? 64;
    const titleHasPassed = mobileBrandTitle
      ? mobileBrandTitle.getBoundingClientRect().bottom <= navigationBottom
      : false;
    mobileBrand.classList.toggle('is-expanded', alwaysExpanded || titleHasPassed);
    mobileBar?.classList.toggle('is-title-passed', alwaysExpanded || titleHasPassed);
  };

  updateExpandedBrand();

  if (!alwaysExpanded && mobileBrandTitle) {
    const navigationBottom = mobileBar?.getBoundingClientRect().bottom ?? 64;
    const expandedBrandObserver = new IntersectionObserver(updateExpandedBrand, {
      rootMargin: `-${navigationBottom}px 0px 0px`,
      threshold: 0,
    });
    expandedBrandObserver.observe(mobileBrandTitle);
  }
} else if (mobileBrand && identityTitle) {
  const brandObserver = new IntersectionObserver(
    ([entry]) => mobileBrand.classList.toggle('is-visible', !entry.isIntersecting),
    { rootMargin: '-64px 0px 0px', threshold: 0 },
  );
  brandObserver.observe(identityTitle);
}

if (pageBrand?.dataset.pageBrandExpanded) {
  const alwaysExpanded = pageBrand.dataset.pageBrandExpandedAlways === 'true';
  const pageNavigation = pageBrand.closest<HTMLElement>('.page-nav');
  const updateExpandedPageBrand = () => {
    const navigationBottom = pageNavigation?.getBoundingClientRect().bottom ?? 0;
    const titleHasPassed = mobileBrandTitle
      ? mobileBrandTitle.getBoundingClientRect().bottom <= navigationBottom
      : false;
    pageBrand.classList.toggle('is-expanded', alwaysExpanded || titleHasPassed);
    pageNavigation?.classList.toggle('is-title-passed', alwaysExpanded || titleHasPassed);
  };

  updateExpandedPageBrand();

  if (!alwaysExpanded && mobileBrandTitle) {
    const navigationBottom = pageNavigation?.getBoundingClientRect().bottom ?? 0;
    const pageBrandObserver = new IntersectionObserver(updateExpandedPageBrand, {
      rootMargin: `-${navigationBottom}px 0px 0px`,
      threshold: 0,
    });
    pageBrandObserver.observe(mobileBrandTitle);
  }
}
