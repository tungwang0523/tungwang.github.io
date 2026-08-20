  const dialog = document.querySelector<HTMLDialogElement>('[data-image-lightbox]');
  const tooltip = document.querySelector<HTMLElement>('[data-image-caption-tooltip]');

  if (dialog) {
    const image = dialog.querySelector<HTMLImageElement>('.microblog-lightbox__image');
    const stage = dialog.querySelector<HTMLElement>('.microblog-lightbox__stage');
    const caption = dialog.querySelector<HTMLElement>('.microblog-lightbox__caption');
    const previous = dialog.querySelector<HTMLButtonElement>('.microblog-lightbox__nav--previous');
    const next = dialog.querySelector<HTMLButtonElement>('.microblog-lightbox__nav--next');
    const counter = dialog.querySelector<HTMLElement>('.microblog-lightbox__counter');
    const close = dialog.querySelector<HTMLButtonElement>('.microblog-lightbox__close');
    const preloads = new Map<string, Promise<boolean>>();
    let gallery: HTMLElement[] = [];
    let activeIndex = 0;
    let requestId = 0;
    let switching = false;
    let lastTrigger: HTMLElement | null = null;
    let touchStartX: number | null = null;
    let touchStartY: number | null = null;

    const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const sourceFor = (trigger: HTMLElement) =>
      (window.matchMedia('(max-width: 768px)').matches
        ? trigger.dataset.lightboxMobileSrc
        : trigger.dataset.lightboxSrc) ||
      trigger.dataset.lightboxSrc ||
      trigger.dataset.originalSrc ||
      (trigger instanceof HTMLImageElement ? trigger.currentSrc || trigger.src : '') ||
      trigger.querySelector<HTMLImageElement>('img')?.currentSrc ||
      trigger.querySelector<HTMLImageElement>('img')?.src ||
      '';

    const previewFor = (trigger: HTMLElement) => {
      const preview =
        trigger instanceof HTMLImageElement
          ? trigger
          : trigger.querySelector<HTMLImageElement>('img');
      return preview?.currentSrc || preview?.src || sourceFor(trigger);
    };

    const parseItems = (raw?: string) => {
      if (!raw) return [];
      try {
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
          return items.filter(
            (item): item is string => typeof item === 'string' && item.length > 0,
          );
        }
      } catch {
        return [raw];
      }
      return [];
    };

    const captionFor = (trigger: HTMLElement) => {
      const language = trigger.closest<HTMLElement>('[data-microblog-scope]')?.dataset.language;
      if (language === 'en') return parseItems(trigger.dataset.captionEn);
      if (trigger.dataset.captionZh) return parseItems(trigger.dataset.captionZh);
      return parseItems(trigger.dataset.caption);
    };

    const renderCaption = (container: HTMLElement | null, items: string[]) => {
      if (!container) return;
      container.replaceChildren();
      items.forEach((item) => {
        const text = document.createElement('span');
        text.className = 'microblog-image-caption__item';
        text.textContent = item;
        container.append(text);
      });
      container.hidden = items.length === 0;
    };

    const preload = (source: string) => {
      const existing = preloads.get(source);
      if (existing) return existing;
      const request = new Promise<boolean>((resolve) => {
        const loader = new Image();
        loader.onload = () => resolve(true);
        loader.onerror = () => resolve(false);
        loader.src = source;
      });
      preloads.set(source, request);
      return request;
    };

    const preloadNeighbors = (index: number) => {
      [gallery[index - 1], gallery[index + 1]].forEach((neighbor) => {
        if (neighbor) void preload(sourceFor(neighbor));
      });
    };

    const render = (index: number, displaySource?: string) => {
      const trigger = gallery[index];
      if (!trigger || !image || !previous || !next || !counter) return;
      activeIndex = index;
      image.src = displaySource || sourceFor(trigger);
      image.alt =
        trigger.dataset.alt ||
        (trigger instanceof HTMLImageElement ? trigger.alt : trigger.querySelector('img')?.alt) ||
        '';
      renderCaption(caption, captionFor(trigger));

      const multiple = gallery.length > 1;
      previous.hidden = !multiple;
      next.hidden = !multiple;
      counter.hidden = !multiple;
      previous.disabled = index === 0;
      next.disabled = index === gallery.length - 1;
      counter.textContent = `${index + 1} / ${gallery.length}`;
      dialog.setAttribute('aria-label', `Full-size image ${index + 1} of ${gallery.length}`);
    };

    const show = () => {
      dialog.classList.remove('is-closing');
      dialog.showModal();
      if (reducedMotion()) {
        dialog.classList.add('is-visible');
      } else {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => dialog.classList.add('is-visible')),
        );
      }
    };

    const hide = () => {
      if (!dialog.open || dialog.classList.contains('is-closing')) return;
      requestId += 1;
      if (reducedMotion()) {
        dialog.close();
        return;
      }
      dialog.classList.add('is-closing');
      dialog.classList.remove('is-visible');
      window.setTimeout(() => {
        if (dialog.open) dialog.close();
      }, 220);
    };

    const open = (trigger: HTMLElement) => {
      lastTrigger = trigger;
      const scope = trigger.closest<HTMLElement>('[data-lightbox-scope]');
      gallery = scope
        ? Array.from(scope.querySelectorAll<HTMLElement>('[data-lightbox-image]'))
        : [trigger];
      const foundIndex = gallery.indexOf(trigger);
      const index = foundIndex >= 0 ? foundIndex : 0;
      const fullSource = sourceFor(trigger);
      const currentRequest = ++requestId;
      render(index, previewFor(trigger));
      show();
      if (tooltip) tooltip.hidden = true;

      if (fullSource) {
        void preload(fullSource).then(async (loaded) => {
          if (
            !loaded ||
            currentRequest !== requestId ||
            activeIndex !== index ||
            !dialog.open ||
            !image
          )
            return;
          image.src = fullSource;
          await image.decode().catch(() => undefined);
          preloadNeighbors(index);
        });
      }
    };

    const move = async (direction: -1 | 1) => {
      const nextIndex = activeIndex + direction;
      if (nextIndex < 0 || nextIndex >= gallery.length || switching || !image || !stage) return;
      const trigger = gallery[nextIndex];
      if (!trigger) return;
      const nextSource = sourceFor(trigger);
      if (!nextSource) return;

      switching = true;
      const currentRequest = ++requestId;
      const distance = direction > 0 ? -28 : 28;
      const outgoing =
        !reducedMotion() && !image.classList.contains('is-loading')
          ? image.animate(
              [
                { opacity: 1, transform: 'translateX(0)' },
                { opacity: 0, transform: `translateX(${distance}px)` },
              ],
              { duration: 120, easing: 'ease-in', fill: 'forwards' },
            )
          : null;
      await outgoing?.finished.catch(() => undefined);
      if (currentRequest !== requestId || !dialog.open) {
        outgoing?.cancel();
        switching = false;
        return;
      }

      image.classList.add('is-loading');
      stage.classList.add('is-loading');
      render(nextIndex, nextSource);
      outgoing?.cancel();
      switching = false;

      const loaded = await preload(nextSource);
      if (currentRequest !== requestId || !dialog.open) return;
      image.classList.remove('is-loading');
      stage.classList.remove('is-loading');
      if (!loaded) return;
      await image.decode().catch(() => undefined);
      preloadNeighbors(nextIndex);
      if (reducedMotion()) return;
      await image
        .animate(
          [
            { opacity: 0, transform: `translateX(${-distance}px)` },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          { duration: 190, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        )
        .finished.catch(() => undefined);
    };

    const positionTooltip = (event: PointerEvent) => {
      if (!tooltip) return;
      const offset = 16;
      const edge = 12;
      const bounds = tooltip.getBoundingClientRect();
      const left = Math.min(event.clientX + offset, window.innerWidth - bounds.width - edge);
      const preferredTop = event.clientY + offset;
      const top =
        preferredTop + bounds.height <= window.innerHeight - edge
          ? preferredTop
          : Math.max(edge, event.clientY - bounds.height - offset);
      tooltip.style.transform = `translate(${Math.max(edge, left)}px, ${top}px)`;
    };

    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const trigger = target.closest<HTMLElement>('[data-lightbox-image]');
      if (trigger) {
        event.preventDefault();
        open(trigger);
        return;
      }
      if (target.closest('.microblog-lightbox__nav--previous')) void move(-1);
      if (target.closest('.microblog-lightbox__nav--next')) void move(1);
    });

    document.addEventListener('keydown', (event) => {
      if (!dialog.open) {
        const trigger = (event.target as HTMLElement)?.closest<HTMLElement>(
          '[data-lightbox-image]',
        );
        if (trigger && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          open(trigger);
        }
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void move(-1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        void move(1);
      }
    });

    document.addEventListener('pointerover', (event) => {
      if (!tooltip || !(event instanceof PointerEvent) || event.pointerType === 'touch') return;
      const trigger = (event.target as HTMLElement).closest<HTMLElement>('[data-lightbox-tooltip]');
      if (!trigger || trigger.contains(event.relatedTarget as Node | null)) return;
      renderCaption(tooltip, captionFor(trigger));
      if (!tooltip.hidden) positionTooltip(event);
    });

    document.addEventListener('pointermove', (event) => {
      if (tooltip && !tooltip.hidden) positionTooltip(event);
    });

    document.addEventListener('pointerout', (event) => {
      if (!tooltip) return;
      const trigger = (event.target as HTMLElement).closest<HTMLElement>('[data-lightbox-tooltip]');
      if (!trigger || trigger.contains(event.relatedTarget as Node | null)) return;
      tooltip.hidden = true;
    });

    image?.addEventListener(
      'touchstart',
      (event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      },
      { passive: true },
    );

    image?.addEventListener(
      'touchend',
      (event) => {
        const touch = event.changedTouches[0];
        if (!touch || touchStartX === null || touchStartY === null) return;
        const distanceX = touch.clientX - touchStartX;
        const distanceY = touch.clientY - touchStartY;
        touchStartX = null;
        touchStartY = null;
        if (Math.abs(distanceX) < 48 || Math.abs(distanceX) <= Math.abs(distanceY)) return;
        void move(distanceX < 0 ? 1 : -1);
      },
      { passive: true },
    );

    close?.addEventListener('click', hide);
    dialog.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.microblog-lightbox__image')) return;
      if (target.closest('.microblog-lightbox__nav')) return;
      hide();
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      hide();
    });
    dialog.addEventListener('close', () => {
      dialog.classList.remove('is-visible', 'is-closing');
      image?.classList.remove('is-loading');
      stage?.classList.remove('is-loading');
      switching = false;
      lastTrigger?.focus();
    });
  }
