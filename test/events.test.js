import test from 'node:test';
import assert from 'node:assert/strict';
import { eventToTask, normalizeRingEvent } from '../src/events.js';

test('normalizes Ring package events into an owned follow-up', () => {
  const event = normalizeRingEvent({
    id: 'event-1',
    attributes: { event_type: 'package_detected', start_time: '2026-10-11T12:00:00Z' }
  }, 'cam-1');
  const task = eventToTask(event, Date.parse('2026-10-11T12:04:00Z'));
  assert.equal(event.deviceId, 'cam-1');
  assert.equal(event.title, 'Package spotted');
  assert.equal(task.title, 'Confirm parcel was collected');
  assert.equal(task.owner, 'Front desk');
  assert.equal(task.age, '4m ago');
});

test('vehicle subtype on a motion event creates an arrival log task', () => {
  const task = eventToTask({ type: 'motion', subtype: 'vehicle', timestamp: new Date().toISOString() });
  assert.equal(task.title, 'Log arriving vehicle');
  assert.equal(task.owner, 'Floor lead');
});

test('offline device events are escalated for a coverage check', () => {
  const task = eventToTask({ type: 'device_offline', timestamp: new Date().toISOString() });
  assert.equal(task.urgency, 'high');
  assert.equal(task.title, 'Check camera connection');
});
