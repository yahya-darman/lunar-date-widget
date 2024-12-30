// Set up alarm to update data periodically
chrome.runtime.onInstalled.addListener(() => {
    // Update every hour
    chrome.alarms.create('updateData', {
        periodInMinutes: 60
    });
});

// Handle alarm
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'updateData') {
        // Trigger update in any open popup
        chrome.runtime.sendMessage({ action: 'update' });
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getData') {
        // Handle any data requests from popup
        sendResponse({ success: true });
    }
    return true;
}); 