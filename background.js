// Helper function to get the current active tab
async function getCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) {
      console.log('AI Chat Navigator: No active tab found');
      return null;
    }
    return tabs[0];
  } catch (error) {
    console.log('AI Chat Navigator: Error getting current tab:', error);
    return null;
  }
}

// Helper function to check if a URL is from a supported platform
function isSupportedPlatformUrl(url) {
  if (!url) return false;
  
  console.log('AI Chat Navigator: Checking URL:', url);
  
  const supportedPlatforms = [
    'chat.openai.com',
    'chatgpt.com',
    'claude.ai',
    'grok.x.ai',
    'gemini.google.com',
    'perplexity.ai'
  ];
  
  const isSupported = supportedPlatforms.some(platform => url.includes(platform));
  console.log('AI Chat Navigator: Is supported platform?', isSupported);
  
  return isSupported;
}

// Helper function to toggle sidebar for a tab
async function toggleSidebarForTab(tab) {
  if (!tab || !tab.id) {
    console.log('AI Chat Navigator: Invalid tab');
    return;
  }
  
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
  } catch (error) {
    console.log('AI Chat Navigator: Content script not ready yet. Error:', error);
    try {
      // Try to inject the content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      // Try sending the message again after a short delay
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
        } catch (err) {
          console.log('AI Chat Navigator: Failed to send message after injection:', err);
        }
      }, 500);
    } catch (err) {
      console.log('AI Chat Navigator: Failed to inject content script:', err);
    }
  }
}

// Listen for keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-sidebar') {
    const tab = await getCurrentTab();
    if (!tab) return;
    
    console.log('AI Chat Navigator: Current tab URL:', tab.url);
    
    if (!isSupportedPlatformUrl(tab.url)) {
      console.log('AI Chat Navigator: Not a supported platform');
      return;
    }
    
    await toggleSidebarForTab(tab);
  }
});

// Listen for extension icon click
chrome.action.onClicked.addListener(async () => {
  // Always use getCurrentTab() for icon clicks
  const tab = await getCurrentTab();
  if (!tab) {
    console.log('AI Chat Navigator: Could not determine current tab');
    return;
  }
  
  console.log('AI Chat Navigator: Current tab URL:', tab.url);
  
  if (!isSupportedPlatformUrl(tab.url)) {
    console.log('AI Chat Navigator: Not a supported platform');
    return;
  }
  
  await toggleSidebarForTab(tab);
}); 