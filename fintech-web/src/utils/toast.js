export function toast(message, type = 'info', ttl = 4000) {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type, ttl } }));
  } catch (e) {
    // fallback
    console.log(type.toUpperCase(), message);
  }
}
