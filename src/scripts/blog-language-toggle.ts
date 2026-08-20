type BlogLanguage = 'zh' | 'en';

const setBlogLanguage = (scope: HTMLElement, language: BlogLanguage) => {
  scope.dataset.blogLanguage = language;
  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  document.querySelectorAll<HTMLButtonElement>('[data-blog-language-option]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.blogLanguageOption === language));
  });
  document
    .querySelectorAll<HTMLAnchorElement>(
      '.page-nav a[href^="/blog"], .site-footer__nav a[href^="/blog"]',
    )
    .forEach((anchor) => {
      anchor.href = language === 'en' ? '/blog?lang=en' : '/blog';
    });

  const url = new URL(window.location.href);
  if (language === 'en') url.searchParams.set('lang', 'en');
  else url.searchParams.delete('lang');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

  /* Replacing one complete list with another changes the scroll extent
         without a viewport resize. Safari can otherwise keep the old fixed
         lower mask in its compositor until another UI state forces a
         rebuild (opening the hamburger happened to do that). */
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('content-card:refresh'));
  });
};

const initialiseBlogLanguage = () => {
  document.querySelectorAll<HTMLElement>('[data-blog-language-scope]').forEach((scope) => {
    if (scope.dataset.blogLanguageReady === 'true') return;
    scope.dataset.blogLanguageReady = 'true';
    const language: BlogLanguage =
      new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'zh';
    setBlogLanguage(scope, language);

    document
      .querySelectorAll<HTMLButtonElement>('[data-blog-language-option]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          setBlogLanguage(scope, button.dataset.blogLanguageOption === 'en' ? 'en' : 'zh');
        });
      });
  });
};

initialiseBlogLanguage();
document.addEventListener('astro:page-load', initialiseBlogLanguage);
