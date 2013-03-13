/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT-License
*/

module.exports = compile;

var fs = require('fs');

function compile(source, target, siblings, options, callback) {
  fs.readFile(source, 'utf-8', function(err, txt) {
    if(err) return callback(err);
    try {
      txt = JSON.stringify(JSON.parse(txt));
    } catch(ex) {
      return callback(ex);
    }
    var strings = [];
    txt = txt.replace(/"[\s|\S]*?[^\\]"/g, function(match) {
      strings.push(match);
      return ['\u0000\u0000\u0000', strings.length - 1, '\u0000\u0000\u0000'].join('');
    });
    txt = txt.split(/\s/).join('');
    txt = txt.replace(/\u0000\u0000\u0000(\d+?)\u0000\u0000\u0000/g, function(match, string) {
      return strings[string];
    });
    fs.writeFile(target, txt, callback);
  });
}
