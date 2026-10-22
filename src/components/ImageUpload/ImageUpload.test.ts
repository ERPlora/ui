// ImageUpload — one image of a form (a website's logo, its cover): the current image as a thumbnail
// (or an empty placeholder), «Choose image» that opens the file picker, «Remove» while there is one.
// The file is checked here (type and size) before the page's `upload(file)` is called; while it runs
// a spinner shows and the buttons wait; what it answers (`{ id, url }`) is the new `v-model`, and a
// rejection paints its message.
import { flushPromises, mount } from '@vue/test-utils';
import { addIcons } from 'ionicons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import { ION_ICONS } from '../../shell/icons';
import ImageUpload from './ImageUpload.vue';

type El = HTMLElement & Record<string, unknown>;
type Image = { id: string; url: string };

const LOGO: Image = { id: '0192f0c4-logo', url: '/media/website/logo.png' };
const NEW: Image = { id: '0192f0c4-new', url: '/media/website/new.webp' };
const MIB = 1024 * 1024;

// What `createShell` does at boot: `ion:` icons paint by name from this registry.
addIcons(ION_ICONS);

function mountUpload(props: Record<string, unknown> = {}, locale = 'en') {
  return mount(ImageUpload, {
    props: { modelValue: null, label: 'Logo', upload: vi.fn(() => Promise.resolve(NEW)), testid: 'logo', ...props },
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })] },
  });
}

type Wrapper = ReturnType<typeof mountUpload>;

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await nextTick();
    await flushPromises();
  }
}

const part = (w: Wrapper, name: string) => w.find(`[data-testid="logo-${name}"]`);
const fileInput = (w: Wrapper) => part(w, 'file').element as HTMLInputElement;
const text = (w: Wrapper, name: string) => (part(w, name).element.textContent ?? '').replace(/\s+/g, ' ').trim();
const disabled = (w: Wrapper, name: string) => (part(w, name).element as El).disabled === true;

function imageFile(name = 'logo.png', type = 'image/png', bytes = 1024): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

/** What the system picker hands over: the file in `files` (and its fake path in `value`), then
 *  `change`. */
