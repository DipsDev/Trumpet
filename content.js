// Tab4U Chord Transposer - content script
// Scans the page for text that is made up entirely of chord tokens
// (e.g. "Am7", "C#m/G#", "Dsus4") and lets the user transpose those
// chords up/down in real time, without touching the surrounding lyrics.

(function () {
  "use strict";

  const WIDGET_ID = "tab4u-transposer-widget";

  // ---- Chord parsing helpers -------------------------------------------------

  const NOTE_INDEX = {
    C: 0, "B#": 0,
    "C#": 1, Db: 1,
    D: 2,
    "D#": 3, Eb: 3,
    E: 4, Fb: 4,
    F: 5, "E#": 5,
    "F#": 6, Gb: 6,
    G: 7,
    "G#": 8, Ab: 8,
    A: 9,
    "A#": 10, Bb: 10,
    B: 11, Cb: 11
  };

  const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

  // Whitelisted chord quality suffixes (longest alternatives first so the
  // regex engine doesn't stop too early).
  const SUFFIXES = [
    "maj13", "maj11", "maj9", "maj7", "maj",
    "m7b5", "m7#5", "mmaj7", "m6/9", "m6", "m7", "m9", "m11", "m13", "m",
    "min7", "min",
    "dim7", "dim",
    "aug",
    "sus2", "sus4", "sus",
    "add9", "add11", "add2", "add4", "add",
    "6/9", "6",
    "7sus4", "7b5", "7#5", "7b9", "7#9", "7",
    "9", "11", "13",
    "5", "\\+"
  ].join("|");

  // A single chord token, optionally wrapped in parentheses, optionally
  // with a "/Bass" slash chord suffix. Case-insensitive so both "Bb" and
  // "bB"-style typos from the page still match on the root letter.
  const CHORD_TOKEN_RE = new RegExp(
    "^(\\(?)([A-G])(#|b)?(" + SUFFIXES + ")?(\\/([A-G])(#|b)?)?(\\)?)$",
    "i"
  );

  function shiftNote(letter, accidental, semitones, preferFlat) {
    const key = letter.toUpperCase() + (accidental || "");
    const idx = NOTE_INDEX[key];
    if (idx === undefined) return letter + (accidental || "");
    const newIdx = ((idx + semitones) % 12 + 12) % 12;
    return preferFlat ? FLATS[newIdx] : SHARPS[newIdx];
  }

  function transposeToken(token, semitones) {
    const m = token.match(CHORD_TOKEN_RE);
    if (!m) return token;
    const [, openParen, rootLetter, rootAcc, suffix, , bassLetter, bassAcc, closeParen] = m;

    const preferFlat = rootAcc === "b";
    const newRoot = shiftNote(rootLetter, rootAcc, semitones, preferFlat);

    let out = (openParen || "") + newRoot + (suffix || "");

    if (bassLetter) {
      const bassPreferFlat = bassAcc === "b";
      const newBass = shiftNote(bassLetter, bassAcc, semitones, bassPreferFlat);
      out += "/" + newBass;
    }

    out += closeParen || "";
    return out;
  }

  function isChordLine(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 60) return false;
    if (!/[A-Ga-g]/.test(trimmed)) return false;
    const tokens = trimmed.split(/\s+/);
    return tokens.length > 0 && tokens.every((t) => CHORD_TOKEN_RE.test(t));
  }

  function transposeLine(text, semitones) {
    return text.replace(/\S+/g, (token) =>
      CHORD_TOKEN_RE.test(token) ? transposeToken(token, semitones) : token
    );
  }

  // ---- DOM scanning -----------------------------------------------------------

  // Containers we never want to touch (nav/ads/scripts/the widget itself).
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT"]);

  function shouldSkipElement(el) {
    if (!el) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.closest && el.closest("#" + WIDGET_ID)) return true;
    return false;
  }

  // Map from text node -> its untouched original string, so repeated
  // transpositions are always computed from the real original value.
  const originalText = new WeakMap();
  let chordNodes = []; // all text nodes recognized as chord lines so far

  function registerNode(node) {
    if (originalText.has(node)) return;
    if (!node.nodeValue || !isChordLine(node.nodeValue)) return;
    originalText.set(node, node.nodeValue);
    chordNodes.push(node);
  }

  function scan(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (shouldSkipElement(node.parentElement)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      registerNode(node);
    }
  }

  function applyOffset(offset) {
    chordNodes = chordNodes.filter((n) => n.isConnected);
    chordNodes.forEach((node) => {
      const original = originalText.get(node);
      if (original === undefined) return;
      node.nodeValue = transposeLine(original, offset);
    });
  }

  // Re-scan when the page swaps in new content (tab4u loads some sections
  // asynchronously, e.g. after picking an instrument or capo setting).
  let rescanTimer = null;
  const observer = new MutationObserver((mutations) => {
    let needsScan = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        needsScan = true;
        break;
      }
    }
    if (!needsScan) return;
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(() => {
      scan(document.body);
      applyOffset(state.offset);
    }, 150);
  });

  // ---- Persisted state ----------------------------------------------------

  const storageKey = "tab4u-transpose:" + location.pathname;
  const state = { offset: 0 };

  function loadState(cb) {
    try {
      chrome.storage.local.get([storageKey], (res) => {
        state.offset = (res && res[storageKey]) || 0;
        cb();
      });
    } catch (e) {
      cb();
    }
  }

  function saveState() {
    try {
      chrome.storage.local.set({ [storageKey]: state.offset });
    } catch (e) {
      /* ignore */
    }
  }

  // ---- Floating widget UI --------------------------------------------------

  function noteLabel(offset) {
    if (offset === 0) return "מקורי";
    const sign = offset > 0 ? "+" : "";
    return sign + offset;
  }

  function buildWidget() {
    if (document.getElementById(WIDGET_ID)) return;

    const widget = document.createElement("div");
    widget.id = WIDGET_ID;
    widget.innerHTML = `
      <div class="t4u-header" id="t4u-drag-handle">
        <span class="t4u-title">טרנספוזיציה</span>
        <button class="t4u-collapse" title="כווץ/הרחב">−</button>
      </div>
      <div class="t4u-body">
        <button class="t4u-btn" id="t4u-down" title="הנמך חצי טון">♭ −</button>
        <span class="t4u-value" id="t4u-value">מקורי</span>
        <button class="t4u-btn" id="t4u-up" title="הגבה חצי טון">+ ♯</button>
      </div>
      <div class="t4u-footer">
        <button class="t4u-reset" id="t4u-reset">איפוס</button>
      </div>
    `;
    document.body.appendChild(widget);

    const valueEl = widget.querySelector("#t4u-value");
    const bodyEl = widget.querySelector(".t4u-body");
    const footerEl = widget.querySelector(".t4u-footer");
    const collapseBtn = widget.querySelector(".t4u-collapse");

    function refresh() {
      valueEl.textContent = noteLabel(state.offset);
    }

    widget.querySelector("#t4u-up").addEventListener("click", () => {
      state.offset += 1;
      applyOffset(state.offset);
      saveState();
      refresh();
    });

    widget.querySelector("#t4u-down").addEventListener("click", () => {
      state.offset -= 1;
      applyOffset(state.offset);
      saveState();
      refresh();
    });

    widget.querySelector("#t4u-reset").addEventListener("click", () => {
      state.offset = 0;
      applyOffset(state.offset);
      saveState();
      refresh();
    });

    collapseBtn.addEventListener("click", () => {
      const collapsed = widget.classList.toggle("t4u-collapsed");
      collapseBtn.textContent = collapsed ? "+" : "−";
    });

    // simple drag support via the header
    const handle = widget.querySelector("#t4u-drag-handle");
    let dragging = false, offsetX = 0, offsetY = 0;
    handle.addEventListener("mousedown", (e) => {
      dragging = true;
      const rect = widget.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      widget.style.left = e.clientX - offsetX + "px";
      widget.style.top = e.clientY - offsetY + "px";
      widget.style.right = "auto";
      widget.style.bottom = "auto";
    });
    document.addEventListener("mouseup", () => (dragging = false));

    refresh();
  }

  // ---- Message bridge for the popup ---------------------------------------

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.action) return;
    if (msg.action === "up") {
      state.offset += 1;
      applyOffset(state.offset);
      saveState();
    } else if (msg.action === "down") {
      state.offset -= 1;
      applyOffset(state.offset);
      saveState();
    } else if (msg.action === "reset") {
      state.offset = 0;
      applyOffset(state.offset);
      saveState();
    } else if (msg.action === "status") {
      // no-op, just report current offset below
    }
    const widgetValue = document.querySelector("#t4u-value");
    if (widgetValue) widgetValue.textContent = noteLabel(state.offset);
    sendResponse({ offset: state.offset });
    return true;
  });

  // ---- Init -----------------------------------------------------------------

  function init() {
    loadState(() => {
      scan(document.body);
      applyOffset(state.offset);
      buildWidget();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
