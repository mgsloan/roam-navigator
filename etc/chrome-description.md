Wherever you may Roam, it is essential to have an efficient navigator. This extension adds a navigation mode to Roam (https://roamresearch.com), which presents visual navigation hints, that can be typed in order to select the corresponding link, block, or button.

By default, navigation mode will be active when no input is focused. It can also be initiated by pressing `Alt+g`, or just `g` when not editing text. Visual navigation hints will then appear, allowing you to select links, starred pages, and select blocks to edit.

Navigation mode is similar to the generic link clicking feature found in extensions like Vimium or SurfingKeys, but it does the following things better for the Roam usecase:

1. Uses stable key sequences for left sidebar and editing blocks in your page.  Attempts to use stable key assignments for clicking links in your page.

2. You can open pages in the sidebar, by holding `Shift` while typing the last character of the navigation hint.

3. It attempts to have more integrated visual layout of the hints, fitting into the margins.

4. Position of the hints update with scrolling and other page updates. In particular, when in navigation mode you can use the keyboard to scroll the main page with `Space`or `Shift+Space` to scroll half a page, and `Down` / `Up` arrows to scroll a bit.

   - To scroll the sidebar, first type `s` followed by the above scrolling shortcuts. `s` is used as a prefix for selecting links / blocks in the sidebar.

5. By default, navigation mode is enabled on start, and enabled when focus exits input. You can then press `Escape` while editing a block to enter into navigation mode. This behavior can be disabled in the options if you prefer to press `Alt+g` / `g`.
