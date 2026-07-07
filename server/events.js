const { EventEmitter } = require('events');

// Single shared bus: roomEntries.js emits on every RFID scan, the SSE stream
// route (and anything else that wants live updates) subscribes to it.
const roomEntryEvents = new EventEmitter();
roomEntryEvents.setMaxListeners(50);

module.exports = { roomEntryEvents };
