/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT-License
*/

exports.individual = individual;

var Fs = require('fs');

function individual(source, target, options, callback) {
  Fs.readFile(source, 'utf-8', function(err, txt) {
    if(err) return callback(err);
    try {
      JSON.parse(txt);
    } catch(ex) {
      err = ex;
    }
    return callback(err);
  });
}
