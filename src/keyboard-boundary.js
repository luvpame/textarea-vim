const KEYBOARD_EVENTS = ['keydown', 'keypress', 'keyup'];

export function containKeyboardEvents(host) {
  function stopKeyboardPropagation(event) {
    event.stopPropagation();
  }

  for (const eventType of KEYBOARD_EVENTS) {
    host.addEventListener(eventType, stopKeyboardPropagation, false);
  }
}
