import React from "react";
import ReactDOM from "react-dom";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { CssBaseline, KubedConfigProvider } from "@kubed/components";
import { init } from "@frontend-forge/forge-components";
import { App, HomePanels } from "./App";
import { CrdStoreTest } from "./CrdStoreTest";
import { TablePreview } from "./TablePreview";
import "./index.css";

init();

const win = window as typeof window & { t?: (label: string) => string };

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

win.t = (label) => label;

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePanels /> },
      { path: "table", element: <TablePreview /> },
      { path: "crd", element: <CrdStoreTest /> },
      {
        path: "/clusters/:cluster/table",
        element: <TablePreview />,
      },
    ],
  },
]);

ReactDOM.render(
  <React.StrictMode>
    <KubedConfigProvider>
      <CssBaseline />
      <RouterProvider router={router} />
    </KubedConfigProvider>
  </React.StrictMode>,
  root,
);
