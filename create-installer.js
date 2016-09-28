var electronInstaller = require('electron-winstaller');

resultPromise = electronInstaller.createWindowsInstaller({
    appDirectory: './yows_notification-win32-x64',
    outputDirectory: './release',
    authors: '@lu_iskun',
    exe: 'yows_notification.exe',
    iconUrl: 'file://' + __dirname + '/assets/img/icon.ico',
    description: '田村ゆかり公式サイト通知ソフトウェア'
});

resultPromise.then(() => console.log("It worked!"), (e) => console.log(`No dice: ${e.message}`));