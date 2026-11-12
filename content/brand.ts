// App identity, in one place. Internal identifiers (storage keys `noskip.*`, product ids,
// bundle id com.noskipapp.app, EAS slug) keep the original project name on purpose: users never
// see them and changing them would break stored data, purchases or the EAS project link.

/** Full name: App Store title, legal texts, share messages. */
export const APP_NAME = 'Dips or Chips';
/** Logo / poster wordmark. */
export const APP_WORDMARK = 'DIPS OR CHIPS';
/** Deep-link scheme (`dipsorchips://join/<code>`, `dipsorchips://auth-callback`). */
export const APP_SCHEME = 'dipsorchips';
