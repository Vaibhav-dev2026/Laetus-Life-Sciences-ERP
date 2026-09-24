let counter = Math.floor(Math.random() * 1000);
export function nextId(prefix = 'ID') {
  counter += 1;
  return `${prefix}-${Date.now().toString().slice(-6)}${counter}`;
}
