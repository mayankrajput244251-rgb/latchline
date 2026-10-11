import { eventToTask } from './events.js';

const initialEvents = [
  { id: 'demo-7', type: 'package_detected', title: 'Package spotted', subtype: 'package', timestamp: new Date(Date.now() - 3 * 60000).toISOString(), source: 'demo', entrance: 'North loading door' },
  { id: 'demo-6', type: 'button_press', title: 'Doorbell pressed', subtype: 'visitor', timestamp: new Date(Date.now() - 11 * 60000).toISOString(), source: 'demo', entrance: 'Main entrance' },
  { id: 'demo-5', type: 'motion', title: 'Vehicle arrived', subtype: 'vehicle', timestamp: new Date(Date.now() - 24 * 60000).toISOString(), source: 'demo', entrance: 'Garage bay' }
];
let events = [...initialEvents];
let ringDevices = [];
let connected = false;
let activeFilter = 'all';
let nextId = 8;

const $ = (selector) => document.querySelector(selector);
const taskList = $('#taskList');
const activityList = $('#activityList');
const toastEl = $('#toast');
const iconFor = (type) => type.includes('package') ? ['▣', 'package'] : type.includes('ding') || type.includes('button') ? ['↗', 'door'] : type.includes('vehicle') ? ['▰', 'vehicle'] : type.includes('offline') ? ['⌁', 'offline'] : ['⌖', 'motion'];
const entranceFor = (event) => event.entrance || ringDevices.find((device) => device.id === event.deviceId)?.name || 'Workshop entrance';

function relativeTime(timestamp) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(timestamp)) / 60000));
  return minutes < 1 ? 'just now' : `${minutes}m ago`;
}

function render() {
  const openEvents = events.filter((event) => !event.done);
  $('#openCount').textContent = String(openEvents.length).padStart(2, '0');
  $('#filterAll').textContent = openEvents.length;
  const filtered = openEvents.filter((event) => {
    const task = eventToTask(event);
    return activeFilter === 'all' || (activeFilter === 'urgent' ? task.urgency !== 'low' : task.owner === 'Unassigned');
  });
  taskList.innerHTML = filtered.length ? filtered.map((event) => {
    const task = eventToTask(event);
    const [icon, iconClass] = iconFor(event.type);
    return `<article class="task-row" data-id="${escapeHtml(event.id)}"><div class="task-icon ${iconClass}">${icon}</div><div class="task-main"><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.detail)}</p><div class="task-meta"><span class="task-age">${relativeTime(event.timestamp)}</span><span class="owner-chip">${escapeHtml(event.owner)}</span></div><div class="task-tools"><button class="assign">Assign to me</button><button class="resolve">✓ Mark handled</button></div></div><span class="task-badge ${task.urgency}">${task.urgency === 'high' ? 'CHECK NOW' : task.urgency === 'medium' ? 'FOLLOW UP' : 'LOG'}</span></article>`;
  }).join('') : '<div class="empty-state"><span>✓</span>All caught up. The next handoff is in good shape.</div>';

  activityList.innerHTML = events.slice(0, 3).map((event) => {
    const [icon] = iconFor(event.type);
    return `<div class="activity-row"><div class="activity-marker">${icon}</div><div class="activity-copy"><b>${escapeHtml(event.title)}</b><span>${escapeHtml(entranceFor(event))}</span></div><span class="activity-time">${relativeTime(event.timestamp)}</span></div>`;
  }).join('');
  taskList.querySelectorAll('.assign').forEach((button) => button.addEventListener('click', () => mutateTask(button, false)));
  taskList.querySelectorAll('.resolve').forEach((button) => button.addEventListener('click', () => mutateTask(button, true)));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function mutateTask(button, done) {
  const id = button.closest('.task-row').dataset.id;
  const event = events.find((item) => item.id === id);
  if (!event) return;
  if (done) event.done = true;
  else event.assigned = true;
  if (event.assigned) event.owner = 'You';
  render();
  toast(done ? 'Handoff updated. Marked as handled.' : 'This follow-up is assigned to you.');
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function addDrillEvent() {
  const drill = [
    { type: 'package_detected', title: 'Package spotted', subtype: 'package', entrance: 'North loading door' },
    { type: 'button_press', title: 'Doorbell pressed', subtype: 'visitor', entrance: 'Main entrance' },
    { type: 'motion', title: 'Vehicle arrived', subtype: 'vehicle', entrance: 'Garage bay' }
  ][Math.floor(Math.random() * 3)];
  const event = { ...drill, id: `drill-${nextId++}`, timestamp: new Date().toISOString(), source: 'demo' };
  events.unshift(event);
  render();
  toast('Drill event added to the handoff queue.');
}

async function connectRing(token) {
  const response = await fetch('/api/ring/connect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not connect to Ring.');
  ringDevices = data.devices || [];
  connected = true;
  $('#connectionLabel').textContent = 'Ring connected';
  $('#connectionDetail').textContent = `${ringDevices.length} connected entrance${ringDevices.length === 1 ? '' : 's'}`;
  $('#connectButton').textContent = 'Disconnect ↗';
  $('#connectDialog').close();
  $('#tokenInput').value = '';
  await refreshEvents();
  toast('Ring devices connected. Event history is syncing.');
}

async function refreshEvents() {
  if (!connected || !ringDevices.length) return;
  try {
    const ids = ringDevices.map((device) => device.id).join(',');
    const response = await fetch(`/api/ring/events?devices=${encodeURIComponent(ids)}&since=${Date.now() - 24 * 60 * 60 * 1000}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ring events could not be loaded.');
    const ringEvents = (data.events || []).map((event) => ({ ...event, entrance: entranceFor(event) }));
    const demo = events.filter((event) => event.source === 'demo' && !event.done);
    events = [...ringEvents, ...demo].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    render();
  } catch (error) { toast(error.message); }
}

$('#addEvent').addEventListener('click', addDrillEvent);
$('#refreshEvents').addEventListener('click', refreshEvents);
$('#showAll').addEventListener('click', () => toast('Handoff history is ready for the next build step.'));
document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach((filter) => filter.classList.toggle('active', filter === button));
  render();
}));
$('#connectButton').addEventListener('click', async () => {
  if (connected) {
    await fetch('/api/ring/disconnect', { method: 'POST' });
    connected = false;
    ringDevices = [];
    events = events.filter((event) => event.source !== 'ring');
    $('#connectionLabel').textContent = 'Demo mode';
    $('#connectionDetail').textContent = '3 simulated entrances';
    $('#connectButton').innerHTML = 'Connect Ring <span>↗</span>';
    render();
    toast('Ring token cleared from this server.');
  } else $('#connectDialog').showModal();
});
$('#submitToken').addEventListener('click', async () => {
  const button = $('#submitToken');
  const error = $('#connectError');
  error.textContent = '';
  button.disabled = true;
  button.textContent = 'Connecting…';
  try { await connectRing($('#tokenInput').value.trim()); }
  catch (err) { error.textContent = err.message; }
  finally { button.disabled = false; button.textContent = 'Connect workspace'; }
});

render();
