/**
 * App shell — providers only. Feature state lives in domain modules / AppWorkbench.
 * Growth freeze: do not add new product state here (see AGENTS.md).
 */
import { ThemeProvider } from "@/providers/ThemeProvider";
import { SkinShareProvider } from "@/providers/SkinShareProvider";
import { AppWorkbench } from "@/app/AppWorkbench";

export default function App() {
  return (
    <ThemeProvider>
      <SkinShareProvider>
        <AppWorkbench />
      </SkinShareProvider>
    </ThemeProvider>
  );
}
