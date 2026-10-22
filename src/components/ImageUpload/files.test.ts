// The file rules of ImageUpload: whether a chosen file matches the `accept` list (the same syntax as
// `<input type="file" accept>`), the names a person reads for that list, and the size limit in words.
import { describe, expect, it } from 'vitest';

import { acceptedTypeNames, acceptsFile, formatFileSize, formatTypeList } from './files';

const file = (name: string, type: string) => ({ name, type });

describe('acceptsFile', () => {
  it('takes exactly the MIME types listed, in any case and with spaces around', () => {
    const accept = 'image/jpeg, image/PNG ,image/webp';
    expect(acceptsFile(file('a.jpg', 'image/jpeg'), accept)).toBe(true);
    expect(acceptsFile(file('a.png', 'image/png'), accept)).toBe(true);
    expect(acceptsFile(file('a.webp', 'IMAGE/WEBP'), accept)).toBe(true);
    expect(acceptsFile(file('a.gif', 'image/gif'), accept)).toBe(false);
    expect(acceptsFile(file('a.pdf', 'application/pdf'), accept)).toBe(false);
    expect(acceptsFile(file('a', ''), accept)).toBe(false);
  });

  it('a `type/*` entry takes the whole family', () => {
    expect(acceptsFile(file('a.gif', 'image/gif'), 'image/*')).toBe(true);
    expect(acceptsFile(file('a.mp4', 'video/mp4'), 'image/*')).toBe(false);
  });

  it('an extension entry looks at the file name, in any case', () => {
    expect(acceptsFile(file('Logo.PNG', ''), '.png')).toBe(true);
    expect(acceptsFile(file('logo.png.exe', ''), '.png')).toBe(false);
  });

  it('an empty list takes any file', () => {
    expect(acceptsFile(file('a.bin', 'application/octet-stream'), '')).toBe(true);
    expect(acceptsFile(file('a.bin', 'application/octet-stream'), ' , ')).toBe(true);
  });
});

describe('acceptedTypeNames', () => {
  it('names the usual image formats the way people know them, once each', () => {
    expect(acceptedTypeNames('image/jpeg,image/png,image/webp')).toEqual(['JPEG', 'PNG', 'WebP']);
    expect(acceptedTypeNames('image/jpeg,.jpg,.jpeg,image/svg+xml,image/gif,.avif')).toEqual(['JPEG', 'SVG', 'GIF', 'AVIF']);
  });

  it('any other type by its subtype or extension, in capitals', () => {
    expect(acceptedTypeNames('image/heic,.tiff')).toEqual(['HEIC', 'TIFF']);
  });

  it('a family or an empty list has no names: anything of it goes', () => {
    expect(acceptedTypeNames('image/*')).toEqual([]);
    expect(acceptedTypeNames('image/png,image/*')).toEqual([]);
    expect(acceptedTypeNames('')).toEqual([]);
  });
});

describe('formatTypeList', () => {
  it('joins the names as «one or the other», in the language of the page', () => {
    expect(formatTypeList(['JPEG', 'PNG', 'WebP'], 'en')).toBe('JPEG, PNG, or WebP');
    expect(formatTypeList(['JPEG', 'PNG', 'WebP'], 'es-ES')).toBe('JPEG, PNG o WebP');
    expect(formatTypeList(['PNG'], 'es')).toBe('PNG');
  });
});

describe('formatFileSize', () => {
  it('megabytes from 1 MiB, kilobytes below, in the language of the page', () => {
    expect(formatFileSize(5 * 1024 * 1024, 'en')).toBe('5 MB');
    expect(formatFileSize(1.5 * 1024 * 1024, 'en')).toBe('1.5 MB');
    expect(formatFileSize(1.5 * 1024 * 1024, 'es')).toBe('1,5 MB');
    expect(formatFileSize(300 * 1024, 'en')).toBe('300 kB');
    expect(formatFileSize(512, 'en')).toBe('0.5 kB');
  });
});
