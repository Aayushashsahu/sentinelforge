import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import MissionDashboard from "./pages/MissionDashboard";
import MissionDetail from "./pages/MissionDetail";
import Readiness from "./pages/Readiness";
import NotFound from "./pages/NotFound";
import { Route, Switch } from "wouter";

function Router() { return <DashboardLayout><Switch><Route path="/" component={MissionDashboard} /><Route path="/missions/:id" component={MissionDetail} /><Route path="/readiness" component={Readiness} /><Route component={NotFound} /></Switch></DashboardLayout>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>; }
