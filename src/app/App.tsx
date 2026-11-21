import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Shell from './Shell'
import Landing from '../features/landing/Landing'
import { ErrorBoundary, Spinner } from '../components/ui'

const Home = lazy(() => import('../features/home/Home'))
const GraphStudio = lazy(() => import('../features/graph-studio/GraphStudio'))
const ThreeDStudio = lazy(() => import('../features/three-d-studio/ThreeDStudio'))
const ImageStudio = lazy(() => import('../features/image-studio/ImageStudio'))
const VectorStudio = lazy(() => import('../features/vector-studio/VectorStudio'))
const FigureComposer = lazy(() => import('../features/figure-composer/FigureComposer'))
const DiagramStudio = lazy(() => import('../features/diagram-studio/DiagramStudio'))
const ResearchNavigator = lazy(() => import('../features/research/ResearchNavigator'))
const ReferenceManager = lazy(() => import('../features/research/ReferenceManager'))
const WritingLab = lazy(() => import('../features/writing-lab/WritingLab'))
const ParagraphRewriter = lazy(() => import('../features/text-lab/ParagraphRewriter'))
const ResearchToolkit = lazy(() => import('../features/toolkit/ResearchToolkit'))
const Contact = lazy(() => import('../features/contact/Contact'))
const FeatureTester = lazy(() => import('../features/testing/FeatureTester'))
const Projects = lazy(() => import('../features/projects/Projects'))
const VersionHistory = lazy(() => import('../features/history/VersionHistory'))
const Settings = lazy(() => import('../features/settings/Settings'))

function ScrollToTop() {
  const location = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }, [location.pathname])
  return null
}

function LoadingScreen() {
  return <div className="grid min-h-[55vh] place-items-center"><Spinner label="Opening workspace…" /></div>
}

export default function App() {
  return <Suspense fallback={<LoadingScreen />}>
    <ErrorBoundary>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<Shell />}>
        <Route path="/home" element={<Home />} />
        <Route path="/graphs" element={<GraphStudio />} />
        <Route path="/three-d" element={<ThreeDStudio />} />
        <Route path="/images" element={<ImageStudio />} />
        <Route path="/vector" element={<VectorStudio />} />
        <Route path="/figures" element={<FigureComposer />} />
        <Route path="/diagrams" element={<DiagramStudio />} />
        <Route path="/navigator" element={<ResearchNavigator />} />
        <Route path="/references" element={<ReferenceManager />} />
        <Route path="/writing" element={<WritingLab />} />
        <Route path="/rewriter" element={<ParagraphRewriter />} />
        <Route path="/toolkit" element={<ResearchToolkit />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/tester" element={<FeatureTester />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/history" element={<VersionHistory />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
    </ErrorBoundary>
  </Suspense>
}
