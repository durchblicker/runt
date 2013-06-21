/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

global.PACKAGE = JSON.parse(require('fs').readFileSync(__dirname + '/../package.json', 'utf-8'));

require('argv').version(global.PACKAGE.version);
require('argv').info(global.PACKAGE.description);

require('argv').option({
  name: 'config',
  short: 'c',
  type: 'path',
  description: 'The path to the config-file to use for your project.'
});

require('argv').option({
  name: 'build',
  short: 'b',
  type: 'boolean',
  description: 'If set the first thing that happens is a complete build of the rules'
});

require('argv').option({
  name: 'watch',
  short: 'w',
  type: 'boolean',
  description: 'If set this watches the specified rules and rebuilds if their files change'
});

require('argv').option({
  name: 'quiet',
  short: 'q',
  type: 'boolean',
  description: 'If set this suppresses console.log information'
});

require('argv').option({
  name: 'show-config',
  type: 'boolean',
  description: 'If set this shows the parsed configuration'
});

var argv = module.exports = global.ARGV = require('argv').run();
argv.options.config = argv.options.config || require('path').resolve('runt.json');

if(argv.options.quiet) {
  console.log = function() {};
}
