var gulp = require('gulp');
var browserify = require('browserify');
var gutil = require('gulp-util');
var tap = require('gulp-tap');

gulp.task('js', function () {
  // no need of reading file because browserify does.
  return gulp.src('src/**/*.js', {read: false})
    // transform file objects using gulp-tap plugin
    .pipe(tap(function (file) {
      gutil.log('bundling ' + file.path);
      // replace file contents with browserify's bundle stream
      file.contents = browserify(file.path, {debug: true}).bundle();
    }))
    .pipe(gulp.dest('dist'));
});

gulp.task('default', ['js']);