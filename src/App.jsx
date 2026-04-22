import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";

import PrivateRoute  from "./pages/PrivateRoute.jsx";
import HomePage      from "./Home.jsx";
import Login         from "./pages/Login.jsx";
import Signup        from "./pages/Signup.jsx";
import Dashboard     from "./pages/Dashboard.jsx";
import Analyze       from "./pages/Analyze.jsx";
import Compare       from "./pages/Compare.jsx";
import History       from "./pages/History.jsx";
import Movers        from "./pages/Mover.jsx";
import Favorites     from "./pages/Favorites.jsx";
import News          from "./pages/News.jsx";
import AIPrediction  from "./pages/AIPrediction.jsx";
import TradingDashboard from "./pages/AITradingDashboard.jsx";
function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"       element={<HomePage />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/analyze"   element={<PrivateRoute><Analyze /></PrivateRoute>} />
          <Route path="/compare"   element={<PrivateRoute><Compare /></PrivateRoute>} />
          <Route path="/history"   element={<PrivateRoute><History /></PrivateRoute>} />
          <Route path="/movers"    element={<PrivateRoute><Movers /></PrivateRoute>} />
          <Route path="/favorites" element={<PrivateRoute><Favorites /></PrivateRoute>} />
          <Route path="/news" element={<PrivateRoute><News /></PrivateRoute>} />
          <Route path="/ai"        element={<PrivateRoute><TradingDashboard/></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;