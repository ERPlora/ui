// BASE-G117: what the assistant says, checked against what really ran in the turn (gh:hub#1039). Cases of the old
// hub's `assistant-grounding.test.ts` and `assistant-claims.test.ts`.
import { describe, expect, it } from 'vitest';

import { type Executed, groundingNotices } from './grounding';

const ran = (outcome: Executed['outcome'], kind: Executed['kind'] = 'command'): Executed => ({
  name: 'demo.item.create',
  kind,
  outcome,
});
const ID = '0193e1c2-7a4b-7c3d-9e8f-0a1b2c3d4e5f';

function notices(answer: string, executed: Executed[] = [], extra: { results?: string[]; question?: string } = {}) {
  return groundingNotices({ answer, executed, results: extra.results ?? [], question: extra.question ?? '', screenExists: () => true });
}

describe('a change claimed', () => {
  it('is flagged when no write ran at all', () => {
    expect(notices('He creado el elemento Mesa 4.')).toEqual(['claimed_change']);
  });

  it('stays silent when the write really ran', () => {
    expect(notices('He creado el elemento Mesa 4.', [ran('ok')])).toEqual([]);
  });

  it('a cancelled, failed or refused write had no effect', () => {
    for (const outcome of ['cancelled', 'error', 'refused'] as const) {
      expect(notices('Listo, queda guardado.', [ran(outcome)])).toEqual(['claimed_change']);
    }
  });

  it('a read that ran is no write', () => {
    expect(notices('Se ha actualizado el precio.', [ran('ok', 'query')])).toEqual(['claimed_change']);
  });

  it('is caught in English as well', () => {
    expect(notices('The item has been created.')).toEqual(['claimed_change']);
    expect(notices("I've updated the price.")).toEqual(['claimed_change']);
  });

  it('an ordinary answer is left alone', () => {
    expect(notices('Tienes 3 elementos abiertos.')).toEqual([]);
    expect(notices('¿Quieres que lo cree?')).toEqual([]);
  });

  it('a denial after a declined card is no claim', () => {
    expect(notices('No he creado el negocio: no ha cambiado nada.', [ran('cancelled')])).toEqual([]);
    expect(notices('I did not create the business: nothing changed.', [ran('cancelled')])).toEqual([]);
  });

  it('a negation before the verb, in Spanish or English, is no claim', () => {
    for (const answer of [
      'No se ha modificado nada.',
      'El negocio no se ha creado.',
      'Todavía no lo he creado.',
      'Ningún cambio se ha guardado.',
      'No lo he hecho.',
      "I haven't changed anything.",
      'I haven’t changed anything.',
      'Nothing was created.',
      'Nothing has been created.',
      'No item has been deleted.',
      'Nada se ha guardado.',
      'Nunca he borrado ese cliente.',
      'Tampoco he borrado nada.',
      "I'm not sure it has been saved.",
      "I don't think it has been saved.",
      'I never said the price has been updated.',
      'None of the items has been deleted.',
    ]) {
      expect(notices(answer), answer).toEqual([]);
    }
  });

  it('a claim of a change is still caught', () => {
    for (const answer of [
      'He creado el negocio.',
      'I created the business.',
      'We added the item.',
      'I’ve updated the price.',
      'Listo, ya está creado.',
      'Done: the price is updated.',
      'The item is now saved.',
    ]) {
      expect(notices(answer), answer).toEqual(['claimed_change']);
    }
  });

  it('a positive clause after a denial is a claim', () => {
    for (const answer of [
      'No he creado el negocio, pero he actualizado el precio.',
      'No he creado el negocio pero he actualizado el precio.',
      'I did not create the business, but I updated the price.',
      'No problem — I’ve created it.',
      'No te preocupes, he guardado el precio.',
      'No hay problema: he guardado el precio.',
      'No había nada; he guardado el precio.',
    ]) {
      expect(notices(answer), answer).toEqual(['claimed_change']);
    }
  });

  it('a negation after the verb leaves the claim standing', () => {
    expect(notices('He creado el negocio y no queda nada pendiente.')).toEqual(['claimed_change']);
    expect(notices("I've updated the price and nothing else.")).toEqual(['claimed_change']);
  });

  it('«sin» or «without» before the verb is no denial', () => {
    expect(notices('Sin problemas se ha guardado el precio.')).toEqual(['claimed_change']);
    expect(notices('Without any trouble I have saved the price.')).toEqual(['claimed_change']);
  });

  it('a state described in the present is no claim', () => {
    expect(notices('The price is updated every night.')).toEqual([]);
  });
});

describe('an identifier', () => {
  it('that the turn never read is flagged', () => {
    expect(notices(`El elemento es ${ID}.`, [ran('ok', 'query')], { results: ['{"rows": []}'] })).toEqual(['unread_id']);
  });

  it('that a tool really returned is accepted', () => {
    expect(notices(`El elemento es ${ID}.`, [ran('ok', 'query')], { results: [`{"id": "${ID}"}`] })).toEqual([]);
  });

  it('that the person wrote is accepted', () => {
    expect(notices(`Busco ${ID}.`, [], { question: `¿Qué es ${ID}?` })).toEqual([]);
  });

  it('ordinary words and numbers are no identifiers', () => {
    expect(notices('Vendiste 1234 cañas el 2026-10-24 en la mesa 4.')).toEqual([]);
  });
});

describe('a screen', () => {
  it('that this app does not serve is flagged', () => {
    const found = groundingNotices({
      answer: 'Ve a [Informes](/reports) o a [Ajustes](/settings).',
      executed: [],
      results: [],
      question: '',
      screenExists: (path) => path === '/settings',
    });
    expect(found).toEqual(['unknown_screen']);
  });

  it('that it serves is accepted', () => {
    expect(notices('Ve a [Ajustes](/settings).')).toEqual([]);
  });
});
