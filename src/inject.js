// Injects the main script. This is necessary in order to bind a
// keyhandler.

chrome.storage.sync.get(['settings'], (result) => {
  let settings = {};
  if (result.settings) {
    settings = JSON.parse(result.settings);
  }

  const settingsScriptEl = document.createElement('script');
  settingsScriptEl.innerText =
    'roamNavigatorSettings = ' + JSON.stringify(settings) + ';';
  document.body.appendChild(settingsScriptEl);

  const scriptEl = document.createElement('script');
  scriptEl.setAttribute('src', chrome.extension.getURL('roam-navigator.js'));
  document.body.appendChild(scriptEl);
});
