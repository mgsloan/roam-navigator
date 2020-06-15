/* TODO

 * `x` to extend

 * Fix scrolling

 * Ignore modifier presses (in todoist-shortcuts too)

 * Click pages on All Pages

 * Get eslint to actually check stuff

 * Fix navigation to shortcut with input focused, so that alt-g can be
   re-enabled.

 */

'use strict';
{
  const DEBUG = false;

  // Key to start navigation.  Alt + this key will also trigger navigation.
  const START_NAVIGATE_KEY = 'g';

  // 'navigate' (g) attempts to assign keys to items based on their
  // names. In some case there might not be a concise labeling. This
  // sets the limit on key sequence length for things based on
  // prefixes.
  //
  // Note that this isn't really a knob for users, as more than 2
  // won't fit well.
  const MAX_NAVIGATE_PREFIX = 2;

  // MUTABLE. This is a set of keycodes to ignore for keypress / keyup
  // events. This solves an issue where keypresses involved in
  // navigation can get handled elsewhere (especially textareas).
  let pressKeyCodesToIgnore = {};

  function initialize() {
    document.addEventListener('keydown', ev => {
      if (keyIsModifier(ev)) {
        return;
      }
      if (isNavigating()) {
        pressKeyCodesToIgnore[ev.keyCode] = true;
        handleNavigateKey(ev);
        return;
      } else if (ev.key === START_NAVIGATE_KEY) {
        // if (ev.altKey || !getInputTarget(ev)) {
        if (!getInputTarget(ev)) {
          ev.stopImmediatePropagation();
          pressKeyCodesToIgnore = {};
          navigate();
          return;
        }
      }
      delete pressKeyCodesToIgnore[ev.keyCode];
    }, true);
    document.addEventListener('keypress', ev => {
      if (isNavigating() || pressKeyCodesToIgnore[ev.keyCode]) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
      }
    }, true);
    document.addEventListener('keyup', ev => {
      if (isNavigating() || pressKeyCodesToIgnore[ev.keyCode]) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        delete pressKeyCodesToIgnore[ev.keyCode];
      }
    }, true);
  }

  function keyIsModifier(ev) {
    return (ev.key === 'Shift') ||
      (ev.key === 'Meta') ||
      (ev.key === 'Control') ||
      (ev.key === 'Alt');
  }

  function getInputTarget(ev) {
    const element = ev.target || ev.srcElement;
    if (element.tagName == 'INPUT' ||
        element.tagName == 'SELECT' ||
        element.tagName == 'TEXTAREA' ||
        element.isContentEditable) {
      return element;
    } else {
      return null;
    }
  }

  const TIP_CLASS = 'roam_navigator_shortcuts_tip';
  const TIP_TYPED_CLASS = 'roam_navigator_shortcuts_tip_typed';
  const NAVIGATE_CLASS = 'roam_navigator_navigating';

  // Keycode constants
  const UP_ARROW_KEYCODE = 38;
  const DOWN_ARROW_KEYCODE = 40;
  const BACKSPACE_KEYCODE = 8;
  const ENTER_KEYCODE = 13;

  const ENTER_SYMBOL = '⏎';

  // MUTABLE. When set, this function should be called when navigate mode
  // finished.
  let finishNavigate = null;

  // MUTABLE. Current set of navigate options.
  let navigateOptions = {};

  // MUTABLE. Used to avoid infinite recursion of 'setupNavigate' due to it
  // being called on mutation of DOM that it mutates.
  let oldNavigateOptions = {};

  // MUTABLE. Keys the user has pressed so far.
  let navigateKeysPressed = '';

  // Switches to a navigation mode, where navigation targets are annotated
  // with letters to press to click.
  function navigate() {
    withUniqueClass(document, 'roam-sidebar-container', all, sidebar => {
      // Since the projects list can get reconstructed, watch for changes and
      // reconstruct the shortcut tips.  A function to unregister the mutation
      // observer is passed in.
      oldNavigateOptions = [];

      const observer = new MutationObserver(() => { setupNavigate(sidebar); });
      observer.observe(sidebar, { childList: true, subtree: true });

      finishNavigate = () => {
        observer.disconnect();
        finishNavigate = null;
        closeSidebarIfOpened();
      };

      setupNavigate(sidebar);
    });
  }

  // Assigns key bindings to sections like inbox / today / various projects.
  // These keybindings get displayed along the options.  This function should
  // be re-invoked every time the DOM refreshes, in order to ensure they are
  // displayed. It overrides the keyboard handler such that it temporarily
  // expects a key.
  function setupNavigate(sidebar) {
    ensureSidebarOpen();
    document.body.classList.add(NAVIGATE_CLASS);
    debug('Creating navigation shortcut tips');
    try {
      // Initialize a list of elements to bind to keys for
      // navigation. Starts out with `s` so that this gets reserved as
      // a prefix for sidebar block navigation.
      const navigateItems = [{ mustBeKeys: 's' }];

      // Add top level navigations to the list of navigateItems
      withClass(sidebar, 'log-button', logButton => {
        const text = logButton.innerText;
        if (text === 'DAILY NOTES' || text === 'g\nDAILY NOTES') {
          navigateItems.push({ element: logButton, mustBeKeys: 'g' });
        } else if (text === 'GRAPH OVERVIEW' || text === 'o' + ENTER_SYMBOL + '\nGRAPH OVERVIEW') {
          navigateItems.push({ element: logButton, mustBeKeys: 'o' + ENTER_SYMBOL });
        } else if (text === 'ALL PAGES' || text === 'a\nALL PAGES') {
          navigateItems.push({ element: logButton, mustBeKeys: 'a' });
        } else {
          error('Unhandled .log-button:', text);
        }
      });

      // Add starred shortcuts to the list of navigateItems
      withUniqueClass(sidebar, 'starred-pages', all, starredPages => {
        withTag(starredPages, 'a', item => {
          withUniqueClass(item, 'page', all, page => {
            const text = page.innerText;
            navigateItems.push({
              element: item,
              mustBeKeys: null,
              text: preprocessItemText(text),
              initials: getItemInitials(text),
            });
          });
        });
      });

      // Assign key sequences to all of the navigateItmes
      navigateOptions = assignKeysToItems(navigateItems);

      // Add key sequences for every block in main area.
      withUniqueClass(document, 'roam-article', all, article => {
        addBlocksToNavigateOptions(navigateOptions, article, '');
      });

      // Add key sequences for every block in sidebar.
      delete navigateOptions['s'];
      withId('right-sidebar', rightSidebar => {
        addBlocksToNavigateOptions(navigateOptions, rightSidebar, 's');
      });

      // Avoid infinite recursion. See comment on oldNavigateOptions.
      var different = false;
      for (var key in navigateOptions) {
        var oldOption = oldNavigateOptions[key];
        if (!oldOption) {
          different = true;
          break;
        } else if (oldOption.element !== navigateOptions[key].element) {
          different = true;
          break;
        }
      }
      oldNavigateOptions = navigateOptions;
      if (different) {
        debug('Different set of navigation options, so re-setting them.');
      } else {
        debug('Same set of navigation options, so not re-rendering.');
        return;
      }

      // Initialize string of pressed keys.
      navigateKeysPressed = '';

      // Finish navigation immediately if no tips to render.
      if (!rerenderTips() && finishNavigate) {
        finishNavigate();
      }
    } catch (ex) {
      if (finishNavigate) { finishNavigate(); }
      removeOldTips();
      document.body.classList.remove(NAVIGATE_CLASS);
      throw ex;
    }
  }

  function addBlocksToNavigateOptions(navigateOptions, el, prefix) {
    const blocks = el.querySelectorAll('.rm-block-text, #block-input-ghost');
    const maxDigits = Math.floor(Math.log10(blocks.length - 1)) + 1;
    for (let i = 0; i < blocks.length; i++) {
      const istr = i.toString();
      const key = prefix + (istr.length === maxDigits ? istr : istr + ENTER_SYMBOL);
      navigateOptions[key] = {
        element: blocks[i],
        mustBeKeys: key,
      };
    }
  }

  // Add in tips to tell the user what key to press.
  function rerenderTips() {
    ensureSidebarOpen();
    removeOldTips();
    var renderedAny = false;
    for (var key in navigateOptions) {
      var prefix = key.slice(0, navigateKeysPressed.length);
      var rest = key.slice(navigateKeysPressed.length);
      if (prefix === navigateKeysPressed) {
        var option = navigateOptions[key];
        var el = option.element;
        if (!el) {
          error('Missing element for tip', key);
        } else {
          var tip = div(TIP_CLASS, text(rest));
          if (prefix.length > 0) {
            tip.prepend(span(TIP_TYPED_CLASS, text(prefix)));
          }
          if (matchingClass('rm-block-text')(el)) {
            findParent(el, matchingClass('flex-h-box')).prepend(tip);
          } else {
            el.prepend(tip);
          }
          renderedAny = true;
        }
      }
    }
    return renderedAny;
  }

  function ensureSidebarOpen() {
    withUniqueClass(document, 'roam-topbar', all, toolbar => {
      const menu = getUniqueClass(toolbar, 'bp3-icon-menu');
      if (menu) {
        mouseOver(menu);
      }
    });
  }

  function closeSidebarIfOpened() {
    withUniqueClass(document, 'roam-sidebar-content', all, sidebar => {
      mouseOut(sidebar);
    });
  }

  // Lowercase and take only alphanumeric.
  function preprocessItemText(txt) {
    var result = '';
    for (var i = 0; i < txt.length; i++) {
      var char = txt[i];
      var lowerChar = char.toLowerCase();
      if (lowercaseCharIsAlpha(lowerChar)) {
        result += lowerChar;
      }
    }
    return result;
  }

  // Lowercase and get initials.
  function getItemInitials(txt) {
    var result = '';
    for (var i = 0; i < txt.length; i++) {
      var char = txt[i];
      var lowerChar = char.toLowerCase();
      if (lowercaseCharIsAlpha(lowerChar) &&
        (i === 0 || txt[i - 1] === ' ' || lowerChar !== char)) {
        result += lowerChar;
      }
    }
    return result;
  }

  function lowercaseCharIsAlpha(char) {
    var code = char.charCodeAt(0);
    return code > 96 && code < 123;  // (a-z)
  }

  function lowercaseCharIsAlphanum(char) {
    var code = char.charCodeAt(0);
    return (
      (code > 47 && code < 58) ||  // (0-9)
      (code > 96 && code < 123));  // (a-z)
  }

  var JUMP_KEYS = 'asdfghjklqwertyuiopzxcvbnm1234567890';

  // Assign keys to items based on their text.
  function assignKeysToItems(items) {
    var result = {};
    var item;
    var keys;
    var prefix;
    var prefixesUsed = {};
    // Ensure none of the results are prefixes or equal to this keysequence.
    var prefixNotAliased = ks => {
      for (var i = 1; i <= ks.length; i++) {
        if (result[ks.slice(0, i)]) {
          return false;
        }
      }
      return true;
    };
    var noAliasing = ks => {
      if (!prefixNotAliased(ks)) {
        return false;
      }
      // Ensure this is keysequence is not a prefix of any other keysequence.
      if (prefixesUsed[ks]) {
        return false;
      }
      return true;
    };
    var addResult = (ks, x) => {
      var noAlias = noAliasing(ks);
      if (noAlias) {
        result[ks] = x;
        for (var i = 1; i <= ks.length; i++) {
          prefixesUsed[ks.slice(0, i)] = true;
        }
      }
      return noAlias;
    };
    var addViaKeyFunc = (mode, f) => {
      var groups = {};
      for (var j = 0; j < items.length; j++) {
        keys = f(items[j]);
        if (keys) {
          var group = groups[keys];
          if (!group) {
            group = [];
            groups[keys] = group;
          }
          group.push(j);
        }
      }
      var qualifying = [];
      for (keys in groups) {
        if (noAliasing(keys)) {
          var groupItems = groups[keys];
          var qualifies = false;
          if (mode === 'no-shortening') {
            qualifies = true;
          } else if (mode === 'try-shortening') {
            // Prefer shortened key sequences if they are unambiguous.
            for (var sl = MAX_NAVIGATE_PREFIX - 1; sl > 0; sl--) {
              var shortened = keys.slice(0, sl);
              if (noAliasing(shortened)) {
                var found = true;
                for (var otherKeys in groups) {
                  if (otherKeys !== keys && otherKeys.slice(0, sl) !== shortened) {
                    found = false;
                    break;
                  }
                }
                if (found) {
                  keys = shortened;
                  break;
                }
              } else {
                break;
              }
            }
            // Still allow ambiguous assignments, even if there is no
            // shortening.
            qualifies = true;
          } else {
            error('Invariant violation: unexpected mode in addViaKeyFunc');
          }
          if (qualifies) {
            qualifying.push([keys, groupItems[0]]);
          }
        }
      }
      // sort backwards so that deletion works.
      qualifying.sort((a, b) => { return b[1] - a[1]; });
      for (var k = 0; k < qualifying.length; k++) {
        keys = qualifying[k][0];
        var ix = qualifying[k][1];
        item = items[ix];
        if (addResult(keys, item)) {
          items.splice(ix, 1);
        }
      }
    };
    // Handle items with 'mustBeKeys' set.
    addViaKeyFunc('no-shortening', it => { return it.mustBeKeys; });
    // When initials are at least MAX_NAVIGATE_PREFIX in length, prefer
    // assigning those.
    addViaKeyFunc('no-shortening', it => {
      var initials = it.initials;
      if (initials.length >= MAX_NAVIGATE_PREFIX) {
        return initials.slice(0, MAX_NAVIGATE_PREFIX);
      } else {
        return null;
      }
    });
    // Attempt to use prefix as the key sequence.
    addViaKeyFunc('try-shortening', it => {
      return it.text.slice(0, MAX_NAVIGATE_PREFIX);
    });
    // For the ones that didn't have unambiguous prefixes, try other character
    // suffixes.
    for (var p = MAX_NAVIGATE_PREFIX - 1; p >= 0; p--) {
      for (var m = 0; m < items.length; m++) {
        item = items[m];
        prefix = item.text.slice(0, MAX_NAVIGATE_PREFIX - 1);
        if (prefixNotAliased(prefix)) {
          for (var n = -1; n < JUMP_KEYS.length; n++) {
            if (n === -1) {
              if (prefix.length > 0) {
                // First, try doubling the last key, easiest to type.
                keys = prefix + prefix[prefix.length - 1];
              } else {
                continue;
              }
            } else {
              keys = prefix + JUMP_KEYS[n];
            }
            if (addResult(keys, item)) {
              items.splice(m, 1);
              m--;
              break;
            }
          }
        }
      }
    }
    // Finally, fallback on choosing arbitrary combinations of characters.
    for (var q = 0; q < items.length; q++) {
      item = items[q];
      var success = false;
      // TODO: Don't hardcode choosing one or two, instead follow MAX_NAVIGATE_PREFIX
      for (var r = 0; r < JUMP_KEYS.length; r++) {
        if (addResult(JUMP_KEYS[r], item)) {
          items.splice(q, 1);
          q--;
          success = true;
          break;
        }
      }
      if (success) {
        continue;
      }
      for (var s = 0; s < JUMP_KEYS.length; s++) {
        for (var t = -1; t < JUMP_KEYS.length; t++) {
          // Prefer doubling keys.
          var secondKey = t === -1 ? JUMP_KEYS[s] : JUMP_KEYS[t];
          if (addResult(JUMP_KEYS[s] + secondKey, item)) {
            items.splice(q, 1);
            q--;
            success = true;
            break;
          }
        }
        if (success) {
          break;
        }
      }
    }
    // That should have assigned keys to everything, but if there are many
    // similar number of options this case can happen.
    if (items.length !== 0) {
      info('There must be many similar sidebar options, couldn\'t find keysequences for', items);
    }
    return result;
  }

  function handleNavigateKey(ev) {
    debug('handleNavigateKey', ev);
    var keepGoing = false;
    try {
      // Space to scroll down.  Shift+space to scroll up.
      if (ev.key === ' ') {
        keepGoing = true;
        withUniqueClass(document, 'starred-pages', all, starredPages => {
          if (ev.shiftKey) {
            starredPages.scrollBy(0, starredPages.clientHeight / -2);
          } else {
            starredPages.scrollBy(0, starredPages.clientHeight / 2);
          }
        });
      } else if (ev.keyCode === UP_ARROW_KEYCODE) {
        // Up arrow to scroll up a little bit.
        keepGoing = true;
        withId('starred-pages', starredPages => {
          starredPages.scrollBy(0, -40);
        });
      } else if (ev.keyCode === DOWN_ARROW_KEYCODE) {
        // Down arrow to scroll down a little bit.
        keepGoing = true;
        withId('starred-pages', starredPages=> {
          starredPages.scrollBy(0, 40);
        });
      } else if (ev.keyCode === BACKSPACE_KEYCODE) {
        // Backspace removes keys from list of pressed keys.
        navigateKeysPressed = navigateKeysPressed.slice(0, -1);
        keepGoing = rerenderTips();
      } else {
        var char = ev.key.toLowerCase();
        if (ev.keyCode === ENTER_KEYCODE) {
          char = ENTER_SYMBOL;
        }
        if (char.length === 1 &&
            (lowercaseCharIsAlphanum(char) || char === ENTER_SYMBOL)) {
          navigateKeysPressed += char;
          var option = navigateOptions[navigateKeysPressed];
          if (option) {
            var el = option.element;
            keepGoing = option.keepGoing;
            navigateToElement(ev, el);
            // Scroll the clicked thing into view, if needed.
            el.scrollIntoViewIfNeeded();
            // If we're just changing folding, then the user probably wants to
            // stay in navigation mode, so reset and rerender.
            if (keepGoing) {
              navigateKeysPressed = '';
              keepGoing = rerenderTips();
            }
          } else {
            keepGoing = rerenderTips();
          }
        }
      }
    } finally {
      if (!keepGoing) {
        if (finishNavigate) { finishNavigate(); }
        removeOldTips();
        document.body.classList.remove(NAVIGATE_CLASS);
      }
    }
  }

  function navigateToElement(ev, el) {
    const inputTarget = getInputTarget(ev);
    if (inputTarget) {
      inputTarget.blur();
    }
    if (matchingClass('rm-block-text')(el)) {
      const blockParent = el.parentElement;
      click(el);
      persistentlyFindTextArea(blockParent, 0, textarea => {
        textarea.focus();
        const lastPosition = textarea.value.length;
        textarea.setSelectionRange(lastPosition, lastPosition);
      });
    } else {
      if (ev.shiftKey) {
        // FIXME: doesn't work, opens link in new tab.
        // shiftClick(el);
        click(el);
      } else {
        click(el);
      }
    }
  }

  function persistentlyFindTextArea(blockParent, n, f) {
    const textarea = getUniqueTag(blockParent, 'textarea');
    if (textarea) {
      f(textarea);
    } else if (n > 200) {
      warn('Giving up on finding editor text area after', n, 'retries.');
    } else {
      setTimeout(() => persistentlyFindTextArea(blockParent, n + 1, f), 15);
    }
  }

  // Remove old tips if any still exist.
  function removeOldTips() {
    // FIXME: I can't quite explain this, but for some reason, querying the
    // list that matches the class name doesn't quite work.  So instead find
    // and remove until they are all gone.
    var toDelete = [];
    do {
      for (var i = 0; i < toDelete.length; i++) {
        var el = toDelete[i];
        el.parentElement.removeChild(el);
      }
      toDelete = document.getElementsByClassName(TIP_CLASS);
    } while (toDelete.length > 0);
  }

  function isNavigating() {
    return finishNavigate !== null;
  }

  /*****************************************************************************
   * Utilities
   */

  // Returns string with prefix removed.  Returns null if prefix doesn't
  // match.
  function stripPrefix(prefix, string) {
    var found = string.slice(0, prefix.length);
    if (found === prefix) {
      return string.slice(prefix.length);
    } else {
      return null;
    }
  }

  // Simulate a mouse over event.
  function mouseOver(el) {
    var options = { bubbles: true, cancelable: true, view: window, target: el };
    el.dispatchEvent(new MouseEvent('mouseover', options));
  }

  // Simulate a mouse over event.
  function mouseOut(el) {
    var options = { bubbles: true, cancelable: true, view: window, target: el };
    el.dispatchEvent(new MouseEvent('mouseout', options));
  }

  // Simulate a mouse click.
  function click(el) {
    var options = {
      bubbles: true,
      cancelable: true,
      view: window,
      target: el,
      which: 1,
      button: 0
    };
    el.dispatchEvent(new MouseEvent('mousedown', options));
    el.dispatchEvent(new MouseEvent('mouseup', options));
    el.dispatchEvent(new MouseEvent('click', options));
  }

  // Simulate a shift mouse click.
  function shiftClick(el) {
    var options = {
      bubbles: true,
      cancelable: true,
      view: window,
      which: 1,
      button: 0,
      shiftKey: true
    };
    document.body.dispatchEvent(createShiftEvent('keydown'));
    el.dispatchEvent(new MouseEvent('mousedown', options));
    el.dispatchEvent(new MouseEvent('mouseup', options));
    el.dispatchEvent(new MouseEvent('click', options));
    document.body.dispatchEvent(createShiftEvent('keyup'));
  }

  function createShiftEvent(type) {
    let keyEvent = new Event(type);
    keyEvent.key = 'Shift';
    keyEvent.keyCode = 92;
    keyEvent.code = 'ShiftRight';
    keyEvent.which = 92;
    return keyEvent;
  }

  const EXTENSION_NAME = 'roam-navigator';

  function debug() {
    if (DEBUG) {
      var args = [].slice.call(arguments);
      args.unshift(EXTENSION_NAME + ':');
      // eslint-disable-next-line no-console
      console.log.apply(null, args);
    }
  }

  function debugWithStack() {
    if (DEBUG) {
      var args = [].slice.call(arguments);
      args.unshift(EXTENSION_NAME + ':');
      args.push('\n' + getStack());
      // eslint-disable-next-line no-console
      console.log.apply(null, args);
    }
  }

  // Used to notify about an issue that's expected to sometimes occur during
  // normal operation.
  function info() {
    var args = [].slice.call(arguments);
    args.unshift(EXTENSION_NAME + ':');
    args.push('(this is fine)');
    // eslint-disable-next-line no-console
    console.log.apply(null, args);
  }

  function warn() {
    var args = [].slice.call(arguments);
    args.unshift(EXTENSION_NAME + ':');
    args.push('\n' + getStack());
    // eslint-disable-next-line no-console
    console.warn.apply(null, args);
  }

  function error() {
    var args = [].slice.call(arguments);
    args.unshift(EXTENSION_NAME + ':');
    args.push(getStack());
    args.push('Please report this as an issue to http://github.com/mgsloan/roam-navigator');
    // eslint-disable-next-line no-console
    console.error.apply(null, arguments);
  }

  // https://stackoverflow.com/a/41586311/1164871
  function getStack() {
    try {
      throw new Error();
    } catch (e) {
      return e.stack;
    }
  }

  // https://github.com/greasemonkey/greasemonkey/issues/2724#issuecomment-354005162
  function addCss(css) {
    var style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);
    return style;
  }

  // Alias for document.getElementById
  function getById(id) {
    return document.getElementById(id);
  }

  // Invokes the function for the matching id, or logs a warning.
  function withId(id, f) {
    if (arguments.length > 2) {
      error('Too many arguments passed to withId', arguments);
    }
    var el = getById(id);
    if (el) {
      return f(el);
    } else {
      warn('Couldn\'t find ID', id);
      return null;
    }
  }

  // Invokes the function for every descendant element that matches
  // the class name.
  function withClass(parent, cls, f) {
    if (arguments.length > 3) {
      error('Too many arguments passed to withClass', arguments);
    }
    var els = parent.getElementsByClassName(cls);
    for (var i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Invokes the function for every descendant element that matches a
  // tag name.
  function withTag(parent, tag, f) {
    if (arguments.length > 3) {
      error('Too many arguments passed to withTag', arguments);
    }
    var els = parent.getElementsByTagName(tag);
    for (var i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Finds a parentElement which matches the specified
  // predicate. Returns null if element is null.
  function findParent(el0, predicate) {
    if (!el0) return null;
    var el = el0.parentElement;
    if (!el) return null;
    do {
      if (predicate(el)) {
        return el;
      }
      el = el.parentElement;
    } while (el);
    return null;
  }

  // Returns first descendant that matches the specified class and
  // predicate.
  function getFirstClass(parent, cls, predicate) {
    return findFirst(predicate, parent.getElementsByClassName(cls));
  }

  // Returns last descendant that matches the specified class and
  // predicate.
  function getLastClass(parent, cls, predicate) {
    return findLast(predicate, parent.getElementsByClassName(cls));
  }

  // Checks that there is only one descendant element that matches the class name and
  // predicate, and returns it. Returns null if it is not found or not unique.
  function getUniqueClass(parent, cls, predicate) {
    var foundElements = [];
    if (cls.constructor === Array) {
      for (var i = 0; i < cls.length; i++) {
        foundElements = foundElements.concat(Array.from(parent.getElementsByClassName(cls[i])));
      }
    } else {
      foundElements = parent.getElementsByClassName(cls);
    }
    return findUnique(predicate, foundElements);
  }

  // Checks that there is only one descendant element that matches the
  // class name, and invokes the function on it. Logs a warning if
  // there isn't exactly one.
  function withUniqueClass(parent, cls, predicate, f) {
    var result = getUniqueClass(parent, cls, predicate);
    if (result) {
      return f(result);
    } else {
      warn('Couldn\'t find unique descendant with class', cls, 'and matching predicate, instead got', result);
      return null;
    }
  }

  // Returns first descendant that matches the specified tag and
  // predicate.
  function getFirstTag(parent, tag, predicate) {
    return findFirst(predicate, parent.getElementsByTagName(tag));
  }

  // Checks that there is only one descendant element that matches the
  // tag and predicate, and returns it. Returns null if it is not
  // found or not unique.
  function getUniqueTag(parent, tag, predicate) {
    return findUnique(predicate, parent.getElementsByTagName(tag));
  }

  // Checks that there is only one descendant element that matches the
  // tag, and invokes the function on it. Logs a warning if there
  // isn't exactly one.
  function withUniqueTag(parent, tag, predicate, f) {
    var result = getUniqueTag(parent, tag, predicate);
    if (result) {
      return f(result);
    } else {
      warn('Couldn\'t find unique descendant with tag', tag, 'and passing predicate');
      return null;
    }
  }

  // Given a predicate, returns the only element that matches. If no elements
  // match, or multiple elements match, then nothing gets returned. If predicate
  // is null, then it is treated like 'all'.
  function findUnique(predicate, array) {
    var pred = checkedPredicate('findUnique', predicate ? predicate : all);
    var result = null;
    for (var i = 0; i < array.length; i++) {
      var el = array[i];
      if (pred(el)) {
        if (result === null) {
          result = el;
        } else {
          debugWithStack('findUnique didn\'t find unique element because there are multiple results. Here are two:', result, el);
          // Not unique, so return null.
          return null;
        }
      }
    }
    return result;
  }

  function checkedPredicate(context, predicate) {
    return x => {
      var bool = predicate(x);
      if (typeof bool !== 'boolean') {
        // TODO: perhaps an exception would be better.
        error('In ' + context + ', expected boolean result from predicate. Instead got', bool);
      }
      return bool;
    };
  }

  /*****************************************************************************
   * Predicates (for use with get / with functions above)
   */

  // Predicate which always returns 'true'.
  function all() {
    return true;
  }

  // Returns predicate which returns 'true' if text content matches wanted text.
  function matchingText(txt) {
    return function(el) {
      return el.textContent === txt;
    };
  }

  // Returns predicate which returns 'true' if the element has the specified class.
  function matchingClass(cls) {
    return function(el) {
      return el.classList.contains(cls);
    };
  }

  /*****************************************************************************
   * Utilities for creating elements
   */

  function text(x) {
    return document.createTextNode(x);
  }

  function span() {
    var args = [].slice.call(arguments);
    args.unshift('span');
    return element.apply(null, args);
  }

  function div() {
    var args = [].slice.call(arguments);
    args.unshift('div');
    return element.apply(null, args);
  }

  function element(t, cls) {
    var el = document.createElement(t);
    if (cls) {
      el.classList.add(cls);
    }
    for (var i = 2; i < arguments.length; i++) {
      el.appendChild(arguments[i]);
    }
    return el;
  }

  addCss([
    '.' + TIP_CLASS + ' {',
    '  position: absolute;',
    '  margin-top: 8px;',
    '  margin-left: -18px;',
    '  width: 22px;',
    '  font-family: monospace;',
    '  font-weight: normal;',
    '  font-size: 14px;',
    '  color: #dd4b39;',
    '  z-index: 2147483647;',
    '}',
    '.' + TIP_TYPED_CLASS + ' {',
    '  color: #aaa;',
    '}',
    '.log-button .' + TIP_CLASS + ' {',
    '  margin-top: 0;',
    '}',
    '.roam-block-container .' + TIP_CLASS + ' {',
    '  margin-top: 4px;',
    '  margin-left: 0;',
    '}'
  ].join('\n'));

  initialize();
}
