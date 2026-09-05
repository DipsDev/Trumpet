# Tab4U Chord Transposer

A Chrome extension that lets you transpose the chords shown on tab4u.com
up or down, right on the page — no premium account needed.

## What it does

- Scans the song page for text that is made up entirely of chord tokens
  (e.g. `Am7`, `C#m/G#`, `Dsus4`) and leaves lyrics untouched.
- Adds a small floating panel on the page with **+ / −** buttons to shift
  the chords up or down by a semitone, and a **Reset** button to go back
  to the original key.
- Remembers your chosen transposition per song page (via `chrome.storage`),
  so it stays applied if you reload.
- Also works from the toolbar popup (click the extension icon) if you'd
  rather not use the floating panel.
- Watches the page for content that loads in afterwards (tab4u sometimes
  loads parts of the page asynchronously) and keeps transposing new chords
  that appear.

## Install (load unpacked, since this isn't on the Chrome Web Store)

1. Unzip `tab4u-transposer.zip` somewhere on your computer.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped `tab4u-transposer`
   folder.
5. Open any song page on `tab4u.com` — a small "טרנספוזיציה" panel will
   appear. Use **+ ♯** / **♭ −** to shift chords, and **איפוס** to reset.

## Notes / limitations

- Chord detection works by checking whether an entire chunk of text is
  made up only of valid chord tokens (so it won't accidentally rewrite
  Hebrew lyrics). If tab4u changes its page layout so that a chord is
  mixed into the same text node as lyrics, that particular chord may not
  be picked up — let me know and the detection regex in `content.js`
  (`CHORD_TOKEN_RE`) can be extended.
- Sharp vs. flat spelling of the new chord follows the spelling of the
  original chord (e.g. transposing `Bb` keeps flats, transposing `F#`
  keeps sharps).
- Only the extra semitone shift you apply on top of tab4u's own displayed
  chords is tracked — this doesn't call tab4u's premium transpose feature
  at all, it's a pure client-side text swap.

## Files

- `manifest.json` — Manifest V3 config.
- `content.js` — chord detection + transposition logic and the floating
  widget.
- `content.css` — styling for the floating widget.
- `popup.html` / `popup.js` — toolbar popup mirroring the same controls.
- `icons/` — toolbar icons.
