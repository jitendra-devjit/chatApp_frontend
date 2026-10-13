import { useEffect, useRef } from "react";

// Makes the back button (or the back swipe) of a phone close what is open on screen, a chat,
// a dialog, a picture, instead of leaving the app.
//
// Everything that opens adds one entry to the browser history. Going back removes that entry
// and closes the thing. Closing it on screen removes the entry again, so the history never
// fills up with entries that lead nowhere.
// Every history entry remembers how many things were open when it was made (`adda` in its state).

const stack = []; // what is open, the newest last: { close, path }

const depthOf = (state) => (state && typeof state.adda === "number" ? state.adda : 0);
const withDepth = (state, depth) => (state === null || typeof state === "object" ? { ...state, adda: depth } : state);

if (typeof window !== "undefined") {
  // The router makes entries of its own when the page changes. They get the count too,
  // otherwise coming back from another page would look like "everything was closed"
  const { pushState, replaceState } = window.history;
  window.history.pushState = function (state, ...rest) {
    return pushState.call(this, depthOf(state) ? state : withDepth(state, stack.length), ...rest);
  };
  window.history.replaceState = function (state, ...rest) {
    return replaceState.call(this, state && "adda" in state ? state : withDepth(state, depthOf(window.history.state)), ...rest);
  };

  // after a reload nothing is open, whatever the entry says
  if (depthOf(window.history.state)) replaceState.call(window.history, withDepth(window.history.state, 0), "");

  window.addEventListener("popstate", (event) => {
    const depth = depthOf(event.state);
    while (stack.length > depth) stack.pop().close();
  });
}

// Adds an entry for something that just opened. `close` is called when the user goes back.
// Returns a function to call when it was closed some other way
export function pushBackEntry(close) {
  const entry = { close, path: window.location.pathname };
  stack.push(entry);
  window.history.pushState(withDepth(window.history.state, stack.length), "");
  return () => {
    const index = stack.indexOf(entry);
    if (index === -1) return; // the back button already took it
    stack.splice(index, 1);
    // on another page by now, the entry stays behind and does nothing
    if (window.location.pathname === entry.path) window.history.back();
  };
}

// While `active` is true, going back calls `onBack` instead of leaving
export function useBackButton(active, onBack) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    if (!active) return;
    return pushBackEntry(() => onBackRef.current());
  }, [active]);
}

// the layout with one panel at a time, where "back" means the previous panel
export const isPhoneLayout = () => window.matchMedia("(max-width: 767px)").matches;

// a finger instead of a mouse: no hover, bigger targets, gestures
export const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;
