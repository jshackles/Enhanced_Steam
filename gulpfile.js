var gulp = require('gulp');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var zip = require('gulp-zip');
var del = require('del');
var babel = require('gulp-babel')

gulp.task('dir', function(){
    return gulp.src('*.*', {read: false})
        .pipe(gulp.dest('./out/build'))
})

gulp.task('js', function(){
    return gulp.src(['./src/js/*.js'])
        .pipe(babel({
            presets: ['@babel/env']
        }))
        .pipe(concat('main.js'))
        .pipe(uglify())
        .pipe(gulp.dest('./out/build'))
});

gulp.task('build', function(){
    return gulp.src([
        './out/build/main.js',
        './src/**',
        '!./src/js/*.js',
        './manifest.json'
    ])
        .pipe(zip('EnhancedSteam.zip'))
        .pipe(gulp.dest('./out'))
})

gulp.task('clean', function(){
    return del('./out/build')
})

gulp.task('default', gulp.series('dir', 'js', 'build', 'clean'));