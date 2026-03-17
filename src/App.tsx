import { EditorProvider } from './useEditorStore'
import Toolbar from './components/Toolbar'
import MediaLibrary from './components/MediaLibrary'
import Preview from './components/Preview'
import Inspector from './components/Inspector'
import Timeline from './components/Timeline'
import './App.css'

function App() {
  return (
    <EditorProvider>
      <div className="app-shell">
        <Toolbar />
        <div className="app-workspace">
          <MediaLibrary />
          <Preview />
          <Inspector />
        </div>
        <Timeline />
      </div>
    </EditorProvider>
  )
}

export default App
