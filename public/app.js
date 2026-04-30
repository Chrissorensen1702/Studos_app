const copyValue = async (value) => {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  document.execCommand('copy');
  input.remove();
};

const closestTarget = (event, selector) => {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;

  return target?.closest(selector) ?? null;
};

const focusTarget = (targetId) => {
  const input = document.getElementById(targetId);

  if (input) {
    window.setTimeout(() => input.focus(), 0);
  }
};

const openDialog = (dialog, targetId = dialog.dataset.focusTarget) => {
  if (typeof dialog.showModal === 'function') {
    try {
      if (!dialog.open) {
        dialog.showModal();
      }
    } catch (error) {
      dialog.setAttribute('open', '');
    }
  } else {
    dialog.setAttribute('open', '');
  }

  if (targetId) {
    focusTarget(targetId);
  }
};

if (window.location.hash === '#add-member-form') {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

document.addEventListener('click', async (event) => {
  const button = closestTarget(event, '[data-copy]');

  if (!button) {
    return;
  }

  const originalText = button.textContent;

  try {
    await copyValue(button.dataset.copy);
    button.textContent = 'Kopieret';
    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1400);
  } catch (error) {
    button.textContent = 'Kunne ikke kopiere';
    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1800);
  }
});

document.addEventListener('click', (event) => {
  const openButton = closestTarget(event, '[data-dialog-open]');

  if (openButton) {
    event.preventDefault();

    const dialog = document.getElementById(openButton.dataset.dialogOpen);

    if (!dialog) {
      return;
    }

    openDialog(dialog, openButton.dataset.focusTarget);

    return;
  }

  const closeButton = closestTarget(event, '[data-dialog-close]');

  if (closeButton) {
    const dialog = closeButton.closest('dialog');

    if (dialog && typeof dialog.close === 'function') {
      dialog.close();
    } else if (dialog) {
      dialog.removeAttribute('open');
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('dialog[data-open-on-load]').forEach((dialog) => {
    openDialog(dialog);
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const browser = document.querySelector('[data-feature-browser]');

  if (!browser) {
    return;
  }

  const cards = [...browser.querySelectorAll('[data-feature-card]')];
  const slides = [...browser.querySelectorAll('[data-feature-slide]')];
  const title = browser.querySelector('[data-feature-title]');
  const previousButton = browser.querySelector('[data-feature-prev]');
  const nextButton = browser.querySelector('[data-feature-next]');
  let activeIndex = Math.max(0, cards.findIndex((card) => card.classList.contains('is-active')));

  const setActiveFeature = (index) => {
    if (!cards.length || !slides.length) {
      return;
    }

    activeIndex = (index + cards.length) % cards.length;
    const activeCard = cards[activeIndex];
    const activeId = cards[activeIndex].dataset.featureCard;
    const activeSlideIndex = Math.max(0, slides.findIndex((slide) => slide.dataset.featureSlide === activeId));
    const activeTitle = slides[activeSlideIndex]?.dataset.featureTitle
      ?? slides[activeSlideIndex]?.querySelector('.mockup-screen-head span')?.textContent?.trim();
    const activeAccent = window.getComputedStyle(activeCard).getPropertyValue('--feature-accent').trim();

    if (title && activeTitle) {
      title.textContent = activeTitle;
    }

    if (activeAccent) {
      browser.style.setProperty('--active-feature-accent', activeAccent);
    }

    cards.forEach((card, cardIndex) => {
      const isActive = cardIndex === activeIndex;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-pressed', String(isActive));

      if (isActive) {
        card.setAttribute('aria-current', 'true');
      } else {
        card.removeAttribute('aria-current');
      }
    });

    const previousIndex = (activeSlideIndex - 1 + slides.length) % slides.length;
    const nextIndex = (activeSlideIndex + 1) % slides.length;

    slides.forEach((slide, slideIndex) => {
      const isActive = slide.dataset.featureSlide === activeId;
      const isPrevious = slideIndex === previousIndex;
      const isNext = slideIndex === nextIndex;
      slide.classList.toggle('is-active', isActive);
      slide.classList.toggle('is-prev', !isActive && isPrevious);
      slide.classList.toggle('is-next', !isActive && isNext);
      slide.setAttribute('aria-hidden', String(!isActive));
    });
  };

  cards.forEach((card, cardIndex) => {
    card.addEventListener('click', () => setActiveFeature(cardIndex));
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      setActiveFeature(cardIndex);
    });
  });

  previousButton?.addEventListener('click', () => setActiveFeature(activeIndex - 1));
  nextButton?.addEventListener('click', () => setActiveFeature(activeIndex + 1));

  setActiveFeature(activeIndex);
});

document.addEventListener('click', (event) => {
  if (
    typeof HTMLDialogElement !== 'undefined'
    && event.target instanceof HTMLDialogElement
    && event.target.classList.contains('modal')
  ) {
    event.target.close();
  }
});
