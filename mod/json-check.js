/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT-License
*/

module.exports = compile;

var fs = require('fs');

function compile(source, target, siblings, options, callback) {
  fs.readFile(source, 'utf-8', function(err, txt) {
    if(err) return callback(err);
    try {
      JSON.parse(txt);
    } catch(ex) {
      err = ex;
    }
    return callback(err);
  });
}
