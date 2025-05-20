// Platform adapters for different AI chat services
const platformAdapters = {
  chatgpt: {
    name: 'ChatGPT',
    isMatch: () => window.location.hostname === 'chat.openai.com' || window.location.hostname === 'chatgpt.com',
    getUserInputs: () => {
      const userMessages = document.querySelectorAll('.group.w-full:not(.bg-gray-50), [data-message-author-role="user"]');
      return Array.from(userMessages).map(el => {
        const textEl = el.querySelector('.whitespace-pre-wrap, [data-message-content]');
        const text = textEl ? textEl.textContent.trim() : '';
        return {
          element: el,
          text: text,
          timestamp: getTimestampFromElement(el)
        };
      }).filter(item => item.text);
    }
  },
  claude: {
    name: 'Claude',
    isMatch: () => window.location.hostname === 'claude.ai',
    getUserInputs: () => {
      const userMessages = document.querySelectorAll('.prose');
      return Array.from(userMessages)
        .filter(el => el.closest('[data-message-author-role="human"]'))
        .map(el => {
          return {
            element: el,
            text: el.textContent.trim(),
            timestamp: getTimestampFromElement(el)
          };
        }).filter(item => item.text);
    }
  },
  grok: {
    name: 'Grok',
    isMatch: () => window.location.hostname === 'grok.x.ai',
    getUserInputs: () => {
      const userMessages = document.querySelectorAll('[data-testid="chatmessageitem"]');
      return Array.from(userMessages)
        .filter(el => el.querySelector('[data-testid="user-chatmessage"]'))
        .map(el => {
          const textEl = el.querySelector('[data-testid="user-chatmessage"]');
          return {
            element: el,
            text: textEl ? textEl.textContent.trim() : '',
            timestamp: getTimestampFromElement(el)
          };
        }).filter(item => item.text);
    }
  },
  gemini: {
    name: 'Gemini',
    isMatch: () => window.location.hostname === 'gemini.google.com',
    getUserInputs: () => {
      const userMessages = document.querySelectorAll('.user-message, .query-text');
      return Array.from(userMessages).map(el => {
        return {
          element: el,
          text: el.textContent.trim(),
          timestamp: getTimestampFromElement(el)
        };
      }).filter(item => item.text);
    }
  },
  perplexity: {
    name: 'Perplexity',
    isMatch: () => window.location.hostname === 'perplexity.ai',
    getUserInputs: () => {
      const userMessages = document.querySelectorAll('.relative.group');
      return Array.from(userMessages)
        .filter(el => el.querySelector('.user-query'))
        .map(el => {
          const textEl = el.querySelector('.user-query');
          return {
            element: el,
            text: textEl ? textEl.textContent.trim() : '',
            timestamp: getTimestampFromElement(el)
          };
        }).filter(item => item.text);
    }
  }
};

// Helper function to extract timestamp from elements (fallback to current time if not found)
function getTimestampFromElement(element) {
  // This is a simplified implementation - in real usage,
  // you'd want to look for actual timestamp data in each platform
  // or create relative timestamps based on message order
  return new Date();
}

// Format timestamp for display
function formatTimestamp(timestamp) {
  // Handle both Date objects and timestamps
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
  }
}

// Get preview text (first 15 words)
function getPreviewText(text) {
  const words = text.split(/\s+/);
  const preview = words.slice(0, 15).join(' ');
  return words.length > 15 ? `${preview}...` : preview;
}

// State management
let state = {
  isVisible: false,
  currentPlatform: null,
  userInputs: [],
  bookmarks: {},
  searchQuery: '',
  filterBookmarked: false
};

// Load bookmarks from storage
function loadBookmarks() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bookmarks'], (result) => {
      if (result.bookmarks) {
        state.bookmarks = result.bookmarks;
        console.log('AI Chat Navigator: Loaded bookmarks:', Object.keys(state.bookmarks).length);
      } else {
        state.bookmarks = {};
      }
      resolve();
    });
  });
}

// Save bookmarks to storage
function saveBookmarks() {
  chrome.storage.local.set({ bookmarks: state.bookmarks }, () => {
    console.log('AI Chat Navigator: Saved bookmarks:', Object.keys(state.bookmarks).length);
  });
}

// Generate a unique ID for each message
function getMessageId(input) {
  // Use only the text content for the ID, without timestamp
  // This ensures the same message will have the same ID regardless of when it's processed
  return input.text.trim();
}

