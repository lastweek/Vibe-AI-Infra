import { projects, categories, statusOrder } from './projects'
import './App.css'

function App() {
  const doneCount = projects.filter(p => p.status === 'Done').length
  const wipCount = projects.filter(p => p.status === 'WIP').length
  const tbdCount = projects.filter(p => p.status === 'TBD').length

  return (
    <div className="container">
      <header className="header">
        <h1>Vibe AI Infra</h1>
        <p>Nano-scale infrastructure for AI systems</p>
        <div className="stats">
          <div className="stat">
            <div className="stat-value">{projects.length}</div>
            <div className="stat-label">Total Projects</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: '#3fb950' }}>{doneCount}</div>
            <div className="stat-label">Done</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: '#d29922' }}>{wipCount}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: '#8b949e' }}>{tbdCount}</div>
            <div className="stat-label">Planned</div>
          </div>
        </div>
      </header>

      {categories.map(category => {
        const categoryProjects = projects
          .filter(p => p.category === category)
          .sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

        if (categoryProjects.length === 0) return null

        return (
          <section key={category} className="category">
            <div className="category-header">
              <h2 className="category-name">{category}</h2>
              <span className="category-count">{categoryProjects.length} projects</span>
            </div>
            <div className="projects-grid">
              {categoryProjects.map(project => (
                <article key={project.id} className="project-card">
                  <div className="project-header">
                    <h3 className="project-name">{project.name}</h3>
                    {project.github && (
                      <a
                        href={`https://github.com/lastweek/${project.github}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="project-link"
                        aria-label="View on GitHub"
                      >
                        <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                        </svg>
                      </a>
                    )}
                    <span className={`status status-${project.status.toLowerCase()}`}>
                      {project.status}
                    </span>
                  </div>
                  <p className="project-description">{project.description}</p>
                  {project.goals.length > 0 && (
                    <div className="goals-section">
                      <div className="goals-title">Goals</div>
                      <ul className="goals-list">
                        {project.goals.map((goal, i) => (
                          <li key={i}>{goal}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )
      })}

      <footer className="footer">
        <p>Built with Vite + React • Tracking progress on next-generation AI infrastructure</p>
      </footer>
    </div>
  )
}

export default App
