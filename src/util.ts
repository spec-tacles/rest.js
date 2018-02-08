// from https://github.com/hydrabolt/discord.js
export const reflectors: Array<string | number | symbol> = [
  'toString', 'valueOf', 'inspect', 'constructor',
  Symbol.toPrimitive, Symbol.for('util.inspect.custom'),
];