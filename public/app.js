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

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-copy]');

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
