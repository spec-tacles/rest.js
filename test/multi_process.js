const cp = require('child_process');
for (let i = 0; i < 2; i++) {
	cp.fork('./test/index.js', [], { stdio: 'inherit' });
}