// Check if a message is bookmarked
function isBookmarked(input) {
  if (!input) return false;
  
  // Get the ID for this message
  const id = getMessageId(input);
  
  // Check if any existing bookmark key contains this message text
  const isBookmarked = Object.keys(state.bookmarks).some(key => {
    // For backward compatibility, check if the key contains our message text
    // This handles both old format (with timestamp) and new format (text only)
    return key.includes(id) || key === id;
  });
  
  console.log('AI Chat Navigator: Checking bookmark:', {
    messageText: id.substring(0, 50) + '...',
    isBookmarked,
    totalBookmarks: Object.keys(state.bookmarks).length,
    storedKeys: Object.keys(state.bookmarks).map(k => k.substring(0, 50) + '...')
  });
  
  return isBookmarked;
}

// Toggle bookmark for a message
function toggleBookmark(index) {
  const input = state.userInputs[index];
  if (!input) return;
  
  const id = getMessageId(input);
  
  // Find any existing bookmark that contains this message text
  const existingKey = Object.keys(state.bookmarks).find(key => key.includes(id));
  
  console.log('AI Chat Navigator: Toggling bookmark:', {
    messageText: id.substring(0, 50) + '...',
    existingKey: existingKey ? existingKey.substring(0, 50) + '...' : null,
    currentBookmarks: Object.keys(state.bookmarks).length
  });
  
  const newBookmarks = { ...state.bookmarks };
  
  if (existingKey) {
    // Remove the existing bookmark
    delete newBookmarks[existingKey];
  } else {
    // Add new bookmark with the message text as the key
    newBookmarks[id] = true;
  }
  
  state.bookmarks = newBookmarks;
  saveBookmarks();
  
  // Update the bookmark count immediately
  updateFilterButtons();
  
  // Only re-render the sidebar if we're in bookmark filter mode
  // This prevents unnecessary re-renders when in "All" mode
  if (state.filterBookmarked) {
    renderSidebar();
  } else {
    // Just update the bookmark icon for the clicked item
    const bookmarkButton = document.querySelector(`.ai-navigator-bookmark[data-index="${index}"]`);
    if (bookmarkButton) {
      const isBookmarkedInput = isBookmarked(input);
      bookmarkButton.style.color = isBookmarkedInput ? '#f1c40f' : '#ccc';
      bookmarkButton.classList.toggle('active', isBookmarkedInput);
    }
  }
}

// Add a visible initialization indicator
function addInitializationIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'ai-navigator-init-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 10px;
    border-radius: 4px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  indicator.textContent = 'AI Chat Navigator: Initializing...';
  document.body.appendChild(indicator);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }, 3000);
}

// Check if styles are loaded
function checkStylesLoaded() {
  const styleSheets = Array.from(document.styleSheets);
  const hasOurStyles = styleSheets.some(sheet => {
    try {
      return sheet.href && sheet.href.includes('styles.css');
    } catch (e) {
      return false;
    }
  });
  
  console.log('AI Chat Navigator: Styles loaded?', hasOurStyles);
  return hasOurStyles;
}

// Load styles manually if needed
function loadStyles() {
  return new Promise((resolve, reject) => {
    if (checkStylesLoaded()) {
      resolve();
      return;
    }

    console.log('AI Chat Navigator: Attempting to load styles manually');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('styles.css');
    
    link.onload = () => {
      console.log('AI Chat Navigator: Styles loaded successfully');
      resolve();
    };
    
    link.onerror = (error) => {
      console.error('AI Chat Navigator: Failed to load styles:', error);
      reject(error);
    };
    
    document.head.appendChild(link);
  });
}

