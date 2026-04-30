import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { getApiBaseUrl } from "@/constants/api";

const TOKEN_KEY = "klaro_auth_token";
const USER_KEY = "klaro_auth_user";

export interface BusinessProfile {
  businessName?: string;
  segment?: string;
  segmentCustomLabel?: string;
  city?: string;
  state?: string;
  employeeCount?: number;
  openDays?: string[];
  openHours?: { start: string; end: string };
  monthlyRevenueGoal?: number;
  profitMarginGoal?: number;
  mainProducts?: string;
  salesChannel?: string;
  biggestChallenge?: string;
  // Anamnesis
  anamneseCompleted?: boolean;
  tempoMercado?: string;
  tipoNegocio?: string;
  ticketMedio?: string;
  faixaFaturamento?: string;
  controleFinanceiro?: string;
  sabeLucro?: string;
  separaFinancas?: string;
  conheceCustos?: string;
  comoDecide?: string;
  deixouInvestir?: string;
  surpresaCaixa?: string;
  maiorDificuldade?: string;
  querMelhorar?: string;
  comMaisClareza?: string;
  observacoesAdicionais?: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  businessProfile?: BusinessProfile | null;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: AuthUser) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          tokenRef.current = storedToken;
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setAuthTokenGetter(() => storedToken);
        }
      } catch {
        // Ignore storage errors
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const freshUser: AuthUser = data.user ?? data;
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser));
      setUser(freshUser);
      queryClient.invalidateQueries();
    } catch {
      // Network error — keep stale data
    }
  }, [queryClient]);

  // Refetch user from server whenever app returns to foreground
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === "active") refreshUser();
    };
    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [refreshUser]);

  const login = useCallback(async (newToken: string, newUser: AuthUser) => {
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, newToken),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser)),
    ]);
    tokenRef.current = newToken;
    setToken(newToken);
    setUser(newUser);
    setAuthTokenGetter(() => newToken);
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setAuthTokenGetter(null);
    queryClient.clear();
  }, [queryClient]);

  const updateUser = useCallback(async (updatedUser: AuthUser) => {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
