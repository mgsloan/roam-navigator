function initialize() {
  modifySettings((initialSettings) => {
    addCheckboxOption(initialSettings, 'activate-on-no-focus', true,
        'Activate navigation mode when input deselected');
    addCheckboxOption(initialSettings, 'activate-on-startup', true,
        'Activate navigation mode when Roam is opened');
    addCheckboxOption(initialSettings, 'scroll-outside-navigate-mode', true,
        'Enable scrolling keys (space / shift+space / up / down) ' +
      'even when not in navigation mode');
    document.body.appendChild(
        span(text('Roam tabs must be refreshed for changes to apply.')));
    return initialSettings;
  });
}

function addCheckboxOption(initialSettings, name, initial, txt) {
  const startValue = getStartValue(initialSettings, name, initial);
  const checkbox = element('input', {type: 'checkbox', class: 'filled-in'});
  if (startValue) {
    checkbox.checked = true;
  }
  checkbox.addEventListener('input', () =>
    modifySettings((newSettings) => {
      newSettings[name] = checkbox.checked;
      console.log('newSettings =', newSettings);
      return newSettings;
    }, settingsUpdated));
  document.querySelector(".settings").appendChild(
      element('p', {},
          element('label', {},
              checkbox,
              span({}, text(txt)))));
}

function getStartValue(initialSettings, name, initial) {
  if (!(name in initialSettings)) {
    console.log('setting start value to default for ', name);
    initialSettings[name] = initial;
    return initial;
  }
  return initialSettings[name];
}

function settingsUpdated() {
  // TODO: somehow notify tab about it.
}

function modifySettings(f, g) {
  withSettings((settings) => setSettings(f(settings), g));
}

function setSettings(settings, f) {
  chrome.storage.sync.set({settings: JSON.stringify(settings)}, f);
}

function withSettings(f) {
  chrome.storage.sync.get(['settings'], (result) => {
    if (result.settings) {
      f(JSON.parse(result.settings));
    } else {
      f({});
    }
  });
}

function text(x) {
  return document.createTextNode(x);
}

function span(...rest) {
  return element('span', ...rest);
}

function element(t, attrs, ...children) {
  const el = document.createElement(t);
  for (const attr of Object.keys(attrs)) {
    el.setAttribute(attr, attrs[attr]);
  }
  for (const child of children) {
    el.appendChild(child);
  }
  return el;
}

initialize();