// Create backdrop element
function createBackdrop() {
  const existingBackdrop = document.getElementById('ai-navigator-backdrop');
  if (existingBackdrop) {
    return existingBackdrop;
  }

  const backdrop = document.createElement('div');
  backdrop.id = 'ai-navigator-backdrop';
  backdrop.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 300px !important; /* Leave space for sidebar */
    bottom: 0 !important;
    background-color: rgba(0, 0, 0, 0.3) !important;
    z-index: 2147483645 !important;
    display: none !important;
    pointer-events: none !important;
    transition: opacity 0.3s ease-in-out !important;
    opacity: 0 !important;
  `;
  document.body.appendChild(backdrop);
  return backdrop;
}

// Create sidebar DOM element
async function createSidebar() {
  console.log('AI Chat Navigator: Starting sidebar creation');
  
  try {
    await loadStyles();
  } catch (error) {
    console.warn('AI Chat Navigator: Using inline styles as fallback');
  }
  
  // Create backdrop first
  const backdrop = createBackdrop();
  
  const sidebar = document.createElement('div');
  sidebar.className = 'ai-navigator-sidebar';
  sidebar.id = 'ai-navigator-sidebar';
  
  // Add inline styles as fallback with higher z-index and important flags
  const sidebarStyles = {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '300px',
    height: '100vh',
    backgroundColor: '#ffffff',
    zIndex: '2147483647',
    boxShadow: '-2px 0 10px rgba(0, 0, 0, 0.2)',
    transform: 'translateX(100%)',
    transition: 'transform 0.3s ease-in-out',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
    borderLeft: '1px solid rgba(0, 0, 0, 0.1)',
    pointerEvents: 'auto',
    visibility: 'visible',
    opacity: '1',
    isolation: 'isolate' // Creates a new stacking context
  };
  
  // Apply styles using setProperty for better control
  Object.entries(sidebarStyles).forEach(([property, value]) => {
    sidebar.style.setProperty(property, value, 'important');
  });
  
  sidebar.innerHTML = `
    <div class="ai-navigator-header" style="padding: 15px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); display: flex; justify-content: space-between; align-items: center; background-color: #f8f9fa;">
      <h3 class="ai-navigator-title" style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">AI Chat Navigator</h3>
      <button class="ai-navigator-close" style="background: none; border: none; cursor: pointer; font-size: 20px; color: #666; padding: 0 5px;">×</button>
    </div>
    <div class="ai-navigator-controls" style="padding: 15px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); background-color: #ffffff;">
      <input type="text" class="ai-navigator-search" placeholder="Search user inputs..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px;">
      <div class="ai-navigator-options" style="display: flex; gap: 8px;">
        <button class="ai-navigator-filter-btn" data-filter="all" style="flex: 1; padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; background: #f8f9fa; cursor: pointer;">All</button>
        <button class="ai-navigator-filter-btn" data-filter="bookmarked" style="flex: 1; padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; background: #f8f9fa; cursor: pointer;">Bookmarked</button>
        <button class="ai-navigator-export-btn" style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; background: #f8f9fa; cursor: pointer;">Export</button>
      </div>
    </div>
    <div class="ai-navigator-items" style="flex: 1; overflow-y: auto; padding: 10px; background-color: #ffffff;"></div>
    <div class="ai-navigator-footer" style="padding: 10px 15px; border-top: 1px solid rgba(0, 0, 0, 0.1); background-color: #f8f9fa; font-size: 12px; color: #666;">
      <span>Platform: <span class="ai-navigator-platform"></span></span>
      <span style="margin-left: 10px;">Inputs: <span class="ai-navigator-count">0</span></span>
    </div>
  `;
  
  document.body.appendChild(sidebar);
  console.log('AI Chat Navigator: Sidebar element created and added to DOM');
  
  // Store sidebar in state
  state.sidebar = sidebar;
  
  // Add event listeners
  sidebar.querySelector('.ai-navigator-close').addEventListener('click', toggleSidebar);
  
  sidebar.querySelector('.ai-navigator-search').addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    renderSidebar();
  });
  
  sidebar.querySelector('[data-filter="all"]').addEventListener('click', () => {
    state.filterBookmarked = false;
    renderSidebar();
    updateFilterButtons();
  });
  
  sidebar.querySelector('[data-filter="bookmarked"]').addEventListener('click', () => {
    state.filterBookmarked = true;
    renderSidebar();
    updateFilterButtons();
  });
  
  sidebar.querySelector('.ai-navigator-export-btn').addEventListener('click', exportUserInputs);
  
  return sidebar;
}

// Update filter buttons' active state
function updateFilterButtons() {
  const allBtn = document.querySelector('[data-filter="all"]');
  const bookmarkedBtn = document.querySelector('[data-filter="bookmarked"]');
  
  if (!allBtn || !bookmarkedBtn) return;
  
  // Update active state
  allBtn.style.backgroundColor = state.filterBookmarked ? '#f8f9fa' : '#e9ecef';
  allBtn.style.borderColor = state.filterBookmarked ? '#ddd' : '#ccc';
  bookmarkedBtn.style.backgroundColor = state.filterBookmarked ? '#e9ecef' : '#f8f9fa';
  bookmarkedBtn.style.borderColor = state.filterBookmarked ? '#ccc' : '#ddd';
  
  // Update bookmark count
  const bookmarkCount = Object.keys(state.bookmarks).length;
  bookmarkedBtn.textContent = `Bookmarked (${bookmarkCount})`;
}

// Toggle sidebar visibility
async function toggleSidebar() {
  console.log('AI Chat Navigator: Toggling sidebar');
  
  // Ensure backdrop exists
  createBackdrop();
  
  // Check if sidebar exists in DOM
  let sidebar = document.getElementById('ai-navigator-sidebar');
  
  if (!sidebar) {
    console.log('AI Chat Navigator: Creating sidebar on first open');
    
    // Detect platform before creating sidebar
    if (!state.currentPlatform) {
      state.currentPlatform = detectPlatform();
    }
    
    sidebar = await createSidebar();
    
    if (!sidebar) {
      console.error('AI Chat Navigator: Failed to create sidebar');
      return;
    }
    
    // Initialize messages when sidebar is first created
    await initializeMessages();
    
    // Make sidebar visible immediately after creation
    state.isVisible = true;
    sidebar.style.transform = 'translateX(0)';
    sidebar.classList.add('visible');
    
    // Show backdrop
    const backdrop = document.querySelector('.ai-navigator-backdrop');
    if (backdrop) {
      backdrop.style.display = 'block';
      requestAnimationFrame(() => {
        backdrop.style.opacity = '1';
      });
    }
    
    // Initial render of messages
    renderSidebar();
  } else {
    // Toggle visibility for existing sidebar
    state.isVisible = !state.isVisible;
    
    // Ensure messages are up to date before showing
    if (state.isVisible) {
      await initializeMessages();
      renderSidebar();
    }
    
    // Apply transform with requestAnimationFrame for smooth animation
    requestAnimationFrame(() => {
      const sidebarStyles = {
        transform: state.isVisible ? 'translateX(0)' : 'translateX(100%)',
        visibility: state.isVisible ? 'visible' : 'hidden'
      };
      
      Object.entries(sidebarStyles).forEach(([property, value]) => {
        sidebar.style.setProperty(property, value, 'important');
      });
      
      // Toggle backdrop
      const backdrop = document.querySelector('.ai-navigator-backdrop');
      if (backdrop) {
        backdrop.style.display = state.isVisible ? 'block' : 'none';
        if (state.isVisible) {
          requestAnimationFrame(() => {
            backdrop.style.opacity = '1';
          });
        } else {
          backdrop.style.opacity = '0';
        }
      }
    });
  }
  
  console.log('AI Chat Navigator: Sidebar visibility:', state.isVisible);
}

// Initialize messages from the page
async function initializeMessages() {
  console.log('AI Chat Navigator: Initializing messages');
  
  // Clear existing messages
  state.userInputs = [];
  
  if (!state.currentPlatform) {
    console.log('AI Chat Navigator: No platform detected, detecting now');
    state.currentPlatform = detectPlatform();
  }
  
  if (state.currentPlatform) {
    console.log('AI Chat Navigator: Using platform adapter:', state.currentPlatform.name);
    state.userInputs = state.currentPlatform.getUserInputs();
  } else {
    console.log('AI Chat Navigator: Using fallback message detection');
    // Fallback to basic message detection
    const messages = Array.from(document.querySelectorAll('div[data-message-author-role]'));
    console.log('AI Chat Navigator: Found messages:', messages.length);
    
    // Process each message
    for (const message of messages) {
      const role = message.getAttribute('data-message-author-role');
      if (role === 'user') {
        const text = message.textContent.trim();
        if (text) {
          state.userInputs.push({
            element: message,
            text,
            timestamp: new Date(), // Store as Date object
            role
          });
        }
      }
    }
  }
  
  console.log('AI Chat Navigator: Initialized messages:', state.userInputs.length);
  
  // Load bookmarks after messages are initialized
  await loadBookmarks();
  
  // Update filter buttons with initial counts
  updateFilterButtons();
}

// Refresh user inputs
function refreshInputs() {
  if (!state.currentPlatform) return;
  
  state.userInputs = state.currentPlatform.getUserInputs();
  renderSidebar();
}

// Render the sidebar content
function renderSidebar() {
  const itemsContainer = document.querySelector('.ai-navigator-items');
  if (!itemsContainer) return;
  
  console.log('AI Chat Navigator: Rendering sidebar:', {
    totalInputs: state.userInputs.length,
    filterBookmarked: state.filterBookmarked,
    bookmarks: Object.keys(state.bookmarks).length
  });
  
  // First filter by bookmark status if needed
  let filteredInputs = state.userInputs;
  if (state.filterBookmarked) {
    filteredInputs = filteredInputs.filter(input => isBookmarked(input));
    console.log('AI Chat Navigator: Bookmarked items:', filteredInputs.length);
  }
  
  // Then apply search filter to the already filtered list
  if (state.searchQuery) {
    filteredInputs = filteredInputs.filter(input => 
      input.text.toLowerCase().includes(state.searchQuery.toLowerCase())
    );
    console.log('AI Chat Navigator: Search results:', filteredInputs.length);
  }
  
  // Clear current items
  itemsContainer.innerHTML = '';
  
  // Show message if no items match the filter
  if (filteredInputs.length === 0) {
    const messageElement = document.createElement('div');
    messageElement.className = 'ai-navigator-empty-state';
    messageElement.style.cssText = `
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
      border-radius: 8px;
      background: #f5f5f5;
      margin: 10px;
    `;
    
    if (state.filterBookmarked) {
      if (state.searchQuery) {
        messageElement.innerHTML = `
          <div style="margin-bottom: 8px;">🔍</div>
          <div>No matching bookmarks found</div>
          <div style="font-size: 12px; margin-top: 4px; color: #888;">
            Try a different search term or bookmark some messages
          </div>
        `;
      } else {
        messageElement.innerHTML = `
          <div style="margin-bottom: 8px;">📚</div>
          <div>No bookmarked messages yet</div>
          <div style="font-size: 12px; margin-top: 4px; color: #888;">
            Click the star icon (★) on any message to bookmark it
          </div>
        `;
      }
    } else if (state.searchQuery) {
      messageElement.innerHTML = `
        <div style="margin-bottom: 8px;">🔍</div>
        <div>No messages found</div>
        <div style="font-size: 12px; margin-top: 4px; color: #888;">
          Try a different search term
        </div>
      `;
    } else {
      messageElement.innerHTML = `
        <div style="margin-bottom: 8px;">💬</div>
        <div>No messages yet</div>
        <div style="font-size: 12px; margin-top: 4px; color: #888;">
          Start a conversation to see your messages here
        </div>
      `;
    }
    
    itemsContainer.appendChild(messageElement);
    return;
  }
  
  // Add filtered items
  filteredInputs.forEach((input, index) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'ai-navigator-item';
    itemElement.dataset.index = index;
    
    const preview = getPreviewText(input.text);
    const timestamp = formatTimestamp(input.timestamp);
    const isBookmarkedInput = isBookmarked(input);
    const bookmarkClass = isBookmarkedInput ? 'active' : '';
    
    itemElement.innerHTML = `
      <div class="ai-navigator-item-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
        <span class="ai-navigator-timestamp" style="color: #666; font-size: 12px;">${timestamp}</span>
        <button class="ai-navigator-bookmark ${bookmarkClass}" data-index="${index}" 
          style="background: none; border: none; cursor: pointer; font-size: 16px; 
          color: ${isBookmarkedInput ? '#f1c40f' : '#ccc'}; 
          padding: 2px 5px; transition: all 0.2s ease;">★</button>
      </div>
      <div class="ai-navigator-preview" style="color: #333; margin-bottom: 5px;">${preview}</div>
      <div class="ai-navigator-content" style="display: none; color: #666; font-size: 14px;">${input.text}</div>
    `;
    
    itemsContainer.appendChild(itemElement);
    
    // Add event listeners
    itemElement.addEventListener('click', (e) => {
      // Don't toggle expanded state if clicking the bookmark button
      if (!e.target.classList.contains('ai-navigator-bookmark')) {
        scrollToInput(index);
        
        // Toggle expanded state
        const content = itemElement.querySelector('.ai-navigator-content');
        const preview = itemElement.querySelector('.ai-navigator-preview');
        if (content.style.display === 'none') {
          content.style.display = 'block';
          preview.style.display = 'none';
          itemElement.classList.add('expanded');
        } else {
          content.style.display = 'none';
          preview.style.display = 'block';
          itemElement.classList.remove('expanded');
        }
      }
    });
    
    // Add specific click handler for bookmark button
    const bookmarkButton = itemElement.querySelector('.ai-navigator-bookmark');
    bookmarkButton.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent item click event
      toggleBookmark(index);
    });
    
    // Add hover effect using JavaScript
    bookmarkButton.addEventListener('mouseenter', () => {
      if (!isBookmarkedInput) {
        bookmarkButton.style.color = '#f1c40f';
        bookmarkButton.style.transform = 'scale(1.1)';
      }
    });
    
    bookmarkButton.addEventListener('mouseleave', () => {
      if (!isBookmarkedInput) {
        bookmarkButton.style.color = '#ccc';
        bookmarkButton.style.transform = 'scale(1)';
      }
    });
  });
  
  // Update counters and platform info
  document.querySelector('.ai-navigator-count').textContent = state.userInputs.length;
  if (state.currentPlatform) {
    document.querySelector('.ai-navigator-platform').textContent = state.currentPlatform.name;
  }
  
  // Update filter buttons to reflect current state
  updateFilterButtons();
}

// Scroll to a specific input in the chat
function scrollToInput(index) {
  const input = state.userInputs[index];
  if (!input || !input.element) return;
  
  // Highlight the element temporarily
  input.element.classList.add('ai-navigator-highlighted');
  setTimeout(() => {
    input.element.classList.remove('ai-navigator-highlighted');
  }, 2000);
  
  // Scroll to the element
  input.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Export user inputs
function exportUserInputs() {
  let inputs = state.userInputs;
  
  // Apply filters if necessary
  if (state.searchQuery || state.filterBookmarked) {
    inputs = inputs.filter(input => {
      const matchesSearch = !state.searchQuery || input.text.toLowerCase().includes(state.searchQuery);
      const matchesFilter = !state.filterBookmarked || isBookmarked(input);
      return matchesSearch && matchesFilter;
    });
  }
  
  // Format as markdown
  let markdown = `# Exported User Inputs from ${state.currentPlatform.name}\n\n`;
  
  inputs.forEach((input, index) => {
    const timestamp = formatTimestamp(input.timestamp);
    const bookmarked = isBookmarked(input) ? ' ⭐' : '';
    markdown += `## Input ${index + 1} - ${timestamp}${bookmarked}\n\n${input.text}\n\n`;
  });
  
  // Copy to clipboard
  navigator.clipboard.writeText(markdown)
    .then(() => {
      alert('Exported content copied to clipboard!');
    })
    .catch(err => {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy to clipboard. See console for details.');
    });
}

