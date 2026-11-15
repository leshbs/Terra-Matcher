// Plain global stylesheet with an "ex-" prefix, used instead of CSS modules.
// `s.side` becomes the class name "ex-side", so the components don't change.
import "./explore.css";

const s = new Proxy({} as Record<string, string>, {
  get: (_t, key) => (typeof key === "string" ? `ex-${key}` : undefined),
});

export default s;
