const {app, BrowserWindow, Tray, Menu, shell, autoUpdater} = require('electron');
const electron = require('electron-connect');
const client = require('cheerio-httpcli');
const CronJob = require('cron').CronJob;
const notifier = require('node-notifier');
const ws = require('windows-shortcuts');
const async = require('async');
const path = require('path');
const fs = require('fs');

let mainWindow;
let aboutWindow;
let tray;
let old;
let contextMenu;
let menu;
let array_date = [];
let array_title = [];
let array_link = [];
let array_contents = [];
let pjson = require(__dirname + '/package.json');

const squirrelCommand = process.argv[1];
const url = 'http://www.tamurayukari.com/';

const handleStartupEvent = function () {
    if (process.platform !== 'win32') {
        return false;
    }

    switch (squirrelCommand) {
        case '--squirrel-install':
        case '--squirrel-updated':

            ws.create("%USERPROFILE%/Desktop/yows_notification.lnk", "%USERPROFILE%/AppData/Local/yows_notification/app-" + pjson.version + "/yows_notification.exe");

            app.quit();

            return true;

        case '--squirrel-firstrun':
        case '--squirrel-installed':

            autoUpdater.setFeedURL("https://s3-ap-northeast-1.amazonaws.com/yows-notification");
            ws.create("%USERPROFILE%/Desktop/yows_notification.lnk", "%USERPROFILE%/AppData/Local/yows_notification/app-" + pjson.version + "/yows_notification.exe");

            setTimeout(()=> {
                autoUpdater.checkForUpdates();
            }, 3000);

            autoUpdater.on("update-downloaded", () => {
                autoUpdater.quitAndInstall();
            });
    }
};

if (handleStartupEvent()) {
    return;
}

// start async
async.waterfall([
    /**
     * Run browser
     */
        function startRenderer(callback) {
        app.on('ready', () => {
            tray = new Tray(__dirname + '/img/tray.png');

            contextMenu = Menu.buildFromTemplate([
                {
                    label: 'このソフトについて', click: function () {
                    aboutWindow = new BrowserWindow({
                        height: 500,
                        width: 700,
                        resizable: false,
                        frame: false,
                        transparent: false,
                        nodeIntegration: false,
                        titleBarStyle: 'hidden' // for macOS
                    });

                    aboutWindow.loadURL('file://' + __dirname + '/about.html');

                    aboutWindow.on('closed', function () {
                        aboutWindow = null;
                    });
                }
                },
                {
                    label: '終了', click: function () {
                    app.quit();
                }
                }
            ]);

            const menu = Menu.buildFromTemplate([
                {
                    label: 'YOWS Notification',
                    submenu: [
                        {
                            label: 'このソフトについて', click: function () {
                            aboutWindow = new BrowserWindow({
                                height: 500,
                                width: 700,
                                resizable: false,
                                frame: false,
                                transparent: false,
                                nodeIntegration: false,
                                titleBarStyle: 'hidden' // for macOS
                            });

                            aboutWindow.loadURL('file://' + __dirname + '/about.html');

                            aboutWindow.on('closed', function () {
                                aboutWindow = null;
                            });
                        }
                        },

                        {
                            label: '終了', click: function () {
                            app.quit();
                        }
                        }
                    ]
                }
            ]);

            tray.setToolTip('YOWS Notification');
            tray.setContextMenu(contextMenu);
            Menu.setApplicationMenu(menu);

            mainWindow = new BrowserWindow({
                height: 600,
                width: 800,
                icon: __dirname + '/img/icon.png',
                resizable: false,
                frame: false,
                transparent: false,
                nodeIntegration: false,
                titleBarStyle: 'hidden' // for macOS
            });

            mainWindow.loadURL('file://' + __dirname + '/index.html');

            mainWindow.on('closed', function () {
                mainWindow = null;
            });

        });

        callback(null);
    },

    /**
     * Scraping official site and add to array.
     * @param callback null, 日付の配列, タイトルの配列
     */
        function (callback) {
        client.fetch(url, function (error, $, res) {
            let i = 0;

            /* [1] 何個お知らせが出てるか取得 */
            while (true) {
                const a = $("td a").eq(i).text();

                if (a == false) {
                    break;
                }
                i++;
            }
            /****************************/

            /* [2] 取得結果を配列にぶち込む */
            for (let x = 0; x < i; x++) {
                array_date.push($("table th").eq(x).text());
                array_title.push($("td a").eq(x).text());
                array_link.push($("table tr a").eq(x).attr("href"));
            }
            /****************************/

            callback(null);
        })
    },

    /**
     * Add to array with array.length from linked.
     */
        function (callback) {
        array_link.forEach(function (current, index) {
            client.fetch(current, function (err, $, res) {
                array_contents[index] = $("div.information_inner_single").eq(0).text().trim();
            });
        });

        callback(null, array_date, array_title);
    },

    /**
     * Send arrays to renderer process.
     * Save latest data to variable before sending to renderer process.
     */
        function (array_date, array_title, callback) {
        mainWindow.webContents.on('did-finish-load', function () {
            old = array_title[0];

            mainWindow.webContents.send('contents_date', array_date);
            mainWindow.webContents.send('contents_title', array_title);
            mainWindow.webContents.send('contents', array_contents);
            mainWindow.webContents.send('link', array_link);
        });

        callback(null);
    },

    /**
     * 一分間にスクレイピングして変更があったら
     * レンダラープロセスを再起動
     */
        function (callback) {
        var job = new CronJob({
            cronTime: '0 */1 * * * *',
            onTick: function () {
                client.fetch(url, function (error, $, res) {
                    let now = $("td a").eq(0).text();
                    let url = $("table tr a").eq(0).attr("href");

                    /**
                     * ここから更新時のトリガー
                     */
                    if (now != old) {
                        Notification(now, url);

                        array_date.unshift($("table th").eq(0).text());
                        array_title.unshift($("td a").eq(0).text());
                        array_link.unshift($("table tr a").eq(0).attr("href"));

                        client.fetch(array_link[0], function (error, $, res) {
                            array_contents.unshift($(".information_inner_single").text());
                        });


                        mainWindow.reload();

                        mainWindow.webContents.on('did-finish-load', function () {
                            mainWindow.webContents.send('contents_date', array_date);
                            mainWindow.webContents.send('contents_title', array_title);
                            mainWindow.webContents.send('contents', array_contents);
                            mainWindow.webContents.send('link', array_link);
                        });
                    }
                });
            }
        });

        job.start();
    }
]);

function Notification(title, url) {
    notifier.notify({
        title: 'YOWS Notification',
        message: '田村ゆかり公式サイトが更新されました！\r詳しくはここをクリック！',
        icon: path.join(__dirname, '/img/icon.png'),
        wait: true,
        sound: true

    }, function (err, response) {
        // エラー処理、エラーが出た時はおれに通知しよう。
    });

    /**
     * 更新があった場合、Notifierで通知を行ってから
     * mainWindowレンダラープロセスを閉じて、再度実行させる。
     */
    notifier.on('click', function (notifierObject, options) {
        shell.openExternal(url);
    });

    notifier.on('timeout', function (notifierObject, options) {
        shell.openExternal(url);
    });
}