async function choose(w: Wrapper, file: File | null) {
  const input = fileInput(w);
  let value = file ? `C:\\fakepath\\${file.name}` : '';
  Object.defineProperty(input, 'files', { value: file ? [file] : [], configurable: true });
  Object.defineProperty(input, 'value', { get: () => value, set: (next: string) => (value = next), configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('ImageUpload: what it paints', () => {
  it('empty: a placeholder, the label, «No image yet» with the rules, «Choose image» and no Remove', async () => {
    const w = mountUpload();
    await settle();
    expect(part(w, 'empty').exists()).toBe(true);
    expect(part(w, 'empty').find('ion-icon').exists()).toBe(true);
    expect(part(w, 'image').exists()).toBe(false);
    expect(text(w, 'label')).toBe('Logo');
    expect(text(w, 'status')).toBe('No image yet');
    expect(text(w, 'rules')).toBe('JPEG, PNG, or WebP, up to 5 MB');
    expect(text(w, 'choose')).toBe('Choose image');
    expect(part(w, 'remove').exists()).toBe(false);
    expect(part(w, 'error').exists()).toBe(false);
    expect(part(w, 'loading').exists()).toBe(false);
  });

  it('the file picker is hidden and offers only the accepted types', async () => {
    const w = mountUpload();
    await settle();
    expect(fileInput(w).type).toBe('file');
    expect(fileInput(w).hidden).toBe(true);
    expect(fileInput(w).accept).toBe('image/jpeg,image/png,image/webp');
    const svg = mountUpload({ accept: 'image/svg+xml,image/png', maxBytes: 300 * 1024 });
    await settle();
    expect(fileInput(svg).accept).toBe('image/svg+xml,image/png');
    expect(text(svg, 'rules')).toBe('SVG or PNG, up to 300 kB');
  });

  it('with an image: its thumbnail, named by the label, «Replace image» and Remove', async () => {
    const w = mountUpload({ modelValue: LOGO });
    await settle();
    const img = part(w, 'image').element as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(LOGO.url);
    expect(img.getAttribute('alt')).toBe('Logo');
    expect(part(w, 'empty').exists()).toBe(false);
    expect(text(w, 'status')).toBe('');
    expect(text(w, 'choose')).toBe('Replace image');
    expect(text(w, 'remove')).toBe('Remove');
  });

  it('an image that cannot be shown leaves the placeholder and says so', async () => {
    const w = mountUpload({ modelValue: LOGO });
    await settle();
    part(w, 'image').element.dispatchEvent(new Event('error'));
    await settle();
    expect(part(w, 'image').exists()).toBe(false);
    expect(part(w, 'empty').exists()).toBe(true);
    expect(text(w, 'status')).toBe('The image could not be shown');
    // A new image is tried again.
    await w.setProps({ modelValue: NEW });
    await settle();
    expect(part(w, 'image').attributes('src')).toBe(NEW.url);
    expect(text(w, 'status')).toBe('');
  });

  it('a family in `accept` speaks of the size only', async () => {
    const w = mountUpload({ accept: 'image/*' });
    await settle();
    expect(text(w, 'rules')).toBe('Up to 5 MB');
  });
});

describe('ImageUpload: choosing a file', () => {
  it('«Choose image» opens the file picker', async () => {
    const w = mountUpload();
    await settle();
    const click = vi.spyOn(fileInput(w), 'click').mockImplementation(() => {});
    await part(w, 'choose').trigger('click');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('the chosen file goes to `upload`, its answer is the new value, and the picker is ready again', async () => {
    const upload = vi.fn(() => Promise.resolve(NEW));
    const w = mountUpload({ upload });
    await settle();
    const file = imageFile();
    await choose(w, file);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(file);
    expect(w.emitted('update:modelValue')).toEqual([[NEW]]);
    expect(fileInput(w).value).toBe('');
  });

  it('a picker closed without a file does nothing', async () => {
    const upload = vi.fn(() => Promise.resolve(NEW));
    const w = mountUpload({ upload });
    await settle();
    await choose(w, null);
    expect(upload).not.toHaveBeenCalled();
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });

  it('while it uploads: a spinner, «Uploading…», the buttons wait; then they come back', async () => {
    let finish!: (image: Image) => void;
    const upload = vi.fn(() => new Promise<Image>((resolve) => (finish = resolve)));
    const w = mountUpload({ modelValue: LOGO, upload });
    await settle();
    await choose(w, imageFile());
    expect(part(w, 'loading').exists()).toBe(true);
    expect(part(w, 'loading').element.tagName).toBe('ION-SPINNER');
    expect(text(w, 'status')).toBe('Uploading…');
    expect(part(w, 'status').attributes('role')).toBe('status');
    expect(disabled(w, 'choose')).toBe(true);
    expect(disabled(w, 'remove')).toBe(true);
    // Nothing starts twice meanwhile.
    const click = vi.spyOn(fileInput(w), 'click').mockImplementation(() => {});
    await part(w, 'choose').trigger('click');
    await part(w, 'remove').trigger('click');
    expect(click).not.toHaveBeenCalled();
    expect(w.emitted('update:modelValue')).toBeUndefined();
    finish(NEW);
    await settle();
    expect(part(w, 'loading').exists()).toBe(false);
    expect(disabled(w, 'choose')).toBe(false);
    expect(text(w, 'status')).toBe('');
    expect(w.emitted('update:modelValue')).toEqual([[NEW]]);
  });

  it('a file over `maxBytes` is refused here, with the limit in words', async () => {
    const upload = vi.fn(() => Promise.resolve(NEW));
    const w = mountUpload({ upload });
    await settle();
    await choose(w, imageFile('big.png', 'image/png', 5 * MIB + 1));
    expect(upload).not.toHaveBeenCalled();
    expect(text(w, 'error')).toBe('The image is larger than 5 MB. Choose a smaller one.');
    expect(part(w, 'error').attributes('role')).toBe('alert');
    expect(w.emitted('update:modelValue')).toBeUndefined();
    // Exactly the limit goes.
    await choose(w, imageFile('edge.png', 'image/png', 5 * MIB));
    expect(upload).toHaveBeenCalledTimes(1);
    expect(part(w, 'error').exists()).toBe(false);
  });

  it('a file of another type is refused here, naming the ones that go', async () => {
    const upload = vi.fn(() => Promise.resolve(NEW));
    const w = mountUpload({ upload });
    await settle();
    await choose(w, imageFile('menu.pdf', 'application/pdf'));
    expect(upload).not.toHaveBeenCalled();
    expect(text(w, 'error')).toBe('That file type is not allowed. Choose a JPEG, PNG, or WebP file.');
    const any = mountUpload({ upload, accept: 'image/*' });
    await settle();
    await choose(any, imageFile('menu.pdf', 'application/pdf'));
    expect(upload).not.toHaveBeenCalled();
    expect(text(any, 'error')).toBe('That file type is not allowed.');
  });

  it('a rejected upload paints its message and keeps the value', async () => {
    const upload = vi.fn(() => Promise.reject(new Error('The image is too large for the server.')));
    const w = mountUpload({ modelValue: LOGO, upload });
    await settle();
    await choose(w, imageFile());
    expect(text(w, 'error')).toBe('The image is too large for the server.');
    expect(w.emitted('update:modelValue')).toBeUndefined();
    expect(part(w, 'loading').exists()).toBe(false);
    expect(disabled(w, 'choose')).toBe(false);
    expect(part(w, 'image').attributes('src')).toBe(LOGO.url);
  });

  it('a rejection without a message says it could not be uploaded', async () => {
    const w = mountUpload({ upload: vi.fn(() => Promise.reject(new Error(''))) });
    await settle();
    await choose(w, imageFile());
    expect(text(w, 'error')).toBe('The image could not be uploaded. Try again.');
    const odd = mountUpload({ upload: vi.fn(() => Promise.reject('offline')) });
    await settle();
    await choose(odd, imageFile());
    expect(text(odd, 'error')).toBe('The image could not be uploaded. Try again.');
  });

  it('a new choice clears the last error', async () => {
    const w = mountUpload();
    await settle();
    await choose(w, imageFile('menu.pdf', 'application/pdf'));
    expect(part(w, 'error').exists()).toBe(true);
    await choose(w, imageFile());
    expect(part(w, 'error').exists()).toBe(false);
    expect(w.emitted('update:modelValue')).toEqual([[NEW]]);
  });
});

describe('ImageUpload: removing and disabled', () => {
  it('Remove empties the value and clears an error', async () => {
    const w = mountUpload({ modelValue: LOGO });
    await settle();
    await choose(w, imageFile('menu.pdf', 'application/pdf'));
    await part(w, 'remove').trigger('click');
    await settle();
    expect(w.emitted('update:modelValue')).toEqual([[null]]);
    expect(part(w, 'error').exists()).toBe(false);
  });

  it('disabled: the buttons and the picker wait, and nothing is emitted', async () => {
    const upload = vi.fn(() => Promise.resolve(NEW));
    const w = mountUpload({ modelValue: LOGO, upload, disabled: true });
    await settle();
    expect(disabled(w, 'choose')).toBe(true);
    expect(disabled(w, 'remove')).toBe(true);
    expect(fileInput(w).disabled).toBe(true);
    const click = vi.spyOn(fileInput(w), 'click').mockImplementation(() => {});
    await part(w, 'choose').trigger('click');
    await part(w, 'remove').trigger('click');
    await choose(w, imageFile());
    expect(click).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });
});

describe('ImageUpload: Spanish', () => {
  it('speaks Spanish, the lists and sizes too', async () => {
    const w = mountUpload({}, 'es');
    await settle();
    expect(text(w, 'status')).toBe('Todavía no hay imagen');
    expect(text(w, 'rules')).toBe('JPEG, PNG o WebP, hasta 5 MB');
    expect(text(w, 'choose')).toBe('Elegir imagen');
    await choose(w, imageFile('menu.pdf', 'application/pdf'));
    expect(text(w, 'error')).toBe('Ese tipo de archivo no se admite. Elige un archivo JPEG, PNG o WebP.');
    await choose(w, imageFile('big.png', 'image/png', 6 * MIB));
    expect(text(w, 'error')).toBe('La imagen ocupa más de 5 MB. Elige una más pequeña.');
    const full = mountUpload({ modelValue: LOGO, upload: vi.fn(() => Promise.reject(new Error(''))) }, 'es');
    await settle();
    expect(text(full, 'choose')).toBe('Cambiar imagen');
    expect(text(full, 'remove')).toBe('Quitar');
    await choose(full, imageFile());
    expect(text(full, 'error')).toBe('No se ha podido subir la imagen. Inténtalo de nuevo.');
  });
});
