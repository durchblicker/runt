/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

require('./lib/options.js');
var async = require('async');
var watch = require('./lib/watchfiles.js');

require('./lib/config.js')(global.ARGV.options.config, function(err, config) {
  if (err) return error(err);
  if (global.ARGV.options['show-config']) console.log(JSON.stringify(config, undefined, '  '));
  buildAll(config, function() {
    watchAll(config, function() {
      console.log(global.PACKAGE.copyright);
    });
  });
});

function buildAll(config, callback) {
  if (!global.ARGV.options.build) return callback();
  console.log('Building');
  async.forEach(config.rules, function(rule, callback) {
    async.forEach(rule.source, function(source, callback) {
      var target;
      switch(typeof rule.target) {
        case 'object':
          if (rule.target.search && rule.target.replace) {
            target=source.path.replace(new RegExp(rule.target.search), rule.target.replace);
            break;
          }
        default:
          target=String(target);
      }

      config.moduleIndex[rule.module].module(source.path, target, function(err) {
        if (err) {
          status(rule.name+' ('+status.file(target)+')', false);
          error(err);
          return callback(err);
        }
        status(rule.name+' ('+status.file(target)+')', true);
        return callback(err);
      });
    }, callback);
  }, function(err) {
    if (err) error(err);
    status('Building', err?false:true);
    return callback(err);
  });
}

function status(text, success) {
  text=String(text);
  while(text.length < (100 - 12)) text+=' ';
  text += '[ '+(success?'DONE':'FAIL')+' ]';
  console.log(text);
}
status.file = function(file) {
  var max=68;
  return (file.length > max)?('…'+file.substr(-1*(max-1))):file;
};

function watchAll(config, callback) {
  if (!global.ARGV.options.watch) return callback();
  console.log('Watching Sources');
  async.forEach(config.rules, function(rule, callback) {
    async.forEach(rule.source, function(source, callback) {
      watch(source.dependencies || [ source ], function(err, watcher) {
        if (err) return callback(err);
        watcher.on('modified', fileModified.bind(rule, config, rule, source, watcher));
      });
    }, callback);
  }, callback);
}

function fileModified(config, rule, source, watcher, file) {
  console.log('Modified '+rule.name+' ('+file.path+')');
  var target;
  switch(typeof rule.target) {
    case 'object':
      if (rule.target.search && rule.target.replace) {
        target=source.path.replace(new RegExp(rule.target.search), rule.target.replace);
        break;
      }
    default:
      target=String(target);
  }
  config.moduleIndex[rule.module].module(source.path, target, function(err) {
    if (err) {
      status(rule.name+' ('+status.file(target)+')',false);
      return error(err);
    }
    status(rule.name+' ('+status.file(target)+')',true);
  });
}

function error(msg) {
  [].concat(arguments).forEach(function(msg) {
    console.error('ERROR:', msg);
  });
}
