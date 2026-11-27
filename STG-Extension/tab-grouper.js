import { extractSemanticTokens, extractPathTokens, calculateJaccard, generateConceptTitle, getRandomGroupColor } from './text-utils.js';

let previousState = null;

export async function groupTabsSemantically(includeGrouped, similarityThreshold, minTabsRequired, customGroupsStr) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  previousState = tabs.map(t => ({ id: t.id, groupId: t.groupId }));

  let customKeywords = [];
  if (customGroupsStr) {
    customKeywords = customGroupsStr
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);
  }

  let tabDataList = [];
  let assignedTabIds = new Set();
  let titleToClusterMap = {};

  if (customKeywords.length > 0) {
    customKeywords.forEach(keyword => {
      let matchedTabs = [];
      tabs.forEach(tab => {
        if (tab.pinned) return;
        if (!includeGrouped && tab.groupId !== -1) return;
        if (assignedTabIds.has(tab.id)) return;

        const title = (tab.title || "").toLowerCase();
        const url = (tab.url || "").toLowerCase();

        if (title.includes(keyword) || url.includes(keyword)) {
          matchedTabs.push({
            tabId: tab.id,
            title: tab.title || "",
            url: tab.url
          });
          assignedTabIds.add(tab.id);
        }
      });

      if (matchedTabs.length >= minTabsRequired) {
        const groupTitle = keyword.charAt(0).toUpperCase() + keyword.slice(1);
        titleToClusterMap[groupTitle.toLowerCase()] = {
          title: groupTitle,
          tabs: matchedTabs
        };
      }
    });
  }

  for (let tab of tabs) {
    if (tab.pinned) continue;
    if (!includeGrouped && tab.groupId !== -1) continue;
    if (assignedTabIds.has(tab.id)) continue;
    
    if (!tab.url || 
        tab.url.startsWith("chrome://") || 
        tab.url.startsWith("brave://") || 
        tab.url.startsWith("edge://") || 
        tab.url.startsWith("chrome-extension://") ||
        tab.url.startsWith("about:") ||
        tab.url.startsWith("file://")) {
      continue;
    }

    const titleTokens = extractSemanticTokens(tab.title || "");
    const pathTokens = extractPathTokens(tab.url);
    const combinedTokens = new Set([...titleTokens, ...pathTokens]);

    tabDataList.push({
      tabId: tab.id,
      openerTabId: tab.openerTabId || null,
      title: tab.title || "",
      url: tab.url,
      tokens: combinedTokens
    });
  }

  if (tabDataList.length >= 2) {
    let visited = new Set();
    let semanticClusters = [];

    for (let i = 0; i < tabDataList.length; i++) {
      if (visited.has(i)) continue;

      let cluster = [tabDataList[i]];
      visited.add(i);

      for (let j = i + 1; j < tabDataList.length; j++) {
        if (visited.has(j)) continue;

        let tabA = tabDataList[i];
        let tabB = tabDataList[j];

        let isDirectlyRelated = (tabA.openerTabId === tabB.tabId) || (tabB.openerTabId === tabA.tabId);
        let similarity = calculateJaccard(tabA.tokens, tabB.tokens);

        if (isDirectlyRelated || similarity >= similarityThreshold) {
          cluster.push(tabB);
          visited.add(j);
        }
      }

      if (cluster.length >= minTabsRequired) {
        semanticClusters.push(cluster);
      }
    }

    for (let cluster of semanticClusters) {
      const rawTitle = generateConceptTitle(cluster);
      const normalizedKey = rawTitle.toLowerCase().trim();

      if (!titleToClusterMap[normalizedKey]) {
        titleToClusterMap[normalizedKey] = {
          title: rawTitle,
          tabs: []
        };
      }
      titleToClusterMap[normalizedKey].tabs.push(...cluster);
    }
  }

  let groupIndex = 0;
  for (let key in titleToClusterMap) {
    const groupData = titleToClusterMap[key];
    const tabIds = [...new Set(groupData.tabs.map(t => t.tabId))];

    if (tabIds.length < minTabsRequired) continue;

    try {
      const groupIds = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupIds, {
        title: groupData.title,
        color: getRandomGroupColor(groupIndex++)
      });
    } catch (groupErr) {
      console.error("Error al crear grupos de pestañas:", groupErr);
    }
  }
}

