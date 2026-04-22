export const validateToken = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return false;
    let token;
    try {
      const parsed = JSON.parse(raw);
      token = parsed?.token || parsed?.accessToken || (typeof parsed === "string" ? parsed : null);
    } catch { token = raw; }
    if (!token || typeof token !== "string") return false;
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    const payload = JSON.parse(atob(padded));
    if (payload.exp) {
      if (Math.floor(Date.now() / 1000) >= payload.exp) {
        _clearStorage();
        return false;
      }
    }
    return true;
  } catch { _clearStorage(); return false; }
};

export const getToken = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem("user") || "null");
    return parsed?.token || parsed?.accessToken || null;
  } catch { return null; }
};

export const getUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
};

const _clearStorage = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
};

export const logout = (redirect = true) => {
  _clearStorage();
  try {
    import("../socket/socket.js").then(({ disconnectSocket }) => disconnectSocket());
  } catch (_) {}
  if (redirect) window.location.replace("/login");
};