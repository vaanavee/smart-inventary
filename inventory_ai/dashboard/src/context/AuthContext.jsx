import { createContext, useContext, useState } from "react";
import { monitorApi } from "../api/monitorClient.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "wisright-monitor-token";
const USER_KEY = "wisright-monitor-user";

function getInitialUser() {
  const stored = localStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getInitialUser);

  const loginAdmin = async (username, password) => {
    const data = await monitorApi.post("/auth/login", { username, password });
    const nextUser = { role: data.role, name: data.username };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const loginEmployee = async (empId, password) => {
    const data = await monitorApi.post("/auth/employee-login", { empId, password });
    const nextUser = { role: data.role, name: data.name, empId: data.empId };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loginAdmin, loginEmployee, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
