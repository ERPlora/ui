const palette = document.querySelector('#palette');
const modes = document.querySelectorAll('[data-mode]');

palette?.addEventListener('change', () => {
  if (palette.value === 'erplora') document.documentElement.removeAttribute('data-ep-palette');
  else document.documentElement.setAttribute('data-ep-palette', palette.value);
});

for (const button of modes) {
  button.addEventListener('click', () => {
    const dark = button.dataset.mode === 'dark';
    document.documentElement.classList.toggle('ion-palette-dark', dark);
    for (const option of modes) option.setAttribute('aria-pressed', String(option === button));
  });
}
