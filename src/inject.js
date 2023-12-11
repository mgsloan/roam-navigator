// Injects the main script. This is necessary in order to bind a
// keyhandler.

const browser = window.browser || window.chrome;
function inject(scriptName) {
  const scriptEl = document.createElement('script');
  scriptEl.setAttribute('src', browser.runtime.getURL(scriptName));
  // In testing doesn't seem to be necessary, but may lead to more
  // predictable execution order.
  scriptEl.setAttribute('defer', 'defer');
  document.getElementsByTagName('body')[0].appendChild(scriptEl);
}

chrome.storage.sync.get(['settings'], (result) => {
  let settings = {};
  if (result.settings) {
    settings = JSON.parse(result.settings);
  }

  const settingsScriptEl = document.createElement('script');
  settingsScriptEl.setAttribute('defer', 'defer');
  settingsScriptEl.innerText =
    'roamNavigatorSettings = ' + JSON.stringify(settings) + ';';
  document.body.appendChild(settingsScriptEl);

  inject('roam-navigator.js');
});
