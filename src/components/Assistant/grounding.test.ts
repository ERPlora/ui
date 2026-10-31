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

// Real answers of the QA battery of 2026-10-31 (B25 «¿Cómo abro y cierro la caja?», B21 «¿Cómo doy de alta a un empleado
// con su PIN?»): instructions read from the docs, no write in the turn. B25 showed «claimed a change».
const HOW_TO_CASH_REGISTER = [
  'Abrir y cerrar la caja',
  'Abrir la caja',
  'Ve a Caja › Caja.',
  'Pulsa «Abrir sesión».',
  'Si tienes varios cajones, elige cuál (si solo hay uno, se selecciona solo).',
  'Escribe el fondo de apertura (el efectivo con el que empiezas, p. ej. 150,50). Si está vacío, cuenta como 0.',
  'Añade notas si quieres y pulsa «Abrir sesión».',
  '',
  '> ⚠️ Solo puede haber una sesión abierta a la vez. Si ya hay una abierta, debes cerrarla antes.',
  '',
  '---',
  '',
  'Cerrar la caja',
  'Ve a Caja › Caja.',
  'Pulsa «Cerrar sesión».',
  'Introduce el recuento de cierre (el efectivo que hay realmente en el cajón).',
  'El sistema te muestra:',
  'Esperado: lo que debería haber según las ventas, entradas y salidas.',
  'Contado: lo que has introducido.',
  'Diferencia: contado − esperado (negativo = falta dinero).',
  'Confirma el cierre.',
  '',
  '> 📌 La sesión cerrada no se puede reabrir. La diferencia queda guardada para siempre.',
  '',
  '---',
  '',
  'Ajustes útiles',
  '',
  'Puedes configurar el comportamiento de la caja en Caja › Ajustes:',
  '',
  'Ajuste\tQué hace',
  'Exigir fondo de apertura\tObliga a indicar el fondo al abrir',
  'Exigir recuento al cierre\tObliga a contar el efectivo al cerrar',
  'Permitir saldo negativo\tPermite que una retirada deje la caja en negativo',
  'Arqueo ciego\tOculta el esperado a quien cierra (solo ve lo que cuenta)',
  'Cierre automático diario\tCierra sola la sesión olvidada a la hora que indiques',
  '',
  '¿Necesitas ayuda con algo más de la caja?',
].join('\n');
const HOW_TO_STAFF_PIN = [
  'Según la documentación, son dos cosas separadas:',
  '',
  '1. Dar de alta al empleado',
  '',
  'Se hace desde Personal › Personal:',
  '',
  'Pulsa + para abrir la ficha nueva.',
  'Rellena Nombre y Apellidos (obligatorios) y, opcionalmente, email, teléfono, rol, usuario del Hub, fecha de alta, color, especialidades, bio, tarifa por hora, comisión, etc.',
  'Pulsa Guardar: la persona aparece como Activa.',
  '',
  '> ⚠️ Una ficha de empleado no concede acceso al Hub automáticamente. La persona también necesita un usuario del Hub con un rol asignado.',
  '',
  '2. El PIN no se asigna al dar de alta',
  '',
  'El PIN de 4 dígitos lo crea cada usuario en su propio dispositivo de confianza, no el administrador:',
  '',
  'El empleado inicia sesión con su email y contraseña en el dispositivo.',
  'Selecciona "Confiar en este dispositivo".',
  'Elige y confirma un PIN de 4 dígitos.',
  'En accesos posteriores, selecciona su usuario e introduce el PIN.',
  '',
  '> El PIN es un método rápido para volver a entrar; no sustituye al email y la contraseña de la cuenta Cloud. Si el dispositivo deja de ser de confianza, hay que volver a iniciar sesión con email y contraseña.',
  '',
  'En resumen: tú creas la ficha del empleado y le asignas un usuario del Hub con su rol desde Personal, pero el PIN lo configura cada persona en su dispositivo al iniciar sesión por primera vez.',
].join('\n');

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

  it('a how-to answer read from the docs is no claim (QA battery 2026-10-31, B25 and B21)', () => {
    const docs = ran('ok', 'query');
    expect(notices(HOW_TO_CASH_REGISTER, [docs])).toEqual([]);
    expect(notices(HOW_TO_STAFF_PIN, [docs])).toEqual([]);
  });

  it('an instruction, or how things stay after a step, is no claim', () => {
    for (const answer of [
      'La diferencia queda guardada para siempre.',
      'Los cambios quedan guardados al momento.',
      'Pulsa Guardar y el cliente queda guardado.',
      'Pulsa «Guardar» y ya está creado.',
      'Toca Guardar; la ficha se ha creado y aparece en la lista.',
      'El precio se guarda al pulsar Guardar.',
      'Pulsa guardar.',
      'Si ya hay una abierta, la diferencia queda guardada.',
      'Pulsa Guardar y ahora queda guardado.',
      'Tap Save and the item has been created.',
      'Press Save: the price is now updated.',
      'Each change is saved.',
    ]) {
      expect(notices(answer), answer).toEqual([]);
    }
  });

  it('a step that may already be done, and what follows from it, is no claim', () => {
    for (const answer of [
      'Si ya está creado, pulsa Editar.',
      'Cuando se ha guardado, aparece en la lista.',
      'Una vez se ha creado el cliente puedes cobrarle.',
      'Si pulsas Guardar, ya está creado.',
      'Once the item has been created, it shows in the list.',
      'If it has been saved you will see it in the list.',
      'When you tap Save, the item is now saved.',
      'Cuando lo guardas, ya queda registrado.',
      'Si ya queda guardado, cierra la ficha.',
    ]) {
      expect(notices(answer), answer).toEqual([]);
    }
  });

  it('a change the answer says is done is still a claim', () => {
    for (const answer of [
      '¡Listo! El cliente queda guardado.',
      '¡Hecho!\n\nEl cliente queda guardado.',
      'Hecho: queda guardado.',
      'Ya queda guardado el precio.',
      'Done! The price is updated.',
      'All set: the item is saved.',
      'Ya está guardado; si quieres, pulsa Editar.',
      'Para cobrar, pulsa Cobrar. El precio se ha actualizado.',
      'Si quieres otro, dímelo. Ya está creado el cliente.',
    ]) {
      expect(notices(answer), answer).toEqual(['claimed_change']);
    }
  });

  it('the assistant saying what it did is a claim, even next to an instruction or a «cuando»', () => {
    for (const answer of [
      'He creado el cliente; ahora pulsa Cobrar.',
      'Pulsa Cobrar cuando quieras: he creado el cliente.',
      'Cuando lo pediste he creado el cliente.',
      'When you asked I created the customer.',
      'Tap Charge when you are ready: I have created the customer.',
    ]) {
      expect(notices(answer), answer).toEqual(['claimed_change']);
    }
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
