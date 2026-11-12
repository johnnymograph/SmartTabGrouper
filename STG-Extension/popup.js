const thresholdRange = document.getElementById('thresholdRange');
const thresholdLabel = document.getElementById('thresholdLabel');
const minTabsRange = document.getElementById('minTabsRange');
const minTabsVal = document.getElementById('minTabsVal');
const customGroupsInput = document.getElementById('customGroupsInput');
const shortcutDisplay = document.getElementById('shortcutDisplay');

const totalTabsCount = document.getElementById('totalTabsCount');
const ungroupedTabsCount = document.getElementById('ungroupedTabsCount');
const groupsCount = document.getElementById('groupsCount');

async function updateWindowStats() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const ungrouped = tabs.filter(t => t.groupId === -1).length;
    const uniqueGroups = new Set(tabs.map(t => t.groupId).filter(id => id !== -1)).size;

    totalTabsCount.textContent = tabs.length;
    ungroupedTabsCount.textContent = ungrouped;
    groupsCount.textContent = uniqueGroups;
  } catch (e) {
    console.error("Error updating tab stats:", e);
  }
}

updateWindowStats();

function updateSensitivityLabel(val) {
  if (val <= 0.20) {
    thresholdLabel.textContent = "Flexible";
  } else if (val <= 0.36) {
    thresholdLabel.textContent = "Balanced";
  } else {
    thresholdLabel.textContent = "Strict";
  }
}

chrome.storage.sync.get(['savedThreshold', 'savedMinTabs', 'savedCustomGroups'], (result) => {
  if (result.savedThreshold !== undefined) {
    thresholdRange.value = result.savedThreshold;
    updateSensitivityLabel(parseFloat(result.savedThreshold));
  } else {
    thresholdRange.value = 0.12;
    updateSensitivityLabel(0.12);
  }
  if (result.savedMinTabs !== undefined) {
    minTabsRange.value = result.savedMinTabs;
    minTabsVal.textContent = result.savedMinTabs;
  }
  if (result.savedCustomGroups !== undefined) {
    customGroupsInput.value = result.savedCustomGroups;
  }
});

chrome.commands.getAll((commands) => {
  const command = commands.find(c => c.name === "organize-tabs-shortcut");
  if (command && command.shortcut) {
    shortcutDisplay.textContent = command.shortcut;
  } else {
    shortcutDisplay.textContent = "Unassigned";
  }
});

document.getElementById('configureShortcutBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

thresholdRange.addEventListener('input', (e) => {
  updateSensitivityLabel(parseFloat(e.target.value));
});

minTabsRange.addEventListener('input', (e) => {
  minTabsVal.textContent = e.target.value;
});

document.getElementById('organizeBtn').addEventListener('click', async () => {
  const includeGrouped = document.getElementById('includeGrouped').checked;
  const threshold = parseFloat(thresholdRange.value);
  const minTabs = parseInt(minTabsRange.value, 10);
  const customGroups = customGroupsInput.value.trim();

  chrome.storage.sync.set({ 
    savedThreshold: threshold,
    savedMinTabs: minTabs,
    savedCustomGroups: customGroups
  });

  chrome.runtime.sendMessage({ 
    action: "organizeTabs", 
    includeGrouped, 
    threshold,
    minTabs,
    customGroups 
  });

  setTimeout(updateWindowStats, 250);
});

document.getElementById('sortAlphabeticallyBtn').addEventListener('click', async () => {
  chrome.runtime.sendMessage({ action: "sortAlphabetically" });
  setTimeout(updateWindowStats, 200);
});

document.getElementById('collapseGroupsBtn').addEventListener('click', async () => {
  chrome.runtime.sendMessage({ action: "collapseGroups" });
});

document.getElementById('ungroupAllBtn').addEventListener('click', async () => {
  chrome.runtime.sendMessage({ action: "ungroupAll" });
  setTimeout(updateWindowStats, 250);
});