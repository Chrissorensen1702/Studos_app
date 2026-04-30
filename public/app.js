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

document.addEventListener('click', (event) => {
  if (
    typeof HTMLDialogElement !== 'undefined'
    && event.target instanceof HTMLDialogElement
    && event.target.classList.contains('modal')
  ) {
    event.target.close();
  }
});
