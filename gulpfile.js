'use strict';

var gulp = require('gulp');
var jshint = require('gulp-jshint');

var paths = {
	scripts: ['enhancedsteam.js']
};

gulp.task('jshint', function() {
	return gulp.src(paths.scripts)
	    .pipe(jshint('.jshintrc'))
        .pipe(jshint.reporter('default'));
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['jshint']);