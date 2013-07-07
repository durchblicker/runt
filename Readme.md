# Runt - Grunt without the "Geee why does it do that" [![Build Status](https://secure.travis-ci.org/phidelta/runt.png)](http://travis-ci.org/#!/phidelta/runt)

Runt is a simple website development tool that helps you:

  * [UglifyJS](https://github.com/mishoo/UglifyJS2) your scripts
  * Compile your [LessCSS](https://github.com/cloudhead/less) styles
  * Compile your [Pistachio](https://github.com/phidelta/pistachio) templates
  * Compile you CommonJS Scripts into a single script for the browser (browserify light)

It can do that simpler than Grunt and in addition it can Monitor your filesystem for changes and do a rebuild when necessary.
Further more it will analyze the dependencies in templates (like partials) and less files (imports) that should trigger a
rebuild. So even if you change an included File, it will trigger a rebuild on change.

So it becomes a painless experience to develop with Less, Templates and JavaScript. So you can use the same HTML code in development as in production it uses Sourcemaps (thanks to Uglify).

Install:

    npm install -g runt

Use:

    runt [--config=<config-file>] [--quiet] [--build] [--watch] [--show-config]

The default for *--config* is *./runt.json*

Now grows support is also available. If the [growl node module](https://npmjs.org/package/growl) is available and functional it is used to also display a notification when a build item is completed.
