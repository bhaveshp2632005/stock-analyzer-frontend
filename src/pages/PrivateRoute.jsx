import { Navigate } from "react-router-dom";
import { validateToken, logout } from "../utils/auth.js";

/* ══════════════════════════════════════════════════════════════
   PrivateRoute
   Route render hone se pehle token validate karta hai.
   Invalid/expired → localStorage clear + /login redirect
══════════════════════════════════════════════════════════════ */
const PrivateRoute = ({ children }) => {
  const isValid = validateToken();

  if (!isValid) {
    logout(false); // clear storage, no redirect (Navigate handles it)
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default PrivateRoute;