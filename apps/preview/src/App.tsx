import { Button } from "@frontend-forge/forge-components";
import { CrdStoreTest } from "./CrdStoreTest";

export function App() {
  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Frontend Forge</p>
        <h1>Forge Components Preview</h1>
        <p className="subtitle">
          A quick stage for iterating on UI primitives and themes.
        </p>
        <div className="actions">
          <Button.ForgeButton>Primary action</Button.ForgeButton>
          <Button.ForgeButton variant="ghost">Ghost action</Button.ForgeButton>
        </div>
      </header>
      <section className="grid">
        <div className="panel">
          <h2>Token-ready</h2>
          <p>Components expose class hooks for theming and system tokens.</p>
        </div>
        <div className="panel">
          <h2>Composable</h2>
          <p>Bring your own layout or wire it into the forge pipeline.</p>
        </div>
        <div className="panel">
          <h2>Fast feedback</h2>
          <p>Preview changes instantly with Vite dev server.</p>
        </div>
      </section>
      <CrdStoreTest />
    </div>
  );
}
