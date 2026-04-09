const state = {
  messages: [],
  knowledge: [],
  activeTab: 'messages',
  query: ''
};

const searchInput = document.getElementById('searchInput');
const statusText = document.getElementById('statusText');
const messageCount = document.getElementById('messageCount');
const knowledgeCount = document.getElementById('knowledgeCount');
const messagesList = document.getElementById('messagesList');
const knowledgeList = document.getElementById('knowledgeList');
const messagesEmpty = document.getElementById('messagesEmpty');
const knowledgeEmpty = document.getElementById('knowledgeEmpty');
const messageCardTemplate = document.getElementById('messageCardTemplate');
const knowledgeCardTemplate = document.getElementById('knowledgeCardTemplate');
const tabButtons = [...document.querySelectorAll('.tab-button')];
const tabPanels = {
  messages: document.getElementById('messagesTab'),
  knowledge: document.getElementById('knowledgeTab')
};

function formatDate(value) {
  if (!value) {
    return 'Unknown time';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function matchesQuery(values) {
  if (!state.query) {
    return true;
  }

  const haystack = values.map(normalize).join(' ');
  return haystack.includes(state.query);
}

function createMediaGroup(title, links) {
  if (!links.length) {
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'media-group';

  const heading = document.createElement('span');
  heading.className = 'media-heading';
  heading.textContent = title;
  wrapper.appendChild(heading);

  const linksWrap = document.createElement('div');
  linksWrap.className = 'media-links';

  links.forEach((url, index) => {
    const link = document.createElement('a');
    link.className = 'media-link';
    link.href = url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = `${title} ${index + 1}`;
    linksWrap.appendChild(link);
  });

  wrapper.appendChild(linksWrap);
  return wrapper;
}

function renderMessages() {
  messagesList.innerHTML = '';

  const filteredMessages = state.messages.filter((message) =>
    matchesQuery([
      message.sender,
      message.message,
      ...message.images,
      ...message.videos,
      ...message.gifs
    ])
  );

  messageCount.textContent = String(filteredMessages.length);
  messagesEmpty.classList.toggle('hidden', filteredMessages.length !== 0);

  filteredMessages.forEach((message) => {
    const fragment = messageCardTemplate.content.cloneNode(true);
    fragment.querySelector('.sender').textContent = message.sender || 'Unknown sender';
    fragment.querySelector('.timestamp').textContent = formatDate(message.timestamp);
    fragment.querySelector('.message-text').textContent = message.message || 'No text content';

    const mediaGroups = fragment.querySelector('.media-groups');
    const groups = [
      createMediaGroup('Image', message.images),
      createMediaGroup('Video', message.videos),
      createMediaGroup('GIF', message.gifs)
    ].filter(Boolean);

    if (!groups.length) {
      mediaGroups.remove();
    } else {
      groups.forEach((group) => mediaGroups.appendChild(group));
    }

    messagesList.appendChild(fragment);
  });
}

function renderKnowledge() {
  knowledgeList.innerHTML = '';

  const filteredKnowledge = state.knowledge.filter((entry) =>
    matchesQuery([
      entry.username,
      entry.category,
      entry.fact,
      entry.sourceMessage,
      entry.channel,
      entry.server
    ])
  );

  knowledgeCount.textContent = String(filteredKnowledge.length);
  knowledgeEmpty.classList.toggle('hidden', filteredKnowledge.length !== 0);

  filteredKnowledge.forEach((entry) => {
    const fragment = knowledgeCardTemplate.content.cloneNode(true);
    fragment.querySelector('.sender').textContent = entry.username || 'Unknown user';
    fragment.querySelector('.category').textContent = entry.category || 'uncategorized';
    fragment.querySelector('.fact-text').textContent = entry.fact || 'No fact stored';
    fragment.querySelector('.knowledge-meta').textContent = `${entry.server || 'DM'} • #${entry.channel || 'unknown'} • ${formatDate(entry.observedAt)}`;
    fragment.querySelector('.source-text').textContent = entry.sourceMessage ? `Source: ${entry.sourceMessage}` : 'Source: not available';
    knowledgeList.appendChild(fragment);
  });
}

function render() {
  renderMessages();
  renderKnowledge();

  Object.entries(tabPanels).forEach(([tabName, panel]) => {
    panel.classList.toggle('active', tabName === state.activeTab);
  });

  tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === state.activeTab);
  });
}

async function loadDashboardData() {
  statusText.textContent = 'Syncing';

  const [statusResponse, messagesResponse, knowledgeResponse] = await Promise.all([
    fetch('/api/status'),
    fetch('/api/messages'),
    fetch('/api/knowledge')
  ]);

  if (!statusResponse.ok || !messagesResponse.ok || !knowledgeResponse.ok) {
    throw new Error('Failed to load dashboard data');
  }

  const status = await statusResponse.json();
  const messagePayload = await messagesResponse.json();
  const knowledgePayload = await knowledgeResponse.json();

  state.messages = messagePayload.messages || [];
  state.knowledge = knowledgePayload.knowledge || [];
  statusText.textContent = `Connected to ${status.sheetName} / ${status.knowledgeSheetName}`;
  render();
}

searchInput.addEventListener('input', (event) => {
  state.query = normalize(event.target.value);
  render();
});

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.activeTab = button.dataset.tab;
    render();
  });
});

loadDashboardData().catch((error) => {
  console.error(error);
  statusText.textContent = 'Dashboard failed to load';
});

setInterval(() => {
  loadDashboardData().catch((error) => {
    console.error(error);
    statusText.textContent = 'Dashboard failed to refresh';
  });
}, 15000);
