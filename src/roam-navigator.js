'use strict';
{
  // Set to true to enable debug logging
  const DEBUG = false;

  // Symbol used to indicate the enter key.
  const ENTER_SYMBOL = '⏎';

  // Key to start navigation.  Alt + this key will also trigger navigation.
  const START_NAVIGATE_KEY = 'g';

  // Key sequence to navigate to daily notes.
  const DAILY_NOTES_KEY = 'g';

  // Key sequence to navigate to graph overview.
  const GRAPH_OVERVIEW_KEY = 'o' + ENTER_SYMBOL;

  // Key sequence to navigate to all pages view.
  const ALL_PAGES_KEY = 'a';

  // Key sequence prefix for sidebar blocks.
  const SIDEBAR_BLOCK_PREFIX = 's';

  // Key sequence for last block.
  const LAST_BLOCK_KEY = 'd';

  // Key sequence to edit main title.
  const EDIT_TITLE_KEY = '^';

  // Key to scroll up a bit.
  const SCROLL_UP_KEY = 'ArrowUp';

  // Key to scroll down a bit.
  const SCROLL_DOWN_KEY = 'ArrowDown';

  // Key to scroll a half page down and half page up with shift.
  const BIG_SCROLL_KEY = ' ';

  // 'navigate' (g) attempts to assign keys to items based on their
  // names. In some case there might not be a concise labeling. This
  // sets the limit on key sequence length for things based on
  // prefixes.
  //
  // Note that this isn't really a knob for users, as more than 2
  // won't fit well.
  const MAX_NAVIGATE_PREFIX = 2;

  // MUTABLE. This is a set of keys to ignore for keypress / keyup
  // events. This solves an issue where keypresses involved in
  // navigation can get handled elsewhere (especially textareas).
  let keysToIgnore = {};

  function initialize() {
    document.addEventListener('keydown', (ev) => {
      debug('keydown', ev);
      debug('keysToIgnore', keysToIgnore);
      if (keyIsModifier(ev)) {
        return;
      }
      if (isNavigating()) {
        keysToIgnore[ev.key] = true;
        handleNavigateKey(ev);
        return;
      } else if (ev.key === START_NAVIGATE_KEY) {
        if (ev.altKey || !getInputTarget(ev)) {
          ev.stopImmediatePropagation();
          ev.preventDefault();
          keysToIgnore = {};
          navigate();
          return;
        }
      }
      delete keysToIgnore[ev.key];
    }, true);
    document.addEventListener('keypress', (ev) => {
      debug('keypress', ev);
      debug('keysToIgnore', keysToIgnore);
      if (isNavigating() || keysToIgnore[ev.key]) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
      }
    }, true);
    document.addEventListener('keyup', (ev) => {
      debug('keyup', ev);
      debug('keysToIgnore', keysToIgnore);
      if (isNavigating() || keysToIgnore[ev.key]) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        delete keysToIgnore[ev.key];
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
    withUniqueClass(document, 'roam-sidebar-container', all, (sidebar) => {
      // Since the projects list can get reconstructed, watch for changes and
      // reconstruct the shortcut tips.  A function to unregister the mutation
      // observer is passed in.
      oldNavigateOptions = [];

      const observer = new MutationObserver(() => {
        setupNavigate(sidebar);
      });
      observer.observe(sidebar, {
        childList: true,
        subtree: true,
      });

      finishNavigate = () => {
        observer.disconnect();
        finishNavigate = null;
        closeSidebarIfOpened();
      };

      setupNavigate(sidebar);
    });
  }

  // Assigns key bindings to sections like inbox / today / constious projects.
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
      // navigation. Starts out with some reserved keys that will
      // later be removed.
      const navigateItems = [{
        mustBeKeys: SIDEBAR_BLOCK_PREFIX,
        mustBeKeys: LAST_BLOCK_KEY,
      }];

      // Add top level navigations to the list of navigateItems
      withClass(sidebar, 'log-button', (logButton) => {
        const text = logButton.innerText;
        if (text === 'DAILY NOTES' ||
            text === DAILY_NOTES_KEY + '\nDAILY NOTES') {
          navigateItems.push({
            element: logButton,
            mustBeKeys: DAILY_NOTES_KEY,
          });
        } else if (text === 'GRAPH OVERVIEW' ||
                   text === GRAPH_OVERVIEW_KEY + '\nGRAPH OVERVIEW') {
          navigateItems.push({
            element: logButton,
            mustBeKeys: GRAPH_OVERVIEW_KEY,
          });
        } else if (text === 'ALL PAGES' ||
                   text === ALL_PAGES_KEY + '\nALL PAGES') {
          navigateItems.push({
            element: logButton,
            mustBeKeys: ALL_PAGES_KEY,
          });
        } else {
          error('Unhandled .log-button:', text);
        }
      });

      // Add starred shortcuts to the list of navigateItems
      withUniqueClass(sidebar, 'starred-pages', all, (starredPages) => {
        withTag(starredPages, 'a', (item) => {
          withUniqueClass(item, 'page', all, (page) => {
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

      // Add article title editing to navigateItems
      const article = getUniqueClass(document, 'roam-article');
      if (article) {
        withUniqueClass(article, 'rm-title-display', all, (title) => {
          // Can't edit title on log pages, so don't include it in
          // that case.
          if (!title.parentElement.classList.contains('roam-log-page')) {
            navigateItems.push({
              element: title,
              mustBeKeys: EDIT_TITLE_KEY,
            });
          }
        });
      }

      const rightSidebarContent = getById('roam-right-sidebar-content');
      if (rightSidebarContent) {
        withId('right-sidebar', (rightSidebar) => {
          withUniqueClass(rightSidebar, 'bp3-icon-menu-open', all, (closeButton) => {
            navigateItems.push({
              element: closeButton,
              mustBeKeys: 'sc',
            });
          });
        });
      }

      // Assign key sequences to all of the navigateItmes
      navigateOptions = assignKeysToItems(navigateItems);

      // Remove reserved keys.
      delete navigateOptions[SIDEBAR_BLOCK_PREFIX];
      delete navigateOptions[LAST_BLOCK_KEY];

      // Add key sequences for every block in main area.
      if (article) {
        const lastBlock = getLastClass(article.firstChild, 'rm-block-text');
        addBlocks(navigateOptions, article, lastBlock, '');
      }

      // Add key sequences for every block in sidebar.
      withId('right-sidebar', (rightSidebar) => {
        const lastBlock = getLastClass(rightSidebar, 'rm-block-text');
        addBlocks(
            navigateOptions,
            rightSidebar,
            lastBlock,
            SIDEBAR_BLOCK_PREFIX);
      });

      // Add key sequences for every page in "All Pages" list.
      const allPagesSearch = getById('all-pages-search');
      if (allPagesSearch) {
        addBlocks(navigateOptions, allPagesSearch, null, '')
      }

      // Avoid infinite recursion. See comment on oldNavigateOptions.
      let different = false;
      for (const key of Object.keys(navigateOptions)) {
        const oldOption = oldNavigateOptions[key];
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
      if (finishNavigate) {
        finishNavigate();
      }
      removeOldTips();
      document.body.classList.remove(NAVIGATE_CLASS);
      throw ex;
    }
  }

  function addBlocks(navigateOptions, el, lastBlock, prefix) {
    const blocks = el.querySelectorAll([
      '.rm-block-text',
      '.rm-ref-page-view-title',
      '.rm-pages-title-text',
      '#block-input-ghost',
    ].join(', '));
    const maxDigits =
          Math.floor(Math.log10(Math.max(1, blocks.length - 1))) + 1;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const istr = i.toString();
      let key = prefix;
      if (block === lastBlock) {
        key += LAST_BLOCK_KEY;
      } else {
        key += istr.length === maxDigits ? istr : istr + ENTER_SYMBOL;
      }
      navigateOptions[key] = {
        element: block,
        mustBeKeys: key,
      };
    }
  }

  // Add in tips to tell the user what key to press.
  function rerenderTips() {
    ensureSidebarOpen();
    removeOldTips();
    let renderedAny = false;
    for (const key of Object.keys(navigateOptions)) {
      const prefix = key.slice(0, navigateKeysPressed.length);
      const rest = key.slice(navigateKeysPressed.length);
      if (prefix === navigateKeysPressed) {
        const option = navigateOptions[key];
        const el = option.element;
        if (!el) {
          error('Missing element for tip', key);
        } else {
          const tip = div(TIP_CLASS, text(rest));
          if (prefix.length > 0) {
            tip.prepend(span(TIP_TYPED_CLASS, text(prefix)));
          }
          if (matchingClass('rm-block-text')(el) ||
              el.id === 'block-input-ghost') {
            findParent(el, matchingClass('flex-h-box')).prepend(tip);
          } else if (matchingClass('bp3-button')(el)) {
            findParent(el, matchingClass('flex-h-box')).firstElementChild.after(tip);
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
    withUniqueClass(document, 'roam-topbar', all, (toolbar) => {
      const menu = getUniqueClass(toolbar, 'bp3-icon-menu');
      if (menu) {
        mouseOver(menu);
      }
    });
  }

  function closeSidebarIfOpened() {
    withUniqueClass(document, 'roam-center', all, (main) => {
      mouseOver(main);
    });
  }

  // Lowercase and take only alphanumeric.
  function preprocessItemText(txt) {
    let result = '';
    for (let i = 0; i < txt.length; i++) {
      const char = txt[i];
      const lowerChar = char.toLowerCase();
      if (lowercaseCharIsAlpha(lowerChar)) {
        result += lowerChar;
      }
    }
    return result;
  }

  // Lowercase and get initials.
  function getItemInitials(txt) {
    let result = '';
    for (let i = 0; i < txt.length; i++) {
      const char = txt[i];
      const lowerChar = char.toLowerCase();
      if (lowercaseCharIsAlpha(lowerChar) &&
        (i === 0 || txt[i - 1] === ' ' || lowerChar !== char)) {
        result += lowerChar;
      }
    }
    return result;
  }

  function lowercaseCharIsAlpha(char) {
    const code = char.charCodeAt(0);
    return code > 96 && code < 123; // (a-z)
  }

  const JUMP_KEYS = 'asdfghjklqwertyuiopzxcvbnm1234567890';

  // Assign keys to items based on their text.
  function assignKeysToItems(items) {
    const result = {};
    let item;
    let keys;
    let prefix;
    const prefixesUsed = {};
    // Ensure none of the results are prefixes or equal to this keysequence.
    const prefixNotAliased = (ks) => {
      for (let i = 1; i <= ks.length; i++) {
        if (result[ks.slice(0, i)]) {
          return false;
        }
      }
      return true;
    };
    const noAliasing = (ks) => {
      if (!prefixNotAliased(ks)) {
        return false;
      }
      // Ensure this is keysequence is not a prefix of any other keysequence.
      if (prefixesUsed[ks]) {
        return false;
      }
      return true;
    };
    const addResult = (ks, x) => {
      const noAlias = noAliasing(ks);
      if (noAlias) {
        result[ks] = x;
        for (let i = 1; i <= ks.length; i++) {
          prefixesUsed[ks.slice(0, i)] = true;
        }
      }
      return noAlias;
    };
    const addViaKeyFunc = (mode, f) => {
      const groups = {};
      for (let j = 0; j < items.length; j++) {
        keys = f(items[j]);
        if (keys) {
          let group = groups[keys];
          if (!group) {
            group = [];
            groups[keys] = group;
          }
          group.push(j);
        }
      }
      const qualifying = [];
      for (keys in groups) {
        if (noAliasing(keys)) {
          const groupItems = groups[keys];
          let qualifies = false;
          if (mode === 'no-shortening') {
            qualifies = true;
          } else if (mode === 'try-shortening') {
            // Prefer shortened key sequences if they are unambiguous.
            for (let sl = MAX_NAVIGATE_PREFIX - 1; sl > 0; sl--) {
              const shortened = keys.slice(0, sl);
              if (noAliasing(shortened)) {
                let found = true;
                for (const otherKeys in groups) {
                  if (otherKeys !== keys &&
                      otherKeys.slice(0, sl) !== shortened) {
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
            error('Inconstiant violation: unexpected mode in addViaKeyFunc');
          }
          if (qualifies) {
            qualifying.push([keys, groupItems[0]]);
          }
        }
      }
      // sort backwards so that deletion works.
      qualifying.sort((a, b) => {
        return b[1] - a[1];
      });
      for (let k = 0; k < qualifying.length; k++) {
        keys = qualifying[k][0];
        const ix = qualifying[k][1];
        item = items[ix];
        if (addResult(keys, item)) {
          items.splice(ix, 1);
        }
      }
    };
    // Handle items with 'mustBeKeys' set.
    addViaKeyFunc('no-shortening', (it) => {
      return it.mustBeKeys;
    });
    // When initials are at least MAX_NAVIGATE_PREFIX in length, prefer
    // assigning those.
    addViaKeyFunc('no-shortening', (it) => {
      const initials = it.initials;
      if (initials.length >= MAX_NAVIGATE_PREFIX) {
        return initials.slice(0, MAX_NAVIGATE_PREFIX);
      } else {
        return null;
      }
    });
    // Attempt to use prefix as the key sequence.
    addViaKeyFunc('try-shortening', (it) => {
      return it.text.slice(0, MAX_NAVIGATE_PREFIX);
    });
    // For the ones that didn't have unambiguous prefixes, try other character
    // suffixes.
    for (let p = MAX_NAVIGATE_PREFIX - 1; p >= 0; p--) {
      for (let m = 0; m < items.length; m++) {
        item = items[m];
        prefix = item.text.slice(0, MAX_NAVIGATE_PREFIX - 1);
        if (prefixNotAliased(prefix)) {
          for (let n = -1; n < JUMP_KEYS.length; n++) {
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
    for (let q = 0; q < items.length; q++) {
      item = items[q];
      let success = false;
      // TODO: Don't hardcode choosing one or two, instead follow
      // MAX_NAVIGATE_PREFIX
      for (let r = 0; r < JUMP_KEYS.length; r++) {
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
      for (let s = 0; s < JUMP_KEYS.length; s++) {
        for (let t = -1; t < JUMP_KEYS.length; t++) {
          // Prefer doubling keys.
          const secondKey = t === -1 ? JUMP_KEYS[s] : JUMP_KEYS[t];
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
      info('There must be many options, couldn\'t find keys for', items);
    }
    return result;
  }

  function handleNavigateKey(ev) {
    let keepGoing = false;
    try {
      // Space to scroll down.  Shift+space to scroll up.
      if (ev.key === BIG_SCROLL_KEY) {
        keepGoing = true;
        withContainerToScroll((container) => {
          if (ev.shiftKey) {
            container.scrollBy(0, container.clientHeight / -2);
          } else {
            container.scrollBy(0, container.clientHeight / 2);
          }
        });
      } else if (ev.key === SCROLL_UP_KEY) {
        // Up arrow to scroll up a little bit.
        keepGoing = true;
        withContainerToScroll((container) => {
          container.scrollBy(0, -40);
        });
      } else if (ev.key === SCROLL_DOWN_KEY) {
        // Down arrow to scroll down a little bit.
        keepGoing = true;
        withContainerToScroll((container) => {
          container.scrollBy(0, 40);
        });
      } else if (ev.key === 'Backspace') {
        // Backspace removes keys from list of pressed keys.
        navigateKeysPressed = navigateKeysPressed.slice(0, -1);
        keepGoing = rerenderTips();
      /* TODO
      } else if (ev.key === 'x') {
        withUniqueClass(document, 'roam-article', all, roamArticle => {
          extendWithNewBlock(ev, roamArticle.firstChild)
        });
      } else if (ev.key === 'X') {
        withId('roam-right-sidebar-content', extendWithNewBlock);
      */
      } else {
        let char = ev.key.toLowerCase();
        if (ev.key === 'Enter') {
          char = ENTER_SYMBOL;
        }
        if (char.length === 1) {
          navigateKeysPressed += char;
          const option = navigateOptions[navigateKeysPressed];
          if (option) {
            const el = option.element;
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
        if (finishNavigate) {
          finishNavigate();
        }
        removeOldTips();
        document.body.classList.remove(NAVIGATE_CLASS);
      }
    }
  }

  function navigateToElement(ev, el, f) {
    const inputTarget = getInputTarget(ev);
    if (inputTarget) {
      inputTarget.blur();
    }
    if (matchingClass('rm-block-text')(el)) {
      const blockParent = el.parentElement;
      click(el);
      persistentlyFindTextArea(blockParent, 0, (textarea) => {
        textarea.focus();
        const lastPosition = textarea.value.length;
        textarea.setSelectionRange(lastPosition, lastPosition);
        if (f) {
          f(textarea);
        }
      });
      return;
    }
    const clickFunc = ev.shiftKey ? shiftClick : click;
    if (or(matchingClass('rm-ref-page-view-title'),
        matchingClass('rm-title-display'))(el)) {
      withUniqueTag(el, 'span',
          not(matchingClass(TIP_TYPED_CLASS)), clickFunc);
    } else if (matchingClass('rm-pages-title-text')(el)) {
      clickFunc(el);
    } else {
      withUniqueTag(el, 'div', not(matchingClass(TIP_CLASS)), (innerDiv) => {
        clickFunc(innerDiv);
        setTimeout(() => clickFunc(innerDiv));
      });
    }
  }

  function withContainerToScroll(f) {
    if (navigateKeysPressed.startsWith(SIDEBAR_BLOCK_PREFIX)) {
      withId('roam-right-sidebar-content', f);
    } else {
      const allPages = getById('all-pages-search');
      if (allPages) {
        withUniqueClass(allPages, 'table', all, f);
      } else {
        withUniqueClass(document, 'roam-center', all, (roamCenter) => {
          f(roamCenter.firstChild);
        });
      }
    }
  }

  /* TODO
  function extendWithNewBlock(ev, el) {
    const lastBlock = getLastClass(el, 'rm-block-text');
    navigateToElement(ev, lastBlock, textarea => {
      const enterEvent = createKeyEvent('keypress', 'z', 0);
      textarea.dispatchEvent(enterEvent);
    });
  }
  */

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
    let toDelete = [];
    do {
      for (let i = 0; i < toDelete.length; i++) {
        const el = toDelete[i];
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

  // Simulate a mouse over event.
  function mouseOver(el) {
    const options = {
      bubbles: true,
      cancelable: true,
      view: window,
      target: el,
    };
    el.dispatchEvent(new MouseEvent('mouseover', options));
  }

  // Simulate a mouse click.
  function click(el) {
    const options = {
      bubbles: true,
      cancelable: true,
      view: window,
      target: el,
      which: 1,
      button: 0,
    };
    el.dispatchEvent(new MouseEvent('mousedown', options));
    el.dispatchEvent(new MouseEvent('mouseup', options));
    el.dispatchEvent(new MouseEvent('click', options));
  }

  // Simulate a shift mouse click.
  // eslint-disable-next-line no-unused-vars
  function shiftClick(el) {
    const options = {
      bubbles: true,
      cancelable: true,
      view: window,
      which: 1,
      button: 0,
      shiftKey: true,
      target: el
    };
    let ev = new MouseEvent('mousedown', options);
    ev.preventDefault();
    el.dispatchEvent(ev);
    ev = new MouseEvent('mouseup', options);
    ev.preventDefault();
    el.dispatchEvent(ev);
    ev = new MouseEvent('click', options);
    ev.preventDefault();
    el.dispatchEvent(ev);
  }

  function createKeyEvent(type, key, code) {
    const keyEvent = new Event(type);
    keyEvent.key = key;
    keyEvent.keyCode = code;
    keyEvent.which = code;
    return keyEvent;
  }

  const EXTENSION_NAME = 'roam-navigator';

  function debug(...rest) {
    if (DEBUG) {
      const args = [].slice.call(rest);
      args.unshift(EXTENSION_NAME + ':');
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  }

  function debugWithStack(...rest) {
    if (DEBUG) {
      const args = [].slice.call(rest);
      args.unshift(EXTENSION_NAME + ':');
      args.push('\n' + getStack());
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  }

  // Used to notify about an issue that's expected to sometimes occur during
  // normal operation.
  function info(...rest) {
    const args = [].slice.call(rest);
    args.unshift(EXTENSION_NAME + ':');
    args.push('(this is fine)');
    console.log(...args);
  }

  function warn(...rest) {
    const args = [].slice.call(rest);
    args.unshift(EXTENSION_NAME + ':');
    args.push('\n' + getStack());
    console.warn(...args);
  }

  function error(...rest) {
    const args = [].slice.call(rest);
    args.unshift(EXTENSION_NAME + ':');
    args.push(getStack());
    args.push('Please report this as an issue to http://github.com/mgsloan/roam-navigator');
    console.error(...args);
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
    const style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);
    return style;
  }

  // Alias for document.getElementById
  function getById(id) {
    return document.getElementById(id);
  }

  // Invokes the function for the matching id, or logs a warning.
  function withId(id, f, ...rest) {
    if (rest.length > 0) {
      error('Too many arguments passed to withId', rest);
    }
    const el = getById(id);
    if (el) {
      return f(el);
    } else {
      warn('Couldn\'t find ID', id);
      return null;
    }
  }

  // Invokes the function for every descendant element that matches
  // the class name.
  function withClass(parent, cls, f, ...rest) {
    if (rest.length > 0) {
      error('Too many arguments passed to withClass', rest);
    }
    const els = parent.getElementsByClassName(cls);
    for (let i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Invokes the function for every descendant element that matches a
  // tag name.
  function withTag(parent, tag, f, ...rest) {
    if (rest.length > 0) {
      error('Too many arguments passed to withTag', rest);
    }
    const els = parent.getElementsByTagName(tag);
    for (let i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Finds a parentElement which matches the specified
  // predicate. Returns null if element is null.
  function findParent(el0, predicate) {
    if (!el0) return null;
    let el = el0.parentElement;
    if (!el) return null;
    do {
      if (predicate(el)) {
        return el;
      }
      el = el.parentElement;
    } while (el);
    return null;
  }

  // Returns last descendant that matches the specified class and
  // predicate.
  function getLastClass(parent, cls, predicate) {
    return findLast(predicate, parent.getElementsByClassName(cls));
  }

  // Checks that there is only one descendant element that matches the
  // class name and predicate, and returns it. Returns null if it is
  // not found or not unique.
  function getUniqueClass(parent, cls, predicate) {
    let foundElements = [];
    if (cls.constructor === Array) {
      for (let i = 0; i < cls.length; i++) {
        const results = parent.getElementsByClassName(cls[i]);
        foundElements = foundElements.concat(Array.from(results));
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
    const result = getUniqueClass(parent, cls, predicate);
    if (result) {
      return f(result);
    } else {
      warn('Couldn\'t find unique descendant with class',
          cls, 'and matching predicate, instead got', result);
      return null;
    }
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
    const result = getUniqueTag(parent, tag, predicate);
    if (result) {
      return f(result);
    } else {
      warn('Couldn\'t find unique descendant with tag',
          tag, 'and passing predicate');
      return null;
    }
  }

  // Given a predicate, returns the last element that matches. If predicate is
  // null, then it is treated like 'all'.
  function findLast(predicate, array) {
    const pred = checkedPredicate('findLast', predicate ? predicate : all);
    for (let i = array.length - 1; i >= 0; i--) {
      const el = array[i];
      if (pred(el)) {
        return el;
      }
    }
    return null;
  }

  // Given a predicate, returns the only element that matches. If no elements
  // match, or multiple elements match, then nothing gets returned. If predicate
  // is null, then it is treated like 'all'.
  function findUnique(predicate, array) {
    const pred = checkedPredicate('findUnique', predicate ? predicate : all);
    let result = null;
    for (let i = 0; i < array.length; i++) {
      const el = array[i];
      if (pred(el)) {
        if (result === null) {
          result = el;
        } else {
          debugWithStack('findUnique didn\'t find unique element because ' +
                         'there are multiple results. ' +
                         'Here are two:', result, el);
          // Not unique, so return null.
          return null;
        }
      }
    }
    return result;
  }

  // Inverts the result of a predicate.
  function not(p) {
    return (x) => !p(x);
  }

  // Given two predicates, uses || to combine them.
  function or(p1, p2) {
    return (x) =>
      checkedPredicate('left side of or', p1)(x) ||
      checkedPredicate('right side of or', p2)(x);
  }

  function checkedPredicate(context, predicate) {
    return (x) => {
      const bool = predicate(x);
      if (typeof bool !== 'boolean') {
        // TODO: perhaps an exception would be better.
        error('In ' + context + ', expected boolean result from predicate. ',
            'Instead got', bool);
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

  // Returns predicate which returns 'true' if the element has the
  // specified class.
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

  function span(...rest) {
    return element('span', ...rest);
  }

  function div(...rest) {
    return element('div', ...rest);
  }

  function element(t, cls, ...children) {
    const el = document.createElement(t);
    if (cls) {
      el.classList.add(cls);
    }
    for (const child of children) {
      el.appendChild(child);
    }
    return el;
  }

  addCss([
    '.' + TIP_CLASS + ' {',
    '  position: absolute;',
    '  left: 4px;',
    '  margin-top: 4px;',
    '  width: 22px;',
    '  font-family: monospace;',
    '  font-weight: normal;',
    '  font-size: 14px;',
    '  color: #b53728;',
    '  z-index: 2147483647;',
    '}',
    '.' + TIP_TYPED_CLASS + ' {',
    '  color: #aaa;',
    '}',
    '.log-button .' + TIP_CLASS + ' {',
    '  margin-top: 0;',
    '}',
    'a > .' + TIP_CLASS + ' {',
    '  margin-top: 8px;',
    '}',
    '#roam-right-sidebar-content {',
    '  position: relative;',
    '}',
    '#roam-right-sidebar-content .' + TIP_CLASS + ' {',
    '  left: 0;',
    '}',
    '#right-sidebar > .flex-h-box > .' + TIP_CLASS + ' {',
    '  position: initial;',
    '}',
  ].join('\n'));

  initialize();
}
