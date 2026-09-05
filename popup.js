function label(offset) {
  if (offset === 0) return "מקורי";
  return (offset > 0 ? "+" : "") + offset;
}

function sendAction(action) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url || !/tab4u\.com/.test(tab.url)) {
      document.getElementById("value").textContent = "לא בעמוד Tab4U";
      return;
    }
    chrome.tabs.sendMessage(tab.id, { action }, (res) => {
      if (chrome.runtime.lastError) {
        document.getElementById("value").textContent = "רענן/י את העמוד";
        return;
      }
      if (res && typeof res.offset === "number") {
        document.getElementById("value").textContent = label(res.offset);
      }
    });
  });
}

document.getElementById("up").addEventListener("click", () => sendAction("up"));
document.getElementById("down").addEventListener("click", () => sendAction("down"));
document.getElementById("reset").addEventListener("click", () => sendAction("reset"));

// Show the current transposition as soon as the popup opens.
sendAction("status");
