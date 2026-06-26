if (typeof globalThis.crypto?.randomUUID !== 'function') {
  const g = globalThis;
  if (!g.crypto) g.crypto = {};
  g.crypto.randomUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}
