var version = "7.9"

var storage = chrome.storage.sync;
if (!storage)
    storage = chrome.storage.local;

