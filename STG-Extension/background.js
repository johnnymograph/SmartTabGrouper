import { groupTabsSemantically, sortGroupsAlphabetically, collapseAllGroups, ungroupAllTabs } from './tab-grouper.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "organizeTabs") {
    const customThreshold = request.threshold !== undefined ? request.threshold : 0.28;
    const minTabs = request.minTabs !== undefined ? request.minTabs : 2;
    const customGroups = request.customGroups || "";
    
    groupTabsSemantically(request.includeGrouped, customThreshold, minTabs, customGroups);
  } else if (request.action === "sortAlphabetically") {
    sortGroupsAlphabetically();
  } else if (request.action === "collapseGroups") {
    collapseAllGroups();
  } else if (request.action === "ungroupAll") {
    ungroupAllTabs();
  }
});

// Listener del atajo de teclado
chrome.commands.onCommand.addListener((command) => {
  if (command === "organize-tabs-shortcut") {
    chrome.storage.sync.get(['savedThreshold', 'savedMinTabs', 'savedCustomGroups'], (result) => {
      const threshold = result.savedThreshold !== undefined ? result.savedThreshold : 0.28;
      const minTabs = result.savedMinTabs !== undefined ? result.savedMinTabs : 2;
      const customGroups = result.savedCustomGroups || "";
      const includeGrouped = false;

      groupTabsSemantically(includeGrouped, threshold, minTabs, customGroups);
    });
  }
});