export async function sortGroupsAlphabetically() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const pinnedTabs = tabs.filter(t => t.pinned);
  const unpinnedTabs = tabs.filter(t => !t.pinned);

  const groupIds = [...new Set(unpinnedTabs.map(t => t.groupId).filter(id => id !== -1))];
  if (groupIds.length === 0) return;

  const groupDetails = [];
  for (const groupId of groupIds) {
    try {
      const group = await chrome.tabGroups.get(groupId);
      groupDetails.push({
        id: groupId,
        title: group.title || "Sin título"
      });
    } catch (e) {}
  }

  groupDetails.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'accent', numeric: true }));

  const tabsByGroup = {};
  unpinnedTabs.forEach(tab => {
    if (tab.groupId !== -1) {
      if (!tabsByGroup[tab.groupId]) tabsByGroup[tab.groupId] = [];
      tabsByGroup[tab.groupId].push(tab.id);
    }
  });

  const ungroupedTabIds = unpinnedTabs.filter(tab => tab.groupId === -1).map(tab => tab.id);

  let orderedUnpinnedIds = [];
  for (const group of groupDetails) {
    if (tabsByGroup[group.id]) {
      orderedUnpinnedIds.push(...tabsByGroup[group.id]);
    }
  }
  orderedUnpinnedIds.push(...ungroupedTabIds);

  if (orderedUnpinnedIds.length > 0) {
    try {
      const targetIndex = pinnedTabs.length;
      await chrome.tabs.move(orderedUnpinnedIds, { index: targetIndex });
    } catch (e) {
      console.error("Error al ordenar alfabéticamente las pestañas:", e);
    }
  }
}

// Colapsar (minimizar) todos los grupos de la ventana actual
export async function collapseAllGroups() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const groupIds = [...new Set(tabs.map(t => t.groupId).filter(id => id !== -1))];
    
    for (const groupId of groupIds) {
      await chrome.tabGroups.update(groupId, { collapsed: true });
    }
  } catch (e) {
    console.error("Error al colapsar grupos:", e);
  }
}

export async function ungroupAllTabs() {
  const currentTabs = await chrome.tabs.query({ currentWindow: true });
  const tabIdsToUngroup = currentTabs
    .filter(tab => tab.groupId !== -1)
    .map(tab => tab.id);

  if (tabIdsToUngroup.length > 0) {
    try {
      await chrome.tabs.ungroup(tabIdsToUngroup);
    } catch (e) {
      console.error("Error al desagrupar pestañas:", e);
    }
  }
  previousState = null;
}

function normalizeTabUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.protocol.startsWith('http')) {
      return null;
    }
    const cleanPath = parsed.pathname.length > 1
      ? parsed.pathname.replace(/\/+$/, '')
      : parsed.pathname;
    return `${parsed.origin.toLowerCase()}${cleanPath}${parsed.search}`;
  } catch (e) {
    return null;
  }
}

export async function closeDuplicateTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const seenUrls = new Set();
    const duplicateTabIds = [];

    // Prioriza conservar pestañas activas o fijadas (pinned)
    const prioritizedTabs = [...tabs].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.index - b.index;
    });

    for (const tab of prioritizedTabs) {
      if (!tab.id || !tab.url) continue;
      const key = normalizeTabUrl(tab.url);
      if (!key) continue;

      if (seenUrls.has(key)) {
        duplicateTabIds.push(tab.id);
      } else {
        seenUrls.add(key);
      }
    }

    if (duplicateTabIds.length > 0) {
      await chrome.tabs.remove(duplicateTabIds);
    }
  } catch (e) {
    console.error("Error al cerrar pestañas duplicadas:", e);
  }
}