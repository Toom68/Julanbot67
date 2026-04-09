import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { Home } from "./components/Home";
import { People } from "./components/People";
import { JulianScans } from "./components/JulianScans";
import { PersonProfile } from "./components/PersonProfile";
import { KnowledgeBank } from "./components/KnowledgeBank";
import { Activity } from "./components/Activity";
import { Settings } from "./components/Settings";
import { Analytics } from "./components/Analytics";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: Home },
      { path: "people", Component: People },
      { path: "julian-scans", Component: JulianScans },
      { path: "person/:id", Component: PersonProfile },
      { path: "knowledge", Component: KnowledgeBank },
      { path: "activity", Component: Activity },
      { path: "settings", Component: Settings },
      { path: "analytics", Component: Analytics },
    ],
  },
]);
