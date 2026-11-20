import { describe, expect, it } from 'vitest';

import { declined, notices, ran } from './__tests__/grounding';
import { groundingNotices } from './grounding';

const NOT_THROUGH = ['cancelled', 'error', 'refused'] as const;
// A real answer of the model: the person declined the card, nothing changed, and the answer told the change as done.
const SWITCHED_TO_DARK =
  "Switched to dark mode\n\nYour screen should now be darker and easier on the eyes at night. If you'd like to switch back later, just ask or go to your Account settings.";

describe('a change told as done after a write of the turn that did not go through (ui#67)', () => {
  it('the real answer after a declined card is flagged', () => {
    const found = groundingNotices({
      answer: SWITCHED_TO_DARK,
      executed: [declined('cancelled')],
      results: [],
      question: "everything's way too bright at night, can you darken this screen?",
      screenExists: () => true,
    });
    expect(found).toEqual(['claimed_change']);
  });

  it('a headline in the participle, with no one saying who did it, is a claim', () => {
    for (const answer of [
      'Switched to dark mode.',
      'Updated your theme.',
      'Created Café Triana.',
      'Created «Café Triana».',
      'Added 2 items to the order.',
      'Turned on dark mode.',
      '**Switched to dark mode**',
      '✅ Updated the price of Caña.',
      'Done — switched to dark mode.',
      'Cambiado a modo oscuro.',
      'Actualizado tu tema.',
      'Creado Café Triana.',
      'Activado el modo oscuro.',
      'Guardados los cambios.',
      'Listo: guardado el precio.',
    ]) {
      for (const outcome of NOT_THROUGH) {
        expect(notices(answer, [declined(outcome)]), `${answer} (${outcome})`).toEqual(['claimed_change']);
      }
    }
  });

  it('a headline is no claim when the write really ran', () => {
    for (const answer of [SWITCHED_TO_DARK, 'Switched to dark mode.', 'Created Café Triana.', 'Activado el modo oscuro.']) {
      expect(notices(answer, [declined('ok')]), answer).toEqual([]);
    }
  });

  it('a participle in a turn with no write tried reads back what happened before, not a claim', () => {
    const read = ran('ok', 'query');
    expect(notices('Created Café Triana on 3 November. Updated your theme yesterday.', [read])).toEqual([]);
    expect(notices('Switched to dark mode on 2 November.')).toEqual([]);
  });

  it('how a record reads, or a participle with no object, is no headline', () => {
    for (const answer of [
      'Cancelled: nothing changed.',
      'Not switched: you cancelled it.',
      'Updated every night at 3:00.',
      'Created by the owner.',
      'Created on 3 November.',
      'Created: 3 November 2026.',
      'Deleted customers can be restored from the bin.',
      'Saved changes apply at once.',
      'Updated a few minutes ago.',
      'Closed on Sundays.',
      'Closed Sundays and public holidays.',
      'Actualizado a diario.',
      'Actualizado a las 3:00.',
      'Creado por el propietario.',
      'Guardados automáticamente.',
      'Una vez creada la factura, ya no se puede editar.',
      'Cerrado los domingos.',
    ]) {
      expect(notices(answer, [declined('cancelled')]), answer).toEqual([]);
    }
  });

  it('what the person should now see is a claim', () => {
    for (const answer of [
      'Your screen should now be darker.',
      'Now your screen should look darker.',
      'Tu pantalla ya debería verse más oscura.',
      'La pantalla debería verse ahora más oscura.',
      'Ahora la pantalla debería estar en modo oscuro.',
    ]) {
      for (const outcome of NOT_THROUGH) {
        expect(notices(answer, [declined(outcome)]), `${answer} (${outcome})`).toEqual(['claimed_change']);
      }
    }
  });

  it('what the person should now see is no claim when the write ran, or when no write was tried', () => {
    expect(notices('Your screen should now be darker.', [declined('ok')])).toEqual([]);
    expect(notices('Tu pantalla ya debería verse más oscura.', [declined('ok')])).toEqual([]);
    expect(notices('Reload the page. It should now work.', [ran('ok', 'query')])).toEqual([]);
    expect(notices('It should now work.')).toEqual([]);
    expect(notices('Ahora debería funcionar.')).toEqual([]);
  });

  it('a denial, a supposition, a step, advice or things as they were is no effect of a change', () => {
    for (const answer of [
      'Your screen should not be darker now.',
      "Your screen shouldn't be darker now.",
      'Nothing should now be different.',
      'If you change it in Account, your screen should now be darker.',
      'Tap Dark in Account: your screen should now be darker.',
      'Go to Account and choose Dark. Your screen should now be darker.',
      'You should now go to Account if you want to change it yourself.',
      'Now you should go to Account if you want to change it yourself.',
      'Your screen should be darker at night.',
      'Everything should now be as it was.',
      'Your theme should now still be light.',
      "Now that's undone it should look light again.",
      'La pantalla ya no debería cambiar.',
      'Si lo cambias en Cuenta, la pantalla debería verse ahora más oscura.',
      'Ve a Cuenta y elige Oscuro. La pantalla ya debería verse más oscura.',
      'Ahora deberías ir a Cuenta si quieres cambiarlo.',
      'La pantalla debería verse más oscura de noche.',
      'Ahora todo debería seguir igual.',
      'Ahora que lo cancelaste debería verse clara.',
    ]) {
      expect(notices(answer, [declined('cancelled')]), answer).toEqual([]);
    }
  });

  it('an honest answer after a write that did not go through is no claim (es and en)', () => {
    for (const answer of [
      // When a record was made or changed: how it reads, no headline.
      'Ya tienes Café Triana, creado el 3 de noviembre.',
      'No se puede modificar. Creada el 2 de noviembre.',
      'Creado 3 de noviembre de 2026.',
      'Actualizado el lunes por Ana.',
      'Actualizado esta mañana.',
      'Creado este mes.',
      'Actualizada la semana pasada.',
      'Created this morning by you.',
      'Updated last week.',
      'Updated 3 days ago.',
      'Updated 12 minutes ago.',
      'Created 3 November 2026.',
      'Created 03/11/2026.',
      // Things as they stay.
      'Your theme should now stay light.',
      'Everything should now remain as it is.',
      'Ahora todo debería quedar como está.',
      'Ya debería quedarse así.',
      'Tu tema ya debería mantenerse claro.',
      // A step to try again before what should happen.
      'Please try again; it should now work.',
      'Reload the page. It should now work.',
      'Inténtalo de nuevo: ya debería funcionar.',
      'Vuelve a intentarlo. Ahora debería funcionar.',
      'Vuelva a intentarlo; ahora debería funcionar.',
      'Inténtelo de nuevo: ya debería funcionar.',
      'Recarga la página. Ya debería funcionar.',
      'Recargue la página. Ya debería funcionar.',
      'Refresh the screen: it should now work.',
      'Retry in a minute; it should now go through.',
      // A question.
      'No problem! Changed your mind? Just ask and I will do it.',
      '¿Cambiado de opinión? Pídemelo cuando quieras.',
      'Now what should I change instead?',
    ]) {
      for (const outcome of NOT_THROUGH) {
        expect(notices(answer, [declined(outcome)]), `${answer} (${outcome})`).toEqual([]);
      }
    }
  });

  it('a headline that names when, or takes a number, is still a claim when it says what changed', () => {
    for (const answer of [
      "Updated this month's menu.",
      'Añadidos 2 productos al pedido.',
      'Changed the price to 2.80 € this morning.',
      'Activado el modo oscuro esta mañana.',
    ]) {
      expect(notices(answer, [declined('cancelled')]), answer).toEqual(['claimed_change']);
    }
  });
});
