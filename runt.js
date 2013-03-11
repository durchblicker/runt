#!/usr/bin/env node

/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

require('./lib/options.js');
var async = require('async');
var watch = require('./lib/watch.js');

var nextTick = ('function' === typeof setImmediate) ? setImmediate : process.nextTick;
var status;
(function() {
  try {
    growl = require('growl');
    status = function(text, success) {
      growl(text, {
        name: 'runt',
        title: 'Runt build: ' + (success ? 'OK' : 'FAILED')
      });
      status.console(text, success);
    };
  } catch(ex) {
    status = function(text, success) {
      return status.console(text, success);
    };
  }
}());
status.console = function(text, success) {
  text = String(text);
  while(text.length < (100 - 12)) {
    text += ' ';
  }
  text += '[ ' + (('string' === typeof success) ? (success.toUpperCase() + '     ').substr(0, 4) : (success ? 'DONE' : 'FAIL')) + ' ]';
  console.log(text);
};
status.file = function(file) {
  var max = 68;
  return(file.length > max) ? ('…' + file.substr(-1 * (max - 1))) : file;
};

status.console('Configuring', 'EXEC');
require('./lib/config.js')(global.ARGV.options.config, loadModule, function(err, config) {
  status.console('Configure: ' + status.file(global.ARGV.options.config), err ? false : true);
  if(err) return error(err);
  if(global.ARGV.options['show-config']) console.log(JSON.stringify(config, undefined, '  '));

  buildAll(config, function(err) {
    if(err) return console.error(err.stack);
    watchAll(config, function(err) {
      if(err) return console.error(err.stack);
      console.log(global.PACKAGE.copyright);
    });
  });
});

function buildAll(config, callback) {
  if(!global.ARGV.options.build) return callback();
  status.console('Building', 'EXEC');
  var tasks = {};
  config.notify(function(target, source, compiler, cause, siblings, options) {
    tasks[target] = {
      compiler: compiler,
      source: source,
      target: target,
      cause: cause,
      siblings: siblings,
      options: options
    };
  });
  async.forEachLimit(Object.keys(tasks), 10, function(task, callback) {
    task = tasks[task];
    status.console(status.file(task.target), 'EXEC');
    task.compiler(task.source, task.target, task.siblings, task.options, function(err) {
      status.console(status.file(task.target), err ? false : true);
      if(err) console.error(err.stack);
      callback();
    });
  }, function(err) {
    status.console('Building', err ? false : true);
    if(err) error(err);
    return callback(err);
  });
}

function watchAll(config, callback) {
  if(!global.ARGV.options.watch) return callback();
  status.console('Gathering Dependencies', 'EXEC');
  config.checkDepend(function(err) {
    status.console('Gathering Dependencies', !err);
    var tasks;

    function trigger(target, source, compiler, cause, siblings, options) {
      status.console(status.file(cause), 'DELTA');
      tasks = start();
      tasks[target] = {
        compiler: compiler,
        source: source,
        target: target,
        cause: cause,
        siblings: siblings,
        options: options
      };
    }

    function start() {
      if(tasks) return tasks;
      nextTick(function() {
        async.whilst(function() {
          if('object' !== typeof tasks) return false;
          var len = Object.keys(tasks).filter(function(target) {
            return tasks[target] ? true : false;
          }).length;
          if(!len) {
            tasks = false;
            return tasks;
          }
          return true;
        }, function(callback) {
          var task = Object.keys(tasks).filter(function(target) {
            return tasks[target] ? true : false;
          }).shift();
          task = tasks[task];
          tasks[task.target] = undefined;
          delete tasks[task.target];
          task.compiler(task.source, task.target, task.siblings, task.options, function(err) {
            status(status.file(task.target), err ? false : true);
            if(err) console.error(err.stack);
            callback(err);
          });
        }, function(err) {
          if(err) error(err);
          tasks = false;
        });
      });
      tasks = {};
      return tasks;
    }
    var files = [];
    config.notify(function(target, source, compiler, cause, siblings, options) {
      files.push(cause);
    });
    var watcher = watch(files, 5000);
    watcher.on('error', error);
    watcher.on('change', config.notify.bind(config, trigger));
    status.console('Watching ' + files.length + ' files', ' OK ');
    return callback();
  });
}

function error(msg) {
  [].concat(arguments).forEach(function(msg) {
    console.error('ERROR:', (msg instanceof Error) ? msg.stack : msg);
  });
}

function loadModule(mod) {
  try {
    return require(mod);
  } catch(ex) {
    return require('./' + mod);
  }
}
