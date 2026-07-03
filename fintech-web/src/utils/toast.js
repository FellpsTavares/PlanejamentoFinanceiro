export function toast(message, type = 'info', ttl = 4000) {
  try {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type, ttl } }));
  } catch (e) {
    // fallback
    console.log(type.toUpperCase(), message);
  }
}

// Extrai a primeira mensagem de erro de uma resposta de validação do DRF
// (ex: {"date": ["Este campo é obrigatório."]}) para exibir algo específico ao usuário.
export function extractApiError(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (Array.isArray(value) && value.length) return value[0];
    if (typeof value === 'string') return value;
  }
  return fallback;
}
