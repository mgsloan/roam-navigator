# roam-navigator changelog

## Version 11

* Released immediately after version 10, my last change cleaning up
  some eslints broke everything.  This version restores functionality
  :)

## Version 10

* Adds ability to close right sidebar pages. See [#6][].

* Makes breadcrumb links more reliably present. There were a couple
  bugs which would sometimes cause them not to be displayed.

* If a starred link is present in a page, it now uses the same key
  sequence as displayed in the sidebar.

* Fixes layout of sidebar navigation tips.

* Changes key sequence for "All Pages" to be `ap` instead of `a`. This
  frees up `a` to be used as a prefix in other links.

* Fixes display of sidebar toggle / close buttons.

* A bunch of other misc improvements.

[#6]: https://github.com/mgsloan/roam-navigator/issues/6

## Version 9

* Fixes block navigation tips to work with new Roam DOM. See [#10][].

[#10]: https://github.com/mgsloan/roam-navigator/issues/10

## Version 8

* Fixes using spacebar + arrow keys to scroll

## Version 7

* Fixes "start with navigation mode enabled".

* Fixes breadcrumb link clicking via keyboard.

## Version 6

* Added recent pages to the topbar, for quick navigation.  Can be
  disabled via the extension options.  Unfortunately, these links
  cannot yet be used to open the sidebar - this issue is tracked by
  [#4][].

* In navigation mode, no longer handles events that use the Control or
  Alt keys.

* Fixes link clicking for aliased page references. See [#3][].

[#3]: https://github.com/mgsloan/roam-navigator/issues/3
[#4]: https://github.com/mgsloan/roam-navigator/issues/4

## Version 5

* More muted color scheme for the visual hints.

## Version 4

* Update to the usage guide in the settings popup.

## Version 3

* Fixes input and block highlight deselection when `Alt+g` is used to
  trigger navigation mode.

## Version 2

* Small adjustments. Fixes a layout issue where the right sidebar
  content would slightly shift when navigation mode enabled.

## Version 1

* Initial release!  I am simultaneously very pleased with this
  extension, and mildly horrified by the amount of time I put into
  writing it. Please consider using it, so that my sacrifices are
  more worthwhile :)
