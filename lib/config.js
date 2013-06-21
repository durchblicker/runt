/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = configure;
var path = require('path');
var findFiles = require('./findfiles.js');
var async = require('async');
var glob = require('glob');

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

function configure(conffile, require, callback) {
  require('fs').readFile(conffile, 'utf-8', function(err, cfg) {
    if(err) return callback(err);
    cfg = JSON.parse(cfg);
    cfg.path = path.resolve(path.dirname(conffile)) + '/';
    cfg.resolve = path.resolve.bind(path, cfg.path);
    cfg.notify = notifyConfig.bind(cfg);
    cfg.checkDepend = checkAllDepend.bind(cfg);

    try {
      cfg.moduleIndex = {};
      cfg.modules = (cfg.modules || []).map(function(module) {
        if(!module.id) throw(new Error('Bad Module-Definition: missing id'));
        if(!module.module) throw(new Error('Bad Module-Definition: missing module'));
        try {
          module.module = require(module.module);
        } catch(err) {
          throw(new Error('Bad Module-Definition: ' + module.module + ' cannot be loaded.' + err.message));
        }
        cfg.moduleIndex[module.id] = module;
        return module;
      });
    } catch(ex) {
      return callback(ex);
    }

    cfg.watch = (cfg.watch || []).map(function(item) {
      return path.resolve(cfg.path, item);
    });
    try {
      cfg.rules = cfg.rules || [];
      cfg.rules.forEach(function(rule) {
        if(!rule.name) throw(new Error('Bad Rule-Definition: missing name'));
        if(!rule.module) throw(new Error('Bad Rule-Definition: missing module'));
        if(!rule.source) throw(new Error('Bad Rule-Definition: missing source'));
        if(!rule.target) throw(new Error('Bad Rule-Definition: missing target'));
        if(!cfg.modules.filter(function(module) {
          return module.id === rule.module;
        }).length) throw(new Error('Bad Rule-Definition: ' + rule.module + ' not found'));
        return rule;
      });
    } catch(ex2) {
      return callback(ex2);
    }

    if(global.ARGV.targets.length) {
      cfg.rules = cfg.rules.filter(function(rule) {
        return(global.ARGV.targets.indexOf(rule.name) > -1);
      });
    }

    async.map(cfg.rules, function(rule, callback) {
      Object.defineProperty(rule, 'resolve', {
        value: path.resolve.bind(path, cfg.path)
      });
      rule.source = (Array.isArray(rule.source) ? rule.source : [rule.source]).map(function(file) {
        return path.resolve(cfg.path, file);
      });
      rule.module = cfg.moduleIndex[rule.module];
      if(!rule.module || ('function' === typeof rule.module.compile)) return callback(new Error('Invalid Module for ' + rule.name));
      rule.options = mergeOpts(rule.module.options, rule.options);
      rule.notify = notifyRule.bind(rule, cfg);
      rule.checkDepend = checkAllDepend.bind(rule);
      status.console('Globbing(' + rule.name + ')', 'EXEC');
      async.map(rule.source, glob, function(err, sources) {
        status.console('Globbing(' + rule.name + ')', err ? false : true);
        if(err) return callback(err);
        sources.forEach(function(source) {
          source.sort();
        });
        sources = Array.prototype.concat.apply([], sources);
        var target = ('string' === typeof rule.target) ? path.resolve(cfg.path, String(rule.target)) : rule.target;

        rule.source = sources.map(function(source) {
          source = {
            target: target,
            source: source,
            dependencies: []
          };
          if(('object' === typeof target) && ('string' === typeof target.search) && ('string' === typeof target.replace)) {
            source.target = source.source.replace(new RegExp(target.search, 'g'), target.replace);
          }
          target = ('string' !== typeof source.target) ? source.source : target;
          source.notify = notifySource.bind(source, cfg, rule);
          source.checkDepend = ('function' === typeof rule.module.module.dependencies) ? checkDepend.bind(source, rule, rule.module.module.dependencies) : noop;
          return source;
        });
        return callback(undefined, rule);
      });
    }, function(err, rules) {
      if(err) return callback(err, cfg);
      cfg.rules = rules;
      callback(undefined, cfg);
    });
  });
}

function notifyConfig(trigger, file) {
  this.rules.forEach(function(rule) {
    rule.notify(trigger, file);
  });
}

function notifyRule(cfg, trigger, file) {
  //console.log('Rule: '+this.name);
  this.source.forEach(function(item) {
    item.notify(trigger, file);
  });
}

function notifySource(cfg, rule, trigger, file) {
  //console.log('Source('+(typeof file)+'): '+this.source);
  var that = this;
  var siblings = rule.source.map(function(source) {
    return source.source;
  });
  [that.source].concat(that.dependencies).filter(function(item) {
    return(undefined === file) || (item === file);
  }).forEach(function(file) {
    trigger(that.target, that.source, rule.module.module.bind(cfg), file, siblings, rule.options);
  });
}

function checkAllDepend(callback) {
  async.forEach(this.source || this.rules, function(item, cb) {
    item.checkDepend(cb);
  }, callback);
}

function checkDepend(rule, checker, callback) {
  var that = this;
  checker.call(rule, this.source, rule.options, function(err, depends) {
    that.dependencies = depends || [];
    callback(err);
  });
  this.checkDepend = noop;
}

function noop(callback) {
  if('function' === typeof callback) callback();
}

function status(text, success) {
  text = String(text);
  while(text.length < (100 - 12)) {
    text += ' ';
  }
  text += '[ ' + (success ? 'DONE' : 'FAIL') + ' ]';
  console.log(text);
}
status.file = function(file) {
  var max = 68;
  return(file.length > max) ? ('…' + file.substr(-1 * (max - 1))) : file;
};

function mergeOpts(def, cst) {
  def = def || {};
  cst = cst || {};
  var res = {};
  Object.keys(def).forEach(function(key) {
    switch(typeof def[key]) {
      case 'object':
        res[key] = mergeOpts({}, def[key]);
        break;
      default:
        res[key] = def[key];
    }
  });
  Object.keys(cst).forEach(function(key) {
    switch(typeof cst[key]) {
      case 'object':
        res[key] = mergeOpts(res[key], cst[key]);
        break;
      default:
        res[key] = cst[key];
    }
  });
  return res;
}
