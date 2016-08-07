'use strict';
var electron = require('electron-connect').server.create();
var gulp = require('gulp');

gulp.task('start', function () {

    // Electronの起動
    electron.start();

    // BrowserProcess(MainProcess)が読み込むリソースが変更されたら, Electron自体を再起動
    gulp.watch(['app.js'], electron.restart);

    // RendererProcessが読み込むリソースが変更されたら, RendererProcessにreloadさせる
    gulp.watch(['index.html', './css/photon.min.css', 'about.html'], electron.reload);
});