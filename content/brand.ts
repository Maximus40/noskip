// App identity, in one place. Internal identifiers (storage keys `noskip.*`, product ids,
// bundle id com.noskipapp.app, EAS slug) keep the original project name on purpose: users never
// see them and changing them would break stored data, purchases or the EAS project link.

/** Full name: App Store title, legal texts, share messages. */
export const APP_NAME = 'NOXCUSE';
/** Logo / poster wordmark. */
export const APP_WORDMARK = 'NOXCUSE';
/** Deep-link scheme (`noxcuse://join/<code>`, `noxcuse://auth-callback`). */
export const APP_SCHEME = 'noxcuse';
