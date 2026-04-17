import { useTheme } from "@/contexts/ThemeContext";
import colors from "@/constants/colors";

export function useColors() {
  const { theme } = useTheme();
  return { ...colors[theme], radius: colors.radius };
}
