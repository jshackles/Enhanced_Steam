var gulp = require('gulp');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var zip = require('gulp-zip');
var del = require('del');
var fs = require('fs');

gulp.task('dir', function(){
    return gulp.src('*.*', {read: false})
        .pipe(gulp.dest('./out/build'))
})

gulp.task('js', function(){
    return gulp.src([
        './src/js/sapic-preview-button.js',
        './src/js/jquery-3.3.1.min.js'
      ])
        .pipe(concat('main.js'))
        .pipe(uglify())
        .pipe(gulp.dest('./out/build'))
});

gulp.task('build', function(){
    var content = fs.readFileSync('./src/manifest.json', {
        encoding: 'utf-8'  
    });
    var vernum = content.match(/\.[0-9]{2,}/g)
    fs.writeFileSync('./src/manifest.json', content.replace(vernum, (parseFloat(vernum) + 0.01).toFixed(2).replace(/^0+/, '')));
    return gulp.src([
        './out/build/main.js',
        './src/icon48.png',
        './src/icon128.png',
        './src/manifest.json'
    ])
        .pipe(zip('Steam-Design-Extension.zip'))
        .pipe(gulp.dest('./out'))
})

gulp.task('clean', function(){
    return del('./out/build')
})

gulp.task('default', gulp.series('dir', 'js', 'build', 'clean'));