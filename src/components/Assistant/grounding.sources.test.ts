import { describe, expect, it } from 'vitest';

import { declined, ID, notices } from './__tests__/grounding';

// An answer built on what erplora.com's own tools found (web search and currency rates, ui#92).
// Their results stay on the server, and the panel reads only the addresses they consulted (`done.sources`): the answer
// names its sources by their web address, written by the model or by the gateway under it (`server_tools.source_line`:
// a blank line, then one address per line).
const LAW = 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-0190';
const SOURCE_ID = '0190a3b4-1111-7222-8333-444455556666';

describe('an identifier in a web address (ui#92)', () => {
  it('is no identifier of the business', () => {
    for (const answer of [
      `Dice la ley.\n\nhttps://example.com/doc/${SOURCE_ID}`,
      `Lo publica el BOE (https://www.boe.es/doc/${SOURCE_ID}).`,
      `Lo explica [la AEAT](https://sede.agenciatributaria.gob.es/${SOURCE_ID}?lang=es).`,
      `Fuente: www.example.com/${SOURCE_ID}`,
      `Fuente: <http://example.com/${SOURCE_ID}>`,
    ]) {
      expect(notices(answer, [], { question: 'x' }), answer).toEqual([]);
    }
  });

  it('one written outside the address is still flagged', () => {
    for (const answer of [
      `El cliente es ${ID}.\n\nhttps://example.com/doc/${SOURCE_ID}`,
      `https://example.com/doc ${ID}`,
      `Abre [la venta](/sales/${ID}).`,
    ]) {
      expect(notices(answer), answer).toEqual(['unread_id']);
    }
  });
});

describe('what a source says (ui#92)', () => {
  it('a change the answer reports from a source it names is no claim', () => {
    for (const answer of [
      'La ley se ha modificado este año, según el BOE.',
      'Según el BOE, el tipo reducido se ha modificado este año.',
      'De acuerdo con la AEAT, el modelo 303 se ha actualizado para 2027.',
      'El BOE publica que la ley se ha modificado.',
      'La AEAT informa de que el plazo se ha cambiado.',
      'According to the BOE, the law has been changed this year.',
      'The AEAT says the form has been updated.',
      'As reported by Reuters, the rate has been updated.',
      'Según el BOE, ya queda actualizada la norma.',
      'Conforme a la orden, el tipo se ha actualizado.',
      'La orden recoge que el tipo se ha modificado.',
      'Hacienda indica que el plazo se ha cambiado.',
      'La guía explica que el modelo se ha actualizado.',
      'La web dice que la tarifa se ha actualizado.',
      'El ministerio señala que la norma se ha modificado.',
      'El Gobierno anuncia que el tipo se ha cambiado.',
      'El artículo afirma que la ley se ha modificado.',
      'La orden establece que el modelo se ha actualizado.',
      'As published in the BOE, the rate has been updated.',
      'As stated by the AEAT, the form has been changed.',
      'The BOE states that the law has been changed.',
      'The guide explains that the form has been updated.',
      'The ministry announced that the rate has been changed.',
      'The government announces that VAT has been updated.',
      'The BOE published that the rule has been modified.',
      'The BOE publishes that the rule has been modified.',
      'The AEAT indicates that the deadline has been changed.',
      'The AEAT reports that the form has been updated.',
    ]) {
      expect(notices(answer), answer).toEqual([]);
    }
  });

  it('a change reported in an answer that gives its web sources is no claim', () => {
    for (const answer of [
      `La ley de la factura electrónica se ha modificado este año.\n\n${LAW}`,
      `La ley se ha modificado.\n\n${LAW}\nhttps://sede.agenciatributaria.gob.es/`,
      `El tipo general del IVA se ha actualizado (${LAW}).`,
      'The VAT rules have been updated for 2027.\n\nSource: https://taxation-customs.ec.europa.eu/vat',
      `Los tipos se han actualizado este año.\n\n**Fuentes:**\n- ${LAW}\n- https://sede.agenciatributaria.gob.es/`,
      `La norma se ha actualizado.\n\n1. ${LAW}`,
      `La norma se ha actualizado.\n\n• ${LAW}`,
      `La norma se ha actualizado.\n\n**Fuente:** ${LAW}`,
      `La norma se ha actualizado.\n\nFuente: [BOE](${LAW})`,
      `La norma se ha actualizado.\n\nFuente: <${LAW}>`,
    ]) {
      expect(notices(answer), answer).toEqual([]);
    }
  });

  it('the assistant saying what it did is still a claim, sources or not', () => {
    for (const answer of [
      'He actualizado el precio, según la web del proveedor.',
      `He cambiado el precio del producto.\n\n${LAW}`,
      "I've updated the price, according to the supplier's site.",
    ]) {
      expect(notices(answer), answer).toEqual(['claimed_change']);
    }
  });

  it('a change with no source in its sentence, in an answer that does not close with its sources, is still a claim', () => {
    for (const answer of [
      'Según el BOE, el IVA general es del 21 %. El precio se ha actualizado.',
      'Puedes ver las tarifas en https://stripe.com/es/pricing. Se ha guardado tu clave.',
      'La ley cambió: https://www.boe.es/doc. El precio se ha actualizado.',
      `El precio se ha actualizado.\n\n${LAW}\n\nSi quieres, pulsa Editar.`,
      'The notes have been saved.',
      'The reports have been updated.',
    ]) {
      expect(notices(answer), answer).toEqual(['claimed_change']);
    }
  });

  it('a write of the turn that did not go through is still told as done, sources or not (ui#67)', () => {
    expect(notices('Switched to dark mode\n\nhttps://support.example.com/dark-mode', [declined('cancelled')])).toEqual([
      'claimed_change',
    ]);
  });
});
