export function installMockLocalStorage() {
  const data = new Map();
  const localStorage = {
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    clear() { data.clear(); },
    key(i) { return [...data.keys()][i] ?? null; },
    get length() { return data.size; },
  };
  globalThis.localStorage = localStorage;
  return localStorage;
}

export function installMockWindow(extra = {}) {
  globalThis.window = { ...extra };
  return globalThis.window;
}
