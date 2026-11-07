<script setup lang="ts">
// MoneyInput — the one field an amount is typed in (a price, a cost, a supplement, a payment, a rule's amount), the
// same in every form, the way Square, Shopify and Odoo take one: a text field with the decimal keyboard.
//   <MoneyInput v-model="form.price" :label="t('pricing.price')" testid="price" :money="money" />
// Contract:
//   - `v-model` is the text, as typed («22,50», «1.234,56», «22,50 €» pasted from the screen); the form reads the
//     minor units with `parseMoney(text, { money, signed })` when it saves and writes a stored amount back with
//     `moneyFieldText` (both exported next to it).
//   - `money` is the field's currency with its decimals (the business's, `useBusinessMoney`; a price list's, its own).
//     Its code or its symbol around the figure is read, another currency's is not; at most its decimals (none in yen).
//   - On leaving, a readable amount is rewritten in the page format («2.2» → «2,20»). What is not an amount says so
//     under the field once the person leaves it, or with `showError` (after a save attempt); «1.250» says both
//     readings. The server's message for the field (`errorText`) wins.
//   - Until `money` is known the field neither rewrites nor judges what was typed: «150» is not made «150.00» (the yen
//     has no decimals) and «¥1500» or «12,50 zł» are not «not an amount» before the business says its currency
//     (hub#918, hub#921, hub#945). Once it arrives, what was left is read in it.
//   - A price is never negative; a `signed` amount (a supplement) is read with its sign, and a ± button at the end of
//     the field turns it into a discount and back, because a phone's decimal keyboard has no minus.
//   - Outlined (`fill="outline"`, which only paints in `mode="md"`), floating label; `testid` on the ion-input and
//     `<testid>-sign` on the ± button.
import { IonButton, IonInput } from '@ionic/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatMoney, type Money } from '../format';
import { useComponentLocale } from '../locale';
import en from './locales/en.json';
import es from './locales/es.json';
import { normaliseMoneyText, parseMoney } from './money';

const props = withDefaults(
  defineProps<{
    /** The field's label. */
    label: string;
    /** The `data-testid` of the ion-input (and `<testid>-sign` of the ± button). */
    testid: string;
    /** The field's currency; unknown while the business (or the list) has not answered. */
    money?: Money;
    /** A negative amount is read (a supplement), with the ± button; otherwise refused (a price). */
    signed?: boolean;
    /** The server's message for the field: it wins over the field's own. */
    errorText?: string;
    helperText?: string;
    /** A save was tried: what is not an amount says so without leaving the field. */
    showError?: boolean;
    disabled?: boolean;
  }>(),
  { money: undefined, signed: false, errorText: undefined, helperText: undefined, showError: false, disabled: false },
);
const text = defineModel<string>({ required: true });

const { t } = useI18n({ useScope: 'local', messages: { en, es } });
const locale = useComponentLocale();
/** The person left the field once: its reading may be said. */
const left = ref(false);

/** Why the text is not an amount of the field's money, in the page language; `''` when it is one, is empty or the
 *  money is still unknown (nothing can be judged without it). */
const readError = computed(() => {
  if (!props.money) return '';
  const read = parseMoney(text.value, { money: props.money, signed: props.signed });
  if (read.ok) return '';
  if (read.reason === 'not_amount') return t(props.signed ? 'moneyInput.notAmountSigned' : 'moneyInput.notAmount');
  if (read.reason === 'negative') return t('moneyInput.negative');
  return t('moneyInput.ambiguous', {
    typed: text.value.trim(),
    grouped: formatMoney(read.grouped, locale.value, props.money),
    decimal: formatMoney(read.decimal, locale.value, props.money),
  });
});

const message = computed(() => props.errorText || ((left.value || props.showError) && readError.value) || undefined);

function onInput(value: string | number | null | undefined): void {
  text.value = value === null || value === undefined ? '' : String(value);
}

function onBlur(): void {
  left.value = true;
  // Until the money is known its decimals are unknown: what was typed stays, never «150» made «150.00».
  if (!props.money) return;
  const normalised = normaliseMoneyText(text.value, locale.value, { money: props.money, signed: props.signed });
  if (normalised !== text.value) text.value = normalised;
}

/** The same amount with the other sign: «1,50» ↔ «-1,50»; the screen's own «+» becomes «-». */
function toggleSign(): void {
  if (props.disabled) return;
  const typed = text.value.trim();
  if (/^[-−]/.test(typed)) text.value = typed.slice(1).trimStart();
  else text.value = `-${typed.replace(/^\+/, '').trimStart()}`;
}
</script>

<template>
  <ion-input
    :data-testid="testid"
    :model-value="text"
    type="text"
    inputmode="decimal"
    :label="label"
    label-placement="floating"
    fill="outline"
    mode="md"
    :disabled="disabled"
    :helper-text="helperText"
    :error-text="message"
    :class="{ 'ion-invalid': !!message, 'ion-touched': !!message }"
    @update:model-value="onInput"
    @ion-blur="onBlur"
  >
    <ion-button
      v-if="signed"
      slot="end"
      type="button"
      fill="clear"
      size="small"
      :disabled="disabled"
      :data-testid="`${testid}-sign`"
      :aria-label="t('moneyInput.sign')"
      @click="toggleSign"
    >
      ±
    </ion-button>
  </ion-input>
</template>