// Detect current platform
function detectPlatform() {
  console.log('AI Chat Navigator: Starting platform detection');
  console.log('AI Chat Navigator: Current hostname:', window.location.hostname);
  
  for (const id in platformAdapters) {
    const adapter = platformAdapters[id];
    console.log(`AI Chat Navigator: Checking platform ${id}`);
    if (adapter.isMatch()) {
      console.log(`AI Chat Navigator: Matched platform ${id}`);
      state.currentPlatform = adapter;
      return adapter;
    }
  }
  console.log('AI Chat Navigator: No platform matched');
  return null;
}

// Initialize the extension
async function initialize() {
  addInitializationIndicator();
  await loadBookmarks();
  createBackdrop();
  
  const platform = detectPlatform();
  if (!platform) return;
  
  const existingSidebar = document.getElementById('ai-navigator-sidebar');
  if (!existingSidebar) {
    try {
      const sidebar = await createSidebar();
      if (sidebar) {
        state.isVisible = true;
        requestAnimationFrame(() => {
          sidebar.style.setProperty('transform', 'translateX(0)', 'important');
          sidebar.classList.add('visible');
        });
      }
    } catch (error) {
      console.error('AI Chat Navigator: Failed to create sidebar:', error);
    }
  }
  
  refreshInputs();
  setupMutationObserver();
}

// Setup mutation observer to detect new messages
function setupMutationObserver() {
  const observer = new MutationObserver(throttle(() => {
    if (state.isVisible) {
      refreshInputs();
    }
  }, 1000));
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Throttle function to prevent excessive refreshes
function throttle(func, delay) {
  let lastCall = 0;
  return function(...args) {
    const now = new Date().getTime();
    if (now - lastCall < delay) {
      return;
    }
    lastCall = now;
    return func(...args);
  };
}

// Add CSS highlight class for message highlighting
const highlightStyle = document.createElement('style');
highlightStyle.textContent = `
  .ai-navigator-highlighted {
    box-shadow: 0 0 0 2px #3498db !important;
    position: relative;
    z-index: 1;
  }
`;
document.head.appendChild(highlightStyle);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleSidebar') {
    toggleSidebar();
    sendResponse({ success: true });
  }
  return true;
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
} 