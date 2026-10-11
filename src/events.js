const titleFor = (type) => ({
  motion: 'Visitor detected',
  motion_detected: 'Visitor detected',
  ding: 'Doorbell pressed',
  button_press: 'Doorbell pressed',
  package: 'Package spotted',
  package_detected: 'Package spotted',
  vehicle: 'Vehicle arrived',
  person: 'Person detected',
  device_offline: 'Camera went offline',
  device_online: 'Camera back online'
}[type] || type.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase()));

export function normalizeRingEvent(item, deviceId = '') {
  const attr = item?.attributes || {};
  const rawType = attr.event_type || attr.type || item?.type || 'activity';
  const data = attr.data || {};
  return {
    id: String(item?.id || `${deviceId}-${attr.timestamp || Date.now()}`),
    deviceId: String(item?.relationships?.device?.data?.id || deviceId),
    type: String(rawType).toLowerCase(),
    title: titleFor(String(rawType).toLowerCase()),
    subtype: attr.sub_type || data.sub_type || data.type || '',
    timestamp: attr.start_time || attr.timestamp || attr.created_at || new Date().toISOString(),
    source: 'ring',
    raw: item
  };
}

export function eventToTask(event, now = Date.now()) {
  const mins = Math.max(0, Math.floor((now - Date.parse(event.timestamp)) / 60000));
  const kind = event.type;
  const packageEvent = kind.includes('package');
  const vehicle = kind.includes('vehicle') || String(event.subtype).includes('vehicle');
  const ding = kind.includes('ding') || kind.includes('button_press');
  const offline = kind.includes('offline');
  return {
    id: event.id,
    title: packageEvent ? 'Confirm parcel was collected' : vehicle ? 'Log arriving vehicle' : ding ? 'Assign the visitor at the door' : offline ? 'Check camera connection' : 'Review entrance activity',
    detail: packageEvent ? 'A delivery was spotted at the workshop entrance.' : vehicle ? 'A vehicle arrived. Confirm whether it is expected.' : ding ? 'A visitor pressed the doorbell and needs an owner.' : offline ? 'Entrance coverage may be interrupted.' : 'Motion was detected near the shared entrance.',
    age: mins < 1 ? 'just now' : `${mins}m ago`,
    urgency: offline ? 'high' : packageEvent || ding ? 'medium' : 'low',
    owner: event.owner || (packageEvent ? 'Front desk' : vehicle ? 'Floor lead' : 'Unassigned'),
    status: 'open'
  };
}
