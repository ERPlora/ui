import { describe, expect, it } from 'vitest';

import { ID, notices } from './__tests__/grounding';

// The answer of a change of VAT that listed three pages as its sources with no search in the turn.
const INVENTED = [
  'I will keep 10% until 31 December and schedule 21% from 1 January 2027.',
  '',
  '- https://sede.agenciatributaria.gob.es/Sede/iva/calculo-iva-repercutido-clientes/tipos-impositivos-iva.html',
  '- https://www.consultorhosteleria.es/blog/iva-hosteleria/',
  '- https://palenciaasesores.es/iva-restaurante-hosteleria/',
].join('\n');
const LAW = 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-0190';

describe('a web address of the answer', () => {
  it('that nothing of the turn returned and the person did not write is flagged', () => {
    expect(notices(INVENTED, [], { sources: [] })).toEqual(['unread_link']);
    expect(notices(`Lo dice el BOE: ${LAW}`, [], { sources: [] })).toEqual(['unread_link']);
  });

  it('that a tool of the host returned is no unread link', () => {
    for (const answer of [`Lo dice el BOE: ${LAW}`, `Lo dice [el BOE](${LAW}).`, `Fuente: <${LAW}>`, `Según el BOE.\n\n${LAW}`]) {
      expect(notices(answer, [], { sources: [LAW] }), answer).toEqual([]);
    }
  });

  it('that a tool of the turn returned, or the person wrote, is no unread link', () => {
    expect(notices(`Tu web es ${LAW}.`, [], { sources: [], results: [`{"web":"${LAW}"}`] })).toEqual([]);
    expect(notices(`Sí, ${LAW} es la del BOE.`, [], { sources: [], question: `¿Qué es ${LAW}?` })).toEqual([]);
  });

  it('is the page consulted when only how it is written changes', () => {
    for (const answer of [
      'Lo dice https://www.boe.es/doc/',
      'Lo dice http://boe.es/doc',
      'Lo dice www.boe.es/doc',
      'Lo dice HTTPS://WWW.BOE.ES/doc',
      'Lo dice https://www.boe.es',
    ]) {
      expect(notices(answer, [], { sources: ['https://boe.es/doc'] }), answer).toEqual([]);
    }
  });

  it('is the page consulted inside the marks of the Markdown around it', () => {
    for (const answer of ['**https://boe.es/doc**', '*https://boe.es/doc*', '`https://boe.es/doc`', '| BOE | https://boe.es/doc|']) {
      expect(notices(answer, [], { sources: ['https://boe.es/doc'] }), answer).toEqual([]);
      expect(notices(answer, [], { sources: ['https://boe.es/otro'] }), answer).toEqual(['unread_link']);
    }
  });

  it('of another page of the site consulted is flagged', () => {
    expect(notices('Lo dice https://boe.es/otro', [], { sources: ['https://boe.es/doc'] })).toEqual(['unread_link']);
  });

  it('goes unchecked when the host does not say what its own tools consulted', () => {
    expect(notices(INVENTED)).toEqual([]);
  });

  it('is no screen of the app: a link to a screen is checked as a screen', () => {
    expect(notices('Ve a [Impuestos](/tax/) para verlo.', [], { sources: [] })).toEqual([]);
  });

  it('is flagged beside an identifier nothing returned', () => {
    expect(notices(`El cliente ${ID} sale en ${LAW}`, [], { sources: [] })).toEqual(['unread_id', 'unread_link']);
  });
});
